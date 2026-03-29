import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  Search, 
  MoreVertical,
  Star,
  Plus,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  Loader2,
  Mic,
  Square,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../hooks/useRealtime';
import { ChatService, ChatMessage } from '../lib/chatService';

interface Contact {
  id: string;
  name: string;
  subtitle: string;
  avatar_url?: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  last_seen: string;
  is_verified: boolean;
  user_id: string;
  type: 'doctor' | 'patient';
  rating?: number;
  response_time?: string;
}

interface Message extends ChatMessage {
  sender_name?: string;
  sender_avatar?: string;
}

const Chat: React.FC = () => {
  const { user } = useAuth();
  const isPatient = user?.role?.toLowerCase() === 'patient';
  const { 
    chats, 
    sendChatMessage, 
    markChatMessagesAsRead, 
    createChat,
    subscribeToChat,
    unsubscribeFromChat
  } = useRealtime();
  
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Map<string, string>>(new Map());
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // Store current user's patient_id or doctor_id
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const chatService = new ChatService();

  // Fetch available contacts (doctors for patients, patients for doctors)
  const fetchContacts = useCallback(async () => {
    if (!user) {
      setContacts([]);
      return;
    }
    
    try {
      setIsLoading(true);
      
      if (isPatient) {
        console.log('🔍 Fetching doctors for patient...');
        
        // First, try to fetch doctors with the foreign key relationship
        let { data, error } = await chatService.supabase
          .from('doctors')
          .select(`
            id,
            user_id,
            specialization,
            experience_years,
            consultation_fee,
            languages,
            qualifications,
            hospital_affiliation,
            is_verified,
            users!inner (
              id,
              name,
              email,
              avatar_url,
              gender,
              updated_at
            )
          `)
          .eq('is_verified', true)
          .order('created_at', { ascending: false })
          .limit(50);

        // If the above fails, try without the inner join
        if (error) {
          console.warn('⚠️ Error with inner join, trying alternative query:', error);
          const { data: doctorsData, error: doctorsError } = await chatService.supabase
            .from('doctors')
            .select('id, user_id, specialization, experience_years, consultation_fee, languages, qualifications, hospital_affiliation, is_verified')
            .eq('is_verified', true)
            .order('created_at', { ascending: false })
            .limit(50);

          if (doctorsError) {
            console.error('❌ Error fetching doctors:', doctorsError);
            setContacts([]);
            return;
          }

          if (!doctorsData || doctorsData.length === 0) {
            console.log('📭 No verified doctors found in database');
            setContacts([]);
            return;
          }

          // Fetch user data separately
          const userIds = doctorsData.map((d: any) => d.user_id).filter(Boolean);
          const { data: usersData, error: usersError } = await chatService.supabase
            .from('users')
            .select('id, name, email, avatar_url, gender, updated_at')
            .in('id', userIds);

          if (usersError) {
            console.error('❌ Error fetching user data:', usersError);
          }

          // Combine the data
          const contactsData: Contact[] = doctorsData.map((doctor: any) => {
            const userData = usersData?.find((u: any) => u.id === doctor.user_id);
            const doctorName = userData?.name || 'Dr. Unknown';
            
            // Determine avatar URL based on gender only
            let avatarUrl = userData?.avatar_url;
            const userGender = userData?.gender?.toLowerCase();
            
            // Use gender field to determine avatar
            if (!avatarUrl) {
              if (userGender === 'female' || userGender === 'f') {
                // Use female avatar for female users
                avatarUrl = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
              } else {
                // Use male avatar for male users or as default
                avatarUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
              }
            }
            
            return {
              id: doctor.id,
              name: doctorName,
              subtitle: doctor.specialization || 'General Medicine',
              avatar_url: avatarUrl,
              status: 'offline',
              last_seen: userData?.updated_at ? new Date(userData.updated_at).toLocaleString() : 'Unknown',
              rating: 4.8,
              response_time: '< 30 min',
              is_verified: doctor.is_verified !== false,
              user_id: userData?.id || doctor.user_id || '',
              type: 'doctor'
            };
          });

          console.log(`✅ Loaded ${contactsData.length} doctors`);
          setContacts(contactsData);
          return;
        }

        if (!data || data.length === 0) {
          console.log('📭 No verified doctors found in database');
          setContacts([]);
          return;
        }

        const contactsData: Contact[] = data
          .filter((doctor: any) => doctor.users)
          .map((doctor: any) => {
            const userData = Array.isArray(doctor.users) ? doctor.users[0] : doctor.users;
            const doctorName = userData?.name || 'Dr. Unknown';
            
            // Determine avatar URL based on gender only
            let avatarUrl = userData?.avatar_url;
            const userGender = userData?.gender?.toLowerCase();
            
            // Use gender field to determine avatar
            if (!avatarUrl) {
              if (userGender === 'female' || userGender === 'f') {
                // Use female avatar for female users
                avatarUrl = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&h=150&fit=crop&crop=face';
              } else {
                // Use male avatar for male users or as default
                avatarUrl = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face';
              }
            }
            
            return {
              id: doctor.id,
              name: doctorName,
              subtitle: doctor.specialization || 'General Medicine',
              avatar_url: avatarUrl,
              status: 'offline',
              last_seen: userData?.updated_at ? new Date(userData.updated_at).toLocaleString() : 'Unknown',
              rating: 4.8,
              response_time: '< 30 min',
              is_verified: doctor.is_verified !== false,
              user_id: userData?.id || '',
              type: 'doctor'
            };
          });

        console.log(`✅ Loaded ${contactsData.length} doctors`);
        setContacts(contactsData);
      } else {
        const { data, error } = await chatService.supabase
          .from('patients')
          .select(`
            id,
            user_id,
            date_of_birth,
            users:users!patients_user_id_fkey (
              id,
              name,
              email,
              avatar_url,
              updated_at
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching patients:', error);
          setContacts([]);
          return;
        }

        if (!data || data.length === 0) {
          console.log('📭 No patients found in database');
          setContacts([]);
          return;
        }

        const patientContacts: Contact[] = data
          .filter((patient: any) => patient.users)
          .map((patient: any) => {
            const userData = Array.isArray(patient.users) ? patient.users[0] : patient.users;
            return {
              id: patient.id,
              name: userData?.name || 'Patient',
              subtitle: userData?.email || 'patient',
              avatar_url: userData?.avatar_url,
              status: 'offline',
              last_seen: userData?.updated_at ? new Date(userData.updated_at).toLocaleString() : 'Unknown',
              is_verified: true,
              user_id: userData?.id || '',
              type: 'patient'
            };
          });

        setContacts(patientContacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isPatient]);

  // Fetch messages for selected chat
  const fetchMessages = useCallback(async (chatId: string) => {
    try {
      const messagesData = await chatService.getMessages(chatId);
      // Deduplicate messages by ID to prevent duplicates
      const uniqueMessages = messagesData.reduce((acc: Message[], message: Message) => {
        if (!acc.find(msg => msg.id === message.id)) {
          acc.push(message);
        }
        return acc;
      }, []);
      setMessages(uniqueMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  }, []); // chatService is a singleton, no need to include it in dependencies

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.subtitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get current chat and messages
  const currentChat = chats.find(chat => chat.id === selectedChat);
  
  // Get the doctor for the current chat
  const currentContact = currentChat
    ? contacts.find(c => c.id === (isPatient ? currentChat.doctor_id : currentChat.patient_id))
    : null;
  
  // Debug logging for chat creation issues
  React.useEffect(() => {
    if (selectedChat && !currentContact && currentChat) {
      console.log('⚠️ Chat selected but doctor not found:', {
        selectedChat,
        contactId: isPatient ? currentChat?.doctor_id : currentChat?.patient_id,
        contactsCount: contacts.length,
        contactIds: contacts.map(c => c.id)
      });
    }
  }, [selectedChat, currentChat, currentContact, contacts, isPatient]);
  
  // Filter messages for current chat
  const currentMessages = messages.filter(msg => msg.chat_id === selectedChat);
  
  // Use only real chats from database
  const allChats = React.useMemo(() => {
    return chats.filter(chat => chat.is_active);
  }, [chats]);

  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Only scroll to bottom when messages change, not on every render
    if (currentMessages.length > 0) {
      const timer = setTimeout(() => {
    scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentMessages.length, scrollToBottom]);

  // Load contacts on component mount
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat);
      // Mark messages as read after a short delay to avoid race conditions
      const timer = setTimeout(() => {
        markChatMessagesAsRead(selectedChat);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      // Clear messages when no chat is selected
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]); // Only depend on selectedChat to avoid infinite loops

  // Get signed URL for file messages
  const getFileUrl = useCallback(async (message: Message) => {
    if (!message.file_url) return null;
    
    // If already cached, return it
    if (fileUrls.has(message.id)) {
      const cachedUrl = fileUrls.get(message.id)!;
      console.log('📦 Using cached URL for message:', message.id, cachedUrl);
      return cachedUrl;
    }

    // For real chats, get signed URL
    try {
      console.log('🔍 Getting signed URL for file:', message.file_url);
      const signedUrl = await chatService.getFileSignedUrl(message.file_url, 3600);
      console.log('✅ Got signed URL:', signedUrl);
      
      if (signedUrl && signedUrl.startsWith('http')) {
        setFileUrls(prev => new Map(prev).set(message.id, signedUrl));
        return signedUrl;
      } else {
        console.warn('⚠️ Invalid signed URL returned:', signedUrl);
      }
    } catch (error) {
      console.error('❌ Error getting signed URL:', error);
    }

    // Fallback: check if original URL is already a full URL
    if (message.file_url && message.file_url.startsWith('http')) {
      console.log('📎 Using original file_url as fallback:', message.file_url);
      return message.file_url;
    }

    console.error('❌ No valid URL found for message:', message.id, 'file_url:', message.file_url);
    return null;
  }, [fileUrls, chatService]);

  // Handle file download/view
  const handleFileView = useCallback(async (message: Message) => {
    const url = await getFileUrl(message);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Unable to access file. Please try again.');
    }
  }, [getFileUrl]);

  // Handle voice message playback
  const handleVoicePlay = useCallback(async (message: Message) => {
    if (!message.file_url) return;

    const messageId = message.id;
    
    // Stop any currently playing audio
    if (playingAudioId && playingAudioId !== messageId) {
      const prevAudio = audioElementsRef.current.get(playingAudioId);
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    // If already playing, pause it
    if (playingAudioId === messageId) {
      const audio = audioElementsRef.current.get(messageId);
      if (audio) {
        audio.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    try {
      // Get signed URL for the audio file
      const url = await getFileUrl(message);
      if (!url || !url.startsWith('http')) {
        console.error('❌ Invalid URL for voice message:', url);
        setPlayingAudioId(null);
        return;
      }
      
      console.log('🎵 Playing voice message from URL:', url);

      // Create or get audio element
      let audio = audioElementsRef.current.get(messageId);
      if (!audio) {
        audio = new Audio();
        audio.crossOrigin = 'anonymous'; // Handle CORS if needed
        audio.preload = 'auto';
        audioElementsRef.current.set(messageId, audio);
        
        const audioElement = audio; // Store reference for use in callbacks
        
        audioElement.onended = () => {
          setPlayingAudioId(null);
        };
        
        audioElement.onerror = (e) => {
          console.error('Error playing audio:', e);
          console.error('Audio error details:', {
            error: audioElement.error,
            networkState: audioElement.networkState,
            readyState: audioElement.readyState,
            src: audioElement.src
          });
          // Silently handle error - just stop playing and remove element
          setPlayingAudioId(null);
          // Remove the broken audio element
          audioElementsRef.current.delete(messageId);
        };
        
        audioElement.onloadstart = () => {
          console.log('Audio loading started');
        };
        
        audioElement.oncanplay = () => {
          console.log('Audio can play');
        };
      }
      
      // Ensure audio is defined (should always be at this point)
      if (!audio) {
        console.error('Audio element not found for message:', messageId);
        return;
      }
      
      // Set the source and load
      if (audio.src !== url) {
        audio.src = url;
        // Wait for the audio to be ready to play
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Audio load timeout'));
          }, 10000); // 10 second timeout
          
          const onCanPlay = () => {
            clearTimeout(timeout);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
            resolve(undefined);
          };
          
          const onError = (e: Event) => {
            clearTimeout(timeout);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('error', onError);
            reject(e);
          };
          
          audio.addEventListener('canplay', onCanPlay);
          audio.addEventListener('error', onError);
          
          // Start loading
          audio.load();
        });
      }

      // Play the audio
      await audio.play();
      setPlayingAudioId(messageId);
    } catch (error: any) {
      console.error('Error playing voice message:', error);
      const errorMessage = error?.message || 'Unknown error';
      // Silently handle errors - just log and stop playing
      if (errorMessage.includes('timeout')) {
        console.warn('Audio file is taking too long to load. Please check your connection and try again.');
      } else if (errorMessage.includes('NotAllowedError') || errorMessage.includes('NotAllowed')) {
        console.warn('Please interact with the page first before playing audio.');
      } else {
        console.warn(`Unable to play voice message: ${errorMessage}`);
      }
      setPlayingAudioId(null);
    }
  }, [getFileUrl, playingAudioId]);

  // Fetch current user's patient_id or doctor_id
  useEffect(() => {
    const fetchCurrentUserId = async () => {
      if (!user) {
        setCurrentUserId(null);
        return;
      }

      try {
        if (isPatient) {
          const { data: patientData, error } = await chatService.supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (!error && patientData) {
            setCurrentUserId(patientData.id);
          }
        } else {
          const { data: doctorData, error } = await chatService.supabase
            .from('doctors')
            .select('id')
            .eq('user_id', user.id.toString())
            .maybeSingle();
          
          if (!error && doctorData) {
            setCurrentUserId(doctorData.id);
          }
        }
      } catch (error) {
        console.error('Error fetching current user ID:', error);
      }
    };

    fetchCurrentUserId();
  }, [user, isPatient]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (selectedChat) {
      console.log('🔔 Subscribing to chat messages for chat:', selectedChat);
      subscribeToChat(selectedChat, (message: ChatMessage) => {
        console.log('📨 New message received via realtime in Chat component:', message);
        setMessages(prev => {
          // Check if message already exists to avoid duplicates (more robust check)
          // Check by ID first, then by content and timestamp as fallback
          const existsById = prev.some(msg => msg.id === message.id);
          if (existsById) {
            console.log('⚠️ Duplicate message detected by ID, skipping:', message.id);
            return prev;
          }
          
          // Additional check: same content, same sender, within 2 seconds (handles race conditions)
          const existsByContent = prev.some(msg => 
            msg.message === message.message &&
            msg.sender_id === message.sender_id &&
            msg.chat_id === message.chat_id &&
            Math.abs(new Date(msg.created_at).getTime() - new Date(message.created_at).getTime()) < 2000
          );
          
          if (existsByContent) {
            console.log('⚠️ Duplicate message detected by content, skipping:', message.id);
            return prev;
          }
          
          console.log('✅ Adding new message to chat:', message.id);
          return [...prev, message as Message];
        });
        // Scroll to bottom when new message arrives
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });
    }

    return () => {
      if (selectedChat) {
        console.log('🔕 Unsubscribing from chat:', selectedChat);
        unsubscribeFromChat(selectedChat);
      }
    };
  }, [selectedChat, subscribeToChat, unsubscribeFromChat]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || !user || isSending) {
      return;
    }

    try {
      setIsSending(true);
      
      // Send message using the real chat service
      const message = await sendChatMessage(selectedChat, newMessage.trim());
      
      if (message) {
        // Don't add message here - let real-time subscription handle it to avoid duplicates
        // The real-time subscription will receive the message and add it
        setNewMessage('');
        
        // Scroll to bottom after a short delay to allow real-time message to arrive
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // File handling functions
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      
      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid file type (images, PDF, Word documents, or text files)');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !selectedChat || !user || isUploading) {
      return;
    }

    try {
      setIsUploading(true);
      
      
      // For real chats, upload to Supabase storage
      const fileUrl = await chatService.uploadChatFile(selectedFile, selectedChat);
      
      if (fileUrl) {
        // Use sendChatMessage from useRealtime hook which handles sender_id correctly
        const message = await sendChatMessage(
          selectedChat,
          `📎 ${selectedFile.name}`,
          'file',
          fileUrl,
          selectedFile.name,
          selectedFile.size
        );
        
        if (message) {
          // Don't add message here - let real-time subscription handle it to avoid duplicates
          // The real-time subscription will receive the message and add it
          setSelectedFile(null);
          
          // Clear the file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // Scroll to bottom after a short delay to allow real-time message to arrive
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !selectedChat || !user) {
      return;
    }

    try {
      setIsSending(true);
      
      
      // For real chats, upload voice file
      const voiceFile = new File([audioBlob], `voice-${Date.now()}.wav`, { type: 'audio/wav' });
      const fileUrl = await chatService.uploadChatFile(voiceFile, selectedChat);
      
      if (fileUrl) {
        // Use sendChatMessage from useRealtime hook which handles sender_id correctly
        const message = await sendChatMessage(
          selectedChat,
          `🎤 Voice message (${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')})`,
          'file',
          fileUrl,
          `voice-${Date.now()}.wav`,
          audioBlob.size
        );
        
        if (message) {
          // Don't add message here - let real-time subscription handle it to avoid duplicates
          // The real-time subscription will receive the message and add it
          deleteRecording();
          
          // Scroll to bottom after a short delay to allow real-time message to arrive
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }
      }
    } catch (error) {
      console.error('Error sending voice message:', error);
      alert('Failed to send voice message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      // Cleanup audio elements
      audioElementsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      audioElementsRef.current.clear();
    };
  }, [audioUrl]);

  const startNewChat = async (contactId: string) => {
    if (!user) {
      return;
    }
    
    try {
      if (isPatient) {
        const existingChat = chats.find(chat => chat.doctor_id === contactId && chat.is_active);
        if (existingChat) {
          setSelectedChat(existingChat.id);
          return;
        }

        const { data: patientData, error: patientError } = await chatService.supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (patientError) {
          console.error('❌ Error fetching patient ID:', patientError);
          alert('Error fetching patient profile. Please try again.');
          return;
        }

        if (!patientData) {
          console.error('❌ Patient profile not found for user:', user.id);
          alert('Patient profile not found. Please complete your profile first.');
          return;
        }

        const patientId = patientData.id;
        const newChat = await createChat(patientId, contactId);
        if (newChat) {
          setSelectedChat(newChat.id);
        } else {
          console.error('Failed to create chat with doctor:', contactId);
          alert('Failed to create chat. Please try again.');
        }
      } else {
        const existingChat = chats.find(chat => chat.patient_id === contactId && chat.is_active);
        if (existingChat) {
          setSelectedChat(existingChat.id);
          return;
        }

        const { data: doctorData, error: doctorError } = await chatService.supabase
          .from('doctors')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (doctorError) {
          console.error('❌ Error fetching doctor ID:', doctorError);
          alert('Error fetching doctor profile. Please try again.');
          return;
        }

        if (!doctorData) {
          console.error('❌ Doctor profile not found for user:', user.id);
          alert('Doctor profile not found. Please complete your profile first.');
          return;
        }

        const doctorId = doctorData.id;
        const patientId = contactId;
        const newChat = await createChat(patientId, doctorId);
        if (newChat) {
          setSelectedChat(newChat.id);
        } else {
          console.error('Failed to create chat with patient:', contactId);
          alert('Failed to create chat. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error starting new chat:', error);
      alert('Error starting chat. Please try again.');
    }
  };

  return (
    <div 
      className="flex min-h-0 overflow-hidden"
      style={{ 
        position: 'relative', 
        isolation: 'isolate',
        height: 'calc(100vh - 220px)',
        maxHeight: 'calc(100vh - 220px)'
      }}
    >
      {/* Doctors List Sidebar */}
      <div 
        className="w-1/3 h-full bg-gray-800/50 backdrop-blur-sm border-r border-gray-700/50 flex flex-col min-h-0 overflow-hidden" 
        style={{ 
          position: 'relative',
          touchAction: 'pan-y',
          isolation: 'isolate'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                {isPatient ? 'Chat with Brain Specialists' : 'Chat with Patients'}
              </span>
            </h2>
            <button 
              onClick={() => fetchContacts()}
              className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
              title={isPatient ? 'Refresh Brain Specialists' : 'Refresh Patients'}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder={isPatient ? 'Search brain specialists...' : 'Search patients...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
            />
          </div>
        </div>

        {/* Active Chats - Scrollable */}
        <div 
          ref={sidebarScrollRef}
          className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-hide" 
          style={{ 
            overscrollBehavior: 'contain',
            overscrollBehaviorY: 'contain',
            overscrollBehaviorX: 'none',
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
            isolation: 'isolate',
            touchAction: 'pan-y'
          }}
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              Active Conversations {allChats.length > 0 && `(${allChats.length})`}
            </h3>
            {allChats.map((chat) => {
              const contactId = isPatient ? chat.doctor_id : chat.patient_id;
              const contact = contacts.find(c => c.id === contactId);
              if (!contact) return null;
              
              return (
              <motion.div
                key={chat.id}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedChat(chat.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all duration-200 mb-2 group ${
                  selectedChat === chat.id 
                    ? 'bg-cyan-500/20 border border-cyan-400/30' 
                    : 'bg-gray-700/30 hover:bg-gray-700/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                        src={contact.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                        alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(contact.status)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white truncate">{contact.name}</h4>
                        {contact.is_verified && contact.type === 'doctor' && (
                        <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                      <p className="text-sm text-gray-400 truncate">{contact.subtitle}</p>
                      {chat.last_message && (
                        <p className="text-xs text-gray-500 truncate mt-1">
                          {chat.last_message.message_type === 'file' 
                            ? (chat.last_message.file_name?.startsWith('voice-') ? '🎤 Voice message' : `📎 ${chat.last_message.file_name || 'File'}`)
                            : chat.last_message.message}
                        </p>
                      )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {chat.unread_count > 0 && (
                      <div className="bg-cyan-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                        {chat.unread_count}
                      </div>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete this chat with ${contact.name}? This action cannot be undone.`)) {
                          try {
                            console.log(`${isPatient ? 'Patient' : 'Doctor'} deleting chat from sidebar:`, chat.id);
                            const success = await chatService.deleteChat(chat.id);
                            if (success) {
                              console.log('✅ Chat deleted successfully');
                              if (selectedChat === chat.id) {
                                setSelectedChat(null);
                                setMessages([]);
                              }
                              // Refresh contacts to update the chat list
                              await fetchContacts();
                            } else {
                              console.error('❌ Failed to delete chat');
                              alert('Failed to delete chat. Please try again.');
                            }
                          } catch (error) {
                            console.error('Error deleting chat:', error);
                            alert('An error occurred while deleting the chat. Please try again.');
                          }
                        }
                      }}
                      className="p-2 text-red-400 bg-red-400/10 hover:text-red-300 hover:bg-red-400/20 border border-red-400/30 hover:border-red-400/50 rounded-lg transition-all duration-200 flex items-center justify-center min-w-[32px] min-h-[32px]"
                      title="Delete chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>

          {/* Available Contacts */}
          <div className="p-4 border-t border-gray-700/50">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              {isPatient ? 'Available Brain Specialists' : 'Available Patients'}
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="ml-2 text-gray-400">
                  {isPatient ? 'Loading brain specialists...' : 'Loading patients...'}
                </span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-sm">
                  {searchTerm ? (
                    <p>
                      No {isPatient ? 'doctors' : 'patients'} found matching "{searchTerm}"
                    </p>
                  ) : (
                    <p className="mb-2">
                      No {isPatient ? 'brain specialists' : 'patients'} available at the moment.
                    </p>
                  )}
                </div>
              </div>
            ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <motion.div
                  key={contact.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => startNewChat(contact.id)}
                  className="p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={contact.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                        alt={contact.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(contact.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-white text-sm truncate">{contact.name}</h4>
                        {contact.is_verified && contact.type === 'doctor' && (
                          <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{contact.subtitle}</p>
                      {contact.type === 'doctor' ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-400">{contact.rating}</span>
                          </div>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-400">{contact.response_time}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 mt-1">
                          Last active: {contact.last_seen}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 h-full flex flex-col min-h-0 overflow-hidden" 
        style={{ 
          position: 'relative',
          touchAction: 'pan-y',
          isolation: 'isolate'
        }}
      >
        {selectedChat && currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-gray-700/50 bg-gray-800/30 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={currentContact?.avatar_url || 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=150&h=150&fit=crop&crop=face'}
                      alt={currentContact?.name || (isPatient ? 'Doctor' : 'Patient')}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-800 ${getStatusColor(currentContact?.status || 'offline')}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-white">
                        {currentContact?.name || (isPatient ? currentChat?.doctor_name : currentChat?.patient_name) || (isPatient ? 'Doctor' : 'Patient')}
                      </h3>
                      {currentContact?.is_verified && currentContact?.type === 'doctor' && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {currentContact?.subtitle || (currentContact?.type === 'doctor' ? 'Specialist' : 'Patient')} • {currentContact?.status || 'offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const menu = document.getElementById(`chat-menu-${selectedChat}`);
                        if (menu) {
                          menu.classList.toggle('hidden');
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    <div 
                      id={`chat-menu-${selectedChat}`}
                      className="hidden absolute right-0 top-full mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50"
                    >
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (selectedChat) {
                            const confirmMessage = isPatient 
                              ? 'Are you sure you want to delete this chat? This action cannot be undone.'
                              : 'Are you sure you want to delete this chat? This action cannot be undone.';
                            
                            if (window.confirm(confirmMessage)) {
                              try {
                                console.log(`${isPatient ? 'Patient' : 'Doctor'} deleting chat:`, selectedChat);
                                const success = await chatService.deleteChat(selectedChat);
                                if (success) {
                                  console.log('✅ Chat deleted successfully');
                                  setSelectedChat(null);
                                  setMessages([]);
                                  // Refresh contacts to update the chat list
                                  await fetchContacts();
                                  // The realtime hook should automatically update the chats list
                                } else {
                                  console.error('❌ Failed to delete chat');
                                  alert('Failed to delete chat. Please try again.');
                                }
                              } catch (error) {
                                console.error('Error deleting chat:', error);
                                alert('An error occurred while deleting the chat. Please try again.');
                              }
                            }
                          }
                          const menu = document.getElementById(`chat-menu-${selectedChat}`);
                          if (menu) {
                            menu.classList.add('hidden');
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Chat</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={messagesScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4 min-h-0 scrollbar-hide" 
              style={{ 
                overscrollBehavior: 'contain',
                overscrollBehaviorY: 'contain',
                overscrollBehaviorX: 'none',
                WebkitOverflowScrolling: 'touch',
                position: 'relative',
                isolation: 'isolate',
                touchAction: 'pan-y'
              }}
              onWheel={(e) => e.stopPropagation()}
              onScroll={(e) => e.stopPropagation()}
            >
              {currentMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessageCircle className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-400 mb-2">Start a Conversation</h3>
                    <p className="text-gray-500">
                      Send a message to begin chatting with {currentContact?.name || (isPatient ? 'the doctor' : 'the patient')}
                    </p>
                  </div>
                </div>
              ) : (
                currentMessages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                    className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'} group`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.sender_id === currentUserId
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : 'bg-gray-700 text-white'
                  }`}>
                      {message.message_type === 'file' ? (
                        <div className="space-y-2">
                          {message.file_name?.startsWith('voice-') || message.message?.includes('Voice message') ? (
                            // Voice message display
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Mic className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-medium">Voice Message</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleVoicePlay(message)}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors disabled:opacity-50"
                                  disabled={!message.file_url}
                                >
                                  {playingAudioId === message.id ? (
                                    <>
                                      <Pause className="w-3 h-3" />
                                      <span>Pause</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3" />
                                      <span>Play</span>
                                    </>
                                  )}
                                </button>
                                <span className="text-xs opacity-80">
                                  {message.file_size && formatFileSize(message.file_size)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            // Regular file display
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Paperclip className="w-4 h-4" />
                                <span className="text-sm font-medium truncate">{message.file_name || 'File'}</span>
                              </div>
                              <div className="text-xs opacity-80">
                                {message.file_size && formatFileSize(message.file_size)}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleFileView(message)}
                                  className="inline-flex items-center gap-1 text-xs underline hover:no-underline px-2 py-1 bg-gray-600/50 hover:bg-gray-600 rounded transition-colors"
                                  disabled={!message.file_url}
                                >
                                  <span>View/Download</span>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm">{message.message}</p>
                      )}
                    <div className={`flex items-center gap-1 mt-1 ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-xs opacity-70">{new Date(message.created_at).toLocaleTimeString()}</span>
                        {message.sender_id === currentUserId && (
                        <div className="ml-1">
                            {message.read ? (
                            <CheckCheck className="w-3 h-3 opacity-70" />
                          ) : (
                            <Check className="w-3 h-3 opacity-70" />
                          )}
                        </div>
                      )}
                      {message.sender_id === currentUserId && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this message?')) {
                              const success = await chatService.deleteMessage(message.id);
                              if (success) {
                                setMessages(prev => prev.filter(msg => msg.id !== message.id));
                              } else {
                                alert('Failed to delete message. Please try again.');
                              }
                            }
                          }}
                          className="ml-2 p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-gray-700/50 bg-gray-800/30 flex-shrink-0">
              {/* Selected File Preview */}
              {selectedFile && (
                <div className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Paperclip className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{selectedFile.name}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFileUpload}
                        disabled={isUploading}
                        className="px-3 py-1 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
                      >
                        {isUploading ? 'Uploading...' : 'Send'}
                      </button>
                      <button
                        onClick={removeSelectedFile}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Recording Preview */}
              {audioBlob && (
                <div className="mb-4 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Mic className="w-5 h-5 text-red-400" />
                      <div>
                        <p className="text-sm font-medium text-white">Voice Recording</p>
                        <p className="text-xs text-gray-400">{formatDuration(recordingDuration)} • {formatFileSize(audioBlob.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={playRecording}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs transition-colors"
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                      <button
                        onClick={sendVoiceMessage}
                        disabled={isSending}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {isSending ? 'Sending...' : 'Send'}
                      </button>
                      <button
                        onClick={deleteRecording}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioUrl || ''}
                    onEnded={() => setIsPlaying(false)}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                  />
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                  title="Attach file (images, PDF, documents)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                
                {/* Voice Recording Button */}
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Record voice message"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors animate-pulse"
                    title="Stop recording"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                )}
                
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all duration-300"
                  />
                </div>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!newMessage.trim() ? "Type a message to send" : "Send message"}
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                  <Send className="w-5 h-5" />
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
            </div>
          </>
        ) : (
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-24 h-24 mx-auto text-gray-600 mb-6" />
              <h3 className="text-2xl font-semibold text-gray-400 mb-2">
                Select a {isPatient ? 'Brain Specialist' : 'Patient'} to Start Chatting
              </h3>
              <p className="text-gray-500">
                {isPatient
                  ? 'Choose from our verified Pakistani brain specialists'
                  : 'Choose from your patients to begin a conversation'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
