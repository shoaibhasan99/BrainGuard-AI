// src/components/AddMedicationModal.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Clock, User, Calendar, AlertCircle } from 'lucide-react';
import { medicationService, Medication as MedicationType } from '../lib/medicationService';

interface AddMedicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMedicationAdded: (medication: MedicationType) => void;
  editMedication?: MedicationType | null;
}

const AddMedicationModal: React.FC<AddMedicationModalProps> = ({
  isOpen,
  onClose,
  onMedicationAdded,
  editMedication
}) => {
  const [formData, setFormData] = useState({
    name: editMedication?.name || '',
    dosage: editMedication?.dosage || '',
    frequency: editMedication?.frequency || 'Once daily',
    times: editMedication?.times || ['08:00'],
    startDate: editMedication?.startDate || new Date().toISOString().split('T')[0],
    endDate: editMedication?.endDate || '',
    doctor: editMedication?.doctor || '',
    doctorSpecialty: editMedication?.doctorSpecialty || 'General Practitioner',
    purpose: editMedication?.purpose || 'General treatment',
    instructions: editMedication?.instructions || '',
    sideEffects: editMedication?.sideEffects || [],
    isActive: editMedication?.isActive ?? true,
    reminderEnabled: editMedication?.reminderEnabled ?? true,
    reminderTimes: editMedication?.reminderTimes || ['08:00'],
    stock: editMedication?.stock || 30,
    refillDate: editMedication?.refillDate || ''
  });

  const [timeInput, setTimeInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form data when editMedication changes
  useEffect(() => {
    if (editMedication) {
      setFormData({
        name: editMedication.name,
        dosage: editMedication.dosage,
        frequency: editMedication.frequency,
        times: editMedication.times,
        startDate: editMedication.startDate,
        endDate: editMedication.endDate,
        doctor: editMedication.doctor,
        doctorSpecialty: editMedication.doctorSpecialty || 'General Practitioner',
        purpose: editMedication.purpose || 'General treatment',
        instructions: editMedication.instructions,
        sideEffects: editMedication.sideEffects || [],
        isActive: editMedication.isActive,
        reminderEnabled: editMedication.reminderEnabled,
        reminderTimes: editMedication.reminderTimes,
        stock: editMedication.stock || 30,
        refillDate: editMedication.refillDate
      });
    } else {
      // Reset form for new medication
      setFormData({
        name: '',
        dosage: '',
        frequency: 'Once daily',
        times: ['08:00'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        doctor: '',
        doctorSpecialty: 'General Practitioner',
        purpose: 'General treatment',
        instructions: '',
        sideEffects: [],
        isActive: true,
        reminderEnabled: true,
        reminderTimes: ['08:00'],
        stock: 30,
        refillDate: ''
      });
    }
  }, [editMedication]);

  const frequencyOptions = [
    'Once daily',
    'Twice daily',
    'Three times daily',
    'Four times daily',
    'Every 6 hours',
    'Every 8 hours',
    'Every 12 hours',
    'Weekly',
    'As needed'
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Medication name is required';
    if (!formData.dosage.trim()) newErrors.dosage = 'Dosage is required';
    if (!formData.doctor.trim()) newErrors.doctor = 'Doctor name is required';
    if (formData.times.length === 0) newErrors.times = 'At least one time is required';
    if (!formData.startDate) newErrors.startDate = 'Start date is required';
    if (!formData.endDate) newErrors.endDate = 'End date is required';

    // Validate dates
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end <= start) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      let medication: MedicationType;
      // Ensure reminderTimes mirror times when reminders are enabled
      const normalizedForm = {
        ...formData,
        reminderTimes: formData.reminderEnabled ? [...formData.times] : []
      };
      
      if (editMedication) {
        // Update existing medication
        const updated = await medicationService.updateMedication(editMedication.id, normalizedForm as any);
        if (updated) {
          onMedicationAdded(updated);
          onClose();
        }
      } else {
        // Add new medication
        medication = await medicationService.addMedication(normalizedForm as any);
        onMedicationAdded(medication);
        onClose();
      }
    } catch (error) {
      console.error('Error saving medication:', error);
    }
  };

  const addTime = () => {
    if (timeInput && !formData.times.includes(timeInput)) {
      setFormData(prev => ({
        ...prev,
        times: [...prev.times, timeInput].sort(),
        reminderTimes: prev.reminderEnabled ? [...prev.times, timeInput].sort() : prev.reminderTimes
      }));
      setTimeInput('');
    }
  };

  const removeTime = (timeToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      times: prev.times.filter(time => time !== timeToRemove),
      reminderTimes: prev.reminderEnabled ? prev.times.filter(time => time !== timeToRemove) : prev.reminderTimes
    }));
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gray-800 rounded-2xl border border-gray-700/50 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
              <h2 className="text-2xl font-bold text-white">
                {editMedication ? 'Edit Medication' : 'Add New Medication'}
              </h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Medication Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors ${
                      errors.name ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="e.g., Donepezil"
                  />
                  {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dosage *
                  </label>
                  <input
                    type="text"
                    value={formData.dosage}
                    onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors ${
                      errors.dosage ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="e.g., 10mg"
                  />
                  {errors.dosage && <p className="text-red-400 text-sm mt-1">{errors.dosage}</p>}
                </div>
              </div>

              {/* Frequency and Times */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Frequency *
                  </label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-orange-400 transition-colors"
                  >
                    {frequencyOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Times *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={timeInput}
                      onChange={(e) => setTimeInput(e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-orange-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={addTime}
                      className="px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {errors.times && <p className="text-red-400 text-sm mt-1">{errors.times}</p>}
                  
                  {/* Display selected times */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.times.map(time => (
                      <span
                        key={time}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-sm"
                      >
                        <Clock className="w-3 h-3" />
                        {time}
                        <button
                          type="button"
                          onClick={() => removeTime(time)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Doctor Information */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Doctor Name *
                </label>
                <input
                  type="text"
                  value={formData.doctor}
                  onChange={(e) => setFormData(prev => ({ ...prev, doctor: e.target.value }))}
                  className={`w-full px-4 py-3 bg-gray-700/50 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors ${
                    errors.doctor ? 'border-red-500' : 'border-gray-600'
                  }`}
                  placeholder="e.g., Dr. Sarah Johnson"
                />
                {errors.doctor && <p className="text-red-400 text-sm mt-1">{errors.doctor}</p>}
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Instructions
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors resize-none"
                  rows={3}
                  placeholder="e.g., Take with breakfast, avoid alcohol"
                />
              </div>


              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-xl text-white focus:outline-none focus:border-orange-400 transition-colors ${
                      errors.startDate ? 'border-red-500' : 'border-gray-600'
                    }`}
                  />
                  {errors.startDate && <p className="text-red-400 text-sm mt-1">{errors.startDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    className={`w-full px-4 py-3 bg-gray-700/50 border rounded-xl text-white focus:outline-none focus:border-orange-400 transition-colors ${
                      errors.endDate ? 'border-red-500' : 'border-gray-600'
                    }`}
                  />
                  {errors.endDate && <p className="text-red-400 text-sm mt-1">{errors.endDate}</p>}
                </div>
              </div>

              {/* Refill Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Refill Date
                </label>
                <input
                  type="date"
                  value={formData.refillDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, refillDate: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white focus:outline-none focus:border-orange-400 transition-colors"
                />
              </div>

              {/* Settings */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-400"
                  />
                  <span className="text-gray-300">Active medication</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.reminderEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, reminderEnabled: e.target.checked }))}
                    className="w-4 h-4 text-orange-500 bg-gray-700 border-gray-600 rounded focus:ring-orange-400"
                  />
                  <span className="text-gray-300">Enable reminders</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-700/50">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-300"
                >
                  {editMedication ? 'Update Medication' : 'Add Medication'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddMedicationModal;
