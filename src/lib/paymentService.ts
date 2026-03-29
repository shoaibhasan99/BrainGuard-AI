/**
 * Payment Service
 * Manages payment entries for appointments
 */

export interface PaymentEntry {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorId: string;
  appointmentId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: 'consultation' | 'follow-up' | 'emergency';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  createdAt: string;
  updatedAt: string;
}

interface CreatePaymentData {
  doctorName: string;
  doctorSpecialty: string;
  doctorId: string;
  amount: number;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: 'consultation' | 'follow-up' | 'emergency';
  appointmentNotes?: string;
}

class PaymentService {
  private storageKey = 'brainGuard_payments';
  private payments: PaymentEntry[] = [];

  constructor() {
    this.loadPayments();
  }

  private loadPayments(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.payments = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
      this.payments = [];
    }
  }

  private savePayments(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.payments));
    } catch (error) {
      console.error('Error saving payments:', error);
    }
  }

  createPaymentEntry(data: CreatePaymentData): PaymentEntry {
    const payment: PaymentEntry = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      doctorName: data.doctorName,
      doctorSpecialty: data.doctorSpecialty,
      doctorId: data.doctorId,
      appointmentId: `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      appointmentType: data.appointmentType,
      amount: data.amount,
      status: 'pending',
      description: data.appointmentNotes || `Appointment with ${data.doctorName} - ${data.appointmentType}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.payments.push(payment);
    this.savePayments();
    return payment;
  }

  getAllPayments(): PaymentEntry[] {
    this.loadPayments(); // Refresh from storage
    return [...this.payments];
  }

  getPaymentById(id: string): PaymentEntry | undefined {
    this.loadPayments();
    return this.payments.find(p => p.id === id);
  }

  updatePaymentStatus(id: string, status: PaymentEntry['status']): boolean {
    this.loadPayments();
    const payment = this.payments.find(p => p.id === id);
    if (payment) {
      payment.status = status;
      payment.updatedAt = new Date().toISOString();
      this.savePayments();
      return true;
    }
    return false;
  }

  deletePayment(id: string): boolean {
    this.loadPayments();
    const index = this.payments.findIndex(p => p.id === id);
    if (index !== -1) {
      this.payments.splice(index, 1);
      this.savePayments();
      return true;
    }
    return false;
  }

  getPaymentsByStatus(status: PaymentEntry['status']): PaymentEntry[] {
    this.loadPayments();
    return this.payments.filter(p => p.status === status);
  }

  clearAllPayments(): void {
    this.payments = [];
    this.savePayments();
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
