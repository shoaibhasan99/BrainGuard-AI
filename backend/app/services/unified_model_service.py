"""
Unified Model Service for BrainGuard
Handles both brain tumor detection and Alzheimer's detection
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

from app.services.model_service import BrainTumorModelService
from app.services.alzheimer_service import AlzheimerDetectionService
from app.services.multiple_sclerosis_service import MultipleSclerosisDetectionService

logger = logging.getLogger(__name__)

class UnifiedModelService:
    """Unified service for all brain analysis models"""
    
    def __init__(self):
        self.tumor_service = BrainTumorModelService()
        self.alzheimer_service = AlzheimerDetectionService()
        self.ms_service = MultipleSclerosisDetectionService()
        self.tumor_loaded = False
        self.alzheimer_loaded = False
        self.ms_loaded = False
        
    def load_all_models(self) -> Dict[str, bool]:
        """Load all available models"""
        results = {}
        
        # Load tumor detection model
        try:
            self.tumor_loaded = self.tumor_service.load_model()
            results['tumor_model'] = self.tumor_loaded
            logger.info(f"Tumor model loading: {'Success' if self.tumor_loaded else 'Failed'}")
        except Exception as e:
            logger.error(f"Failed to load tumor model: {e}")
            results['tumor_model'] = False
            
        # Load Alzheimer detection model
        try:
            self.alzheimer_loaded = self.alzheimer_service.load_model()
            results['alzheimer_model'] = self.alzheimer_loaded
            logger.info(f"Alzheimer model loading: {'Success' if self.alzheimer_loaded else 'Failed'}")
        except Exception as e:
            logger.error(f"Failed to load Alzheimer model: {e}")
            results['alzheimer_model'] = False
        
        # Load Multiple Sclerosis detection model
        try:
            self.ms_loaded = self.ms_service.load_model()
            results['ms_model'] = self.ms_loaded
            logger.info(f"MS model loading: {'Success' if self.ms_loaded else 'Failed'}")
        except Exception as e:
            logger.error(f"Failed to load MS model: {e}")
            results['ms_model'] = False
            
        return results
    
    def analyze_tumor(self, image_content: bytes) -> Dict[str, Any]:
        """Analyze image for brain tumor detection"""
        if not self.tumor_loaded:
            raise RuntimeError("Tumor detection model not loaded")
        
        # Preprocess image
        image_array = self.tumor_service.preprocess_image(image_content)
        
        # Analyze image
        result = self.tumor_service.analyze_image(image_array)
        
        # Add analysis type
        result['analysis_type'] = 'tumor_detection'
        
        return result
    
    def analyze_alzheimer(self, image_content: bytes) -> Dict[str, Any]:
        """Analyze image for Alzheimer's detection"""
        if not self.alzheimer_loaded:
            raise RuntimeError("Alzheimer detection model not loaded")
        
        # Preprocess image
        image_tensor = self.alzheimer_service.preprocess_image(image_content)
        
        # Analyze image
        result = self.alzheimer_service.analyze_image(image_tensor)
        
        # Add analysis type
        result['analysis_type'] = 'alzheimer_detection'
        
        return result
    
    def analyze_both(self, image_content: bytes) -> Dict[str, Any]:
        """Analyze image for both tumor and Alzheimer detection"""
        results = {
            'analysis_type': 'comprehensive_analysis',
            'timestamp': datetime.now().isoformat(),
            'tumor_analysis': None,
            'alzheimer_analysis': None,
            'ms_analysis': None,
            'summary': {}
        }
        
        # Analyze for tumors
        if self.tumor_loaded:
            try:
                tumor_result = self.analyze_tumor(image_content)
                results['tumor_analysis'] = tumor_result
            except Exception as e:
                logger.error(f"Tumor analysis failed: {e}")
                results['tumor_analysis'] = {'error': str(e)}
        else:
            results['tumor_analysis'] = {'error': 'Tumor model not loaded'}
        
        # Analyze for Alzheimer's
        if self.alzheimer_loaded:
            try:
                alzheimer_result = self.analyze_alzheimer(image_content)
                results['alzheimer_analysis'] = alzheimer_result
            except Exception as e:
                logger.error(f"Alzheimer analysis failed: {e}")
                results['alzheimer_analysis'] = {'error': str(e)}
        else:
            results['alzheimer_analysis'] = {'error': 'Alzheimer model not loaded'}
        
        # Analyze for Multiple Sclerosis
        if self.ms_loaded:
            try:
                ms_result = self.analyze_ms(image_content)
                results['ms_analysis'] = ms_result
            except Exception as e:
                logger.error(f"MS analysis failed: {e}")
                results['ms_analysis'] = {'error': str(e)}
        else:
            results['ms_analysis'] = {'error': 'MS model not loaded'}
        
        # Create summary
        summary = {
            'models_loaded': {
                'tumor': self.tumor_loaded,
                'alzheimer': self.alzheimer_loaded,
                'ms': self.ms_loaded
            },
            'detections': {
                'tumor_detected': False,
                'alzheimer_detected': False,
                'ms_detected': False
            },
            'recommendations': []
        }
        
        # Check tumor detection
        if results['tumor_analysis'] and 'detected' in results['tumor_analysis']:
            summary['detections']['tumor_detected'] = results['tumor_analysis']['detected']
            if results['tumor_analysis']['detected']:
                summary['recommendations'].append("Immediate consultation with a neurologist recommended for tumor evaluation")
        
        # Check Alzheimer detection
        if results['alzheimer_analysis'] and 'detected' in results['alzheimer_analysis']:
            summary['detections']['alzheimer_detected'] = results['alzheimer_analysis']['detected']
            if results['alzheimer_analysis']['detected']:
                summary['recommendations'].append("Consultation with a geriatrician or neurologist recommended for cognitive assessment")

        # Check MS detection
        if results['ms_analysis'] and 'detected' in results['ms_analysis']:
            summary['detections']['ms_detected'] = results['ms_analysis']['detected']
            if results['ms_analysis']['detected']:
                summary['recommendations'].append("Consult a neurologist experienced in MS management for treatment planning")
        
        # Add general recommendations
        if not summary['detections']['tumor_detected'] and not summary['detections']['alzheimer_detected']:
            summary['recommendations'].append("Continue regular health checkups as recommended")
        
        results['summary'] = summary
        
        return results
    
    def get_model_status(self) -> Dict[str, Any]:
        """Get status of all models"""
        return {
            'tumor_model': {
                'loaded': self.tumor_loaded,
                'type': 'U-Net',
                'purpose': 'Brain tumor detection and segmentation'
            },
            'alzheimer_model': {
                'loaded': self.alzheimer_loaded,
                'type': 'Swin Transformer',
                'purpose': 'Alzheimer\'s disease detection'
            },
            'ms_model': {
                'loaded': self.ms_loaded,
                'type': 'ResNet50',
                'purpose': 'Multiple Sclerosis lesion detection'
            },
            'timestamp': datetime.now().isoformat()
        }
    
    def cleanup(self):
        """Cleanup all model resources"""
        if self.tumor_service:
            self.tumor_service.cleanup()
        if self.alzheimer_service:
            self.alzheimer_service.cleanup()
        if self.ms_service:
            self.ms_service.cleanup()
        
        self.tumor_loaded = False
        self.alzheimer_loaded = False
        self.ms_loaded = False
        logger.info("All models cleanup completed")

    def analyze_ms(self, image_content: bytes) -> Dict[str, Any]:
        """Analyze image for Multiple Sclerosis detection."""
        if not self.ms_loaded:
            raise RuntimeError("MS detection model not loaded")

        image_tensor = self.ms_service.preprocess_image(image_content)
        result = self.ms_service.analyze_image(image_tensor)
        result['analysis_type'] = 'ms_detection'
        return result

# Global unified model service instance
unified_model_service = UnifiedModelService()
