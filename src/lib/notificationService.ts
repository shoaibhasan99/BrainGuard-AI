// src/lib/notificationService.ts

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = Notification.permission;
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('Notification permission has been denied');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Check if notifications are supported and permitted
  isAvailable(): boolean {
    return this.isSupported && this.permission === 'granted';
  }

  // Show a notification
  async showNotification(options: NotificationOptions): Promise<Notification | null> {
    if (!this.isAvailable()) {
      console.warn('Notifications are not available');
      return null;
    }

    try {
      // Note: Actions are only supported with Service Worker notifications
      // For basic notifications, we'll omit actions and handle clicks instead
      const notificationOptions: NotificationInit = {
        body: options.body,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false
        // Note: actions are omitted - not supported in basic Notification constructor
        // Note: icon and badge are optional - only include if provided to avoid 404 errors
      };

      // Only add icon if provided and not pointing to non-existent favicon
      if (options.icon && !options.icon.includes('favicon.ico')) {
        notificationOptions.icon = options.icon;
      }

      // Only add badge if provided and not pointing to non-existent favicon
      if (options.badge && !options.badge.includes('favicon.ico')) {
        notificationOptions.badge = options.badge;
      }

      const notification = new Notification(options.title, notificationOptions);

      // Auto-close after 10 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 10000);
      }

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      return null;
    }
  }

  // Show medication reminder notification with voice alarm
  async showMedicationReminder(
    medicationName: string,
    dosage: string,
    time: string,
    onTaken?: () => void,
    onSnooze?: () => void,
    onSkip?: () => void
  ): Promise<Notification | null> {
    const options: NotificationOptions = {
      title: `💊 Medication Reminder`,
      body: `Time to take ${medicationName} (${dosage}) at ${time}. Click to mark as taken.`,
      requireInteraction: true
      // Note: actions are not supported in basic Notification constructor
    };

    const notification = await this.showNotification(options);
    
    // Play voice alarm
    this.playVoiceAlarm(medicationName, dosage);
    
    if (notification) {
      // Handle notification click - show a prompt for action selection
      notification.addEventListener('click', () => {
        // Focus the window if it's not already focused
        window.focus();
        
        // Show a simple prompt to select action
        const action = confirm(
          `Medication Reminder: ${medicationName} (${dosage})\n\n` +
          `Click OK to mark as taken, or Cancel to snooze for 10 minutes.`
        );
        
        if (action) {
          // User clicked OK - mark as taken
          if (onTaken) onTaken();
        } else {
          // User clicked Cancel - snooze
          if (onSnooze) onSnooze();
        }
        
        notification.close();
      });
    }

    return notification;
  }

  // Play voice alarm for medication reminder
  playVoiceAlarm(medicationName: string, dosage: string): void {
    // Allow voice even if notifications are denied; only require speech synthesis
    if (!("speechSynthesis" in window)) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const alarmMessage = `Medication reminder! Time to take ${medicationName}, ${dosage}. Please take your medication now.`;
    
    const utterance = new SpeechSynthesisUtterance(alarmMessage);
    utterance.rate = 0.8;
    utterance.pitch = 1.2;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Try to use a more alert-like voice
    const voices = window.speechSynthesis.getVoices();
    const alertVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.name.includes('Alex') ||
      voice.name.includes('Samantha')
    );
    
    if (alertVoice) {
      utterance.voice = alertVoice;
    }

    // Play the alarm
    window.speechSynthesis.speak(utterance);

    // Repeat the alarm after 30 seconds if not dismissed
    setTimeout(() => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    }, 30000);
  }

  // Play different alarm sounds based on urgency
  playUrgentAlarm(medicationName: string, dosage: string): void {
    if (!this.isAvailable()) return;

    window.speechSynthesis.cancel();

    const urgentMessage = `URGENT! Medication reminder! Time to take ${medicationName}, ${dosage}. This is your final reminder. Please take your medication immediately.`;
    
    const utterance = new SpeechSynthesisUtterance(urgentMessage);
    utterance.rate = 0.9;
    utterance.pitch = 1.5;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Use a more urgent voice
    const voices = window.speechSynthesis.getVoices();
    const urgentVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.name.includes('Alex')
    );
    
    if (urgentVoice) {
      utterance.voice = urgentVoice;
    }

    // Play multiple times for urgent reminders
    window.speechSynthesis.speak(utterance);
    
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 2000);
    
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 5000);
  }

  // Schedule a notification for a specific time
  scheduleNotification(
    time: Date,
    options: NotificationOptions,
    onTrigger?: () => void
  ): number {
    const now = new Date();
    const delay = time.getTime() - now.getTime();

    if (delay <= 0) {
      console.warn('Cannot schedule notification for past time');
      return -1;
    }

    const timeoutId = setTimeout(async () => {
      await this.showNotification(options);
      if (onTrigger) onTrigger();
    }, delay);

    return timeoutId;
  }

  // Schedule medication reminder
  scheduleMedicationReminder(
    medicationName: string,
    dosage: string,
    reminderTime: Date,
    onTaken?: () => void,
    onSnooze?: () => void,
    onSkip?: () => void
  ): number {
    // Don't pass options to scheduleNotification to avoid duplicate notifications
    // The notification will be shown in showMedicationReminder instead
    const now = new Date();
    const delay = reminderTime.getTime() - now.getTime();

    if (delay <= 0) {
      console.warn('Cannot schedule notification for past time');
      return -1;
    }

    const timeoutId = setTimeout(async () => {
      // Only show notification here, not in scheduleNotification
      await this.showMedicationReminder(medicationName, dosage, reminderTime.toLocaleTimeString(), onTaken, onSnooze, onSkip);
    }, delay);

    return timeoutId;
  }

  // Clear all scheduled notifications
  clearAllNotifications(): void {
    // Note: This only clears timeouts, not actual browser notifications
    // Browser notifications auto-close or need to be closed manually
  }

  // Test notification
  async testNotification(): Promise<boolean> {
    const success = await this.requestPermission();
    if (success) {
      await this.showNotification({
        title: '🧪 Test Notification',
        body: 'This is a test notification from BrainGuard',
        requireInteraction: false
      });
    }
    return success;
  }
}

export const notificationService = new NotificationService();