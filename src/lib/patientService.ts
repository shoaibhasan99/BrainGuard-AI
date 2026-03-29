/**
 * Patient Service for Doctor Dashboard
 * This service fetches real patients from Supabase for doctor-patient communication
 */

import { supabase } from './supabase';
import { patientOperations } from './supabase-operations';

export interface PatientForDoctor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  medicalHistory?: string;
  emergencyContact?: string;
  insuranceInfo?: string;
  lastActive?: string;
  hasReports: boolean;
  reportCount: number;
  lastReportDate?: string;
  unreadMessages?: number;
}

export interface DoctorPatientChat {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isOnline: boolean;
  lastActive: string;
}

class PatientService {
  // Get all patients for doctor dashboard
  async getAllPatientsForDoctor(): Promise<PatientForDoctor[]> {
    try {
      console.log('🔍 Fetching patients from Supabase...');
      
      // Get all users with patient role
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          phone_number,
          avatar_url,
          created_at,
          updated_at
        `)
        .eq('role', 'patient')
        .order('created_at', { ascending: false });

      console.log('👥 Users query result:', { users, usersError });

      if (usersError) {
        console.error('Error fetching patient users:', usersError);
        return [];
      }

      if (!users || users.length === 0) {
        return [];
      }

      // Get patient profiles for each user
      const patientsWithProfiles = await Promise.all(
        users.map(async (user) => {
          try {
            // Get patient profile
            const { data: patientProfile } = await supabase
              .from('patients')
              .select('*')
              .eq('user_id', user.id)
              .single();

            // Get patient's reports count
            const { data: reports } = await supabase
              .from('reports')
              .select('id, created_at')
              .eq('patient_id', patientProfile?.id || user.id);

            // Get last report date
            const lastReport = reports && reports.length > 0 
              ? reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
              : null;

            // Get unread messages count (if chat system is available)
            const { data: unreadMessages } = await supabase
              .from('chat_messages')
              .select('id')
              .eq('sender_type', 'patient')
              .eq('read', false)
              .not('sender_id', 'eq', user.id); // Messages from this patient

            return {
              id: patientProfile?.id || user.id,
              userId: user.id,
              name: user.name,
              email: user.email,
              phoneNumber: user.phone_number,
              avatarUrl: user.avatar_url,
              dateOfBirth: patientProfile?.date_of_birth,
              medicalHistory: patientProfile?.medical_history,
              emergencyContact: patientProfile?.emergency_contact,
              insuranceInfo: patientProfile?.insurance_info,
              lastActive: user.updated_at,
              hasReports: reports && reports.length > 0,
              reportCount: reports ? reports.length : 0,
              lastReportDate: lastReport?.created_at,
              unreadMessages: unreadMessages ? unreadMessages.length : 0
            };
          } catch (error) {
            console.error(`Error fetching profile for user ${user.id}:`, error);
            return {
              id: user.id,
              userId: user.id,
              name: user.name,
              email: user.email,
              phoneNumber: user.phone_number,
              avatarUrl: user.avatar_url,
              lastActive: user.updated_at,
              hasReports: false,
              reportCount: 0,
              unreadMessages: 0
            };
          }
        })
      );

      return patientsWithProfiles;
    } catch (error) {
      console.error('Error fetching patients for doctor:', error);
      return [];
    }
  }

  // Get patients with chat history for doctor
  async getPatientsWithChatHistory(doctorId: string): Promise<DoctorPatientChat[]> {
    try {
      // Get all chats for this doctor
      const { data: chats, error: chatsError } = await supabase
        .from('chats')
        .select(`
          id,
          patient_id,
          doctor_id,
          last_message,
          last_message_time,
          unread_count,
          created_at,
          updated_at,
          patients:patients(
            id,
            user_id,
            users:users(
              id,
              name,
              email,
              avatar_url,
              updated_at
            )
          )
        `)
        .eq('doctor_id', doctorId)
        .order('last_message_time', { ascending: false });

      if (chatsError) {
        console.error('Error fetching chats:', chatsError);
        return [];
      }

      if (!chats || chats.length === 0) {
        return [];
      }

      return chats.map(chat => ({
        id: chat.id,
        patientId: chat.patient_id,
        patientName: chat.patients?.users?.name || 'Unknown Patient',
        patientEmail: chat.patients?.users?.email || '',
        lastMessage: chat.last_message,
        lastMessageTime: chat.last_message_time,
        unreadCount: chat.unread_count || 0,
        isOnline: this.isUserOnline(chat.patients?.users?.updated_at),
        lastActive: chat.patients?.users?.updated_at || chat.updated_at
      }));
    } catch (error) {
      console.error('Error fetching patients with chat history:', error);
      return [];
    }
  }

  // Get patient details for doctor
  async getPatientDetailsForDoctor(patientId: string): Promise<PatientForDoctor | null> {
    try {
      // Get patient profile with user info
      const { data: patient, error } = await supabase
        .from('patients')
        .select(`
          *,
          users:users(
            id,
            name,
            email,
            phone_number,
            avatar_url,
            created_at,
            updated_at
          )
        `)
        .eq('id', patientId)
        .single();

      if (error) {
        console.error('Error fetching patient details:', error);
        return null;
      }

      if (!patient) {
        return null;
      }

      // Get patient's reports
      const { data: reports } = await supabase
        .from('reports')
        .select('id, created_at')
        .eq('patient_id', patientId);

      // Get last report date
      const lastReport = reports && reports.length > 0 
        ? reports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

      return {
        id: patient.id,
        userId: patient.users.id,
        name: patient.users.name,
        email: patient.users.email,
        phoneNumber: patient.users.phone_number,
        avatarUrl: patient.users.avatar_url,
        dateOfBirth: patient.date_of_birth,
        medicalHistory: patient.medical_history,
        emergencyContact: patient.emergency_contact,
        insuranceInfo: patient.insurance_info,
        lastActive: patient.users.updated_at,
        hasReports: reports && reports.length > 0,
        reportCount: reports ? reports.length : 0,
        lastReportDate: lastReport?.created_at,
        unreadMessages: 0 // This would need to be calculated based on chat messages
      };
    } catch (error) {
      console.error('Error fetching patient details:', error);
      return null;
    }
  }

  // Check if user is online (simple implementation)
  private isUserOnline(lastActive: string | undefined): boolean {
    if (!lastActive) return false;
    
    const lastActiveTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    const fiveMinutesAgo = now - (5 * 60 * 1000); // 5 minutes ago
    
    return lastActiveTime > fiveMinutesAgo;
  }

  // Get patient's recent activity
  async getPatientRecentActivity(patientId: string): Promise<{
    reports: any[];
    appointments: any[];
    messages: any[];
  }> {
    try {
      // Get recent reports
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false })
        .limit(5);

      // Get recent messages
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5);

      return {
        reports: reports || [],
        appointments: appointments || [],
        messages: messages || []
      };
    } catch (error) {
      console.error('Error fetching patient activity:', error);
      return { reports: [], appointments: [], messages: [] };
    }
  }
}

// Export singleton instance
export const patientService = new PatientService();
export default patientService;
