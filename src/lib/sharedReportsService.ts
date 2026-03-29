/**
 * Shared Reports Service
 * This service manages medical scan reports using localStorage for persistence
 */

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const generateReportId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface SharedReport {
  id: string;
  patientId: string;
  patientName: string;
  doctorId?: string;
  doctorName?: string;
  scanType: string;
  diseaseType: string;
  generatedDate: string;
  status: 'completed' | 'pending' | 'failed';
  confidence: number;
  findings: string[];
  recommendations: string[];
  fileSize: string;
  downloadCount: number;
  originalImage?: string;
  segmentedImage?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    dimensions?: { width: number; height: number };
    format?: string;
    diseaseId?: string;
    diseaseType?: string;
    timestamp?: string;
  };
  // Additional fields for doctor view
  isSharedWithDoctor?: boolean;
  doctorNotes?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  // Additional fields
  scanId?: string;
}

export interface PatientReport {
  id: string;
  patientId: string;
  patientName: string;
  scanType: string;
  diseaseType: string;
  generatedDate: string;
  status: 'completed' | 'pending' | 'failed';
  confidence: number;
  findings: string[];
  recommendations: string[];
  fileSize: string;
  downloadCount: number;
  originalImage?: string;
  segmentedImage?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    dimensions?: { width: number; height: number };
    format?: string;
    diseaseId?: string;
    diseaseType?: string;
    timestamp?: string;
  };
}

class SharedReportsService {
  private reports: SharedReport[] = [];
  private listeners: Array<() => void> = [];

  private mapSupabaseReport(reportRow: any): SharedReport {
    const reportData = reportRow.report_data || {};
    
    // Get patient name from joined users table, fallback to report_data, then report_title
    const patientName = reportRow.patients?.users?.name 
      || reportData.patientName 
      || reportRow.report_title 
      || 'Patient';
    
    return {
      id: reportRow.id,
      patientId: reportRow.patient_id,
      patientName: patientName,
      doctorId: reportRow.doctor_id || undefined,
      doctorName: reportData.doctorName,
      scanType: reportData.scanType || reportRow.report_title || 'MRI Brain Scan',
      diseaseType: reportData.diseaseType || 'brain-tumor',
      generatedDate: reportRow.created_at || reportRow.updated_at || reportData.generatedDate || new Date().toISOString(),
      status: (reportData.status as any) || 'completed',
      confidence: reportData.confidence || 0,
      findings: Array.isArray(reportData.findings) ? reportData.findings : (reportRow.summary ? reportRow.summary.split('\n') : []),
      recommendations: reportRow.recommendations || reportData.recommendations || [],
      fileSize: reportData.fileSize || '0 MB',
      downloadCount: reportData.downloadCount || reportRow.download_count || 0,
      originalImage: reportData.originalImage,
      segmentedImage: reportData.segmentedImage,
      metadata: reportData.metadata,
      isSharedWithDoctor: reportData.isSharedWithDoctor || false,
      doctorNotes: reportData.doctorNotes,
      followUpRequired: reportData.followUpRequired,
      followUpDate: reportData.followUpDate,
      scanId: reportRow.scan_id || reportData.scanId,
    };
  }

  // Add a new report (from patient scan analysis)
  async addReport(report: Omit<SharedReport, 'id' | 'generatedDate' | 'downloadCount'>): Promise<SharedReport> {
    const createdAt = new Date().toISOString();
    let resolvedPatientId = report.patientId || 'PT-USER';
    let resolvedDoctorId: string | undefined = report.doctorId;

    const sharedReport: SharedReport = {
      id: generateReportId(),
      generatedDate: createdAt,
      downloadCount: 0,
      isSharedWithDoctor: false,
      ...report,
      patientId: resolvedPatientId,
      doctorId: resolvedDoctorId,
    };

    console.log('💾 Saving report to localStorage:', sharedReport.id);

    this.reports.unshift(sharedReport); // Add to beginning
    this.saveToStorage();
    this.notifyListeners();
    
    return sharedReport;
  }

  // Get all reports (for doctor dashboard)
  async getAllReports(): Promise<SharedReport[]> {
    this.loadFromStorage();
    console.log('📊 Reports loaded from localStorage:', this.reports.length);
    return [...this.reports];
  }

