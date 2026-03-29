// src/lib/medicationService.ts

import { supabase } from './supabase';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate: string;
  doctor: string;
  doctorSpecialty: string;
  purpose: string;
  instructions: string;
  sideEffects: string[];
  isActive: boolean;
  reminderEnabled: boolean;
  reminderTimes: string[];
  stock: number;
  refillDate: string;
  lastTaken?: string;
  nextDose?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  medicationName: string;
  takenAt: string;
  time: string;
  status: 'taken' | 'missed' | 'skipped';
  notes?: string;
  dosage?: string;
}

export interface MedicationReminder {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string;
  isActive: boolean;
  nextReminder: string;
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
  createdAt: string;
}

export interface MedicationStats {
  totalMedications: number;
  activeMedications: number;
  completedMedications: number;
  adherenceRate: number;
  upcomingRefills: number;
  missedDoses: number;
  takenDoses: number;
}

class MedicationService {
  private storageKey = 'brainGuard_medications';
  private logsKey = 'brainGuard_medication_logs';
  private remindersKey = 'brainGuard_medication_reminders';

  // Initialize with sample data if no data exists
  private initializeData(): void {
    console.log('Initializing medication service...');
    // Check localStorage directly for initialization (before async load)
    const data = localStorage.getItem(this.storageKey);
    const existingMedications = data ? JSON.parse(data) : [];
    console.log('Existing medications:', existingMedications.length);
    
    if (!existingMedications.length) {
      console.log('No existing medications, creating sample data...');
      const sampleMedications: Medication[] = [
        {
          id: '1',
          name: 'Donepezil',
          dosage: '10mg',
          frequency: 'Once daily',
          times: ['08:00'],
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          doctor: 'Dr. Sarah Johnson',
          doctorSpecialty: 'General Practitioner',
          purpose: 'General treatment',
          instructions: 'Take with breakfast',
          sideEffects: [],
          isActive: true,
          reminderEnabled: true,
          reminderTimes: ['08:00'],
          stock: 30,
          refillDate: '2024-02-15',
          lastTaken: new Date().toISOString(),
          nextDose: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Memantine',
          dosage: '20mg',
          frequency: 'Twice daily',
          times: ['09:00', '21:00'],
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          doctor: 'Dr. Sarah Johnson',
          doctorSpecialty: 'General Practitioner',
          purpose: 'General treatment',
          instructions: 'Take with food',
          sideEffects: [],
          isActive: true,
          reminderEnabled: true,
          reminderTimes: ['09:00', '21:00'],
          stock: 30,
          refillDate: '2024-02-20',
          lastTaken: new Date().toISOString(),
          nextDose: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      this.saveMedications(sampleMedications);
      console.log('Sample medications created and saved');
    }
    console.log('Medication service initialization complete');
  }

  // Medication CRUD operations
  async getMedications(): Promise<Medication[]> {
    try {
      // First try to load from Supabase
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const userId = authData.user.id;
        const { data: patientProfile } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (patientProfile?.id) {
          const { data: medications, error } = await supabase
            .from('medications')
            .select('*')
            .eq('patient_id', patientProfile.id)
            .order('created_at', { ascending: false });

          if (!error && medications) {
            // Convert Supabase format to Medication interface
            const convertedMedications: Medication[] = medications.map(med => ({
              id: med.id,
              name: med.name,
              dosage: med.dosage,
              frequency: med.frequency,
              times: med.times || [],
              startDate: med.start_date,
              endDate: med.end_date || '',
              doctor: med.doctor || '',
              doctorSpecialty: med.doctor_specialty || '',
              purpose: med.purpose || '',
              instructions: med.instructions || '',
              sideEffects: med.side_effects || [],
              isActive: med.is_active ?? true,
              reminderEnabled: med.reminder_enabled ?? false,
              reminderTimes: med.reminder_times || [],
              stock: med.stock ?? 0,
              refillDate: med.refill_date || '',
              lastTaken: med.last_taken,
              nextDose: med.next_dose,
              createdAt: med.created_at,
              updatedAt: med.updated_at
            }));

            // Sync to localStorage as backup
            this.saveMedications(convertedMedications);
            return convertedMedications;
          }
        }
      }
    } catch (error) {
      console.error('Error loading medications from Supabase:', error);
    }

    // Fallback to localStorage
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  async getMedication(id: string): Promise<Medication | undefined> {
    const medications = await this.getMedications();
    return medications.find(med => med.id === id);
  }

  async addMedication(medication: Omit<Medication, 'id' | 'createdAt' | 'updatedAt'>): Promise<Medication> {
    try {
      // Get patient profile
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        throw new Error('User not authenticated');
      }

      const { data: patientProfile } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', authData.user.id)
        .maybeSingle();

      if (!patientProfile?.id) {
        throw new Error('Patient profile not found');
      }

      // Insert into Supabase
      const { data: newMed, error } = await supabase
        .from('medications')
        .insert({
          patient_id: patientProfile.id,
          name: medication.name,
          dosage: medication.dosage,
          frequency: medication.frequency,
          times: medication.times,
          start_date: medication.startDate,
          end_date: medication.endDate || null,
          doctor: medication.doctor || null,
          doctor_specialty: medication.doctorSpecialty || null,
          purpose: medication.purpose || null,
          instructions: medication.instructions || null,
          side_effects: medication.sideEffects || [],
          is_active: medication.isActive ?? true,
          reminder_enabled: medication.reminderEnabled ?? false,
          reminder_times: medication.reminderTimes || [],
          stock: medication.stock ?? 0,
          refill_date: medication.refillDate || null,
          last_taken: medication.lastTaken || null,
          next_dose: medication.nextDose || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving medication to Supabase:', error);
        throw error;
      }

      // Convert to Medication format
      const newMedication: Medication = {
        id: newMed.id,
        name: newMed.name,
        dosage: newMed.dosage,
        frequency: newMed.frequency,
        times: newMed.times || [],
        startDate: newMed.start_date,
        endDate: newMed.end_date || '',
        doctor: newMed.doctor || '',
        doctorSpecialty: newMed.doctor_specialty || '',
        purpose: newMed.purpose || '',
        instructions: newMed.instructions || '',
        sideEffects: newMed.side_effects || [],
        isActive: newMed.is_active ?? true,
        reminderEnabled: newMed.reminder_enabled ?? false,
        reminderTimes: newMed.reminder_times || [],
        stock: newMed.stock ?? 0,
        refillDate: newMed.refill_date || '',
        lastTaken: newMed.last_taken,
        nextDose: newMed.next_dose,
        createdAt: newMed.created_at,
        updatedAt: newMed.updated_at
      };

      // Also save to localStorage as backup
      const medications = await this.getMedications();
      medications.push(newMedication);
      this.saveMedications(medications);

      return newMedication;
    } catch (error) {
      console.error('Error adding medication:', error);
      // Fallback to localStorage only
      const medications = await this.getMedications();
      const newMedication: Medication = {
        ...medication,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      medications.push(newMedication);
      this.saveMedications(medications);
      return newMedication;
    }
  }

  async updateMedication(id: string, updates: Partial<Medication>): Promise<Medication | null> {
    try {
      // Update in Supabase
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.dosage !== undefined) updateData.dosage = updates.dosage;
      if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
      if (updates.times !== undefined) updateData.times = updates.times;
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate || null;
      if (updates.doctor !== undefined) updateData.doctor = updates.doctor || null;
      if (updates.doctorSpecialty !== undefined) updateData.doctor_specialty = updates.doctorSpecialty || null;
      if (updates.purpose !== undefined) updateData.purpose = updates.purpose || null;
      if (updates.instructions !== undefined) updateData.instructions = updates.instructions || null;
      if (updates.sideEffects !== undefined) updateData.side_effects = updates.sideEffects;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      if (updates.reminderEnabled !== undefined) updateData.reminder_enabled = updates.reminderEnabled;
      if (updates.reminderTimes !== undefined) updateData.reminder_times = updates.reminderTimes;
      if (updates.stock !== undefined) updateData.stock = updates.stock;
      if (updates.refillDate !== undefined) updateData.refill_date = updates.refillDate || null;
      if (updates.lastTaken !== undefined) updateData.last_taken = updates.lastTaken || null;
      if (updates.nextDose !== undefined) updateData.next_dose = updates.nextDose || null;

      const { data: updatedMed, error } = await supabase
        .from('medications')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating medication in Supabase:', error);
        throw error;
      }

      // Convert and update localStorage
      const medications = await this.getMedications();
      const index = medications.findIndex(med => med.id === id);
      if (index === -1) return null;

      const updatedMedication: Medication = {
        id: updatedMed.id,
        name: updatedMed.name,
        dosage: updatedMed.dosage,
        frequency: updatedMed.frequency,
        times: updatedMed.times || [],
        startDate: updatedMed.start_date,
        endDate: updatedMed.end_date || '',
        doctor: updatedMed.doctor || '',
        doctorSpecialty: updatedMed.doctor_specialty || '',
        purpose: updatedMed.purpose || '',
        instructions: updatedMed.instructions || '',
        sideEffects: updatedMed.side_effects || [],
        isActive: updatedMed.is_active ?? true,
        reminderEnabled: updatedMed.reminder_enabled ?? false,
        reminderTimes: updatedMed.reminder_times || [],
        stock: updatedMed.stock ?? 0,
        refillDate: updatedMed.refill_date || '',
        lastTaken: updatedMed.last_taken,
        nextDose: updatedMed.next_dose,
        createdAt: updatedMed.created_at,
        updatedAt: updatedMed.updated_at
      };

      medications[index] = updatedMedication;
      this.saveMedications(medications);
      return updatedMedication;
    } catch (error) {
      console.error('Error updating medication:', error);
      // Fallback to localStorage
      const medications = await this.getMedications();
      const index = medications.findIndex(med => med.id === id);
      if (index === -1) return null;
      
      medications[index] = {
        ...medications[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.saveMedications(medications);
      return medications[index];
    }
  }

  async deleteMedication(id: string): Promise<boolean> {
    try {
      // Delete from Supabase
      const { error } = await supabase
        .from('medications')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting medication from Supabase:', error);
        throw error;
      }

      // Delete from localStorage
      const medications = await this.getMedications();
      const filtered = medications.filter(med => med.id !== id);
      this.saveMedications(filtered);

      // Also delete related logs and reminders
      await this.deleteMedicationLogs(id);
      this.deleteRemindersForMedication(id);

      return true;
    } catch (error) {
      console.error('Error deleting medication:', error);
      // Fallback to localStorage
      const medications = await this.getMedications();
      const filtered = medications.filter(med => med.id !== id);
      if (filtered.length === medications.length) return false;
      this.saveMedications(filtered);
      this.deleteMedicationLogs(id);
      this.deleteRemindersForMedication(id);
      return true;
    }
  }

  // Medication Log operations
  getMedicationLogs(): MedicationLog[] {
    const data = localStorage.getItem(this.logsKey);
    return data ? JSON.parse(data) : [];
  }

  async addMedicationLog(log: Omit<MedicationLog, 'id'>): Promise<MedicationLog> {
    const logs = this.getMedicationLogs();
    const newLog: MedicationLog = {
      ...log,
      id: Date.now().toString()
    };
    
    logs.unshift(newLog); // Add to beginning for recent first
    this.saveMedicationLogs(logs);
    
    // Update medication's lastTaken and nextDose
    await this.updateMedicationLastTaken(log.medicationId, log.takenAt);
    
    return newLog;
  }

  async markAsTaken(medicationId: string): Promise<boolean> {
    console.log('Service: Marking medication as taken:', medicationId);
    
    try {
      // Find the medication
      const medications = await this.getMedications();
      const medication = medications.find(med => med.id === medicationId);
      
      if (!medication) {
        console.log('Service: Medication not found');
        return false;
      }
      
      console.log('Service: Found medication:', medication.name);
      
      // Create a log entry
      const logEntry: Omit<MedicationLog, 'id'> = {
        medicationId: medicationId,
        medicationName: medication.name,
        dosage: medication.dosage,
        time: new Date().toLocaleTimeString(),
        status: 'taken',
        notes: 'Marked as taken by user',
        takenAt: new Date().toISOString()
      };
      
      // Save log to Supabase if possible
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          const { data: patientProfile } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', authData.user.id)
            .maybeSingle();

          if (patientProfile?.id) {
            const { error: logError } = await supabase
              .from('medication_logs')
              .insert({
                medication_id: medicationId,
                patient_id: patientProfile.id,
                medication_name: medication.name,
                taken_at: new Date().toISOString(),
                time: new Date().toLocaleTimeString(),
                status: 'taken',
                notes: logEntry.notes,
                dosage: medication.dosage
              });

            if (logError) {
              console.error('Error saving medication log to Supabase:', logError);
            } else {
              console.log('✅ Medication log saved to Supabase');
            }
          }
        }
      } catch (error) {
        console.error('Error saving log to Supabase:', error);
      }
      
      // Also save to localStorage
      await this.addMedicationLog(logEntry);
      
      // Update medication's lastTaken and nextDose
      const nextDose = this.calculateNextDose(
        medication.times[0], 
        medication.frequency.toLowerCase()
      );
      await this.updateMedication(medicationId, {
        lastTaken: new Date().toISOString(),
        nextDose: nextDose
      });
      
      console.log('Service: Medication log created successfully');
      return true;
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      return false;
    }
  }

  deleteMedicationLogs(medicationId: string): void {
    const logs = this.getMedicationLogs();
    const filtered = logs.filter(log => log.medicationId !== medicationId);
    this.saveMedicationLogs(filtered);
  }

  // Reminder operations
  getReminders(): MedicationReminder[] {
    const data = localStorage.getItem(this.remindersKey);
    return data ? JSON.parse(data) : [];
  }

  addReminder(reminder: Omit<MedicationReminder, 'id' | 'createdAt'>): MedicationReminder {
    const reminders = this.getReminders();
    const newReminder: MedicationReminder = {
      ...reminder,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    
    reminders.push(newReminder);
    this.saveReminders(reminders);
    return newReminder;
  }

  updateReminder(id: string, updates: Partial<MedicationReminder>): MedicationReminder | null {
    const reminders = this.getReminders();
    const index = reminders.findIndex(rem => rem.id === id);
    
    if (index === -1) return null;
    
    reminders[index] = { ...reminders[index], ...updates };
    this.saveReminders(reminders);
    return reminders[index];
  }

  deleteReminder(id: string): boolean {
    const reminders = this.getReminders();
    const filtered = reminders.filter(rem => rem.id !== id);
    
    if (filtered.length === reminders.length) return false;
    
    this.saveReminders(filtered);
    return true;
  }

  deleteRemindersForMedication(medicationId: string): void {
    const reminders = this.getReminders();
    const filtered = reminders.filter(reminder => reminder.medicationId !== medicationId);
    this.saveReminders(filtered);
  }

  // Utility functions
  private saveMedications(medications: Medication[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(medications));
  }

  private saveMedicationLogs(logs: MedicationLog[]): void {
    localStorage.setItem(this.logsKey, JSON.stringify(logs));
  }

  private saveReminders(reminders: MedicationReminder[]): void {
    localStorage.setItem(this.remindersKey, JSON.stringify(reminders));
  }

  private async updateMedicationLastTaken(medicationId: string, takenAt: string): Promise<void> {
    const medication = await this.getMedication(medicationId);
    if (!medication) return;

    const nextDose = this.calculateNextDose(
      medication.times[0], 
      medication.frequency.toLowerCase()
    );

    await this.updateMedication(medicationId, {
      lastTaken: takenAt,
      nextDose: nextDose
    });
  }

  calculateNextDose(time: string, frequency: string): string {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    let nextDose = new Date();
    nextDose.setHours(hours, minutes, 0, 0);
    
    // If the time has passed today, schedule for tomorrow
    if (nextDose <= now) {
      nextDose.setDate(nextDose.getDate() + 1);
    }
    
    return nextDose.toISOString();
  }

  // Statistics
  async getMedicationStats(): Promise<MedicationStats> {
    const medications = await this.getMedications();
    const logs = this.getMedicationLogs();
    const now = new Date();
    
    const activeMedications = medications.filter(m => m.isActive).length;
    const completedMedications = medications.filter(m => !m.isActive).length;
    
    const takenDoses = logs.filter(l => l.status === 'taken').length;
    const missedDoses = logs.filter(l => l.status === 'missed').length;
    const totalDoses = takenDoses + missedDoses;
    const adherenceRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    
    const upcomingRefills = medications.filter(m => {
      const refillDate = new Date(m.refillDate);
      const daysUntilRefill = Math.ceil((refillDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilRefill <= 7 && daysUntilRefill >= 0;
    }).length;

    return {
      totalMedications: medications.length,
      activeMedications,
      completedMedications,
      adherenceRate: Math.round(adherenceRate),
      upcomingRefills,
      missedDoses,
      takenDoses
    };
  }

  // Search and filter
  async searchMedications(query: string): Promise<Medication[]> {
    const medications = await this.getMedications();
    const lowercaseQuery = query.toLowerCase();
    
    return medications.filter(med => 
      med.name.toLowerCase().includes(lowercaseQuery) ||
      med.doctor.toLowerCase().includes(lowercaseQuery) ||
      med.purpose.toLowerCase().includes(lowercaseQuery) ||
      med.doctorSpecialty.toLowerCase().includes(lowercaseQuery)
    );
  }

  async filterMedicationsByStatus(status: 'all' | 'active' | 'completed' | 'expired'): Promise<Medication[]> {
    const medications = await this.getMedications();
    const now = new Date();
    
    switch (status) {
      case 'active':
        return medications.filter(m => m.isActive);
      case 'completed':
        return medications.filter(m => !m.isActive);
      case 'expired':
        return medications.filter(m => new Date(m.endDate) < now);
      default:
        return medications;
    }
  }

  // Initialize data on first load
  initialize(): void {
    this.initializeData();
  }
}

export const medicationService = new MedicationService();
