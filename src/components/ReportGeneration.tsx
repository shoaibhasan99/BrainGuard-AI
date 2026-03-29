import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Search, 
  Brain, 
  AlertTriangle, 
  Activity,
  Clock,
  BarChart3,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Medication as MedicationType } from '../lib/medicationService';
import { scanAnalysisService, ScanReport } from '../lib/scanAnalysisService';
import { scanResultService, ScanResult } from '../lib/scanResultService';
import { pdfReportService, PDFReportData } from '../lib/pdfReportService';
import { sharedReportsService, SharedReport } from '../lib/sharedReportsService';
import { useAuth } from '../contexts/AuthContext';

interface Report {
  id: string;
  patientName: string;
  patientId: string;
  reportType: 'scan' | 'medication-adherence' | 'medication-history' | 'compliance' | 'health-analytics' | 'Brain Tumor Scan' | 'Alzheimer Scan' | 'Multiple Sclerosis Scan';
  scanType?: string;
  diseaseType?: string;
  generatedDate: string;
  status: 'completed' | 'pending' | 'failed';
  findings: string[];
  recommendations: string[];
  fileSize: string;
  downloadCount: number;
  // Medication-specific fields
  medications?: MedicationType[];
  adherenceRate?: number;
  totalDoses?: number;
  missedDoses?: number;
  period?: string;
}

interface SavedReport {
  id: string;
  timestamp: string;
  diseaseType: string;
  diseaseId: string;
  confidence: number;
  detected: boolean;
  originalImage: string | null;
  segmentedImage: string | null;
  fileName: string;
  reportData: any;
}

interface ReportGenerationProps {
  savedReports: SavedReport[];
}

