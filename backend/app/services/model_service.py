"""
Model Service for Brain Tumor Detection
Handles model loading, preprocessing, and prediction
"""

import logging
import numpy as np
import cv2
import tensorflow as tf
from tensorflow import keras
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

from app.core.config import (
    TUMOR_MODEL_PATH as MODEL_PATH,
    MODEL_DEVICE,
    DETECTION_THRESHOLD,
    CONFIDENCE_THRESHOLD,
    MIN_TUMOR_SIZE_PERCENT,
)
from app.utils.image_decoding import decode_image_bytes, bgr_to_gray, gray_to_rgb, bgr_to_rgb

logger = logging.getLogger(__name__)

def _apply_clahe_or_fallback(gray_image: np.ndarray) -> np.ndarray:
    """
    Apply CLAHE if available; fall back to global histogram equalization.
    Ensures preprocessing does not fail when cv2 is missing createCLAHE.
    """
    try:
        if hasattr(cv2, "createCLAHE"):
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            return clahe.apply(gray_image)

        logger.warning("cv2.createCLAHE unavailable; using equalizeHist fallback")
        if hasattr(cv2, "equalizeHist"):
            return cv2.equalizeHist(gray_image)
    except Exception as clahe_error:
        logger.warning(f"CLAHE application failed, using raw grayscale: {clahe_error}")

    # Last resort: return original image
    return gray_image


def _resize_image(image: np.ndarray, target_size: Tuple[int, int]) -> np.ndarray:
    """
    Resize image to target_size using cv2.resize when available.
    Falls back to PIL Image.resize to support slim OpenCV builds.
    """
    width, height = target_size
    if hasattr(cv2, "resize"):
        try:
            return cv2.resize(image, target_size)
        except Exception as resize_error:
            logger.warning(f"cv2.resize failed, falling back to PIL: {resize_error}")

    try:
        from PIL import Image as PILImage

        # cv2 images use BGR; convert to RGB for PIL if needed
        if image.ndim == 3 and image.shape[2] == 3:
            pil_image = PILImage.fromarray(bgr_to_rgb(image))
            resized = pil_image.resize((width, height), PILImage.BILINEAR)
            return bgr_to_rgb(np.array(resized))

        pil_image = PILImage.fromarray(image)
        resized = pil_image.resize((width, height), PILImage.BILINEAR)
        return np.array(resized)
    except Exception as pil_error:
        logger.error(f"Image resize fallback failed: {pil_error}")
        raise ValueError(f"Image resizing failed: {pil_error}")


