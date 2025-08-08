import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  StoredNotification, 
  NotificationHistory, 
  NotificationBatch, 
  ReportCategory, 
  NotificationStatus,
  NotificationPriority 
} from '../types';

export class NotificationStorage {
  private static readonly STORAGE_KEYS = {
    NOTIFICATIONS: 'notifications',
    NOTIFICATION_HISTORY: 'notification_history',
    NOTIFICATION_BATCHES: 'notification_batches',
    NOTIFICATION_SETTINGS: 'notification_settings',
    LAST_CLEANUP: 'last_notification_cleanup',
  };

  private static readonly FOLDER_STRUCTURE = {
    police_checkpoint: 'police',
    accident: 'accidents', 
    road_hazard: 'hazards',
    traffic_jam: 'traffic',
    weather_alert: 'weather',
    general: 'general',
  };

  /**
   * Store a new notification
   */
  static async storeNotification(notification: Omit<StoredNotification, 'id' | 'created_at'>): Promise<StoredNotification> {
    try {
      const storedNotification: StoredNotification = {
        ...notification,
        id: this.generateNotificationId(),
        created_at: new Date().toISOString(),
      };

      // Get existing notifications for this category
      const categoryNotifications = await this.getNotificationsByCategory(notification.category);
      
      // Add new notification to the beginning of the array
      const updatedNotifications = [storedNotification, ...categoryNotifications];
      
      // Store updated notifications for this category
      await this.storeNotificationsByCategory(notification.category, updatedNotifications);
      
      // Update global notification history
      await this.updateNotificationHistory(storedNotification);
      
      console.log(`📱 Stored notification for category: ${notification.category}`);
      return storedNotification;
    } catch (error) {
      console.error('❌ Error storing notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications by category
   */
  static async getNotificationsByCategory(category: ReportCategory): Promise<StoredNotification[]> {
    try {
      const key = this.getCategoryStorageKey(category);
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error(`❌ Error getting notifications for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Store notifications for a specific category
   */
  private static async storeNotificationsByCategory(
    category: ReportCategory, 
    notifications: StoredNotification[]
  ): Promise<void> {
    try {
      const key = this.getCategoryStorageKey(category);
      await AsyncStorage.setItem(key, JSON.stringify(notifications));
    } catch (error) {
      console.error(`❌ Error storing notifications for category ${category}:`, error);
      throw error;
    }
  }

  /**
   * Get all notifications across all categories
   */
  static async getAllNotifications(): Promise<StoredNotification[]> {
    try {
      const allNotifications: StoredNotification[] = [];
      
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const categoryNotifications = await this.getNotificationsByCategory(category);
        allNotifications.push(...categoryNotifications);
      }
      
      // Sort by created_at descending (newest first)
      return allNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('❌ Error getting all notifications:', error);
      return [];
    }
  }

  /**
   * Update notification status
   */
  static async updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus
  ): Promise<void> {
    try {
      // Find the notification across all categories
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const notifications = await this.getNotificationsByCategory(category);
        const notificationIndex = notifications.findIndex(n => n.id === notificationId);
        
        if (notificationIndex !== -1) {
          // Update the notification status
          notifications[notificationIndex].status = status;
          
          // Add timestamp for status change
          const now = new Date().toISOString();
          switch (status) {
            case 'read':
              notifications[notificationIndex].read_at = now;
              break;
            case 'dismissed':
              notifications[notificationIndex].dismissed_at = now;
              break;
            case 'archived':
              notifications[notificationIndex].archived_at = now;
              break;
          }
          
          // Store updated notifications
          await this.storeNotificationsByCategory(category, notifications);
          console.log(`📱 Updated notification ${notificationId} status to ${status}`);
          return;
        }
      }
      
      console.warn(`⚠️ Notification ${notificationId} not found for status update`);
    } catch (error) {
      console.error('❌ Error updating notification status:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      // Find and remove the notification across all categories
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const notifications = await this.getNotificationsByCategory(category);
        const filteredNotifications = notifications.filter(n => n.id !== notificationId);
        
        if (filteredNotifications.length !== notifications.length) {
          await this.storeNotificationsByCategory(category, filteredNotifications);
          console.log(`📱 Deleted notification ${notificationId} from category ${category}`);
          return;
        }
      }
      
      console.warn(`⚠️ Notification ${notificationId} not found for deletion`);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notification history summary
   */
  static async getNotificationHistory(): Promise<NotificationHistory> {
    try {
      const allNotifications = await this.getAllNotifications();
      const unreadCount = allNotifications.filter(n => n.status === 'unread').length;
      
      const stored = await AsyncStorage.getItem(this.STORAGE_KEYS.LAST_CLEANUP);
      const lastCleanup = stored || new Date().toISOString();
      
      return {
        notifications: allNotifications,
        total_count: allNotifications.length,
        unread_count: unreadCount,
        last_cleanup: lastCleanup,
      };
    } catch (error) {
      console.error('❌ Error getting notification history:', error);
      return {
        notifications: [],
        total_count: 0,
        unread_count: 0,
        last_cleanup: new Date().toISOString(),
      };
    }
  }

  /**
   * Clean up old notifications
   */
  static async cleanupOldNotifications(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      let totalDeleted = 0;
      
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const notifications = await this.getNotificationsByCategory(category);
        const filteredNotifications = notifications.filter(n => 
          new Date(n.created_at) > cutoffDate
        );
        
        const deletedCount = notifications.length - filteredNotifications.length;
        totalDeleted += deletedCount;
        
        if (deletedCount > 0) {
          await this.storeNotificationsByCategory(category, filteredNotifications);
        }
      }
      
      // Update last cleanup timestamp
      await AsyncStorage.setItem(this.STORAGE_KEYS.LAST_CLEANUP, new Date().toISOString());
      
      console.log(`🧹 Cleaned up ${totalDeleted} old notifications`);
      return totalDeleted;
    } catch (error) {
      console.error('❌ Error cleaning up notifications:', error);
      return 0;
    }
  }

  /**
   * Clear all notifications
   */
  static async clearAllNotifications(): Promise<void> {
    try {
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const key = this.getCategoryStorageKey(category);
        await AsyncStorage.removeItem(key);
      }
      
      await AsyncStorage.removeItem(this.STORAGE_KEYS.NOTIFICATION_HISTORY);
      await AsyncStorage.removeItem(this.STORAGE_KEYS.NOTIFICATION_BATCHES);
      
      console.log('🧹 Cleared all notifications');
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
      throw error;
    }
  }

  /**
   * Generate unique notification ID
   */
  private static generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get storage key for category
   */
  private static getCategoryStorageKey(category: ReportCategory): string {
    const folder = this.FOLDER_STRUCTURE[category];
    return `${this.STORAGE_KEYS.NOTIFICATIONS}_${folder}`;
  }

  /**
   * Update global notification history
   */
  private static async updateNotificationHistory(notification: StoredNotification): Promise<void> {
    try {
      // This could be used for analytics or summary data
      // For now, we'll just log it
      console.log(`📊 Updated notification history for category: ${notification.category}`);
    } catch (error) {
      console.error('❌ Error updating notification history:', error);
    }
  }

  /**
   * Get notifications by status
   */
  static async getNotificationsByStatus(status: NotificationStatus): Promise<StoredNotification[]> {
    try {
      const allNotifications = await this.getAllNotifications();
      return allNotifications.filter(n => n.status === status);
    } catch (error) {
      console.error(`❌ Error getting notifications by status ${status}:`, error);
      return [];
    }
  }

  /**
   * Get notifications by priority
   */
  static async getNotificationsByPriority(priority: NotificationPriority): Promise<StoredNotification[]> {
    try {
      const allNotifications = await this.getAllNotifications();
      return allNotifications.filter(n => n.priority === priority);
    } catch (error) {
      console.error(`❌ Error getting notifications by priority ${priority}:`, error);
      return [];
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<void> {
    try {
      for (const category of Object.keys(this.FOLDER_STRUCTURE) as ReportCategory[]) {
        const notifications = await this.getNotificationsByCategory(category);
        const updatedNotifications = notifications.map(n => ({
          ...n,
          status: 'read' as NotificationStatus,
          read_at: new Date().toISOString(),
        }));

        await this.storeNotificationsByCategory(category, updatedNotifications);
      }

      console.log('📱 Marked all notifications as read');
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  static async getNotificationStatistics(): Promise<{
    total_sent: number;
    this_week: number;
    unread_count: number;
    by_category: Record<ReportCategory, number>;
    by_priority: Record<NotificationPriority, number>;
  }> {
    try {
      const allNotifications = await this.getAllNotifications();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const thisWeekNotifications = allNotifications.filter(n =>
        new Date(n.created_at) >= weekAgo
      );

      const unreadCount = allNotifications.filter(n => n.status === 'unread').length;

      // Count by category
      const byCategory: Record<ReportCategory, number> = {
        police_checkpoint: 0,
        accident: 0,
        road_hazard: 0,
        traffic_jam: 0,
        weather_alert: 0,
        general: 0,
      };

      // Count by priority
      const byPriority: Record<NotificationPriority, number> = {
        low: 0,
        normal: 0,
        high: 0,
        urgent: 0,
      };

      allNotifications.forEach(notification => {
        byCategory[notification.category]++;
        byPriority[notification.priority]++;
      });

      return {
        total_sent: allNotifications.length,
        this_week: thisWeekNotifications.length,
        unread_count: unreadCount,
        by_category: byCategory,
        by_priority: byPriority,
      };
    } catch (error) {
      console.error('❌ Error getting notification statistics:', error);
      return {
        total_sent: 0,
        this_week: 0,
        unread_count: 0,
        by_category: {
          police_checkpoint: 0,
          accident: 0,
          road_hazard: 0,
          traffic_jam: 0,
          weather_alert: 0,
          general: 0,
        },
        by_priority: {
          low: 0,
          normal: 0,
          high: 0,
          urgent: 0,
        },
      };
    }
  }
}
