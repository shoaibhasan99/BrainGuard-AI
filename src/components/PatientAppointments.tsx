import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Stethoscope, RefreshCw, CheckCircle, XCircle, AlertCircle, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { patientOperations, appointmentOperations, notificationOperations } from '../lib/supabase-operations';
import { realtimeService } from '../lib/realtimeService';

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'consultation' | 'follow-up' | 'emergency';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'missed';
  notes?: string;
  doctors: {
    id: string;
    specialization: string;
    users: {
      name: string;
      avatar_url?: string;
    };
  };
}

const PatientAppointments: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  const fetchAppointments = async () => {
    if (!user) {
      setAppointments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get patient_id from user_id
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (patientError || !patientData) {
        throw new Error('Patient profile not found. Please complete your profile.');
      }

      // Fetch appointments
      const data = await patientOperations.getPatientAppointments(patientData.id);
      setAppointments(data || []);
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setError(err?.message || 'Failed to load appointments');
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  // Subscribe to realtime appointment updates
  useEffect(() => {
    if (!user) return;

    const channel = realtimeService.subscribeToAppointments(user.id, (event) => {
      console.log('Appointment update received:', event);
      // Refresh appointments when status changes (like when marked as missed)
      if (event.type === 'UPDATE' && event.record) {
        fetchAppointments();
      }
    });

    return () => {
      realtimeService.unsubscribe(`appointments-${user.id}`);
    };
  }, [user]);

  const handleReschedule = async (appointment: Appointment) => {
    if (!window.confirm('Would you like to reschedule this missed appointment? You will be redirected to the appointment booking page.')) {
      return;
    }

    try {
      setReschedulingId(appointment.id);
      
      // Update appointment status to 'rescheduled' (this allows patient to book a new one)
      await appointmentOperations.updateAppointment(appointment.id, {
        status: 'rescheduled'
      });

      // Create notification for doctor
      const { data: doctorData } = await supabase
        .from('doctors')
        .select('user_id')
        .eq('id', appointment.doctors.id)
        .single();

      if (doctorData?.user_id) {
        await notificationOperations.createNotification({
          appointment_id: appointment.id,
          user_id: doctorData.user_id,
          role: 'doctor',
          message: `Patient ${user?.name || 'Patient'} wants to reschedule their missed appointment. They will book a new appointment.`,
          scheduled_for: new Date().toISOString(),
          status: 'pending',
        });
      }

      // Refresh appointments
      await fetchAppointments();
      
      // Redirect to appointment booking page
      window.location.href = '/#appointment';
      alert('Appointment marked for rescheduling. Please book a new appointment.');
    } catch (error: any) {
      console.error('Error rescheduling appointment:', error);
      alert(`Failed to reschedule appointment: ${error?.message || 'Unknown error'}`);
    } finally {
      setReschedulingId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'rescheduled':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'missed':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'rescheduled':
        return <AlertCircle className="w-4 h-4" />;
      case 'missed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
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
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              My Appointments
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            View and manage your scheduled appointments
          </p>
        </div>
        <button
          onClick={fetchAppointments}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </motion.div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
            <p className="mt-4 text-gray-400">Loading appointments...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-24 h-24 mx-auto text-gray-600 mb-6" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No appointments scheduled</h3>
            <p className="text-gray-500">You don't have any appointments yet. Book an appointment to get started.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Missed Appointments Section */}
            {appointments.filter(apt => apt.status === 'missed').length > 0 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                  <h3 className="text-xl font-bold text-orange-400">Missed Appointments</h3>
                  <div className="h-1 flex-1 bg-gradient-to-r from-orange-500/50 to-transparent rounded-full"></div>
                </div>
                <div className="space-y-4">
                  {appointments
                    .filter(apt => apt.status === 'missed')
                    .map((appointment, index) => (
                      <motion.div
                        key={appointment.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl p-6 hover:border-orange-400/50 transition-all duration-300"
                      >
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                              <img
                                src={appointment.doctors?.users?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                                alt={appointment.doctors?.users?.name || 'Doctor'}
                                className="w-12 h-12 rounded-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
                                }}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold text-white">
                                  {appointment.doctors?.users?.name || 'Unknown Doctor'}
                                </h3>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(appointment.status)}`}>
                                  {getStatusIcon(appointment.status)}
                                  Missed
                                </span>
                              </div>
                              <p className="text-orange-400 font-medium mb-2">
                                {appointment.doctors?.specialization || 'General Medicine'}
                              </p>
                              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4" />
                                  <span>{formatDate(appointment.appointment_date)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  <span>{appointment.appointment_time}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Stethoscope className="w-4 h-4" />
                                  <span className="capitalize">{appointment.appointment_type}</span>
                                </div>
                              </div>
                              <div className="mt-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                <p className="text-sm text-orange-200 mb-3">
                                  <span className="font-semibold">⚠️ You missed this appointment.</span> You can reschedule it to book a new appointment with the same doctor.
                                </p>
                                <button
                                  onClick={() => handleReschedule(appointment)}
                                  disabled={reschedulingId === appointment.id}
                                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                >
                                  {reschedulingId === appointment.id ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      Rescheduling...
                                    </>
                                  ) : (
                                    <>
                                      <CalendarDays className="w-4 h-4" />
                                      Reschedule Appointment
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            )}

            {/* Other Appointments */}
            {appointments.filter(apt => apt.status !== 'missed').length > 0 && (
              <div>
                {appointments.filter(apt => apt.status === 'missed').length > 0 && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                    <h3 className="text-xl font-bold text-blue-400">Other Appointments</h3>
                    <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/50 to-transparent rounded-full"></div>
                  </div>
                )}
                <div className="space-y-4">
                  {appointments
                    .filter(apt => apt.status !== 'missed')
                    .map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6 hover:border-blue-400/30 transition-all duration-300"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <img
                        src={appointment.doctors?.users?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                        alt={appointment.doctors?.users?.name || 'Doctor'}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">
                          {appointment.doctors?.users?.name || 'Unknown Doctor'}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(appointment.status)}`}>
                          {getStatusIcon(appointment.status)}
                          {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1)}
                        </span>
                      </div>
                      <p className="text-blue-400 font-medium mb-2">
                        {appointment.doctors?.specialization || 'General Medicine'}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(appointment.appointment_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{appointment.appointment_time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="w-4 h-4" />
                          <span className="capitalize">{appointment.appointment_type}</span>
                        </div>
                      </div>
                      {appointment.notes && (
                        <div className="mt-3 p-3 bg-gray-700/30 rounded-lg">
                          <p className="text-sm text-gray-300">{appointment.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PatientAppointments;

