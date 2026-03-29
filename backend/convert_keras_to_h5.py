"""
Script to convert a Keras 3 .keras model to .h5 format for TensorFlow 2.x compatibility.

Usage:
    python convert_keras_to_h5.py

This script will:
1. Load the .keras model using Keras 3
2. Save it as .h5 using tf.keras (TensorFlow 2.x format)
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    # Try to load with Keras 3 first
    import keras
    print(f"Keras version: {keras.__version__}")
    
    # Load the .keras model
    keras_model_path = "models/ms_model_tf.keras"
    if not os.path.exists(keras_model_path):
        print(f"Error: {keras_model_path} not found!")
        sys.exit(1)
    
    print(f"Loading model from {keras_model_path}...")
    model = keras.models.load_model(keras_model_path)
    print(f"Model loaded successfully!")
    print(f"  Input shape: {model.input_shape}")
    print(f"  Output shape: {model.output_shape}")
    
    # Now save as .h5 using tf.keras
    import tensorflow as tf
    print(f"\nTensorFlow version: {tf.__version__}")
    
    h5_model_path = "models/ms_model.h5"
    print(f"\nSaving model as .h5 to {h5_model_path}...")
    
    # Use tf.keras to save as .h5
    tf.keras.models.save_model(
        model,
        h5_model_path,
        save_format='h5',
        overwrite=True
    )
    
    print(f"✅ Successfully converted to {h5_model_path}!")
    print(f"\nYou can now update config.py to use:")
    print(f'  MS_MODEL_PATH = MODEL_DIR / "ms_model.h5"')
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    print("\n⚠️  If this fails, you may need to:")
    print("1. Load the model in the original training environment (Keras 3)")
    print("2. Save it as .h5 using: model.save('ms_model.h5', save_format='h5')")
    sys.exit(1)




