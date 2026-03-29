import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { notificationOperations } from '../lib/supabase-operations';

export interface AppointmentNotificationRecord {
  id: string;
  appointment_id: string;
  role: 'patient' | 'doctor';
  message: string;
  scheduled_for: string;
  lead_minutes: number;
  status: 'pending' | 'sent' | 'seen' | 'dismissed';
  created_at: string;
  sent_at?: string;
  seen_at?: string;
  appointments?: any;
}

export const useAppointmentNotifications = (userId?: string | null) => {
  const [notifications, setNotifications] = useState<AppointmentNotificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await notificationOperations.getUserNotifications(userId);
      setNotifications(data || []);
    } catch (err: any) {
      console.error('Failed to load notifications:', err);
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`appointment_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_notifications',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            await loadNotifications();
            return;
          }

          setNotifications((current) => {
            if (payload.eventType === 'UPDATE' && payload.new) {
              return current.map((notif) =>
                notif.id === payload.new.id ? (payload.new as AppointmentNotificationRecord) : notif
              );
            }
            if (payload.eventType === 'DELETE' && payload.old) {
              return current.filter((notif) => notif.id !== payload.old.id);
            }
            return current;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('🔔 Realtime notifications subscribed');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsSeen = useCallback(async (notificationId: string) => {
    await notificationOperations.markNotificationStatus(notificationId, 'seen');
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    await notificationOperations.markNotificationStatus(notificationId, 'dismissed');
  }, []);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await notificationOperations.deleteNotification(notificationId);
  }, []);

  return {
    notifications,
    isLoading,
    error,
    reload: loadNotifications,
    markAsSeen,
    dismissNotification,
    deleteNotification,
  };
};

