// src/components/ReminderManagement.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bell, 
  Clock, 
  Pause, 
  Volume2, 
  VolumeX
} from 'lucide-react';
import { Medication as MedicationType } from '../lib/medicationService';
import { notificationService } from '../lib/notificationService';

interface ReminderManagementProps {
  medications: MedicationType[];
}

const ReminderManagement: React.FC<ReminderManagementProps> = ({ medications }) => {
  console.log('ReminderManagement component rendering with medications:', medications.length);
  
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    try {
      setNotificationsEnabled(notificationService.isAvailable());
    } catch {}
  }, []);

  const enableNotifications = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationsEnabled(granted);
  };
  // no test reminder button in production UI

  // Get active reminders
  const activeReminders = medications.filter(med => med.reminderEnabled && med.isActive);
  console.log('Active reminders:', activeReminders.length);

  // Stop all alarms
  const stopAllAlarms = () => {
    window.speechSynthesis.cancel();
  };

  return (
    <div className="space-y-6">
      {/* Debug info */}
      <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 mb-4">
        <p className="text-blue-300 text-sm">
          🔔 ReminderManagement loaded! Medications: {medications.length}, Active reminders: {activeReminders.length}
        </p>
      </div>
      
      {/* Voice Alarm Controls */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        {!notificationsEnabled && (
          <div className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-300">
            Notifications are currently disabled. Click Enable to show reminder pop-ups. Voice reminders will still work after a click.
          </div>
        )}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">Voice Alarm Settings</h3>
              <p className="text-gray-400 text-sm">Configure voice reminders for medications</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-3 rounded-xl transition-all duration-200 ${
                voiceEnabled 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
          {!notificationsEnabled && (
            <button
              onClick={enableNotifications}
              className="px-3 py-2 rounded-xl bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 transition-colors text-sm"
            >
              Enable notifications
            </button>
          )}
          {/* Test Reminder button removed */}
          </div>
        </div>

        {/* Voice Alarm Status */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-3 h-3 rounded-full ${voiceEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-300">
              Voice alarms are {voiceEnabled ? 'enabled' : 'disabled'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {voiceEnabled 
              ? 'Medication reminders will include voice announcements'
              : 'Only visual notifications will be shown'
            }
          </p>
        </div>

        {/* Stop All Alarms */}
        <div className="flex justify-center">
          <motion.button
            onClick={stopAllAlarms}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded-xl transition-all duration-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Pause className="w-4 h-4" />
            Stop All Alarms
          </motion.button>
        </div>
      </motion.div>

      {/* Active Reminders */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">Active Reminders</h3>
            <p className="text-gray-400 text-sm">{activeReminders.length} medications with reminders</p>
          </div>
        </div>

        {activeReminders.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No active medication reminders</p>
            <p className="text-gray-500 text-sm">Enable reminders for your medications to see them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeReminders.map((medication, index) => (
              <motion.div
                key={medication.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                      <Bell className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{medication.name}</h4>
                      <p className="text-orange-400 text-sm">{medication.dosage}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${voiceEnabled ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <span className="text-xs text-gray-400">
                      {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span>Times: {medication.times.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Volume2 className="w-4 h-4" />
                    <span>
                      {voiceEnabled 
                        ? 'Voice alarm enabled' 
                        : 'Visual notification only'
                      }
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  );
};

export default ReminderManagement;
