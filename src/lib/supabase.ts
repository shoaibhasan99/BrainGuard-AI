import { createClient } from '@supabase/supabase-js';

// Supabase configuration - HARDCODED FOR IMMEDIATE FIX
const supabaseUrl = 'https://qzqcojqqxnnyfsoedxfl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6cWNvanFxeG5ueWZzb2VkeGZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MjcwNzUsImV4cCI6MjA3OTEwMzA3NX0.uSHMKFHGF-PDgaE8xHDtRkC9_nUOlMbtNG3swAfCsIM';

// Debug logging
console.log('🔍 Supabase Configuration (HARDCODED):');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey ? 'Present' : 'Missing');

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Disable email confirmation for development
    flowType: 'implicit'
  },
  global: {
    headers: {
      'X-Client-Info': 'brain-guard-frontend'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database types for TypeScript
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'patient' | 'doctor';
          avatar_url?: string;
          phone_number?: string;
          gender?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role: 'patient' | 'doctor';
          avatar_url?: string;
          phone_number?: string;
          gender?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'patient' | 'doctor';
          avatar_url?: string;
          phone_number?: string;
          gender?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      patients: {
        Row: {
          id: string;
          user_id: string;
          date_of_birth?: string;
          medical_history?: string;
          emergency_contact?: string;
          insurance_info?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          date_of_birth?: string;
          medical_history?: string;
          emergency_contact?: string;
          insurance_info?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date_of_birth?: string;
          medical_history?: string;
          emergency_contact?: string;
          insurance_info?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      doctors: {
        Row: {
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          specialization: string;
          license_number: string;
          experience_years: number;
          hospital_affiliation?: string;
          consultation_fee: number;
          languages: string[];
          qualifications: string[];
          date_of_birth?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          specialization?: string;
          license_number?: string;
          experience_years?: number;
          hospital_affiliation?: string;
          consultation_fee?: number;
          languages?: string[];
          qualifications?: string[];
          date_of_birth?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          appointment_date: string;
          appointment_time: string;
          appointment_type: 'consultation' | 'follow-up' | 'emergency';
          status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled' | 'missed';
          notes?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          doctor_id: string;
          appointment_date: string;
          appointment_time: string;
          appointment_type: 'consultation' | 'follow-up' | 'emergency';
          status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          doctor_id?: string;
          appointment_date?: string;
          appointment_time?: string;
          appointment_type?: 'consultation' | 'follow-up' | 'emergency';
          status?: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      appointment_notifications: {
        Row: {
          id: string;
          appointment_id: string;
          user_id: string;
          role: 'patient' | 'doctor';
          message: string;
          scheduled_for: string;
          lead_minutes: number;
          status: 'pending' | 'sent' | 'seen' | 'dismissed';
          created_at: string;
          sent_at?: string;
          seen_at?: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          user_id: string;
          role: 'patient' | 'doctor';
          message: string;
          scheduled_for: string;
          lead_minutes?: number;
          status?: 'pending' | 'sent' | 'seen' | 'dismissed';
          created_at?: string;
          sent_at?: string;
          seen_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          user_id?: string;
          role?: 'patient' | 'doctor';
          message?: string;
          scheduled_for?: string;
          lead_minutes?: number;
          status?: 'pending' | 'sent' | 'seen' | 'dismissed';
          created_at?: string;
          sent_at?: string;
          seen_at?: string;
        };
      };
      scans: {
        Row: {
          id: string;
          patient_id: string;
          doctor_id: string;
          appointment_id?: string;
          scan_type: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          ai_analysis?: string;
          confidence_score?: number;
          findings?: string;
          status: 'uploaded' | 'processing' | 'completed' | 'failed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          doctor_id: string;
          appointment_id?: string;
          scan_type: string;
          file_path: string;
          file_size: number;
          mime_type: string;
          ai_analysis?: string;
          confidence_score?: number;
          findings?: string;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          patient_id?: string;
          doctor_id?: string;
          appointment_id?: string;
          scan_type?: string;
          file_path?: string;
          file_size?: number;
          mime_type?: string;
          ai_analysis?: string;
          confidence_score?: number;
          findings?: string;
          status?: 'uploaded' | 'processing' | 'completed' | 'failed';
          created_at?: string;
          updated_at?: string;
        };
      };
      reports: {
        Row: {
          id: string;
          scan_id: string;
          patient_id: string;
          doctor_id: string;
          report_title: string;
          summary: string;
          recommendations: string[];
          report_data: any; // JSON data
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          scan_id: string;
          patient_id: string;
          doctor_id: string;
          report_title: string;
          summary: string;
          recommendations: string[];
          report_data?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          scan_id?: string;
          patient_id?: string;
          doctor_id?: string;
          report_title?: string;
          summary?: string;
          recommendations?: string[];
          report_data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
