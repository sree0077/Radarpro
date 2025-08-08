import AsyncStorage from '@react-native-async-storage/async-storage';
// Simplified offline detection without NetInfo dependency
// For demo purposes, we'll assume online connectivity
// In production, you would use @react-native-community/netinfo
import { NotificationService } from './notificationService';
import { NotificationStorage } from './notificationStorage';
import { Report, StoredNotification, NotificationBatch } from '../types';

interface QueuedNotification {
  id: string;
  report: Report;
  type: 'new' | 'update';
  timestamp: string;
  retryCount: number;
  maxRetries: number;
}

interface OfflineNotificationState {
  isOnline: boolean;
  queuedNotifications: QueuedNotification[];
  lastSyncTimestamp: string;
  failedNotifications: QueuedNotification[];
}

export class OfflineNotificationService {
  private static readonly STORAGE_KEY = 'offline_notification_queue';
  private static readonly FAILED_STORAGE_KEY = 'failed_notifications';
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 5000; // 5 seconds
  private static readonly MAX_QUEUE_SIZE = 100;
  
  private static isOnline: boolean = true;
  private static processingQueue: boolean = false;
  private static retryTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize offline notification service
   */
  static async initialize(): Promise<void> {
    try {
      // For demo purposes, assume online connectivity
      // In production, you would use @react-native-community/netinfo for proper network detection
      this.isOnline = true;

      // Process any existing queued notifications
      await this.processQueuedNotifications();

      console.log('🔄 Offline notification service initialized (demo mode - always online)');
    } catch (error) {
      console.error('❌ Error initializing offline notification service:', error);
      // Fallback to online mode if initialization fails
      this.isOnline = true;
    }
  }

  /**
   * Send notification with offline support
   */
  static async sendNotificationWithOfflineSupport(
    report: Report,
    type: 'new' | 'update'
  ): Promise<void> {
    try {
      if (this.isOnline) {
        // Try to send immediately
        await NotificationService.sendComprehensiveNotification(report, type);
        console.log(`✅ Notification sent successfully for ${type} report`);
      } else {
        // Queue for later
        await this.queueNotification(report, type);
        console.log(`📥 Notification queued for offline processing`);
      }
    } catch (error) {
      console.error(`❌ Error sending notification:`, error);
      
      // If online but failed, queue for retry
      if (this.isOnline) {
        await this.queueNotification(report, type);
      }
      
      // Store locally regardless
      await this.storeNotificationLocally(report, type);
    }
  }

