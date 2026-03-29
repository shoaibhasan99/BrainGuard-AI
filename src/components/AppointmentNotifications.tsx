import React from 'react';
import { Bell, Check, X, Clock } from 'lucide-react';
import { AppointmentNotificationRecord } from '../hooks/useAppointmentNotifications';

interface AppointmentNotificationsProps {
  title?: string;
  notifications: AppointmentNotificationRecord[];
  isLoading?: boolean;
  error?: string | null;
  onMarkSeen: (id: string) => void;
  onDismiss: (id: string) => void;
  variant?: 'patient' | 'doctor';
}

const AppointmentNotifications: React.FC<AppointmentNotificationsProps> = ({
  title = 'Upcoming Reminders',
  notifications,
  isLoading,
  error,
  onMarkSeen,
  onDismiss,
  variant = 'patient',
}) => {
  const pending = notifications.filter(
    (notif) => notif.status === 'pending' || notif.status === 'sent'
  );

  if (!pending.length && !isLoading) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-cyan-900/20 via-gray-900/40 to-blue-900/20 border border-cyan-500/30 rounded-2xl p-4 md:p-5 shadow-lg shadow-cyan-900/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
            <Bell className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-sm text-cyan-200/80 uppercase tracking-wide">Notifications</p>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
          </div>
        </div>
        {isLoading && (
          <span className="text-xs text-gray-400 animate-pulse">Loading…</span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-xl bg-red-500/15 text-red-200 text-sm border border-red-500/30">
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
        {pending.map((notification) => (
          <div
            key={notification.id}
            className="bg-gray-900/40 border border-cyan-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <Clock className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-400">
                  Reminder for appointment scheduled at{' '}
                  {new Date(notification.scheduled_for).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onMarkSeen(notification.id)}
                className="px-3 py-1.5 text-xs rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 hover:bg-emerald-500/25 transition-all duration-300 flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Got it
              </button>
              <button
                onClick={() => onDismiss(notification.id)}
                className="px-3 py-1.5 text-xs rounded-xl bg-gray-700/40 border border-gray-600/60 text-gray-300 hover:bg-gray-700/60 transition-all duration-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentNotifications;














