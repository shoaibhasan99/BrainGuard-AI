/**
 * AI Analysis Service for BrainGuard AI
 * Integrates with FastAPI backend for brain tumor detection and segmentation
 */

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_ENDPOINTS = {
  UPLOAD: `${API_BASE_URL}/api/v1/analysis/upload`,
  DETECT: `${API_BASE_URL}/api/v1/analysis/detect`,
  SEGMENT: `${API_BASE_URL}/api/v1/analysis/segment`,
  ANALYZE_DIRECT: `${API_BASE_URL}/api/v1/analysis/analyze-direct`,
  ANALYZE: `${API_BASE_URL}/api/v1/analysis/analyze`,
  GET_RESULT: `${API_BASE_URL}/api/v1/analysis/analyze`,
  HEALTH: `${API_BASE_URL}/health`,
  MODEL_INFO: `${API_BASE_URL}/model/info`
};

// Types
export interface UploadResponse {
  file_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
  message: string;
}

export interface TumorInfo {
  region_id: string;
  tumor_type: string;
  volume: number;
  area_mm2: number;
  centroid: number[];
  bounding_box: number[];
  confidence: number;
}

export interface DetectionResult {
  is_tumor_detected: boolean;
  confidence: number;
  tumor_probability: number;
  timestamp: string;
  model_info: any;
}

export interface SegmentationResult {
  segmentation_mask: number[][][];
  tumor_regions: TumorInfo[];
  total_tumor_volume: number;
  timestamp: string;
  model_info: any;
}

export interface TumorStatistics {
  pixel_count: number;
  area_mm2: number;
  total_pixels: number;
  tumor_percentage: number;
}

export interface AnalysisImages {
  input_image: string;
  tumor_overlay: string;
}

export interface AnalysisResult {
  detection: DetectionResult;
  segmentation: SegmentationResult;
  images: AnalysisImages;
  tumor_statistics: TumorStatistics;
  analysis_summary: string;
  recommendations: string[];
  timestamp: string;
}

export interface AnalysisRequest {
  file_id: string;
  analysis_type: 'detection' | 'segmentation' | 'full';
  confidence_threshold?: number;
}

export interface AnalysisResponse {
  request_id: string;
  file_id: string;
  analysis_type: string;
  status: 'processing' | 'completed' | 'failed';
  result?: AnalysisResult;
  error_message?: string;
  processing_time?: number;
  timestamp: string;
}

export interface ModelInfo {
  model_loaded: boolean;
  device: string;
  confidence_threshold: number;
  model_info: any;
  timestamp: string;
}

// Error handling
class AIAnalysisError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AIAnalysisError';
  }
}

// Service class
export class AIAnalysisService {
  private static instance: AIAnalysisService;
  private isConnected = false;

  private constructor() {
    this.checkConnection();
  }

  public static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  /**
   * Check if the AI backend is connected
   */
  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch(API_ENDPOINTS.HEALTH);
      this.isConnected = response.ok;
    } catch (error) {
      this.isConnected = false;
      console.warn('AI backend not available:', error);
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get model information
   */
  public async getModelInfo(): Promise<ModelInfo> {
    try {
      const response = await fetch(API_ENDPOINTS.MODEL_INFO);
      
      if (!response.ok) {
        throw new AIAnalysisError(`Failed to get model info: ${response.statusText}`, response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting model info:', error);
      throw error;
    }
  }

  /**
   * Upload brain scan image
   */
  public async uploadBrainScan(file: File): Promise<UploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_ENDPOINTS.UPLOAD, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Upload failed', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Detect brain tumor (direct analysis)
   */
  public async detectTumor(file: File): Promise<DetectionResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_ENDPOINTS.DETECT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Detection failed', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error detecting tumor:', error);
      throw error;
    }
  }

  /**
   * Segment brain tumor (direct analysis)
   */
  public async segmentTumor(file: File): Promise<SegmentationResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_ENDPOINTS.SEGMENT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Segmentation failed', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error segmenting tumor:', error);
      throw error;
    }
  }

  /**
   * Complete brain scan analysis (direct analysis)
   */
  public async analyzeBrainScan(file: File): Promise<AnalysisResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(API_ENDPOINTS.ANALYZE_DIRECT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Analysis failed', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing brain scan:', error);
      throw error;
    }
  }

  /**
   * Start background analysis
   */
  public async startAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      const response = await fetch(API_ENDPOINTS.ANALYZE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Analysis failed to start', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting analysis:', error);
      throw error;
    }
  }

  /**
   * Get analysis result
   */
  public async getAnalysisResult(requestId: string): Promise<AnalysisResponse> {
    try {
      const response = await fetch(`${API_ENDPOINTS.GET_RESULT}/${requestId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }));
        throw new AIAnalysisError(errorData.detail || 'Failed to get result', response.status);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting analysis result:', error);
      throw error;
    }
  }

  /**
   * Poll for analysis result until completion
   */
  public async pollAnalysisResult(
    requestId: string,
    onProgress?: (status: string) => void,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<AnalysisResult> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const result = await this.getAnalysisResult(requestId);
        
        if (onProgress) {
          onProgress(result.status);
        }

        if (result.status === 'completed' && result.result) {
          return result.result;
        }

        if (result.status === 'failed') {
          throw new AIAnalysisError(result.error_message || 'Analysis failed');
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;

      } catch (error) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
      }
    }

    throw new AIAnalysisError('Analysis timeout - maximum attempts reached');
  }

  /**
   * Complete workflow: upload + analyze
   */
  public async uploadAndAnalyze(
    file: File,
    analysisType: 'detection' | 'segmentation' | 'full' = 'full',
    confidenceThreshold?: number,
    onProgress?: (status: string) => void
  ): Promise<AnalysisResult> {
    try {
      // Upload file
      if (onProgress) onProgress('Uploading file...');
      const uploadResult = await this.uploadBrainScan(file);

      // Start analysis
      if (onProgress) onProgress('Starting analysis...');
      const analysisRequest: AnalysisRequest = {
        file_id: uploadResult.file_id,
        analysis_type: analysisType,
        confidence_threshold: confidenceThreshold
      };

      const analysisResponse = await this.startAnalysis(analysisRequest);

      // Poll for result
      if (onProgress) onProgress('Processing...');
      const result = await this.pollAnalysisResult(
        analysisResponse.request_id,
        onProgress
      );

      return result;
    } catch (error) {
      console.error('Error in upload and analyze workflow:', error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  public validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = ['image/jpeg', 'image/png'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 100MB limit' };
    }

    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return { valid: false, error: 'File type not supported. Allowed: JPG, PNG' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const aiAnalysisService = AIAnalysisService.getInstance();

// Export error class
export { AIAnalysisError };