  /**
   * Queue notification for later processing
   */
  private static async queueNotification(
    report: Report,
    type: 'new' | 'update'
  ): Promise<void> {
    try {
      const queue = await this.getQueuedNotifications();
      
      // Check queue size limit
      if (queue.length >= this.MAX_QUEUE_SIZE) {
        console.warn('⚠️ Notification queue full, removing oldest items');
        queue.splice(0, queue.length - this.MAX_QUEUE_SIZE + 1);
      }
      
      const queuedNotification: QueuedNotification = {
        id: `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        report,
        type,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        maxRetries: this.MAX_RETRIES,
      };
      
      queue.push(queuedNotification);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
      
      console.log(`📥 Queued notification: ${queuedNotification.id}`);
    } catch (error) {
      console.error('❌ Error queueing notification:', error);
    }
  }

  /**
   * Process all queued notifications
   */
  static async processQueuedNotifications(): Promise<void> {
    if (this.processingQueue || !this.isOnline) {
      return;
    }
    
    try {
      this.processingQueue = true;
      const queue = await this.getQueuedNotifications();
      
      if (queue.length === 0) {
        console.log('📭 No queued notifications to process');
        return;
      }
      
      console.log(`🔄 Processing ${queue.length} queued notifications`);
      
      const processedIds: string[] = [];
      const failedNotifications: QueuedNotification[] = [];
      
      for (const queuedNotification of queue) {
        try {
          await NotificationService.sendComprehensiveNotification(
            queuedNotification.report,
            queuedNotification.type
          );
          
          processedIds.push(queuedNotification.id);
          console.log(`✅ Processed queued notification: ${queuedNotification.id}`);
        } catch (error) {
          console.error(`❌ Failed to process notification ${queuedNotification.id}:`, error);
          
          queuedNotification.retryCount++;
          
          if (queuedNotification.retryCount >= queuedNotification.maxRetries) {
            failedNotifications.push(queuedNotification);
            processedIds.push(queuedNotification.id);
            console.log(`💀 Notification ${queuedNotification.id} exceeded max retries`);
          } else {
            // Schedule retry
            this.scheduleRetry(queuedNotification);
          }
        }
      }
      
      // Remove processed notifications from queue
      if (processedIds.length > 0) {
        const remainingQueue = queue.filter(n => !processedIds.includes(n.id));
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(remainingQueue));
      }
      
      // Store failed notifications
      if (failedNotifications.length > 0) {
        await this.storeFailedNotifications(failedNotifications);
      }
      
      console.log(`✅ Processed ${processedIds.length} notifications, ${failedNotifications.length} failed`);
    } catch (error) {
      console.error('❌ Error processing queued notifications:', error);
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Schedule retry for failed notification
   */
  private static scheduleRetry(queuedNotification: QueuedNotification): void {
    const delay = this.RETRY_DELAY * Math.pow(2, queuedNotification.retryCount); // Exponential backoff
    
    const timeoutId = setTimeout(async () => {
      try {
        await NotificationService.sendComprehensiveNotification(
          queuedNotification.report,
          queuedNotification.type
        );
        
        // Remove from queue on success
        const queue = await this.getQueuedNotifications();
        const updatedQueue = queue.filter(n => n.id !== queuedNotification.id);
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedQueue));
        
        console.log(`✅ Retry successful for notification: ${queuedNotification.id}`);
      } catch (error) {
        console.error(`❌ Retry failed for notification ${queuedNotification.id}:`, error);
        queuedNotification.retryCount++;
        
        if (queuedNotification.retryCount < queuedNotification.maxRetries) {
          this.scheduleRetry(queuedNotification);
        } else {
          await this.storeFailedNotifications([queuedNotification]);
        }
      }
      
      this.retryTimeouts.delete(queuedNotification.id);
    }, delay);
    
    this.retryTimeouts.set(queuedNotification.id, timeoutId);
    console.log(`⏰ Scheduled retry for ${queuedNotification.id} in ${delay}ms`);
  }

  /**
   * Store notification locally for offline access
   */
  private static async storeNotificationLocally(
    report: Report,
    type: 'new' | 'update'
  ): Promise<void> {
    try {
      const notification: StoredNotification = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: this.getNotificationTitle(report, type),
        body: this.getNotificationBody(report, type),
        category: report.category,
        priority: this.getNotificationPriority(report),
        status: 'unread',
        report_id: report.id,
        user_id: report.user_id,
        username: report.user?.username,
        location: report.location,
        created_at: new Date().toISOString(),
        is_offline: true,
      };
      
      await NotificationStorage.storeNotification(notification);
      console.log(`💾 Stored notification locally: ${notification.id}`);
    } catch (error) {
      console.error('❌ Error storing notification locally:', error);
    }
  }

  /**
   * Get queued notifications
   */
  private static async getQueuedNotifications(): Promise<QueuedNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error getting queued notifications:', error);
      return [];
    }
  }

  /**
   * Store failed notifications
   */
  private static async storeFailedNotifications(
    failedNotifications: QueuedNotification[]
  ): Promise<void> {
    try {
      const existing = await this.getFailedNotifications();
      const combined = [...existing, ...failedNotifications];
      
      await AsyncStorage.setItem(this.FAILED_STORAGE_KEY, JSON.stringify(combined));
      console.log(`💀 Stored ${failedNotifications.length} failed notifications`);
    } catch (error) {
      console.error('❌ Error storing failed notifications:', error);
    }
  }

  /**
   * Get failed notifications
   */
  static async getFailedNotifications(): Promise<QueuedNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(this.FAILED_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error getting failed notifications:', error);
      return [];
    }
  }

  /**
   * Retry failed notifications
   */
  static async retryFailedNotifications(): Promise<void> {
    if (!this.isOnline) {
      console.log('📵 Cannot retry failed notifications while offline');
      return;
    }
    
    try {
      const failedNotifications = await this.getFailedNotifications();
      
      if (failedNotifications.length === 0) {
        console.log('📭 No failed notifications to retry');
        return;
      }
      
      console.log(`🔄 Retrying ${failedNotifications.length} failed notifications`);
      
      // Reset retry count and add back to queue
      const retriedNotifications = failedNotifications.map(notification => ({
        ...notification,
        retryCount: 0,
        timestamp: new Date().toISOString(),
      }));
      
      const queue = await this.getQueuedNotifications();
      const updatedQueue = [...queue, ...retriedNotifications];
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedQueue));
      await AsyncStorage.removeItem(this.FAILED_STORAGE_KEY);
      
      // Process the queue
      await this.processQueuedNotifications();
      
      console.log(`✅ Retried ${failedNotifications.length} failed notifications`);
    } catch (error) {
      console.error('❌ Error retrying failed notifications:', error);
    }
  }

  /**
   * Clear all queued and failed notifications
   */
  static async clearAllQueues(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      await AsyncStorage.removeItem(this.FAILED_STORAGE_KEY);
      
      // Clear retry timeouts
      for (const timeoutId of this.retryTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      this.retryTimeouts.clear();
      
      console.log('🗑️ Cleared all notification queues');
    } catch (error) {
      console.error('❌ Error clearing notification queues:', error);
    }
  }

  /**
   * Get offline notification statistics
   */
  static async getOfflineStats(): Promise<{
    queuedCount: number;
    failedCount: number;
    isOnline: boolean;
    lastSyncTimestamp: string | null;
  }> {
    try {
      const queued = await this.getQueuedNotifications();
      const failed = await this.getFailedNotifications();
      
      return {
        queuedCount: queued.length,
        failedCount: failed.length,
        isOnline: this.isOnline,
        lastSyncTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error getting offline stats:', error);
      return {
        queuedCount: 0,
        failedCount: 0,
        isOnline: this.isOnline,
        lastSyncTimestamp: null,
      };
    }
  }

  // Helper methods for notification content
  private static getNotificationTitle(report: Report, type: 'new' | 'update'): string {
    const action = type === 'new' ? 'New' : 'Updated';
    return `${action} ${report.category.replace('_', ' ')} report`;
  }

  private static getNotificationBody(report: Report, type: 'new' | 'update'): string {
    const action = type === 'new' ? 'reported' : 'updated';
    return `${report.category.replace('_', ' ')} ${action} by ${report.user?.username || 'Anonymous'}`;
  }

  private static getNotificationPriority(report: Report): 'low' | 'normal' | 'high' | 'urgent' {
    // Determine priority based on report category
    switch (report.category) {
      case 'accident':
        return 'urgent';
      case 'police_checkpoint':
      case 'road_hazard':
        return 'high';
      case 'traffic_jam':
      case 'weather_alert':
        return 'normal';
      default:
        return 'low';
    }
  }
}
