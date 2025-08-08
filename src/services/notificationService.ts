import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ReportCategory,
  ComprehensiveNotificationPreferences,
  NotificationSettings,
  StoredNotification,
  NotificationPriority,
  GlobalNotificationSettings,
  Report
} from '../types';
import { NotificationStorage } from './notificationStorage';
import { WebNotificationService } from './webNotificationService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  private static readonly STORAGE_KEYS = {
    NOTIFICATION_PREFERENCES: 'comprehensive_notification_preferences',
    NOTIFICATION_TOKEN: 'notification_token',
    LAST_NOTIFICATION_CHECK: 'last_notification_check',
  };

  private static readonly DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    sound_enabled: true,
    vibration_enabled: true,
    frequency: 'immediate',
    display_duration: 5,
    show_in_app: true,
    show_system: true,
    priority: 'normal',
  };

  private static readonly DEFAULT_GLOBAL_SETTINGS: GlobalNotificationSettings = {
    master_enabled: true,
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '07:00',
      days: [0, 1, 2, 3, 4, 5, 6], // All days
    },
    location_based: true,
    notification_radius: 5000,
    batch_notifications: false,
    auto_cleanup_days: 30,
  };

  private static notificationQueue: Map<string, NodeJS.Timeout> = new Map();
  private static lastNotificationTimes: Map<ReportCategory, number> = new Map();

  /**
   * Initialize the notification service
   */
  static async initialize(): Promise<void> {
    try {
      console.log('🔔 Initializing NotificationService...');

      // Initialize web notifications if on web platform
      if (Platform.OS === 'web') {
        await WebNotificationService.initialize();
        console.log('🌐 Web notification service initialized');
        return;
      }

      // Register for push notifications (native platforms only)
      await this.registerForPushNotificationsAsync();

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });

      console.log('✅ NotificationService initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing NotificationService:', error);
      // Don't throw error to prevent app crash
    }
  }

  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        alert('Failed to get push token for push notification!');
        return;
      }
      
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID!, // Expo project ID from environment
      })).data;
    } else {
      alert('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async scheduleLocalNotification(
    title: string,
    body: string,
    category: ReportCategory,
    data?: any
  ) {
    const soundFile = this.getSoundForCategory(category);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: soundFile,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });
  }

  /**
   * Enhanced notification method with comprehensive settings support
   */
  static async sendComprehensiveNotification(
    report: Report,
    notificationType: 'new' | 'update' | 'delete' = 'new'
  ): Promise<void> {
    try {
      // Get user notification preferences
      const preferences = await this.getNotificationPreferences();

      // Map report category to preference key
      const preferenceKey = this.mapCategoryToPreferenceKey(report.category);
      const categorySettings = preferences[preferenceKey];
      const globalSettings = preferences.global_settings;

      // Check if category settings exist
      if (!categorySettings) {
        console.warn(`⚠️ No settings found for category: ${report.category}, using defaults`);
        return;
      }

      // Check if notifications are enabled globally and for this category
      if (!globalSettings.master_enabled || !categorySettings.enabled) {
        console.log(`🔕 Notifications disabled for category: ${report.category}`);
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(globalSettings.quiet_hours)) {
        console.log('🔕 In quiet hours, skipping notification');
        return;
      }

      // Check frequency limits
      if (!this.shouldSendNotification(report.category, categorySettings.frequency)) {
        console.log(`⏰ Frequency limit reached for category: ${report.category}`);
        return;
      }

      // Create notification content
      const notificationContent = this.createNotificationContent(report, notificationType);

      // Store notification locally
      const storedNotification = await NotificationStorage.storeNotification({
        title: notificationContent.title,
        body: notificationContent.body,
        category: report.category,
        report_id: report.id,
        user_id: report.user_id,
        username: report.user?.username,
        priority: categorySettings.priority,
        status: 'unread',
        location: {
          latitude: report.latitude,
          longitude: report.longitude,
        },
        metadata: {
          sound_played: false,
          vibration_played: false,
          display_duration: categorySettings.display_duration,
          retry_count: 0,
          delivery_method: this.getDeliveryMethod(categorySettings),
        },
      });

      // Send system notification if enabled
      if (categorySettings.show_system) {
        await this.sendSystemNotification(notificationContent, categorySettings, storedNotification.id);
      }

      // Update last notification time for frequency control
      this.lastNotificationTimes.set(report.category, Date.now());

      console.log(`📱 Sent comprehensive notification for ${report.category} report`);
    } catch (error) {
      console.error('❌ Error sending comprehensive notification:', error);
    }
  }

  /**
   * Create notification content based on report and type
   */
  private static createNotificationContent(
    report: Report,
    type: 'new' | 'update' | 'delete'
  ): { title: string; body: string; data: any } {
    const username = report.user?.username || 'Anonymous';
    const categoryEmoji = this.getCategoryEmoji(report.category);

    let title: string;
    let body: string;

    switch (type) {
      case 'new':
        title = `${categoryEmoji} New ${this.getCategoryDisplayName(report.category)}`;
        body = `${username} reported: ${report.description}`;
        break;
      case 'update':
        title = `${categoryEmoji} Updated ${this.getCategoryDisplayName(report.category)}`;
        body = `${username} updated: ${report.description}`;
        break;
      case 'delete':
        title = `${categoryEmoji} Removed ${this.getCategoryDisplayName(report.category)}`;
        body = `Report by ${username} was removed`;
        break;
    }

    return {
      title,
      body,
      data: {
        reportId: report.id,
        category: report.category,
        type,
        latitude: report.latitude,
        longitude: report.longitude,
      },
    };
  }

  /**
   * Send system notification with custom settings
   */
  private static async sendSystemNotification(
    content: { title: string; body: string; data: any },
    settings: NotificationSettings,
    notificationId: string
  ): Promise<void> {
    try {
      const soundFile = settings.custom_sound || this.getSoundForCategory(content.data.category);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: content.title,
          body: content.body,
          data: { ...content.data, notificationId },
          sound: settings.sound_enabled ? soundFile : undefined,
          priority: this.getSystemPriority(settings.priority),
          vibrate: settings.vibration_enabled ? [0, 250, 250, 250] : undefined,
        },
        trigger: null,
      });

      // Update metadata to indicate sound was played
      await this.updateNotificationMetadata(notificationId, {
        sound_played: settings.sound_enabled,
        vibration_played: settings.vibration_enabled,
      });
    } catch (error) {
      console.error('❌ Error sending system notification:', error);
    }
  }

  static getSoundForCategory(category: ReportCategory): string {
    switch (category) {
      case 'police_checkpoint':
        return 'siren.wav';
      case 'accident':
        return 'crash.wav';
      case 'road_hazard':
        return 'warning.wav';
      case 'traffic_jam':
        return 'traffic.wav';
      case 'weather_alert':
        return 'weather.wav';
      case 'general':
      default:
        return 'default.wav';
    }
  }

  /**
   * Get category display name
   */
  private static getCategoryDisplayName(category: ReportCategory): string {
    switch (category) {
      case 'police_checkpoint':
        return 'Police Checkpoint';
      case 'accident':
        return 'Accident';
      case 'road_hazard':
        return 'Road Hazard';
      case 'traffic_jam':
        return 'Traffic Jam';
      case 'weather_alert':
        return 'Weather Alert';
      case 'general':
        return 'General Alert';
      default:
        return 'Alert';
    }
  }

  /**
   * Get category emoji
   */
  private static getCategoryEmoji(category: ReportCategory): string {
    switch (category) {
      case 'police_checkpoint':
        return '🚔';
      case 'accident':
        return '🚨';
      case 'road_hazard':
        return '⚠️';
      case 'traffic_jam':
        return '🚗';
      case 'weather_alert':
        return '🌧️';
      case 'general':
        return '📍';
      default:
        return '🔔';
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  private static isInQuietHours(quietHours: GlobalNotificationSettings['quiet_hours']): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Check if current day is in quiet hours days
    if (!quietHours.days.includes(currentDay)) return false;

    const [startHour, startMin] = quietHours.start_time.split(':').map(Number);
    const [endHour, endMin] = quietHours.end_time.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Check if notification should be sent based on frequency settings
   */
  private static shouldSendNotification(category: ReportCategory, frequency: NotificationSettings['frequency']): boolean {
    if (frequency === 'immediate') return true;

    const lastTime = this.lastNotificationTimes.get(category) || 0;
    const now = Date.now();
    const timeDiff = now - lastTime;

    switch (frequency) {
      case 'every_5min':
        return timeDiff >= 5 * 60 * 1000;
      case 'every_15min':
        return timeDiff >= 15 * 60 * 1000;
      case 'hourly':
        return timeDiff >= 60 * 60 * 1000;
      case 'daily':
        return timeDiff >= 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  }

  /**
   * Get delivery method based on settings
   */
  private static getDeliveryMethod(settings: NotificationSettings): 'in_app' | 'system' | 'both' {
    if (settings.show_in_app && settings.show_system) return 'both';
    if (settings.show_system) return 'system';
    return 'in_app';
  }

  /**
   * Convert priority to system priority
   */
  private static getSystemPriority(priority: NotificationPriority): Notifications.AndroidNotificationPriority {
    switch (priority) {
      case 'low':
        return Notifications.AndroidNotificationPriority.LOW;
      case 'normal':
        return Notifications.AndroidNotificationPriority.DEFAULT;
      case 'high':
        return Notifications.AndroidNotificationPriority.HIGH;
      case 'urgent':
        return Notifications.AndroidNotificationPriority.MAX;
      default:
        return Notifications.AndroidNotificationPriority.DEFAULT;
    }
  }

  /**
   * Update notification metadata
   */
  private static async updateNotificationMetadata(
    notificationId: string,
    metadata: Partial<StoredNotification['metadata']>
  ): Promise<void> {
    try {
      // This would update the stored notification metadata
      // Implementation depends on how NotificationStorage handles updates
      console.log(`📱 Updated metadata for notification ${notificationId}:`, metadata);
    } catch (error) {
      console.error('❌ Error updating notification metadata:', error);
    }
  }

  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  static async getBadgeCountAsync() {
    return await Notifications.getBadgeCountAsync();
  }

  static async setBadgeCountAsync(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }

  static addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
    return Notifications.addNotificationReceivedListener(listener);
  }

  static addNotificationResponseReceivedListener(
    listener: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(listener);
  }

  static removeNotificationSubscription(subscription: Notifications.Subscription) {
    subscription.remove();
  }

  /**
   * Get comprehensive notification preferences
   */
  static async getNotificationPreferences(): Promise<ComprehensiveNotificationPreferences> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.NOTIFICATION_PREFERENCES);
      if (stored) {
        return JSON.parse(stored);
      }

      // Return default preferences
      return this.getDefaultNotificationPreferences();
    } catch (error) {
      console.error('❌ Error getting notification preferences:', error);
      return this.getDefaultNotificationPreferences();
    }
  }

  /**
   * Save comprehensive notification preferences
   */
  static async saveNotificationPreferences(preferences: ComprehensiveNotificationPreferences): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.NOTIFICATION_PREFERENCES,
        JSON.stringify(preferences)
      );
      console.log('💾 Saved notification preferences');
    } catch (error) {
      console.error('❌ Error saving notification preferences:', error);
      throw error;
    }
  }

  /**
   * Get default notification preferences
   */
  private static getDefaultNotificationPreferences(): ComprehensiveNotificationPreferences {
    return {
      police_checkpoints: { ...this.DEFAULT_SETTINGS },
      accidents: { ...this.DEFAULT_SETTINGS, priority: 'high' },
      road_hazards: { ...this.DEFAULT_SETTINGS },
      traffic_jams: { ...this.DEFAULT_SETTINGS, priority: 'low' },
      weather_alerts: { ...this.DEFAULT_SETTINGS, priority: 'high' },
      general_alerts: { ...this.DEFAULT_SETTINGS },
      global_settings: { ...this.DEFAULT_GLOBAL_SETTINGS },
    };
  }

  /**
   * Map report category to preference key
   */
  private static mapCategoryToPreferenceKey(category: ReportCategory): keyof ComprehensiveNotificationPreferences {
    const mapping: Record<ReportCategory, keyof ComprehensiveNotificationPreferences> = {
      police_checkpoint: 'police_checkpoints',
      accident: 'accidents',
      road_hazard: 'road_hazards',
      traffic_jam: 'traffic_jams',
      weather_alert: 'weather_alerts',
      general: 'general_alerts',
    };
    return mapping[category];
  }

  /**
   * Update notification preferences for a specific category
   */
  static async updateCategoryPreferences(
    category: ReportCategory,
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    try {
      const preferences = await this.getNotificationPreferences();
      const preferenceKey = this.mapCategoryToPreferenceKey(category);
      preferences[preferenceKey] = { ...preferences[preferenceKey], ...settings };
      await this.saveNotificationPreferences(preferences);
      console.log(`💾 Updated preferences for category: ${category}`);
    } catch (error) {
      console.error('❌ Error updating category preferences:', error);
      throw error;
    }
  }

  /**
   * Update global notification settings
   */
  static async updateGlobalSettings(settings: Partial<GlobalNotificationSettings>): Promise<void> {
    try {
      const preferences = await this.getNotificationPreferences();
      preferences.global_settings = { ...preferences.global_settings, ...settings };
      await this.saveNotificationPreferences(preferences);
      console.log('💾 Updated global notification settings');
    } catch (error) {
      console.error('❌ Error updating global settings:', error);
      throw error;
    }
  }

  /**
   * Reset preferences to default
   */
  static async resetPreferencesToDefault(): Promise<void> {
    try {
      const defaultPreferences = this.getDefaultNotificationPreferences();
      await this.saveNotificationPreferences(defaultPreferences);
      console.log('🔄 Reset notification preferences to default');
    } catch (error) {
      console.error('❌ Error resetting preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStatistics(): Promise<{
    total: number;
    unread: number;
    byCategory: Record<ReportCategory, number>;
    byPriority: Record<NotificationPriority, number>;
  }> {
    try {
      const history = await NotificationStorage.getNotificationHistory();
      const notifications = history.notifications;

      const byCategory: Record<ReportCategory, number> = {
        police_checkpoint: 0,
        accident: 0,
        road_hazard: 0,
        traffic_jam: 0,
        weather_alert: 0,
        general: 0,
      };

      const byPriority: Record<NotificationPriority, number> = {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0,
      };

      notifications.forEach(notification => {
        byCategory[notification.category]++;
        byPriority[notification.priority]++;
      });

      return {
        total: history.total_count,
        unread: history.unread_count,
        byCategory,
        byPriority,
      };
    } catch (error) {
      console.error('❌ Error getting notification statistics:', error);
      return {
        total: 0,
        unread: 0,
        byCategory: {
          police_checkpoint: 0,
          accident: 0,
          road_hazard: 0,
          traffic_jam: 0,
          weather_alert: 0,
          general: 0,
        },
        byPriority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0,
        },
      };
    }
  }

  /**
   * Test notification for a specific category
   */
  static async sendTestNotification(category: ReportCategory): Promise<void> {
    try {
      // Handle web platform differently
      if (Platform.OS === 'web') {
        await WebNotificationService.sendTestNotification(category);
        return;
      }

      const testReport: Report = {
        id: 'test_' + Date.now(),
        user_id: 'test_user',
        category,
        description: 'This is a test notification',
        latitude: 0,
        longitude: 0,
        report_timestamp: new Date().toISOString(),
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user: {
          id: 'test_user',
          email: 'test@example.com',
          username: 'Test User',
          notification_radius: 5000,
          notification_preferences: {
            police_checkpoints: true,
            accidents: true,
            road_hazards: true,
            traffic_jams: true,
            weather_alerts: true,
            general_alerts: true,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      await this.sendComprehensiveNotification(testReport, 'new');
      console.log(`🧪 Sent test notification for category: ${category}`);
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      throw error;
    }
  }
}