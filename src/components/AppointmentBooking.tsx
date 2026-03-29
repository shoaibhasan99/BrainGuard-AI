import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  Search, 
  Star, 
  Check,
  X,
  Stethoscope,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { appointmentOperations, patientOperations } from '../lib/supabase-operations';
import { useAuth } from '../contexts/AuthContext';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  avatar: string;
  rating: number;
  experience: string;
  location: string;
  consultationFee: number;
  languages: string[];
  qualifications: string[];
  isVerified: boolean;
  nextAvailable: string;
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  isBooked: boolean;
}

const BASE_TIME_SLOTS: TimeSlot[] = [
  { time: '09:00 AM', isAvailable: true, isBooked: false },
  { time: '09:30 AM', isAvailable: true, isBooked: false },
  { time: '10:00 AM', isAvailable: true, isBooked: false },
  { time: '10:30 AM', isAvailable: false, isBooked: false },
  { time: '11:00 AM', isAvailable: true, isBooked: false },
  { time: '11:30 AM', isAvailable: true, isBooked: false },
  { time: '02:00 PM', isAvailable: true, isBooked: false },
  { time: '02:30 PM', isAvailable: true, isBooked: false },
  { time: '03:00 PM', isAvailable: false, isBooked: false },
  { time: '03:30 PM', isAvailable: true, isBooked: false },
  { time: '04:00 PM', isAvailable: true, isBooked: false },
  { time: '04:30 PM', isAvailable: true, isBooked: false }
];


