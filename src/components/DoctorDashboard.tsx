import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Calendar, Loader2, X, Shield, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import DoctorSidebar from './DoctorSidebar';
import { supabase } from '../lib/supabase';
import { doctorOperations } from '../lib/supabase-operations';
import { realtimeService } from '../lib/realtimeService';
import UserProfileModal from './UserProfileModal';
import Chat from './Chat';
import Payment from './Payment';

interface DoctorDashboardProps {
  onLogout: () => void;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: 'consultation' | 'follow-up' | 'emergency';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'missed';
  notes?: string;
  created_at?: string;
  patients: {
    id: string;
    users: {
      name: string;
      email?: string;
    };
  };
}

const DoctorDashboard: React.FC<DoctorDashboardProps> = ({ onLogout }) => {
  const { user } = useAuth();
  const [currentModule, setCurrentModule] = useState<string | null>(null);
  const [doctorAppointments, setDoctorAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [doctorProfileId, setDoctorProfileId] = useState<string | null>(null);
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const goToHome = () => {
    setCurrentModule(null);
  };

  const goToModule = (moduleId: string) => {
    setCurrentModule(moduleId);
  };

  // Fetch doctor profile ID
  useEffect(() => {
    const fetchDoctorProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (error) throw error;
        if (data) setDoctorProfileId(data.id);
      } catch (err: any) {
        console.error('Error fetching doctor profile:', err);
      }
    };

    fetchDoctorProfile();
  }, [user]);

  // Fetch doctor appointments
  const fetchDoctorAppointments = async () => {
    if (!doctorProfileId) {
      setDoctorAppointments([]);
      return;
    }

    try {
      setAppointmentsLoading(true);
      setAppointmentsError(null);
      const data = await doctorOperations.getDoctorAppointments(doctorProfileId);
      setDoctorAppointments(data || []);
    } catch (err: any) {
      console.error('Error fetching appointments:', err);
      setAppointmentsError(err?.message || 'Failed to load appointments');
      setDoctorAppointments([]);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    if (doctorProfileId && currentModule === 'appointments') {
      fetchDoctorAppointments();
    }
  }, [doctorProfileId, currentModule]);

  // Subscribe to realtime appointment updates
  useEffect(() => {
    if (!user || currentModule !== 'appointments') return;

    realtimeService.subscribeToAppointments(user.id, (event) => {
      if (event.type === 'UPDATE' && event.record) {
        fetchDoctorAppointments();
      }
    });

    return () => {
      realtimeService.unsubscribe(`appointments-${user.id}`);
    };
  }, [user, currentModule]);

  const handleRefreshAppointments = () => {
    fetchDoctorAppointments();
  };

  const handleCancelAppointment = async (appointment: Appointment) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      setCancellingAppointmentId(appointment.id);
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointment.id);

      if (error) throw error;
      await fetchDoctorAppointments();
    } catch (err: any) {
      console.error('Error cancelling appointment:', err);
      alert('Failed to cancel appointment. Please try again.');
    } finally {
      setCancellingAppointmentId(null);
    }
  };

  const formatAppointmentDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'scheduled':
        return 'bg-blue-500/15 text-blue-300 border border-blue-400/30';
      case 'completed':
        return 'bg-green-500/15 text-green-300 border border-green-400/30';
      case 'cancelled':
        return 'bg-red-500/15 text-red-300 border border-red-400/30';
      case 'missed':
        return 'bg-orange-500/15 text-orange-300 border border-orange-400/30';
      case 'rescheduled':
        return 'bg-yellow-500/15 text-yellow-300 border border-yellow-400/30';
      default:
        return 'bg-gray-500/15 text-gray-300 border border-gray-400/30';
    }
  };


  return (
    <div className={`${!currentModule ? 'h-screen overflow-hidden scrollbar-hide' : 'min-h-screen'} bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex overflow-x-hidden w-full max-w-full`}>
      {/* Sidebar */}
      <DoctorSidebar 
        currentModule={currentModule}
        onNavigateHome={goToHome}
        onNavigateToModule={goToModule}
        user={user}
        onLogout={onLogout}
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
                  Doctor Portal - Advanced Medical AI Platform
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
                    Dr. {user.name?.split(' ')[1] || user.name}
                  </motion.div>
                  <motion.div 
                    className="text-sm text-gray-200 capitalize font-medium"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {user.role || 'Doctor'}
                  </motion.div>
                </div>
                <motion.button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="relative w-14 h-14 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-holographic filter-holographic cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    boxShadow: [
                      "0 0 20px rgba(6, 182, 212, 0.5)",
                      "0 0 40px rgba(6, 182, 212, 0.8)",
                      "0 0 20px rgba(6, 182, 212, 0.5)"
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <User className="w-7 h-7 text-white" />
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-500/20 blur-md animate-pulse-glow"></div>
                </motion.button>
              </motion.div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <div className={`flex-1 relative overflow-x-hidden w-full ${!currentModule ? 'overflow-y-hidden h-full scrollbar-hide' : 'overflow-y-auto scrollbar-hide'}`}>
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

          <div className={`relative z-10 w-full max-w-full overflow-x-hidden ${!currentModule ? 'container mx-auto px-4 py-8 lg:px-8 h-full flex items-center justify-center' : 'h-full px-8 py-8'}`}>

          {/* Default Home View - Landing Page */}
          {!currentModule && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-7xl mx-auto h-full flex items-center justify-center"
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
            </motion.div>
          )}

          {/* Module Content - Appointments */}
          {currentModule === 'appointments' && (
            <motion.div
              key="appointments"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-[calc(100vh-200px)] flex flex-col bg-gray-900/30 border border-gray-800/60 rounded-2xl p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">Scheduled Appointments</h2>
                  <p className="text-gray-400">
                    Review and manage upcoming appointments booked with you
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleRefreshAppointments}
                    disabled={appointmentsLoading || !doctorProfileId}
                    className="px-4 py-2 rounded-xl border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                  >
                    {appointmentsLoading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mt-6 scrollbar-hide">
                {appointmentsError && (
                  <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-200 text-sm mb-4">
                    {appointmentsError}
                  </div>
                )}

                {appointmentsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                      <p>Loading appointments...</p>
                    </div>
                  </div>
                ) : doctorAppointments.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                      <h3 className="text-xl font-semibold mb-2">No appointments scheduled</h3>
                      <p className="text-gray-500">
                        New patient bookings will appear here automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pr-2">
                    {/* Upcoming Appointments Section - SHOWN FIRST */}
                    {doctorAppointments.filter(apt => apt.status !== 'missed').length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-1 w-12 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"></div>
                          <h3 className="text-xl font-bold text-cyan-400">Upcoming Appointments</h3>
                          <div className="h-1 flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent rounded-full"></div>
                        </div>
                        <div className="space-y-4">
                          {doctorAppointments
                            .filter(apt => apt.status !== 'missed')
                            .map((appointment) => (
                              <div
                                key={appointment.id}
                                className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300"
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                  <div>
                                    <p className="text-sm text-gray-400 mb-1">Patient</p>
                                    <p className="text-xl font-semibold text-white">
                                      {appointment.patients?.users?.name || 'Unknown Patient'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {appointment.patients?.users?.email || 'No email on file'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyles(appointment.status)}`}
                                    >
                                      {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1)}
                                    </span>
                                    <p className="text-lg font-bold text-white mt-3">
                                      {appointment.appointment_time}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {formatAppointmentDate(appointment.appointment_date)}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                                  <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-700/30">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Appointment Type</p>
                                    <p className="text-sm font-semibold text-white mt-1 capitalize">
                                      {appointment.appointment_type?.replace('-', ' ') || 'N/A'}
                                    </p>
                                  </div>
                                  <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-700/30">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Notes</p>
                                    <p className="text-sm text-gray-300 mt-1">
                                      {appointment.notes?.trim()
                                        ? appointment.notes
                                        : 'No notes provided'}
                                    </p>
                                  </div>
                                  <div className="bg-gray-900/40 rounded-xl p-3 border border-gray-700/30">
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Created</p>
                                    <p className="text-sm text-gray-300 mt-1">
                                      {appointment.created_at
                                        ? formatAppointmentDate(appointment.created_at.split('T')[0])
                                        : 'N/A'}
                                    </p>
                                  </div>
                                </div>

                                {/* Cancel Button - Only show for scheduled appointments */}
                                {appointment.status === 'scheduled' && (
                                  <div className="mt-4 flex justify-end">
                                    <button
                                      onClick={() => handleCancelAppointment(appointment)}
                                      disabled={cancellingAppointmentId === appointment.id}
                                      className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 hover:bg-red-500/25 transition-all duration-300 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {cancellingAppointmentId === appointment.id ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Cancelling...
                                        </>
                                      ) : (
                                        <>
                                          <X className="w-4 h-4" />
                                          Cancel Appointment
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Missed Appointments Section - SHOWN SECOND */}
                    {doctorAppointments.filter(apt => apt.status === 'missed').length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                          <h3 className="text-xl font-bold text-orange-400">Missed Appointments</h3>
                          <div className="h-1 flex-1 bg-gradient-to-r from-orange-500/50 to-transparent rounded-full"></div>
                        </div>
                        <div className="space-y-4">
                          {doctorAppointments
                            .filter(apt => apt.status === 'missed')
                            .map((appointment) => (
                              <div
                                key={appointment.id}
                                className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-5 hover:border-orange-400/50 transition-all duration-300"
                              >
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                  <div>
                                    <p className="text-sm text-orange-300 mb-1">Patient</p>
                                    <p className="text-xl font-semibold text-white">
                                      {appointment.patients?.users?.name || 'Unknown Patient'}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {appointment.patients?.users?.email || 'No email on file'}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-400/30">
                                      Missed
                                    </span>
                                    <p className="text-lg font-bold text-white mt-3">
                                      {appointment.appointment_time}
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {formatAppointmentDate(appointment.appointment_date)}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-4 p-3 bg-orange-500/5 rounded-xl border border-orange-500/20">
                                  <p className="text-sm text-orange-200">
                                    <span className="font-semibold">Note:</span> This appointment was missed. The patient can reschedule if needed.
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Module Content - Profile */}
          {currentModule === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-[calc(100vh-200px)] bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 overflow-y-auto scrollbar-hide"
            >
              <h3 className="text-2xl font-bold mb-6">Profile Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Phone Number</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.phoneNumber || 'Not provided'}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Specialization</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.specialization || 'Not specified'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">License Number</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.licenseNumber || 'Not provided'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Member Since</label>
                    <div className="p-3 bg-gray-700/50 rounded-lg text-white">{user?.joinDate || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Module Content - Chat */}
          {currentModule === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full h-[calc(100vh-200px)]"
              style={{ marginLeft: '-2rem', marginRight: '-2rem' }}
            >
              <div style={{ height: '100%' }}>
                <Chat />
              </div>
            </motion.div>
          )}

          {/* Module Content - Payments */}
          {currentModule === 'payments' && (
            <motion.div
              key="payments"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="h-[calc(100vh-200px)]"
            >
              <Payment />
            </motion.div>
          )}
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <UserProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

export default DoctorDashboard;