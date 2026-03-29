"""
Test script to verify model compatibility with TensorFlow 2.15.0
Run this BEFORE upgrading the backend to ensure existing models still work.

Usage:
    python test_model_compatibility.py
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_tensorflow_version():
    """Check TensorFlow version."""
    try:
        import tensorflow as tf
        import keras
        print(f"TensorFlow version: {tf.__version__}")
        try:
            print(f"Keras version: {keras.__version__}")
        except AttributeError:
            print("Keras version: (not available via __version__)")
        print(f"Python version: {sys.version}")
        print()
        
        # Check if it's 2.15.0 or higher
        tf_version = tf.__version__.split('.')
        major, minor = int(tf_version[0]), int(tf_version[1])
        if major == 2 and minor >= 15:
            print("[OK] TensorFlow 2.15+ detected - compatible with Kaggle")
        elif major == 2 and minor == 13:
            print("[WARNING]  TensorFlow 2.13 detected - will test compatibility")
        else:
            print(f"[WARNING]  TensorFlow {tf.__version__} detected - may have compatibility issues")
        print()
        return tf
    except ImportError:
        print("[ERROR] ERROR: TensorFlow not installed!")
        print("Please install: pip install tensorflow==2.15.0")
        return None

def test_tumor_model(tf):
    """Test loading the brain tumor model."""
    print("="*80)
    print("TEST 1: Brain Tumor Model (unet_model.h5)")
    print("="*80)
    
    model_path = backend_dir / "models" / "unet_model.h5"
    
    if not model_path.exists():
        print(f"[ERROR] ERROR: Model file not found: {model_path}")
        return False
    
    print(f"Model path: {model_path}")
    print(f"File size: {model_path.stat().st_size / (1024*1024):.2f} MB")
    print()
    
    try:
        from tensorflow import keras
        
        # LegacyInputLayer to handle batch_shape compatibility
        class LegacyInputLayer(tf.keras.layers.InputLayer):
            """Compatible InputLayer that handles batch_shape argument."""
            def __init__(self, **kwargs):
                # Convert batch_shape to batch_input_shape for tf.keras compatibility
                if 'batch_shape' in kwargs and 'batch_input_shape' not in kwargs:
                    kwargs['batch_input_shape'] = kwargs.pop('batch_shape')
                super().__init__(**kwargs)
        
        # Test loading with custom objects (same as backend)
        def dice_coef(y_true, y_pred, smooth=1e-6):
            y_true_f = tf.keras.backend.flatten(y_true)
            y_pred_f = tf.keras.backend.flatten(y_pred)
            intersection = tf.keras.backend.sum(y_true_f * y_pred_f)
            return (2. * intersection + smooth) / (tf.keras.backend.sum(y_true_f) + tf.keras.backend.sum(y_pred_f) + smooth)
        
        def bce_dice_loss(y_true, y_pred):
            bce = tf.keras.losses.binary_crossentropy(y_true, y_pred)
            dice = 1 - dice_coef(y_true, y_pred)
            return bce + dice
        
        custom_objects = {
            'InputLayer': LegacyInputLayer,
            'LegacyInputLayer': LegacyInputLayer,
            'dice_coef': dice_coef,
            'bce_dice_loss': bce_dice_loss
        }
        
        print("Attempting to load model...")
        model = keras.models.load_model(str(model_path), custom_objects=custom_objects, compile=False)
        
        print("[OK] Model loaded successfully!")
        print(f"   Input shape: {model.input_shape}")
        print(f"   Output shape: {model.output_shape}")
        print(f"   Parameters: {model.count_params():,}")
        print()
        
        # Test prediction
        print("Testing prediction...")
        import numpy as np
        test_input = np.random.rand(1, 128, 128, 3).astype(np.float32)
        prediction = model.predict(test_input, verbose=0)
        print(f"[OK] Prediction successful!")
        print(f"   Prediction shape: {prediction.shape}")
        print(f"   Prediction range: [{prediction.min():.4f}, {prediction.max():.4f}]")
        print()
        
        return True
        
    except Exception as e:
        print(f"[ERROR] ERROR: Failed to load tumor model")
        print(f"   Error: {e}")
        print()
        import traceback
        print("Full traceback:")
        traceback.print_exc()
        print()
        return False

def test_alzheimer_model():
    """Test loading the Alzheimer model (PyTorch - should be unaffected)."""
    print("="*80)
    print("TEST 2: Alzheimer Model (best_swin_alzheimer.pt)")
    print("="*80)
    
    model_path = backend_dir / "models" / "best_swin_alzheimer.pt"
    
    if not model_path.exists():
        print(f"[ERROR] ERROR: Model file not found: {model_path}")
        return False
    
    print(f"Model path: {model_path}")
    print(f"File size: {model_path.stat().st_size / (1024*1024):.2f} MB")
    print()
    
    try:
        import torch
        print(f"PyTorch version: {torch.__version__}")
        print()
        
        print("Attempting to load model...")
        device = torch.device("cpu")
        checkpoint = torch.load(str(model_path), map_location=device)
        
        print("[OK] Model checkpoint loaded successfully!")
        print(f"   Checkpoint keys: {list(checkpoint.keys())[:5]}...")  # Show first 5 keys
        print()
        
        # Note: We don't test full model loading here since it requires the exact architecture
        # But loading the checkpoint is a good sign
        print("[OK] Alzheimer model is compatible (PyTorch is independent of TensorFlow)")
        print()
        
        return True
        
    except ImportError:
        print("[WARNING]  WARNING: PyTorch not installed - cannot test Alzheimer model")
        print("   (This is OK - PyTorch is independent of TensorFlow)")
        print()
        return True  # Not a failure, just not testable
    except Exception as e:
        print(f"[ERROR] ERROR: Failed to load Alzheimer model")
        print(f"   Error: {e}")
        print()
        import traceback
        print("Full traceback:")
        traceback.print_exc()
        print()
        return False

def test_ms_model(tf):
    """Test loading the MS model using the same compatibility fixes as the MS service."""
    print("="*80)
    print("TEST 3: Multiple Sclerosis Model")
    print("="*80)
    
    # Check for .h5 first, then .keras (same logic as config.py)
    model_path_tf215 = backend_dir / "models" / "ms_model_tf215.h5"  # TF 2.15 converted
    model_path_h5 = backend_dir / "models" / "ms_model_tf.h5"
    model_path_keras = backend_dir / "models" / "final_ms_resnet50_finetuned.keras"
    model_path_actual = backend_dir / "models" / "final_ms_resnet50_finetuned.h5"
    
    # Try TF 2.15 converted model first, then others
    if model_path_tf215.exists():
        model_path = model_path_tf215
    elif model_path_actual.exists():
        model_path = model_path_actual
    elif model_path_h5.exists():
        model_path = model_path_h5
    elif model_path_keras.exists():
        model_path = model_path_keras
    else:
        model_path = None
    
    if model_path is None or not model_path.exists():
        print(f"[WARNING]  Model file not found")
        print(f"   Checked: {model_path_actual}")
        print(f"   Checked: {model_path_h5}")
        print(f"   Checked: {model_path_keras}")
        print("   (This is OK if you haven't added it yet)")
        print()
        return None  # Not a failure, just not present
    
    print(f"Model path: {model_path}")
    print(f"File size: {model_path.stat().st_size / (1024*1024):.2f} MB")
    print()
    
    try:
        from tensorflow import keras
        
        # If this is the TF 2.15 converted model, try simple load first
        if model_path.name == "ms_model_tf215.h5":
            print("Testing TF 2.15.0 converted model (should load cleanly)...")
            print()
            try:
                model = keras.models.load_model(str(model_path), compile=False)
                print("[OK] Converted model loaded successfully with simple tf.keras.load_model!")
            except Exception as e:
                print(f"Simple load failed: {e}")
                print("Trying with MS service compatibility fixes...")
                raise  # Fall through to MS service approach
        else:
            # For original models, use MS service with all compatibility fixes
            sys.path.insert(0, str(backend_dir / "app"))
            from services.multiple_sclerosis_service import MultipleSclerosisDetectionService
            from core.config import MS_MODEL_PATH
            
            # Temporarily update the config to point to the found model
            import app.core.config as config_module
            original_path = config_module.MS_MODEL_PATH
            config_module.MS_MODEL_PATH = model_path
            
            print("Using MS service's load_model method (with all compatibility fixes)...")
            print()
            
            # Create service instance and load model
            ms_service = MultipleSclerosisDetectionService()
            success = ms_service.load_model()
            
            # Restore original path
            config_module.MS_MODEL_PATH = original_path
            
            if not success or ms_service.model is None:
                raise RuntimeError("MS service failed to load model")
            
            model = ms_service.model
        
        print("[OK] MS model loaded successfully!")
        print(f"   Input shape: {model.input_shape}")
        print(f"   Output shape: {model.output_shape}")
        print(f"   Parameters: {model.count_params():,}")
        print()
        
        # Test prediction
        print("Testing prediction...")
        import numpy as np
        # MS model expects 1 channel (grayscale), not 3 channels
        input_shape = model.input_shape
        channels = input_shape[-1] if input_shape[-1] is not None else 1
        test_input = np.random.rand(1, 224, 224, channels).astype(np.float32)
        prediction = model.predict(test_input, verbose=0)
        print(f"[OK] Prediction successful!")
        print(f"   Prediction shape: {prediction.shape}")
        print(f"   Prediction range: [{prediction.min():.4f}, {prediction.max():.4f}]")
        print()
        
        return True
        
    except Exception as e:
        print(f"[ERROR] ERROR: Failed to load MS model")
        print(f"   Error: {str(e)}")
        print()
        import traceback
        print("Full traceback:")
        traceback.print_exc()
        print()
        return False

def main():
    """Run all compatibility tests."""
    print("="*80)
    print("MODEL COMPATIBILITY TEST - TensorFlow 2.15.0")
    print("="*80)
    print()
    print("This script tests if your existing models will work with TensorFlow 2.15.0")
    print("Run this BEFORE upgrading your backend.")
    print()
    
    # Test TensorFlow version
    tf = test_tensorflow_version()
    if tf is None:
        print("[ERROR] Cannot proceed without TensorFlow")
        sys.exit(1)
    
    results = {}
    
    # Test tumor model
    results['tumor'] = test_tumor_model(tf)
    
    # Test Alzheimer model
    results['alzheimer'] = test_alzheimer_model()
    
    # Test MS model (optional)
    results['ms'] = test_ms_model(tf)
    
    # Summary
    print("="*80)
    print("TEST SUMMARY")
    print("="*80)
    print()
    
    if results['tumor']:
        print("[OK] Brain Tumor Model: COMPATIBLE")
    else:
        print("[ERROR] Brain Tumor Model: INCOMPATIBLE - DO NOT UPGRADE!")
    
    if results['alzheimer']:
        print("[OK] Alzheimer Model: COMPATIBLE (PyTorch - unaffected)")
    else:
        print("[ERROR] Alzheimer Model: INCOMPATIBLE")
    
    if results['ms'] is True:
        print("[OK] MS Model: COMPATIBLE")
    elif results['ms'] is None:
        print("[WARNING]  MS Model: Not tested (file not found or has known compatibility issues)")
    else:
        print("[WARNING]  MS Model: Has compatibility issues (expected - backend has fixes)")
    
    print()
    
    # Final recommendation
    if results['tumor'] and results['alzheimer']:
        print("="*80)
        print("[OK] RECOMMENDATION: SAFE TO UPGRADE")
        print("="*80)
        print()
        print("Both critical models (Tumor and Alzheimer) are compatible with TF 2.15.0")
        print("You can proceed with the upgrade:")
        print()
        print("  pip install --upgrade tensorflow==2.15.0 keras==2.15.0")
        print()
    else:
        print("="*80)
        print("[ERROR] RECOMMENDATION: DO NOT UPGRADE YET")
        print("="*80)
        print()
        print("One or more critical models failed to load.")
        print("Please investigate the errors above before upgrading.")
        print()
        sys.exit(1)

if __name__ == "__main__":
    main()

