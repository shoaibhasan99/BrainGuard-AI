/**
 * Shared service for storing and managing scan results across modules
 */

import { sharedReportsService } from './sharedReportsService';

export interface ScanResult {
  id: string;
  timestamp: string;
  fileName: string;
  fileSize: number;
  scanType: string;
  diseaseType: string;
  detected: boolean;
  confidence: number;
  tumorCount: number;
  tumorPixels: number;
  totalPixels: number;
  tumorSizePercent: number;
  findings: string[];
  recommendations: string[];
  originalImage: string;
  segmentedImage: string;
  patientName: string;
  patientId: string;
}

class ScanResultService {
  private scanResults: ScanResult[] = [];
  private listeners: Array<() => void> = [];

  // Add a new scan result
  async addScanResult(result: Omit<ScanResult, 'id' | 'timestamp' | 'patientName' | 'patientId'>): Promise<ScanResult> {
    const scanResult: ScanResult = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      patientName: 'Current User',
      patientId: 'PT-USER',
      ...result
    };

    this.scanResults.unshift(scanResult); // Add to beginning
    
    // Also add to shared reports service for doctor access (now async)
    try {
      await sharedReportsService.addReport({
        patientId: scanResult.patientId,
        patientName: scanResult.patientName,
        scanType: scanResult.scanType,
        diseaseType: scanResult.diseaseType,
        status: 'completed',
        confidence: scanResult.confidence,
        findings: scanResult.findings,
        recommendations: scanResult.recommendations,
        fileSize: `${(scanResult.fileSize / (1024 * 1024)).toFixed(1)} MB`,
        originalImage: scanResult.originalImage,
        segmentedImage: scanResult.segmentedImage,
        metadata: {
          fileName: scanResult.fileName,
          fileSize: scanResult.fileSize
        }
      });
    } catch (error) {
      console.error('Failed to add report to shared service:', error);
    }
    
    this.saveToStorage();
    this.notifyListeners();
    
    return scanResult;
  }

  // Get all scan results
  getScanResults(): ScanResult[] {
    return [...this.scanResults];
  }

  // Get scan result by ID
  getScanResultById(id: string): ScanResult | undefined {
    return this.scanResults.find(result => result.id === id);
  }

  // Delete a scan result
  deleteScanResult(id: string): boolean {
    const index = this.scanResults.findIndex(result => result.id === id);
    if (index !== -1) {
      this.scanResults.splice(index, 1);
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Clear all scan results
  clearAllResults(): void {
    this.scanResults = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  // Subscribe to changes
  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  // Save to localStorage
  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('brainGuard_scanResults', JSON.stringify(this.scanResults));
      }
    } catch (error) {
      console.error('Failed to save scan results to localStorage:', error);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('brainGuard_scanResults');
        if (stored) {
          this.scanResults = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to load scan results from localStorage:', error);
    }
  }

  // Initialize the service
  constructor() {
    this.loadFromStorage();
  }
}

// Export singleton instance
export const scanResultService = new ScanResultService();
export default scanResultService;
