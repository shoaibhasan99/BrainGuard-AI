import { supabase } from './supabase';
import type { Database } from './supabase';

// Type aliases for easier use
type Tables = Database['public']['Tables'];
type Users = Tables['users']['Row'];
type Patients = Tables['patients']['Row'];
type Doctors = Tables['doctors']['Row'];
type Appointments = Tables['appointments']['Row'];
type AppointmentNotification = Tables['appointment_notifications']['Row'];
type Scans = Tables['scans']['Row'];
type Reports = Tables['reports']['Row'];

// User operations
export const userOperations = {
  // Get user profile with role-specific data
  async getUserProfile(userId: string) {
    try {
      // First get the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user:', userError);
        // If it's a "not found" error, check if user exists in auth
        if (userError.code === 'PGRST116' || userError.message.includes('not found')) {
          // Try to get user from auth to verify they exist
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser && authUser.id === userId) {
            throw new Error('User profile not found in database. Please contact support to complete your profile setup.');
          }
        }
        throw userError;
      }
      
      if (!userData) {
        // Check if user exists in auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && authUser.id === userId) {
          throw new Error('User profile not found in database. Please contact support to complete your profile setup.');
        }
        throw new Error('User not found');
      }

      // Get role-specific data based on user role
      let roleData: any = {};
      
      if (userData.role === 'patient') {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (patientError) {
          console.error('Error fetching patient data:', patientError);
          // Don't throw, just log the error and continue
        } else if (patientData) {
          roleData.patients = [patientData];
        }
      } else if (userData.role === 'doctor') {
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (doctorError) {
          console.error('Error fetching doctor data:', doctorError);
          // Don't throw, just log the error and continue
        } else if (doctorData) {
          roleData.doctors = [doctorData];
        }
      }

      // Return the merged data
      return {
        ...userData,
        ...roleData
      };
    } catch (error: any) {
      console.error('Error in getUserProfile:', error);
      throw error;
    }
  },

  // Update user profile
  async updateUserProfile(userId: string, updates: Partial<Users>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Patient operations
export const patientOperations = {
  // Get patient profile
  async getPatientProfile(patientId: string) {
    const { data, error } = await supabase
      .from('patients')
      .select(`
        *,
        users:users(*)
      `)
      .eq('id', patientId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update patient profile
  async updatePatientProfile(patientId: string, updates: Partial<Patients>) {
    const { data, error } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patientId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient's appointments
  async getPatientAppointments(patientId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get patient's scans
  async getPatientScans(patientId: string) {
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};

// Doctor operations
export const doctorOperations = {
  // Get doctor profile
  async getDoctorProfile(doctorId: string) {
    const { data, error } = await supabase
      .from('doctors')
      .select(`
        *,
        users:users(*)
      `)
      .eq('id', doctorId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update doctor profile
  async updateDoctorProfile(doctorId: string, updates: Partial<Doctors>) {
    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', doctorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get doctor's appointments
  async getDoctorAppointments(doctorId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        patients:patients(
          *,
          users:users(*)
        )
      `)
      .eq('doctor_id', doctorId)
      .order('appointment_date', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get doctor's patients
  async getDoctorPatients(doctorId: string) {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        patients:patients(
          *,
          users:users(*)
        )
      `)
      .eq('doctor_id', doctorId);

    if (error) throw error;
    return data.map(apt => apt.patients).filter(Boolean);
  },

  // Search doctors by specialization
  async searchDoctors(specialization?: string, searchTerm?: string) {
    let query = supabase
      .from('doctors')
      .select(`
        *,
        users:users(*)
      `);

    if (specialization && specialization !== 'all') {
      query = query.eq('specialization', specialization);
    }

    if (searchTerm) {
      query = query.or(`specialization.ilike.%${searchTerm}%,users.name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};

// Appointment operations
export const appointmentOperations = {
  // Create appointment
  async createAppointment(appointmentData: Omit<Appointments, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select(`
        *,
        patients:patients(
          *,
          users:users(*)
        ),
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Update appointment
  async updateAppointment(appointmentId: string, updates: Partial<Appointments>) {
    const { data, error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete appointment
  async deleteAppointment(appointmentId: string) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', appointmentId);

    if (error) throw error;
    return true;
  },

  // Get booked time slots for a doctor on a specific date
  async getAvailableTimeSlots(doctorId: string, date: string) {
    const { data, error } = await supabase.rpc('get_doctor_booked_slots', {
      p_doctor_id: doctorId,
      p_appointment_date: date
    });

    if (error) throw error;
    return (data || []).map((slot: { appointment_time: string }) => slot.appointment_time);
  },
};

export const notificationOperations = {
  async getUserNotifications(userId: string) {
    const { data, error } = await supabase
      .from('appointment_notifications')
      .select(`
        *,
        appointments:appointments(
          id,
          appointment_date,
          appointment_time,
          appointment_type,
          status,
          doctors:doctors(
            id,
            specialization,
            users:users(name, email, avatar_url)
          ),
          patients:patients(
            id,
            users:users(name, email, avatar_url)
          )
        )
      `)
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return data;
  },

  async markNotificationStatus(
    notificationId: string,
    status: 'seen' | 'dismissed'
  ) {
    const updates: Partial<AppointmentNotification> = {
      status,
      seen_at: status === 'seen' ? new Date().toISOString() : undefined,
    };

    const { data, error } = await supabase
      .from('appointment_notifications')
      .update(updates)
      .eq('id', notificationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from('appointment_notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  },

  async createNotification(notificationData: {
    appointment_id: string;
    user_id: string;
    role: 'patient' | 'doctor';
    message: string;
    scheduled_for?: string;
    status?: 'pending' | 'seen' | 'dismissed';
  }) {
    const { data, error } = await supabase
      .from('appointment_notifications')
      .insert({
        appointment_id: notificationData.appointment_id,
        user_id: notificationData.user_id,
        role: notificationData.role,
        message: notificationData.message,
        scheduled_for: notificationData.scheduled_for || new Date().toISOString(),
        status: notificationData.status || 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// Payment operations
export const paymentOperations = {
  // Get payments for a patient
  async getPatientPayments(patientId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        appointments:appointments(
          id,
          appointment_date,
          appointment_time,
          appointment_type,
          status,
          doctors:doctors(
            id,
            specialization,
            consultation_fee,
            users:users(
              id,
              name,
              avatar_url
            )
          )
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Filter out payments where appointment doesn't exist
    // Only return payments with valid appointments
    return (data || []).filter(payment => payment.appointments !== null);
  },

  // Get payments for scheduled appointments (pending payments)
  async getPendingPayments(patientId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        appointments:appointments(
          id,
          appointment_date,
          appointment_time,
          appointment_type,
          status,
          doctors:doctors(
            id,
            specialization,
            consultation_fee,
            users:users(
              id,
              name,
              avatar_url
            )
          )
        )
      `)
      .eq('patient_id', patientId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get payments for a doctor (based on their appointments)
  async getDoctorPayments(doctorId: string) {
    try {
      // First, try a simpler query to see if RLS is working
      const { data: simpleData, error: simpleError } = await supabase
        .from('payments')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (simpleError) {
        console.error('Error fetching doctor payments (simple query):', simpleError);
        throw simpleError;
      }

      console.log('Simple doctor payments query result:', simpleData?.length || 0);
      if (simpleData && simpleData.length > 0) {
        console.log('Sample payment from simple query:', {
          id: simpleData[0].id,
          status: simpleData[0].status,
          amount: simpleData[0].amount,
          appointment_id: simpleData[0].appointment_id,
          doctor_id: simpleData[0].doctor_id,
          patient_id: simpleData[0].patient_id
        });
      } else {
        console.warn('⚠️ No payments found in simple query for doctor ID:', doctorId);
        console.log('This means either:');
        console.log('1. No payments exist for this doctor');
        console.log('2. RLS is blocking access to payments table');
        return [];
      }

      // Now fetch with relations
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          appointments:appointments(
            id,
            appointment_date,
            appointment_time,
            appointment_type,
            status,
            patients:patients(
              id,
              users:users(
                id,
                name,
                avatar_url
              )
            ),
            doctors:doctors(
              id,
              specialization,
              consultation_fee,
              users:users(
                id,
                name,
                avatar_url
              )
            )
          )
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching doctor payments (with relations):', error);
        console.error('Error details:', error.message, error.code, error.details);
        // If relations fail, try to fetch appointments separately
        console.log('Attempting to fetch appointments separately...');
        
        // Fetch appointments separately for each payment
        const paymentsWithAppointments = await Promise.all(
          simpleData.map(async (payment) => {
            try {
              const { data: appointmentData, error: aptError } = await supabase
                .from('appointments')
                .select(`
                  id,
                  appointment_date,
                  appointment_time,
                  appointment_type,
                  status,
                  patients:patients(
                    id,
                    users:users(
                      id,
                      name,
                      avatar_url
                    )
                  ),
                  doctors:doctors(
                    id,
                    specialization,
                    consultation_fee,
                    users:users(
                      id,
                      name,
                      avatar_url
                    )
                  )
                `)
                .eq('id', payment.appointment_id)
                .single();
              
              if (aptError) {
                console.warn(`Failed to fetch appointment ${payment.appointment_id}:`, aptError.message);
                return { ...payment, appointments: null };
              }
              
              return { ...payment, appointments: appointmentData };
            } catch (err) {
              console.warn(`Error fetching appointment ${payment.appointment_id}:`, err);
              return { ...payment, appointments: null };
            }
          })
        );
        
        // Return payments with appointments (even if some are null)
        return paymentsWithAppointments;
      }
      
      console.log('Doctor payments with relations:', data?.length || 0);
      
      // If nested query returned data, use it
      if (data && data.length > 0) {
        // For doctors, don't filter out payments with null appointments - show them anyway
        // We'll handle missing appointment data in the UI
        const paymentsWithAppointments = data.filter(payment => payment.appointments !== null);
        const paymentsWithoutAppointments = data.filter(payment => payment.appointments === null);
        
        console.log('Doctor payments breakdown:');
        console.log('- With appointments:', paymentsWithAppointments.length);
        console.log('- Without appointments:', paymentsWithoutAppointments.length);
        
        // Return all payments (with and without appointments)
        // The UI will handle missing appointment data gracefully
        const allPayments = [...paymentsWithAppointments, ...paymentsWithoutAppointments];
        console.log('Total doctor payments to display:', allPayments.length);
        
        return allPayments;
      } else {
        // If nested query returned no data but simple query did, use simple data
        console.warn('⚠️ Nested query returned no data, but simple query found payments. Using simple data.');
        console.log('This likely means RLS is blocking the nested relations.');
        console.log('Returning payments without nested relations - UI will show basic info.');
        
        // Return simple payments (without appointments) - UI will handle gracefully
        return simpleData.map(p => ({ ...p, appointments: null }));
      }
    } catch (error) {
      console.error('Error in getDoctorPayments:', error);
      throw error;
    }
  },

  // Create payment for an appointment
  async createPayment(appointmentId: string, patientId: string, doctorId: string, amount: number) {
    // Check if payment already exists
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        appointment_id: appointmentId,
        patient_id: patientId,
        doctor_id: doctorId,
        amount: amount,
        status: 'pending'
      })
      .select(`
        *,
        appointments:appointments(
          id,
          appointment_date,
          appointment_time,
          appointment_type,
          status,
          doctors:doctors(
            id,
            specialization,
            consultation_fee,
            users:users(
              id,
              name,
              avatar_url
            )
          )
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Update payment status
  async updatePaymentStatus(paymentId: string, status: 'pending' | 'completed' | 'failed' | 'refunded', paymentMethod?: 'easypaisa' | 'jazzcash' | 'bank' | 'stripe', transactionId?: string) {
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'completed') {
      updates.paid_at = new Date().toISOString();
    }

    if (paymentMethod) {
      updates.payment_method = paymentMethod;
    }

    if (transactionId) {
      updates.transaction_id = transactionId;
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get payment by ID
  async getPaymentById(paymentId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        appointments:appointments(
          id,
          appointment_date,
          appointment_time,
          appointment_type,
          status,
          doctors:doctors(
            id,
            specialization,
            consultation_fee,
            users:users(
              id,
              name,
              avatar_url
            )
          )
        )
      `)
      .eq('id', paymentId)
      .single();

    if (error) throw error;
    return data;
  },
};

// Scan operations
export const scanOperations = {
  // Upload scan file
  async uploadScan(file: File, patientId: string, doctorId: string, scanType: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('medical-scans')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    // Create scan record
    const { data, error } = await supabase
      .from('scans')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        scan_type: scanType,
        file_path: uploadData.path,
        file_size: file.size,
        mime_type: file.type,
        status: 'uploaded',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get scan details
  async getScanDetails(scanId: string) {
    const { data, error } = await supabase
      .from('scans')
      .select(`
        *,
        patients:patients(
          *,
          users:users(*)
        ),
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .eq('id', scanId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update scan analysis
  async updateScanAnalysis(scanId: string, analysis: string, confidence: number, findings: string) {
    const { data, error } = await supabase
      .from('scans')
      .update({
        ai_analysis: analysis,
        confidence_score: confidence,
        findings: findings,
        status: 'completed',
      })
      .eq('id', scanId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get download URL for scan file
  async getScanDownloadUrl(filePath: string) {
    const { data, error } = await supabase.storage
      .from('medical-scans')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) throw error;
    return data.signedUrl;
  },
};

// Report operations
export const reportOperations = {
  // Create report
  async createReport(reportData: Omit<Reports, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('reports')
      .insert(reportData)
      .select(`
        *,
        scans:scans(*),
        patients:patients(
          *,
          users:users(*)
        ),
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Get report details
  async getReportDetails(reportId: string) {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        scans:scans(*),
        patients:patients(
          *,
          users:users(*)
        ),
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .eq('id', reportId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get patient's reports
  async getPatientReports(patientId: string) {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        scans:scans(*),
        doctors:doctors(
          *,
          users:users(*)
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
};

// Real-time subscriptions
export const realtimeOperations = {
  // Subscribe to appointment updates
  subscribeToAppointments(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=in.(SELECT id FROM patients WHERE user_id = '${userId}')`,
        },
        callback
      )
      .subscribe();
  },

  // Subscribe to scan updates
  subscribeToScans(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('scans')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scans',
          filter: `patient_id=in.(SELECT id FROM patients WHERE user_id = '${userId}')`,
        },
        callback
      )
      .subscribe();
  },
};
