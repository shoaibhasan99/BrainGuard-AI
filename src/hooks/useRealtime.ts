import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realtimeService, RealtimeEvent } from '../lib/realtimeService';
import { notificationService, Notification } from '../lib/notificationService';
import { chatService, Chat, ChatMessage } from '../lib/chatService';

// Real-time hook for the entire app
export const useRealtime = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [chats, setChats] = useState<Chat[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Handle real-time events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    console.log('Real-time event received:', event);

    switch (event.table) {
      case 'notifications':
        if (event.type === 'INSERT') {
          setNotifications(prev => [event.record, ...prev]);
          setUnreadNotificationCount(prev => prev + 1);
        } else if (event.type === 'UPDATE') {
          setNotifications(prev => 
            prev.map(notification => 
              notification.id === event.record.id ? event.record : notification
            )
          );
          if (event.old_record?.read === false && event.record.read === true) {
            setUnreadNotificationCount(prev => Math.max(0, prev - 1));
          }
        }
        break;

      case 'chats':
        if (event.type === 'INSERT') {
          // Only add if chat is active
          if (event.record.is_active) {
            setChats(prev => [event.record, ...prev]);
          }
        } else if (event.type === 'UPDATE') {
          setChats(prev => {
            // If chat was deleted (is_active: false), remove it from the list
            if (!event.record.is_active) {
              return prev.filter(chat => chat.id !== event.record.id);
            }
            // Otherwise, update the chat
            return prev.map(chat => 
              chat.id === event.record.id ? event.record : chat
            );
          });
        }
        break;

      case 'chat_messages':
        if (event.type === 'INSERT') {
          // Update chat's last message and unread count (only for active chats)
          setChats(prev => {
            const updatedChats = prev.map(chat => {
              if (chat.id === event.record.chat_id && chat.is_active) {
                // Only increment unread count if the chat is active
                setUnreadChatCount(prevCount => prevCount + 1);
                return {
                  ...chat,
                  last_message: event.record,
                  unread_count: chat.unread_count + 1,
                  updated_at: event.record.created_at
                };
              }
              return chat;
            });
            return updatedChats;
          });
        }
        break;

      case 'appointments':
        // Refresh appointments data
        console.log('Appointment updated:', event.record);
        break;

      case 'scans':
        // Refresh scans data
        console.log('Scan updated:', event.record);
        break;

      case 'reports':
        // Refresh reports data
        console.log('Report updated:', event.record);
        break;
    }
  }, []);

  // Initialize real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to all user updates
    const channels = realtimeService.subscribeToAllUserUpdates(user.id, handleRealtimeEvent);
    setIsConnected(true);

    // Load initial data
    const loadInitialData = async () => {
      try {
        // Load notifications (only if the service has these methods)
        // Note: notificationService is for browser notifications, not database notifications
        // If you need database notifications, create a separate service
        if (typeof (notificationService as any).getNotifications === 'function') {
          try {
            const notificationsData = await (notificationService as any).getNotifications(user.id);
            setNotifications(notificationsData);
          } catch (err) {
            console.warn('Could not load notifications:', err);
          }
        }
        
        if (typeof (notificationService as any).getUnreadCount === 'function') {
          try {
            const unreadCount = await (notificationService as any).getUnreadCount(user.id);
            setUnreadNotificationCount(unreadCount);
          } catch (err) {
            console.warn('Could not load unread notification count:', err);
          }
        }

        // Load chats
        const chatsData = await chatService.getChats(user.id, user.role);
        setChats(chatsData);

        const chatUnreadCount = await chatService.getUnreadCount(user.id, user.role);
        setUnreadChatCount(chatUnreadCount);
      } catch (error) {
        console.error('Error loading initial real-time data:', error);
      }
    };

    loadInitialData();

    // Cleanup on unmount
    return () => {
      realtimeService.unsubscribeAll();
      setIsConnected(false);
    };
  }, [user, handleRealtimeEvent]);

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    if (typeof (notificationService as any).markAsRead === 'function') {
      const success = await (notificationService as any).markAsRead(notificationId);
      if (success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadNotificationCount(prev => Math.max(0, prev - 1));
      }
      return success;
    }
    return false;
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    if (!user) return false;
    
    if (typeof (notificationService as any).markAllAsRead === 'function') {
      const success = await (notificationService as any).markAllAsRead(user.id);
      if (success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        setUnreadNotificationCount(0);
      }
      return success;
    }
    return false;
  }, [user]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (typeof (notificationService as any).deleteNotification === 'function') {
      const success = await (notificationService as any).deleteNotification(notificationId);
      if (success) {
        setNotifications(prev => 
          prev.filter(notification => notification.id !== notificationId)
        );
        // Update unread count if notification was unread
        const notification = notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
          setUnreadNotificationCount(prev => Math.max(0, prev - 1));
        }
      }
      return success;
    }
    return false;
  }, [notifications]);

  // Create notification
  const createNotification = useCallback(async (
    type: Notification['type'],
    title: string,
    message: string,
    priority: Notification['priority'] = 'medium',
    data?: any
  ) => {
    if (!user) return null;
    
    if (typeof (notificationService as any).createNotification === 'function') {
      return await (notificationService as any).createNotification({
        user_id: user.id,
        type,
        title,
        message,
        data,
        read: false,
        priority,
      });
    }
    return null;
  }, [user]);

  // Get chat messages
  const getChatMessages = useCallback(async (chatId: string) => {
    return await chatService.getMessages(chatId);
  }, []);

  // Send chat message
  const sendChatMessage = useCallback(async (
    chatId: string,
    message: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number
  ) => {
    if (!user) return null;
    
    console.log('📤 useRealtime: Sending message for user:', user.id, 'role:', user.role);
    
    // Get the patient or doctor ID from their respective table
    let senderId: string | null = null;
    
    if (user.role === 'patient') {
      // Get patient ID from patients table
      const { data: patientData, error: patientError } = await chatService.supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (patientError) {
        console.error('❌ Error fetching patient ID:', patientError);
        return null;
      }
      
      if (!patientData) {
        console.error('❌ Patient profile not found');
        return null;
      }
      
      senderId = patientData.id;
      console.log('✅ Patient ID found:', senderId);
    } else if (user.role === 'doctor') {
      // Get doctor ID from doctors table (user_id is TEXT in doctors table)
      const { data: doctorData, error: doctorError } = await chatService.supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id.toString())
        .maybeSingle();
      
      if (doctorError) {
        console.error('❌ Error fetching doctor ID:', doctorError);
        return null;
      }
      
      if (!doctorData) {
        console.error('❌ Doctor profile not found');
        return null;
      }
      
      senderId = doctorData.id;
      console.log('✅ Doctor ID found:', senderId);
    }
    
    if (!senderId) {
      console.error('❌ Could not determine sender ID');
      return null;
    }
    
    return await chatService.sendMessage(
      chatId,
      senderId,
      user.role,
      message,
      messageType,
      fileUrl,
      fileName,
      fileSize
    );
  }, [user]);

  // Mark chat messages as read
  const markChatMessagesAsRead = useCallback(async (chatId: string) => {
    if (!user) return false;
    
    const success = await chatService.markMessagesAsRead(chatId, user.id);
    if (success) {
      setChats(prev => 
        prev.map(chat => 
          chat.id === chatId 
            ? { ...chat, unread_count: 0 }
            : chat
        )
      );
      setUnreadChatCount(prev => Math.max(0, prev - 1));
    }
    return success;
  }, [user]);

  // Create new chat
  const createChat = useCallback(async (patientId: string, doctorId: string) => {
    return await chatService.createChat(patientId, doctorId);
  }, []);

  // Subscribe to specific chat messages
  const subscribeToChat = useCallback((chatId: string, callback: (message: ChatMessage) => void) => {
    console.log('🔔 useRealtime: Subscribing to chat:', chatId);
    chatService.subscribeToChatMessages(chatId, (event) => {
      console.log('📨 useRealtime: Received realtime event:', event);
      if (event.type === 'INSERT' && event.table === 'chat_messages') {
        console.log('✅ useRealtime: Calling callback with message:', event.record);
        callback(event.record as ChatMessage);
      } else {
        console.log('⚠️ useRealtime: Event not matching (type:', event.type, ', table:', event.table, ')');
      }
    });
  }, []);

  // Unsubscribe from chat
  const unsubscribeFromChat = useCallback((chatId: string) => {
    chatService.unsubscribeFromChatMessages(chatId);
  }, []);

  return {
    // Connection status
    isConnected,
    
    // Notifications
    notifications,
    unreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    createNotification,
    
    // Chats
    chats,
    unreadChatCount,
    getChatMessages,
    sendChatMessage,
    markChatMessagesAsRead,
    createChat,
    subscribeToChat,
    unsubscribeFromChat,
    
    // Real-time service
    realtimeService,
  };
};

