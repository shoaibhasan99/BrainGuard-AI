import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Real-time event types
export interface RealtimeEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
}

// Real-time subscription callbacks
export type RealtimeCallback = (payload: RealtimeEvent) => void;

// Real-time service for medical app
export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscribe to appointment updates for a specific user
  subscribeToAppointments(userId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `appointments-${userId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `patient_id=in.(SELECT id FROM patients WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'appointments',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=in.(SELECT id FROM doctors WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'appointments',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to scan updates for a specific user
  subscribeToScans(userId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `scans-${userId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scans',
          filter: `patient_id=in.(SELECT id FROM patients WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'scans',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scans',
          filter: `doctor_id=in.(SELECT id FROM doctors WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'scans',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to report updates for a specific user
  subscribeToReports(userId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `reports-${userId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `patient_id=in.(SELECT id FROM patients WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'reports',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `doctor_id=in.(SELECT id FROM doctors WHERE user_id = '${userId}')`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'reports',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to chat messages (if chat table exists)
  subscribeToChatMessages(chatId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `chat-${chatId}`;
    
    console.log('🔔 realtimeService: Setting up subscription for chat:', chatId, 'channel:', channelName);
    
    if (this.channels.has(channelName)) {
      console.log('⚠️ realtimeService: Channel already exists, unsubscribing first');
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          console.log('📨 realtimeService: Received postgres_changes event for chat:', chatId, payload);
          callback({
            type: 'INSERT',
            table: 'chat_messages',
            record: payload.new,
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 realtimeService: Subscription status for chat', chatId, ':', status);
      });

    this.channels.set(channelName, channel);
    console.log('✅ realtimeService: Subscription set up for chat:', chatId);
    return channel;
  }

  // Subscribe to doctor availability updates
  subscribeToDoctorAvailability(doctorId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `doctor-availability-${doctorId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctors',
          filter: `id=eq.${doctorId}`,
        },
        (payload) => {
          callback({
            type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
            table: 'doctors',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to AI analysis progress updates
  subscribeToAIAnalysis(scanId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `ai-analysis-${scanId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'scans',
          filter: `id=eq.${scanId}`,
        },
        (payload) => {
          callback({
            type: 'UPDATE',
            table: 'scans',
            record: payload.new,
            old_record: payload.old,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to notifications
  subscribeToNotifications(userId: string, callback: RealtimeCallback): RealtimeChannel {
    const channelName = `notifications-${userId}`;
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback({
            type: 'INSERT',
            table: 'notifications',
            record: payload.new,
          });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to all user-related updates
  subscribeToAllUserUpdates(userId: string, callback: RealtimeCallback): RealtimeChannel[] {
    const channels = [
      this.subscribeToAppointments(userId, callback),
      this.subscribeToScans(userId, callback),
      this.subscribeToReports(userId, callback),
      this.subscribeToNotifications(userId, callback),
    ];

    return channels;
  }

  // Unsubscribe from a specific channel
  unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll(): void {
    this.channels.forEach((channel, channelName) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  // Get active channels
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  // Check if a channel is active
  isChannelActive(channelName: string): boolean {
    return this.channels.has(channelName);
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService();

// Real-time hooks for React components
export const useRealtimeSubscription = () => {
  const subscribe = (channelName: string, callback: RealtimeCallback) => {
    return realtimeService.subscribeToAllUserUpdates(channelName, callback);
  };

  const unsubscribe = (channelName: string) => {
    realtimeService.unsubscribe(channelName);
  };

  const unsubscribeAll = () => {
    realtimeService.unsubscribeAll();
  };

  return {
    subscribe,
    unsubscribe,
    unsubscribeAll,
    getActiveChannels: realtimeService.getActiveChannels.bind(realtimeService),
    isChannelActive: realtimeService.isChannelActive.bind(realtimeService),
  };
};
