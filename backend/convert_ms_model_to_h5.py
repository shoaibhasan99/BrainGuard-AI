"""
Convert MS model from Keras 3 .keras format to TensorFlow 2.x compatible .h5 format.

This script:
1. Fixes the model's internal config (batch_shape, module paths, etc.)
2. Loads the fixed .keras model using Keras 3
3. Saves it as .h5 using tf.keras (TensorFlow 2.x format)

Usage:
    python convert_ms_model_to_h5.py

Requirements:
    - Keras 3 (standalone keras) must be installed: pip install keras
    - TensorFlow 2.x must be installed
"""

import sys
import os
import json
import zipfile
import shutil
import tempfile
import re
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def fix_config_dict(obj):
    """Recursively fix config dictionary to make it compatible with tf.keras."""
    if isinstance(obj, dict):
        new_obj = {}
        
        # Check if this is a data augmentation layer config
        is_data_aug_layer = False
        class_name = obj.get('class_name', '')
        if class_name in ['RandomFlip', 'RandomRotation', 'RandomZoom']:
            is_data_aug_layer = True
        
        for key, value in obj.items():
            # Convert batch_shape to batch_input_shape
            if key == 'batch_shape':
                batch_shape = value
                if batch_shape and isinstance(batch_shape, list) and len(batch_shape) > 1:
                    batch_shape_tuple = tuple(None if (x is None or x == 'None' or x == 'null') else x for x in batch_shape)
                    new_obj['batch_input_shape'] = batch_shape_tuple
                continue
            
            # Remove data_format from data augmentation layers
            if key == 'data_format' and is_data_aug_layer:
                continue
            
            # Remove sparse from all layer configs
            if key == 'sparse':
                continue
            
            # Fix dtype field: convert nested DTypePolicy objects to simple strings
            if key == 'dtype' and isinstance(value, dict):
                if value.get('class_name') == 'DTypePolicy' and 'config' in value:
                    dtype_config = value.get('config', {})
                    dtype_name = dtype_config.get('name', 'float32')
                    new_obj[key] = dtype_name
                    continue
                elif value.get('class_name') == 'DTypePolicy':
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
                    new_obj[key] = 'tensorflow.python.keras.engine.sequential'
                elif 'keras.src.layers' in str(module):
                    new_obj[key] = 'tensorflow.python.keras.layers'
                else:
                    new_obj[key] = value
            elif key == 'layers' and isinstance(value, list):
                # Handle layers array - recursively fix each layer config
                new_obj[key] = [fix_config_dict(layer) for layer in value]
            elif key == 'config' and isinstance(value, dict):
                # Recursively fix nested config dictionaries
                new_obj[key] = fix_config_dict(value)
            else:
                # Recursively process nested structures
                new_obj[key] = fix_config_dict(value)
        return new_obj
    elif isinstance(obj, list):
        return [fix_config_dict(item) for item in obj]
    return obj

def convert_model():
    """Convert .keras model to .h5 format with config fixes."""
    model_dir = backend_dir / "models"
    keras_model_path = model_dir / "ms_model_tf.keras"
    h5_model_path = model_dir / "ms_model.h5"
    
    if not keras_model_path.exists():
        print(f"Error: {keras_model_path} not found!")
        print(f"Please ensure the model file exists at: {keras_model_path}")
        sys.exit(1)
    
    print(f"Converting model from: {keras_model_path}")
    print(f"To: {h5_model_path}")
    print()
    
    try:
        # Step 1: Fix the model's internal config
        print("Step 1: Fixing model's internal config...")
        with tempfile.NamedTemporaryFile(suffix='.keras', delete=False) as tmp_file:
            tmp_path = tmp_file.name
        
        shutil.copy(keras_model_path, tmp_path)
        
        # Read and fix config.json
        with zipfile.ZipFile(tmp_path, 'r') as zip_ref:
            config_str = zip_ref.read('config.json').decode('utf-8')
        
        # Parse and fix JSON
        config_dict = json.loads(config_str)
        config_dict = fix_config_dict(config_dict)
        
        # String-based replacements as backup
        config_str = json.dumps(config_dict)
        config_str = re.sub(r'"batch_shape"\s*:', '"batch_input_shape":', config_str)
        config_str = re.sub(r',?\s*"data_format"\s*:\s*"(?:channels_last|channels_first)"', '', config_str)
        config_str = re.sub(r',?\s*"sparse"\s*:\s*(?:true|false)', '', config_str)
        
        config_dict = json.loads(config_str)
        config_str = json.dumps(config_dict, indent=2)
        
        # Write fixed config back
        with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zip_out:
            with zipfile.ZipFile(keras_model_path, 'r') as zip_in:
                for item in zip_in.infolist():
                    if item.filename != 'config.json':
                        zip_out.writestr(item, zip_in.read(item.filename))
            zip_out.writestr('config.json', config_str.encode('utf-8'))
        
        print("  [OK] Config fixed (batch_shape, module paths, etc.)")
        print()
        
        # Step 2: Try to load with Keras 3
        print("Step 2: Loading fixed model with Keras 3...")
        import keras
        print(f"  Keras version: {keras.__version__}")
        
        # Try loading with custom objects to handle any remaining issues
        try:
            model = keras.models.load_model(tmp_path, compile=False)
        except Exception as e1:
            print(f"  Warning: Direct load failed: {e1}")
            print("  Trying with safe_mode=False...")
            try:
                model = keras.models.load_model(tmp_path, compile=False, safe_mode=False)
            except Exception as e2:
                print(f"  Error: Could not load model even with safe_mode=False: {e2}")
                raise
        
        print(f"  [OK] Model loaded successfully!")
        print(f"    Input shape: {model.input_shape}")
        print(f"    Output shape: {model.output_shape}")
        print()
        
        # Step 3: Save as .h5 using tf.keras
        print("Step 3: Saving model as .h5 using tf.keras...")
        import tensorflow as tf
        print(f"  TensorFlow version: {tf.__version__}")
        print(f"  tf.keras version: {tf.keras.__version__}")
        
        model.save(str(h5_model_path))
        print(f"  [OK] Model saved successfully as {h5_model_path}!")
        print()
        
        # Step 4: Verify the .h5 file can be loaded
        print("Step 4: Verifying converted model...")
        tf_model = tf.keras.models.load_model(str(h5_model_path), compile=False)
        print(f"  [OK] Converted model verified!")
        print(f"    Input shape: {tf_model.input_shape}")
        print(f"    Output shape: {tf_model.output_shape}")
        print()
        
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        print("="*80)
        print("CONVERSION SUCCESSFUL!")
        print("="*80)
        print(f"Converted model saved at: {h5_model_path}")
        print()
        print("The backend will automatically use the .h5 file if it exists.")
        print("Just restart your backend and it should work!")
        print("="*80)
        
        return True
        
    except ImportError as e:
        print("="*80)
        print("ERROR: Keras 3 (standalone keras) not found!")
        print("="*80)
        print("Please install Keras 3:")
        print("  pip install keras")
        print()
        print("Or if you're using a virtual environment:")
        print("  pip install --upgrade keras")
        print("="*80)
        sys.exit(1)
    except Exception as e:
        print("="*80)
        print("ERROR: Conversion failed!")
        print("="*80)
        print(f"Error: {e}")
        print()
        import traceback
        print("Full traceback:")
        traceback.print_exc()
        print("="*80)
        # Clean up temp file
        try:
            if 'tmp_path' in locals():
                os.unlink(tmp_path)
        except:
            pass
        sys.exit(1)

if __name__ == "__main__":
    convert_model()

