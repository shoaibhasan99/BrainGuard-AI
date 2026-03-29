"""
Alzheimer Detection Service using Swin Transformer
Handles model loading, preprocessing, and prediction for Alzheimer's disease detection
"""

import logging
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

# Try to import PyTorch, but handle gracefully if not available
try:
    import torch
    import torch.nn as nn
    from torchvision import transforms
    import timm
    PYTORCH_AVAILABLE = True
except ImportError as e:
    logging.warning(f"PyTorch not available: {e}")
    PYTORCH_AVAILABLE = False
    torch = None
    nn = None
    transforms = None
    timm = None

from app.core.config import ALZHEIMER_MODEL_PATH, MODEL_DEVICE
from app.utils.image_decoding import decode_image_bytes

logger = logging.getLogger(__name__)

class SwinTransformerAlzheimer(nn.Module):
    """Swin Transformer model for Alzheimer's detection"""
    
    def __init__(self, num_classes=2, pretrained=True):
        if not PYTORCH_AVAILABLE:
            raise ImportError("PyTorch is required for SwinTransformerAlzheimer")
        
        super(SwinTransformerAlzheimer, self).__init__()
        
        # Load pretrained Swin Transformer
        self.backbone = timm.create_model('swin_tiny_patch4_window7_224', 
                                        pretrained=pretrained, 
                                        num_classes=0)  # Remove classifier
        
        # Get feature dimension
        feature_dim = self.backbone.num_features
        
        # Custom classifier for Alzheimer's detection - match the saved model architecture
        self.classifier = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(feature_dim, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, num_classes)
        )
        
        # Alternative: Simple classifier to match saved model exactly
        # The saved model has a simple head.fc layer going from 768 to 4
        self.head = nn.Linear(feature_dim, num_classes)
        
    def forward(self, x):
        features = self.backbone(x)
        output = self.head(features)  # Use simple head to match saved model
        return output