const AppointmentBooking: React.FC = () => {
  const { user } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<'consultation' | 'follow-up' | 'emergency'>('consultation');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [showAppointments, setShowAppointments] = useState(false);
  const [patientAppointments, setPatientAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timeSlotsMap, setTimeSlotsMap] = useState<Record<string, TimeSlot[]>>({});
  const [isLoadingTimeSlots, setIsLoadingTimeSlots] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  // Fetch doctors from Supabase
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setIsLoadingDoctors(true);
        
        // Fetch doctors with user information
        const { data, error } = await supabase
          .from('doctors')
          .select(`
            id,
            user_id,
            specialization,
            experience_years,
            consultation_fee,
            languages,
            qualifications,
            hospital_affiliation,
            is_verified,
            users!inner (
              id,
              name,
              email,
              avatar_url,
              gender
            )
          `)
          .eq('is_verified', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching doctors:', error);
          // Try alternative query without inner join
          const { data: doctorsData, error: doctorsError } = await supabase
            .from('doctors')
            .select('id, user_id, specialization, experience_years, consultation_fee, languages, qualifications, hospital_affiliation, is_verified')
            .eq('is_verified', true)
            .order('created_at', { ascending: false });

          if (doctorsError) {
            console.error('Error fetching doctors (alternative):', doctorsError);
            setDoctors([]);
            return;
          }

          if (!doctorsData || doctorsData.length === 0) {
            setDoctors([]);
            return;
          }

          // Fetch user data separately
          const userIds = doctorsData.map((d: any) => d.user_id).filter(Boolean);
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, avatar_url, gender')
            .in('id', userIds);

          if (usersError) {
            console.error('Error fetching user data:', usersError);
          }

          // Map the data
          const mappedDoctors: Doctor[] = doctorsData.map((doctor: any) => {
            const userData = usersData?.find((u: any) => u.id === doctor.user_id);
            const doctorName = userData?.name || 'Dr. Unknown';
            
            // Determine avatar URL based on gender only
            let avatarUrl = userData?.avatar_url;
            const userGender = userData?.gender?.toLowerCase();
            
            // Use gender field to determine avatar
            if (!avatarUrl) {
              if (userGender === 'female' || userGender === 'f') {
                // Use female avatar for female users
                avatarUrl = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
              } else {
                // Use male avatar for male users or as default
                avatarUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
              }
            }
            
            return {
              id: doctor.id,
              name: doctorName,
              specialty: doctor.specialization || 'General',
              avatar: avatarUrl,
              rating: 4.5, // Default rating, can be calculated from reviews if available
              experience: `${doctor.experience_years || 0} years`,
              location: doctor.hospital_affiliation || 'Medical Center',
              consultationFee: doctor.consultation_fee || 100,
              languages: Array.isArray(doctor.languages) ? doctor.languages : ['English'],
              qualifications: Array.isArray(doctor.qualifications) ? doctor.qualifications : [],
              isVerified: doctor.is_verified || false,
              nextAvailable: 'Available soon'
            };
          });

          setDoctors(mappedDoctors);
          return;
        }

        if (!data || data.length === 0) {
          console.log('No verified doctors found');
          setDoctors([]);
          return;
        }

        // Map the data to Doctor interface
        const mappedDoctors: Doctor[] = data.map((doctor: any) => {
          const userData = Array.isArray(doctor.users) ? doctor.users[0] : doctor.users;
          const doctorName = userData?.name || 'Dr. Unknown';
          
          // Determine avatar URL based on gender only
          let avatarUrl = userData?.avatar_url;
          const userGender = userData?.gender?.toLowerCase();
          
          // Use gender field to determine avatar
          if (!avatarUrl) {
            if (userGender === 'female' || userGender === 'f') {
              // Use female avatar for female users
              avatarUrl = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
            } else {
              // Use male avatar for male users or as default
              avatarUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
            }
          }
          
          return {
            id: doctor.id,
            name: doctorName,
            specialty: doctor.specialization || 'General',
            avatar: avatarUrl,
            rating: 4.5, // Default rating, can be calculated from reviews if available
            experience: `${doctor.experience_years || 0} years`,
            location: doctor.hospital_affiliation || 'Medical Center',
            consultationFee: doctor.consultation_fee || 100,
            languages: Array.isArray(doctor.languages) ? doctor.languages : ['English'],
            qualifications: Array.isArray(doctor.qualifications) ? doctor.qualifications : [],
            isVerified: doctor.is_verified || false,
            nextAvailable: 'Available soon'
          };
        });

        setDoctors(mappedDoctors);
      } catch (error) {
        console.error('Error in fetchDoctors:', error);
        setDoctors([]);
      } finally {
        setIsLoadingDoctors(false);
      }
    };

    fetchDoctors();
  }, []);

  // Generate calendar dates for current month
  const generateCalendarDates = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 1 = Monday, etc.)
    const startDayOfWeek = firstDay.getDay();
    
    // Get the number of days in the month
    const daysInMonth = lastDay.getDate();
    
    // Create array to hold all calendar dates
    const dates: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      dates.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(new Date(year, month, day));
    }
    
    return dates;
  };

  const calendarDates = generateCalendarDates();
  const slotKey = selectedDoctor && selectedDate ? `${selectedDoctor.id}_${selectedDate}` : selectedDate;
  const timeSlots = slotKey ? (timeSlotsMap[slotKey] || BASE_TIME_SLOTS.map(slot => ({ ...slot }))) : [];
  
  // Get month and year for display
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  
  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  
  // Check if a date is in the past
  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };
  
  // Check if a date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Format date to YYYY-MM-DD (using local timezone to avoid date shifts)
  const formatDateToISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = filterSpecialty === 'all' || doctor.specialty.toLowerCase() === filterSpecialty.toLowerCase();
    return matchesSearch && matchesSpecialty;
  });

  const specialties = ['all', ...Array.from(new Set(doctors.map(d => d.specialty)))];

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setSelectedDate('');
    setSelectedTime('');
    setShowBookingForm(true);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  // Cancel appointment
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) {
      return;
    }

    try {
      setIsCancelling(true);
      await appointmentOperations.updateAppointment(appointmentId, {
        status: 'cancelled'
      });
      
      // Refresh appointments list
      await fetchPatientAppointments();
      alert('Appointment cancelled successfully!');
    } catch (error: any) {
      console.error('Error cancelling appointment:', error);
      alert(error?.message || 'Failed to cancel appointment. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  // Delete appointment
  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this appointment? This action cannot be undone.')) {
      return;
    }

    try {
      setIsDeleting(true);
      await appointmentOperations.deleteAppointment(appointmentId);
      
      // Refresh appointments list
      await fetchPatientAppointments();
      alert('Appointment deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      alert(error?.message || 'Failed to delete appointment. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Start editing appointment
  const handleStartEdit = (appointment: any) => {
    console.log('handleStartEdit called with appointment:', appointment);
    try {
      // Try to find the doctor from the doctors array first
      let doctor = doctors.find(d => d.id === appointment.doctor_id);
      console.log('Doctor found in array:', doctor);
      
      // If not found in the array, construct doctor object from appointment relation
      if (!doctor && appointment.doctors) {
        console.log('Doctor not in array, constructing from appointment relation');
        const doctorData = appointment.doctors;
        const userData = doctorData.users;
        
        // Get avatar based on gender
        let avatarUrl = userData?.avatar_url;
        const userGender = userData?.gender?.toLowerCase();
        if (!avatarUrl) {
          if (userGender === 'female' || userGender === 'f') {
            avatarUrl = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
          } else {
            avatarUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
          }
        }
        
        doctor = {
          id: doctorData.id,
          name: userData?.name || 'Unknown Doctor',
          specialty: doctorData.specialization || 'General',
          avatar: avatarUrl,
          rating: 4.5,
          experience: `${doctorData.experience_years || 0} years`,
          location: doctorData.hospital_affiliation || 'Medical Center',
          consultationFee: doctorData.consultation_fee || 100,
          languages: Array.isArray(doctorData.languages) ? doctorData.languages : ['English'],
          qualifications: Array.isArray(doctorData.qualifications) ? doctorData.qualifications : [],
          isVerified: doctorData.is_verified || false,
          nextAvailable: 'Available soon'
        };
        console.log('Constructed doctor:', doctor);
      }
      
      if (doctor) {
        console.log('Setting up edit form with doctor:', doctor);
        setSelectedDoctor(doctor);
        setSelectedDate(appointment.appointment_date);
        setSelectedTime(appointment.appointment_time);
        setAppointmentType(appointment.appointment_type);
        setAppointmentNotes(appointment.notes || '');
        setEditingAppointment(appointment);
        setShowAppointments(false); // Hide appointments view
        setShowBookingForm(true); // Show booking form with date/time selection
        console.log('Edit form setup complete');
      } else {
        alert('Doctor information not found. Please try again.');
        console.error('Doctor not found for appointment:', appointment);
      }
    } catch (error) {
      console.error('Error starting edit:', error);
      alert('Failed to load appointment details. Please try again.');
    }
  };

  // Reschedule appointment (for missed appointments)
  const handleReschedule = async (appointment: any) => {
    if (!window.confirm('Would you like to reschedule this missed appointment? You will be redirected to the appointment booking page.')) {
      return;
    }

    try {
      setReschedulingId(appointment.id);
      
      // Update appointment status to 'rescheduled' (this allows patient to book a new one)
      await appointmentOperations.updateAppointment(appointment.id, {
        status: 'rescheduled'
      });
      
      // Set up the booking form with the same doctor
      const doctor = doctors.find(d => d.id === appointment.doctor_id);
      if (doctor) {
        setSelectedDoctor(doctor);
        setShowAppointments(false);
        setShowBookingForm(true);
      } else {
        // If doctor not found in current list, fetch it
        const { data: doctorData } = await supabase
          .from('doctors')
          .select(`
            *,
            users:users(*)
          `)
          .eq('id', appointment.doctor_id)
          .single();
        
        if (doctorData) {
          const constructedDoctor = {
            id: doctorData.id,
            name: doctorData.users?.name || 'Unknown Doctor',
            specialty: doctorData.specialization || 'General',
            avatar: doctorData.users?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face',
            rating: 4.5,
            experience: `${doctorData.experience_years || 0} years`,
            location: doctorData.hospital_affiliation || 'Medical Center',
            consultationFee: doctorData.consultation_fee || 100,
            languages: Array.isArray(doctorData.languages) ? doctorData.languages : ['English'],
            qualifications: Array.isArray(doctorData.qualifications) ? doctorData.qualifications : [],
            isVerified: doctorData.is_verified || false,
            nextAvailable: 'Available soon'
          };
          setSelectedDoctor(constructedDoctor);
          setShowAppointments(false);
          setShowBookingForm(true);
        }
      }
      
      // Refresh appointments list
      await fetchPatientAppointments();
    } catch (error) {
      console.error('Error rescheduling appointment:', error);
      alert('Failed to reschedule appointment. Please try again.');
    } finally {
      setReschedulingId(null);
    }
  };

  // Update appointment
  const handleUpdateAppointment = async () => {
    if (!editingAppointment || !selectedDate || !selectedTime) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setIsUpdating(true);

      const updates = {
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        appointment_type: appointmentType,
        notes: appointmentNotes || undefined,
        status: 'scheduled' as const
      };

      await appointmentOperations.updateAppointment(editingAppointment.id, updates);

      // Refresh appointments list and time slots
      await fetchPatientAppointments();
      if (selectedDoctor) {
        const bookedTimes = await appointmentOperations.getAvailableTimeSlots(
          selectedDoctor.id,
          selectedDate
        );
        const updatedSlots = BASE_TIME_SLOTS.map(slot => ({
          ...slot,
          isBooked: bookedTimes.includes(slot.time)
        }));
        const mapKey = `${selectedDoctor.id}_${selectedDate}`;
        setTimeSlotsMap(prev => ({
          ...prev,
          [mapKey]: updatedSlots
        }));
      }

      alert('Appointment updated successfully!');
      
      // Reset form
      setShowBookingForm(false);
      setEditingAppointment(null);
      setSelectedDoctor(null);
      setSelectedDate('');
      setSelectedTime('');
      setAppointmentNotes('');
      setAppointmentType('consultation');
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      alert(error?.message || 'Failed to update appointment. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDoctor || !selectedDate || !selectedTime || !user) {
      alert('Please fill in all required fields');
      return;
    }

    // If editing, use update function instead
    if (editingAppointment) {
      await handleUpdateAppointment();
      return;
    }

    try {
      setIsBooking(true);

      // Get patient_id from current user
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (patientError || !patientData) {
        throw new Error('Patient profile not found. Please complete your profile.');
      }

      // Get doctor_id from selected doctor
      // The selectedDoctor.id is the doctor's id from the doctors table
      const doctorId = selectedDoctor.id;

      // Create appointment
      const appointmentData = {
        patient_id: patientData.id,
        doctor_id: doctorId,
        appointment_date: selectedDate,
        appointment_time: selectedTime,
        appointment_type: appointmentType,
        status: 'scheduled' as const,
        notes: appointmentNotes || undefined
      };

      await appointmentOperations.createAppointment(appointmentData);

      // Show success message
      alert('Appointment booked successfully!');
      
      // Refresh appointments list
      await fetchPatientAppointments();
      
      // Refresh time slots for the current date to show the newly booked slot
      if (selectedDate && selectedDoctor) {
        try {
          const bookedTimes = await appointmentOperations.getAvailableTimeSlots(
            selectedDoctor.id,
            selectedDate
          );
          const updatedSlots = BASE_TIME_SLOTS.map(slot => ({
            ...slot,
            isBooked: bookedTimes.includes(slot.time)
          }));
          const mapKey = `${selectedDoctor.id}_${selectedDate}`;
          setTimeSlotsMap(prev => ({
            ...prev,
            [mapKey]: updatedSlots
          }));
        } catch (error) {
          console.error('Error refreshing booked slots:', error);
        }
      }
      
      // Reset form
      setShowBookingForm(false);
      setEditingAppointment(null);
      setSelectedDoctor(null);
      setSelectedDate('');
      setSelectedTime('');
      setAppointmentNotes('');
      setAppointmentType('consultation');
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      alert(error?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  // Fetch patient appointments
  const fetchPatientAppointments = async () => {
    if (!user) {
      setPatientAppointments([]);
      return;
    }

    try {
      setIsLoadingAppointments(true);
      
      // Get patient_id from user_id
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (patientError || !patientData) {
        setPatientAppointments([]);
        return;
      }

      // Fetch appointments
      const data = await patientOperations.getPatientAppointments(patientData.id);
      setPatientAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setPatientAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPatientAppointments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch booked appointments and update time slots for selected date and doctor
  useEffect(() => {
    const fetchBookedSlots = async () => {
      if (!selectedDate || !selectedDoctor) {
        return;
      }

      try {
        setIsLoadingTimeSlots(true);
        
        // Get booked time slots for this doctor and date
        const bookedTimes = await appointmentOperations.getAvailableTimeSlots(
          selectedDoctor.id,
          selectedDate
        );

        // Create time slots with booked status
        const updatedSlots = BASE_TIME_SLOTS.map(slot => {
          const isBooked = bookedTimes.includes(slot.time);
          return {
            ...slot,
            isBooked: isBooked
          };
        });

        // Store in map for this date
        const mapKey = `${selectedDoctor.id}_${selectedDate}`;
        setTimeSlotsMap(prev => ({
          ...prev,
          [mapKey]: updatedSlots
        }));
      } catch (error) {
        console.error('Error fetching booked slots:', error);
        // On error, use base slots
        const mapKey = `${selectedDoctor?.id || 'unknown'}_${selectedDate}`;
        setTimeSlotsMap(prev => ({
          ...prev,
          [mapKey]: BASE_TIME_SLOTS.map(slot => ({ ...slot }))
        }));
      } finally {
        setIsLoadingTimeSlots(false);
      }
    };

    fetchBookedSlots();
  }, [selectedDate, selectedDoctor]);

  const createDateFromISO = (isoString: string): Date => {
    const [year, month, day] = isoString.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  };

  const formatDate = (dateString: string): string => {
    const date = createDateFromISO(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const formatFullDate = (dateString: string): string => {
    const date = createDateFromISO(dateString);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
              Book Appointment
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            Schedule your consultation with our expert medical professionals
          </p>
        </div>
      </motion.div>

      {showAppointments && (
        <motion.div
          key="appointments-view"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white">My Scheduled Appointments</h3>
                <p className="text-gray-400 text-sm">View all your booked sessions</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAppointments(false)}
                  className="px-4 py-2 rounded-xl border border-gray-600 text-gray-300 hover:border-blue-400 hover:text-blue-300 transition-all duration-300 flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Booking
                </button>
                <button
                  onClick={fetchPatientAppointments}
                  disabled={isLoadingAppointments}
                  className="px-4 py-2 rounded-xl border border-blue-500/40 text-blue-300 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <Clock className={`w-4 h-4 ${isLoadingAppointments ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {isLoadingAppointments ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                <p className="mt-4 text-gray-400">Loading appointments...</p>
              </div>
            ) : (
              patientAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="w-24 h-24 mx-auto text-gray-600 mb-6" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">No appointments scheduled</h3>
                  <p className="text-gray-500 mb-4">You don't have any appointments yet.</p>
                  <button
                    onClick={() => setShowAppointments(false)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300"
                  >
                    Book an Appointment
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                {/* Missed Appointments Section */}
                {patientAppointments.filter(apt => apt.status === 'missed').length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full"></div>
                      <h3 className="text-xl font-bold text-orange-400">Missed Appointments</h3>
                      <div className="h-1 flex-1 bg-gradient-to-r from-orange-500/50 to-transparent rounded-full"></div>
                    </div>
                    <div className="space-y-4">
                      {patientAppointments
                        .filter(apt => apt.status?.toLowerCase() === 'missed')
                        .map((appointment, index) => (
                          <motion.div
                            key={appointment.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="bg-orange-500/10 border-2 border-orange-500/30 rounded-2xl p-6 hover:border-orange-400/50 transition-all duration-300 relative"
                          >
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  <img
                                    src={appointment.doctors?.users?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                                    alt={appointment.doctors?.users?.name || 'Doctor'}
                                    className="w-16 h-16 rounded-full object-cover"
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
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(appointment.status)}`}>
                                      Missed
                                    </span>
                                  </div>
                                  <p className="text-orange-400 font-medium mb-3">
                                    {appointment.doctors?.specialization || 'General Medicine'}
                                  </p>
                                  <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                                    <div className="flex items-center gap-2">
                                      <CalendarDays className="w-4 h-4" />
                                      <span>{formatFullDate(appointment.appointment_date)}</span>
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
                              <div className="flex flex-col gap-2 mt-4 md:mt-0 relative z-10 flex-shrink-0">
                                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                                  <p className="text-sm text-orange-200 mb-3">
                                    <span className="font-semibold">⚠️ You missed this appointment.</span> You can reschedule it to book a new appointment with the same doctor, or delete it.
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleReschedule(appointment);
                                      }}
                                      disabled={reschedulingId === appointment.id || isDeleting}
                                      className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                    >
                                      {reschedulingId === appointment.id ? (
                                        <>
                                          <Clock className="w-4 h-4 animate-spin" />
                                          Rescheduling...
                                        </>
                                      ) : (
                                        <>
                                          <CalendarDays className="w-4 h-4" />
                                          Reschedule
                                        </>
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteAppointment(appointment.id);
                                      }}
                                      disabled={isDeleting || reschedulingId === appointment.id}
                                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                                    >
                                      {isDeleting ? (
                                        <>
                                          <Clock className="w-4 h-4 animate-spin" />
                                          Deleting...
                                        </>
                                      ) : (
                                        <>
                                          <Trash2 className="w-4 h-4" />
                                          Delete
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
                {patientAppointments.filter(apt => apt.status?.toLowerCase() !== 'missed').length > 0 && (
                  <div>
                    {patientAppointments.filter(apt => apt.status?.toLowerCase() === 'missed').length > 0 && (
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"></div>
                        <h3 className="text-xl font-bold text-blue-400">Other Appointments</h3>
                        <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/50 to-transparent rounded-full"></div>
                      </div>
                    )}
                    <div className="space-y-4">
                      {patientAppointments
                        .filter(apt => apt.status?.toLowerCase() !== 'missed')
                        .map((appointment, index) => (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-6 hover:border-blue-400/30 transition-all duration-300 relative"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <img
                            src={appointment.doctors?.users?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                            alt={appointment.doctors?.users?.name || 'Doctor'}
                            className="w-16 h-16 rounded-full object-cover"
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
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(appointment.status)}`}>
                              {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1)}
                            </span>
                          </div>
                          <p className="text-blue-400 font-medium mb-3">
                            {appointment.doctors?.specialization || 'General Medicine'}
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="w-4 h-4" />
                              <span>{formatFullDate(appointment.appointment_date)}</span>
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
                      {appointment.status === 'scheduled' && (
                        <div className="flex gap-2 mt-4 md:mt-0 relative z-10 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isCancelling && !isUpdating && !isDeleting) {
                                handleStartEdit(appointment);
                              }
                            }}
                            disabled={isCancelling || isUpdating || isDeleting}
                            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/40 border border-blue-500/40 text-blue-300 rounded-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative z-10"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancelAppointment(appointment.id);
                            }}
                            disabled={isCancelling || isUpdating || isDeleting}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 rounded-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative z-10"
                          >
                            <Trash2 className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      )}
                      {appointment.status === 'cancelled' && (
                        <div className="flex gap-2 mt-4 md:mt-0 relative z-10 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteAppointment(appointment.id);
                            }}
                            disabled={isDeleting || isCancelling || isUpdating}
                            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 active:bg-red-600/40 border border-red-600/40 text-red-300 rounded-lg transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer relative z-10"
                          >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                    </div>
                  </div>
                )}
                </div>
              )
            )
          }
          </div>
        </motion.div>
      )}

      {!showAppointments && !showBookingForm && (
        <div key="doctor-selection" className="space-y-6">
            {/* Search and Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search doctors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all duration-300"
                />
              </div>

              {/* Specialty Filter */}
              <select
                value={filterSpecialty}
                onChange={(e) => setFilterSpecialty(e.target.value)}
                className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all duration-300"
              >
                {specialties.map(specialty => (
                  <option key={specialty} value={specialty}>
                    {specialty === 'all' ? 'All Specialties' : specialty}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>

          {/* Doctors Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {isLoadingDoctors ? (
              <div className="col-span-full text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
                <p className="mt-4 text-gray-400">Loading doctors...</p>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-400 text-lg">No doctors found. Please try a different search.</p>
              </div>
            ) : (
              filteredDoctors.map((doctor, index) => (
              <motion.div
                key={doctor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleDoctorSelect(doctor)}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 cursor-pointer hover:border-blue-400/50 transition-all duration-300 group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <img
                      src={doctor.avatar}
                      alt={doctor.name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                    {doctor.isVerified && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                      {doctor.name}
                    </h3>
                    <p className="text-blue-400 font-medium">{doctor.specialty}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-300">{doctor.rating}</span>
                      <span className="text-sm text-gray-500">•</span>
                      <span className="text-sm text-gray-300">{doctor.experience}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Stethoscope className="w-4 h-4" />
                    <span>PKR {doctor.consultationFee.toLocaleString()} consultation</span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300"
                >
                  Book Appointment
                </motion.button>
              </motion.div>
              ))
            )}
          </motion.div>

          {/* Upcoming Appointments Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">My Upcoming Appointments</h3>
                <p className="text-sm text-gray-400">Review your scheduled visits</p>
              </div>
              <button
                onClick={() => setShowAppointments(true)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                View All
              </button>
            </div>

            {isLoadingAppointments ? (
              <div className="text-center py-6">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
                <p className="mt-2 text-gray-400 text-sm">Loading your appointments...</p>
              </div>
            ) : patientAppointments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">No appointments scheduled yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {patientAppointments.slice(0, 3).map(appointment => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 bg-gray-800/70 rounded-xl border border-gray-700/60"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {appointment.doctors?.users?.name || 'Unknown Doctor'}
                      </p>
                      <p className="text-sm text-gray-400">
                        {formatFullDate(appointment.appointment_date)} &middot; {appointment.appointment_time}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusStyles(appointment.status)}`}
                    >
                      {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
      
      {!showAppointments && showBookingForm && (
        <motion.div
          key="booking-form"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          {/* Doctor Info */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={selectedDoctor?.avatar}
                  alt={selectedDoctor?.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold text-white">{selectedDoctor?.name}</h3>
                    {editingAppointment && (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-full border border-blue-500/30">
                        Editing
                      </span>
                    )}
                  </div>
                  <p className="text-blue-400 font-medium">{selectedDoctor?.specialty}</p>
                  <p className="text-sm text-gray-400">{selectedDoctor?.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingAppointment && (
                  <span className="text-sm text-blue-400 font-medium">Editing Consultation</span>
                )}
                <button
                  onClick={() => {
                    setShowBookingForm(false);
                    setEditingAppointment(null);
                    setSelectedDoctor(null);
                    setSelectedDate('');
                    setSelectedTime('');
                    setAppointmentNotes('');
                    setAppointmentType('consultation');
                  }}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Date Selection - Calendar */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-400" />
                  Select Date
                </h3>
                <div className="flex items-center gap-2">
                  {editingAppointment && (
                    <span className="text-xs text-blue-400 font-medium">✓ Edit date</span>
                  )}
                  <button
                    onClick={goToPreviousMonth}
                    className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-300 min-w-[140px] text-center">
                    {monthName}
                  </span>
                  <button
                    onClick={goToNextMonth}
                    className="p-1.5 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Calendar Grid */}
              <div className="space-y-2">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Dates */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDates.map((date, index) => {
                    if (!date) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }
                    
                    const dateISO = formatDateToISO(date);
                    const isPast = isPastDate(date);
                    const isSelected = selectedDate === dateISO;
                    const isTodayDate = isToday(date);
                    
                    return (
                      <motion.button
                        key={dateISO}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.01 }}
                        whileHover={!isPast ? { scale: 1.1 } : {}}
                        whileTap={!isPast ? { scale: 0.95 } : {}}
                        onClick={() => !isPast && handleDateSelect(dateISO)}
                        disabled={isPast}
                        className={`aspect-square rounded-lg text-sm font-medium transition-all duration-300 ${
                          isSelected
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                            : isPast
                            ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
                            : isTodayDate
                            ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50 hover:bg-blue-500/30'
                            : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        {date.getDate()}
                  </motion.button>
                    );
                  })}
                </div>
              </div>
              
              {/* Selected Date Display */}
              {selectedDate && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm text-gray-400">Selected Date:</p>
                  <p className="text-lg font-semibold text-white">
                    {formatFullDate(selectedDate)}
                  </p>
                </div>
              )}
            </div>

            {/* Time Selection */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Select Time
                </h3>
                {editingAppointment && (
                  <span className="text-xs text-blue-400 font-medium">✓ Edit time</span>
                )}
              </div>
              {selectedDate ? (
                isLoadingTimeSlots ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <p className="mt-2 text-gray-400 text-sm">Loading available slots...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot, index) => (
                    <motion.button
                      key={slot.time}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: slot.isAvailable && !slot.isBooked ? 1.05 : 1 }}
                      whileTap={{ scale: slot.isAvailable && !slot.isBooked ? 0.95 : 1 }}
                      onClick={() => slot.isAvailable && !slot.isBooked && handleTimeSelect(slot.time)}
                      disabled={!slot.isAvailable || slot.isBooked}
                      className={`p-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        selectedTime === slot.time
                          ? 'bg-blue-500 text-white'
                          : slot.isBooked
                          ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
                          : slot.isAvailable
                          ? 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-600/30 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </motion.button>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-gray-400 text-center py-8">Please select a date first</p>
              )}
            </div>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Appointment Details</h3>
              {editingAppointment && (
                <span className="text-xs text-blue-400 font-medium">✓ Edit type & notes</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Appointment Type</label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value as any)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all duration-300"
                >
                  <option value="consultation">Consultation</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={appointmentNotes}
                  onChange={(e) => setAppointmentNotes(e.target.value)}
                  placeholder="Any specific concerns or questions..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all duration-300 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Booking Summary */}
          {selectedDate && selectedTime && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/30"
            >
              <h3 className="text-lg font-semibold text-white mb-4">Booking Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Doctor:</span>
                  <p className="text-white font-medium">{selectedDoctor?.name}</p>
                </div>
                <div>
                  <span className="text-gray-400">Date:</span>
                  <p className="text-white font-medium">{formatDate(selectedDate)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Time:</span>
                  <p className="text-white font-medium">{selectedTime}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Consultation Fee:</span>
                  <span className="text-xl font-bold text-white">PKR {selectedDoctor?.consultationFee.toLocaleString()}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Book/Update Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBookAppointment}
            disabled={!selectedDate || !selectedTime || isBooking || isUpdating}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300"
          >
            {isUpdating ? 'Saving Changes...' : isBooking ? 'Booking...' : editingAppointment ? 'Save Changes' : selectedDate && selectedTime ? 'Confirm Appointment' : 'Select Date & Time'}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default AppointmentBooking;
