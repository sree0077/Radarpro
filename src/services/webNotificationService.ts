import { Platform } from 'react-native';
import { ReportCategory } from '../types';

/**
 * Web-specific notification service for browser compatibility
 */
export class WebNotificationService {
  private static isWeb = Platform.OS === 'web';
  private static permissionRequested = false;

  /**
   * Initialize web notifications
   */
  static async initialize(): Promise<void> {
    if (!this.isWeb) return;

    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.log('🌐 Browser notifications not supported');
        return;
      }

      // Request permission if not already granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        this.permissionRequested = true;
        console.log(`🔔 Notification permission: ${permission}`);
      }

      console.log('🌐 Web notification service initialized');
    } catch (error) {
      console.error('❌ Error initializing web notifications:', error);
    }
  }

  /**
   * Send web notification
   */
  static async sendNotification(
    category: ReportCategory,
    title: string,
    body: string,
    options?: NotificationOptions
  ): Promise<void> {
    if (!this.isWeb) return;

    try {
      if (!('Notification' in window)) {
        console.log('🌐 Browser notifications not supported');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.log('🔔 Notification permission not granted');
        return;
      }

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `radar-pro-${category}`,
        requireInteraction: false,
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log(`🔔 Web notification sent: ${title}`);
    } catch (error) {
      console.error('❌ Error sending web notification:', error);
    }
  }

  /**
   * Send test notification for specific category
   */
  static async sendTestNotification(category: ReportCategory): Promise<void> {
    const categoryEmojis: Record<ReportCategory, string> = {
      police_checkpoint: '🚔',
      accident: '🚗',
      road_hazard: '⚠️',
      traffic_jam: '🚦',
      weather_alert: '🌧️',
      general: '📍',
    };

    const title = `${categoryEmojis[category]} Test ${category.replace('_', ' ').toUpperCase()}`;
    const body = `Testing ${category} notification on web platform`;

    await this.sendNotification(category, title, body);
  }

  /**
   * Check if web notifications are supported and permitted
   */
  static isSupported(): boolean {
    return this.isWeb && 'Notification' in window;
  }

  /**
   * Check if permission is granted
   */
  static isPermissionGranted(): boolean {
    return this.isSupported() && Notification.permission === 'granted';
  }

  /**
   * Get permission status
   */
  static getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  static async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';

    try {
      const permission = await Notification.requestPermission();
      this.permissionRequested = true;
      return permission;
    } catch (error) {
      console.error('❌ Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Show web-specific notification status
   */
  static getWebNotificationInfo(): {
    supported: boolean;
    permission: NotificationPermission | 'unsupported';
    permissionRequested: boolean;
    isWeb: boolean;
  } {
    return {
      supported: this.isSupported(),
      permission: this.getPermissionStatus(),
      permissionRequested: this.permissionRequested,
      isWeb: this.isWeb,
    };
  }

  /**
   * Send comprehensive notification for web
   */
  static async sendComprehensiveWebNotification(
    category: ReportCategory,
    description: string,
    location?: string
  ): Promise<void> {
    const categoryEmojis: Record<ReportCategory, string> = {
      police_checkpoint: '🚔',
      accident: '🚗',
      road_hazard: '⚠️',
      traffic_jam: '🚦',
      weather_alert: '🌧️',
      general: '📍',
    };

    const title = `${categoryEmojis[category]} New ${category.replace('_', ' ').toUpperCase()}`;
    const body = location 
      ? `${description}\nLocation: ${location}`
      : description;

    await this.sendNotification(category, title, body, {
      requireInteraction: true, // Keep notification visible longer
      actions: [
        {
          action: 'view',
          title: 'View Details'
        }
      ]
    });
  }
}

// Web notification types extension
declare global {
  interface NotificationAction {
    action: string;
    title: string;
    icon?: string;
  }

  interface NotificationOptions {
    actions?: NotificationAction[];
    badge?: string;
    data?: any;
    dir?: 'auto' | 'ltr' | 'rtl';
    icon?: string;
    image?: string;
    lang?: string;
    renotify?: boolean;
    requireInteraction?: boolean;
    silent?: boolean;
    tag?: string;
    timestamp?: number;
    vibrate?: number | number[];
  }
}
