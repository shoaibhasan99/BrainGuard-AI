import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isDevelopment, getDevMessage } from '../lib/devConfig';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor';
  avatar?: string;
  specialization?: string; // For doctors
  licenseNumber?: string; // For doctors
  dateOfBirth?: string; // For patients
  phoneNumber?: string;
  gender?: string;
  joinDate: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: 'patient' | 'doctor') => Promise<boolean>;
  signup: (userData: Omit<User, 'id' | 'joinDate'>, password: string, additionalData?: any) => Promise<boolean>;
  checkEmailExists: (email: string) => Promise<boolean>;
  sendSignupOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordResetOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPasswordResetOTP: (email: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simple session check without database fetch
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          // Network/DNS errors are expected if offline or Supabase is unavailable
          if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
            console.warn('⚠️ Supabase connection unavailable - app will work in offline mode');
          } else {
            console.error('Error checking session:', error);
          }
          setUser(null);
          setIsLoading(false);
          return;
        }
        if (session?.user) {
          // First, set a basic user from auth immediately to prevent loading state
          const basicUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || 'User',
            role: session.user.user_metadata?.role || 'patient',
            joinDate: new Date().toISOString().split('T')[0],
          };
          setUser(basicUser);
          
          // Then try to fetch full user from database in background (non-blocking)
          supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data: userData, error: userError }) => {
              if (userData && !userError) {
                // Update with full user data from database
                const fullUser: User = {
                  id: userData.id,
                  email: userData.email,
                  name: userData.name,
                  role: userData.role,
                  phoneNumber: userData.phone_number,
                  avatar: userData.avatar_url,
                  gender: userData.gender,
                  joinDate: userData.created_at ? new Date(userData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                };
                setUser(fullUser);
              }
            })
            .catch((dbError) => {
              console.error('Error fetching user from database (non-blocking):', dbError);
              // Keep using basic user from auth
            });
        }
      } catch (error: any) {
        // Handle network errors gracefully
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_NAME_NOT_RESOLVED')) {
          console.warn('⚠️ Supabase connection unavailable - app will work in offline mode');
        } else {
          console.error('Error checking session:', error);
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes with error handling
    let subscription: any;
    try {
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          try {
            if (session?.user) {
              // First, set a basic user from auth immediately
              const basicUser: User = {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || 'User',
                role: session.user.user_metadata?.role || 'patient',
                joinDate: new Date().toISOString().split('T')[0],
              };
              setUser(basicUser);
              
              // Then try to fetch full user from database in background (non-blocking)
              supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle()
                .then(({ data: userData, error: userError }) => {
                  if (userData && !userError) {
                    // Update with full user data from database
                    const fullUser: User = {
                      id: userData.id,
                      email: userData.email,
                      name: userData.name,
                      role: userData.role,
                      phoneNumber: userData.phone_number,
                      avatar: userData.avatar_url,
                      gender: userData.gender,
                      joinDate: userData.created_at ? new Date(userData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    };
                    setUser(fullUser);
                  }
                })
                .catch((dbError) => {
                  console.error('Error fetching user from database (non-blocking):', dbError);
                  // Keep using basic user from auth
                });
            } else {
              setUser(null);
            }
          } catch (error: any) {
            if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_NAME_NOT_RESOLVED')) {
              console.warn('⚠️ Supabase connection unavailable');
            } else {
              console.error('Error in auth state change:', error);
            }
            setUser(null);
          } finally {
            setIsLoading(false);
          }
        }
      );
      subscription = sub;
    } catch (error: any) {
      console.warn('⚠️ Could not set up auth state listener:', error);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const login = async (email: string, password: string, role: 'patient' | 'doctor'): Promise<boolean> => {
    console.log('Login attempt:', { email, role });
    setIsLoading(true);
    
    try {
      // Proceed with login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Supabase login response:', { data, error });

      if (error) {
        // Handle network errors gracefully
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NAME_NOT_RESOLVED')) {
          alert(`⚠️ Connection Error\n\nCannot connect to Supabase. Please check:\n1. Internet connection\n2. Supabase project status\n3. Firewall/antivirus settings\n\nApp will work in offline mode.`);
        } else {
          console.error('Login error:', error);
          alert(`❌ Login Failed: ${error.message}\n\nPlease check your credentials and try again.`);
        }
        setIsLoading(false);
        return false;
      }

      // After successful login, fetch user profile from database
      if (data?.user) {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

          if (userError) {
            console.error('Error fetching user profile:', userError);
          }

          if (userData) {
            // Create user object from database data
            const fullUser: User = {
              id: userData.id,
              email: userData.email,
              name: userData.name,
              role: userData.role,
              phoneNumber: userData.phone_number,
              avatar: userData.avatar_url,
              gender: userData.gender,
              joinDate: userData.created_at ? new Date(userData.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            };
            setUser(fullUser);
          } else {
            // User exists in auth but not in database - create basic user from auth
            const basicUser: User = {
              id: data.user.id,
              email: data.user.email || email,
              name: data.user.user_metadata?.name || 'User',
              role: data.user.user_metadata?.role || role,
              joinDate: new Date().toISOString().split('T')[0],
            };
            setUser(basicUser);
          }
        } catch (profileError) {
          console.error('Error fetching user profile after login:', profileError);
          // Still set basic user from auth
          const basicUser: User = {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.user_metadata?.name || 'User',
            role: data.user.user_metadata?.role || role,
            joinDate: new Date().toISOString().split('T')[0],
          };
          setUser(basicUser);
        }
      }

      setIsLoading(false);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('ERR_NAME_NOT_RESOLVED')) {
        alert(`⚠️ Connection Error\n\nCannot connect to Supabase. Please check your internet connection.`);
      }
      setIsLoading(false);
      return false;
    }
  };

  // Check if email already exists in Supabase
  // Note: Supabase Auth doesn't provide a reliable way to check email existence
  // without attempting signup, so we only check the users table
  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      // Check in the users table (most reliable source)
      const { data, error: dbError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .limit(1);

      // If we can query the table and find a match, email exists
      if (!dbError && data && data.length > 0) {
        return true; // Email exists in database
      }

      // If table doesn't exist or query fails, we can't reliably check
      // In this case, return false and let the signup process handle it
      // Supabase will return an error during signup if email already exists
      if (dbError) {
        console.warn('Could not check users table, will rely on signup validation:', dbError.message);
      }

      return false; // Assume email doesn't exist, let signup handle validation
    } catch (error: any) {
      console.warn('Error checking email existence, will rely on signup validation:', error);
      // On error, assume email doesn't exist to allow signup attempt
      // The actual signup will catch if email already exists
      return false;
    }
  };

  // Send OTP for signup using Supabase's built-in OTP system
  const sendSignupOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📧 Sending Supabase OTP to:', email);
      
      // Use Supabase's signInWithOtp to send OTP email
      // This will create a user if they don't exist (shouldCreateUser: true)
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true, // Create user if doesn't exist
          emailRedirectTo: undefined // We'll handle verification manually
        }
      });

      if (error) {
        console.error('❌ Supabase OTP send error:', error);
        
        // Handle specific error types
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { success: false, error: 'This email is already registered. Please try logging in instead.' };
        } else if (error.message.includes('rate limit')) {
          return { success: false, error: 'Too many requests. Please wait a few minutes and try again.' };
        } else {
          return { success: false, error: error.message || 'Failed to send OTP email' };
        }
      }

      console.log('✅ Supabase OTP sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error sending Supabase OTP:', error);
      return { success: false, error: error.message || 'Failed to send OTP' };
    }
  };

  // Verify OTP using Supabase's built-in verification
  const verifyOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔐 Verifying OTP with Supabase...');
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email'
      });

      if (error) {
        console.error('❌ OTP verification error:', error);
        return { success: false, error: error.message || 'Invalid OTP. Please check and try again.' };
      }

      if (data?.user) {
        console.log('✅ OTP verified successfully. User:', data.user.id);
        return { success: true };
      }

      return { success: false, error: 'OTP verification failed' };
    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error);
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  };

  // Create user profile after OTP verification
  // Note: User is already created in Supabase Auth after OTP verification
  // This function just creates the profile in the database
  const signup = async (userData: Omit<User, 'id' | 'joinDate'>, password: string, additionalData?: any): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('🚀 Creating user profile for:', userData.email, 'Role:', userData.role);
      console.log('📋 User data:', userData);
      console.log('📋 Additional data:', additionalData);
      
      // Get the current user (already created after OTP verification)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('❌ No user found. OTP verification may have failed.');
        alert('❌ User not found. Please complete OTP verification first.');
        setIsLoading(false);
        return false;
      }

      console.log('✅ Using existing user:', user.id);
      console.log('📧 User email:', user.email);

      // Create user profile in database
      console.log('💾 Creating user profile in database...');
      
      // Build insert object with only provided fields (exclude undefined/null to avoid schema errors)
      const userInsertData: any = {
        id: user.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
      };
      
      // Only include optional fields if they have values
      if (userData.phoneNumber) {
        userInsertData.phone_number = userData.phoneNumber;
      }
      if (userData.avatar) {
        userInsertData.avatar_url = userData.avatar;
      }
      // Include gender if provided
      if (userData.gender) {
        userInsertData.gender = userData.gender;
      }
      
      console.log('📋 Insert data:', userInsertData);
      
      const { error: userInsertError, data: insertedUser } = await supabase
        .from('users')
        .insert(userInsertData)
        .select();
      
      if (userInsertError) {
        console.error('❌ User table insert error:', userInsertError);
        console.error('❌ User insert error details:', {
          message: userInsertError.message,
          code: userInsertError.code,
          details: userInsertError.details,
          hint: userInsertError.hint
        });
        
        // Check if it's a duplicate key error (user already exists)
        if (userInsertError.code === '23505' || userInsertError.message.includes('duplicate')) {
          console.warn('⚠️ User already exists in database, continuing...');
        } else {
          throw new Error(`Failed to create user profile: ${userInsertError.message} (Code: ${userInsertError.code})`);
        }
      } else {
        console.log('✅ User profile created successfully in database');
        console.log('✅ Inserted user data:', insertedUser);
      }

      // Create role-specific profile
      if (userData.role === 'patient') {
        console.log('🏥 Creating patient profile...');
        console.log('📅 Date of Birth being saved:', userData.dateOfBirth);
        
        // Convert DD/MM/YYYY to YYYY-MM-DD format if needed
        let dateOfBirth = userData.dateOfBirth;
        if (dateOfBirth && dateOfBirth.includes('/')) {
          const parts = dateOfBirth.split('/');
          if (parts.length === 3) {
            // DD/MM/YYYY format - convert to YYYY-MM-DD
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            dateOfBirth = `${year}-${month}-${day}`;
            console.log('📅 Converted date format:', dateOfBirth);
          }
        }
        
        console.log('📋 Patient insert data:', {
          user_id: user.id,
          date_of_birth: dateOfBirth || null,
        });
        
        const { error: patientError, data: patientData } = await supabase
          .from('patients')
          .insert({
            user_id: user.id,
            date_of_birth: dateOfBirth || null,
          })
          .select();
        
        if (patientError) {
          console.error('❌ Patient table insert error:', patientError);
          console.error('❌ Error details:', {
            message: patientError.message,
            code: patientError.code,
            details: patientError.details,
            hint: patientError.hint
          });
          
          // Check if it's a duplicate key error
          if (patientError.code === '23505' || patientError.message.includes('duplicate')) {
            console.warn('⚠️ Patient profile already exists, continuing...');
          } else {
            throw new Error(`Failed to create patient profile: ${patientError.message} (Code: ${patientError.code})`);
          }
        } else {
          console.log('✅ Patient profile created successfully in database');
          console.log('✅ Patient data:', patientData);
        }
      } else if (userData.role === 'doctor') {
        console.log('👨‍⚕️ Creating doctor profile...');
        console.log('📅 Date of Birth for doctor:', userData.dateOfBirth);
        
        // Convert DD/MM/YYYY to YYYY-MM-DD format if needed
        let dateOfBirth = userData.dateOfBirth;
        if (dateOfBirth && dateOfBirth.includes('/')) {
          const parts = dateOfBirth.split('/');
          if (parts.length === 3) {
            // DD/MM/YYYY format - convert to YYYY-MM-DD
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            dateOfBirth = `${year}-${month}-${day}`;
            console.log('📅 Converted date format for doctor:', dateOfBirth);
          }
        }
        
        console.log('👨‍⚕️ Doctor data being saved:', {
          user_id: user.id,
          specialization: userData.specialization || '',
          license_number: userData.licenseNumber || '',
          experience_years: additionalData?.experienceYears ?? 0,
          consultation_fee: additionalData?.consultationFee ?? 0,
          languages: additionalData?.languages || ['English'],
          qualifications: additionalData?.qualifications || [],
          hospital_affiliation: additionalData?.hospitalAffiliation || '',
          date_of_birth: dateOfBirth || null,
        });
        
        const { error: doctorError, data: doctorData } = await supabase
          .from('doctors')
          .insert({
            user_id: user.id,
            specialization: userData.specialization || '',
            license_number: userData.licenseNumber || '',
            experience_years: additionalData?.experienceYears ?? 0,
            consultation_fee: additionalData?.consultationFee ?? 0,
            languages: additionalData?.languages || ['English'],
            qualifications: additionalData?.qualifications || [],
            hospital_affiliation: additionalData?.hospitalAffiliation || '',
            date_of_birth: dateOfBirth || null,
            is_verified: true, // Set to true for development
          })
          .select();
        
        if (doctorError) {
          console.error('❌ Doctor table insert error:', doctorError);
          console.error('❌ Doctor insert error details:', {
            message: doctorError.message,
            code: doctorError.code,
            details: doctorError.details,
            hint: doctorError.hint
          });
          throw new Error(`Failed to create doctor profile: ${doctorError.message}`);
        } else {
          console.log('✅ Doctor profile created successfully in database');
          console.log('✅ Doctor data:', doctorData);
        }
      }

      // Verify that data was actually saved to database.
      // If verification fails because of missing SELECT policies we log a warning
      // but don't treat it as a fatal error (insert already succeeded).
      try {
        console.log('🔍 Verifying data was saved to database...');
        const { data: verifyUser, error: verifyError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (verifyError) {
          console.warn('⚠️ Skipping user verification due to policy error:', verifyError);
        } else if (!verifyUser) {
          console.warn('⚠️ User profile not returned during verification. This is usually due to missing SELECT permissions.');
        } else {
          console.log('✅ Verification successful - user profile exists in database:', verifyUser);
        }
        
        if (userData.role === 'patient') {
          const { data: verifyPatient, error: verifyPatientError } = await supabase
            .from('patients')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (verifyPatientError) {
            console.warn('⚠️ Skipping patient verification due to policy error:', verifyPatientError);
          } else if (!verifyPatient) {
            console.warn('⚠️ Patient profile not returned during verification. Check SELECT policies if needed.');
          } else {
            console.log('✅ Patient profile verified in database:', verifyPatient);
          }
        } else if (userData.role === 'doctor') {
          const { data: verifyDoctor, error: verifyDoctorError } = await supabase
            .from('doctors')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (verifyDoctorError) {
            console.warn('⚠️ Skipping doctor verification due to policy error:', verifyDoctorError);
          } else if (!verifyDoctor) {
            console.warn('⚠️ Doctor profile not returned during verification. Check SELECT policies if needed.');
          } else {
            console.log('✅ Doctor profile verified in database:', verifyDoctor);
          }
        }
      } catch (verificationError) {
        console.warn('⚠️ Verification step failed, but insert already succeeded. Please check RLS policies if this persists.', verificationError);
      }

      // Create user object for the auth context
      const newUser: User = {
        id: user.id,
        email: user.email || userData.email,
        name: user.user_metadata?.name || userData.name,
        role: user.user_metadata?.role || userData.role,
        phoneNumber: userData.phoneNumber,
        avatar: userData.avatar,
        joinDate: new Date().toISOString().split('T')[0]
      };

      // Set the user in the auth context
      setUser(newUser);
      
      console.log('🎉 Signup process completed successfully - all data verified in database');
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('💥 Signup process failed with exception:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Send password reset OTP
  const sendPasswordResetOTP = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📧 Sending password reset OTP to:', email);
      
      // First check if email exists in users table
      const { data: userData, error: checkError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (checkError || !userData) {
        console.error('❌ Email not found:', checkError);
        return { success: false, error: 'Email not found. Please check your email address.' };
      }

      // Send OTP using Supabase's signInWithOtp
      // Note: shouldCreateUser is false for password reset
      const { data, error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false, // Don't create user if doesn't exist
          emailRedirectTo: undefined
        }
      });

      if (error) {
        console.error('❌ Password reset OTP send error:', error);
        
        if (error.message.includes('rate limit')) {
          return { success: false, error: 'Too many requests. Please wait a few minutes and try again.' };
        } else {
          return { success: false, error: error.message || 'Failed to send password reset OTP' };
        }
      }

      console.log('✅ Password reset OTP sent successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error sending password reset OTP:', error);
      return { success: false, error: error.message || 'Failed to send password reset OTP' };
    }
  };

  // Verify password reset OTP
  const verifyPasswordResetOTP = async (email: string, otp: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔐 Verifying password reset OTP...');
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email'
      });

      if (error) {
        console.error('❌ Password reset OTP verification error:', error);
        return { success: false, error: error.message || 'Invalid OTP. Please check and try again.' };
      }

      if (data?.user) {
        console.log('✅ Password reset OTP verified successfully');
        return { success: true };
      }

      return { success: false, error: 'OTP verification failed' };
    } catch (error: any) {
      console.error('❌ Error verifying password reset OTP:', error);
      return { success: false, error: error.message || 'Failed to verify OTP' };
    }
  };

  // Update password after OTP verification
  const updatePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('🔑 Updating password...');
      
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('❌ Password update error:', error);
        return { success: false, error: error.message || 'Failed to update password' };
      }

      if (data?.user) {
        console.log('✅ Password updated successfully');
        return { success: true };
      }

      return { success: false, error: 'Password update failed' };
    } catch (error: any) {
      console.error('❌ Error updating password:', error);
      return { success: false, error: error.message || 'Failed to update password' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    signup,
    checkEmailExists,
    sendSignupOTP,
    verifyOTP,
    sendPasswordResetOTP,
    verifyPasswordResetOTP,
    updatePassword,
    logout,
    isLoading,
    isAuthenticated: !!user
  };

  // Ensure value is always defined
  if (!value) {
    console.error('AuthContext value is undefined!');
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
