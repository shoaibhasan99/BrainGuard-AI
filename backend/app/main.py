"""
BrainGuard AI Backend - Main Application
Modular FastAPI backend for brain tumor detection
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import (
    API_TITLE, API_DESCRIPTION, API_VERSION, API_HOST, API_PORT,
    CORS_ORIGINS, LOG_LEVEL, LOG_FORMAT
)
from app.services.model_service import model_service
from app.services.unified_model_service import unified_model_service
from app.api.routes.analysis import router as analysis_router
from app.api.routes.email import router as email_router

# Configure logging
logging.basicConfig(level=getattr(logging, LOG_LEVEL), format=LOG_FORMAT)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management"""
    # Startup
    logger.info("Starting BrainGuard AI Backend...")
    
    # Load all models
    logger.info("Loading AI models...")
    model_results = unified_model_service.load_all_models()
    
    logger.info("Model loading results:")
    for model_name, loaded in model_results.items():
        status = "Success" if loaded else "Failed"
        logger.info(f"  {model_name}: {status}")
    
    logger.info("BrainGuard AI Backend started successfully!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down BrainGuard AI Backend...")
    unified_model_service.cleanup()
    logger.info("Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    version=API_VERSION,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router, prefix="/api/v1", tags=["analysis"])
app.include_router(email_router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "BrainGuard AI Backend",
        "version": API_VERSION,
        "docs": "/docs",
        "health": "/api/v1/health"
    }

# Direct health endpoint for frontend compatibility
@app.get("/health")
async def health_check_direct():
    """Direct health check endpoint for frontend compatibility"""
    return {
        "status": "healthy",
        "service": "BrainGuard AI Backend",
        "models_status": unified_model_service.get_model_status(),
        "timestamp": "2025-10-02T13:17:43Z"
    }

# Direct analyze endpoint for frontend compatibility
@app.post("/api/v1/analysis/analyze-direct")
async def analyze_direct_frontend(file: UploadFile = File(...)):
    """Frontend-compatible direct analysis endpoint"""
    from app.api.routes.analysis import analyze_direct
    return await analyze_direct(file)

if __name__ == "__main__":
    import uvicorn
    
    print("Starting BrainGuard AI Backend Server...")
    print(f"Server will be available at: http://{API_HOST}:{API_PORT}")
    print(f"API Documentation: http://{API_HOST}:{API_PORT}/docs")
    print(f"Health Check: http://{API_HOST}:{API_PORT}/api/v1/health")
    print("\n" + "="*50)
    
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level=LOG_LEVEL.lower()
    )

