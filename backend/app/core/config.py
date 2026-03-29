"""
Configuration settings for BrainGuard AI Backend
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
MODEL_DIR = BASE_DIR / "models"
UPLOAD_DIR = BASE_DIR / "uploads"
LOG_DIR = BASE_DIR / "logs"

# Model settings
TUMOR_MODEL_PATH = MODEL_DIR / "unet_model.h5"
ALZHEIMER_MODEL_PATH = MODEL_DIR / "best_swin_alzheimer.pt"
# Prefer .h5 format if available (converted from .keras), otherwise use .keras
MS_MODEL_PATH_H5 = MODEL_DIR / "ms_model_tf.h5"
MS_MODEL_PATH_H5_TF215 = MODEL_DIR / "ms_model_tf215.h5"  # TensorFlow 2.15.0 converted model
MS_MODEL_PATH_H5_ALT = MODEL_DIR / "final_ms_resnet50_finetuned.h5"  # Alternative .h5 filename
MS_MODEL_PATH_KERAS = MODEL_DIR / "final_ms_resnet50_finetuned.keras"
# Check in order: ms_model_tf215.h5 (TF 2.15 compatible), ms_model_tf.h5, final_ms_resnet50_finetuned.h5, then .keras
MS_MODEL_PATH = (MS_MODEL_PATH_H5_TF215 if MS_MODEL_PATH_H5_TF215.exists() else 
                 (MS_MODEL_PATH_H5 if MS_MODEL_PATH_H5.exists() else 
                  (MS_MODEL_PATH_H5_ALT if MS_MODEL_PATH_H5_ALT.exists() else MS_MODEL_PATH_KERAS)))
MODEL_DEVICE = "cpu"  # Use "gpu" if you have CUDA

# API settings
API_HOST = "0.0.0.0"
API_PORT = 8000
API_TITLE = "BrainGuard AI Backend"
API_DESCRIPTION = "AI-powered brain tumor detection using U-Net model"
API_VERSION = "1.0.0"

# CORS settings
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

# File upload settings
ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/jpg", 
    "image/png",
    "image/dicom",
    "image/nifti"
]

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Model prediction settings
DETECTION_THRESHOLD = 0.3  # Lower threshold for tumor detection
CONFIDENCE_THRESHOLD = 0.1  # Lower minimum confidence for detection
MIN_TUMOR_SIZE_PERCENT = 0.01  # Lower minimum tumor size (0.01% of image)

# Logging settings
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Email settings
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev")

# Create directories if they don't exist
for directory in [MODEL_DIR, UPLOAD_DIR, LOG_DIR]:
    directory.mkdir(exist_ok=True)

