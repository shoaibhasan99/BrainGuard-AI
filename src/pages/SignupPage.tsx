import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Stethoscope, ArrowLeft, Lock, Calendar, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import OTPVerification from '../components/OTPVerification';

interface SignupPageProps {
  onBackToLogin: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onBackToLogin }) => {
  const { signup, checkEmailExists, sendSignupOTP } = useAuth();
  const [userType, setUserType] = useState<'patient' | 'doctor'>('patient');
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    gender: '',
    specialization: '',
    licenseNumber: '',
    experienceYears: '',
    consultationFee: '',
    _userData: null as any,
    _additionalData: null as any
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (userType === 'doctor' && !formData.specialization.trim()) {
      setError('Specialization is required for doctors');
      return false;
    }
    if (userType === 'doctor') {
      if (!formData.licenseNumber.trim()) {
        setError('License number is required for doctors');
        return false;
      }
      const licenseRegex = /^PMC-\d{4}$/;
      if (!licenseRegex.test(formData.licenseNumber.trim().toUpperCase())) {
        setError('License number must follow the format PMC-1234');
        return false;
      }
      // Experience years and consultation fee are optional - can be set later
      if (formData.experienceYears.trim() && parseInt(formData.experienceYears) < 0) {
        setError('Years of experience must be a valid number (0 or greater)');
        return false;
      }
      if (formData.consultationFee.trim() && parseFloat(formData.consultationFee) <= 0) {
        setError('Consultation fee must be greater than 0 if provided');
        return false;
      }
    }
    return true;
  };

  const handleSignup = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setError('');

    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Step 1: Check if email already exists
      console.log('🔍 Checking if email exists:', formData.email);
      const emailExists = await checkEmailExists(formData.email);
      
      if (emailExists) {
        setError('');
        alert(`⚠️ Email Already Registered\n\nThis email address is already registered.\n\nPlease try logging in instead or use a different email address.`);
        setIsLoading(false);
        return;
      }

      // Step 2: Send OTP to email using Supabase
      console.log('📧 Sending Supabase OTP to:', formData.email);
      const otpResult = await sendSignupOTP(formData.email);
      
      if (!otpResult.success) {
        setError(otpResult.error || 'Failed to send OTP. Please try again.');
        setIsLoading(false);
        return;
      }

      // Step 3: Store user data and show OTP verification
      const userData = {
        name: formData.name,
        email: formData.email,
        role: userType,
        phoneNumber: formData.phoneNumber,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        ...(userType === 'doctor' 
          ? { 
              specialization: formData.specialization,
              licenseNumber: formData.licenseNumber
            }
          : {}
        )
      };

      const additionalData = userType === 'doctor' ? {
        specialization: formData.specialization,
        experienceYears: formData.experienceYears.trim() ? parseInt(formData.experienceYears) : 0,
        consultationFee: formData.consultationFee.trim() ? parseFloat(formData.consultationFee) : 0,
        languages: ['English'],
        qualifications: [],
        hospitalAffiliation: ''
      } : undefined;

      // Store data for after OTP verification
      setFormData(prev => ({ ...prev, _userData: userData, _additionalData: additionalData }));
      setShowOTPVerification(true);
      setSignupCooldown(60);
      
    } catch (err) {
      console.error('💥 Signup error:', err);
      setError('An error occurred during registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSignup = () => {
    setShowOTPVerification(false);
  };

  const handleOTPVerificationSuccess = async () => {
    console.log('✅ OTP verification successful! Setting up user profile...');
    
    // After OTP verification, Supabase has already created the user
    // Now we need to set their password and create their profile
    setIsLoading(true);
    try {
      const userData = formData._userData;
      const additionalData = formData._additionalData;

      if (!userData) {
        setError('Session expired. Please start the signup process again.');
        setShowOTPVerification(false);
        setIsLoading(false);
        return;
      }

      // Get the current user from Supabase (created after OTP verification)
      const { supabase } = await import('../lib/supabase');
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('User not found after OTP verification. Please try again.');
      }

      // Update user password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (passwordError) {
        throw new Error(`Failed to set password: ${passwordError.message}`);
      }

      // Update user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          name: userData.name,
          role: userData.role
        }
      });

      if (metadataError) {
        console.warn('Failed to update metadata:', metadataError);
      }

      // Create user profile in database
      console.log('📝 Calling signup function with data:', {
        userData,
        additionalData,
        hasPassword: !!formData.password
      });
      
      const success = await signup(userData, formData.password, additionalData);
      
      console.log('📝 Signup function returned:', success);
      
      if (success) {
        console.log('✅ Signup successful - user profile created');
        // User is now authenticated and will be automatically redirected to dashboard
        // No popup needed - dashboard will open automatically
      } else {
        const errorMsg = 'Failed to create profile. Please check the console for details and try again.';
        console.error('❌ Signup failed - profile not created');
        setError(errorMsg);
        setShowOTPVerification(false);
        alert(`❌ Account Setup Failed\n\n${errorMsg}\n\nPlease check the browser console for detailed error messages.`);
      }
    } catch (err: any) {
      console.error('💥 Account setup error:', err);
      const errorMessage = err.message || 'An error occurred while setting up your account. Please try again.';
      setError(errorMessage);
      setShowOTPVerification(false);
      
      // Show alert with detailed error
      alert(`❌ Account Setup Failed\n\n${errorMessage}\n\nIf you see "RLS policies" in the error, please check your Supabase Row Level Security settings.\n\nCheck the browser console (F12) for more details.`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (signupCooldown > 0) {
      const timer = setTimeout(() => setSignupCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [signupCooldown]);

  if (showOTPVerification) {
    return (
      <OTPVerification
        email={formData.email}
        onVerificationSuccess={handleOTPVerificationSuccess}
        onBackToSignup={handleBackToSignup}
        initialCooldown={60}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        {/* Header */}
      <div className="absolute top-8 left-1/2 transform -translate-x-1/2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="relative">
              <Shield className="w-12 h-12 text-cyan-400" />
              <motion.div 
                className="absolute inset-0 rounded-full border-2 border-cyan-400/30"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              BrainGuard AI
            </h1>
          </div>
          <p className="text-gray-300 text-lg">
            Join the future of medical AI diagnostics
          </p>
        </motion.div>
      </div>

      <div className="w-full max-w-4xl mt-32">
            {/* User Type Selection */}
        <div className="flex justify-center mb-8">
          <div className="grid grid-cols-2 gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setUserType('patient')}
              className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                userType === 'patient'
                  ? 'border-cyan-400 bg-gray-800/80 text-cyan-400'
                  : 'border-gray-600 bg-gray-800/50 text-gray-400 hover:border-gray-500'
              }`}
              >
              <User className="w-8 h-8 mx-auto mb-3 text-white" />
              <div className={`font-semibold text-lg ${userType === 'patient' ? 'text-cyan-400' : 'text-white'}`}>Patient</div>
              <div className="text-sm text-gray-400">Access your scans</div>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setUserType('doctor')}
              className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                userType === 'doctor'
                  ? 'border-cyan-400 bg-gray-800/80 text-cyan-400'
                  : 'border-gray-600 bg-gray-800/50 text-gray-400 hover:border-gray-500'
              }`}
              >
              <Stethoscope className="w-8 h-8 mx-auto mb-3 text-white" />
              <div className={`font-semibold text-lg ${userType === 'doctor' ? 'text-cyan-400' : 'text-white'}`}>Doctor</div>
              <div className="text-sm text-gray-400">Medical dashboard</div>
              </motion.button>
          </div>
        </div>

        {/* Main Form */}
            <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-gray-800/60 backdrop-blur-lg rounded-2xl p-8 border border-gray-700/50 shadow-2xl max-w-4xl mx-auto"
        >
          {/* Form Header */}
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-white">
              {userType === 'patient' ? 'Patient Registration' : 'Doctor Registration'}
            </h2>
            <button
              onClick={onBackToLogin}
              className="text-white hover:text-gray-300 transition-colors"
            >
              ← Back to Login
            </button>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                  placeholder="Enter your phone number"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Gender
                </label>
                <div className="relative">
                  <select
                    value={formData.gender}
                    onChange={(e) => handleInputChange('gender', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300 appearance-none"
                  >
                    <option value="" className="bg-gray-700">Select gender</option>
                    <option value="male" className="bg-gray-700">Male</option>
                    <option value="female" className="bg-gray-700">Female</option>
                  </select>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* License Number (Doctor only) - Swapped with Password */}
              {userType === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    License Number *
                  </label>
                  <input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => handleInputChange('licenseNumber', e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    placeholder="Enter your license number (PMC-1234)"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Format: PMC-1234</p>
                </div>
              )}

              {/* Confirm Password - On left column */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    placeholder="Confirm your password"
                    required
                  />
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                  placeholder="Enter your email"
                  required
                />
              </div>

              {/* Date of Birth (Both Patient and Doctor) */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Date of Birth
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.dateOfBirth}
                    onChange={(e) => {
                      let value = e.target.value;
                      
                      // Remove all non-numeric characters
                      value = value.replace(/\D/g, '');
                      
                      // Format as DD/MM/YYYY
                      if (value.length >= 1) {
                        if (value.length <= 2) {
                          // Just day (DD)
                          value = value;
                        } else if (value.length <= 4) {
                          // Day and month (DD/MM)
                          value = value.substring(0, 2) + '/' + value.substring(2);
                        } else if (value.length <= 8) {
                          // Day, month, and year (DD/MM/YYYY)
                          value = value.substring(0, 2) + '/' + value.substring(2, 4) + '/' + value.substring(4, 8);
                        } else {
                          // Limit to 8 digits total (DDMMYYYY)
                          value = value.substring(0, 8);
                          value = value.substring(0, 2) + '/' + value.substring(2, 4) + '/' + value.substring(4, 8);
                        }
                      }
                      
                      handleInputChange('dateOfBirth', value);
                    }}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-4 py-3 pr-12 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    maxLength={10}
                  />
                  <input
                    type="date"
                    onChange={(e) => {
                      if (e.target.value) {
                        // Convert from YYYY-MM-DD to DD/MM/YYYY
                        const [year, month, day] = e.target.value.split('-');
                        const formattedDate = `${day}/${month}/${year}`;
                        handleInputChange('dateOfBirth', formattedDate);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" style={{ zIndex: 2 }} />
                </div>
              </div>

              {/* Specialization (Doctor) */}
              {userType === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Specialization *
                  </label>
                  <div className="relative">
                    <select
                      value={formData.specialization}
                      onChange={(e) => handleInputChange('specialization', e.target.value)}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all duration-300 appearance-none"
                      required
                    >
                      <option value="" className="bg-slate-700">Select specialization</option>
                      <option value="Cardiology" className="bg-slate-700">Cardiology</option>
                      <option value="Neurology" className="bg-slate-700">Neurology</option>
                      <option value="Radiology" className="bg-slate-700">Radiology</option>
                      <option value="Oncology" className="bg-slate-700">Oncology</option>
                      <option value="Psychiatry" className="bg-slate-700">Psychiatry</option>
                      <option value="General Medicine" className="bg-slate-700">General Medicine</option>
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Experience Years (Doctor) */}
              {userType === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={formData.experienceYears}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow numbers
                      if (value === '' || /^\d+$/.test(value)) {
                        handleInputChange('experienceYears', value);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    placeholder="Enter years of experience (optional)"
                  />
                  <p className="text-xs text-gray-400 mt-1">You can update this later in your profile</p>
                </div>
              )}

              {/* Consultation Fee (Doctor) */}
              {userType === 'doctor' && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Consultation Fee (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.consultationFee}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow numbers and decimals
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        handleInputChange('consultationFee', value);
                      }
                    }}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    placeholder="Enter consultation fee in PKR (optional)"
                  />
                  <p className="text-xs text-gray-400 mt-1">You can set this later in your profile</p>
                </div>
              )}

              {/* Password - Swapped with License Number */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                    placeholder="Create a password"
                    required
                  />
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

            {/* Error Message */}
            {error && (
            <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-center">
              {error}
            </div>
          )}

          {/* Create Account Button */}
          <div className="mt-8">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSignup}
              disabled={isLoading || signupCooldown > 0}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-4 px-6 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  {signupCooldown > 0 ? `Please wait ${signupCooldown}s` : 'Create Account'}
                  <ArrowLeft className="w-5 h-5 rotate-180" />
                </>
              )}
            </motion.button>
            {signupCooldown > 0 && (
              <p className="text-center text-sm text-gray-400 mt-2">
                You can request a new OTP in {signupCooldown}s
              </p>
            )}
          </div>

          {/* Legal Text */}
          <div className="mt-6 text-center text-gray-400 text-sm">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-cyan-400 hover:text-cyan-300">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-cyan-400 hover:text-cyan-300">Privacy Policy</a>
          </div>

          {/* Sign In Link */}
          <div className="mt-4 text-center text-gray-400 text-sm">
            Already have an account?{' '}
            <button
              onClick={onBackToLogin}
              className="text-cyan-400 hover:text-cyan-300 font-medium"
            >
              Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;