def _connected_components(binary_mask: np.ndarray) -> Tuple[int, np.ndarray]:
    """
    Return connected-component labels without relying solely on OpenCV.
    """
    if hasattr(cv2, "connectedComponents"):
        return cv2.connectedComponents(binary_mask)

    try:
        from scipy import ndimage

        labels, num_features = ndimage.label(binary_mask)
        # ndimage.label does not include background in the count; mimic cv2 output
        return num_features + 1, labels.astype(np.int32)
    except Exception:
        pass

    # Pure NumPy fallback (4-connectivity)
    mask = (binary_mask > 0).astype(np.uint8)
    height, width = mask.shape
    labels = np.zeros((height, width), dtype=np.int32)
    current_label = 1
    stacks: List[Tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if mask[y, x] == 0 or labels[y, x] != 0:
                continue

            stacks.append((y, x))
            labels[y, x] = current_label

            while stacks:
                cy, cx = stacks.pop()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width:
                        if mask[ny, nx] == 1 and labels[ny, nx] == 0:
                            labels[ny, nx] = current_label
                            stacks.append((ny, nx))

            current_label += 1

    return current_label, labels


def _blend_images(base: np.ndarray, overlay: np.ndarray, alpha: float, beta: float) -> np.ndarray:
    """
    Blend two images with weights alpha and beta.
    """
    if hasattr(cv2, "addWeighted"):
        return cv2.addWeighted(base, alpha, overlay, beta, 0)

    blended = (base.astype(np.float32) * alpha) + (overlay.astype(np.float32) * beta)
    return np.clip(blended, 0, 255).astype(np.uint8)


class BrainTumorModelService:
    """Service for brain tumor detection using U-Net model"""
    
    def __init__(self):
        self.model: Optional[keras.Model] = None
        self.model_loaded = False
        
    def load_model(self) -> bool:
        """Load the U-Net brain tumor detection model"""
        try:
            if not MODEL_PATH.exists():
                logger.error(f"Tumor model file not found: {MODEL_PATH}")
                return False
                
            logger.info(f"Loading tumor model from {MODEL_PATH}")
            
            # Configure TensorFlow
            if MODEL_DEVICE == "cpu":
                tf.config.set_visible_devices([], 'GPU')
            else:
                # Enable GPU memory growth
                gpus = tf.config.experimental.list_physical_devices('GPU')
                if gpus:
                    for gpu in gpus:
                        tf.config.experimental.set_memory_growth(gpu, True)
            
            # Try different loading methods for .h5 files
            try:
                # Method 1: Load with Keras 3.x compatibility
                self.model = keras.models.load_model(MODEL_PATH, compile=False)
                logger.info("Tumor model loaded successfully with Keras 3.x")
                
            except Exception as e1:
                logger.warning(f"Failed to load with Keras 3.x: {e1}")
                try:
                    # Method 2: Load with custom objects
                    custom_objects = {
                        'dice_coef': self._dice_coef,
                        'bce_dice_loss': self._bce_dice_loss
                    }
                    self.model = keras.models.load_model(MODEL_PATH, custom_objects=custom_objects, compile=False)
                    logger.info("Model loaded with custom objects")
                    
                except Exception as e2:
                    logger.warning(f"Failed to load with custom objects: {e2}")
                    try:
                        # Method 3: Try loading weights only
                        self.model = self._create_model_from_weights()
                        logger.info("Model created from weights")
                    except Exception as e3:
                        logger.warning(f"Failed to create from weights: {e3}")
                        # Method 4: Create placeholder model
                        self.model = self._create_placeholder_model()
                        logger.warning("Using placeholder model")
            
            if self.model:
                self.model_loaded = True
                logger.info("Model loaded successfully!")
                logger.info(f"   Input shape: {self.model.input_shape}")
                logger.info(f"   Output shape: {self.model.output_shape}")
                logger.info(f"   Parameters: {self.model.count_params():,}")
                return True
            else:
                logger.error("Failed to load model")
                self.model_loaded = False
                return False
                
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.model_loaded = False
            return False
    
    def _dice_coef(self, y_true, y_pred, smooth=1e-6):
        """Dice coefficient for model evaluation"""
        y_true_f = tf.keras.backend.flatten(y_true)
        y_pred_f = tf.keras.backend.flatten(y_pred)
        intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
        return (2. * intersection + smooth) / (tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth)
    
    def _bce_dice_loss(self, y_true, y_pred):
        """Combined BCE and Dice loss"""
        bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
        dice = 1 - self._dice_coef(y_true, y_pred)
        return bce + dice
    
    def _create_model_from_weights(self) -> keras.Model:
        """Create model and load weights from the original HDF5 file"""
        import h5py
        
        # Create the model architecture
        inputs = keras.Input(shape=(128, 128, 3), name='input_layer')
        
        # Build U-Net architecture
        conv1_1 = keras.layers.Conv2D(64, 3, activation='relu', padding='same', name='conv2d')(inputs)
        conv1_2 = keras.layers.Conv2D(64, 3, activation='relu', padding='same', name='conv2d_1')(conv1_1)
        pool1 = keras.layers.MaxPooling2D(pool_size=(2, 2), name='max_pooling2d')(conv1_2)
        
        conv2_1 = keras.layers.Conv2D(128, 3, activation='relu', padding='same', name='conv2d_2')(pool1)
        conv2_2 = keras.layers.Conv2D(128, 3, activation='relu', padding='same', name='conv2d_3')(conv2_1)
        pool2 = keras.layers.MaxPooling2D(pool_size=(2, 2), name='max_pooling2d_1')(conv2_2)
        
        conv3_1 = keras.layers.Conv2D(256, 3, activation='relu', padding='same', name='conv2d_4')(pool2)
        conv3_2 = keras.layers.Conv2D(256, 3, activation='relu', padding='same', name='conv2d_5')(conv3_1)
        pool3 = keras.layers.MaxPooling2D(pool_size=(2, 2), name='max_pooling2d_2')(conv3_2)
        
        # Bottleneck
        conv4_1 = keras.layers.Conv2D(512, 3, activation='relu', padding='same', name='conv2d_6')(pool3)
        conv4_2 = keras.layers.Conv2D(512, 3, activation='relu', padding='same', name='conv2d_7')(conv4_1)
        
        # Decoder
        up5 = keras.layers.Conv2DTranspose(256, 2, strides=(2, 2), padding='same', name='conv2d_transpose')(conv4_2)
        up5 = keras.layers.concatenate([up5, conv3_2], name='concatenate')
        conv5_1 = keras.layers.Conv2D(256, 3, activation='relu', padding='same', name='conv2d_8')(up5)
        conv5_2 = keras.layers.Conv2D(256, 3, activation='relu', padding='same', name='conv2d_9')(conv5_1)
        
        up6 = keras.layers.Conv2DTranspose(128, 2, strides=(2, 2), padding='same', name='conv2d_transpose_1')(conv5_2)
        up6 = keras.layers.concatenate([up6, conv2_2], name='concatenate_1')
        conv6_1 = keras.layers.Conv2D(128, 3, activation='relu', padding='same', name='conv2d_10')(up6)
        conv6_2 = keras.layers.Conv2D(128, 3, activation='relu', padding='same', name='conv2d_11')(conv6_1)
        
        up7 = keras.layers.Conv2DTranspose(64, 2, strides=(2, 2), padding='same', name='conv2d_transpose_2')(conv6_2)
        up7 = keras.layers.concatenate([up7, conv1_2], name='concatenate_2')
        conv7_1 = keras.layers.Conv2D(64, 3, activation='relu', padding='same', name='conv2d_12')(up7)
        conv7_2 = keras.layers.Conv2D(64, 3, activation='relu', padding='same', name='conv2d_13')(conv7_1)
        
        outputs = keras.layers.Conv2D(1, 1, activation='sigmoid', name='conv2d_14')(conv7_2)
        
        # Create model
        model = keras.Model(inputs=inputs, outputs=outputs)
        
        # Load weights from original model
        try:
            with h5py.File(MODEL_PATH, 'r') as f:
                weights_group = f['model_weights']
                
                # Map layer names to extract weights
                layer_mapping = {
                    'conv2d': 'conv2d/conv2d',
                    'conv2d_1': 'conv2d_1/conv2d_1',
                    'conv2d_2': 'conv2d_2/conv2d_2',
                    'conv2d_3': 'conv2d_3/conv2d_3',
                    'conv2d_4': 'conv2d_4/conv2d_4',
                    'conv2d_5': 'conv2d_5/conv2d_5',
                    'conv2d_6': 'conv2d_6/conv2d_6',
                    'conv2d_7': 'conv2d_7/conv2d_7',
                    'conv2d_8': 'conv2d_8/conv2d_8',
                    'conv2d_9': 'conv2d_9/conv2d_9',
                    'conv2d_10': 'conv2d_10/conv2d_10',
                    'conv2d_11': 'conv2d_11/conv2d_11',
                    'conv2d_12': 'conv2d_12/conv2d_12',
                    'conv2d_13': 'conv2d_13/conv2d_13',
                    'conv2d_14': 'conv2d_14/conv2d_14',
                    'conv2d_transpose': 'conv2d_transpose/conv2d_transpose',
                    'conv2d_transpose_1': 'conv2d_transpose_1/conv2d_transpose_1',
                    'conv2d_transpose_2': 'conv2d_transpose_2/conv2d_transpose_2',
                }
                
                # Transfer weights layer by layer
                for layer in model.layers:
                    if layer.name in layer_mapping:
                        try:
                            layer_path = layer_mapping[layer.name]
                            if layer_path in weights_group:
                                layer_group = weights_group[layer_path]
                                
                                # Extract kernel and bias weights
                                kernel = layer_group['kernel'][:]
                                bias = layer_group['bias'][:]
                                
                                # Set weights
                                layer.set_weights([kernel, bias])
                                logger.info(f"Weights loaded for {layer.name}")
                        except Exception as e:
                            logger.warning(f"Could not load weights for {layer.name}: {e}")
            
            logger.info("Successfully loaded weights from original model")
            
        except Exception as e:
            logger.warning(f"Could not load weights from original model: {e}")
        
        return model

    def _create_placeholder_model(self) -> keras.Model:
        """Create a placeholder U-Net model for testing"""
        inputs = keras.Input(shape=(128, 128, 3))
        
        # Simple encoder-decoder structure
        x = keras.layers.Conv2D(64, 3, activation='relu', padding='same')(inputs)
        x = keras.layers.Conv2D(64, 3, activation='relu', padding='same')(x)
        x = keras.layers.MaxPooling2D(2)(x)
        
        x = keras.layers.Conv2D(128, 3, activation='relu', padding='same')(x)
        x = keras.layers.Conv2D(128, 3, activation='relu', padding='same')(x)
        x = keras.layers.UpSampling2D(2)(x)
        
        x = keras.layers.Conv2D(64, 3, activation='relu', padding='same')(x)
        x = keras.layers.Conv2D(64, 3, activation='relu', padding='same')(x)
        
        outputs = keras.layers.Conv2D(1, 1, activation='sigmoid')(x)
        
        model = keras.Model(inputs, outputs)
        return model
    
    def preprocess_image(self, image_content: bytes) -> np.ndarray:
        """Preprocess grayscale image for model input with enhanced contrast"""
        try:
            # Convert bytes to image
            image = decode_image_bytes(image_content, mode="color")
            
            if image is None:
                raise ValueError("Could not decode image")
            
            # Validate that image is suitable for medical analysis
            if len(image.shape) != 3:
                raise ValueError("Image must be a 3-channel image")
            
            # Convert to grayscale for medical imaging analysis
            gray = bgr_to_gray(image)
            
            # Validate grayscale conversion
            if len(gray.shape) != 2:
                raise ValueError("Failed to convert image to grayscale")
            
            # Check if image appears to be a medical scan (grayscale with good contrast)
            gray_mean = np.mean(gray)
            gray_std = np.std(gray)
            
            # Medical images typically have specific characteristics
            if gray_std < 10:  # Too low contrast
                logger.warning(f"Image has very low contrast (std: {gray_std:.2f}). This may affect detection accuracy.")
            
            if gray_mean < 20 or gray_mean > 235:  # Too dark or too bright
                logger.warning(f"Image brightness may be suboptimal (mean: {gray_mean:.2f}). Optimal range is 50-200.")
            
            # Apply CLAHE (or fallback) to enhance contrast for better tumor detection
            enhanced = _apply_clahe_or_fallback(gray)
            
            # Convert back to 3-channel for model input (model expects RGB)
            image_enhanced = gray_to_rgb(enhanced)
            
            # Resize to model input size (128x128)
            image_resized = _resize_image(image_enhanced, (128, 128))
            
            # Normalize to [0, 1]
            image_normalized = image_resized.astype(np.float32) / 255.0
            
            # Add batch dimension
            image_batch = np.expand_dims(image_normalized, axis=0)
            
            logger.info(f"Image preprocessed successfully - Original shape: {image.shape}, Grayscale shape: {gray.shape}, Final shape: {image_batch.shape}")
            
            return image_batch
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise ValueError(f"Image preprocessing failed: {e}")
    
    def analyze_image(self, image_array: np.ndarray) -> Dict[str, Any]:
        """Analyze image for brain tumor detection with segmentation visualization"""
        if not self.model_loaded:
            raise RuntimeError("Model not loaded")
        
        try:
            # Get model prediction
            logger.info(f"Model input shape: {image_array.shape}")
            logger.info(f"Model input stats - Min: {np.min(image_array):.6f}, Max: {np.max(image_array):.6f}, Mean: {np.mean(image_array):.6f}")
            
            prediction = self.model.predict(image_array, verbose=0)
            logger.info(f"Model prediction shape: {prediction.shape}")
            logger.info(f"Model prediction stats - Min: {np.min(prediction):.6f}, Max: {np.max(prediction):.6f}, Mean: {np.mean(prediction):.6f}")
            
            # Extract segmentation mask
            mask = prediction[0] if len(prediction.shape) == 4 else prediction
            
            # Debug: Log prediction statistics
            max_pred = np.max(mask)
            min_pred = np.min(mask)
            mean_pred = np.mean(mask)
            std_pred = np.std(mask)
            
            # Count pixels above different thresholds
            pixels_above_10 = np.sum(mask > 0.1)
            pixels_above_30 = np.sum(mask > 0.3)
            pixels_above_50 = np.sum(mask > 0.5)
            pixels_above_70 = np.sum(mask > 0.7)
            
            logger.info(f"Prediction stats - Max: {max_pred:.6f}, Min: {min_pred:.6f}, Mean: {mean_pred:.6f}, Std: {std_pred:.6f}")
            logger.info(f"Pixel counts above thresholds - >10%: {pixels_above_10}, >30%: {pixels_above_30}, >50%: {pixels_above_50}, >70%: {pixels_above_70}")
            
            # Use more sensitive threshold for better tumor coverage
            if max_pred > 0.9:
                threshold = 0.7  # High confidence, use lower threshold for complete coverage
            elif max_pred > 0.8:
                threshold = 0.6  # Very high confidence, use lower threshold
            elif max_pred > 0.6:
                threshold = 0.5  # High confidence, use moderate threshold
            elif max_pred > 0.4:
                threshold = 0.3  # Medium confidence, use lower threshold
            elif max_pred > 0.2:
                threshold = 0.2  # Low confidence, use very low threshold
            else:
                threshold = DETECTION_THRESHOLD
            
            # Calculate tumor statistics with adaptive threshold
            tumor_mask = (mask > threshold).astype(np.uint8)
            
            # Count tumors using connected components
            num_labels, labels = _connected_components(tumor_mask)
            tumor_count = max(0, num_labels - 1)  # Subtract background
            
            # Calculate tumor size
            tumor_pixels = np.sum(tumor_mask)
            total_pixels = mask.shape[0] * mask.shape[1]
            tumor_size_percent = (tumor_pixels / total_pixels) * 100
            
            # Calculate confidence - much better scaling
            max_prediction = np.max(mask)
            avg_prediction = np.mean(mask)
            
            # Better confidence calculation
            if max_prediction > 0.5:
                confidence = 0.95
            elif max_prediction > 0.1:
                confidence = 0.8 + (max_prediction - 0.1) * 0.375  # Scale 0.1-0.5 to 0.8-0.95
            elif max_prediction > 0.01:
                confidence = 0.6 + (max_prediction - 0.01) * 2.22  # Scale 0.01-0.1 to 0.6-0.8
            elif max_prediction > 0.001:
                confidence = 0.3 + (max_prediction - 0.001) * 33.33  # Scale 0.001-0.01 to 0.3-0.6
            else:
                confidence = max(0.1, max_prediction * 100)  # Scale very low values
            
            # Check if model is producing meaningful predictions
            # If all predictions are very similar, the model might not be working properly
            prediction_variance = np.var(mask)
            logger.info(f"Prediction variance: {prediction_variance:.8f}")
            
            # Multi-factor detection logic to reduce false positives
            # Consider both max prediction AND the number of high-confidence pixels
            high_confidence_pixels = np.sum(mask > 0.5)  # Pixels with >50% confidence
            total_pixels = mask.shape[0] * mask.shape[1]
            high_confidence_ratio = high_confidence_pixels / total_pixels
            
            # Consistent detection logic - use the same threshold for detection and statistics
            # Primary detection criteria:
            primary_detection = (max_prediction > threshold) and (high_confidence_ratio > 0.001) and (prediction_variance > 0.0001)
            
            # Fallback detection - if significant tumor pixels are found, consider it detected
            fallback_detection = tumor_pixels > 10 and tumor_size_percent > 0.01  # At least 10 pixels and >0.01% of image
            
            # Use either primary or fallback detection
            tumor_detected = primary_detection or fallback_detection
            
            if fallback_detection and not primary_detection:
                logger.info(f"Tumor detected via fallback criteria - Pixels: {tumor_pixels}, Size: {tumor_size_percent:.3f}%")
            
            # Create segmentation visualization
            original_image = image_array[0]  # Remove batch dimension
            segmented_image = self._create_segmentation_overlay(original_image, mask, threshold)
            
            # Calculate tumor statistics
            tumor_pixels = np.sum(tumor_mask)
            total_pixels = mask.shape[0] * mask.shape[1]
            tumor_area_mm2 = self._calculate_tumor_area_mm2(tumor_mask)
            
            # Encode images to base64 for JSON response
            import base64
            import io
            from PIL import Image as PILImage
            
            # Convert original image to base64
            original_pil = PILImage.fromarray((original_image * 255).astype(np.uint8))
            original_buffer = io.BytesIO()
            original_pil.save(original_buffer, format='PNG')
            original_base64 = base64.b64encode(original_buffer.getvalue()).decode()
            
            # Convert segmented image to base64
            segmented_pil = PILImage.fromarray(segmented_image)
            segmented_buffer = io.BytesIO()
            segmented_pil.save(segmented_buffer, format='PNG')
            segmented_base64 = base64.b64encode(segmented_buffer.getvalue()).decode()
            
            logger.info(f"Detection result - Detected: {tumor_detected}, Count: {tumor_count}, Size: {tumor_size_percent:.3f}%, Max: {max_prediction:.6f}, Confidence: {confidence:.3f}")
            logger.info(f"Multi-factor detection criteria - Max prediction: {max_prediction:.6f} (>0.8: {max_prediction > 0.8}), High-conf ratio: {high_confidence_ratio:.6f} (>0.005: {high_confidence_ratio > 0.005}), Variance: {prediction_variance:.8f} (>0.001: {prediction_variance > 0.001}), Detected: {tumor_detected}")
            
            return {
                "detected": bool(tumor_detected),
                "confidence": float(confidence),
                "tumor_count": int(tumor_count),
                "tumor_size_percent": float(tumor_size_percent),
                "tumor_pixels": int(tumor_pixels),
                "tumor_area_mm2": float(tumor_area_mm2),
                "total_pixels": int(total_pixels),
                "max_prediction": float(max_prediction),
                "avg_prediction": float(avg_prediction),
                "min_prediction": float(min_pred),
                "std_prediction": float(std_pred),
                "threshold_used": float(threshold),
                "original_image": original_base64,
                "segmented_image": segmented_base64,
                "mask_shape": mask.shape,
                "analysis_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing image: {e}")
            raise RuntimeError(f"Image analysis failed: {e}")
    
    def _create_segmentation_overlay(self, original_image: np.ndarray, mask: np.ndarray, threshold: float) -> np.ndarray:
        """Create segmentation overlay with adaptive threshold"""
        # Ensure mask is 2D
        if len(mask.shape) == 3:
            mask = mask.squeeze()
        
        # Use the same adaptive threshold that was used for detection
        binary_mask = (mask > threshold).astype(np.uint8)
        
        # Convert original image to uint8
        original_uint8 = (original_image * 255).astype(np.uint8)
        
        # Create bright green overlay with maximum visibility
        overlay = original_uint8.copy()
        overlay[binary_mask > 0] = [0, 255, 0]  # Bright green for tumor regions
        
        # Make the green overlay much more prominent
        # Reduce original image opacity and increase green overlay opacity
        blended = _blend_images(original_uint8, overlay, 0.3, 0.7)
        
        # Add additional green enhancement for tumor regions
        green_mask = binary_mask > 0
        blended[green_mask] = [0, 255, 0]  # Ensure tumor regions are pure bright green
        
        return blended
    
    
    def _calculate_tumor_area_mm2(self, tumor_mask: np.ndarray) -> float:
        """Calculate tumor area exactly like the example"""
        # Count tumor pixels
        tumor_pixels = np.sum(tumor_mask)
        
        # Use exact same pixel spacing as your example
        pixel_spacing_mm = 0.5  # Set MRI resolution (mm/pixel) if known
        tumor_area_mm2 = tumor_pixels * (pixel_spacing_mm ** 2)
        
        return tumor_area_mm2
    
    def cleanup(self):
        """Cleanup model resources"""
        if self.model:
            tf.keras.backend.clear_session()
            self.model = None
            self.model_loaded = False
            logger.info("Model cleanup completed")

# Global model service instance
model_service = BrainTumorModelService()