class AlzheimerDetectionService:
    """Service for Alzheimer's detection using Swin Transformer model"""
    
    def __init__(self):
        self.model: Optional[SwinTransformerAlzheimer] = None
        self.model_loaded = False
        self.device = torch.device(MODEL_DEVICE if torch.cuda.is_available() and MODEL_DEVICE == "gpu" else "cpu") if PYTORCH_AVAILABLE else None
        self.transform = None
        
    def load_model(self) -> bool:
        """Load the Swin Transformer Alzheimer detection model"""
        try:
            if not PYTORCH_AVAILABLE:
                logger.error("PyTorch is not available. Cannot load Alzheimer model.")
                return False
                
            if not ALZHEIMER_MODEL_PATH.exists():
                logger.error(f"Alzheimer model file not found: {ALZHEIMER_MODEL_PATH}")
                return False
                
            logger.info(f"Loading Alzheimer model from {ALZHEIMER_MODEL_PATH}")
            logger.info(f"Using device: {self.device}")
            
            # Create model architecture - use 4 classes to match the saved model
            self.model = SwinTransformerAlzheimer(num_classes=4, pretrained=False)
            
            # Load model weights
            checkpoint = torch.load(ALZHEIMER_MODEL_PATH, map_location=self.device)
            
            # Handle different checkpoint formats and key mismatches
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
            elif 'state_dict' in checkpoint:
                state_dict = checkpoint['state_dict']
            else:
                state_dict = checkpoint
            
            # Fix key mismatches - remove 'backbone.' prefix from our model keys
            # The saved model doesn't have 'backbone.' prefix
            model_state_dict = self.model.state_dict()
            fixed_state_dict = {}
            
            for key, value in state_dict.items():
                # If the key doesn't have 'backbone.' prefix, add it to match our model
                if not key.startswith('backbone.'):
                    # Try to map the key to our model structure
                    if key.startswith('patch_embed'):
                        fixed_key = f'backbone.{key}'
                    elif key.startswith('layers'):
                        fixed_key = f'backbone.{key}'
                    elif key.startswith('norm'):
                        fixed_key = f'backbone.{key}'
                    elif key.startswith('head'):
                        # The saved model has 'head.fc' but our model has 'head'
                        if key == 'head.fc.weight':
                            fixed_key = 'head.weight'
                        elif key == 'head.fc.bias':
                            fixed_key = 'head.bias'
                        else:
                            fixed_key = f'backbone.{key}'
                    else:
                        fixed_key = f'backbone.{key}'
                else:
                    fixed_key = key
                
                # Only include keys that exist in our model
                if fixed_key in model_state_dict:
                    fixed_state_dict[fixed_key] = value
                else:
                    logger.warning(f"Skipping key {key} -> {fixed_key} (not found in model)")
            
            # Load the fixed state dict
            self.model.load_state_dict(fixed_state_dict, strict=False)
            
            # Move model to device
            self.model.to(self.device)
            self.model.eval()
            
            # Define image preprocessing transforms
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                                   std=[0.229, 0.224, 0.225])
            ])
            
            self.model_loaded = True
            logger.info("Alzheimer model loaded successfully!")
            
            # Log model info
            total_params = sum(p.numel() for p in self.model.parameters())
            trainable_params = sum(p.numel() for p in self.model.parameters() if p.requires_grad)
            logger.info(f"   Total parameters: {total_params:,}")
            logger.info(f"   Trainable parameters: {trainable_params:,}")
            
            return True
                
        except Exception as e:
            logger.error(f"Error loading Alzheimer model: {e}")
            return False
    
    def preprocess_image(self, image_content: bytes):
        """Preprocess image for Alzheimer detection model"""
        if not PYTORCH_AVAILABLE:
            raise ImportError("PyTorch is required for image preprocessing")
        
        try:
            # Decode bytes and convert BGR to RGB for PIL
            image_bgr = decode_image_bytes(image_content, mode="color")
            if image_bgr is None:
                raise ValueError("Could not decode image")

            image_rgb = image_bgr[:, :, ::-1]
            
            # Convert to PIL Image
            pil_image = Image.fromarray(image_rgb)
            
            # Apply transforms
            if self.transform is None:
                raise RuntimeError("Model transforms not initialized")
            
            # Apply preprocessing transforms
            tensor_image = self.transform(pil_image)
            
            # Add batch dimension
            tensor_image = tensor_image.unsqueeze(0)
            
            # Move to device
            tensor_image = tensor_image.to(self.device)
            
            logger.info(f"Image preprocessed successfully - Shape: {tensor_image.shape}")
            
            return tensor_image
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {e}")
            raise ValueError(f"Image preprocessing failed: {e}")
    
    def analyze_image(self, image_tensor):
        """Analyze image for Alzheimer's detection"""
        if not PYTORCH_AVAILABLE:
            raise ImportError("PyTorch is required for image analysis")
        
        if not self.model_loaded:
            raise RuntimeError("Alzheimer model not loaded")
        
        try:
            with torch.no_grad():
                # Get model prediction
                outputs = self.model(image_tensor)
                
                # Apply softmax to get probabilities
                probabilities = torch.softmax(outputs, dim=1)
                
                # Get predicted class and confidence
                confidence, predicted_class = torch.max(probabilities, 1)
                
                # Convert to numpy
                confidence_score = confidence.cpu().numpy()[0]
                predicted_class_idx = predicted_class.cpu().numpy()[0]
                
                # Class labels for 4-class Alzheimer detection (standard medical terminology)
                class_labels = ['CN', 'EMCI', 'MCI', 'AD']  # Cognitive Normal, Early MCI, Mild Cognitive Impairment, Alzheimer's Disease
                predicted_label = class_labels[predicted_class_idx]
                
                # Calculate additional metrics for 4 classes
                cn_probability = probabilities[0][0].cpu().numpy()    # Probability of CN (class 0)
                emci_probability = probabilities[0][1].cpu().numpy()   # Probability of EMCI (class 1)
                mci_probability = probabilities[0][2].cpu().numpy()   # Probability of MCI (class 2)
                ad_probability = probabilities[0][3].cpu().numpy()    # Probability of AD (class 3)
                
                # Medically consistent detection logic
                # Only detect clinically significant impairment (MCI and AD)
                # CN and EMCI are considered "Not Detected" (normal or early changes)
                
                # Class-specific confidence thresholds
                class_thresholds = {
                    0: 0.4,  # CN - moderate threshold
                    1: 0.4,  # EMCI - moderate threshold (early changes, not clinically significant)
                    2: 0.5,  # MCI - moderate threshold (clinically significant)
                    3: 0.6   # AD - higher threshold (severe impairment)
                }
                
                # Get the threshold for the predicted class
                class_threshold = class_thresholds.get(predicted_class_idx, 0.5)
                
                # Calculate probability gap to ensure clear classification
                max_prob = max(cn_probability, emci_probability, mci_probability, ad_probability)
                second_max_prob = sorted([cn_probability, emci_probability, mci_probability, ad_probability])[-2]
                probability_gap = max_prob - second_max_prob
                
                # Re-enabled with conservative settings to prevent false positives
                # Only detect when we have high confidence in clinically significant impairment
                
                # Detection logic: Only detect MCI and AD with high confidence
                alzheimer_detected = (
                    predicted_class_idx in [2, 3] and  # Only MCI (2) and AD (3) are "detected"
                    confidence_score > 0.7 and  # High confidence (>70%)
                    probability_gap > 0.15  # Clear winner (15% gap)
                )
                
                logger.info(f"Alzheimer analysis - Detected: {alzheimer_detected}, "
                           f"Class: {predicted_label}, Confidence: {confidence_score:.3f}, "
                           f"Gap: {probability_gap:.3f}")
                
                # Create visualization
                original_image = self._create_visualization(image_tensor)
                
                logger.info(f"Alzheimer analysis - Detected: {alzheimer_detected}, "
                           f"Class: {predicted_label}, Confidence: {confidence_score:.3f}, "
                           f"Threshold: {class_threshold:.3f}, Gap: {probability_gap:.3f}, "
                           f"CN Prob: {cn_probability:.3f}")
                
                return {
                    "detected": bool(alzheimer_detected),
                    "predicted_class": predicted_label,
                    "confidence": float(confidence_score),
                    "cn_probability": float(cn_probability),
                    "emci_probability": float(emci_probability),
                    "mci_probability": float(mci_probability),
                    "ad_probability": float(ad_probability),
                    "class_index": int(predicted_class_idx),
                    "raw_probabilities": {
                        "CN": float(cn_probability),
                        "EMCI": float(emci_probability),
                        "MCI": float(mci_probability),
                        "AD": float(ad_probability)
                    },
                    "analysis_timestamp": datetime.now().isoformat(),
                    "model_info": {
                        "model_type": "Swin Transformer",
                        "input_size": "224x224",
                        "device": str(self.device),
                        "num_classes": 4
                    }
                }
                
        except Exception as e:
            logger.error(f"Error analyzing image for Alzheimer's: {e}")
            raise RuntimeError(f"Alzheimer analysis failed: {e}")
    
    def _create_visualization(self, image_tensor):
        """Create visualization of the input image"""
        if not PYTORCH_AVAILABLE:
            return ""
        
        try:
            # Convert tensor back to PIL Image for visualization
            # Denormalize the image
            mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
            std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
            
            image_denorm = image_tensor * std + mean
            image_denorm = torch.clamp(image_denorm, 0, 1)
            
            # Convert to numpy and PIL
            image_np = image_denorm.squeeze(0).cpu().numpy().transpose(1, 2, 0)
            image_np = (image_np * 255).astype(np.uint8)
            
            pil_image = Image.fromarray(image_np)
            
            # Convert to base64
            import base64
            import io
            
            buffer = io.BytesIO()
            pil_image.save(buffer, format='PNG')
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return image_base64
            
        except Exception as e:
            logger.error(f"Error creating visualization: {e}")
            return ""
    
    def cleanup(self):
        """Cleanup model resources"""
        if self.model and PYTORCH_AVAILABLE:
            del self.model
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            self.model = None
            self.model_loaded = False
            logger.info("Alzheimer model cleanup completed")

# Global Alzheimer detection service instance
alzheimer_service = AlzheimerDetectionService()
