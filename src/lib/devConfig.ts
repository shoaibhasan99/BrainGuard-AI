// Development configuration for Supabase
// This file helps bypass email confirmation issues during development

export const DEVELOPMENT_CONFIG = {
  // Set to true to bypass email confirmation
  BYPASS_EMAIL_CONFIRMATION: true,
  
  // Development message for users
  DEV_MESSAGE: "🚧 Development Mode: Using Supabase authentication only.",
  
  // Default OTP for development
  DEV_OTP: "123456",
  
  // Fallback authentication disabled - only use Supabase
  FALLBACK_AUTH: false
};

// Helper function to check if we're in development mode
export const isDevelopment = () => {
  return import.meta.env.DEV || DEVELOPMENT_CONFIG.BYPASS_EMAIL_CONFIRMATION;
};

// Helper function to get development message
export const getDevMessage = () => {
  return DEVELOPMENT_CONFIG.DEV_MESSAGE;
};

// Helper function to get development OTP
export const getDevOTP = () => {
  return DEVELOPMENT_CONFIG.DEV_OTP;
};

// Helper function to clear fallback user (useful for testing)
export const clearFallbackUser = () => {
  localStorage.removeItem('simpleUser');
  console.log('🧹 Cleared fallback user from localStorage');
};

// Helper function to get fallback user
export const getFallbackUser = () => {
  const user = localStorage.getItem('simpleUser');
  return user ? JSON.parse(user) : null;
};
