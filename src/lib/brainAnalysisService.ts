/**
 * Brain Analysis API Service
 * Connects frontend to FastAPI backend for real AI analysis
 */

const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface UploadResponse {
  file_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
  message: string;
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
  timestamp: string;
  result?: any;
  processing_time?: number;
  error_message?: string;
}

export interface DetectionResult {
  detected: boolean;
  confidence: number;
  tumor_type?: string;
  location?: string;
  severity?: string;
  predictedClass?: string; // For Alzheimer detection
  recommendations: string[];
  analysis_timestamp: string;
}

export interface AlzheimerDetectionResult {
  detected: boolean;
  predicted_class: string;
  confidence: number;
  cn_probability: number;
  emci_probability: number;
  mci_probability: number;
  ad_probability: number;
  class_index: number;
  raw_probabilities: {
    CN: number;
    EMCI: number;
    MCI: number;
    AD: number;
  };
  analysis_timestamp: string;
  model_info: {
    model_type: string;
    input_size: string;
    device: string;
    num_classes: number;
  };
  analysis_type: string;
  file_name: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
}

export interface MultipleSclerosisDetectionResult {
  detected: boolean;
  confidence: number;
  ms_probability: number;
  risk_level: string;
  lesion_burden_score: number;
  recommendations: string[];
  images?: {
    input_image?: string;
    tumor_overlay?: string;
  };
  tumor_statistics?: {
    pixel_count: number;
    tumor_count: number;
    area_mm2: number;
    total_pixels: number;
    tumor_percentage: number;
  };
  analysis_timestamp: string;
  model_info: {
    model_type: string;
    input_size: string;
    device: string;
  };
  file_name: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
  analysis_type: string;
}

export interface ComprehensiveAnalysisResult {
  analysis_type: string;
  timestamp: string;
  tumor_analysis: DetectionResult | null;
  alzheimer_analysis: AlzheimerDetectionResult | null;
  ms_analysis: MultipleSclerosisDetectionResult | null;
  summary: {
    models_loaded: {
      tumor: boolean;
      alzheimer: boolean;
      ms: boolean;
    };
    detections: {
      tumor_detected: boolean;
      alzheimer_detected: boolean;
      ms_detected: boolean;
    };
    recommendations: string[];
  };
  file_name: string;
  file_size: number;
  file_type: string;
  upload_timestamp: string;
}

export interface SegmentationResult {
  segmented_image: string; // base64 encoded
  tumor_mask: string; // base64 encoded
  tumor_area: number;
  tumor_volume: number;
  confidence: number;
  analysis_timestamp: string;
}

export interface AnalysisResult {
  detection: DetectionResult;
  segmentation: SegmentationResult;
  overall_confidence: number;
  analysis_timestamp: string;
  tumor_statistics?: {
    pixel_count: number;
    tumor_count: number;
    area_mm2: number;
    total_pixels: number;
    tumor_percentage: number;
  };
  images?: {
    input_image: string;
    tumor_overlay: string;
  };
  detected?: boolean;
  confidence?: number;
  tumor_count?: number;
  tumor_size_percent?: number;
}

class BrainAnalysisService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `HTTP error! status: ${response.status}`
      );
    }

    return response.json();
  }

  private async makeFormRequest<T>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch (e) {
        // If JSON parsing fails, try to get text response
        try {
          const textResponse = await response.text();
          if (textResponse) {
            errorMessage = textResponse;
          }
        } catch (textError) {
          // Keep default error message
        }
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Upload brain scan image to backend
   */
  async uploadBrainScan(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<UploadResponse>('/analysis/upload', formData);
  }

  /**
   * Start analysis of uploaded brain scan
   */
  async startAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    return this.makeRequest<AnalysisResponse>('/analysis/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get analysis result by request ID
   */
  async getAnalysisResult(requestId: string): Promise<AnalysisResponse> {
    return this.makeRequest<AnalysisResponse>(`/analysis/analyze/${requestId}`);
  }

  /**
   * Direct tumor detection (simpler endpoint)
   */
  async detectTumor(file: File): Promise<DetectionResult> {
    const formData = new FormData();
    formData.append('file', file);

    // Backend exposes analyze_direct at /api/v1/analyze-direct and detect at /api/v1/analysis/detect via router
    return this.makeFormRequest<DetectionResult>('/analysis/detect', formData);
  }

  /**
   * Direct tumor segmentation
   */
  async segmentTumor(file: File): Promise<SegmentationResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<SegmentationResult>('/analysis/segment', formData);
  }

  /**
   * Complete brain scan analysis (detection + segmentation)
   */
  async analyzeBrainScan(file: File): Promise<AnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<AnalysisResult>('/analysis/analyze-direct', formData);
  }

  /**
   * Analyze brain scan for Alzheimer's disease detection
   */
  async detectAlzheimer(file: File): Promise<AlzheimerDetectionResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<AlzheimerDetectionResult>('/analyze-alzheimer', formData);
  }

  /**
   * Analyze brain scan for Multiple Sclerosis detection
   */
  async detectMultipleSclerosis(file: File): Promise<MultipleSclerosisDetectionResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<MultipleSclerosisDetectionResult>('/analyze-ms', formData);
  }

  /**
   * Comprehensive analysis for both tumor and Alzheimer detection
   */
  async analyzeComprehensive(file: File): Promise<ComprehensiveAnalysisResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.makeFormRequest<ComprehensiveAnalysisResult>('/analysis/analyze-comprehensive', formData);
  }

  /**
   * Check if backend is healthy
   */
  async healthCheck(): Promise<{ status: string; model_loaded: boolean }> {
    try {
      const response = await fetch('http://localhost:8000/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      console.warn('Backend health check failed:', error);
      throw new Error('Backend is not available');
    }
  }

  /**
   * Get model information
   */
  async getModelInfo(): Promise<any> {
    return this.makeRequest('/model/info');
  }
}

// Export singleton instance
export const brainAnalysisService = new BrainAnalysisService();
export default brainAnalysisService;
