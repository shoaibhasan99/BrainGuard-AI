import { useState, useCallback } from 'react';
import { 
  aiAnalysisService, 
  AnalysisResult, 
  DetectionResult, 
  SegmentationResult,
  ModelInfo,
  AIAnalysisError 
} from '../lib/aiAnalysisService';

export interface AIAnalysisState {
  isAnalyzing: boolean;
  progress: string;
  result: AnalysisResult | null;
  error: string | null;
  modelInfo: ModelInfo | null;
  isConnected: boolean;
}

export const useAIAnalysis = () => {
  const [state, setState] = useState<AIAnalysisState>({
    isAnalyzing: false,
    progress: '',
    result: null,
    error: null,
    modelInfo: null,
    isConnected: aiAnalysisService.getConnectionStatus()
  });

  // Analyze brain scan directly
  const analyzeBrainScan = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 'Starting analysis...',
      error: null,
      result: null
    }));

    try {
      const result = await aiAnalysisService.analyzeBrainScan(file);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 'Analysis completed',
        result
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof AIAnalysisError 
        ? error.message 
        : 'Analysis failed';
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: '',
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  // Detect tumor only
  const detectTumor = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 'Detecting tumor...',
      error: null
    }));

    try {
      const result = await aiAnalysisService.detectTumor(file);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 'Detection completed'
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof AIAnalysisError 
        ? error.message 
        : 'Detection failed';
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: '',
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  // Segment tumor only
  const segmentTumor = useCallback(async (file: File) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 'Segmenting tumor...',
      error: null
    }));

    try {
      const result = await aiAnalysisService.segmentTumor(file);
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 'Segmentation completed'
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof AIAnalysisError 
        ? error.message 
        : 'Segmentation failed';
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: '',
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  // Upload and analyze with progress tracking
  const uploadAndAnalyze = useCallback(async (
    file: File,
    analysisType: 'detection' | 'segmentation' | 'full' = 'full',
    confidenceThreshold?: number
  ) => {
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 'Uploading file...',
      error: null,
      result: null
    }));

    try {
      const result = await aiAnalysisService.uploadAndAnalyze(
        file,
        analysisType,
        confidenceThreshold,
        (progress) => {
          setState(prev => ({
            ...prev,
            progress
          }));
        }
      );

      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: 'Analysis completed',
        result
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof AIAnalysisError 
        ? error.message 
        : 'Analysis failed';
      
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        progress: '',
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  // Get model information
  const getModelInfo = useCallback(async () => {
    try {
      const modelInfo = await aiAnalysisService.getModelInfo();
      setState(prev => ({
        ...prev,
        modelInfo
      }));
      return modelInfo;
    } catch (error) {
      console.error('Failed to get model info:', error);
      throw error;
    }
  }, []);

  // Validate file
  const validateFile = useCallback((file: File) => {
    return aiAnalysisService.validateFile(file);
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      result: null,
      error: null,
      progress: ''
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null
    }));
  }, []);

  // Check connection status
  const checkConnection = useCallback(() => {
    const isConnected = aiAnalysisService.getConnectionStatus();
    setState(prev => ({
      ...prev,
      isConnected
    }));
    return isConnected;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    analyzeBrainScan,
    detectTumor,
    segmentTumor,
    uploadAndAnalyze,
    getModelInfo,
    validateFile,
    clearResults,
    clearError,
    checkConnection
  };
};
