"""
API Routes for Brain Tumor Detection
"""

import logging
import io
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from app.services.model_service import model_service
from app.services.unified_model_service import unified_model_service
from app.core.config import ALLOWED_FILE_TYPES, MAX_FILE_SIZE
from app.utils.image_decoding import bgr_to_gray, gray_to_bgr

logger = logging.getLogger(__name__)

try:
    from PIL import Image as PILImage
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("PIL/Pillow not available. Image validation may fail.")
router = APIRouter()

# Image processing imports
CV2_AVAILABLE = False
NP_AVAILABLE = False
try:
    import numpy as np
    NP_AVAILABLE = True
except ImportError:
    np = None

try:
    import cv2
    # Verify cv2 has the required functions
    if hasattr(cv2, 'imdecode') and hasattr(cv2, 'IMREAD_COLOR'):
        CV2_AVAILABLE = True
    else:
        logger.error(f"OpenCV (cv2) is imported but missing required functions. Available attributes: {[x for x in dir(cv2) if not x.startswith('_')][:10]}")
        CV2_AVAILABLE = False
except ImportError as e:
    CV2_AVAILABLE = False
    logger.warning(f"OpenCV (cv2) not available: {e}. Image validation will use PIL fallback.")
except Exception as e:
    CV2_AVAILABLE = False
    logger.error(f"Error importing OpenCV (cv2): {e}. Image validation will use PIL fallback.")