// Hook for real-time appointments
export const useRealtimeAppointments = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleAppointmentUpdate = useCallback((event: RealtimeEvent) => {
    console.log('Appointment update:', event);
    
    if (event.type === 'INSERT') {
      setAppointments(prev => [event.record, ...prev]);
    } else if (event.type === 'UPDATE') {
      setAppointments(prev => 
        prev.map(appointment => 
          appointment.id === event.record.id ? event.record : appointment
        )
      );
    } else if (event.type === 'DELETE') {
      setAppointments(prev => 
        prev.filter(appointment => appointment.id !== event.record.id)
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = realtimeService.subscribeToAppointments(user.id, handleAppointmentUpdate);
    setIsConnected(true);

    return () => {
      realtimeService.unsubscribe(`appointments-${user.id}`);
      setIsConnected(false);
    };
  }, [user, handleAppointmentUpdate]);

  return {
    appointments,
    isConnected,
    setAppointments,
  };
};

// Hook for real-time scans
export const useRealtimeScans = () => {
  const { user } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleScanUpdate = useCallback((event: RealtimeEvent) => {
    console.log('Scan update:', event);
    
    if (event.type === 'INSERT') {
      setScans(prev => [event.record, ...prev]);
    } else if (event.type === 'UPDATE') {
      setScans(prev => 
        prev.map(scan => 
          scan.id === event.record.id ? event.record : scan
        )
      );
    } else if (event.type === 'DELETE') {
      setScans(prev => 
        prev.filter(scan => scan.id !== event.record.id)
      );
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = realtimeService.subscribeToScans(user.id, handleScanUpdate);
    setIsConnected(true);

    return () => {
      realtimeService.unsubscribe(`scans-${user.id}`);
      setIsConnected(false);
    };
  }, [user, handleScanUpdate]);

  return {
    scans,
    isConnected,
    setScans,
  };
};

// Hook for real-time AI analysis
export const useRealtimeAIAnalysis = (scanId: string) => {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<'queued' | 'processing' | 'completed' | 'failed'>('queued');
  const [isConnected, setIsConnected] = useState(false);

  const handleAnalysisUpdate = useCallback((event: RealtimeEvent) => {
    console.log('AI Analysis update:', event);
    
    if (event.type === 'UPDATE' && event.table === 'scans') {
      const scan = event.record;
      if (scan.status === 'processing') {
        setAnalysisStatus('processing');
        // Simulate progress based on time elapsed
        const progress = Math.min(95, Math.floor((Date.now() - new Date(scan.created_at).getTime()) / 1000));
        setAnalysisProgress(progress);
      } else if (scan.status === 'completed') {
        setAnalysisStatus('completed');
        setAnalysisProgress(100);
      } else if (scan.status === 'failed') {
        setAnalysisStatus('failed');
        setAnalysisProgress(0);
      }
    }
  }, []);

  useEffect(() => {
    if (!scanId) return;

    const channel = realtimeService.subscribeToAIAnalysis(scanId, handleAnalysisUpdate);
    setIsConnected(true);

    return () => {
      realtimeService.unsubscribe(`ai-analysis-${scanId}`);
      setIsConnected(false);
    };
  }, [scanId, handleAnalysisUpdate]);

  return {
    analysisProgress,
    analysisStatus,
    isConnected,
  };
};
