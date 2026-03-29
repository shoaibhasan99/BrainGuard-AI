"""
Multiple Sclerosis Detection Service
Uses a fine-tuned ResNet50 classifier to detect MS lesions
"""

import base64
import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import tensorflow as tf
from PIL import Image as PILImage
from tensorflow import keras
from tensorflow.keras.layers import InputLayer as KerasInputLayer
from tensorflow.keras.layers import Conv2D as KerasConv2D
from app.core.config import MS_MODEL_PATH, MODEL_DEVICE
from app.utils.image_decoding import decode_image_bytes, bgr_to_rgb, bgr_to_gray, gray_to_rgb

# Attempt to import MixedPrecisionPolicy, with a fallback for older TF versions
try:
    from tensorflow.keras.mixed_precision import Policy as MixedPrecisionPolicy
    MIXED_PRECISION_AVAILABLE = True
except ImportError:
    logging.warning("TensorFlow mixed_precision.Policy not available. Falling back to default layers.")
    MIXED_PRECISION_AVAILABLE = False
    MixedPrecisionPolicy = None

logger = logging.getLogger(__name__)


def _resize_image(image: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
    """Resize image even when OpenCV is missing resize/cvtColor helpers."""
    width, height = target_size
    if hasattr(cv2, "resize"):
        try:
            return cv2.resize(image, target_size)
        except Exception as resize_error:
            logger.warning(f"cv2.resize failed, using Pillow fallback: {resize_error}")

    try:
        if image.ndim == 3 and image.shape[2] == 3:
            rgb_image = bgr_to_rgb(image)
            pil_image = PILImage.fromarray(rgb_image)
            resized_rgb = np.array(pil_image.resize((width, height), PILImage.BILINEAR))
            return resized_rgb[:, :, ::-1]  # RGB -> BGR

        pil_image = PILImage.fromarray(image)
        resized = pil_image.resize((width, height), PILImage.BILINEAR)
        return np.array(resized)
    except Exception as pil_error:
        logger.error(f"Pillow resize fallback failed: {pil_error}")
        raise ValueError(f"Image resizing failed: {pil_error}") from pil_error


class LegacyInputLayer(KerasInputLayer):
    """InputLayer compatible with legacy configs containing batch_shape."""

    def __init__(self, *args, **kwargs):
        batch_shape = kwargs.pop("batch_shape", None)
        legacy_shape = kwargs.pop("shape", None)
        if batch_shape is not None:
            kwargs.setdefault("batch_input_shape", tuple(batch_shape))
        elif legacy_shape is not None:
            kwargs.setdefault("input_shape", tuple(legacy_shape))
        super().__init__(*args, **kwargs)

    @classmethod
    def from_config(cls, config):
        # Make a copy to avoid mutating the original
        config = config.copy()
        batch_shape = config.pop("batch_shape", None)
        legacy_shape = config.pop("shape", None)
        if batch_shape is not None:
            config.setdefault("batch_input_shape", tuple(batch_shape))
        elif legacy_shape is not None:
            config.setdefault("input_shape", tuple(legacy_shape))
        return super().from_config(config)

    def get_config(self):
        config = super().get_config()
        batch_input_shape = config.get("batch_input_shape")
        input_shape = config.get("input_shape")
        if batch_input_shape is not None:
            config["batch_shape"] = list(batch_input_shape)
            config["shape"] = list(batch_input_shape[1:]) if len(batch_input_shape) > 1 else []
        elif input_shape is not None:
            config["shape"] = list(input_shape)
        return config


class CompatibleRandomFlip(tf.keras.layers.RandomFlip):
    """RandomFlip wrapper that strips incompatible parameters for tf.keras compatibility."""
    
    @classmethod
    def from_config(cls, config):
        # Make a copy to avoid mutating the original
        config = config.copy()
        # Remove incompatible parameters
        # - data_format: tf.keras doesn't accept it
        # - seed: Remove it - Keras 3's base Layer doesn't accept it
        # - mode: Remove it - Keras 3's base Layer doesn't accept it
        # Even though tf.keras RandomFlip accepts these, if deserializer falls back to Layer, it fails
        config.pop("data_format", None)
        config.pop("seed", None)
        mode = config.pop("mode", None)  # Save mode to set it manually after creation
        # Fix dtype: convert nested DTypePolicy objects to TensorFlow dtype
        if "dtype" in config:
            if isinstance(config["dtype"], dict):
                dtype_obj = config["dtype"]
                if dtype_obj.get("class_name") == "DTypePolicy" and "config" in dtype_obj:
                    dtype_str = dtype_obj["config"].get("name", "float32")
                    config["dtype"] = tf.dtypes.as_dtype(dtype_str)
                elif dtype_obj.get("class_name") == "DTypePolicy":
                    config["dtype"] = tf.dtypes.as_dtype("float32")
            elif isinstance(config["dtype"], str):
                # Ensure it's a proper TensorFlow dtype
                config["dtype"] = tf.dtypes.as_dtype(config["dtype"])
        # Call parent's from_config without mode/seed
        instance = super().from_config(config)
        # Set mode manually if it was provided (tf.keras RandomFlip accepts it)
        if mode is not None:
            instance.mode = mode
        return instance


class CompatibleRandomRotation(tf.keras.layers.RandomRotation):
    """RandomRotation wrapper that strips incompatible parameters for tf.keras compatibility."""
    
    @classmethod
    def from_config(cls, config):
        # Make a copy to avoid mutating the original
        config = config.copy()
        # Remove incompatible parameters - Keras 3's base Layer doesn't accept these
        config.pop("data_format", None)
        # Extract layer-specific parameters
        seed = config.pop("seed", None)
        factor = config.pop("factor", None)
        fill_mode = config.pop("fill_mode", None)
        fill_value = config.pop("fill_value", None)
        interpolation = config.pop("interpolation", None)
        # Fix dtype: convert nested DTypePolicy objects to TensorFlow dtype
        if "dtype" in config:
            if isinstance(config["dtype"], dict):
                dtype_obj = config["dtype"]
                if dtype_obj.get("class_name") == "DTypePolicy" and "config" in dtype_obj:
                    dtype_str = dtype_obj["config"].get("name", "float32")
                    config["dtype"] = tf.dtypes.as_dtype(dtype_str)
                elif dtype_obj.get("class_name") == "DTypePolicy":
                    config["dtype"] = tf.dtypes.as_dtype("float32")
            elif isinstance(config["dtype"], str):
                # Ensure it's a proper TensorFlow dtype
                config["dtype"] = tf.dtypes.as_dtype(config["dtype"])
        # Directly instantiate RandomRotation to avoid patched Layer.from_config
        # Build kwargs with only standard layer params + layer-specific params
        layer_kwargs = {
            "name": config.get("name", None),
            "trainable": config.get("trainable", True),
        }
        # Add dtype if it was converted
        if "dtype" in config:
            layer_kwargs["dtype"] = config["dtype"]
        # Add layer-specific parameters if present
        if factor is not None:
            layer_kwargs["factor"] = factor
        if fill_mode is not None:
            layer_kwargs["fill_mode"] = fill_mode
        if fill_value is not None:
            layer_kwargs["fill_value"] = fill_value
        if interpolation is not None:
            layer_kwargs["interpolation"] = interpolation
        if seed is not None:
            layer_kwargs["seed"] = seed
        # Create instance directly
        instance = cls(**layer_kwargs)
        return instance


class CompatibleRandomZoom(tf.keras.layers.RandomZoom):
    """RandomZoom wrapper that strips incompatible parameters for tf.keras compatibility."""
    
    @classmethod
    def from_config(cls, config):
        # Make a copy to avoid mutating the original
        config = config.copy()
        # Remove incompatible parameters - Keras 3's base Layer doesn't accept these
        config.pop("data_format", None)
        # Extract layer-specific parameters
        seed = config.pop("seed", None)
        height_factor = config.pop("height_factor", None)
        width_factor = config.pop("width_factor", None)
        fill_mode = config.pop("fill_mode", None)
        fill_value = config.pop("fill_value", None)
        interpolation = config.pop("interpolation", None)
        # Fix dtype: convert nested DTypePolicy objects to simple strings
        if "dtype" in config and isinstance(config["dtype"], dict):
            dtype_obj = config["dtype"]
            if dtype_obj.get("class_name") == "DTypePolicy" and "config" in dtype_obj:
                config["dtype"] = dtype_obj["config"].get("name", "float32")
            elif dtype_obj.get("class_name") == "DTypePolicy":
                config["dtype"] = "float32"
        # Directly instantiate RandomZoom to avoid patched Layer.from_config
        # Build kwargs with only standard layer params + layer-specific params
        layer_kwargs = {
            "name": config.get("name", None),
            "trainable": config.get("trainable", True),
        }
        # Add dtype if it was converted
        if "dtype" in config:
            layer_kwargs["dtype"] = config["dtype"]
        # Add layer-specific parameters if present
        if height_factor is not None:
            layer_kwargs["height_factor"] = height_factor
        if width_factor is not None:
            layer_kwargs["width_factor"] = width_factor
        if fill_mode is not None:
            layer_kwargs["fill_mode"] = fill_mode
        if fill_value is not None:
            layer_kwargs["fill_value"] = fill_value
        if interpolation is not None:
            layer_kwargs["interpolation"] = interpolation
        if seed is not None:
            layer_kwargs["seed"] = seed
        # Create instance directly
        instance = cls(**layer_kwargs)
        return instance


class CompatibleSequential(tf.keras.Sequential):
    """Sequential wrapper that adds build_from_config for Keras 3 compatibility."""
    
    @classmethod
    def from_config(cls, config, custom_objects=None):
        """Override from_config to handle Keras 3 compatibility."""
        # Call parent's from_config
        return super().from_config(config, custom_objects)
    
    def build_from_config(self, config):
        """Add build_from_config method that Keras 3 expects but tf.keras doesn't have.
        
        This is a no-op for Sequential models since they don't need explicit building.
        """
        # Sequential models don't need explicit building - layers are built when added
        pass


# Monkey-patch Sequential classes to add build_from_config method
# This ensures that even if the deserializer uses Sequential directly,
# it will have the required method
def build_from_config_method(self, config):
    """Add build_from_config method for Keras 3 compatibility."""
    # Sequential models don't need explicit building - layers are built when added
    pass

# Patch tf.keras.Sequential
if not hasattr(tf.keras.Sequential, 'build_from_config'):
    tf.keras.Sequential.build_from_config = build_from_config_method
    logger.info("Monkey-patched tf.keras.Sequential with build_from_config method")

# Also try to patch Keras 3's Sequential if it exists
try:
    import keras as standalone_keras
    if hasattr(standalone_keras, 'Sequential') and not hasattr(standalone_keras.Sequential, 'build_from_config'):
        standalone_keras.Sequential.build_from_config = build_from_config_method
        logger.info("Monkey-patched keras.Sequential with build_from_config method")
except (ImportError, AttributeError):
    pass

# Also patch the Sequential that might be in keras.src
try:
    from keras.src.engine import sequential as keras_sequential
    if hasattr(keras_sequential, 'Sequential') and not hasattr(keras_sequential.Sequential, 'build_from_config'):
        keras_sequential.Sequential.build_from_config = build_from_config_method
        logger.info("Monkey-patched keras.src.engine.sequential.Sequential with build_from_config method")
except (ImportError, AttributeError):
    pass


# Create custom objects mapping for Keras 3 -> tf.keras compatibility
def get_keras3_compatibility_objects():
    """Get custom objects to map Keras 3 classes to tf.keras equivalents."""
    # Use tf.keras directly since that's what the backend uses
    custom_objects = {
        "InputLayer": LegacyInputLayer,
        "Conv2D": KerasConv2D,
    }
    
    # Map Keras 3 Functional model to tf.keras Model
    custom_objects["Functional"] = tf.keras.Model
    # Use CompatibleSequential to handle build_from_config issue
    custom_objects["Sequential"] = CompatibleSequential
    
    # Add data augmentation layers - use compatible wrappers that strip data_format
    # Register with multiple name variants to ensure deserializer finds them
    try:
        rf_class = CompatibleRandomFlip
        custom_objects["RandomFlip"] = rf_class
        custom_objects["random_flip"] = rf_class  # lowercase variant
        # Also register with full module path if needed
        custom_objects["keras.layers.RandomFlip"] = rf_class
        custom_objects["keras.src.layers.preprocessing.image_preprocessing.RandomFlip"] = rf_class
    except AttributeError:
        logger.warning("CompatibleRandomFlip not available")
    
    try:
        rr_class = CompatibleRandomRotation
        custom_objects["RandomRotation"] = rr_class
        custom_objects["random_rotation"] = rr_class
        custom_objects["keras.layers.RandomRotation"] = rr_class
        custom_objects["keras.src.layers.preprocessing.image_preprocessing.RandomRotation"] = rr_class
    except AttributeError:
        logger.warning("CompatibleRandomRotation not available")
    
    try:
        rz_class = CompatibleRandomZoom
        custom_objects["RandomZoom"] = rz_class
        custom_objects["random_zoom"] = rz_class
        custom_objects["keras.layers.RandomZoom"] = rz_class
        custom_objects["keras.src.layers.preprocessing.image_preprocessing.RandomZoom"] = rz_class
    except AttributeError:
        logger.warning("CompatibleRandomZoom not available")
    
    # Handle DTypePolicy if available
    if MIXED_PRECISION_AVAILABLE and MixedPrecisionPolicy is not None:
        custom_objects["DTypePolicy"] = MixedPrecisionPolicy
        custom_objects["keras.DTypePolicy"] = MixedPrecisionPolicy
    
    return custom_objects


class MultipleSclerosisDetectionService:
    """Service responsible for loading the MS classifier and performing inference."""

    def __init__(self):
        self.model: Optional[keras.Model] = None
        self.model_loaded: bool = False
        self.input_size = (224, 224)

    def load_model(self) -> bool:
        """Load the MS detection model from disk using alternative approaches."""
        try:
            if not MS_MODEL_PATH.exists():
                logger.error(f"MS model file not found: {MS_MODEL_PATH}")
                return False

            logger.info(f"Loading Multiple Sclerosis model from {MS_MODEL_PATH}")

            # Configure TensorFlow device usage
            if MODEL_DEVICE == "cpu":
                tf.config.set_visible_devices([], "GPU")
            else:
                gpus = tf.config.experimental.list_physical_devices("GPU")
                for gpu in gpus:
                    tf.config.experimental.set_memory_growth(gpu, True)

            # ALTERNATIVE APPROACH: Try multiple strategies in order of simplicity
            self.model = None
            
            # Strategy 0: If .h5 file, load it simply (no conversion needed)
            if MS_MODEL_PATH.suffix == '.h5':
                try:
                    logger.info("Strategy 0: Loading .h5 model (simplest approach)")
                    # Use LegacyInputLayer and compatible data augmentation layers
                    custom_objects = {
                        'InputLayer': LegacyInputLayer,
                        'LegacyInputLayer': LegacyInputLayer,
                        'RandomFlip': CompatibleRandomFlip,
                        'RandomRotation': CompatibleRandomRotation,
                        'RandomZoom': CompatibleRandomZoom,
                    }
                    # Handle DTypePolicy - create a wrapper that converts to dtype
                    def dtype_policy_wrapper(config):
                        """Convert DTypePolicy config to actual dtype."""
                        if isinstance(config, dict):
                            if config.get("class_name") == "DTypePolicy" and "config" in config:
                                dtype_str = config["config"].get("name", "float32")
                                return tf.dtypes.as_dtype(dtype_str)
                            elif config.get("class_name") == "DTypePolicy":
                                return tf.dtypes.as_dtype("float32")
                        return config
                    
                    if MIXED_PRECISION_AVAILABLE and MixedPrecisionPolicy is not None:
                        # Wrap DTypePolicy to handle conversion
                        original_dtype_policy = MixedPrecisionPolicy
                        class DTypePolicyWrapper:
                            @classmethod
                            def from_config(cls, config):
                                return dtype_policy_wrapper(config)
                        custom_objects['DTypePolicy'] = DTypePolicyWrapper
                    
                    # Try loading with custom_object_scope for better isolation
                    # First try with safe_mode parameter if available
                    try:
                        with tf.keras.utils.custom_object_scope(custom_objects):
                            self.model = tf.keras.models.load_model(
                                str(MS_MODEL_PATH), 
                                compile=False,
                                safe_mode=False
                            )
                    except TypeError:
                        # safe_mode not available in this TensorFlow version, try without it
                        with tf.keras.utils.custom_object_scope(custom_objects):
                            self.model = tf.keras.models.load_model(
                                str(MS_MODEL_PATH), 
                                compile=False
                            )
                    if self.model is not None:
                        logger.info("Strategy 0 succeeded: Model loaded from .h5 file")
                        self.model_loaded = True
                        logger.info("Multiple Sclerosis model loaded successfully")
                        logger.info(f"  Input shape: {self.model.input_shape}")
                        logger.info(f"  Output shape: {self.model.output_shape}")
                        logger.info(f"  Parameters: {self.model.count_params():,}")
                        return True
                except Exception as e:
                    logger.warning(f"Strategy 0 (.h5 load) failed: {e}")
                    import traceback
                    logger.debug(f"Strategy 0 traceback: {traceback.format_exc()}")
            
            # Strategy 1: Try loading with Keras 3 (if available) and convert to .h5
            if MS_MODEL_PATH.suffix == '.keras':
                try:
                    logger.info("Strategy 1: Attempting to load with Keras 3 and convert to .h5 format")
                    self.model = self._try_keras3_conversion()
                    if self.model is not None:
                        logger.info("Strategy 1 succeeded: Model loaded via Keras 3 conversion")
                        self.model_loaded = True
                        logger.info("Multiple Sclerosis model loaded successfully")
                        logger.info(f"  Input shape: {self.model.input_shape}")
                        logger.info(f"  Output shape: {self.model.output_shape}")
                        logger.info(f"  Parameters: {self.model.count_params():,}")
                        return True
                except Exception as e:
                    logger.warning(f"Strategy 1 (Keras 3 conversion) failed: {e}")
            
            # Strategy 2: Try simple tf.keras load with LegacyInputLayer and compatible layers
            try:
                logger.info("Strategy 2: Attempting simple tf.keras load with LegacyInputLayer and compatible layers")
                custom_objects = {
                    'InputLayer': LegacyInputLayer,
                    'LegacyInputLayer': LegacyInputLayer,
                    'RandomFlip': CompatibleRandomFlip,
                    'RandomRotation': CompatibleRandomRotation,
                    'RandomZoom': CompatibleRandomZoom,
                }
                # Handle DTypePolicy
                if MIXED_PRECISION_AVAILABLE and MixedPrecisionPolicy is not None:
                    custom_objects['DTypePolicy'] = MixedPrecisionPolicy
                self.model = tf.keras.models.load_model(
                    str(MS_MODEL_PATH), 
                    compile=False,
                    custom_objects=custom_objects
                )
                if self.model is not None:
                    logger.info("Strategy 2 succeeded: Model loaded with LegacyInputLayer and compatible layers")
                    self.model_loaded = True
                    logger.info("Multiple Sclerosis model loaded successfully")
                    logger.info(f"  Input shape: {self.model.input_shape}")
                    logger.info(f"  Output shape: {self.model.output_shape}")
                    logger.info(f"  Parameters: {self.model.count_params():,}")
                    return True
            except Exception as e:
                logger.warning(f"Strategy 2 (LegacyInputLayer + compatible layers) failed: {e}")
            
            # Strategy 3: Try with all custom objects (including LegacyInputLayer)
            # For .h5 files, use compatible layers to handle data_format and DTypePolicy
            try:
                logger.info("Strategy 3: Attempting tf.keras load with all custom objects")
                if MS_MODEL_PATH.suffix == '.h5':
                    # For .h5 files, use compatible layers for data_format and DTypePolicy issues
                    custom_objects = {
                        'InputLayer': LegacyInputLayer,
                        'LegacyInputLayer': LegacyInputLayer,
                        'RandomFlip': CompatibleRandomFlip,
                        'RandomRotation': CompatibleRandomRotation,
                        'RandomZoom': CompatibleRandomZoom,
                    }
                    # Handle DTypePolicy
                    if MIXED_PRECISION_AVAILABLE and MixedPrecisionPolicy is not None:
                        custom_objects['DTypePolicy'] = MixedPrecisionPolicy
                else:
                    # For .keras files, use full compatibility objects
                    custom_objects = get_keras3_compatibility_objects()
                    custom_objects['InputLayer'] = LegacyInputLayer
                    custom_objects['LegacyInputLayer'] = LegacyInputLayer
                
                self.model = tf.keras.models.load_model(
                    str(MS_MODEL_PATH),
                    compile=False,
                    custom_objects=custom_objects
                )
                if self.model is not None:
                    logger.info("Strategy 3 succeeded: Model loaded with all custom objects")
                    self.model_loaded = True
                    logger.info("Multiple Sclerosis model loaded successfully")
                    logger.info(f"  Input shape: {self.model.input_shape}")
                    logger.info(f"  Output shape: {self.model.output_shape}")
                    logger.info(f"  Parameters: {self.model.count_params():,}")
                    return True
            except Exception as e:
                logger.warning(f"Strategy 3 (all custom objects) failed: {e}")
                import traceback
                logger.debug(f"Strategy 3 traceback: {traceback.format_exc()}")
            
            # Strategy 4: Fall back to module patching (only for .keras files)
            if MS_MODEL_PATH.suffix == '.keras':
                try:
                    logger.info("Strategy 4: Attempting module patching (complex approach)")
                    self.model = self._load_with_module_patching()
                    if self.model is not None:
                        logger.info("Strategy 4 succeeded: Model loaded via module patching")
                        self.model_loaded = True
                        logger.info("Multiple Sclerosis model loaded successfully")
                        logger.info(f"  Input shape: {self.model.input_shape}")
                        logger.info(f"  Output shape: {self.model.output_shape}")
                        logger.info(f"  Parameters: {self.model.count_params():,}")
                        return True
                except Exception as e:
                    logger.warning(f"Strategy 4 (module patching) failed: {e}")
            else:
                logger.info("Strategy 4 skipped: Module patching only works for .keras files")
            
            # All strategies failed
            raise RuntimeError("All loading strategies failed. Please convert the model to .h5 format using Keras 3.")
            
        except Exception as exc:
            logger.error(f"Failed to load MS model: {exc}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.error("\n" + "="*80)
            logger.error("RECOMMENDATION: Convert the model to .h5 format")
            logger.error("="*80)
            logger.error("To fix this issue, please run the conversion script:")
            logger.error("  python backend/convert_ms_model_to_h5.py")
            logger.error("="*80)
            self.model_loaded = False
            self.model = None
            return False
    
    def _try_keras3_conversion(self) -> Optional[keras.Model]:
        """Try to load with Keras 3 and convert to tf.keras format."""
        import json
        import zipfile
        import tempfile
        import shutil
        import os
        
        try:
            # Try to import standalone Keras 3
            import keras as standalone_keras
            logger.info(f"Found Keras 3 version: {standalone_keras.__version__}")
            
            # Step 1: Fix the model's internal config first
            logger.info("Fixing model's internal config before loading...")
            with tempfile.NamedTemporaryFile(suffix='.keras', delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            shutil.copy(MS_MODEL_PATH, tmp_path)
            
            # Read and fix config.json
            with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
                config_str = zip_ref.read('config.json').decode('utf-8')
            
            # Parse and fix JSON
            config_dict = json.loads(config_str)
            config_dict = self._fix_config_dict(config_dict)
            
            # String-based replacements as backup
            import re
            config_str = json.dumps(config_dict)
            config_str = re.sub(r'"batch_shape"\s*:', '"batch_input_shape":', config_str)
            config_str = re.sub(r',?\s*"data_format"\s*:\s*"(?:channels_last|channels_first)"', '', config_str)
            config_str = re.sub(r',?\s*"sparse"\s*:\s*(?:true|false)', '', config_str)
            
            config_dict = json.loads(config_str)
            config_str = json.dumps(config_dict, indent=2)
            
            # Write fixed config back
            with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
                with zipfile.ZipFile(MS_MODEL_PATH, 'r') as zip_in:
                    for item in zip_in.infolist():
                        if item.filename != 'config.json':
                            zip_out.writestr(item, zip_in.read(item.filename))
                zip_out.writestr('config.json', config_str.encode('utf-8'))
            
            logger.info("Config fixed, attempting to load with Keras 3...")
            
            # Step 2: Try to load with Keras 3
            try:
                keras3_model = standalone_keras.models.load_model(tmp_path, compile=False)
            except Exception as e1:
                logger.warning(f"Direct load failed: {e1}, trying with safe_mode=False...")
                keras3_model = standalone_keras.models.load_model(tmp_path, compile=False, safe_mode=False)
            
            if keras3_model is None:
                return None
            
            logger.info("Model loaded with Keras 3, converting to tf.keras format...")
            
            # Step 3: Save as .h5 using tf.keras
            h5_path = MS_MODEL_PATH.parent / "ms_model.h5"
            logger.info(f"Saving converted model to {h5_path}...")
            
            # Use tf.keras to save (this converts the format)
            keras3_model.save(str(h5_path))
            
            # Step 4: Load the .h5 file with tf.keras to verify
            logger.info("Loading converted .h5 model with tf.keras...")
            tf_model = tf.keras.models.load_model(str(h5_path), compile=False)
            
            logger.info("Conversion successful! Model is now in tf.keras format.")
            logger.info(f"Converted model saved at: {h5_path}")
            logger.info("The backend will automatically use this .h5 file on next restart.")
            
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except:
                pass
            
            return tf_model
            
        except ImportError:
            logger.warning("Keras 3 (standalone keras) not available for conversion")
            return None
        except Exception as e:
            logger.warning(f"Keras 3 conversion failed: {e}")
            # Clean up temp file
            try:
                if 'tmp_path' in locals():
                    os.unlink(tmp_path)
            except:
                pass
            return None
    
    def _fix_config_dict(self, obj):
        """Recursively fix config dictionary to replace batch_shape with batch_input_shape and remove data_format from augmentation layers."""
        if isinstance(obj, dict):
            # Create a new dict to avoid modifying while iterating
            new_obj = {}
            
            # Check if this is a data augmentation layer config
            is_data_aug_layer = False
            class_name = obj.get('class_name', '')
            if class_name in ['RandomFlip', 'RandomRotation', 'RandomZoom']:
                is_data_aug_layer = True
            
            for key, value in obj.items():
                # If we find batch_shape, convert it to batch_input_shape
                if key == 'batch_shape':
                    batch_shape = value
                    if batch_shape and isinstance(batch_shape, list) and len(batch_shape) > 1:
                        # Convert [None, H, W, C] to (None, H, W, C) for batch_input_shape
                        # Handle None in the list - JSON might serialize None as null or string "None"
                        batch_shape_tuple = tuple(None if (x is None or x == 'None' or x == 'null') else x for x in batch_shape)
                        new_obj['batch_input_shape'] = batch_shape_tuple
                    continue  # Skip adding batch_shape
                
                # Remove data_format from data augmentation layers (tf.keras doesn't accept it)
                if key == 'data_format' and is_data_aug_layer:
                    continue  # Skip adding data_format
                
                # Note: tf.keras RandomFlip DOES accept 'mode' and 'seed', so we keep them
                # Only remove parameters that tf.keras definitely doesn't accept
                
                # Remove sparse from all layer configs (tf.keras doesn't accept it)
                # Keras 3 uses it in InputLayer, but tf.keras doesn't support it
                if key == 'sparse':
                    continue  # Skip adding sparse
                
                # Fix dtype field: convert nested DTypePolicy objects to simple strings
                if key == 'dtype' and isinstance(value, dict):
                    # Check if it's a DTypePolicy object
                    if value.get('class_name') == 'DTypePolicy' and 'config' in value:
                        # Extract the actual dtype string from the nested config
                        dtype_config = value.get('config', {})
                        dtype_name = dtype_config.get('name', 'float32')
                        new_obj[key] = dtype_name  # Use simple string instead of nested object
                        continue
                    elif value.get('class_name') == 'DTypePolicy':
                        # Fallback: just use float32 if we can't extract it
                        new_obj[key] = 'float32'
                        continue
                
                # Fix module paths
                if key == 'module':
                    module = value
                    if 'keras.src' in str(module) or module == 'keras':
                        new_obj[key] = 'tensorflow.python.keras'
                    elif module == 'keras.layers':
                        new_obj[key] = 'tensorflow.python.keras.layers'
                    elif module == 'keras.initializers':
                        new_obj[key] = 'tensorflow.python.keras.initializers'
                    elif 'keras.src.models.functional' in str(module):
                        new_obj[key] = 'tensorflow.python.keras.engine.functional'
                    elif 'keras.src.engine.sequential' in str(module) or 'keras.src.models.sequential' in str(module):
                        # Keras 3 Sequential -> tf.keras Sequential
                        new_obj[key] = 'tensorflow.python.keras.engine.sequential'
                    elif 'keras.src.layers' in str(module):
                        # Keras 3 layer paths -> tf.keras layers
                        new_obj[key] = 'tensorflow.python.keras.layers'
                    else:
                        new_obj[key] = value
                # Also fix class_name for data augmentation layers to ensure they're found
                elif key == 'class_name':
                    class_name = value
                    # Ensure data augmentation layers use tf.keras names
                    if class_name in ['RandomFlip', 'RandomRotation', 'RandomZoom']:
                        new_obj[key] = class_name  # Keep the name, but module should be tf.keras
                    else:
                        new_obj[key] = value
                elif key == 'layers' and isinstance(value, list):
                    # Handle layers array - recursively fix each layer config
                    new_obj[key] = [self._fix_config_dict(layer) for layer in value]
                elif key == 'config' and isinstance(value, dict):
                    # Recursively fix nested config dictionaries (common in layer configs)
                    new_obj[key] = self._fix_config_dict(value)
                else:
                    # Recursively process nested structures
                    new_obj[key] = self._fix_config_dict(value)
            return new_obj
        elif isinstance(obj, list):
            return [self._fix_config_dict(item) for item in obj]
        return obj
    
    def _load_with_module_patching(self) -> keras.Model:
        """Attempt to load model by patching module imports and fixing JSON."""
        import json
        import zipfile
        import tempfile
        import shutil
        import os
        
        # .keras files are zip archives
        try:
            # Create a temporary copy
            with tempfile.NamedTemporaryFile(suffix='.keras', delete=False) as tmp_file:
                tmp_path = tmp_file.name
            
            shutil.copy(MS_MODEL_PATH, tmp_path)
            
            # Read and modify the config.json inside the zip
            with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
                config_str = zip_ref.read('config.json').decode('utf-8')
            
            # Parse JSON and fix it recursively
            config_dict = json.loads(config_str)
            logger.info("Fixing config: converting batch_shape to batch_input_shape and updating module paths")
            
            # First pass: recursive fix
            config_dict = self._fix_config_dict(config_dict)
            
            # Second pass: string-based replacement as backup (more aggressive)
            config_str_temp = json.dumps(config_dict)
            # Replace "batch_shape" with "batch_input_shape" in the JSON string
            # This is a more aggressive approach that catches everything
            import re
            # Pattern to match "batch_shape": [array] and replace with "batch_input_shape": [array]
            config_str_temp = re.sub(r'"batch_shape"\s*:', '"batch_input_shape":', config_str_temp)
            
            # Remove data_format from data augmentation layers (tf.keras doesn't accept it)
            # Pattern: "data_format": "channels_last" or "channels_first" - remove the entire key-value pair
            # This regex matches: ,"data_format":"value" or "data_format":"value", or at start/end
            config_str_temp = re.sub(r',?\s*"data_format"\s*:\s*"(?:channels_last|channels_first)"', '', config_str_temp)
            
            # Remove sparse from InputLayer configs (tf.keras doesn't accept it)
            # Pattern: "sparse": true/false - remove the entire key-value pair
            config_str_temp = re.sub(r',?\s*"sparse"\s*:\s*(?:true|false)', '', config_str_temp)
            
            # Note: We keep 'seed' and 'mode' - tf.keras augmentation layers DO accept these!
            
            # Fix dtype: convert nested DTypePolicy objects to simple strings
            # This is handled by the recursive _fix_config_dict, but add a simple regex as backup
            # Pattern: "dtype": {"class_name": "DTypePolicy", "config": {"name": "float32"}}
            # We'll do a simple replacement - the recursive fix should have already handled this
            # But if not, try to extract and replace
            dtype_policy_pattern = r'"dtype"\s*:\s*\{[^}]*"class_name"\s*:\s*"DTypePolicy"[^}]*"config"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*\}[^}]*\}'
            config_str_temp = re.sub(
                dtype_policy_pattern,
                r'"dtype": "\1"',
                config_str_temp
            )
            
            config_dict = json.loads(config_str_temp)
            # Run the recursive fix again to ensure everything is properly converted
            config_dict = self._fix_config_dict(config_dict)
            
            # Verify the fix worked
            config_str_check = json.dumps(config_dict)
            batch_shape_count = config_str_check.count('"batch_shape"')
            data_format_count = config_str_check.count('"data_format"')
            sparse_count = config_str_check.count('"sparse"')
            if batch_shape_count > 0:
                logger.warning(f"Warning: {batch_shape_count} instances of batch_shape still found after fix")
            if data_format_count > 0:
                logger.warning(f"Warning: {data_format_count} instances of data_format still found after fix")
            if sparse_count > 0:
                logger.warning(f"Warning: {sparse_count} instances of sparse still found after fix")
            if batch_shape_count == 0 and data_format_count == 0 and sparse_count == 0:
                logger.info("Config fix completed successfully - all batch_shape converted to batch_input_shape, data_format and sparse removed")
            
            # Convert back to JSON string
            config_str = json.dumps(config_dict, indent=2)
            
            # Write the modified config back to the zip
            with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
                # Copy all files except config.json
                with zipfile.ZipFile(MS_MODEL_PATH, 'r') as zip_in:
                    for item in zip_in.infolist():
                        if item.filename != 'config.json':
                            zip_out.writestr(item, zip_in.read(item.filename))
                # Write the modified config.json
                zip_out.writestr('config.json', config_str.encode('utf-8'))
            
            # Try loading the modified file with custom objects
            custom_objects = get_keras3_compatibility_objects()
            
            # CRITICAL: Patch Sequential classes RIGHT BEFORE loading to ensure they're patched
            # This must happen after all imports but before deserialization
            def patch_all_sequential_classes():
                """Patch all Sequential classes that might be used during deserialization."""
                import inspect
                
                # Helper to patch from_config for a Sequential class
                def patch_sequential_from_config(SequentialClass, class_name=""):
                    """Patch Sequential's from_config to ensure instances have build_from_config."""
                    if not hasattr(SequentialClass, 'build_from_config'):
                        SequentialClass.build_from_config = build_from_config_method
                    
                    # Patch from_config to ensure instances have build_from_config
                    if hasattr(SequentialClass, 'from_config'):
                        original_from_config = SequentialClass.from_config
                        
                        # Check the signature of the original from_config
                        try:
                            sig = inspect.signature(original_from_config)
                            # Check if it accepts custom_objects parameter
                            accepts_custom_objects = 'custom_objects' in sig.parameters
                        except:
                            # If we can't inspect, assume it doesn't (tf.keras behavior)
                            accepts_custom_objects = False
                        
                        @classmethod
                        def patched_from_config(cls, config, custom_objects=None):
                            """Patched from_config that ensures instances have build_from_config."""
                            # Call original with appropriate arguments based on its signature
                            if accepts_custom_objects:
                                instance = original_from_config(config, custom_objects)
                            else:
                                # tf.keras Sequential.from_config only takes config
                                instance = original_from_config(config)
                            
                            # Ensure the instance has build_from_config
                            if not hasattr(instance, 'build_from_config'):
                                instance.build_from_config = build_from_config_method
                            return instance
                        
                        SequentialClass.from_config = patched_from_config
                        logger.debug(f"Patched {class_name}.from_config to add build_from_config to instances (accepts_custom_objects={accepts_custom_objects})")
                
                # Patch tf.keras.Sequential
                patch_sequential_from_config(tf.keras.Sequential, "tf.keras.Sequential")
                
                # Patch keras.Sequential if it exists
                try:
                    import keras as standalone_keras
                    if hasattr(standalone_keras, 'Sequential'):
                        patch_sequential_from_config(standalone_keras.Sequential, "keras.Sequential")
                except (ImportError, AttributeError):
                    pass
                
                # Patch keras.src.engine.sequential.Sequential if it exists
                try:
                    from keras.src.engine import sequential as keras_sequential
                    if hasattr(keras_sequential, 'Sequential'):
                        patch_sequential_from_config(keras_sequential.Sequential, "keras.src.engine.sequential.Sequential")
                except (ImportError, AttributeError):
                    pass
                
                # Also try to patch tensorflow.python.keras.engine.sequential.Sequential
                try:
                    from tensorflow.python.keras.engine import sequential as tf_sequential
                    if hasattr(tf_sequential, 'Sequential'):
                        patch_sequential_from_config(tf_sequential.Sequential, "tensorflow.python.keras.engine.sequential.Sequential")
                except (ImportError, AttributeError):
                    pass
            
            # ROOT CAUSE FIX: Patch ALL common layer classes' from_config to add build_from_config to instances
            # This ensures that when ANY layer is created, it has build_from_config BEFORE Keras 3 calls it
            import inspect
            
            def patch_layer_from_config_to_add_build_method(layer_class, class_name):
                """Patch a layer class's from_config to add build_from_config to instances."""
                if not hasattr(layer_class, 'from_config'):
                    return False
                
                original_from_config = layer_class.from_config
                
                # Check if already patched
                if getattr(layer_class, '_build_from_config_patched', False):
                    return True
                
                # Check signature
                try:
                    sig = inspect.signature(original_from_config)
                    accepts_custom_objects = 'custom_objects' in sig.parameters
                except:
                    accepts_custom_objects = False
                
                @classmethod
                def patched_from_config(cls, config, custom_objects=None):
                    """Patched from_config that adds build_from_config to instances."""
                    # Call original from_config
                    if accepts_custom_objects and custom_objects is not None:
                        instance = original_from_config(config, custom_objects)
                    else:
                        instance = original_from_config(config)
                    
                    # CRITICAL: Add build_from_config IMMEDIATELY after instance creation
                    if not hasattr(instance, 'build_from_config'):
                        instance.build_from_config = build_from_config_method
                    
                    return instance
                
                # Patch the class
                layer_class.from_config = patched_from_config
                layer_class._build_from_config_patched = True
                return True
            
            # Patch ALL common layer classes
            common_layer_classes = [
                'Conv2D', 'Dense', 'MaxPooling2D', 'AveragePooling2D', 'GlobalAveragePooling2D',
                'BatchNormalization', 'Dropout', 'Activation', 'Flatten', 'Reshape',
                'Add', 'Concatenate', 'Multiply', 'Average', 'Maximum', 'InputLayer',
                'Conv2DTranspose', 'UpSampling2D', 'ZeroPadding2D', 'Cropping2D',
                'SeparableConv2D', 'DepthwiseConv2D', 'GlobalMaxPooling2D'
            ]
            
            patched_count = 0
            for layer_name in common_layer_classes:
                try:
                    layer_class = getattr(tf.keras.layers, layer_name, None)
                    if layer_class:
                        if patch_layer_from_config_to_add_build_method(layer_class, layer_name):
                            patched_count += 1
                except Exception as e:
                    logger.debug(f"Could not patch {layer_name}: {e}")
            
            logger.info(f"ROOT CAUSE FIX: Patched {patched_count} layer classes' from_config to add build_from_config")
            
            # Also patch Sequential classes for safety
            patch_all_sequential_classes()
            logger.info("Applied Sequential patches right before model loading")
            
            # Also try to intercept ALL layer creation during deserialization
            # by patching the serialization_lib's deserialize_keras_object function
            original_deserialize = None
            deserializer_patched = False
            try:
                from keras.src.saving import serialization_lib
                original_deserialize = serialization_lib.deserialize_keras_object
                
                def patched_deserialize(*args, **kwargs):
                    """ROOT CAUSE FIX: Wrap deserialization to catch build_from_config errors and fix them."""
                    # Intercept the config before deserialization
                    config = args[0] if args else kwargs.get('config', {})
                    
                    # ROOT CAUSE FIX: If this is a data augmentation layer, directly use our compatible wrapper
                    if isinstance(config, dict) and 'class_name' in config:
                        class_name = config.get('class_name')
                        
                        if class_name == 'RandomFlip':
                            logger.debug("Intercepting RandomFlip - using CompatibleRandomFlip directly")
                            instance = CompatibleRandomFlip.from_config(config)
                            if not hasattr(instance, 'build_from_config'):
                                instance.build_from_config = build_from_config_method
                            return instance
                        elif class_name == 'RandomRotation':
                            logger.debug("Intercepting RandomRotation - using CompatibleRandomRotation directly")
                            instance = CompatibleRandomRotation.from_config(config)
                            if not hasattr(instance, 'build_from_config'):
                                instance.build_from_config = build_from_config_method
                            return instance
                        elif class_name == 'RandomZoom':
                            logger.debug("Intercepting RandomZoom - using CompatibleRandomZoom directly")
                            instance = CompatibleRandomZoom.from_config(config)
                            if not hasattr(instance, 'build_from_config'):
                                instance.build_from_config = build_from_config_method
                            return instance
                    
                    # ROOT CAUSE FIX: Wrap the entire deserialization to catch build_from_config errors
                    # Keras 3's deserialize_keras_object calls instance.build_from_config(build_config)
                    # If it fails, we need to add the method and retry
                    try:
                        return original_deserialize(*args, **kwargs)
                    except AttributeError as e:
                        if 'build_from_config' in str(e):
                            # The error message contains the instance type, extract it
                            error_str = str(e)
                            logger.warning(f"Caught build_from_config error: {error_str}")
                            
                            # Try to patch ALL tf.keras layer classes' from_config methods
                            # This is a comprehensive fix for all layer types
                            import inspect
                            
                            # Get the class name from config if available
                            if isinstance(config, dict) and 'class_name' in config:
                                class_name = config.get('class_name')
                                
                                # Try to get and patch the class
                                cls = None
                                custom_objects = kwargs.get('custom_objects') or {}
                                cls = custom_objects.get(class_name) if custom_objects else None
                                
                                if cls is None:
                                    try:
                                        cls = getattr(tf.keras.layers, class_name, None)
                                    except:
                                        pass
                                
                                if cls and hasattr(cls, 'from_config'):
                                    original_from_config = cls.from_config
                                    
                                    # Check signature
                                    try:
                                        sig = inspect.signature(original_from_config)
                                        accepts_custom_objects = 'custom_objects' in sig.parameters
                                    except:
                                        accepts_custom_objects = False
                                    
                                    @classmethod
                                    def patched_from_config_fix(cls_inner, config_inner, custom_objects_inner=None):
                                        """Wrapper that adds build_from_config IMMEDIATELY after instance creation."""
                                        # Call original from_config
                                        if accepts_custom_objects and custom_objects_inner is not None:
                                            instance = original_from_config(config_inner, custom_objects_inner)
                                        else:
                                            instance = original_from_config(config_inner)
                                        
                                        # CRITICAL: Add build_from_config IMMEDIATELY after instance creation
                                        if not hasattr(instance, 'build_from_config'):
                                            instance.build_from_config = build_from_config_method
                                            logger.debug(f"Fixed: Added build_from_config to {class_name} instance")
                                        
                                        return instance
                                    
                                    # Patch the class
                                    cls.from_config = patched_from_config_fix
                                    
                                    try:
                                        # Retry deserialization with patched class
                                        result = original_deserialize(*args, **kwargs)
                                        logger.info(f"Successfully fixed build_from_config for {class_name}")
                                        return result
                                    finally:
                                        # Restore original
                                        cls.from_config = original_from_config
                            
                            # If we couldn't fix it, re-raise
                            raise
                        raise
                
                # Temporarily patch the deserializer
                serialization_lib.deserialize_keras_object = patched_deserialize
                logger.info("Patched keras.src.saving.serialization_lib.deserialize_keras_object - ROOT CAUSE FIX: intercepting data augmentation layers")
                deserializer_patched = True
            except Exception as e:
                logger.warning(f"Could not patch serialization_lib: {e}")
            
            try:
                # Register custom objects in ALL possible registries
                # 1. tf.keras global registry
                tf_custom_registry = tf.keras.utils.get_custom_objects()
                tf_custom_registry.update(custom_objects)
                
                # 2. keras registry (for Keras 3 compatibility)
                try:
                    import keras as standalone_keras
                    keras_custom_registry = standalone_keras.utils.get_custom_objects()
                    keras_custom_registry.update(custom_objects)
                except:
                    pass
                
                # 3. CRITICAL: Register in tensorflow.python.keras.utils.generic_utils._GLOBAL_CUSTOM_OBJECTS
                # This is what tf.keras.layers.serialization.deserialize actually uses
                try:
                    from tensorflow.python.keras.utils import generic_utils
                    # This is the registry that layer deserialization uses (note the underscore prefix)
                    if hasattr(generic_utils, '_GLOBAL_CUSTOM_OBJECTS'):
                        generic_utils._GLOBAL_CUSTOM_OBJECTS.update(custom_objects)
                        logger.info(f"Registered {len(custom_objects)} custom objects in _GLOBAL_CUSTOM_OBJECTS")
                    # Also try GLOBAL_CUSTOM_OBJECTS (without underscore) for compatibility
                    if hasattr(generic_utils, 'GLOBAL_CUSTOM_OBJECTS'):
                        generic_utils.GLOBAL_CUSTOM_OBJECTS.update(custom_objects)
                except Exception as e:
                    logger.warning(f"Could not update _GLOBAL_CUSTOM_OBJECTS: {e}")
                
                # 4. CRITICAL: Also patch tensorflow.python.keras.layers.serialization.deserialize
                # This is the deserializer that tf.keras uses internally
                try:
                    from tensorflow.python.keras.layers import serialization as layer_serialization
                    if hasattr(layer_serialization, 'deserialize'):
                        original_layer_deserialize = layer_serialization.deserialize
                        
                        def patched_layer_deserialize(config, custom_objects=None):
                            """Patch tf.keras layer deserialization to intercept data augmentation layers."""
                            # Check if this is a data augmentation layer
                            if isinstance(config, dict) and 'class_name' in config:
                                class_name = config.get('class_name')
                                
                                # Directly deserialize using our compatible wrappers
                                if class_name == 'RandomFlip':
                                    logger.debug("tf.keras deserializer: Intercepting RandomFlip")
                                    return CompatibleRandomFlip.from_config(config)
                                elif class_name == 'RandomRotation':
                                    logger.debug("tf.keras deserializer: Intercepting RandomRotation")
                                    return CompatibleRandomRotation.from_config(config)
                                elif class_name == 'RandomZoom':
                                    logger.debug("tf.keras deserializer: Intercepting RandomZoom")
                                    return CompatibleRandomZoom.from_config(config)
                            
                            # For all other layers, use original deserializer
                            return original_layer_deserialize(config, custom_objects)
                        
                        layer_serialization.deserialize = patched_layer_deserialize
                        logger.info("Patched tensorflow.python.keras.layers.serialization.deserialize")
                except Exception as e:
                    logger.warning(f"Could not patch layer_serialization.deserialize: {e}")
                
                # Now try loading - use ONLY tf.keras.load_model to avoid build_from_config issues
                # Keras 3's loader causes build_from_config errors with tf.keras Sequential models
                model = None
                last_error = None
                
                # Strategy 1: Use tf.keras loader with custom_object_scope
                try:
                    with tf.keras.utils.custom_object_scope(custom_objects):
                        model = tf.keras.models.load_model(
                            tmp_path,
                            compile=False,
                            custom_objects=custom_objects
                        )
                except Exception as e1:
                    last_error = e1
                    logger.warning(f"Strategy 1 (tf.keras with scope) failed: {e1}")
                
                # Strategy 2: Try without scopes (relying on global registries we updated)
                if model is None:
                    try:
                        model = tf.keras.models.load_model(
                            tmp_path,
                            compile=False,
                            custom_objects=custom_objects
                        )
                    except Exception as e2:
                        last_error = e2
                        logger.warning(f"Strategy 2 (tf.keras without scope) failed: {e2}")
                
                if model is None:
                    raise last_error or RuntimeError("All loading strategies failed")
                
                logger.info("Successfully loaded model using module patching method")
                return model
            finally:
                # Restore original deserializer if we patched it
                if deserializer_patched:
                    try:
                        from keras.src.saving import serialization_lib
                        serialization_lib.deserialize_keras_object = original_deserialize
                        logger.debug("Restored original deserializer")
                    except:
                        pass
                
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
        except Exception as e:
            logger.error(f"Module patching failed: {e}")
            import traceback
            logger.error(f"Module patching traceback: {traceback.format_exc()}")
            raise

    def preprocess_image(self, image_content: bytes) -> np.ndarray:
        """Convert raw bytes into a TensorFlow-ready tensor."""
        try:
            image = decode_image_bytes(image_content, mode="color")
            if image is None:
                raise ValueError("Unable to decode image")

            # Convert to grayscale because MS model expects single-channel inputs
            image_gray = bgr_to_gray(image)
            
            # Resize in grayscale space
            image_resized = _resize_image(image_gray, self.input_size)
            
            # Ensure channel dimension (H, W, 1)
            if image_resized.ndim == 2:
                image_resized = np.expand_dims(image_resized, axis=-1)
            
            # Normalize to [0, 1]
            image_normalized = image_resized.astype(np.float32) / 255.0
            
            # Add batch dimension
            batched_image = np.expand_dims(image_normalized, axis=0)

            logger.info(
                f"MS image preprocessed successfully - original: {image.shape}, "
                f"processed: {batched_image.shape}"
            )
            return batched_image

        except Exception as exc:
            logger.error(f"MS image preprocessing failed: {exc}")
            raise ValueError(f"Image preprocessing failed: {exc}") from exc

    def analyze_image(self, image_array: np.ndarray) -> Dict[str, Any]:
        """Run inference on the prepared tensor and build a structured response."""
        if not self.model_loaded or self.model is None:
            raise RuntimeError("MS model not loaded")

        try:
            prediction = self.model.predict(image_array, verbose=0)
            logger.info(f"MS prediction raw output shape: {prediction.shape}")

            probability = self._extract_probability(prediction)
            detected = probability >= 0.65  # require higher confidence to flag MS

            risk_level = self._risk_level(probability)

            original_image = self._encode_image_for_response(image_array)

            response = {
                "analysis_type": "multiple_sclerosis_detection",
                "detected": bool(detected),
                "confidence": float(probability),
                "ms_probability": float(probability),
                "risk_level": risk_level,
                "lesion_burden_score": float(probability * 100),
                "recommendations": self._recommendations(detected, risk_level),
                "analysis_timestamp": datetime.now().isoformat(),
                "model_info": {
                    "model_type": "ResNet50",
                    "input_size": f"{self.input_size[0]}x{self.input_size[1]}",
                    "device": MODEL_DEVICE,
                },
                "images": {
                    "input_image": original_image,
                    # Reuse input visualization so frontend output panel shows the scan
                    "tumor_overlay": original_image,
                },
                "tumor_statistics": {
                    "pixel_count": 0,
                    "tumor_count": 0,
                    "area_mm2": 0.0,
                    "total_pixels": int(self.input_size[0] * self.input_size[1]),
                    "tumor_percentage": 0.0,
                },
            }

            logger.info(
                f"MS detection completed - detected: {detected}, probability: {probability:.3f}, "
                f"risk_level: {risk_level}"
            )

            return response

        except Exception as exc:
            logger.error(f"MS analysis failed: {exc}")
            raise RuntimeError(f"MS analysis failed: {exc}") from exc

    def _extract_probability(self, prediction: np.ndarray) -> float:
        """Handle various output shapes from the classifier."""
        # Binary logits (batch, 1)
        if prediction.ndim == 2 and prediction.shape[1] == 1:
            logit = float(prediction[0][0])
            return float(1.0 / (1.0 + np.exp(-logit)))

        # Softmax logits (batch, 2)
        if prediction.ndim == 2 and prediction.shape[1] == 2:
            exp_preds = tf.nn.softmax(prediction, axis=1).numpy()
            return float(exp_preds[0][1])

        # Already probability scalar
        if prediction.ndim == 1:
            return float(prediction[0])

        raise ValueError(f"Unexpected prediction shape: {prediction.shape}")

    def _risk_level(self, probability: float) -> str:
        if probability >= 0.85:
            return "High"
        if probability >= 0.65:
            return "Moderate"
        if probability >= 0.45:
            return "Borderline"
        return "Low"

    def _recommendations(self, detected: bool, risk_level: str) -> List[str]:
        if not detected:
            return [
                "Continue routine neurological follow-ups.",
                "Repeat MRI in 6-12 months or sooner if symptoms change.",
            ]

        recommendations = [
            "Consult a neurologist specializing in Multiple Sclerosis.",
            "Review eligibility for disease-modifying therapy.",
            "Schedule follow-up MRI to monitor lesion progression.",
        ]

        if risk_level in {"High", "Moderate"}:
            recommendations.append("Consider spinal cord imaging for comprehensive assessment.")

        return recommendations

    def _encode_image_for_response(self, image_array: np.ndarray) -> str:
        """Convert the normalized tensor back to a base64 PNG."""
        # Convert back to viewable RGB image for the UI
        image = image_array[0]
        if image.shape[-1] == 1:
            image = image[:, :, 0]
            image = np.clip(image * 255.0, 0, 255).astype(np.uint8)
            image = gray_to_rgb(image)
        else:
            image = np.clip(image * 255.0, 0, 255).astype(np.uint8)
            image = bgr_to_rgb(image)

        pil_image = PILImage.fromarray(image)
        buffer = io.BytesIO()
        pil_image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode()

    def cleanup(self):
        """Release TensorFlow resources."""
        if self.model is not None:
            tf.keras.backend.clear_session()
            self.model = None
        self.model_loaded = False
        logger.info("MS model resources released")


ms_detection_service = MultipleSclerosisDetectionService()


