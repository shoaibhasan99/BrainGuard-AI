"""
Convert MS model to TensorFlow 2.15.0 compatible format
This script loads the MS model and re-saves it to fix DTypePolicy issues
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir / "app"))

def convert_ms_model():
    """Convert MS model to TF 2.15.0 compatible format."""
    import tensorflow as tf
    from app.core.config import MODEL_DIR
    
    print("="*80)
    print("MS Model Conversion Script for TensorFlow 2.15.0")
    print("="*80)
    print()
    
    # Find the MS model file
    model_path_h5 = MODEL_DIR / "final_ms_resnet50_finetuned.h5"
    model_path_keras = MODEL_DIR / "final_ms_resnet50_finetuned.keras"
    
    if model_path_h5.exists():
        input_path = model_path_h5
        print(f"Found MS model: {input_path}")
    elif model_path_keras.exists():
        input_path = model_path_keras
        print(f"Found MS model: {input_path}")
    else:
        print(f"[ERROR] MS model not found!")
        print(f"   Checked: {model_path_h5}")
        print(f"   Checked: {model_path_keras}")
        return False
    
    output_path = MODEL_DIR / "ms_model_tf215.h5"
    print(f"Output will be saved to: {output_path}")
    print()
    
    # Strategy 1: Use standalone Keras 3 to load and convert
    try:
        # Import standalone Keras 3 (not tf.keras)
        import keras as standalone_keras
        print(f"Using standalone Keras: {standalone_keras.__version__}")
        print("Attempting to load with Keras 3...")
        print()
        
        # Load with Keras 3 (it can handle the DTypePolicy objects)
        try:
            keras3_model = standalone_keras.models.load_model(str(input_path), compile=False)
        except Exception as e:
            print(f"Direct load failed: {e}")
            print("Trying with safe_mode=False...")
            keras3_model = standalone_keras.models.load_model(str(input_path), compile=False, safe_mode=False)
        
        if keras3_model is None:
            raise RuntimeError("Failed to load model with Keras 3")
        
        print("[OK] Model loaded with Keras 3!")
        print(f"   Input shape: {keras3_model.input_shape}")
        print(f"   Output shape: {keras3_model.output_shape}")
        print()
        
        # Save with tf.keras (this converts DTypePolicy to simple dtype strings)
        print("Converting and saving with TensorFlow 2.15.0...")
        # Use tf.keras to save - this will convert the format
        tf.keras.models.save_model(keras3_model, str(output_path))
        
        # Verify the converted model loads with tf.keras
        print("Verifying converted model...")
        tf_model = tf.keras.models.load_model(str(output_path), compile=False)
        
        print()
        print("="*80)
        print("[OK] CONVERSION SUCCESSFUL!")
        print("="*80)
        print(f"Converted model saved to: {output_path}")
        print(f"   Input shape: {tf_model.input_shape}")
        print(f"   Output shape: {tf_model.output_shape}")
        print()
        print("Next steps:")
        print("1. Update backend/app/core/config.py to use this file:")
        print(f"   MS_MODEL_PATH_H5 = MODEL_DIR / \"ms_model_tf215.h5\"")
        print("2. Or rename the file to match your current config")
        print()
        return True
        
    except ImportError:
        print("[WARNING] Standalone Keras 3 not available")
        print("Trying alternative approach...")
        print()
    except Exception as e:
        print(f"[ERROR] Keras 3 conversion failed: {e}")
        import traceback
        print(traceback.format_exc())
        print()
    
    # Strategy 2: Try using the MS service's conversion method
    try:
        print("Attempting conversion using MS service...")
        from app.services.multiple_sclerosis_service import MultipleSclerosisDetectionService
        from app.core.config import MS_MODEL_PATH
        
        # Temporarily set the path
        import app.core.config as config_module
        original_path = config_module.MS_MODEL_PATH
        config_module.MS_MODEL_PATH = input_path
        
        ms_service = MultipleSclerosisDetectionService()
        
        # Try Strategy 1 (Keras 3 conversion)
        if input_path.suffix == '.keras':
            converted_model = ms_service._try_keras3_conversion()
            if converted_model is not None:
                # The conversion saves to ms_model.h5, let's rename it
                converted_path = MODEL_DIR / "ms_model.h5"
                if converted_path.exists():
                    import shutil
                    shutil.move(str(converted_path), str(output_path))
                    print()
                    print("="*80)
                    print("[OK] CONVERSION SUCCESSFUL!")
                    print("="*80)
                    print(f"Converted model saved to: {output_path}")
                    print()
                    config_module.MS_MODEL_PATH = original_path
                    return True
        
        config_module.MS_MODEL_PATH = original_path
        
    except Exception as e:
        print(f"[ERROR] MS service conversion failed: {e}")
        import traceback
        print(traceback.format_exc())
        print()
    
    # Strategy 3: Manual fix using h5py (complex, but might work)
    print("[WARNING] Automatic conversion methods failed.")
    print()
    print("RECOMMENDATION:")
    print("1. Install standalone Keras 3: pip install keras")
    print("2. Run this script again")
    print("OR")
    print("3. Re-train the model with TensorFlow 2.15.0 and save as .h5")
    print()
    return False

if __name__ == "__main__":
    success = convert_ms_model()
    sys.exit(0 if success else 1)

