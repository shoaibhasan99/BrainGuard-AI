import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface OTPVerificationProps {
  email: string;
  onVerificationSuccess: () => void;
  onBackToSignup: () => void;
  initialCooldown?: number;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({
  email,
  onVerificationSuccess,
  onBackToSignup,
  initialCooldown = 0
}) => {
  const { sendSignupOTP, verifyOTP } = useAuth();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(initialCooldown);

  // Resend OTP using Supabase
  const resendOTP = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const result = await sendSignupOTP(email);
      
      if (result.success) {
        setResendTimer(60); // 60 seconds cooldown
        setError('');
      } else {
        setError(result.error || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setError(`Failed to resend OTP: ${err.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP using Supabase
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log('🔐 Verifying OTP with Supabase:', otp);
      
      const result = await verifyOTP(email, otp);

      if (result.success) {
        setSuccess(true);
        
        // Show success message and navigate
        setTimeout(() => {
          onVerificationSuccess();
        }, 1500);
      } else {
        setError(result.error || 'Invalid OTP. Please check and try again.');
      }

    } catch (error: any) {
      setError(`Verification failed: ${error.message || error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Resend timer
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verify Your Email</h2>
          <p className="text-gray-400">
            We've sent a 6-digit verification code to<br />
            <span className="text-blue-400 font-medium">{email}</span>
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Please check your email and enter the code below
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-600 rounded-lg text-white text-center">
            <div className="flex items-center justify-center mb-2">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Verification Successful!
            </div>
            <p className="text-sm">Redirecting to login page...</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter OTP
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="000000"
              maxLength={6}
              disabled={isLoading || success}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-600 rounded-lg text-white text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleVerifyOTP}
            disabled={isLoading || success || otp.length !== 6}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </button>

          <div className="text-center">
            <button
              onClick={resendOTP}
              disabled={resendTimer > 0 || isLoading || success}
              className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed text-sm"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={onBackToSignup}
              className="text-gray-400 hover:text-gray-300 text-sm"
            >
              ← Back to Signup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
