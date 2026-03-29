import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Phone, Calendar, Shield, Edit2, Save, XCircle, Stethoscope, Clock, CreditCard, Building, Globe, BookOpen } from 'lucide-react';
const parseStringArray = (value: any): string[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseNumberOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const mapVerifiedDoctorToDoctorProfile = (verifiedDoctor: any, fallbackUserId: string) => {
  const languages = parseStringArray(
    verifiedDoctor.languages ||
      verifiedDoctor.languages_spoken ||
      verifiedDoctor.languages_list
  );

  const qualifications = parseStringArray(
    verifiedDoctor.qualifications ||
      verifiedDoctor.qualifications_list ||
      verifiedDoctor.education
  );

  const experienceYears =
    parseNumberOrNull(verifiedDoctor.experience_years) ??
    parseNumberOrNull(verifiedDoctor.experience);

  const consultationFee =
    parseNumberOrNull(verifiedDoctor.consultation_fee) ??
    parseNumberOrNull(verifiedDoctor.fee);

  const dateOfBirth =
    verifiedDoctor.date_of_birth ||
    verifiedDoctor.dob ||
    verifiedDoctor.birth_date ||
    null;

  const licenseNumber =
    verifiedDoctor.license_number ||
    verifiedDoctor.registration_number ||
    verifiedDoctor.registration_no ||
    verifiedDoctor.reg_no ||
    verifiedDoctor.pmc_id ||
    '';

  const hospitalAffiliation =
    verifiedDoctor.hospital_affiliation ||
    verifiedDoctor.hospital ||
    verifiedDoctor.registration_type ||
    verifiedDoctor.country ||
    '';

  return {
    id: verifiedDoctor.id,
    user_id: verifiedDoctor.user_id || fallbackUserId,
    specialization:
      verifiedDoctor.specialization ||
      verifiedDoctor.speciality ||
      verifiedDoctor.specialization_name ||
      '',
    license_number: licenseNumber,
    experience_years: experienceYears,
    hospital_affiliation: hospitalAffiliation,
    consultation_fee: consultationFee,
    languages,
    qualifications,
    date_of_birth: dateOfBirth,
    is_verified:
      typeof verifiedDoctor.is_verified === 'boolean'
        ? verifiedDoctor.is_verified
        : true,
  };
};

const fetchVerifiedDoctorProfile = async (
  userId?: string,
  email?: string
) => {
  try {
    if (!userId && !email) return null;

    let query = supabase
      .from('verified_pakistani_doctors')
      .select('*')
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error(
        '❌ Verified doctor profile fetch error:',
        error.message || error
      );
      return null;
    }

    return data;
  } catch (fetchError) {
    console.error('❌ Exception fetching verified doctor profile:', fetchError);
    return null;
  }
};
import { userOperations } from '../lib/supabase-operations';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfileData {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
  phone_number?: string;
  avatar_url?: string;
  gender?: string;
  created_at: string;
  patients?: Array<{
    id: string;
    user_id: string;
    date_of_birth?: string;
    medical_history?: string;
    emergency_contact?: string;
    insurance_info?: string;
  }>;
  doctors?: Array<{
    id: string;
    user_id: string;
    specialization: string;
    license_number: string;
    experience_years: number;
    hospital_affiliation?: string;
    consultation_fee: number;
    languages: string[];
    qualifications: string[];
    date_of_birth?: string;
  }>;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [pendingSaveData, setPendingSaveData] = useState<any>(null);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone_number: '',
    gender: '',
    date_of_birth: '',
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchUserProfile();
      setIsEditing(false);
      setShowOTPVerification(false);
      setOtp('');
      setPendingSaveData(null);
    }
  }, [isOpen, user]);

  // Resend timer for OTP
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Initialize edit data when profile is loaded
  // IMPORTANT: Don't reset editData if we're in the middle of OTP verification
  const patientProfile = useMemo(() => {
    if (profileData?.role !== 'patient') return null;
    if (!profileData.patients || profileData.patients.length === 0) return null;
    return profileData.patients[0];
  }, [profileData]);

  const doctorProfile = useMemo(() => {
    if (profileData?.role !== 'doctor') return null;
    if (!profileData.doctors || profileData.doctors.length === 0) return null;
    return profileData.doctors[0];
  }, [profileData]);

  useEffect(() => {
    if (profileData && !showOTPVerification && !pendingSaveData) {
      setEditData({
        name: profileData.name || '',
        email: profileData.email || '',
        phone_number: profileData.phone_number || '',
        gender: profileData.gender || '',
        date_of_birth: patientProfile?.date_of_birth || doctorProfile?.date_of_birth || '',
      });
    }
  }, [profileData, patientProfile, doctorProfile, showOTPVerification, pendingSaveData]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Fetching user profile for user ID:', user.id);
      const data = await userOperations.getUserProfile(user.id);
      console.log('📊 Fetched profile data:', data);
      console.log('📅 Date of birth in data:', data.patients?.[0]?.date_of_birth || data.doctors?.[0]?.date_of_birth);
      
      // Ensure doctor-specific data is present even if userOperations fallback fails due to policies
      if (data.role === 'doctor' && (!data.doctors || data.doctors.length === 0)) {
        console.warn('⚠️ Doctor profile missing from initial fetch. Attempting direct fetch from doctors table...');
        const { data: doctorData, error: doctorFetchError } = await supabase
          .from('doctors')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (doctorFetchError) {
          console.error('❌ Direct doctor fetch failed:', doctorFetchError);
        } else if (doctorData) {
          console.log('✅ Successfully fetched doctor details directly:', doctorData);
          (data as any).doctors = [doctorData];
        }
      }

      // Fallback to verified_pakistani_doctors view if core tables are empty
      if (data.role === 'doctor' && (!data.doctors || data.doctors.length === 0)) {
        console.warn('⚠️ Doctor profile still missing after direct fetch. Checking verified_pakistani_doctors view...');
        
        const verifiedByUserId = await fetchVerifiedDoctorProfile(user.id);
        let verifiedDoctor = verifiedByUserId;

        if (!verifiedDoctor) {
          console.warn('⚠️ No verified doctor found via user_id. Trying lookup by email...');
          verifiedDoctor = await fetchVerifiedDoctorProfile(undefined, data.email);
        }

        if (verifiedDoctor) {
          console.log('✅ Fetched doctor details from verified_pakistani_doctors view:', verifiedDoctor);
          (data as any).doctors = [
            mapVerifiedDoctorToDoctorProfile(verifiedDoctor, user.id)
          ];
        } else {
          console.warn('⚠️ Doctor details not found even in verified_pakistani_doctors view.');
        }
      }
      
      if (!data) {
        throw new Error('No profile data found');
      }
      
      setProfileData(data as UserProfileData);
    } catch (err: any) {
      console.error('Error fetching user profile:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load user profile';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.code) {
        errorMessage = `Database error: ${err.code}`;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // Check for specific Supabase errors
      if (errorMessage.includes('coerce') || errorMessage.includes('single JSON')) {
        errorMessage = 'Unable to fetch profile data. Please try again or contact support.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not provided';
    try {
      // Handle different date formats (DD/MM/YYYY, YYYY-MM-DD, etc.)
      let date: Date;
      
      // Check if it's in DD/MM/YYYY format
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY format
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          date = new Date(dateString);
        }
      } else {
        date = new Date(dateString);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return dateString; // Return original if invalid
      }
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const getRoleSpecificInfo = () => {
    // Currently we only show the basic information section for all users.
    // Doctor-specific details panel has been removed as per latest requirement.
    return null;
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowOTPVerification(false);
    setOtp('');
    setPendingSaveData(null);
    setError(null);
    // Reset edit data to original profile data
    if (profileData) {
      setEditData({
        name: profileData.name || '',
        email: profileData.email || '',
        phone_number: profileData.phone_number || '',
        gender: profileData.gender || '',
        date_of_birth: patientProfile?.date_of_birth || doctorProfile?.date_of_birth || '',
      });
    }
  };

  const handleSave = async () => {
    if (!user || !profileData) return;

    setIsSaving(true);
    setError(null);

    try {
      // Validate required fields
      if (!editData.name.trim()) {
        setError('Name is required');
        setIsSaving(false);
        return;
      }
      if (!editData.email.trim()) {
        setError('Email is required');
        setIsSaving(false);
        return;
      }

      // Check if email has changed (case-insensitive comparison)
      const emailChanged = editData.email.trim().toLowerCase() !== profileData.email.toLowerCase();
      
      console.log('🔍 Email change check:', {
        newEmail: editData.email.trim(),
        oldEmail: profileData.email,
        emailChanged: emailChanged
      });

      if (emailChanged) {
        console.log('📧 Email has changed! Initiating OTP flow...');
        
        // Store the save data for after OTP verification
        // IMPORTANT: Keep the old email in pendingSaveData until OTP is verified
        const newEmail = editData.email.trim();
        setPendingSaveData({
          name: editData.name.trim(),
          email: newEmail, // New email (will be saved after OTP verification)
          oldEmail: profileData.email, // Keep old email for reference
          phone_number: editData.phone_number.trim() || null,
          gender: editData.gender || null,
          date_of_birth: editData.date_of_birth,
        });

        console.log('💾 Pending save data set:', { email: newEmail });

        // Update email in auth - this will send OTP to the new email
        // Note: This doesn't change the email immediately - it requires OTP verification
        console.log('📧 Calling supabase.auth.updateUser with new email:', newEmail);
        const { data: updateData, error: authError } = await supabase.auth.updateUser({
          email: newEmail,
        });

        console.log('📧 Update user response:', { data: updateData, error: authError });

        if (authError) {
          console.error('❌ Auth update error:', authError);
          throw new Error(`Failed to send OTP: ${authError.message}`);
        }

        console.log('✅ OTP should be sent to:', newEmail);
        console.log('🔧 Setting showOTPVerification to true');
        
        // Show OTP verification
        setShowOTPVerification(true);
        setResendTimer(60);
        setIsSaving(false);
        
        console.log('✅ OTP verification UI should now be visible');
        console.log('🔍 State check:', {
          showOTPVerification: true, // We just set it
          pendingSaveData: { email: newEmail } // We just set it
        });
        
        return;
      }

      // If email hasn't changed, proceed with normal save
      await performSave();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
      setIsSaving(false);
    }
  };

  const performSave = async () => {
    if (!user || !profileData) return;

    setIsSaving(true);
    setError(null);

    try {
      // Use pending save data if available (from email change flow), otherwise use current edit data
      const saveData = pendingSaveData || {
        name: editData.name.trim(),
        email: editData.email.trim(),
        phone_number: editData.phone_number.trim() || null,
        gender: editData.gender || null,
        date_of_birth: editData.date_of_birth,
      };

      // Convert date format if needed (DD/MM/YYYY to YYYY-MM-DD)
      let dateOfBirth = saveData.date_of_birth;
      if (dateOfBirth && dateOfBirth.includes('/')) {
        const parts = dateOfBirth.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          dateOfBirth = `${year}-${month}-${day}`;
        }
      }

      // Update users table
      // IMPORTANT: Only update email here if it's from pendingSaveData (after OTP verification)
      // Otherwise, use the current email from profileData to avoid reverting
      const userUpdates: any = {
        name: saveData.name,
        // If this is from email change flow (pendingSaveData exists), use the new email
        // Otherwise, keep the current email from profileData
        email: pendingSaveData ? saveData.email : profileData.email,
        phone_number: saveData.phone_number,
        gender: saveData.gender,
      };

      console.log('💾 Updating users table with:', { ...userUpdates, email: userUpdates.email });

      const { error: userError } = await supabase
        .from('users')
        .update(userUpdates)
        .eq('id', user.id);

      if (userError) {
        throw new Error(`Failed to update user: ${userError.message}`);
      }

      console.log('✅ Users table updated successfully');

      // Update date_of_birth in patients or doctors table
      if (profileData.role === 'patient') {
        const patient = profileData.patients && profileData.patients.length > 0 ? profileData.patients[0] : null;
        if (patient) {
          const { error: patientError } = await supabase
            .from('patients')
            .update({ date_of_birth: dateOfBirth || null })
            .eq('id', patient.id);

          if (patientError) {
            throw new Error(`Failed to update patient data: ${patientError.message}`);
          }
        }
      } else if (profileData.role === 'doctor') {
        const doctor = profileData.doctors && profileData.doctors.length > 0 ? profileData.doctors[0] : null;
        if (doctor) {
          const { error: doctorError } = await supabase
            .from('doctors')
            .update({ date_of_birth: dateOfBirth || null })
            .eq('id', doctor.id);

          if (doctorError) {
            throw new Error(`Failed to update doctor data: ${doctorError.message}`);
          }
        }
      }

      // Refresh profile data
      await fetchUserProfile();
      setIsEditing(false);
      setShowOTPVerification(false);
      setPendingSaveData(null);
      setOtp('');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    if (!pendingSaveData) {
      setError('No pending email update found');
      return;
    }

    setIsVerifyingOTP(true);
    setError(null);

    try {
      console.log('🔐 Verifying email change OTP for:', pendingSaveData.email);
      
      // Verify OTP for email change
      // IMPORTANT: Use 'email_change' type for email change verification
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: pendingSaveData.email,
        token: otp,
        type: 'email_change' // Use 'email_change' type for email change OTP verification
      });

      if (verifyError) {
        throw new Error(verifyError.message || 'Invalid OTP. Please check and try again.');
      }

      if (!data?.user) {
        throw new Error('OTP verification failed');
      }

      console.log('✅ Email change OTP verified successfully');
      console.log('✅ New email confirmed in Supabase Auth:', data.user.email);
      
      // Verify that the email was actually updated in auth
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser?.email !== pendingSaveData.email) {
        console.warn('⚠️ Email in auth does not match expected email. Auth email:', currentUser?.email);
        // Continue anyway - sometimes there's a slight delay
      }
      
      // Now proceed with the save (this will update the email in the users table)
      await performSave();
    } catch (err: any) {
      console.error('Error verifying OTP:', err);
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0 || !pendingSaveData) return;

    setIsSaving(true);
    setError(null);

    try {
      console.log('📧 Resending OTP for email change...');
      
      const { error: authError } = await supabase.auth.updateUser({
        email: pendingSaveData.email,
      });

      if (authError) {
        throw new Error(authError.message || 'Failed to resend OTP');
      }

      setResendTimer(60);
      setError(null);
    } catch (err: any) {
      console.error('Error resending OTP:', err);
      setError(err.message || 'Failed to resend OTP');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDateForInput = (dateString: string | undefined) => {
    if (!dateString) return '';
    try {
      // If it's already in YYYY-MM-DD format, return as is
      if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }
      // If it's in DD/MM/YYYY format, convert to YYYY-MM-DD
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }
      // Try to parse and format
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      return '';
    } catch {
      return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-800 rounded-2xl border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-cyan-400" />
                User Profile
              </h2>
              <div className="flex items-center gap-2">
                {!showOTPVerification && (
                  <>
                    {!isEditing ? (
                      <button
                        onClick={handleEdit}
                        className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full"
                  />
                  <p className="ml-4 text-gray-400">Loading profile...</p>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4">
                  <p className="text-red-400">{error}</p>
                </div>
              ) : showOTPVerification && pendingSaveData ? (
                /* OTP Verification Step */
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-700/30 rounded-xl p-6 border border-gray-600/50"
                >
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Verify Email Change
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    We've sent a 6-digit OTP to <span className="text-cyan-400 font-semibold">{pendingSaveData?.email || 'your new email'}</span>. 
                    Please enter the code to confirm your email change.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Enter OTP
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setOtp(value);
                          setError(null);
                        }}
                        className="w-full px-4 py-3 bg-gray-600/50 border border-gray-500 rounded-lg text-white text-center text-2xl tracking-widest focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                        placeholder="000000"
                        maxLength={6}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && otp.length === 6) {
                            handleVerifyOTP();
                          }
                        }}
                        autoFocus
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleVerifyOTP}
                        disabled={isVerifyingOTP || otp.length !== 6}
                        className="flex-1 px-4 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {isVerifyingOTP ? 'Verifying...' : 'Verify OTP'}
                      </button>
                      <button
                        onClick={handleResendOTP}
                        disabled={resendTimer > 0 || isSaving}
                        className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setShowOTPVerification(false);
                        setOtp('');
                        setPendingSaveData(null);
                        setError(null);
                      }}
                      className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      Cancel email change
                    </button>
                  </div>
                </motion.div>
              ) : profileData ? (
                <>
                  {/* Basic Information */}
                  <div className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/50">
                    <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Basic Information
                    </h3>
                    <div className="space-y-4">
                      {/* Full Name */}
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Full Name</p>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.name}
                              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-600/50 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                              placeholder="Enter your name"
                            />
                          ) : (
                            <p className="text-white font-medium">{profileData.name}</p>
                          )}
                        </div>
                      </div>

                      {/* Email */}
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Email</p>
                          {isEditing ? (
                            <input
                              type="email"
                              value={editData.email}
                              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-600/50 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                              placeholder="Enter your email"
                            />
                          ) : (
                            <p className="text-white font-medium">{profileData.email}</p>
                          )}
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Phone Number</p>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={editData.phone_number}
                              onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-600/50 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                              placeholder="Enter your phone number"
                            />
                          ) : (
                            <p className="text-white font-medium">{profileData.phone_number || 'Not provided'}</p>
                          )}
                        </div>
                      </div>

                      {/* Gender */}
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Gender</p>
                          {isEditing ? (
                            <select
                              value={editData.gender}
                              onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-600/50 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 appearance-none"
                            >
                              <option value="" className="bg-gray-700">Select gender</option>
                              <option value="male" className="bg-gray-700">Male</option>
                              <option value="female" className="bg-gray-700">Female</option>
                            </select>
                          ) : (
                            <p className="text-white font-medium capitalize">{profileData.gender || 'Not provided'}</p>
                          )}
                        </div>
                      </div>

                      {/* Role (Read-only) */}
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Role</p>
                          <p className="text-white font-medium capitalize">{profileData.role}</p>
                        </div>
                      </div>

                      {/* Specialization (Doctor only) */}
                      {profileData.role === 'doctor' && (
                        <div className="flex items-start gap-3">
                          <Stethoscope className="w-5 h-5 text-gray-400 mt-2" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-400 mb-1">Specialization</p>
                            <p className="text-white font-medium">
                              {doctorProfile?.specialization || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* License Number (Doctor only) */}
                      {profileData.role === 'doctor' && (
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-gray-400 mt-2" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-400 mb-1">License Number</p>
                            <p className="text-white font-medium">
                              {doctorProfile?.license_number || 'Not provided'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Date of Birth */}
                      <div className="flex items-start gap-3">
                        <Calendar className="w-5 h-5 text-gray-400 mt-2" />
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-1">Date of Birth</p>
                          {isEditing ? (
                            <input
                              type="date"
                              value={formatDateForInput(editData.date_of_birth)}
                              onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-600/50 border border-gray-500 rounded-lg text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400"
                            />
                          ) : (
                            <p className="text-white font-medium">
                              {(() => {
                                if (profileData.role === 'patient') {
                                  const patient = profileData.patients && profileData.patients.length > 0 
                                    ? profileData.patients[0] 
                                    : null;
                                  if (patient && patient.date_of_birth) {
                                    return formatDate(patient.date_of_birth);
                                  }
                                  return 'Not provided';
                                } else if (profileData.role === 'doctor') {
                                  if (doctorProfile?.date_of_birth) {
                                    return formatDate(doctorProfile.date_of_birth);
                                  }
                                  return 'Not provided';
                                }
                                return 'Not provided';
                              })()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Role-specific Information */}
                  {getRoleSpecificInfo()}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No profile data available</p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserProfileModal;