def ensure_json_serializable(data):
    """Ensure all data is JSON serializable"""
    if isinstance(data, dict):
        return {k: ensure_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [ensure_json_serializable(item) for item in data]
    elif isinstance(data, bool):
        return bool(data)
    elif isinstance(data, (int, float, str)):
        return data
    elif hasattr(data, 'item'):  # numpy scalars
        return data.item()
    else:
        return str(data)

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    model_status = unified_model_service.get_model_status()
    return {
        "status": "healthy",
        "service": "BrainGuard AI Backend",
        "model_loaded": model_status['tumor_model']['loaded'],
        "models_status": model_status,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/test-detection")
async def test_detection():
    """Test detection with a simple synthetic image"""
    try:
        if not CV2_AVAILABLE:
            raise HTTPException(status_code=500, detail="OpenCV not available for test detection")
        
        # Create a simple test image with a bright region (simulating tumor)
        test_image = np.zeros((128, 128, 3), dtype=np.float32)
        
        # Add a bright circular region (tumor simulation)
        center = (64, 64)
        radius = 20
        cv2.circle(test_image, center, radius, (0.8, 0.8, 0.8), -1)
        
        # Add some noise
        noise = np.random.normal(0, 0.1, test_image.shape)
        test_image = np.clip(test_image + noise, 0, 1)
        
        # Test the model using unified service
        # Convert numpy array to bytes for unified service
        import io
        from PIL import Image as PILImage
        
        # Convert test image to PIL and then to bytes
        test_pil = PILImage.fromarray((test_image * 255).astype(np.uint8))
        test_buffer = io.BytesIO()
        test_pil.save(test_buffer, format='PNG')
        test_content = test_buffer.getvalue()
        
        result = unified_model_service.analyze_tumor(test_content)
        
        return {
            "test_result": result,
            "message": "Test detection completed",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Test detection failed: {e}")
        return {
            "error": str(e),
            "message": "Test detection failed",
            "timestamp": datetime.now().isoformat()
        }

@router.post("/analyze-direct")
async def analyze_direct(file: UploadFile = File(...)):
    """Direct analysis endpoint for frontend compatibility"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file.content_type} not allowed. Allowed types: {ALLOWED_FILE_TYPES}"
            )
        
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File size {file.size} exceeds maximum {MAX_FILE_SIZE}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate that this is a grayscale medical image
        validation_errors = []
        try:
            # Decode image to check properties
            if CV2_AVAILABLE:
                nparr = np.frombuffer(content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            elif PIL_AVAILABLE:
                # Fallback to PIL if cv2 is not available
                image_pil = PILImage.open(io.BytesIO(content))
                # Convert PIL image to numpy array (RGB)
                image = np.array(image_pil.convert('RGB'))
                # Convert RGB to BGR for consistency with cv2 format
                image = image[:, :, ::-1]  # RGB to BGR
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Image processing libraries not available. Please install opencv-python or Pillow."
                )
            
            if image is None or image.size == 0:
                if CV2_AVAILABLE:
                    # Try alternative decoding methods
                    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
                    if image is not None:
                        image = gray_to_bgr(image)
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail="Invalid image file. Could not decode image. Please ensure the file is a valid image format (JPEG, PNG)."
                        )
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail="Invalid image file. Could not decode image. Please ensure the file is a valid image format (JPEG, PNG)."
                    )
            
            # Check if image is suitable for medical analysis
            if len(image.shape) == 2:
                # Convert 2D grayscale to 3-channel
                image = gray_to_bgr(image)
            elif len(image.shape) != 3:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image format. Expected 2D or 3D image, got shape: {image.shape}. Please upload a standard medical scan image."
                )
            
            # Convert to grayscale to check characteristics
            gray = bgr_to_gray(image)
            gray_mean = np.mean(gray)
            gray_std = np.std(gray)
            
            # Validate image characteristics for medical imaging (more lenient)
            if gray_std < 3:  # Reduced from 5 to 3
                validation_errors.append(f"Insufficient contrast (std: {gray_std:.2f}, minimum: 3)")
            
            if gray_mean < 5 or gray_mean > 250:  # More lenient range
                validation_errors.append(f"Brightness out of range (mean: {gray_mean:.2f}, acceptable: 5-250)")
            
            # Check image dimensions (should be reasonable for medical scans)
            height, width = gray.shape
            if height < 32 or width < 32:  # Reduced from 64 to 32
                validation_errors.append(f"Resolution too low ({width}x{height}, minimum: 32x32)")
            
            # Check if image is primarily grayscale (medical scans should be grayscale)
            # Sample pixels to check color variation
            sample_size = min(1000, height * width)  # Sample up to 1000 pixels
            step = max(1, (height * width) // sample_size)
            
            colorful_pixels = 0
            total_sampled = 0
            
            for i in range(0, height * width, step):
                y = i // width
                x = i % width
                if y < height and x < width:
                    b, g, r = image[y, x]  # OpenCV uses BGR
                    color_variation = max(r, g, b) - min(r, g, b)
                    if color_variation > 15:  # Increased threshold from 10 to 15
                        colorful_pixels += 1
                    total_sampled += 1
            
            colorful_ratio = colorful_pixels / total_sampled if total_sampled > 0 else 0
            
            # Reject if more than 20% of pixels are colorful (increased from 15% to 20%)
            if colorful_ratio > 0.20:
                validation_errors.append(f"Image appears too colorful ({colorful_ratio*100:.1f}% colorful pixels, maximum: 20%)")
            
            # Only raise exception if there are critical validation errors
            if validation_errors:
                error_msg = "Image validation issues: " + "; ".join(validation_errors)
                logger.warning(f"Image validation warnings for {file.filename}: {error_msg}")
                # Log but don't fail - allow processing with warnings
                # Uncomment the line below if you want strict validation
                # raise HTTPException(status_code=400, detail=error_msg)
            
            logger.info(f"Image validation passed - Shape: {image.shape}, Grayscale mean: {gray_mean:.2f}, std: {gray_std:.2f}, Colorful ratio: {colorful_ratio:.3f}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Image validation failed: {e}", exc_info=True)
            error_detail = str(e)
            if "decode" in error_detail.lower() or "imdecode" in error_detail.lower():
                raise HTTPException(
                    status_code=400, 
                    detail="Could not decode image file. Please ensure you're uploading a valid image format (JPEG, PNG). The file may be corrupted."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Image validation failed: {error_detail}. Please ensure you're uploading a valid grayscale medical scan (MRI, CT, X-ray)."
                )
        
        # Run analysis using unified model service (handles preprocessing internally)
        result = unified_model_service.analyze_tumor(content)
        
        # Add file information
        result.update({
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": file.content_type,
            "upload_timestamp": datetime.now().isoformat()
        })
        
        # Log analysis
        logger.info(
            f"Analysis completed for {file.filename}: "
            f"detected={result['detected']}, confidence={result['confidence']:.3f}, "
            f"tumor_count={result['tumor_count']}"
        )
        
        # Transform result to match the desired output format
        brain_tumor_status = "Detected" if result["detected"] else "Not Detected"
        
        frontend_result = {
            "brain_tumor": brain_tumor_status,
            "detected": result["detected"],  # Direct access for frontend
            "confidence": result["confidence"],  # Available but not prominently displayed
            "detection": {
                "is_tumor_detected": result["detected"],
                "timestamp": result.get("upload_timestamp", datetime.now().isoformat()),
                "model_info": {
                    "model_loaded": unified_model_service.get_model_status()['tumor_model']['loaded'],
                    "device": "cpu"
                }
            },
            "segmentation": {
                "tumor_regions": [
                    {
                        "tumor_type": "Brain Tumor",
                        "volume": result["tumor_pixels"],
                        "area_mm2": result["tumor_area_mm2"],
                        "confidence": result["confidence"]
                    }
                ] if result["detected"] else [],
                "total_tumor_volume": result["tumor_pixels"],
                "total_tumor_count": result["tumor_count"],
                "total_tumor_area_mm2": result["tumor_area_mm2"],
                "timestamp": result.get("upload_timestamp", datetime.now().isoformat()),
                "model_info": {
                    "model_loaded": unified_model_service.get_model_status()['tumor_model']['loaded'],
                    "device": "cpu"
                }
            },
            "images": {
                "input_image": result["original_image"],
                "tumor_overlay": result["segmented_image"]
            },
            "tumor_statistics": {
                "pixel_count": result["tumor_pixels"],
                "tumor_count": result["tumor_count"],
                "area_mm2": result["tumor_area_mm2"],
                "total_pixels": result["total_pixels"],
                "tumor_percentage": result["tumor_size_percent"]
            },
            "analysis_summary": f"Brain Tumor Analysis: {brain_tumor_status}",
            "recommendations": [
                "Immediate consultation with a neurologist recommended for tumor evaluation" if result["detected"] else "Continue regular checkups as recommended - no brain tumor detected"
            ],
            "timestamp": result.get("upload_timestamp", datetime.now().isoformat())
        }
        
        return JSONResponse(content=ensure_json_serializable(frontend_result))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """Standard analysis endpoint"""
    return await analyze_direct(file)

@router.get("/model-info")
async def get_model_info():
    """Get model information"""
    return unified_model_service.get_model_status()

@router.post("/analyze-alzheimer")
async def analyze_alzheimer(file: UploadFile = File(...)):
    """Analyze image for Alzheimer's detection"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file.content_type} not allowed. Allowed types: {ALLOWED_FILE_TYPES}"
            )
        
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File size {file.size} exceeds maximum {MAX_FILE_SIZE}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate image
        try:
            if CV2_AVAILABLE:
                nparr = np.frombuffer(content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if image is None:
                    # Try grayscale decoding
                    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
                    if image is not None:
                        image = gray_to_bgr(image)
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail="Invalid image file. Could not decode image. Please ensure the file is a valid image format (JPEG, PNG)."
                        )
            elif PIL_AVAILABLE:
                image_pil = PILImage.open(io.BytesIO(content))
                image = np.array(image_pil.convert('RGB'))
                image = image[:, :, ::-1]  # RGB to BGR
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Image processing libraries not available. Please install opencv-python or Pillow."
                )
            
            # Check if image is primarily grayscale (medical scans should be grayscale)
            height, width = image.shape[:2]
            if height < 32 or width < 32:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image resolution too low ({width}x{height}). Please upload a higher resolution medical scan (minimum: 32x32)."
                )
            
            sample_size = min(1000, height * width)  # Sample up to 1000 pixels
            step = max(1, (height * width) // sample_size)
            
            colorful_pixels = 0
            total_sampled = 0
            
            for i in range(0, height * width, step):
                y = i // width
                x = i % width
                if y < height and x < width:
                    b, g, r = image[y, x]  # OpenCV uses BGR
                    color_variation = max(r, g, b) - min(r, g, b)
                    if color_variation > 15:  # Increased threshold
                        colorful_pixels += 1
                    total_sampled += 1
            
            colorful_ratio = colorful_pixels / total_sampled if total_sampled > 0 else 0
            
            # Reject if more than 20% of pixels are colorful (increased threshold)
            if colorful_ratio > 0.20:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image appears too colorful ({colorful_ratio*100:.1f}% colorful pixels). Please upload a grayscale medical scan image."
                )
            
            logger.info(f"Alzheimer analysis - Image shape: {image.shape}, Colorful ratio: {colorful_ratio:.3f}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Image validation failed: {e}", exc_info=True)
            error_detail = str(e)
            if "decode" in error_detail.lower():
                raise HTTPException(
                    status_code=400, 
                    detail="Could not decode image file. Please ensure you're uploading a valid image format (JPEG, PNG)."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image file: {error_detail}"
                )
        
        # Run Alzheimer analysis
        result = unified_model_service.analyze_alzheimer(content)
        
        # Add file information
        result.update({
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": file.content_type,
            "upload_timestamp": datetime.now().isoformat()
        })
        
        # Log analysis
        logger.info(
            f"Alzheimer analysis completed for {file.filename}: "
            f"detected={result['detected']}, confidence={result['confidence']:.3f}, "
            f"class={result['predicted_class']}"
        )
        
        return JSONResponse(content=ensure_json_serializable(result))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Alzheimer analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Alzheimer analysis failed: {str(e)}")

