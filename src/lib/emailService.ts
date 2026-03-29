// Email service for sending OTP emails
// Supports Resend (recommended) via backend proxy or Supabase Edge Functions

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const envApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = envApiBase.length > 0 ? envApiBase : 'http://localhost:8000';

// Get email service configuration from environment variables
const getEmailConfig = () => {
  const emailService = import.meta.env.VITE_EMAIL_SERVICE || 'resend'; // 'resend', 'supabase', or 'none'
  
  return {
    emailService,
  };
};

// Send email using backend Resend proxy
const sendViaResend = async (email: string, otp: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/email/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, otp }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || `Backend email error (${response.status})`;
      throw new Error(errorMessage);
    }

    const result = await response.json().catch(() => ({}));
    console.log('✅ Email sent successfully via Resend to:', email);
    if (result.email_id) {
      console.log('📧 Email ID:', result.email_id);
    }
    return true;
  } catch (error: any) {
    console.error('❌ Resend email error:', error);
    throw error;
  }
};

// Send email using Supabase Edge Function
const sendViaSupabase = async (email: string, otp: string): Promise<boolean> => {
  try {
    const { supabase } = await import('./supabase');
    
    const { data, error } = await supabase.functions.invoke('send-otp-email', {
      body: { email, otp },
    });

    if (error) {
      throw error;
    }

    console.log('✅ Email sent successfully via Supabase Edge Function to:', email);
    return true;
  } catch (error: any) {
    console.error('❌ Supabase Edge Function error:', error);
    throw error;
  }
};

// Main function to send OTP email
export const sendOTPEmail = async (email: string, otp: string): Promise<boolean> => {
  try {
    const config = getEmailConfig();
    
    console.log('📧 Sending OTP email to:', email);
    console.log('📧 Using email service:', config.emailService);

    // Route to appropriate email service
    switch (config.emailService.toLowerCase()) {
      case 'resend':
        return await sendViaResend(email, otp);

      case 'supabase':
        return await sendViaSupabase(email, otp);
      
      case 'none':
      default:
        // Fallback: Log to console (for development) - NO POPUP
        console.log('📧 Email service not configured.');
        console.log('📧 OTP for', email, ':', otp);
        console.log('📧 To enable email sending, see EMAIL_SETUP.md or configure:');
        console.log('   1. Resend: Ensure backend RESEND_API_KEY/RESEND_FROM_EMAIL are set and backend is running');
        console.log('   2. Supabase Edge Function: Set VITE_EMAIL_SERVICE=supabase and create send-otp-email function');
        
        // Still return true so signup can continue (for development)
        // User can check console for OTP during development
        return true;
    }
  } catch (error: any) {
    console.error('❌ Failed to send OTP email:', error);
    // Return false to indicate failure
    return false;
  }
};

// Example of how to integrate with SendGrid (uncomment and configure if needed)
/*
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const sendOTPEmailWithSendGrid = async (email: string, otp: string): Promise<boolean> => {
  try {
    const msg = {
      to: email,
      from: 'noreply@brainguardai.com', // Your verified sender email
      subject: 'BrainGuard AI - Email Verification',
      html: emailContent, // Use the HTML content from above
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('SendGrid error:', error);
    return false;
  }
};
*/