  // Get reports for a specific patient
  getPatientReports(patientId: string): SharedReport[] {
    return this.reports.filter(report => report.patientId === patientId);
  }

  // Get reports shared with a specific doctor
  getDoctorReports(doctorId: string): SharedReport[] {
    return this.reports.filter(report => 
      report.doctorId === doctorId || report.isSharedWithDoctor
    );
  }

  // Get report by ID
  getReportById(id: string): SharedReport | undefined {
    return this.reports.find(report => report.id === id);
  }

  // Share report with doctor
  shareWithDoctor(reportId: string, doctorId: string, doctorName: string): boolean {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.doctorId = doctorId;
      report.doctorName = doctorName;
      report.isSharedWithDoctor = true;
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Add doctor notes to a report
  addDoctorNotes(reportId: string, notes: string): boolean {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.doctorNotes = notes;
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Mark follow-up required
  setFollowUpRequired(reportId: string, required: boolean, followUpDate?: string): boolean {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.followUpRequired = required;
      report.followUpDate = followUpDate;
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Increment download count
  incrementDownloadCount(reportId: string): boolean {
    const report = this.reports.find(r => r.id === reportId);
    if (report) {
      report.downloadCount += 1;
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // Delete a report
  async deleteReport(id: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting report from localStorage:', id);

      let deletedLocally = false;
      let deletedRemotely = false;
      
      // Delete from local storage cache
      const index = this.reports.findIndex(report => report.id === id);
      if (index !== -1) {
        this.reports.splice(index, 1);
        this.saveToStorage();
        this.notifyListeners();
        deletedLocally = true;
        console.log('✅ Report deleted from local cache:', id);
      } else {
        console.log('⚠️ Report not found in local cache:', id);
      }

      // Attempt to delete from Supabase as well
      return deletedLocally;
    } catch (error) {
      console.error('❌ Error deleting report:', error);
      return false;
    }
  }

  // Clear all reports
  clearAllReports(): void {
    this.reports = [];
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
        localStorage.setItem('brainGuard_sharedReports', JSON.stringify(this.reports));
      }
    } catch (error) {
      console.error('Failed to save shared reports to localStorage:', error);
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('brainGuard_sharedReports');
        if (stored) {
          this.reports = JSON.parse(stored);
          
          // Debug: Log date formats being loaded
          console.log('📅 Loading reports from localStorage:', this.reports.length);
          this.reports.forEach((report, index) => {
            console.log(`Report ${index + 1} date:`, report.generatedDate, 'Type:', typeof report.generatedDate);
          });
        }
      }
    } catch (error) {
      console.error('Failed to load shared reports from localStorage:', error);
    }
  }

  // Get statistics
  getStatistics() {
    return {
      totalReports: this.reports.length,
      completedReports: this.reports.filter(r => r.status === 'completed').length,
      pendingReports: this.reports.filter(r => r.status === 'pending').length,
      failedReports: this.reports.filter(r => r.status === 'failed').length,
      sharedWithDoctors: this.reports.filter(r => r.isSharedWithDoctor).length,
      followUpRequired: this.reports.filter(r => r.followUpRequired).length,
      averageConfidence: this.reports.length > 0 
        ? Math.round(this.reports.reduce((sum, report) => sum + report.confidence, 0) / this.reports.length)
        : 0,
      scanTypes: {
        'brain-mri': this.reports.filter(r => r.scanType.toLowerCase().includes('mri')).length,
        'ct-scan': this.reports.filter(r => r.scanType.toLowerCase().includes('ct')).length,
        'x-ray': this.reports.filter(r => r.scanType.toLowerCase().includes('x-ray')).length,
        'ultrasound': this.reports.filter(r => r.scanType.toLowerCase().includes('ultrasound')).length
      },
      diseaseTypes: {
        'brain-tumor': this.reports.filter(r => r.diseaseType === 'brain-tumor').length,
        'alzheimer': this.reports.filter(r => r.diseaseType === 'alzheimer').length,
        'multiple-sclerosis': this.reports.filter(r => r.diseaseType === 'multiple-sclerosis').length,
        'normal': this.reports.filter(r => r.diseaseType === 'normal' || !r.diseaseType).length
      }
    };
  }

  // Initialize the service
  constructor() {
    this.loadFromStorage();
  }
}

// Export singleton instance
export const sharedReportsService = new SharedReportsService();
export default sharedReportsService;
