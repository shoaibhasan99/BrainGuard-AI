/**
 * Test Patient Data Generator
 * This script creates test patients in Supabase for development/testing
 */

import { supabase } from './supabase';

export interface TestPatient {
  name: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  medicalHistory: string;
  emergencyContact: string;
  insuranceInfo: string;
}

const testPatients: TestPatient[] = [
  {
    name: 'John Smith',
    email: 'john.smith@email.com',
    phoneNumber: '+1-555-0101',
    dateOfBirth: '1985-03-15',
    medicalHistory: 'History of migraines, allergic to penicillin. Regular checkups with family doctor.',
    emergencyContact: 'Jane Smith (Wife) - +1-555-0102',
    insuranceInfo: 'Blue Cross Blue Shield - Policy #BC123456'
  },
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phoneNumber: '+1-555-0201',
    dateOfBirth: '1990-07-22',
    medicalHistory: 'Diabetes Type 2, hypertension. Takes metformin and lisinopril daily.',
    emergencyContact: 'Mike Johnson (Brother) - +1-555-0202',
    insuranceInfo: 'Aetna - Policy #AE789012'
  },
  {
    name: 'Michael Brown',
    email: 'michael.brown@email.com',
    phoneNumber: '+1-555-0301',
    dateOfBirth: '1978-11-08',
    medicalHistory: 'Previous stroke in 2020, recovered well. Regular neurological follow-ups.',
    emergencyContact: 'Lisa Brown (Daughter) - +1-555-0302',
    insuranceInfo: 'Cigna - Policy #CI345678'
  },
  {
    name: 'Emily Davis',
    email: 'emily.davis@email.com',
    phoneNumber: '+1-555-0401',
    dateOfBirth: '1995-01-30',
    medicalHistory: 'Anxiety disorder, takes sertraline. No major medical issues.',
    emergencyContact: 'Robert Davis (Father) - +1-555-0402',
    insuranceInfo: 'UnitedHealth - Policy #UH901234'
  },
  {
    name: 'David Wilson',
    email: 'david.wilson@email.com',
    phoneNumber: '+1-555-0501',
    dateOfBirth: '1982-09-14',
    medicalHistory: 'High cholesterol, family history of heart disease. On statin therapy.',
    emergencyContact: 'Mary Wilson (Mother) - +1-555-0502',
    insuranceInfo: 'Humana - Policy #HU567890'
  }
];

class TestPatientService {
  // Create test patients in Supabase
  async createTestPatients(): Promise<boolean> {
    try {
      console.log('🏥 Creating test patients in Supabase...');
      
      for (const patientData of testPatients) {
        try {
          // Create user account
          const { data: authData, error: authError } = await supabase.auth.signUp({
            email: patientData.email,
            password: 'TestPassword123!', // Default password for test patients
            options: {
              data: {
                name: patientData.name,
                role: 'patient',
              }
            }
          });

          if (authError) {
            console.error(`❌ Failed to create user for ${patientData.name}:`, authError);
            continue;
          }

          if (!authData.user) {
            console.error(`❌ No user data returned for ${patientData.name}`);
            continue;
          }

          // Create user profile
          const { error: userError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: patientData.email,
              name: patientData.name,
              role: 'patient',
              phone_number: patientData.phoneNumber,
            });

          if (userError) {
            console.error(`❌ Failed to create user profile for ${patientData.name}:`, userError);
            continue;
          }

          // Create patient profile
          const { error: patientError } = await supabase
            .from('patients')
            .insert({
              user_id: authData.user.id,
              date_of_birth: patientData.dateOfBirth,
              medical_history: patientData.medicalHistory,
              emergency_contact: patientData.emergencyContact,
              insurance_info: patientData.insuranceInfo,
            });

          if (patientError) {
            console.error(`❌ Failed to create patient profile for ${patientData.name}:`, patientError);
            continue;
          }

          console.log(`✅ Successfully created test patient: ${patientData.name}`);
        } catch (error) {
          console.error(`❌ Error creating patient ${patientData.name}:`, error);
        }
      }

      console.log('🎉 Test patients creation completed!');
      return true;
    } catch (error) {
      console.error('❌ Failed to create test patients:', error);
      return false;
    }
  }

  // Check if test patients exist
  async checkTestPatients(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'patient');

      if (error) {
        console.error('Error checking patients:', error);
        return 0;
      }

      return data ? data.length : 0;
    } catch (error) {
      console.error('Error checking patients:', error);
      return 0;
    }
  }

  // Get test patient credentials
  getTestPatientCredentials(): Array<{name: string, email: string, password: string}> {
    return testPatients.map(patient => ({
      name: patient.name,
      email: patient.email,
      password: 'TestPassword123!'
    }));
  }
}

// Export singleton instance
export const testPatientService = new TestPatientService();

// Function to run from browser console
export const createTestPatients = async () => {
  console.log('🚀 Creating test patients...');
  const success = await testPatientService.createTestPatients();
  
  if (success) {
    const count = await testPatientService.checkTestPatients();
    console.log(`✅ Test patients created! Total patients in database: ${count}`);
    
    const credentials = testPatientService.getTestPatientCredentials();
    console.log('📋 Test Patient Login Credentials:');
    credentials.forEach(patient => {
      console.log(`${patient.name}: ${patient.email} / ${patient.password}`);
    });
    
    alert(`✅ Test patients created successfully!\n\nTotal patients: ${count}\n\nYou can now:\n1. Refresh the doctor dashboard\n2. See real patients in the chat section\n3. Login as a patient using the credentials shown in console`);
  } else {
    console.error('❌ Failed to create test patients');
    alert('❌ Failed to create test patients. Check console for details.');
  }
};

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  (window as any).createTestPatients = createTestPatients;
}





























