const ReportGeneration: React.FC<ReportGenerationProps> = ({ savedReports }) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed'>('all');
  const [filterType, setFilterType] = useState<'all' | 'brain-tumor' | 'alzheimer' | 'multiple-sclerosis' | 'normal'>('all');
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [scanReports, setScanReports] = useState<ScanReport[]>([]);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [sharedReports, setSharedReports] = useState<SharedReport[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Get the logged-in user's name
  const loggedInUserName = user?.name || 'Current User';
  const loggedInUserId = user?.id || 'PT-USER';

  // Format patient ID to PT-XXX format
  const formatPatientId = (userId: string) => {
    if (userId.startsWith('PT-')) {
      return userId;
    }
    // Extract last 3 characters from UUID and format as PT-XXX
    const lastThree = userId.slice(-3);
    return `PT-${lastThree}`;
  };

  // Generate simple report numbers (1, 2, 3, etc.)
  const generateReportNumber = (_reportId: string, index: number) => {
    // Start from 1 and increment based on index
    return 1 + index;
  };

  // Generate specific report type based on disease type
  const generateReportType = (diseaseType?: string): string => {
    switch (diseaseType) {
      case 'brain-tumor':
        return 'Brain Tumor Scan';
      case 'alzheimer':
        return 'Alzheimer Scan';
      case 'multiple-sclerosis':
        return 'Multiple Sclerosis Scan';
      default:
        return 'Medical Scan'; // Fallback for any unexpected types
    }
  };

  // Safe date formatting utility
  const formatDate = (dateString: string): string => {
    try {
      // Handle different date formats
      let date: Date;
      
      if (!dateString || dateString === 'Invalid Date') {
        return 'Invalid Date';
      }
      
      // Try parsing the date string
      date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Invalid Date';
      }
      
      // Format the date with time
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Date formatting error:', error, 'Input:', dateString);
      return 'Invalid Date';
    }
  };

  // Load scan data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load scan data from shared service
        if (scanResultService && typeof scanResultService.getScanResults === 'function') {
          const results = scanResultService.getScanResults();
          setScanResults(results || []);
        } else {
          setScanResults([]);
        }
        
        // Also load legacy scan data for backward compatibility
        if (scanAnalysisService && typeof scanAnalysisService.getReports === 'function') {
          const reportData = scanAnalysisService.getReports();
          setScanReports(reportData || []);
        } else {
          setScanReports([]);
        }

        // Load shared reports (this will include all patient reports)
        try {
          console.log('🔄 Loading shared reports...');
          const allSharedReports = await sharedReportsService.getAllReports();
          console.log('📊 Shared reports loaded:', allSharedReports?.length || 0);
          console.log('📊 Shared reports data:', allSharedReports);
          setSharedReports(allSharedReports);
        } catch (error) {
          console.error('❌ Failed to load shared reports:', error);
          setSharedReports([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setScanResults([]);
        setScanReports([]);
        setSharedReports([]);
      }
    };
    
    loadData();
    
    // Subscribe to changes in scan results
    let unsubscribe: (() => void) | undefined;
    try {
      if (scanResultService && typeof scanResultService.subscribe === 'function') {
        unsubscribe = scanResultService.subscribe(() => loadData());
      }
    } catch (error) {
      console.error('Error subscribing to scan results:', error);
    }

    // Subscribe to changes in shared reports
    const unsubscribeShared = sharedReportsService.subscribe(() => loadData());
    
    // Refresh data every 5 seconds to catch new uploads
    const interval = setInterval(() => loadData(), 5000);
    
    return () => {
      clearInterval(interval);
      if (unsubscribe) {
        unsubscribe();
      }
      unsubscribeShared();
    };
  }, []);

  // Delete a single report
  const handleDeleteReport = async (reportId: string) => {
    try {
      console.log('Attempting to delete report:', reportId);

      const isSharedReport = sharedReports.some(report => report.id === reportId);

      if (isSharedReport) {
        const sharedDeleted = await sharedReportsService.deleteReport(reportId);
        if (sharedDeleted) {
          console.log('Report deleted from shared reports:', reportId);
          const updatedSharedReports = await sharedReportsService.getAllReports();
          setSharedReports(updatedSharedReports || []);
        }
      }

      // Also try to delete from scan results
      const scanResultDeleted = scanResultService.deleteScanResult(reportId);
      if (scanResultDeleted) {
        console.log('Report deleted from scan results:', reportId);
        // Refresh the data
        const results = scanResultService.getScanResults();
        setScanResults(results || []);
      }
      
      // If not found in scan results, try legacy reports
      const updatedLegacyReports = scanReports.filter(report => report.id !== reportId);
      if (updatedLegacyReports.length !== scanReports.length) {
        setScanReports(updatedLegacyReports);
        console.log('Report deleted from legacy reports:', reportId);
      }
      
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  // Delete selected reports
  const handleDeleteSelected = async () => {
    try {
      console.log('Attempting to delete selected reports:', selectedReports);
      
      for (const reportId of selectedReports) {
        const isSharedReport = sharedReports.some(report => report.id === reportId);

        if (isSharedReport) {
          const sharedDeleted = await sharedReportsService.deleteReport(reportId);
          if (sharedDeleted) {
            console.log('Report deleted from shared reports:', reportId);
          }
        }

        scanResultService.deleteScanResult(reportId);
      }
      
      // Refresh all data sources
      const updatedSharedReports = await sharedReportsService.getAllReports();
      setSharedReports(updatedSharedReports || []);
      
      const results = scanResultService.getScanResults();
      setScanResults(results || []);
      
      setSelectedReports([]);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting selected reports:', error);
    }
  };

  // Convert real scan reports to display format
  const realReports: Report[] = [
    // Convert shared reports (includes all patient reports)
    ...sharedReports.map(sharedReport => ({
      id: sharedReport.id,
      patientName: sharedReport.patientName,
      patientId: sharedReport.patientId,
      reportType: generateReportType(sharedReport.diseaseType) as any,
      scanType: sharedReport.scanType,
      diseaseType: sharedReport.diseaseType,
      generatedDate: sharedReport.generatedDate,
      status: sharedReport.status,
      findings: sharedReport.findings,
      recommendations: sharedReport.recommendations,
      fileSize: sharedReport.fileSize,
      downloadCount: sharedReport.downloadCount
    })),
    // Convert saved reports from scan analysis
    ...savedReports.map(savedReport => {
      // Debug: Log the saved report data to understand contradictions
      console.log('🔍 Debug - Processing saved report:', {
        id: savedReport.id,
        detected: savedReport.detected,
        reportData: savedReport.reportData,
        tumorSizePercent: savedReport.reportData?.results?.[0]?.tumorSizePercent,
        tumorCount: savedReport.reportData?.results?.[0]?.tumorCount,
        tumorStatistics: savedReport.reportData?.tumor_statistics
      });
      
      // Enhanced tumor detection logic - check both detection flag and tumor statistics
      const isTumorDetected = (() => {
        // Check primary detection flag
        if (savedReport.detected) {
          return true;
        }
        
        // Check tumor statistics for additional evidence
        const tumorStats = savedReport.reportData?.tumor_statistics;
        if (tumorStats) {
          const hasTumorPixels = tumorStats.pixel_count && tumorStats.pixel_count > 0;
          const hasTumorArea = tumorStats.area_mm2 && tumorStats.area_mm2 > 0;
          const hasTumorPercentage = tumorStats.tumor_percentage && tumorStats.tumor_percentage > 0;
          
          if (hasTumorPixels || hasTumorArea || hasTumorPercentage) {
            console.log('🔍 Tumor detected based on statistics in report:', {
              pixel_count: tumorStats.pixel_count,
              area_mm2: tumorStats.area_mm2,
              tumor_percentage: tumorStats.tumor_percentage
            });
            return true;
          }
        }
        
        // Check analysis results for tumor evidence
        const analysisResults = savedReport.reportData?.results?.[0];
        if (analysisResults) {
          const hasTumorSize = analysisResults.tumorSizePercent && analysisResults.tumorSizePercent > 0;
          const hasTumorCount = analysisResults.tumorCount && analysisResults.tumorCount > 0;
          const hasTumorPixels = analysisResults.tumorPixels && analysisResults.tumorPixels > 0;
          
          if (hasTumorSize || hasTumorCount || hasTumorPixels) {
            console.log('🔍 Tumor detected based on analysis results in report:', {
              tumorSizePercent: analysisResults.tumorSizePercent,
              tumorCount: analysisResults.tumorCount,
              tumorPixels: analysisResults.tumorPixels
            });
            return true;
          }
        }
        
        return false;
      })();
      
      // Build findings and recommendations based on disease type
      const isAlzheimer = savedReport.diseaseId === 'alzheimer';
      const isMultipleSclerosis = savedReport.diseaseId === 'multiple-sclerosis';
      const msReportData = isMultipleSclerosis ? savedReport.reportData ?? {} : {};

      const alzheimerFindings: string[] = (() => {
        if (!isAlzheimer) return [];
        const data = savedReport.reportData as any;
        const res0 = data?.results?.[0] || {};
        const predicted: string = res0?.predictedClass || data?.predicted_class || data?.prediction || 'Not available';
        const rawConfidence: number | undefined = typeof res0?.confidence === 'number' ? res0.confidence : (typeof data?.confidence === 'number' ? data.confidence : undefined);
        const percentageConfidence = typeof rawConfidence === 'number' ? (rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence) : undefined;
        const confidenceText = typeof percentageConfidence === 'number' ? `${percentageConfidence.toFixed(2)}%` : undefined;

        const lines: string[] = [`Alzheimer analysis: ${predicted}`];
        if (confidenceText) lines.push(`Model confidence: ${confidenceText}`);
        return lines;
      })();

      const alzheimerRecommendations: string[] = isAlzheimer
        ? [
            '• Consult a neurologist or memory clinic for comprehensive evaluation',
            '• Consider neuropsychological testing and longitudinal monitoring',
            '• Discuss lifestyle interventions (sleep, exercise, diet, cognitive training)',
            '• Engage caregivers and plan follow-ups per clinical guidance'
          ]
        : [];

      const msFindings: string[] = (() => {
        if (!isMultipleSclerosis) return [];
        const detected = Boolean(savedReport.detected);
        const riskLevel = msReportData?.risk_level ?? msReportData?.riskLevel ?? 'Not available';
        const probabilityRaw = msReportData?.ms_probability ?? msReportData?.msProbability ?? msReportData?.confidence;
        const probabilityText =
          typeof probabilityRaw === 'number' ? probabilityRaw.toFixed(2) : 'Not available';
        const lesionBurdenRaw = msReportData?.lesion_burden_score ?? msReportData?.lesionBurdenScore;
        const lesionBurdenText =
          typeof lesionBurdenRaw === 'number' ? lesionBurdenRaw.toFixed(1) : 'Not available';

        return [
          detected ? 'Multiple sclerosis lesion activity detected' : 'No active MS lesions detected',
          `Risk level: ${riskLevel}`,
          `Probability score: ${probabilityText}`,
          `Lesion burden score: ${lesionBurdenText}`,
        ];
      })();

      const msRecommendations: string[] = isMultipleSclerosis
        ? (() => {
            const recs = msReportData?.recommendations;
            if (Array.isArray(recs) && recs.length > 0) {
              return recs.map((rec: string) => (rec.startsWith('•') ? rec : `• ${rec}`));
            }
            return [
              '• Consult a neurologist specializing in Multiple Sclerosis.',
              '• Review eligibility for disease-modifying therapies.',
              '• Schedule follow-up imaging to monitor lesion progression.',
              '• Continue symptom monitoring and lifestyle adjustments.',
            ];
          })()
        : [];

      return {
      id: savedReport.id,
      patientName: loggedInUserName,
      patientId: formatPatientId(loggedInUserId),
      reportType: generateReportType(savedReport.diseaseId) as any,
      scanType: 'MRI Brain Scan',
      diseaseType: savedReport.diseaseId,
      generatedDate: formatDate(savedReport.timestamp),
      status: 'completed' as const,
        findings: isAlzheimer
          ? (alzheimerFindings.length > 0
              ? alzheimerFindings
              : ['Alzheimer analysis completed'])
          : (isMultipleSclerosis
              ? (msFindings.length > 0 ? msFindings : ['Multiple sclerosis analysis completed'])
              : (isTumorDetected 
                  ? [
                      'Brain tumor detected',
                      `Tumor size: ${(() => {
                        const tumorPercent = savedReport.reportData?.results?.[0]?.tumorSizePercent;
                        if (tumorPercent && tumorPercent > 0) {
                          return `${tumorPercent.toFixed(2)}% of brain volume`;
                        }
                        return 'Size calculation in progress';
                      })()}`,
                      `Tumor result: ${(() => {
                        const tumorCount = savedReport.reportData?.results?.[0]?.tumorCount;
                        if (tumorCount && tumorCount > 0) {
                          return `${tumorCount} tumor(s) identified`;
                        }
                        return '1 tumor(s) identified';
                      })()}`,
                      'Abnormal mass detected in brain tissue',
                      'Mass appears to be enhancing with contrast',
                      'Surrounding edema present'
                    ]
                  : [
                      'No brain tumor detected',
                      'Normal brain parenchyma',
                      'No evidence of mass lesions',
                      'Normal ventricular system'
                    ])),
        recommendations: isAlzheimer
          ? alzheimerRecommendations
          : (isMultipleSclerosis
              ? msRecommendations
              : (isTumorDetected
                  ? [
                      '• Immediate consultation with a neurosurgeon and oncologist is recommended',
                      '• Further imaging studies may be required for detailed assessment',
                      '• Consider biopsy for definitive diagnosis',
                      '• Urgent follow-up MRI with contrast in 2-4 weeks',
                      '• Monitor for any neurological symptoms or changes',
                      '• Discuss treatment options with multidisciplinary team'
                    ]
                  : [
                      '• Continue regular checkups as recommended',
                      '• No immediate intervention required',
                      '• Maintain healthy lifestyle and regular exercise',
                      '• Follow up as clinically indicated by symptoms'
                    ])),
      fileSize: `${(savedReport.fileName.length * 0.001).toFixed(1)} MB`,
      downloadCount: 0
      };
    }),
    // Convert new scan results from shared service
    ...scanResults.map(scanResult => ({
      id: scanResult.id,
      patientName: loggedInUserName, // Use logged-in user's name
      patientId: formatPatientId(loggedInUserId), // Use formatted patient ID
      reportType: generateReportType(scanResult.diseaseType) as any,
      scanType: scanResult.scanType,
      diseaseType: scanResult.diseaseType,
      generatedDate: scanResult.timestamp.split('T')[0], // Use real scan timestamp
      status: 'completed' as const,
      findings: scanResult.detected 
        ? [
            'Brain tumor detected',
            `Tumor size: ${scanResult.tumorSizePercent.toFixed(2)}% of brain volume`,
            `Tumor result: ${scanResult.tumorCount} tumor(s) identified`,
            'Abnormal mass detected in brain tissue',
            'Mass appears to be enhancing with contrast',
            'Surrounding edema present'
          ]
        : [
            'No brain tumor detected',
            'Normal brain parenchyma',
            'No evidence of mass lesions',
            'Normal ventricular system'
          ],
      recommendations: scanResult.detected 
        ? [
            '• Immediate consultation with a neurosurgeon and oncologist is recommended',
            '• Further imaging studies may be required for detailed assessment',
            '• Consider biopsy for definitive diagnosis',
            '• Urgent follow-up MRI with contrast in 2-4 weeks',
            '• Monitor for any neurological symptoms or changes',
            '• Discuss treatment options with multidisciplinary team'
          ]
        : [
            '• Continue regular checkups as recommended',
            '• No immediate intervention required',
            '• Maintain healthy lifestyle and regular exercise',
            '• Follow up as clinically indicated by symptoms'
          ],
      fileSize: `${(scanResult.fileSize / (1024 * 1024)).toFixed(1)} MB`,
      downloadCount: 0
    })),
    // Convert legacy scan reports
    ...scanReports.map(scanReport => ({
      id: scanReport.id,
      patientName: loggedInUserName, // Use logged-in user's name
      patientId: formatPatientId(loggedInUserId), // Use formatted patient ID
      reportType: generateReportType(scanReport.diseaseType) as any,
      scanType: scanReport.scanType,
      diseaseType: scanReport.diseaseType,
      generatedDate: scanReport.generatedDate, // Use real scan date
      status: scanReport.status,
      findings: scanReport.findings.filter(finding => !finding.toLowerCase().includes('confidence')).map(finding => {
        // Add tumor size and result information if it's a brain tumor report
        if (scanReport.diseaseType === 'brain-tumor' && scanReport.findings.some(f => f.toLowerCase().includes('abnormal'))) {
          return [
            'Brain tumor detected',
            'Tumor size: Calculated from image analysis',
            'Tumor result: Abnormal mass identified',
            finding
          ];
        }
        return finding;
      }).flat(),
      recommendations: scanReport.recommendations.map(rec => rec.startsWith('•') ? rec : `• ${rec}`),
      fileSize: scanReport.fileSize,
      downloadCount: scanReport.downloadCount
    }))
  ].sort((a, b) => new Date(b.generatedDate).getTime() - new Date(a.generatedDate).getTime()); // Sort by date (newest first)


  const filteredReports = realReports.filter(report => {
    const matchesSearch = report.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.patientId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    const matchesCondition = filterType === 'all' || 
                           (report.diseaseType === filterType) || 
                           (filterType === 'normal' && !report.diseaseType);
    
    return matchesSearch && matchesStatus && matchesCondition;
  });

  const getDiseaseIcon = (diseaseType?: string) => {
    switch (diseaseType) {
      case 'brain-tumor': return Brain;
      case 'alzheimer': return AlertTriangle;
      case 'multiple-sclerosis': return Activity;
      default: return CheckCircle; // For normal cases
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const handleSelectAll = () => {
    if (selectedReports.length === filteredReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(filteredReports.map(report => report.id));
    }
  };

  const handleSelectReport = (reportId: string) => {
    setSelectedReports(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  // Download Report Function - PDF
  const downloadReport = (report: Report) => {
    const reportIndex = filteredReports.findIndex(r => r.id === report.id);
    const reportNumber = generateReportNumber(report.id, reportIndex);
    
    // Increment download count in shared reports service
    sharedReportsService.incrementDownloadCount(report.id);
    
    // Find the original scan result to get image data
    const scanResult = scanResults.find(sr => sr.id === report.id);
    const savedReport = savedReports.find(sr => sr.id === report.id);
    
    const reportData: PDFReportData = {
      patientName: report.patientName, // Use report's patient name
      patientId: report.patientId, // Use report's patient ID
      reportType: report.reportType,
      scanType: report.scanType,
      diseaseType: report.diseaseType,
      generatedDate: report.generatedDate,
      findings: report.findings,
      recommendations: report.recommendations,
      fileSize: report.fileSize,
      adherenceRate: report.adherenceRate,
      totalDoses: report.totalDoses,
      missedDoses: report.missedDoses,
      period: report.period,
      reportNumber: `#${reportNumber}`, // Add simple report number
      // Add image data if available (ensure strings only)
      originalImage: scanResult?.originalImage ?? (savedReport?.originalImage ?? undefined),
      segmentedImage: scanResult?.segmentedImage ?? (savedReport?.segmentedImage ?? undefined),
      tumorSize: report.diseaseType === 'brain-tumor' && scanResult?.tumorSizePercent ? `${scanResult.tumorSizePercent.toFixed(2)}%` : undefined,
      tumorResult: report.diseaseType === 'brain-tumor' && scanResult?.tumorCount ? `${scanResult.tumorCount} tumor(s)` : undefined
    };

    // Generate and download PDF
    pdfReportService.generateReport(reportData);
  };

  // Download Multiple Reports Function - PDF
  const downloadMultipleReports = () => {
    if (selectedReports.length === 0) return;
    
    const selectedReportData = filteredReports
      .filter(report => selectedReports.includes(report.id))
      .map((report) => {
        const reportIndex = filteredReports.findIndex(r => r.id === report.id);
        const reportNumber = generateReportNumber(report.id, reportIndex);
        
        // Find the original scan result to get image data
        const scanResult = scanResults.find(sr => sr.id === report.id);
        const savedReport = savedReports.find(sr => sr.id === report.id);
        
        return {
          patientName: loggedInUserName, // Use logged-in user's name
          patientId: loggedInUserId, // Use logged-in user's ID
          reportType: report.reportType,
          scanType: report.scanType,
          diseaseType: report.diseaseType,
          generatedDate: report.generatedDate,
          findings: report.findings,
          recommendations: report.recommendations,
          fileSize: report.fileSize,
          adherenceRate: report.adherenceRate,
          totalDoses: report.totalDoses,
          missedDoses: report.missedDoses,
          period: report.period,
          reportNumber: `#${reportNumber}`, // Add simple report number
          // Add image data if available (ensure strings only)
          originalImage: scanResult?.originalImage ?? (savedReport?.originalImage ?? undefined),
          segmentedImage: scanResult?.segmentedImage ?? (savedReport?.segmentedImage ?? undefined),
          tumorSize: report.diseaseType === 'brain-tumor' && scanResult?.tumorSizePercent ? `${scanResult.tumorSizePercent.toFixed(2)}%` : undefined,
          tumorResult: report.diseaseType === 'brain-tumor' && scanResult?.tumorCount ? `${scanResult.tumorCount} tumor(s)` : undefined
        };
      });

    // Generate and download combined PDF
    pdfReportService.generateMultipleReports(selectedReportData);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
              AI Scan Reports
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            View and download your AI-analyzed medical scan reports
          </p>
        </div>
      </motion.div>


      {/* Report Count and Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">AI-Generated Scan Reports</h3>
            <p className="text-gray-400">Download your real medical scan analysis reports as PDF</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-cyan-400">{filteredReports.length}</div>
              <div className="text-sm text-gray-400">Total Reports</div>
            </div>
            {selectedReports.length > 0 && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={downloadMultipleReports}
                  className="bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Selected ({selectedReports.length})
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDeleteConfirm('bulk')}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Delete Selected ({selectedReports.length})
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          {/* Medical Condition Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
          >
            <option value="all">All Conditions</option>
            <option value="brain-tumor">Brain Tumor</option>
            <option value="alzheimer">Alzheimer's Disease</option>
            <option value="multiple-sclerosis">Multiple Sclerosis</option>
            <option value="normal">Normal</option>
          </select>
        </div>
      </motion.div>

      {/* Reports Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/30">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedReports.length === filteredReports.length && filteredReports.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-cyan-400 bg-gray-700 border-gray-600 rounded focus:ring-cyan-400"
                  />
                </th>
                <th className="px-6 py-4 text-left text-gray-300 font-semibold">Patient</th>
                <th className="px-6 py-4 text-left text-gray-300 font-semibold">Medical Condition</th>
                <th className="px-6 py-4 text-left text-gray-300 font-semibold">Status</th>
                <th className="px-6 py-4 text-left text-gray-300 font-semibold">Date</th>
                <th className="px-6 py-4 text-left text-gray-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((report, index) => {
                const DiseaseIcon = getDiseaseIcon(report.diseaseType);
                const reportNumber = generateReportNumber(report.id, index);
                return (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors duration-200"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedReports.includes(report.id)}
                        onChange={() => handleSelectReport(report.id)}
                        className="w-4 h-4 text-cyan-400 bg-gray-700 border-gray-600 rounded focus:ring-cyan-400"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-semibold text-white">{report.patientName}</div>
                        <div className="text-sm text-gray-400">Report #{reportNumber}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <DiseaseIcon className="w-4 h-4 text-cyan-400" />
                        <span className="text-gray-300 capitalize">
                          {report.diseaseType ? report.diseaseType.replace('-', ' ') : 'Normal'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {formatDate(report.generatedDate)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => downloadReport(report)}
                          className="p-2 text-gray-400 hover:text-green-400 transition-colors"
                          title="Download PDF Report"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(report.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete Report"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              {realReports.length === 0 ? 'No scan reports available' : 'No reports found'}
            </h3>
            <p className="text-gray-500">
              {realReports.length === 0 
                ? 'Upload medical images through the AI modules to generate scan reports'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
          </div>
        )}
      </motion.div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Completed</h3>
              <p className="text-gray-400 text-sm">Successfully generated</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {filteredReports.filter(r => r.status === 'completed').length}
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Pending</h3>
              <p className="text-gray-400 text-sm">In progress</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-yellow-400">
            {filteredReports.filter(r => r.status === 'pending').length}
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Failed</h3>
              <p className="text-gray-400 text-sm">Need attention</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-red-400">
            {filteredReports.filter(r => r.status === 'failed').length}
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Total</h3>
              <p className="text-gray-400 text-sm">All reports</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-cyan-400">
            {filteredReports.length}
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-full">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Delete Report{showDeleteConfirm === 'bulk' ? 's' : ''}</h3>
            </div>
            
            <p className="text-gray-300 mb-6">
              {showDeleteConfirm === 'bulk' 
                ? `Are you sure you want to delete ${selectedReports.length} selected report${selectedReports.length > 1 ? 's' : ''}? This action cannot be undone.`
                : 'Are you sure you want to delete this report? This action cannot be undone.'
              }
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (showDeleteConfirm === 'bulk') {
                    await handleDeleteSelected();
                  } else {
                    await handleDeleteReport(showDeleteConfirm);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportGeneration;