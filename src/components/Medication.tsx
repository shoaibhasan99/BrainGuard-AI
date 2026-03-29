import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Pill, 
  Clock, 
  Calendar, 
  Bell, 
  Plus, 
  Edit, 
  Check, 
  X, 
  AlertCircle, 
  Search, 
  User
} from 'lucide-react';
import { medicationService, Medication as MedicationType, MedicationLog } from '../lib/medicationService';
import { notificationService } from '../lib/notificationService';
import AddMedicationModal from './AddMedicationModal';
import ReminderManagement from './ReminderManagement';

interface Reminder {
  id: string;
  medicationId: string;
  medicationName: string;
  time: string;
  isActive: boolean;
  nextReminder: string;
}

const Medication: React.FC = () => {
  console.log('Medication component initializing...');
  
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'reminders' | 'refills'>('current');
  const [medications, setMedications] = useState<MedicationType[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'expired'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<MedicationType | null>(null);
  const scheduledReminderIds = useRef<number[]>([]);

  // Load data from service
  const loadData = async () => {
    try {
      console.log('Loading medication data...');
      const meds = await medicationService.getMedications();
      const logs = medicationService.getMedicationLogs();
      const rems = medicationService.getReminders();
      
      console.log('Loaded data:', { meds: meds.length, logs: logs.length, rems: rems.length });
      
      setMedications(meds);
      setMedicationLogs(logs);
      setReminders(rems);
    } catch (error) {
      console.error('Error loading medication data:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    try {
      console.log('Medication component useEffect running...');
      loadData();
      notificationService.requestPermission();
    } catch (error) {
      console.error('Error initializing medication module:', error);
    }
  }, []);

  // Helpers for reminders
  const getNextOccurrenceFromTime = (hhmm: string): Date => {
    const [hStr, mStr] = hhmm.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr, 10);
    const now = new Date();
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  };

  const clearScheduledReminders = () => {
    scheduledReminderIds.current.forEach(id => {
      try { clearTimeout(id as unknown as number); } catch {}
    });
    scheduledReminderIds.current = [];
  };

  const scheduleAllReminders = async (meds: MedicationType[]) => {
    // Request permission, but continue scheduling even if denied (voice still works)
    await notificationService.requestPermission();

    clearScheduledReminders();

    meds.filter(m => m.isActive && m.reminderEnabled).forEach(med => {
      const times = (med.reminderTimes && med.reminderTimes.length > 0) ? med.reminderTimes : med.times;
      console.log('Scheduling reminders for', med.name, 'times:', times);
      times.forEach(t => {
        const when = getNextOccurrenceFromTime(t);
        console.log(' -> at', when.toLocaleString());
        const id = notificationService.scheduleMedicationReminder(
          med.name,
          med.dosage,
          when,
          async () => {
            await medicationService.markAsTaken(med.id);
            await loadData();
          },
          () => {
            // Snooze 10 minutes
            const snoozeFor = new Date(Date.now() + 10 * 60 * 1000);
            const sid = notificationService.scheduleMedicationReminder(med.name, med.dosage, snoozeFor);
            scheduledReminderIds.current.push(sid);
          },
          () => {
            // Skip: no-op for now
          }
        );
        scheduledReminderIds.current.push(id);

        // Also play voice immediately if the time is within the next minute (helps in testing)
        const diffMs = when.getTime() - Date.now();
        if (diffMs > 0 && diffMs <= 60000) {
          setTimeout(() => notificationService.playVoiceAlarm(med.name, med.dosage), diffMs);
        }
      });
    });
  };

  // Reschedule reminders whenever medication list changes
  useEffect(() => {
    scheduleAllReminders(medications);
    return () => clearScheduledReminders();
  }, [medications]);

  const filteredMedications = (() => {
    let filtered = medications;
    
    if (searchTerm) {
      filtered = filtered.filter(med => 
        med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        med.doctor.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      if (filterStatus === 'active') {
        filtered = filtered.filter(med => med.isActive);
      } else if (filterStatus === 'completed') {
        filtered = filtered.filter(med => !med.isActive && new Date(med.endDate) < new Date());
      } else if (filterStatus === 'expired') {
        filtered = filtered.filter(med => new Date(med.endDate) < new Date());
      }
    }
    
    return filtered;
  })();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken': return 'text-green-400 bg-green-400/10';
      case 'missed': return 'text-red-400 bg-red-400/10';
      case 'snoozed': return 'text-yellow-400 bg-yellow-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const markAsTaken = async (medicationId: string) => {
    try {
      console.log('Marking medication as taken:', medicationId);
      await medicationService.markAsTaken(medicationId);
      await loadData();
      
      // Voice confirmation
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('Medication marked as taken');
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
      }
      
      alert('Medication marked as taken!');
    } catch (error) {
      console.error('Error marking medication as taken:', error);
      alert('Error marking medication as taken. Please try again.');
    }
  };

  const handleAddMedication = (medication: MedicationType) => {
    try {
      console.log('Medication saved:', medication);
      // The modal already handled the add/update operation
      // We just need to reload the data and close the modal
      loadData();
      setIsAddModalOpen(false);
      alert(editingMedication ? 'Medication updated successfully!' : 'Medication added successfully!');
    } catch (error) {
      console.error('Error saving medication:', error);
      alert('Error saving medication. Please try again.');
    }
  };

  const handleEditMedication = (medication: MedicationType) => {
    setEditingMedication(medication);
    setIsAddModalOpen(true);
  };

  const handleDeleteMedication = async (medicationId: string) => {
    console.log('Attempting to delete medication:', medicationId);
    if (window.confirm('Are you sure you want to delete this medication?')) {
      try {
        console.log('Deleting medication:', medicationId);
        await medicationService.deleteMedication(medicationId);
        await loadData();
        alert('Medication deleted successfully!');
      } catch (error) {
        console.error('Error deleting medication:', error);
        alert('Error deleting medication. Please try again.');
      }
    }
  };


  const getDaysUntilRefill = (refillDate: string) => {
    const today = new Date();
    const refill = new Date(refillDate);
    const diffTime = refill.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Debug logging
  console.log('Medication component rendering:', {
    medications: medications.length,
    medicationLogs: medicationLogs.length,
    reminders: reminders.length,
    activeTab,
    searchTerm,
    filterStatus
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              Medication Management
            </span>
          </h2>
          <p className="text-gray-400 text-lg">
            Track your medications, set reminders, and manage your health
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddModalOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Medication
        </motion.button>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-2 border border-gray-700/50"
      >
        <div className="flex space-x-2">
          {[
            { id: 'current', label: 'Current Medications', count: medications.filter(m => m.isActive).length },
            { id: 'history', label: 'Medication History', count: medicationLogs.length },
            { id: 'reminders', label: 'Reminders' },
            { id: 'refills', label: 'Refills Needed', count: medications.filter(m => getDaysUntilRefill(m.refillDate) <= 7).length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{tab.label}</span>
                {typeof (tab as any).count === 'number' && (
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-600/50 text-gray-300'
                  }`}>
                    {(tab as any).count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
        {activeTab === 'current' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Search and Filter */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search medications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all duration-300"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-all duration-300"
                >
                  <option value="all">All Medications</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>

            {/* Current Medications */}
          {filteredMedications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Pill className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-400 text-lg mb-4">
                {medications.length === 0 ? 'No medications added yet' : 'No medications match your search'}
              </p>
              <p className="text-gray-500 text-sm mb-4">
                {medications.length === 0 ? 'Add your first medication to get started' : 'Try adjusting your search or filter criteria'}
              </p>
              {medications.length === 0 && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-300 font-medium"
                >
                  Add First Medication
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredMedications.map((medication, index) => (
                <motion.div
                  key={medication.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-orange-400/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                        <Pill className="w-6 h-6 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{medication.name}</h3>
                        <p className="text-orange-400 font-medium">{medication.dosage}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        medication.isActive ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-400'
                      }`}>
                        {medication.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleEditMedication(medication)}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{medication.frequency}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <User className="w-4 h-4" />
                      <span className="text-sm">{medication.doctor}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        {new Date(medication.startDate).toLocaleDateString()} - {new Date(medication.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${medication.reminderEnabled ? 'text-orange-400' : 'text-gray-500'}`} />
                      <span className={`text-sm ${medication.reminderEnabled ? 'text-orange-400' : 'text-gray-500'}`}>
                        {medication.reminderEnabled ? 'Reminders ON' : 'Reminders OFF'}
                      </span>
                    </div>
                  <div className="flex gap-2">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      onClick={() => markAsTaken(medication.id)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Mark as Taken
                    </motion.button>
                      <button 
                        onClick={() => handleDeleteMedication(medication.id)}
                        className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                      >
                        <X className="w-4 h-4" />
                    </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Medication History */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/30">
                    <tr>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Medication</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Dosage</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Time</th>
                      <th className="px-6 py-4 text-left text-gray-300 font-semibold">Status</th>
                    <th className="px-6 py-4 text-left text-gray-300 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                  {medicationLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-700/50">
                      <td className="px-6 py-4 text-white font-medium">{log.medicationName}</td>
                      <td className="px-6 py-4 text-gray-300">{log.dosage}</td>
                      <td className="px-6 py-4 text-gray-300">{log.time}</td>
                          <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(log.status)}`}>
                                {log.status}
                              </span>
                          </td>
                      <td className="px-6 py-4 text-gray-300">
                        {new Date(log.takenAt).toLocaleDateString()}
                          </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'reminders' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
          <ReminderManagement medications={medications} />
          </motion.div>
        )}

        {activeTab === 'refills' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            {/* Refills Needed */}
          <div className="grid gap-4">
            {medications
              .filter(med => getDaysUntilRefill(med.refillDate) <= 7)
              .map((medication) => (
                <div key={medication.id} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{medication.name}</h3>
                        <p className="text-gray-400">{medication.dosage}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-semibold">
                        {getDaysUntilRefill(medication.refillDate)} days left
                      </p>
                      <p className="text-gray-400 text-sm">
                        Refill by {new Date(medication.refillDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  </div>
              ))}
            </div>
          </motion.div>
        )}

      {/* Add Medication Modal */}
      <AddMedicationModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingMedication(null);
        }}
        onMedicationAdded={handleAddMedication}
        editMedication={editingMedication}
      />
    </div>
  );
};

export default Medication;