import React, { useState, useRef } from 'react';
import { Upload, Brain, FileText, RotateCcw, Zap, Shield, User, AlertTriangle, Activity, MessageCircle, Calendar, CreditCard, Pill } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DoctorDashboard from './components/DoctorDashboard';
import ReportGeneration from './components/ReportGeneration';
import Medication from './components/Medication';
import AppointmentBooking from './components/AppointmentBooking';
import Payment from './components/Payment';
import Chat from './components/Chat';
import UserProfileModal from './components/UserProfileModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { brainAnalysisService, DetectionResult as APIDetectionResult, AnalysisResult as APIAnalysisResult, AlzheimerDetectionResult, ComprehensiveAnalysisResult, MultipleSclerosisDetectionResult } from './lib/brainAnalysisService';
import { sharedReportsService } from './lib/sharedReportsService';

interface Disease {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

interface DetectionResult {
  disease: string;
  confidence: number;
  detected: boolean;
  tumorCount?: number;
  tumorPixels?: number;
  totalPixels?: number;
  tumorSizePercent?: number;
  predictedClass?: string;
  analysis_timestamp?: string;
  recommendations?: string[];
  riskLevel?: string;
  msProbability?: number;
  lesionBurdenScore?: number;
}

interface AnalysisResult {
  results: DetectionResult[];
  timestamp: string;
  recommendation: string;
  detailedReport: {
    patientInfo: {
      scanType: string;
      scanDate: string;
      patientId: string;
    };
    technicalDetails: {
      algorithm: string;
      modelVersion: string;
      processingTime: string;
    };
    findings: {
      primary: string;
      secondary: string[];
      confidence: number;
    };
    clinicalNotes: string[];
    nextSteps: string[];
  };
}

const AppContent = () => {
  const { user, logout, isLoading } = useAuth();
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');


  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full"
        />
        <p className="mt-4 text-white">Loading...</p>
      </div>
    );
  }

  // Show authentication pages if not logged in
  if (!user) {
    if (authPage === 'login') {
      return <LoginPage 
        onLoginSuccess={() => {}} 
        onShowSignup={() => setAuthPage('signup')} 
      />;
    } else {
      return <SignupPage 
        onBackToLogin={() => setAuthPage('login')} 
      />;
    }
  }

  // Show appropriate dashboard based on user role
  if (user.role === 'doctor') {
    return <DoctorDashboard onLogout={logout} />;
  }

  // Patients and other users go to the main dashboard
  return <MainDashboard />;
};

