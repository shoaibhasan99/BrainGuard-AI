import { supabase } from './supabase';
import { realtimeService, RealtimeCallback } from './realtimeService';

// Chat message types
export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_type: 'patient' | 'doctor';
  message: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  file_size?: number;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  doctor_name: string;
  last_message?: ChatMessage;
  unread_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Chat service
export class ChatService {
  private listeners: Map<string, RealtimeCallback[]> = new Map();
  public supabase = supabase;

  // Create a new chat
  async createChat(patientId: string, doctorId: string): Promise<Chat | null> {
    try {
      console.log('🔍 Checking for existing chat between patient:', patientId, 'and doctor:', doctorId);
      
      // Check if chat already exists (use maybeSingle to avoid error if none exists)
      // First check for active chats
      const { data: existingActiveChat, error: existingActiveError } = await supabase
        .from('chats')
        .select('*')
        .eq('patient_id', patientId)
        .eq('doctor_id', doctorId)
        .eq('is_active', true)
        .maybeSingle();

      if (existingActiveError && existingActiveError.code !== 'PGRST116') {
        console.error('❌ Error checking for existing active chat:', existingActiveError);
      }

      if (existingActiveChat) {
        console.log('✅ Found existing active chat:', existingActiveChat.id);
        return existingActiveChat;
      }

      // Check if there's a deleted chat that we can reactivate
      const { data: existingDeletedChat, error: existingDeletedError } = await supabase
        .from('chats')
        .select('*')
        .eq('patient_id', patientId)
        .eq('doctor_id', doctorId)
        .eq('is_active', false)
        .maybeSingle();

      if (existingDeletedError && existingDeletedError.code !== 'PGRST116') {
        console.error('❌ Error checking for existing deleted chat:', existingDeletedError);
      }

      if (existingDeletedChat) {
        console.log('🔄 Found deleted chat, reactivating:', existingDeletedChat.id);
        // Reactivate the deleted chat
        const { data: reactivatedChat, error: reactivateError } = await supabase
          .from('chats')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('id', existingDeletedChat.id)
          .select()
          .single();

        if (reactivateError) {
          console.error('❌ Error reactivating chat:', reactivateError);
          // If reactivation fails, continue to create a new chat
        } else if (reactivatedChat) {
          console.log('✅ Chat reactivated successfully:', reactivatedChat.id);
          return reactivatedChat;
        }
      }

      console.log('📝 No existing chat found, creating new one...');

      // Get patient and doctor names
      // Try relationship query first, fallback to direct query if it fails
      let patientName = 'Patient';
      let doctorName = 'Doctor';

      // Get patient name
      try {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*, users!patients_user_id_fkey(name)')
          .eq('id', patientId)
          .maybeSingle();

        if (!patientError && patientData) {
          if (patientData.users && Array.isArray(patientData.users) && patientData.users.length > 0) {
            patientName = patientData.users[0].name;
          } else if (patientData.user_id) {
            // Try direct query
            const { data: patientUser } = await supabase
              .from('users')
              .select('name')
              .eq('id', patientData.user_id)
              .maybeSingle();
            if (patientUser) patientName = patientUser.name;
          }
        }
      } catch (error) {
        console.warn('⚠️ Error fetching patient name, using fallback:', error);
      }

      // Get doctor name - try multiple approaches
      try {
        // First try: Direct query without relationship
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('id, user_id, specialization')
          .eq('id', doctorId)
          .maybeSingle();

        if (!doctorError && doctorData && doctorData.user_id) {
          // Get doctor name from users table
          // Note: doctors.user_id is TEXT, so we need to handle it properly
          const { data: doctorUser, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('id', doctorData.user_id)
            .maybeSingle();

          if (!userError && doctorUser) {
            doctorName = doctorUser.name;
          } else {
            // If user not found, try to get from doctor table's name field if it exists
            console.warn('⚠️ Could not fetch doctor user name, using fallback');
          }
        } else if (doctorError) {
          console.warn('⚠️ Error fetching doctor data:', doctorError);
        }
      } catch (error) {
        console.warn('⚠️ Error fetching doctor name, using fallback:', error);
      }

      console.log('📝 Creating chat with names - Patient:', patientName, 'Doctor:', doctorName);

      // Verify that patient_id matches the current user's patient record
      // This is required for RLS policies
      const { data: currentPatient, error: patientCheckError } = await supabase
        .from('patients')
        .select('id, user_id')
        .eq('id', patientId)
        .maybeSingle();

      if (patientCheckError || !currentPatient) {
        console.error('❌ Error verifying patient:', patientCheckError);
        return null;
      }

      // Verify doctor exists
      const { data: doctorCheck, error: doctorCheckError } = await supabase
        .from('doctors')
        .select('id')
        .eq('id', doctorId)
        .maybeSingle();

      if (doctorCheckError || !doctorCheck) {
        console.error('❌ Error verifying doctor:', doctorCheckError);
        console.error('Doctor ID:', doctorId);
        return null;
      }

      const { data, error } = await supabase
        .from('chats')
        .insert({
          patient_id: patientId,
          doctor_id: doctorId,
          patient_name: patientName,
          doctor_name: doctorName,
          unread_count: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating chat:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Provide more helpful error message
        if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
          console.error('🔒 RLS Policy Error: The user may not have permission to create chats.');
          console.error('💡 Make sure RLS policies allow patients to create chats where patient_id matches their user_id');
        }
        
        return null;
      }

      console.log('✅ Chat created successfully:', data?.id);
      return data;
    } catch (error: any) {
      console.error('💥 Exception creating chat:', error);
      return null;
    }
  }

  // Get chats for a user
  async getChats(userId: string, userRole: 'patient' | 'doctor'): Promise<Chat[]> {
    try {
      console.log('🔍 getChats: Fetching chats for user:', userId, 'role:', userRole);
      
      // First, get the patient or doctor ID from their respective table
      let profileId: string | null = null;
      
      if (userRole === 'patient') {
        // Get patient ID from patients table
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (patientError) {
          console.error('❌ Error fetching patient ID:', patientError);
          return [];
        }
        
        if (!patientData) {
          console.warn('⚠️ Patient profile not found for user:', userId);
          return [];
        }
        
        profileId = patientData.id;
        console.log('✅ Patient ID found:', profileId);
      } else {
        // Get doctor ID from doctors table (user_id is TEXT in doctors table)
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', userId.toString())
          .maybeSingle();
        
        if (doctorError) {
          console.error('❌ Error fetching doctor ID:', doctorError);
          return [];
        }
        
        if (!doctorData) {
          console.warn('⚠️ Doctor profile not found for user:', userId);
          return [];
        }
        
        profileId = doctorData.id;
        console.log('✅ Doctor ID found:', profileId);
      }
      
      if (!profileId) {
        console.error('❌ Could not determine profile ID');
        return [];
      }
      
      // Now get the chats using the profile ID
      let query = supabase
        .from('chats')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (userRole === 'patient') {
        query = query.eq('patient_id', profileId);
      } else {
        query = query.eq('doctor_id', profileId);
      }

      const { data: chats, error } = await query;

      if (error) {
        console.error('Error fetching chats:', error);
        return [];
      }

      if (!chats || chats.length === 0) {
        console.log('📭 No chats found');
        return [];
      }

      console.log('✅ Found', chats.length, 'chats');

      // Fetch last message for each chat separately
      const chatsWithLastMessage = await Promise.all(
        chats.map(async (chat) => {
          // Get the last message for this chat
          const { data: lastMessageData } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('chat_id', chat.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...chat,
            last_message: lastMessageData || undefined,
          };
        })
      );

      return chatsWithLastMessage;
    } catch (error) {
      console.error('Error fetching chats:', error);
      return [];
    }
  }

  // Get messages for a chat
  async getMessages(chatId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return (data || []).reverse();
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Send a message
  async sendMessage(
    chatId: string,
    senderId: string,
    senderType: 'patient' | 'doctor',
    message: string,
    messageType: 'text' | 'image' | 'file' = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number
  ): Promise<ChatMessage | null> {
    try {
      // First, check if the chat exists and is active
      const { data: chatData, error: chatCheckError } = await supabase
        .from('chats')
        .select('id, is_active')
        .eq('id', chatId)
        .maybeSingle();

      if (chatCheckError) {
        console.error('Error checking chat:', chatCheckError);
        return null;
      }

      if (!chatData) {
        console.error('Chat not found:', chatId);
        return null;
      }

      if (!chatData.is_active) {
        console.error('Cannot send message to deleted/inactive chat:', chatId);
        return null;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          sender_type: senderType,
          message,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      // Update chat's last message and unread count (only if chat is active)
      await this.updateChatLastMessage(chatId, data.id);

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      return null;
    }
  }

  // Update chat's last message (only for active chats)
  private async updateChatLastMessage(chatId: string, messageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chats')
        .update({
          last_message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId)
        .eq('is_active', true); // Only update if chat is active

      if (error) {
        console.error('Error updating chat last message:', error);
      }
    } catch (error) {
      console.error('Error updating chat last message:', error);
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
        return false;
      }

      // Update chat unread count
      await this.updateChatUnreadCount(chatId);

      return true;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
  }

  // Update chat unread count
  private async updateChatUnreadCount(chatId: string): Promise<void> {
    try {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .eq('read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return;
      }

      await supabase
        .from('chats')
        .update({ unread_count: count || 0 })
        .eq('id', chatId);
    } catch (error) {
      console.error('Error updating unread count:', error);
    }
  }

  // Upload file for chat
  async uploadChatFile(file: File, chatId: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      // Path should be relative to bucket root (no 'chat-files/' prefix)
      const filePath = `${chatId}/${fileName}`;

      console.log('📤 Uploading file to path:', filePath);

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
      }

      console.log('✅ File uploaded successfully');

      // Try to get signed URL first (works for private buckets)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(filePath, 31536000); // 1 year expiry

      if (!signedError && signedData) {
        console.log('✅ Created signed URL:', signedData.signedUrl);
        return signedData.signedUrl;
      }

      // Fallback to public URL if signed URL fails
      const { data: publicData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      console.log('✅ Created public URL:', publicData.publicUrl);
      return publicData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }

  // Get signed URL for a file (for viewing/downloading)
  async getFileSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      // Extract file path from full URL if needed
      // The path should be relative to bucket root: {chatId}/{fileName}
      let path = filePath;
      
      // If it's already a full URL, extract the path
      if (filePath.includes('/storage/v1/object/public/chat-files/')) {
        path = filePath.split('/storage/v1/object/public/chat-files/')[1];
        // Remove any query parameters
        path = path.split('?')[0];
      } else if (filePath.includes('/storage/v1/object/sign/chat-files/')) {
        // Extract path from signed URL (remove query params)
        const urlParts = filePath.split('/storage/v1/object/sign/chat-files/')[1];
        path = urlParts.split('?')[0];
      } else if (filePath.startsWith('http')) {
        // Try to extract from any HTTP URL format
        try {
          const urlObj = new URL(filePath);
          // Try multiple patterns to extract the path after 'chat-files/'
          const patterns = [
            /\/storage\/v1\/object\/(?:public|sign)\/chat-files\/(.+?)(?:\?|$)/,
            /chat-files\/(.+?)(?:\?|$)/,
            /\/chat-files\/(.+?)(?:\?|$)/
          ];
          
          for (const pattern of patterns) {
            const match = urlObj.pathname.match(pattern);
            if (match && match[1]) {
              path = match[1];
              break;
            }
          }
        } catch (urlError) {
          console.warn('Error parsing URL:', urlError);
        }
      }
      
      // Remove 'chat-files/' prefix if it exists (path should be relative to bucket)
      if (path.startsWith('chat-files/')) {
        path = path.replace('chat-files/', '');
      }
      
      // Remove any leading slashes
      path = path.replace(/^\/+/, '');

      console.log('📁 Extracted file path:', path, 'from original:', filePath);

      // Try creating signed URL with the extracted path
      let { data, error } = await supabase.storage
        .from('chat-files')
        .createSignedUrl(path, expiresIn);

      // If that fails, try with 'chat-files/' prefix (for old uploads)
      if (error && !path.startsWith('chat-files/')) {
        console.log('⚠️ Trying alternative path with chat-files/ prefix');
        const altPath = `chat-files/${path}`;
        const result = await supabase.storage
          .from('chat-files')
          .createSignedUrl(altPath, expiresIn);
        
        if (!result.error && result.data) {
          console.log('✅ Created signed URL with alternative path');
          return result.data.signedUrl;
        }
      }

      if (error) {
        console.error('Error creating signed URL:', error);
        console.error('Attempted path:', path);
        console.error('Original filePath:', filePath);
        // If signed URL fails, try public URL as fallback
        const { data: publicData } = supabase.storage
          .from('chat-files')
          .getPublicUrl(path);
        return publicData.publicUrl;
      }

      console.log('✅ Created signed URL for path:', path);
      return data?.signedUrl || filePath;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      // Return original URL as fallback
      return filePath;
    }
  }

  // Subscribe to chat messages
  subscribeToChatMessages(chatId: string, callback: RealtimeCallback): void {
    console.log('🔔 chatService: Subscribing to chat messages for chat:', chatId);
    const wrappedCallback: RealtimeCallback = (event) => {
      console.log('📨 chatService: Received realtime event for chat:', chatId, event);
      callback(event);
    };
    realtimeService.subscribeToChatMessages(chatId, wrappedCallback);
    
    // Store listener for cleanup
    if (!this.listeners.has(chatId)) {
      this.listeners.set(chatId, []);
    }
    this.listeners.get(chatId)!.push(wrappedCallback);
  }

  // Unsubscribe from chat messages
  unsubscribeFromChatMessages(chatId: string): void {
    realtimeService.unsubscribe(`chat-${chatId}`);
    this.listeners.delete(chatId);
  }

  // Get unread message count for a user
  async getUnreadCount(userId: string, userRole: 'patient' | 'doctor'): Promise<number> {
    try {
      // First, get the patient or doctor ID from their respective table
      let profileId: string | null = null;
      
      if (userRole === 'patient') {
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (!patientData) return 0;
        profileId = patientData.id;
      } else {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id')
          .eq('user_id', userId.toString())
          .maybeSingle();
        
        if (!doctorData) return 0;
        profileId = doctorData.id;
      }
      
      if (!profileId) return 0;
      
      let query = supabase
        .from('chats')
        .select('unread_count')
        .eq('is_active', true);

      if (userRole === 'patient') {
        query = query.eq('patient_id', profileId);
      } else {
        query = query.eq('doctor_id', profileId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return data?.reduce((sum, chat) => sum + chat.unread_count, 0) || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Delete chat
  async deleteChat(chatId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_active: false })
        .eq('id', chatId);

      if (error) {
        console.error('Error deleting chat:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }

  // Delete a specific message
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId)
        .select();

      if (error) {
        console.error('Error deleting message:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return false;
      }

      if (!data || data.length === 0) {
        console.warn('No message deleted. Message may not exist or RLS policy prevented deletion.');
        return false;
      }

      console.log('✅ Message deleted successfully:', messageId);
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  }

  // Search messages
  async searchMessages(chatId: string, searchTerm: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .ilike('message', `%${searchTerm}%`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }
}

// Create singleton instance
export const chatService = new ChatService();
