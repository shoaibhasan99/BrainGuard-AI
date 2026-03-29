import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, 
  Search, 
  Calendar, 
  Clock, 
  X, 
  AlertCircle,
  CheckCircle,
  TrendingDown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { paymentOperations } from '../lib/supabase-operations';
import { patientOperations } from '../lib/supabase-operations';
import { supabase } from '../lib/supabase';
import { Elements } from '@stripe/react-stripe-js';
import { getStripe } from '../lib/stripe';
import StripePaymentForm from './StripePaymentForm';

interface Transaction {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  amount: number;
  date: string;
  time: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  appointmentId: string;
  type: 'consultation' | 'follow-up' | 'emergency';
  description: string;
}

interface PendingPayment {
  id: string;
  doctorName: string;
  doctorSpecialty: string;
  appointmentDate: string;
  appointmentTime: string;
  amount: number;
  dueDate: string;
  type: 'consultation' | 'follow-up' | 'emergency';
}

const Payment: React.FC = () => {
  console.log('🔵 Payment component rendered');
  const { user } = useAuth();
  console.log('🔵 Payment component - user from useAuth:', user ? { id: user.id, role: user.role } : 'null');
  
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'methods'>('pending');
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [stripePromise, setStripePromise] = useState<Promise<any> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed' | 'refunded'>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  // Real payment data from Supabase
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Initialize Stripe
  useEffect(() => {
    console.log('🔵 Payment component - Stripe initialization useEffect');
    setStripePromise(getStripe());
  }, []);

  // Reset activeTab if doctor tries to access methods tab
  useEffect(() => {
    if (user?.role === 'doctor' && activeTab === 'methods') {
      setActiveTab('pending');
    }
  }, [user, activeTab]);

  // Load payment data from Supabase
  useEffect(() => {
    console.log('🔵 Payment component - loadPaymentData useEffect triggered', { user: user ? { id: user.id, role: user.role } : 'null' });
    if (user) {
      console.log('✅ Payment module: User detected, loading payment data...', { userId: user.id, role: user.role });
      loadPaymentData();
    } else {
      console.warn('⚠️ Payment module: No user found');
    }
  }, [user]);

  const loadPaymentData = async () => {
    if (!user) {
      console.log('Payment module: loadPaymentData called but no user');
      return;
    }

    console.log('Payment module: loadPaymentData started', { userId: user.id, role: user.role });
    try {
      setIsLoading(true);
      
      let allPayments: any[] = [];
      let patientData: { id: string } | null = null;
      
      // Check if user is a doctor or patient
      if (user.role === 'doctor') {
        // Get doctor_id from user_id
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (doctorError || !doctorData) {
          console.error('Error fetching doctor:', doctorError);
          setIsLoading(false);
          setPendingPayments([]);
          setTransactions([]);
          return;
        }

        // Get all payments for this doctor
        console.log('=== DOCTOR PAYMENTS DEBUG ===');
        console.log('Doctor ID:', doctorData.id);
        console.log('Current user ID:', user.id);
        console.log('User role:', user.role);
        try {
          allPayments = await paymentOperations.getDoctorPayments(doctorData.id);
          console.log('✅ Doctor payments fetched successfully:', allPayments?.length || 0);
          if (allPayments && allPayments.length > 0) {
            console.log('Sample payment:', allPayments[0]);
            console.log('Payment with appointments:', allPayments.filter(p => p.appointments !== null).length);
            console.log('Payment without appointments:', allPayments.filter(p => p.appointments === null).length);
          } else {
            console.warn('⚠️ No payments found for this doctor');
            console.log('This could mean:');
            console.log('1. No payments have been created yet (payments are created when patients view Payment module)');
            console.log('2. Payments exist but RLS is blocking access');
            console.log('3. All payments have been filtered out');
          }
        } catch (error: any) {
          console.error('❌ Error fetching doctor payments:', error);
          console.error('Error message:', error.message);
          console.error('Error code:', error.code);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          allPayments = [];
        }
        console.log('=== END DOCTOR PAYMENTS DEBUG ===');
      } else {
        // Get patient_id from user_id
        const { data: patientDataResult, error: patientError } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (patientError || !patientDataResult) {
          console.error('Error fetching patient:', patientError);
          setIsLoading(false);
          setPendingPayments([]);
          setTransactions([]);
          return;
        }

        patientData = patientDataResult;

        // Get all payments for this patient
        allPayments = await paymentOperations.getPatientPayments(patientData.id);
      }
      
      // Deduplicate payments by appointment_id (keep the first one)
      const seenAppointmentIds = new Set<string>();
      const uniquePayments = allPayments.filter(payment => {
        // For doctors, include payments even if appointment_id is missing
        if (user.role === 'doctor' && !payment.appointment_id) {
          // Use payment ID as fallback for deduplication
          if (seenAppointmentIds.has(payment.id)) {
            return false;
          }
          seenAppointmentIds.add(payment.id);
          return true;
        }
        
        if (!payment.appointment_id) return false;
        if (seenAppointmentIds.has(payment.appointment_id)) {
          return false; // Skip duplicate
        }
        seenAppointmentIds.add(payment.appointment_id);
        return true;
      });
      
      console.log('After deduplication:', {
        total: allPayments.length,
        unique: uniquePayments.length,
        duplicates: allPayments.length - uniquePayments.length
      });
      
      // Filter payments to only show those for scheduled appointments
      // Separate pending and completed payments
      // For doctors, show all payments (pending and completed) regardless of appointment status
      // For patients, show payments for scheduled or missed appointments (missed can be rescheduled)
      const pending = uniquePayments.filter(p => {
        if (user.role === 'doctor') {
          // Doctors see all pending payments (even if appointment status is different or missing)
          return p.status === 'pending';
        } else {
          // Patients see payments for scheduled or missed appointments (missed can be rescheduled)
          return p.status === 'pending' && (
            p.appointments?.status === 'scheduled' || 
            p.appointments?.status === 'missed' || 
            !p.appointments
          );
        }
      });
      const completed = uniquePayments.filter(p => 
        (p.status === 'completed' || p.status === 'failed' || p.status === 'refunded')
      );
      
      console.log('Filtered payments - Pending:', pending.length, 'Completed:', completed.length);
      console.log('Unique payments breakdown:', {
        total: uniquePayments.length,
        pending: uniquePayments.filter(p => p.status === 'pending').length,
        completed: uniquePayments.filter(p => ['completed', 'failed', 'refunded'].includes(p.status)).length,
        withAppointments: uniquePayments.filter(p => p.appointments !== null).length,
        withoutAppointments: uniquePayments.filter(p => p.appointments === null).length
      });
      
      // Debug: Log what will be displayed
      console.log('=== PAYMENT DISPLAY DEBUG ===');
      console.log('Pending payments to display:', pending.length);
      console.log('Completed transactions to display:', completed.length);
      if (pending.length > 0) {
        console.log('Sample pending payment:', pending[0]);
      }
      if (completed.length > 0) {
        console.log('Sample completed transaction:', completed[0]);
      }
      console.log('=== END PAYMENT DISPLAY DEBUG ===');

      // Convert to PendingPayment format
      // For doctors, show patient name; for patients, show doctor name
      const pendingFormatted: PendingPayment[] = pending.map(payment => {
        // Handle case where appointment data might be missing
        const appointment = payment.appointments;
        const patientName = user.role === 'doctor' 
          ? (appointment?.patients?.users?.name || 'Unknown Patient')
          : (appointment?.doctors?.users?.name || 'Unknown Doctor');
        const specialty = user.role === 'doctor'
          ? 'Patient Payment'
          : (appointment?.doctors?.specialization || 'General');
        
        // Use payment created_at as fallback for dates if appointment is missing
        const paymentDate = payment.created_at ? new Date(payment.created_at).toISOString().split('T')[0] : '';
        
        return {
          id: payment.id,
          doctorName: patientName,
          doctorSpecialty: specialty,
          appointmentDate: appointment?.appointment_date || paymentDate,
          appointmentTime: appointment?.appointment_time || 'N/A',
          amount: Number(payment.amount),
          dueDate: appointment?.appointment_date || paymentDate,
          type: (appointment?.appointment_type || 'consultation') as 'consultation' | 'follow-up' | 'emergency'
        };
      });

      // Convert to Transaction format
      const transactionsFormatted: Transaction[] = completed.map(payment => {
        const appointment = payment.appointments;
        const patientName = user.role === 'doctor'
          ? (appointment?.patients?.users?.name || 'Unknown Patient')
          : (appointment?.doctors?.users?.name || 'Unknown Doctor');
        const specialty = user.role === 'doctor'
          ? 'Patient Payment'
          : (appointment?.doctors?.specialization || 'General');
        
        return {
          id: payment.id,
          doctorName: patientName,
          doctorSpecialty: specialty,
          amount: Number(payment.amount),
          date: appointment?.appointment_date || payment.created_at?.split('T')[0] || '',
          time: appointment?.appointment_time || '',
          status: payment.status as 'completed' | 'pending' | 'failed' | 'refunded',
          paymentMethod: payment.payment_method || 'Not specified',
          appointmentId: payment.appointment_id,
          type: (appointment?.appointment_type || 'consultation') as 'consultation' | 'follow-up' | 'emergency',
          description: payment.description || `Payment for ${appointment?.appointment_type || 'consultation'}`
        };
      });

      setPendingPayments(pendingFormatted);
      setTransactions(transactionsFormatted);

      // Also check for scheduled appointments without payments and create them
      // Only for patients (doctors don't create payments)
      if (user.role === 'patient' && patientData) {
        createPaymentsForScheduledAppointments(patientData.id).catch(err => {
          console.error('Error creating payments for scheduled appointments:', err);
        });
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
      setPendingPayments([]);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Create payments for scheduled appointments that don't have payments yet
  const createPaymentsForScheduledAppointments = async (patientId: string) => {
    try {
      // Get all scheduled appointments for this patient
      const appointments = await patientOperations.getPatientAppointments(patientId);
      const scheduledAppointments = appointments.filter(apt => apt.status === 'scheduled');

      // Get existing payments
      const existingPayments = await paymentOperations.getPatientPayments(patientId);
      const existingAppointmentIds = new Set(existingPayments.map(p => p.appointment_id));

      let newPaymentsCreated = false;
      const newPendingPayments: PendingPayment[] = [];

      // Create payments for appointments that don't have payments
      for (const appointment of scheduledAppointments) {
        if (!existingAppointmentIds.has(appointment.id) && appointment.doctors) {
          const consultationFee = Number(appointment.doctors.consultation_fee) || 0;
          if (consultationFee > 0) {
            const newPayment = await paymentOperations.createPayment(
              appointment.id,
              appointment.patient_id,
              appointment.doctor_id,
              consultationFee
            );
            
            // Add to pending payments list
            if (newPayment) {
              newPendingPayments.push({
                id: newPayment.id,
                doctorName: newPayment.appointments?.doctors?.users?.name || 'Unknown Doctor',
                doctorSpecialty: newPayment.appointments?.doctors?.specialization || 'General',
                appointmentDate: newPayment.appointments?.appointment_date || '',
                appointmentTime: newPayment.appointments?.appointment_time || '',
                amount: Number(newPayment.amount),
                dueDate: newPayment.appointments?.appointment_date || '',
                type: (newPayment.appointments?.appointment_type || 'consultation') as 'consultation' | 'follow-up' | 'emergency'
              });
              newPaymentsCreated = true;
            }
          }
        }
      }

      // Update state with new payments - reload all to ensure consistency
      if (newPaymentsCreated) {
        // Reload all payments to ensure we only show payments for scheduled appointments
        const allPayments = await paymentOperations.getPatientPayments(patientId);
        
        // Deduplicate payments by appointment_id
        const seenAppointmentIds = new Set<string>();
        const uniquePayments = allPayments.filter(payment => {
          if (!payment.appointment_id) return false;
          if (seenAppointmentIds.has(payment.appointment_id)) {
            return false; // Skip duplicate
          }
          seenAppointmentIds.add(payment.appointment_id);
          return true;
        });
        
        const pending = uniquePayments.filter(p => 
          p.status === 'pending' && 
          p.appointments?.status === 'scheduled'
        );
        
        const pendingFormatted: PendingPayment[] = pending.map(payment => ({
          id: payment.id,
          doctorName: payment.appointments?.doctors?.users?.name || 'Unknown Doctor',
          doctorSpecialty: payment.appointments?.doctors?.specialization || 'General',
          appointmentDate: payment.appointments?.appointment_date || '',
          appointmentTime: payment.appointments?.appointment_time || '',
          amount: Number(payment.amount),
          dueDate: payment.appointments?.appointment_date || '',
          type: (payment.appointments?.appointment_type || 'consultation') as 'consultation' | 'follow-up' | 'emergency'
        }));
        
        setPendingPayments(pendingFormatted);
      }
    } catch (error) {
      console.error('Error creating payments for scheduled appointments:', error);
      // Don't throw - this is a background operation
    }
  };

  // Payment processing handled via Stripe

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.doctorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.appointmentId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-400/10';
      case 'pending': return 'text-yellow-400 bg-yellow-400/10';
      case 'failed': return 'text-red-400 bg-red-400/10';
      case 'refunded': return 'text-blue-400 bg-blue-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'pending': return Clock;
      case 'failed': return AlertCircle;
      case 'refunded': return TrendingDown;
      default: return Clock;
    }
  };

  const handlePayment = (payment: PendingPayment) => {
    setSelectedPayment(payment);
    setShowPaymentForm(true);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timeString: string): string => {
    return timeString;
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
            <span className="bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              Payment Center
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            Manage your medical payments and transaction history
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-2 border border-gray-700/50"
      >
        <div className="flex space-x-2">
          {[
            { id: 'pending', label: 'Pending Payments', count: pendingPayments.length },
            { id: 'history', label: 'Payment History', count: transactions.length },
            ...(user?.role !== 'doctor' ? [{ id: 'methods', label: 'Payment Methods' }] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{tab.label}</span>
                {typeof (tab as any).count === 'number' && (
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-600/50 text-gray-300'
                  }`}>
                    {(tab as any).count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'pending' && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Pending Payments */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
                <p className="mt-4 text-gray-400">Loading payments...</p>
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="text-center py-12 bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50">
                <CreditCard className="w-24 h-24 mx-auto text-gray-600 mb-6" />
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No Pending Payments</h3>
                <p className="text-gray-500">You don't have any pending payments at the moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {pendingPayments.map((payment, index) => (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-yellow-400/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{payment.doctorName}</h3>
                      <p className="text-blue-400 font-medium">{payment.doctorSpecialty}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">PKR {payment.amount.toLocaleString()}</div>
                      <div className="text-sm text-gray-400">{payment.type}</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(payment.appointmentDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>{formatTime(payment.appointmentTime)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <AlertCircle className="w-4 h-4" />
                      <span>Due: {formatDate(payment.dueDate)}</span>
                    </div>
                  </div>

                  {user?.role === 'patient' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePayment(payment)}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300"
                    >
                      Pay Now
                    </motion.button>
                  )}
                </motion.div>
              ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Search and Filter */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all duration-300"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-all duration-300"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/30">
                    <tr>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Doctor</th>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Amount</th>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Date & Time</th>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Status</th>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction, index) => {
                      const StatusIcon = getStatusIcon(transaction.status);
                      return (
                        <motion.tr
                          key={transaction.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20 transition-colors duration-200"
                        >
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-semibold text-white">{transaction.doctorName}</div>
                              <div className="text-sm text-gray-400">{transaction.doctorSpecialty}</div>
                              <div className="text-xs text-gray-500">{transaction.appointmentId}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-lg font-bold text-white">PKR {transaction.amount.toLocaleString()}</div>
                            <div className="text-sm text-gray-400">{transaction.type}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300">{formatDate(transaction.date)}</div>
                            <div className="text-sm text-gray-400">{transaction.time}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <StatusIcon className="w-4 h-4" />
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                                {transaction.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300">{transaction.paymentMethod}</div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'methods' && user?.role !== 'doctor' && (
          <motion.div
            key="methods"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Stripe Payment Method */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30">
                    <CreditCard className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                      Stripe
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                        Secure
                      </span>
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">Pay securely with credit or debit card</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Supported Cards */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
                  <p className="text-sm font-semibold text-gray-300 mb-3">Accepted Payment Methods:</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs font-medium text-gray-300">Visa</div>
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs font-medium text-gray-300">Mastercard</div>
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs font-medium text-gray-300">American Express</div>
                    <div className="px-3 py-2 bg-white/10 rounded-lg text-xs font-medium text-gray-300">Discover</div>
                  </div>
                </div>

                {/* How it works */}
                <div className="mt-6 p-4 bg-gray-700/40 rounded-xl border border-gray-600/30">
                  <h4 className="text-sm font-semibold text-white mb-3">How it works:</h4>
                  <ol className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-semibold">1.</span>
                      <span>Click "Pay Now" on any pending payment</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-semibold">2.</span>
                      <span>Enter your card details in the secure form</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-semibold">3.</span>
                      <span>Your payment is processed instantly and securely</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-semibold">4.</span>
                      <span>Receive confirmation and update in your payment history</span>
                    </li>
                  </ol>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Payment Form Modal */}
      <AnimatePresence>
        {showPaymentForm && selectedPayment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-gray-700/50"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Complete Payment</h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Payment Summary */}
              <div className="bg-gray-700/50 rounded-xl p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Doctor:</span>
                  <span className="text-white font-semibold">{selectedPayment.doctorName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Appointment:</span>
                  <span className="text-white">{formatDate(selectedPayment.appointmentDate)} at {selectedPayment.appointmentTime}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white">{selectedPayment.type}</span>
                </div>
                <div className="border-t border-gray-600 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-white">Total Amount:</span>
                    <span className="text-2xl font-bold text-green-400">PKR {selectedPayment.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Stripe Payment Form */}
              {paymentStatus === 'idle' && stripePromise && (
                <Elements stripe={stripePromise}>
                  <StripePaymentForm
                    amount={selectedPayment.amount}
                    paymentId={selectedPayment.id}
                    onSuccess={async () => {
                      try {
                        // Update payment status in Supabase
                        await paymentOperations.updatePaymentStatus(
                          selectedPayment.id,
                          'completed',
                          'stripe',
                          `stripe_${Date.now()}`
                        );
                        
                        // Reload payment data
                        await loadPaymentData();
                        
                        setPaymentStatus('success');
                        setTimeout(() => {
                          setShowPaymentForm(false);
                          setSelectedPayment(null);
                          setPaymentStatus('idle');
                        }, 2000);
                      } catch (error: any) {
                        console.error('Error updating payment status:', error);
                        setPaymentStatus('failed');
                      }
                    }}
                    onError={async (errorMessage) => {
                      try {
                        // Update payment status to failed
                        await paymentOperations.updatePaymentStatus(
                          selectedPayment.id,
                          'failed',
                          'stripe',
                          `stripe_${Date.now()}`
                        );
                      } catch (error) {
                        console.error('Error updating payment status:', error);
                      }
                      setPaymentStatus('failed');
                      setTimeout(() => {
                        setPaymentStatus('idle');
                      }, 3000);
                    }}
                  />
                </Elements>
              )}

              {/* Payment Status */}
              {paymentStatus === 'processing' && (
                <div className="text-center py-4">
                  <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-400">Processing payment...</p>
                </div>
              )}

              {paymentStatus === 'success' && (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-semibold">Payment Successful!</p>
                </div>
              )}

              {paymentStatus === 'failed' && (
                <div className="text-center py-4">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-2" />
                  <p className="text-red-400 font-semibold">Payment Failed</p>
                  <p className="text-gray-400 text-sm">Please try again</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Payment;
