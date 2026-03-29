import jsPDF from 'jspdf';

export interface PDFReportData {
  patientName: string;
  patientId: string;
  reportType: string;
  scanType?: string;
  diseaseType?: string;
  generatedDate: string;
  confidence?: number;
  findings: string[];
  recommendations: string[];
  fileSize: string;
  adherenceRate?: number;
  totalDoses?: number;
  missedDoses?: number;
  period?: string;
  reportNumber?: string;
  // Image support
  originalImage?: string; // base64 encoded
  segmentedImage?: string; // base64 encoded
  tumorSize?: string;
  tumorResult?: string;
}

class PDFReportService {
  private addHeader(doc: jsPDF, reportData: PDFReportData) {
    // Logo and title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BrainGuard Medical Report', 20, 30);
    
    // Subtitle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('AI-Powered Medical Analysis System', 20, 40);
    
    // Line separator
    doc.setDrawColor(0, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);
  }

  private addPatientInfo(doc: jsPDF, reportData: PDFReportData, yPosition: number) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Patient Information', 20, yPosition);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${reportData.patientName}`, 20, yPosition + 10);
    doc.text(`Patient ID: ${reportData.patientId}`, 20, yPosition + 18);
    doc.text(`Report Type: ${reportData.reportType.replace('-', ' ').toUpperCase()}`, 20, yPosition + 26);
    doc.text(`Generated Date: ${new Date(reportData.generatedDate).toLocaleDateString()}`, 20, yPosition + 34);
    
    if (reportData.scanType) {
      doc.text(`Scan Type: ${reportData.scanType}`, 20, yPosition + 42);
    }
    
    if (reportData.confidence) {
      doc.text(`Confidence Score: ${reportData.confidence}%`, 20, yPosition + 50);
    }
    
    return yPosition + 58;
  }

  private addFindings(doc: jsPDF, reportData: PDFReportData, yPosition: number) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Key Findings', 20, yPosition);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let currentY = yPosition + 10;
    reportData.findings.forEach((finding, index) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.text(`• ${finding}`, 25, currentY);
      currentY += 8;
    });
    
    return currentY + 10;
  }

  private addRecommendations(doc: jsPDF, reportData: PDFReportData, yPosition: number) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommendations', 20, yPosition);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let currentY = yPosition + 10;
    reportData.recommendations.forEach((recommendation, index) => {
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.text(`• ${recommendation}`, 25, currentY);
      currentY += 8;
    });
    
    return currentY + 10;
  }

  private addMedicationData(doc: jsPDF, reportData: PDFReportData, yPosition: number) {
    if (!reportData.adherenceRate && !reportData.totalDoses) return yPosition;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Medication Data', 20, yPosition);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let currentY = yPosition + 10;
    
    if (reportData.adherenceRate !== undefined) {
      doc.text(`Adherence Rate: ${reportData.adherenceRate}%`, 20, currentY);
      currentY += 8;
    }
    
    if (reportData.totalDoses !== undefined) {
      doc.text(`Total Doses: ${reportData.totalDoses}`, 20, currentY);
      currentY += 8;
    }
    
    if (reportData.missedDoses !== undefined) {
      doc.text(`Missed Doses: ${reportData.missedDoses}`, 20, currentY);
      currentY += 8;
    }
    
    if (reportData.period) {
      doc.text(`Period: ${reportData.period}`, 20, currentY);
      currentY += 8;
    }
    
    return currentY + 10;
  }

  private addImages(doc: jsPDF, reportData: PDFReportData, yPosition: number) {
    if (!reportData.originalImage && !reportData.segmentedImage) return yPosition;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Scan Images', 20, yPosition);
    
    let currentY = yPosition + 10;
    
    // Add original image if available
    if (reportData.originalImage) {
      try {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Original Scan Image:', 20, currentY);
        currentY += 8;
        
        // Add image (resize to fit)
        const imgWidth = 80;
        const imgHeight = 60;
        doc.addImage(reportData.originalImage, 'PNG', 20, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      } catch (error) {
        console.error('Error adding original image to PDF:', error);
        doc.text('Original image unavailable', 20, currentY);
        currentY += 8;
      }
    }
    
    // Add segmented image if available
    if (reportData.segmentedImage) {
      try {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('AI Analysis Overlay:', 20, currentY);
        currentY += 8;
        
        // Add image (resize to fit)
        const imgWidth = 80;
        const imgHeight = 60;
        doc.addImage(reportData.segmentedImage, 'PNG', 20, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      } catch (error) {
        console.error('Error adding segmented image to PDF:', error);
        doc.text('Analysis overlay unavailable', 20, currentY);
        currentY += 8;
      }
    }
    
    return currentY + 10;
  }

  private addFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      // Footer line
      doc.setDrawColor(0, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(20, 280, 190, 280);
      
      // Footer text
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('BrainGuard Medical System - AI-Powered Healthcare Solutions', 20, 285);
      doc.text(`Page ${i} of ${pageCount}`, 170, 285);
      doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 290);
    }
  }

  generateReport(reportData: PDFReportData): void {
    const doc = new jsPDF();
    
    // Add header
    this.addHeader(doc, reportData);
    
    let currentY = 60;
    
    // Add patient information
    currentY = this.addPatientInfo(doc, reportData, currentY);
    
    // Add medication data if available
    currentY = this.addMedicationData(doc, reportData, currentY);
    
    // Add findings
    currentY = this.addFindings(doc, reportData, currentY);
    
    // Add images if available
    currentY = this.addImages(doc, reportData, currentY);
    
    // Add recommendations
    currentY = this.addRecommendations(doc, reportData, currentY);
    
    // Add footer
    this.addFooter(doc);
    
    // Generate filename
    const filename = `${reportData.patientName}_${reportData.reportType}_${new Date(reportData.generatedDate).toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
    doc.save(filename);
  }

  generateMultipleReports(reports: PDFReportData[]): void {
    if (reports.length === 0) return;
    
    if (reports.length === 1) {
      this.generateReport(reports[0]);
      return;
    }
    
    // For multiple reports, create a combined PDF
    const doc = new jsPDF();
    let isFirstPage = true;
    
    reports.forEach((reportData, index) => {
      if (!isFirstPage) {
        doc.addPage();
      }
      
      // Add header for each report
      this.addHeader(doc, reportData);
      
      let currentY = 60;
      
      // Add patient information
      currentY = this.addPatientInfo(doc, reportData, currentY);
      
      // Add medication data if available
      currentY = this.addMedicationData(doc, reportData, currentY);
      
      // Add findings
      currentY = this.addFindings(doc, reportData, currentY);
      
      // Add images if available
      currentY = this.addImages(doc, reportData, currentY);
      
      // Add recommendations
      currentY = this.addRecommendations(doc, reportData, currentY);
      
      isFirstPage = false;
    });
    
    // Add footer
    this.addFooter(doc);
    
    // Generate filename
    const filename = `Multiple_Reports_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Save the PDF
    doc.save(filename);
  }
}

// Create singleton instance
export const pdfReportService = new PDFReportService();