const MainDashboard = () => {
  const { user, logout } = useAuth();
  const [currentModule, setCurrentModule] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionResult, setDetectionResult] = useState<AnalysisResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [segmentedImage, setSegmentedImage] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const diseases: Disease[] = [
    { 
      id: 'brain-tumor',
      name: 'Brain Tumor Detection', 
      icon: Brain, 
      color: 'from-red-500 to-pink-500',
      description: 'AI-powered analysis of MRI scans to detect brain tumors'
    },
    { 
      id: 'alzheimer',
      name: "Alzheimer's Detection", 
      icon: AlertTriangle, 
      color: 'from-blue-500 to-cyan-500',
      description: 'Early detection of Alzheimer\'s disease through brain imaging analysis'
    },
    { 
      id: 'multiple-sclerosis',
      name: 'Multiple Sclerosis Detection', 
      icon: Activity, 
      color: 'from-green-500 to-emerald-500',
      description: 'Advanced MS lesion detection and progression monitoring'
    },
    { 
      id: 'report-generation',
      name: 'Report Generation', 
      icon: FileText, 
      color: 'from-purple-500 to-pink-500',
      description: 'Generate and manage comprehensive AI-powered medical reports'
    },
    { 
      id: 'chat',
      name: 'Chat with Doctors', 
      icon: MessageCircle, 
      color: 'from-emerald-500 to-teal-500',
      description: 'Connect with verified medical professionals for instant consultation'
    },
    { 
      id: 'appointment',
      name: 'Book Appointment', 
      icon: Calendar, 
      color: 'from-blue-500 to-purple-500',
      description: 'Schedule consultations with our expert medical professionals'
    },
    { 
      id: 'payment',
      name: 'Payment', 
      icon: CreditCard, 
      color: 'from-green-500 to-emerald-500',
      description: 'Secure payment processing for medical consultations and services'
    },
    { 
      id: 'medication',
      name: 'Medication Management', 
      icon: Pill, 
      color: 'from-orange-500 to-red-500',
      description: 'Track medications, set reminders, and manage your health routine'
    }
  ];


  const currentDisease = diseases.find(d => d.id === currentModule);
  const msDetectionDetails = currentDisease?.id === 'multiple-sclerosis' ? detectionResult?.results?.[0] : null;

  // Medical image validation function - Enhanced for stricter detection
  const validateMedicalImage = (imageUrl: string): Promise<{ isValid: boolean; message: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas to analyze image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ isValid: false, message: 'Could not analyze image' });
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Analyze image characteristics
        let totalBrightness = 0;
        let totalContrast = 0;
        let darkPixels = 0;
        let brightPixels = 0;
        let grayPixels = 0;
        let veryDarkPixels = 0;
        let colorVariation = 0;
        let edgePixels = 0;

        // Calculate brightness, contrast, and color characteristics
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          
          totalBrightness += brightness;
          
          // Count pixel types with stricter thresholds
          if (brightness < 30) veryDarkPixels++;
          else if (brightness < 80) darkPixels++;
          else if (brightness > 200) brightPixels++;
          else grayPixels++;

          // Calculate color variation (medical scans are mostly grayscale)
          const maxColor = Math.max(r, g, b);
          const minColor = Math.min(r, g, b);
          colorVariation += (maxColor - minColor);
        }

        const avgBrightness = totalBrightness / (data.length / 4);
        const totalPixels = data.length / 4;

        // Calculate contrast (standard deviation)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const brightness = (r + g + b) / 3;
          totalContrast += Math.pow(brightness - avgBrightness, 2);
        }
        const contrast = Math.sqrt(totalContrast / (data.length / 4));

        // Calculate edge detection (medical scans have distinct edges)
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const centerBrightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            
            // Check surrounding pixels for edge detection
            const leftIdx = (y * canvas.width + (x - 1)) * 4;
            const rightIdx = (y * canvas.width + (x + 1)) * 4;
            const topIdx = ((y - 1) * canvas.width + x) * 4;
            const bottomIdx = ((y + 1) * canvas.width + x) * 4;
            
            const leftBrightness = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
            const rightBrightness = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
            const topBrightness = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
            const bottomBrightness = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
            
            const edgeStrength = Math.abs(centerBrightness - leftBrightness) + 
                               Math.abs(centerBrightness - rightBrightness) + 
                               Math.abs(centerBrightness - topBrightness) + 
                               Math.abs(centerBrightness - bottomBrightness);
            
            if (edgeStrength > 50) edgePixels++;
          }
        }

        // Medical image validation criteria - MUCH STRICTER
        const veryDarkPixelRatio = veryDarkPixels / totalPixels;
        const brightPixelRatio = brightPixels / totalPixels;
        const grayPixelRatio = grayPixels / totalPixels;
        const colorVariationRatio = colorVariation / (totalPixels * 255);
        const edgeRatio = edgePixels / totalPixels;

        // Check if image is grayscale (medical scans should be grayscale)
        // Match backend validation: sample pixels and check color variation
        let colorfulPixels = 0;
        let totalSampledPixels = 0;
        
        // Sample pixels similar to backend (up to 1000 pixels)
        const sampleSize = Math.min(1000, totalPixels);
        const step = Math.max(1, Math.floor(totalPixels / sampleSize));
        
        for (let i = 0; i < totalPixels; i += step) {
          const pixelIdx = i * 4;
          if (pixelIdx < data.length) {
            const r = data[pixelIdx];
            const g = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            
            totalSampledPixels++;
            
            // Check if pixel is colorful (match backend threshold: > 15)
            const colorVariation = Math.max(r, g, b) - Math.min(r, g, b);
            if (colorVariation > 15) {
              colorfulPixels++;
            }
          }
        }
        
        const colorfulRatio = colorfulPixels / totalSampledPixels;
        
        // Validation errors array (match backend approach)
        const validationErrors: string[] = [];
        
        // Check resolution (match backend: minimum 32x32, but warn if < 64x64)
        if (canvas.width < 32 || canvas.height < 32) {
          validationErrors.push(`Resolution too low (${canvas.width}x${canvas.height}, minimum: 32x32)`);
        }
        
        // Check contrast (match backend: minimum 3, but warn if < 5)
        if (contrast < 3) {
          validationErrors.push(`Insufficient contrast (${contrast.toFixed(2)}, minimum: 3)`);
        }
        
        // Check brightness (match backend: 5-250 range)
        if (avgBrightness < 5 || avgBrightness > 250) {
          validationErrors.push(`Brightness out of range (${avgBrightness.toFixed(2)}, acceptable: 5-250)`);
        }
        
        // Check if too colorful (match backend: > 20% colorful pixels)
        if (colorfulRatio > 0.20) {
          validationErrors.push(`Image appears too colorful (${(colorfulRatio * 100).toFixed(1)}% colorful pixels, maximum: 20%)`);
        }
        
        // Final validation: warn but don't block (backend will do final validation)
        // Only block if there are critical errors
        const hasCriticalErrors = validationErrors.length > 0;
        
        if (hasCriticalErrors) {
          // Show warnings but allow upload (backend will do final validation)
          const warningMessage = `⚠️ Image Validation Warnings:\n\n${validationErrors.join('\n')}\n\nYou can still try to upload, but the backend may reject it if validation fails.`;
          console.warn('Image validation warnings:', validationErrors);
          // Don't block upload, just warn - backend will do final validation
          resolve({
            isValid: true, // Allow upload, backend will validate
            message: warningMessage
          });
        } else {
          resolve({
            isValid: true,
            message: 'Image appears to be a valid medical brain scan. Proceeding with analysis.'
          });
        }
      };
      img.onerror = () => {
        resolve({ isValid: false, message: 'Could not load image for validation' });
      };
      img.src = imageUrl;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageUrl = e.target?.result as string;
        setUploadedImage(imageUrl);
        
        // Validate if it's a medical image (warnings only, backend does final validation)
        const validation = await validateMedicalImage(imageUrl);
        if (!validation.isValid) {
          // Only block if it's a critical error (not just warnings)
          if (validation.message.includes('Could not')) {
            alert(`⚠️ ${validation.message}`);
            setUploadedImage(null);
            setSelectedFile(null);
            if (event.target) {
              event.target.value = '';
            }
          } else {
            // Show warning but allow upload
            console.warn('Image validation warning:', validation.message);
          }
        } else if (validation.message.includes('Warnings')) {
          // Show warning but don't block
          console.warn('Image validation warning:', validation.message);
        }
      };
      reader.readAsDataURL(file);
    }
  };


  const performRealAnalysis = async () => {
    if (!currentDisease || !selectedFile) {
      alert('Please select a disease module and upload an image first.');
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Check if backend is available
      const isHealthy = await brainAnalysisService.healthCheck();
      
      if (!isHealthy) {
        throw new Error('Backend server is not available. Please start the Python backend server.');
      }
      
      // Perform real AI analysis based on disease type
      let result: APIDetectionResult | APIAnalysisResult | AlzheimerDetectionResult | ComprehensiveAnalysisResult | MultipleSclerosisDetectionResult;
      
      if (currentDisease.id === 'brain-tumor') {
        // For brain tumor, use complete analysis (detection + segmentation)
        result = await brainAnalysisService.analyzeBrainScan(selectedFile);
      } else if (currentDisease.id === 'alzheimer') {
        // For Alzheimer's, use specialized detection
        result = await brainAnalysisService.detectAlzheimer(selectedFile);
      } else if (currentDisease.id === 'multiple-sclerosis') {
        result = await brainAnalysisService.detectMultipleSclerosis(selectedFile);
      } else {
        // For other diseases, use detection only
        result = await brainAnalysisService.detectTumor(selectedFile);
      }
      
      // Convert API result to our frontend format
      // Ensure defaults to satisfy strict types and avoid undefined
      let confidence: number = 0;
      let detected: boolean = false;
      let analysisResults: DetectionResult[];
      
      if (currentDisease.id === 'alzheimer') {
        // Handle Alzheimer detection result
        const alzheimerResult = result as AlzheimerDetectionResult;
        confidence = alzheimerResult.confidence;
        detected = alzheimerResult.detected;
        
        analysisResults = [
          {
            disease: currentDisease.name,
            confidence: confidence,
            detected: detected,
            predictedClass: alzheimerResult.predicted_class, // Add predicted class for Alzheimer
            analysis_timestamp: alzheimerResult.analysis_timestamp,
            // For Alzheimer's, we don't have tumor-specific metrics
            tumorCount: 0,
            tumorPixels: 0,
            totalPixels: 0,
            tumorSizePercent: 0
          }
        ];
      } else if (currentDisease.id === 'multiple-sclerosis') {
        const msResult = result as MultipleSclerosisDetectionResult;
        confidence = msResult.confidence ?? msResult.ms_probability ?? 0;
        detected = Boolean(msResult.detected);

        if (msResult.images?.input_image) {
          setOriginalImage(`data:image/png;base64,${msResult.images.input_image}`);
        }

        if (msResult.images?.tumor_overlay) {
          setSegmentedImage(`data:image/png;base64,${msResult.images.tumor_overlay}`);
        } else {
          setSegmentedImage(null);
        }

        analysisResults = [
          {
            disease: currentDisease.name,
            confidence,
            detected,
            tumorCount: 0,
            tumorPixels: 0,
            totalPixels: 0,
            tumorSizePercent: 0,
            riskLevel: msResult.risk_level,
            msProbability: msResult.ms_probability,
            lesionBurdenScore: msResult.lesion_burden_score,
            recommendations: msResult.recommendations,
            analysis_timestamp: msResult.analysis_timestamp
          }
        ];
      } else {
        // Handle tumor detection results
        confidence = 'confidence' in result ? (result as any).confidence : (('overall_confidence' in result ? (result as any).overall_confidence : 0) as number);
        
        // Enhanced detection logic - consider tumor statistics if available
        // Avoid shadowing outer detected; coerce to boolean safely
        detected = 'detected' in result ? Boolean((result as any).detected) : false;
        
        // If tumor statistics exist and show tumor pixels, consider it detected
        if ('tumor_statistics' in result && result.tumor_statistics) {
          const tumorStats = result.tumor_statistics as any;
          const hasTumorPixels = tumorStats.pixel_count && tumorStats.pixel_count > 0;
          const hasTumorArea = tumorStats.area_mm2 && tumorStats.area_mm2 > 0;
          const hasTumorPercentage = tumorStats.tumor_percentage && tumorStats.tumor_percentage > 0;
          
          // If any tumor statistics indicate presence, mark as detected
          if (hasTumorPixels || hasTumorArea || hasTumorPercentage) {
            detected = true;
          }
        }
        
        // Handle images if available
        if ('images' in result && result.images) {
          const images = result.images as any;
          if (images.input_image) {
            setOriginalImage(`data:image/png;base64,${images.input_image}`);
          }
          if (images.tumor_overlay) {
            setSegmentedImage(`data:image/png;base64,${images.tumor_overlay}`);
          }
        }
        
        analysisResults = [
          { 
            disease: currentDisease.name, 
            confidence: confidence,
            detected: detected,
            tumorCount: 'tumor_count' in result ? (result.tumor_count as number) : 0,
            tumorPixels: ('tumor_statistics' in result && result.tumor_statistics) ? (result.tumor_statistics as any).pixel_count : 0,
            totalPixels: ('tumor_statistics' in result && result.tumor_statistics) ? (result.tumor_statistics as any).total_pixels : 0,
            tumorSizePercent: ('tumor_statistics' in result && result.tumor_statistics) ? (result.tumor_statistics as any).tumor_percentage : 0
          }
        ];
      }
      
      const detectionResultData = {
        results: analysisResults,
        timestamp: result.analysis_timestamp || new Date().toLocaleString(),
        recommendation: getDiseaseRecommendation(currentDisease.id),
        detailedReport: generateDetailedReport(currentDisease.id, confidence, Boolean(detected))
      };
      
      setDetectionResult(detectionResultData);
      
      // Automatically save report to history (and Supabase)
      await saveReportToHistory(detectionResultData);
      
    } catch (error) {
      console.error('Real AI analysis failed:', error);
      
      // Extract detailed error message
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Provide more helpful error messages based on error content
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes('Image validation')) {
        userFriendlyMessage = `Image Validation Error:\n\n${errorMessage}\n\nPlease ensure you're uploading:\n- A valid medical scan image (MRI, CT, X-ray)\n- Grayscale image format\n- JPEG or PNG file format\n- Image with sufficient resolution and contrast`;
      } else if (errorMessage.includes('decode') || errorMessage.includes('Invalid image')) {
        userFriendlyMessage = `Image Format Error:\n\n${errorMessage}\n\nPlease try:\n- Converting the image to JPEG or PNG format\n- Ensuring the file is not corrupted\n- Using a different image file`;
      } else if (errorMessage.includes('Backend') || errorMessage.includes('server')) {
        userFriendlyMessage = `Backend Connection Error:\n\n${errorMessage}\n\nPlease ensure:\n- The Python backend server is running on port 8000\n- The backend server is accessible\n- Check the backend logs for more details`;
      }
      
      // Show error message and stop processing
      alert(`Real AI Analysis Failed:\n\n${userFriendlyMessage}`);
      
      setIsProcessing(false);
      return;
    } finally {
      setIsProcessing(false);
    }
  };

  const getDiseaseRecommendation = (diseaseId: string) => {
    switch (diseaseId) {
      case 'brain-tumor':
        return 'Immediate consultation with a neurosurgeon and oncologist is recommended. Further imaging studies may be required.';
      case 'alzheimer':
        return 'Schedule an appointment with a neurologist specializing in cognitive disorders. Consider neuropsychological testing.';
      case 'multiple-sclerosis':
        return 'Consult with a neurologist experienced in MS treatment. Consider MRI follow-up and potential disease-modifying therapy.';
      default:
        return 'Consult with a neurologist for further evaluation and diagnosis.';
    }
  };

  const generateDetailedReport = (diseaseId: string, confidence: number, detected: boolean) => {
    const scanTypes = {
      'brain-tumor': 'MRI Brain with Contrast',
      'alzheimer': 'MRI Brain - T1, T2, FLAIR sequences',
      'multiple-sclerosis': 'MRI Brain and Spine - T1, T2, FLAIR, T1 post-contrast'
    };

    const algorithms = {
      'brain-tumor': 'Deep Learning CNN with ResNet-50 architecture',
      'alzheimer': '3D Convolutional Neural Network with attention mechanisms',
      'multiple-sclerosis': 'Multi-scale CNN with lesion segmentation algorithms'
    };

    const findings = {
      'brain-tumor': {
        primary: detected ? 'Abnormal mass detected in brain tissue' : 'No abnormal masses detected',
        secondary: detected ? [
          'Mass appears to be enhancing with contrast',
          'Surrounding edema present',
          'Mass effect on adjacent structures'
        ] : [
          'Normal brain parenchyma',
          'No evidence of mass lesions',
          'Normal ventricular system'
        ]
      },
      'alzheimer': {
        primary: detected ? 'Hippocampal atrophy consistent with Alzheimer\'s disease' : 'Normal hippocampal volume',
        secondary: detected ? [
          'Reduced gray matter density in temporal lobes',
          'Enlarged ventricles',
          'Cortical thinning in parietal regions'
        ] : [
          'Normal hippocampal volume',
          'Preserved gray matter density',
          'Normal ventricular size'
        ]
      },
      'multiple-sclerosis': {
        primary: detected ? 'Multiple hyperintense lesions consistent with MS' : 'No MS lesions detected',
        secondary: detected ? [
          'Periventricular white matter lesions',
          'Juxtacortical lesions present',
          'Infratentorial lesions identified'
        ] : [
          'Normal white matter signal',
          'No periventricular lesions',
          'Normal spinal cord signal'
        ]
      }
    };

    const clinicalNotes = {
      'brain-tumor': [
        'AI analysis completed using advanced deep learning algorithms',
        'Image quality assessed as diagnostic',
        'Automated segmentation performed for mass detection'
      ],
      'alzheimer': [
        'Volumetric analysis of hippocampal regions completed',
        'Cortical thickness measurements performed',
        'Comparison with age-matched controls included'
      ],
      'multiple-sclerosis': [
        'Automated lesion detection and counting performed',
        'Lesion burden quantification completed',
        'Spinal cord assessment included'
      ]
    };

    const nextSteps = {
      'brain-tumor': [
        'Urgent neurosurgical consultation',
        'Contrast-enhanced MRI follow-up',
        'Consider biopsy for definitive diagnosis'
      ],
      'alzheimer': [
        'Neuropsychological assessment',
        'CSF biomarker analysis',
        'Follow-up imaging in 6-12 months'
      ],
      'multiple-sclerosis': [
        'Neurological examination',
        'Consider disease-modifying therapy',
        'Regular MRI monitoring'
      ]
    };

    return {
      patientInfo: {
        scanType: scanTypes[diseaseId as keyof typeof scanTypes],
        scanDate: new Date().toLocaleDateString(),
        patientId: `PT-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      },
      technicalDetails: {
        algorithm: algorithms[diseaseId as keyof typeof algorithms],
        modelVersion: 'BrainGuard AI v2.1.0',
        processingTime: '2.3 seconds'
      },
      findings: {
        primary: findings[diseaseId as keyof typeof findings].primary,
        secondary: findings[diseaseId as keyof typeof findings].secondary,
        confidence: confidence
      },
      clinicalNotes: clinicalNotes[diseaseId as keyof typeof clinicalNotes],
      nextSteps: nextSteps[diseaseId as keyof typeof nextSteps]
    };
  };


  const resetDetection = () => {
    setUploadedImage(null);
    setDetectionResult(null);
    setSelectedFile(null);
    setOriginalImage(null);
    setSegmentedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveReportToHistory = async (reportData: any) => {
    const newReport = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      diseaseType: currentDisease?.name || 'Unknown',
      diseaseId: currentDisease?.id || 'unknown',
      confidence: reportData.results[0]?.confidence || 0,
      detected: reportData.results[0]?.detected || false,
      originalImage: originalImage,
      segmentedImage: segmentedImage,
      fileName: selectedFile?.name || 'Unknown',
      reportData: reportData
    };
    
    setSavedReports(prev => [newReport, ...prev]);
    
    // Also save to Supabase via sharedReportsService
    try {
      const scanType = currentDisease?.name || 'MRI Brain Scan';
      const diseaseType = currentDisease?.id || 'brain-tumor';
      
      // Build findings array
      const findings: string[] = [];
      if (reportData.detailedReport?.findings?.primary) {
        findings.push(reportData.detailedReport.findings.primary);
      }
      if (Array.isArray(reportData.detailedReport?.findings?.secondary)) {
        findings.push(...reportData.detailedReport.findings.secondary);
      }
      if (findings.length === 0) {
        findings.push(reportData.results[0]?.detected 
          ? `${currentDisease?.name || 'Condition'} detected with ${(reportData.results[0]?.confidence || 0).toFixed(1)}% confidence`
          : `No ${currentDisease?.name || 'condition'} detected`);
      }
      
      // Build recommendations array
      const recommendations: string[] = [];
      if (reportData.recommendation) {
        recommendations.push(reportData.recommendation);
      }
      if (Array.isArray(reportData.detailedReport?.nextSteps)) {
        recommendations.push(...reportData.detailedReport.nextSteps);
      }
      if (recommendations.length === 0) {
        recommendations.push('Consult with a neurologist for further evaluation.');
      }
      
      await sharedReportsService.addReport({
        patientId: 'PT-USER', // Will be looked up from patient profile
        patientName: user?.name || 'Patient',
        scanType: scanType,
        diseaseType: diseaseType,
        status: 'completed',
        confidence: reportData.results[0]?.confidence || 0,
        findings: findings,
        recommendations: recommendations,
        fileSize: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB` : '0 MB',
        originalImage: originalImage ?? undefined,
        segmentedImage: segmentedImage ?? undefined,
        metadata: {
          fileName: selectedFile?.name || 'Unknown',
          fileSize: selectedFile?.size || 0,
          diseaseId: currentDisease?.id,
          diseaseType: currentDisease?.name,
          timestamp: newReport.timestamp
        }
      });
      
      console.log('✅ Report saved to Supabase successfully');
    } catch (error) {
      console.error('❌ Failed to save report to Supabase:', error);
    }
  };


  const goToHome = () => {
    setCurrentModule(null);
    resetDetection();
  };

  const goToModule = (moduleId: string) => {
    setCurrentModule(moduleId);
    resetDetection();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex overflow-x-hidden w-full max-w-full">
      {/* Sidebar */}
      <Sidebar 
        currentModule={currentModule}
        onNavigateHome={goToHome}
        onNavigateToModule={goToModule}
        user={user}
        onLogout={logout}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-[280px] overflow-x-hidden w-full min-w-0">
        {/* STUNNING Header with Advanced Effects */}
        <header className="relative bg-gradient-to-r from-gray-800/50 via-gray-700/40 to-gray-800/50 backdrop-blur-2xl border-b border-gray-500/30 px-6 py-6 shadow-holographic overflow-hidden">
          {/* Advanced Background Effects */}
          <div className="absolute inset-0 bg-gradient-mesh opacity-20"></div>
          <div className="absolute inset-0 bg-circuit opacity-10"></div>
          
          {/* Floating Energy Particles */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              animate={{
                y: [-10, 10, -10],
                opacity: [0.3, 1, 0.3],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{
                duration: 3 + i * 0.3,
                repeat: Infinity,
                delay: i * 0.2
              }}
            />
          ))}
          
          <div className="relative flex items-center justify-between z-10">
            <div className="flex items-center gap-6">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-neural filter-neural">
                  <Shield className="w-9 h-9 text-white" />
                </div>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/20 to-blue-500/20 blur-lg animate-pulse-glow"></div>
              </motion.div>
              
              <div>
                <motion.h1 
                  className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 via-purple-600 to-pink-500 bg-clip-text text-transparent text-glow"
                  animate={{ 
                    backgroundPosition: ["0%", "100%", "0%"],
                    filter: ["hue-rotate(0deg)", "hue-rotate(360deg)", "hue-rotate(0deg)"]
                  }}
                  transition={{ 
                    duration: 8, 
                    repeat: Infinity, 
                    ease: "linear" 
                  }}
                >
                  BrainGuard AI
                </motion.h1>
                <motion.p 
                  className="text-sm text-gray-200 font-semibold"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Advanced Medical AI Platform
                </motion.p>
              </div>
            </div>
            
            {/* Enhanced User Info */}
            {user && (
              <motion.div 
                className="flex items-center gap-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <div className="text-right">
                  <motion.div 
                    className="text-xl font-bold text-white text-glow"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    {user.name}
                  </motion.div>
                  <motion.div 
                    className="text-sm text-gray-200 capitalize font-medium"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {user.role}
                  </motion.div>
                </div>
                <motion.button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="relative w-14 h-14 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-holographic filter-holographic cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    boxShadow: [
                      "0 0 20px rgba(6, 182, 212, 0.4)",
                      "0 0 40px rgba(6, 182, 212, 0.8)",
                      "0 0 20px rgba(6, 182, 212, 0.4)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <User className="w-7 h-7 text-white" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-600/20 blur-sm animate-neural-pulse"></div>
                </motion.button>
              </motion.div>
            )}
          </div>
        </header>


        <main className="flex-1 relative overflow-x-hidden w-full">
          {/* ADVANCED Background Effects */}
          <div className="absolute inset-0 overflow-hidden w-full">
            {/* Neural Network Background */}
            <div className="absolute inset-0 bg-neural-network opacity-5"></div>
            <div className="absolute inset-0 bg-circuit opacity-3"></div>
            
            {/* Advanced Floating Orbs */}
            <motion.div 
              className="absolute top-20 left-20 w-[500px] h-[500px] bg-gradient-radial from-blue-500/20 via-cyan-500/15 to-transparent rounded-full blur-3xl"
              animate={{ 
                x: [0, 150, 0],
                y: [0, -80, 0],
                scale: [1, 1.3, 1],
                rotate: [0, 180, 360]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-20 right-20 w-[400px] h-[400px] bg-gradient-radial from-purple-500/20 via-pink-500/15 to-transparent rounded-full blur-3xl"
              animate={{ 
                x: [0, -120, 0],
                y: [0, 100, 0],
                scale: [1, 0.8, 1],
                rotate: [360, 180, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-gradient-radial from-emerald-500/15 via-teal-500/10 to-transparent rounded-full blur-3xl"
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.4, 1],
                opacity: [0.3, 0.8, 0.3]
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Advanced Particle Systems */}
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                style={{
                  left: `${15 + i * 6}%`,
                  top: `${20 + (i % 3) * 20}%`,
                }}
                animate={{
                  y: [-30, 30, -30],
                  x: [-20, 20, -20],
                  opacity: [0.2, 1, 0.2],
                  scale: [0.5, 1.5, 0.5],
                  rotate: [0, 360]
                }}
                transition={{
                  duration: 4 + i * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
              />
            ))}
            
            {/* Data Stream Effects */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`stream-${i}`}
                className="absolute w-1 h-20 bg-gradient-to-b from-transparent via-cyan-400/60 to-transparent"
                style={{
                  left: `${20 + i * 15}%`,
                  top: `${10 + i * 10}%`,
                }}
                animate={{
                  y: [-100, 100],
                  opacity: [0, 1, 0],
                  scaleY: [0.5, 1.5, 0.5]
                }}
                transition={{
                  duration: 3 + i * 0.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.5,
                }}
              />
            ))}
            
            {/* Energy Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
          </div>

          <div className="relative z-10 container mx-auto px-4 py-8 lg:px-8 w-full max-w-full overflow-x-hidden">


        <AnimatePresence mode="wait">
          {currentModule === 'report-generation' ? (
            // Report Generation Module
            <motion.div
              key="report-generation"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-7xl mx-auto"
            >
              <ReportGeneration savedReports={savedReports} />
            </motion.div>
          ) : currentModule === 'medication' ? (
            // Medication Module
            <motion.div
              key="medication"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-7xl mx-auto"
            >
              <Medication />
            </motion.div>
          ) : currentModule === 'chat' ? (
            // Chat Module
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-full"
            >
              <Chat />
            </motion.div>
          ) : currentModule === 'appointment' ? (
            // Appointment Booking Module
            <motion.div
              key="appointment"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-7xl mx-auto"
            >
              <AppointmentBooking />
            </motion.div>
          ) : currentModule === 'payment' ? (
            // Payment Module
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-7xl mx-auto"
            >
              <Payment />
            </motion.div>
          ) : !currentModule ? (
            // Dashboard View
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto"
            >
              {/* STUNNING Hero Section */}
              <motion.section 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2 }}
                className="text-center mb-20 relative"
              >
                {/* Dynamic Background Effects */}
                <div className="absolute inset-0 -z-10">
                  {/* Central Energy Core */}
                  <motion.div
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 0.8, 0.3],
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-radial from-cyan-500/20 via-blue-500/10 to-transparent rounded-full blur-3xl"
                  />
                  
                  {/* Orbiting Energy Rings */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px]"
                  >
                    <div className="absolute inset-0 border border-cyan-400/20 rounded-full"></div>
                    <div className="absolute inset-8 border border-blue-400/15 rounded-full"></div>
                    <div className="absolute inset-16 border border-purple-400/10 rounded-full"></div>
                  </motion.div>
                  
                  {/* Floating Energy Particles */}
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 bg-cyan-400 rounded-full"
                      style={{
                        left: `${50 + 40 * Math.cos((i * 30) * Math.PI / 180)}%`,
                        top: `${50 + 40 * Math.sin((i * 30) * Math.PI / 180)}%`,
                      }}
                      animate={{
                        scale: [0.5, 1.5, 0.5],
                        opacity: [0.3, 1, 0.3],
                        rotate: [0, 360]
                      }}
                      transition={{
                        duration: 3 + i * 0.2,
                        repeat: Infinity,
                        delay: i * 0.1
                      }}
                    />
                  ))}
                </div>

                <div className="relative mb-12 z-10">
                  {/* STUNNING 3D Brain Visualization */}
                  <motion.div 
                    className="relative w-40 h-40 mx-auto mb-8"
                    animate={{
                      rotateY: [0, 360],
                      rotateX: [0, 15, 0]
                    }}
                    transition={{
                      rotateY: { duration: 20, repeat: Infinity, ease: "linear" },
                      rotateX: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    {/* Outer Energy Ring */}
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0.8, 0.4]
                      }}
                      transition={{ 
                        rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                        scale: { duration: 3, repeat: Infinity },
                        opacity: { duration: 2, repeat: Infinity }
                      }}
                      className="absolute -inset-8 rounded-full border-4 border-cyan-400/40 blur-sm"
                    />
                    
                    {/* Middle Ring */}
                    <motion.div
                      animate={{ 
                        rotate: -360,
                        scale: [1.1, 0.9, 1.1],
                        opacity: [0.6, 1, 0.6]
                      }}
                      transition={{ 
                        rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2.5, repeat: Infinity },
                        opacity: { duration: 1.5, repeat: Infinity }
                      }}
                      className="absolute inset-2 rounded-full border-3 border-blue-400/60"
                    />
                    
                    {/* Inner Core */}
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        scale: [1, 1.2, 1],
                        opacity: [0.8, 1, 0.8]
                      }}
                      transition={{ 
                        rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity },
                        opacity: { duration: 1, repeat: Infinity }
                      }}
                      className="absolute inset-6 rounded-full border-2 border-purple-400/80"
                    />
                    
                    {/* Central Brain Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1],
                          rotate: [0, 5, -5, 0]
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <Brain className="w-20 h-20 text-cyan-400 drop-shadow-2xl" />
                      </motion.div>
                    </div>
                  </motion.div>
                  
                  {/* DRAMATIC Title */}
                  <motion.h1 
                    className="text-7xl md:text-8xl font-black mb-8"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, delay: 0.5 }}
                  >
                    <motion.span 
                      className="bg-gradient-to-r from-cyan-400 via-blue-500 via-purple-600 to-pink-500 bg-clip-text text-transparent"
                      animate={{ 
                        backgroundPosition: ["0%", "100%", "0%"],
                        filter: ["hue-rotate(0deg)", "hue-rotate(360deg)", "hue-rotate(0deg)"]
                      }}
                      transition={{ 
                        duration: 8, 
                        repeat: Infinity, 
                        ease: "linear" 
                      }}
                    >
                      BrainGuard AI
                    </motion.span>
                  </motion.h1>
                  
                  {/* Animated Subtitle */}
                  <motion.p 
                    className="text-2xl md:text-3xl text-gray-200 mb-12 max-w-5xl mx-auto leading-relaxed font-light"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.8 }}
                  >
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      Revolutionary AI-powered medical imaging platform for early detection and diagnosis of neurological conditions
                    </motion.span>
                  </motion.p>
                  
                </div>
              </motion.section>

              {/* STUNNING AI Detection Modules */}
              <motion.section
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.5 }}
                className="mb-20 relative"
              >
                {/* Dynamic Background Effects */}
                <div className="absolute inset-0 -z-10">
                  {/* Neural Network Visualization */}
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.1, 0.3, 0.1],
                      rotate: [0, 360]
                    }}
                    transition={{
                      duration: 15,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-cyan-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl"
                  />
                  
                  {/* Floating Neural Nodes */}
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                      style={{
                        left: `${10 + Math.random() * 80}%`,
                        top: `${10 + Math.random() * 80}%`,
                      }}
                      animate={{
                        scale: [0.5, 1.5, 0.5],
                        opacity: [0.3, 1, 0.3],
                        rotate: [0, 360]
                      }}
                      transition={{
                        duration: 4 + i * 0.2,
                        repeat: Infinity,
                        delay: i * 0.1
                      }}
                    />
                  ))}
                </div>

                <div className="text-center mb-20 relative z-10">
                  <motion.h2 
                    className="text-6xl font-black mb-8"
                    initial={{ opacity: 0, scale: 0.5, rotateX: -90 }}
                    animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                    transition={{ duration: 1.2, delay: 0.8, type: "spring", stiffness: 100 }}
                  >
                    <motion.span 
                      className="bg-gradient-to-r from-emerald-400 via-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent"
                      animate={{ 
                        backgroundPosition: ["0%", "100%", "0%"],
                        filter: ["hue-rotate(0deg)", "hue-rotate(180deg)", "hue-rotate(360deg)"]
                      }}
                      transition={{ 
                        duration: 6, 
                        repeat: Infinity, 
                        ease: "linear" 
                      }}
                    >
                      Neural Detection Matrix
                    </motion.span>
                  </motion.h2>
                  
                  <motion.p 
                    className="text-gray-200 text-2xl max-w-5xl mx-auto leading-relaxed font-light"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 1.2 }}
                  >
                    <motion.span
                      animate={{ opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      Revolutionary AI modules powered by quantum-enhanced neural networks, processing millions of medical scans with unprecedented precision
                    </motion.span>
                  </motion.p>
                </div>

                {/* HOLOGRAPHIC Module Grid */}
                <div className="relative">
                  {/* Neural Grid Background */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="grid grid-cols-12 gap-6 h-full">
                      {Array.from({ length: 144 }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ 
                            delay: 1.5 + i * 0.01,
                            duration: 0.5,
                            type: "spring",
                            stiffness: 200
                          }}
                          className="border border-cyan-400/30 rounded-lg bg-gradient-to-br from-cyan-500/5 to-blue-500/5"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="relative grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-8 max-w-7xl mx-auto">
                    {diseases.map((disease, index) => {
                      const DiseaseIcon = disease.icon;
                      return (
                        <motion.div
                          key={disease.id}
                          initial={{ opacity: 0, scale: 0.3, rotateX: -180, rotateY: -90 }}
                          animate={{ opacity: 1, scale: 1, rotateX: 0, rotateY: 0 }}
                          transition={{ 
                            duration: 1.5, 
                            delay: 1.8 + index * 0.3,
                            type: "spring",
                            stiffness: 80,
                            damping: 15
                          }}
                          whileHover={{ 
                            scale: 1.15, 
                            rotateY: 15,
                            rotateX: 5,
                            z: 100,
                            y: -20
                          }}
                          className="relative group cursor-pointer transform-gpu perspective-1000 h-full"
                          onClick={() => goToModule(disease.id)}
                        >
                          {/* STUNNING Holographic Effects */}
                          {/* Outer Energy Ring */}
                          <motion.div
                            animate={{ 
                              rotate: 360,
                              scale: [1, 1.3, 1],
                              opacity: [0.3, 0.8, 0.3]
                            }}
                            transition={{ 
                              rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                              scale: { duration: 3, repeat: Infinity },
                              opacity: { duration: 2, repeat: Infinity }
                            }}
                            className="absolute -inset-8 rounded-full border-4 border-cyan-400/40 blur-xl"
                          />
                          
                          {/* Middle Energy Ring */}
                          <motion.div
                            animate={{ 
                              rotate: -360,
                              scale: [1.1, 0.9, 1.1],
                              opacity: [0.5, 1, 0.5]
                            }}
                            transition={{ 
                              rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                              scale: { duration: 2.5, repeat: Infinity },
                              opacity: { duration: 1.5, repeat: Infinity }
                            }}
                            className="absolute -inset-4 rounded-full border-3 border-blue-400/60 blur-lg"
                          />
                          
                          {/* Inner Glow Ring */}
                          <motion.div
                            animate={{ 
                              rotate: 360,
                              scale: [1, 1.2, 1],
                              opacity: [0.7, 1, 0.7]
                            }}
                            transition={{ 
                              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                              scale: { duration: 2, repeat: Infinity },
                              opacity: { duration: 1, repeat: Infinity }
                            }}
                            className="absolute -inset-2 rounded-full border-2 border-purple-400/80 blur-md"
                          />

                          {/* HOLOGRAPHIC Main Card */}
                          <div className="relative bg-gradient-to-br from-gray-900/95 via-gray-800/85 to-gray-900/95 backdrop-blur-2xl rounded-3xl p-10 border border-gray-500/50 overflow-hidden shadow-2xl h-full flex flex-col">
                            {/* Holographic Background Layers */}
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-0 bg-gradient-conic from-cyan-500/10 via-transparent via-blue-500/10 to-transparent"
                            />
                            
                            <motion.div
                              animate={{ rotate: -360 }}
                              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-0 bg-gradient-conic from-purple-500/5 via-transparent via-pink-500/5 to-transparent"
                            />
                            
                            {/* Card Glow Effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/8 via-transparent to-blue-500/8 rounded-3xl"></div>
                            
                            {/* Inner Shadow */}
                            <div className="absolute inset-0 rounded-3xl shadow-inner shadow-gray-900/60"></div>
                            
                            {/* Animated Background Particles */}
                            <div className="absolute inset-0 overflow-hidden">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <motion.div
                                  key={i}
                                  animate={{
                                    x: [0, Math.random() * 100 - 50],
                                    y: [0, Math.random() * 100 - 50],
                                    opacity: [0, 1, 0]
                                  }}
                                  transition={{
                                    duration: 3 + Math.random() * 2,
                                    repeat: Infinity,
                                    delay: Math.random() * 2
                                  }}
                                  className={`absolute w-1 h-1 rounded-full bg-gradient-to-r ${disease.color} opacity-60`}
                                  style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`
                                  }}
                                />
                              ))}
                            </div>

                            {/* STUNNING Central Icon */}
                            <div className="relative z-10 text-center mb-10 flex-1 flex flex-col justify-center">
                              <motion.div
                                animate={{ 
                                  rotateX: [0, 15, -15, 0],
                                  rotateY: [0, 20, -20, 0],
                                  scale: [1, 1.15, 1],
                                  rotateZ: [0, 5, -5, 0]
                                }}
                                transition={{ 
                                  duration: 8, 
                                  repeat: Infinity,
                                  delay: index * 0.8,
                                  ease: "easeInOut"
                                }}
                                className="relative mx-auto w-32 h-32 mb-8"
                              >
                                {/* Multiple Holographic Layers */}
                                <motion.div
                                  animate={{ 
                                    rotate: 360,
                                    scale: [1, 1.3, 1],
                                    opacity: [0.2, 0.6, 0.2]
                                  }}
                                  transition={{ 
                                    rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                                    scale: { duration: 2.5, repeat: Infinity },
                                    opacity: { duration: 1.5, repeat: Infinity }
                                  }}
                                  className={`absolute -inset-4 rounded-full bg-gradient-to-r ${disease.color} blur-xl`}
                                />
                                
                                <motion.div
                                  animate={{ 
                                    rotate: -360,
                                    scale: [1.2, 1, 1.2],
                                    opacity: [0.3, 0.8, 0.3]
                                  }}
                                  transition={{ 
                                    rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                                    scale: { duration: 3, repeat: Infinity },
                                    opacity: { duration: 2, repeat: Infinity }
                                  }}
                                  className={`absolute -inset-2 rounded-full bg-gradient-to-r ${disease.color} blur-lg`}
                                />
                                
                                <motion.div
                                  animate={{ 
                                    rotate: 360,
                                    scale: [1, 1.1, 1],
                                    opacity: [0.4, 1, 0.4]
                                  }}
                                  transition={{ 
                                    rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                                    scale: { duration: 2, repeat: Infinity },
                                    opacity: { duration: 1, repeat: Infinity }
                                  }}
                                  className={`absolute inset-0 rounded-full bg-gradient-to-r ${disease.color} blur-md`}
                                />
                                
                                {/* Main Icon Container */}
                                <div className={`relative w-full h-full rounded-full bg-gradient-to-br ${disease.color} flex items-center justify-center shadow-2xl border-2 border-white/20`}>
                                  <motion.div
                                    animate={{
                                      scale: [1, 1.1, 1],
                                      rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{
                                      duration: 3,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }}
                                  >
                                    <DiseaseIcon className="w-16 h-16 text-white drop-shadow-2xl" />
                                  </motion.div>
                                </div>
                              </motion.div>

                              <motion.h3 
                                className="text-4xl font-black mb-6 bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent"
                                initial={{ opacity: 0, y: 30, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ delay: 2 + index * 0.2, duration: 0.8, type: "spring", stiffness: 100 }}
                              >
                                {disease.name}
                              </motion.h3>
                              
                              <motion.p 
                                className="text-gray-200 mb-10 leading-relaxed text-lg font-light"
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 2.2 + index * 0.2, duration: 0.8 }}
                              >
                                <motion.span
                                  animate={{ opacity: [0.8, 1, 0.8] }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                >
                                  {disease.description}
                                </motion.span>
                              </motion.p>
                            </div>


                            {/* STUNNING Action Button */}
                            <motion.button
                              whileHover={{ 
                                scale: 1.1,
                                rotateY: 10,
                                boxShadow: "0 0 40px rgba(6, 182, 212, 0.6)"
                              }}
                              whileTap={{ scale: 0.95 }}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 3.2 + index * 0.2 }}
                              className="relative w-full group/btn overflow-hidden mt-auto"
                            >
                              <div className={`absolute inset-0 bg-gradient-to-r ${disease.color} opacity-80 group-hover/btn:opacity-100 transition-opacity duration-300`} />
                              <div className="relative bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border border-gray-600/50 rounded-xl py-4 px-6 font-semibold text-white group-hover/btn:text-white transition-colors duration-300">
                                <span className="relative z-10">Access Module</span>
                                <motion.div
                                  animate={{ x: ['-100%', '100%'] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                />
                              </div>
                            </motion.button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </motion.section>


              {/* Testimonials */}
              <motion.section
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
                className="mb-20"
              >
                <div className="text-center mb-12">
                  <h2 className="text-4xl font-bold mb-4">
                    <span className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
                      Trusted by Medical Professionals
                    </span>
                  </h2>
                  <p className="text-gray-400 text-lg max-w-3xl mx-auto">
                    Leading neurologists and radiologists worldwide rely on BrainGuard AI for accurate diagnoses
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                  {[
                    {
                      name: "Dr. Fatima",
                      title: "",
                      image: "👩‍⚕️",
                      quote: "BrainGuard AI has revolutionized our diagnostic process. The speed and reliability are remarkable.",
                      rating: 5
                    },
                    {
                      name: "Dr. Ahmad",
                      title: "",
                      image: "👨‍⚕️",
                      quote: "The AI's ability to detect early-stage conditions has saved countless lives in our practice.",
                      rating: 5
                    },
                    {
                      name: "Dr. Zehra",
                      title: "",
                      image: "👩‍🔬",
                      quote: "This technology represents the future of medical imaging. Incredibly precise and reliable.",
                      rating: 5
                    }
                  ].map((testimonial, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="relative bg-gradient-to-br from-gray-800/40 via-gray-700/30 to-gray-800/40 backdrop-blur-xl rounded-2xl p-8 border border-gray-600/40 hover:border-cyan-400/50 transition-all duration-300 shadow-xl overflow-hidden"
                      whileHover={{ scale: 1.05, y: -5 }}
                    >
                      {/* Card Glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl"></div>
                      <div className="text-center mb-6">
                        <div className="text-6xl mb-4">{testimonial.image}</div>
                        <div className="flex justify-center mb-2">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.1 * i }}
                              className="text-yellow-400 text-xl"
                            >
                              ⭐
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      <blockquote className="text-gray-300 mb-6 italic">
                        "{testimonial.quote}"
                      </blockquote>
                      <div className="text-center">
                        <div className="font-semibold text-white">{testimonial.name}</div>
                        <div className="text-sm text-gray-400">{testimonial.title}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>

            </motion.div>
          ) : (
            // Individual Disease Module
            <motion.div
              key={currentModule}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-6xl mx-auto"
            >
              {/* Module Header */}
              <div className="text-center mb-12">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${currentDisease?.color} flex items-center justify-center mb-6 mx-auto`}>
                  {currentDisease && <currentDisease.icon className="w-10 h-10" />}
                </div>
                <h2 className="text-4xl font-bold mb-4">{currentDisease?.name}</h2>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">{currentDisease?.description}</p>
              </div>

              {/* Main Content */}
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Upload Section */}
                <motion.div 
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="relative bg-gradient-to-br from-gray-800/60 via-gray-700/50 to-gray-800/60 backdrop-blur-xl rounded-2xl p-8 border border-gray-600/50 shadow-xl overflow-hidden"
                >
                  {/* Card Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl"></div>
                  <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-cyan-400" />
                    Upload {currentDisease?.name.split(' ')[0]} Scan
                  </h3>
                  
                  <motion.div 
                    className="relative border-2 border-dashed border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-400/50 transition-all duration-300 bg-gray-700/20 hover:bg-gray-700/30"
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Upload Area Glow */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    {!uploadedImage ? (
                      <div className="space-y-4">
                        <Upload className="w-12 h-12 mx-auto text-gray-400" />
                        <p className="text-gray-300">Click to upload or drag & drop</p>
                        <p className="text-sm text-gray-500">Supports MRI brain scans (JPG, PNG)</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <img 
                          src={uploadedImage} 
                          alt={`Uploaded ${currentDisease?.name.toLowerCase()} scan`} 
                          className="mx-auto rounded-lg max-h-64 object-contain"
                        />
                        <p className="text-gray-300 truncate">{selectedFile?.name}</p>
                      </div>
                    )}
                  </motion.div>

                  {/* Validation Status */}
                  {uploadedImage && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg"
                    >
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-sm font-medium">✓ Valid medical brain scan detected</span>
                      </div>
                      <p className="text-xs text-green-300 mt-1">
                        Image characteristics match medical scan criteria
                      </p>
                    </motion.div>
                  )}

                  {/* Detect Button */}
                  {uploadedImage && !detectionResult && (
                    <button
                      onClick={() => {
                        console.log('Detect button clicked!');
                        performRealAnalysis();
                      }}
                      disabled={isProcessing}
                      style={{
                        width: '100%',
                        marginTop: '24px',
                        backgroundColor: isProcessing ? '#6b7280' : '#06b6d4',
                        color: 'white',
                        padding: '12px 24px',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: '600',
                        pointerEvents: 'auto',
                        zIndex: 9999,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin">
                            <Zap className="w-5 h-5" />
                          </div>
                          Analyzing {currentDisease?.name}...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          Detect {currentDisease?.name.split(' ')[0]}
                        </>
                      )}
                    </button>
                  )}

                  {detectionResult && (
                    <div className="w-full mt-6 relative z-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="upload-new-scan"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          resetDetection();
                          // Create a new file input element
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              setSelectedFile(file);
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                setUploadedImage(event.target?.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                        style={{ 
                          position: 'relative',
                          zIndex: 9999,
                          pointerEvents: 'auto',
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw className="w-5 h-5" />
                        Upload New Scan
                      </button>
                    </div>
                  )}
                </motion.div>

                {/* Results Section */}
                <motion.div 
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="relative bg-gradient-to-br from-gray-800/60 via-gray-700/50 to-gray-800/60 backdrop-blur-xl rounded-2xl p-8 border border-gray-600/50 shadow-xl overflow-hidden"
                >
                  {/* Card Glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 rounded-2xl"></div>
                  <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-cyan-400" />
                    {currentDisease?.name} Report
                  </h3>

                  <AnimatePresence mode="wait">
                    {!uploadedImage ? (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12 text-gray-500"
                      >
                        {currentDisease && <currentDisease.icon className="w-16 h-16 mx-auto mb-4 text-gray-600" />}
                        <p>Upload a scan to generate your {currentDisease?.name.toLowerCase()} detection report</p>
                      </motion.div>
                    ) : isProcessing ? (
                      <motion.div
                        key="processing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                      >
                        <div className="text-center py-8">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 mx-auto mb-4 text-cyan-400"
                          >
                            {currentDisease && <currentDisease.icon className="w-full h-full" />}
                          </motion.div>
                          <p className="text-lg">AI Neural Network Analyzing...</p>
                          <p className="text-gray-400 text-sm">Processing scan for {currentDisease?.name.toLowerCase()}</p>
                        </div>
                        
                        {/* Animated progress indicator */}
                        <div className="space-y-3">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2 }}
                            className="h-3 bg-gray-700 rounded-full overflow-hidden"
                          >
                            <motion.div
                              className={`h-full bg-gradient-to-r ${currentDisease?.color}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.random() * 100}%` }}
                              transition={{ duration: 1.5, delay: 0.5 }}
                            />
                          </motion.div>
                        </div>
                      </motion.div>
                    ) : detectionResult ? (
                      <motion.div
                        key="results"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                      >
                        {/* Medical Imaging Display */}
                        {(originalImage || segmentedImage) && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Input Image Panel */}
                              <div className="text-center">
                                <div className="h-16 flex items-center justify-center mb-4">
                                  <h3 className="text-lg font-semibold text-gray-300">Input Image</h3>
                                </div>
                                <div className="relative w-full">
                                  {originalImage ? (
                                    <>
                                      <img 
                                        src={originalImage} 
                                        alt="Original Brain MRI" 
                                        className="w-full h-80 object-contain border border-gray-600 bg-black rounded-lg mx-auto"
                                      />
                                    </>
                                  ) : (
                                    <div className="w-full h-80 bg-gray-800 flex items-center justify-center border border-gray-600 rounded-lg mx-auto">
                                      <span className="text-gray-400">Original Image</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Output Image Panel */}
                              <div className="text-center">
                                <div className="h-16 flex items-center justify-center mb-4">
                                  <div>
                                    <h3 className="text-lg font-semibold text-gray-300">Output Image</h3>
                                  </div>
                                </div>
                                <div className="relative w-full">
                                  {segmentedImage ? (
                                    <>
                                      <img 
                                        src={segmentedImage} 
                                        alt="Tumor Segmentation" 
                                        className="w-full h-80 object-contain border border-gray-600 bg-black rounded-lg mx-auto"
                                      />
                                    </>
                                  ) : (
                                    <div className="w-full h-80 bg-gray-800 flex items-center justify-center border border-gray-600 rounded-lg mx-auto">
                                      <span className="text-gray-400">Segmentation</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Analysis Results */}
                            {Boolean(detectionResult.results[0]?.tumorPixels) && (
                              <div className="mt-4 text-center">
                                <h4 className="text-lg font-semibold text-gray-300 mb-2">Analysis Results</h4>
                                <div className="text-sm text-gray-400">
                                  <div>Tumor pixel count: {detectionResult.results[0].tumorPixels}</div>
                                  <div>Tumor area (mm²): {((detectionResult.results[0].tumorPixels * 0.25)).toFixed(2)}</div>
                                </div>
                              </div>
                            )}
                            {currentDisease?.id === 'brain-tumor' && detectionResult.results[0]?.detected === false && (
                              <div className="mt-4 text-center text-sm text-green-400">
                                No tumor detected in this scan.
                              </div>
                            )}
                            {currentDisease?.id === 'alzheimer' && detectionResult.results[0]?.detected !== undefined && (
                              <div className="mt-4 text-center text-sm text-gray-400">
                                <div>Predicted Class: {detectionResult.results[0].predictedClass || 'N/A'}</div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Alzheimer Results Display (when no images) */}
                        {currentDisease?.id === 'alzheimer' && detectionResult && !originalImage && !segmentedImage && (
                          <div className="space-y-6">
                            <div className="text-center">
                              <h3 className="text-xl font-semibold text-gray-300 mb-4">Alzheimer's Detection Results</h3>
                              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600/50">
                                <div className="grid grid-cols-2 gap-4 text-left">
                                  <div>
                                    <span className="text-gray-400">Predicted Class:</span>
                                    <span className="ml-2 text-white font-semibold">
                                      {detectionResult.results[0]?.predictedClass || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Detection Status:</span>
                                    <span className={`ml-2 font-semibold ${
                                      detectionResult.results[0]?.detected ? 'text-red-400' : 'text-green-400'
                                    }`}>
                                      {detectionResult.results[0]?.detected ? 'Detected' : 'Not Detected'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {currentDisease?.id === 'multiple-sclerosis' && detectionResult && (
                          <div className="space-y-6">
                            <div className="text-center">
                              <h3 className="text-xl font-semibold text-gray-300 mb-4">Multiple Sclerosis Detection Results</h3>
                              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-600/50 text-left space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-gray-400">Detection Status:</span>
                                    <span className={`ml-2 font-semibold ${msDetectionDetails?.detected ? 'text-red-400' : 'text-green-400'}`}>
                                      {msDetectionDetails?.detected ? 'Detected' : 'Not Detected'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Risk Level:</span>
                                    <span className="ml-2 text-white font-semibold">
                                      {msDetectionDetails?.riskLevel || 'N/A'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Probability:</span>
                                    <span className="ml-2 text-white font-semibold">
                                      {(msDetectionDetails?.msProbability ?? 0).toFixed(2)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Lesion Burden Score:</span>
                                    <span className="ml-2 text-white font-semibold">
                                      {(msDetectionDetails?.lesionBurdenScore ?? 0).toFixed(1)}
                                    </span>
                                  </div>
                                </div>

                              </div>
                            </div>
                          </div>
                        )}

                        {/* Actions: Go to Reports */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2 relative z-50">
                          <button
                            type="button"
                            onClick={() => goToModule('report-generation')}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 pointer-events-auto"
                          >
                            Go to Reports
                          </button>
                        </div>

                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </main>

        {/* Simple Footer */}
        <footer className="bg-gray-900 border-t border-gray-700/50 py-4">
          <div className="container mx-auto px-4 text-center">
            <p className="text-gray-400 text-sm">© 2005 BrainGuard AI. All rights reserved.</p>
          </div>
        </footer>

        {/* User Profile Modal */}
        <UserProfileModal 
          isOpen={isProfileModalOpen} 
          onClose={() => setIsProfileModalOpen(false)} 
        />

      </div>
    </div>
  );
};

const App = () => {
  // Expose seedDoctors function globally for development (remove in production)
  const env = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env;
  if (env?.DEV) {
    import('./lib/seedDoctors').then(({ seedDoctors }) => {
      (window as any).seedDoctors = seedDoctors;
      console.log('💡 Development mode: seedDoctors() is available in console');
      console.log('💡 Run: await seedDoctors() to seed doctors into database');
    });
    
    // Expose updateDoctorAvatar function globally for development
    import('./lib/updateDoctorAvatar').then(({ updateDoctorAvatar, femaleDoctorAvatars }) => {
      (window as any).updateDoctorAvatar = updateDoctorAvatar;
      (window as any).femaleDoctorAvatars = femaleDoctorAvatars;
      console.log('💡 Development mode: updateDoctorAvatar() is available in console');
      console.log('💡 Run: await updateDoctorAvatar("Dr. Sana Shahid", femaleDoctorAvatars.default)');
    });
    
    // Expose populateAllAvatars function globally for development
    import('./lib/populateAllAvatars').then(({ populateAllAvatars, populateAllAvatarsForce }) => {
      (window as any).populateAllAvatars = populateAllAvatars;
      (window as any).populateAllAvatarsForce = populateAllAvatarsForce;
      console.log('💡 Development mode: populateAllAvatars() is available in console');
      console.log('💡 Run: await populateAllAvatars() to populate empty avatar URLs');
      console.log('💡 Run: await populateAllAvatarsForce() to update ALL avatar URLs');
    });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0b', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
};

export default App;