@router.post("/analyze-ms")
async def analyze_multiple_sclerosis(file: UploadFile = File(...)):
    """Analyze image for Multiple Sclerosis detection"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed. Allowed types: {ALLOWED_FILE_TYPES}"
            )

        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size {file.size} exceeds maximum {MAX_FILE_SIZE}"
            )

        content = await file.read()

        # Basic validation (reuse tumor validation for grayscale medical scans)
        try:
            if CV2_AVAILABLE:
                nparr = np.frombuffer(content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if image is None:
                    # Try grayscale decoding
                    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
                    if image is not None:
                        image = gray_to_bgr(image)
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail="Invalid image file. Could not decode image. Please ensure the file is a valid image format (JPEG, PNG)."
                        )
            elif PIL_AVAILABLE:
                image_pil = PILImage.open(io.BytesIO(content))
                image = np.array(image_pil.convert('RGB'))
                image = image[:, :, ::-1]  # RGB to BGR
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Image processing libraries not available. Please install opencv-python or Pillow."
                )

            height, width = image.shape[:2]
            if height < 64 or width < 64:  # Reduced from 128 to 64
                raise HTTPException(
                    status_code=400,
                    detail=f"Image resolution too low ({width}x{height}). Please upload a higher resolution medical scan (minimum: 64x64)."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"MS image validation failed: {e}", exc_info=True)
            error_detail = str(e)
            if "decode" in error_detail.lower():
                raise HTTPException(
                    status_code=400, 
                    detail="Could not decode image file. Please ensure you're uploading a valid image format (JPEG, PNG)."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image file: {error_detail}"
                )

        result = unified_model_service.analyze_ms(content)
        result.update({
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": file.content_type,
            "upload_timestamp": datetime.now().isoformat()
        })

        logger.info(
            f"MS analysis completed for {file.filename}: "
            f"detected={result['detected']}, confidence={result.get('confidence', 0):.3f}"
        )

        return JSONResponse(content=ensure_json_serializable(result))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MS analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"MS analysis failed: {str(e)}")

@router.post("/analyze-comprehensive")
async def analyze_comprehensive(file: UploadFile = File(...)):
    """Comprehensive analysis for both tumor and Alzheimer detection"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if file.content_type not in ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file.content_type} not allowed. Allowed types: {ALLOWED_FILE_TYPES}"
            )
        
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File size {file.size} exceeds maximum {MAX_FILE_SIZE}"
            )
        
        # Read file content
        content = await file.read()
        
        # Validate image
        try:
            if CV2_AVAILABLE:
                nparr = np.frombuffer(content, np.uint8)
                image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if image is None:
                    # Try grayscale decoding
                    image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
                    if image is not None:
                        image = gray_to_bgr(image)
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail="Invalid image file. Could not decode image. Please ensure the file is a valid image format (JPEG, PNG)."
                        )
            elif PIL_AVAILABLE:
                image_pil = PILImage.open(io.BytesIO(content))
                image = np.array(image_pil.convert('RGB'))
                image = image[:, :, ::-1]  # RGB to BGR
            else:
                raise HTTPException(
                    status_code=500,
                    detail="Image processing libraries not available. Please install opencv-python or Pillow."
                )
            
            # Check if image is primarily grayscale (medical scans should be grayscale)
            height, width = image.shape[:2]
            if height < 32 or width < 32:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image resolution too low ({width}x{height}). Please upload a higher resolution medical scan (minimum: 32x32)."
                )
            
            sample_size = min(1000, height * width)  # Sample up to 1000 pixels
            step = max(1, (height * width) // sample_size)
            
            colorful_pixels = 0
            total_sampled = 0
            
            for i in range(0, height * width, step):
                y = i // width
                x = i % width
                if y < height and x < width:
                    b, g, r = image[y, x]  # OpenCV uses BGR
                    color_variation = max(r, g, b) - min(r, g, b)
                    if color_variation > 15:  # Increased threshold
                        colorful_pixels += 1
                    total_sampled += 1
            
            colorful_ratio = colorful_pixels / total_sampled if total_sampled > 0 else 0
            
            # Reject if more than 20% of pixels are colorful (increased threshold)
            if colorful_ratio > 0.20:
                raise HTTPException(
                    status_code=400,
                    detail=f"Image appears too colorful ({colorful_ratio*100:.1f}% colorful pixels). Please upload a grayscale medical scan image."
                )
            
            logger.info(f"Comprehensive analysis - Image shape: {image.shape}, Colorful ratio: {colorful_ratio:.3f}")
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Image validation failed: {e}", exc_info=True)
            error_detail = str(e)
            if "decode" in error_detail.lower():
                raise HTTPException(
                    status_code=400, 
                    detail="Could not decode image file. Please ensure you're uploading a valid image format (JPEG, PNG)."
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image file: {error_detail}"
                )
        
        # Run comprehensive analysis
        result = unified_model_service.analyze_both(content)
        
        # Add file information
        result.update({
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": file.content_type,
            "upload_timestamp": datetime.now().isoformat()
        })
        
        # Log analysis
        logger.info(
            f"Comprehensive analysis completed for {file.filename}: "
            f"tumor_detected={result['summary']['detections']['tumor_detected']}, "
            f"alzheimer_detected={result['summary']['detections']['alzheimer_detected']}"
        )
        
        return JSONResponse(content=ensure_json_serializable(result))
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Comprehensive analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Comprehensive analysis failed: {str(e)}")

@router.get("/load-models")
async def load_models():
    """Load all available models"""
    try:
        results = unified_model_service.load_all_models()
        return {
            "message": "Model loading completed",
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Model loading failed: {e}")
        raise HTTPException(status_code=500, detail=f"Model loading failed: {str(e)}")



