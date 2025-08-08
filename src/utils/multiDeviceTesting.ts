import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReportCategory, Report } from '../types';
import { SupabaseService } from '../services/supabase';
import { NotificationService } from '../services/notificationService';
import { SoundService } from '../services/soundService';

// Web compatibility check
const isWeb = Platform.OS === 'web';

export interface TestDevice {
  id: string;
  name: string;
  platform: string;
  isCurrentDevice: boolean;
  lastSeen: Date;
}

export interface NotificationTestResult {
  deviceId: string;
  reportId: string;
  category: ReportCategory;
  soundPlayed: boolean;
  notificationReceived: boolean;
  timestamp: Date;
  latency: number; // milliseconds
}

export class MultiDeviceTestingUtils {
  private static readonly DEVICE_REGISTRY_KEY = 'multi_device_test_registry';
  private static readonly TEST_RESULTS_KEY = 'notification_test_results';
  private static currentDeviceId: string | null = null;

  /**
   * Initialize device for multi-device testing
   */
  static async initializeTestDevice(deviceName?: string): Promise<TestDevice> {
    try {
      // Generate or retrieve device ID
      let deviceId = await AsyncStorage.getItem('test_device_id');
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('test_device_id', deviceId);
      }

      this.currentDeviceId = deviceId;

      const device: TestDevice = {
        id: deviceId,
        name: deviceName || `${Platform.OS}_${Platform.Version}_${deviceId.slice(-4)}`,
        platform: `${Platform.OS} ${Platform.Version}`,
        isCurrentDevice: true,
        lastSeen: new Date(),
      };

      // Register device in local storage
      await this.registerDevice(device);

      console.log(`🔧 Test device initialized: ${device.name} (${device.id})`);
      return device;
    } catch (error) {
      console.error('❌ Error initializing test device:', error);
      throw error;
    }
  }

  /**
   * Register device in the testing registry
   */
  private static async registerDevice(device: TestDevice): Promise<void> {
    try {
      const registryJson = await AsyncStorage.getItem(this.DEVICE_REGISTRY_KEY);
      const registry: TestDevice[] = registryJson ? JSON.parse(registryJson) : [];
      
      // Update existing device or add new one
      const existingIndex = registry.findIndex(d => d.id === device.id);
      if (existingIndex >= 0) {
        registry[existingIndex] = device;
      } else {
        registry.push(device);
      }

      await AsyncStorage.setItem(this.DEVICE_REGISTRY_KEY, JSON.stringify(registry));
    } catch (error) {
      console.error('❌ Error registering device:', error);
    }
  }

  /**
   * Get all registered test devices
   */
  static async getRegisteredDevices(): Promise<TestDevice[]> {
    try {
      const registryJson = await AsyncStorage.getItem(this.DEVICE_REGISTRY_KEY);
      return registryJson ? JSON.parse(registryJson) : [];
    } catch (error) {
      console.error('❌ Error getting registered devices:', error);
      return [];
    }
  }

  /**
   * Create a test report for notification testing
   */
  static async createTestReport(
    category: ReportCategory,
    description?: string
  ): Promise<Report | null> {
    try {
      const testDescription = description || `Test ${category} report from ${this.currentDeviceId}`;
      
      // Create test report with current location (or default location)
      const testReport = await SupabaseService.createReport({
        category,
        description: testDescription,
        latitude: 37.7749, // Default to San Francisco for testing
        longitude: -122.4194,
        address: 'Test Location for Multi-Device Testing',
        severity: 'medium',
        images: [],
        voice_note_url: null,
      });

      if (testReport) {
        console.log(`🧪 Created test ${category} report: ${testReport.id}`);
        
        // Record test creation
        await this.recordTestResult({
          deviceId: this.currentDeviceId || 'unknown',
          reportId: testReport.id,
          category,
          soundPlayed: false, // Will be updated when notification is received
          notificationReceived: false,
          timestamp: new Date(),
          latency: 0,
        });
      }

      return testReport;
    } catch (error) {
      console.error('❌ Error creating test report:', error);
      return null;
    }
  }

  /**
   * Test notification with specific sound
   */
  static async testNotificationWithSound(category: ReportCategory): Promise<void> {
    try {
      console.log(`🔊 Testing ${category} notification with custom sound...`);

      const startTime = Date.now();

      if (isWeb) {
        // Web-specific testing (limited functionality)
        console.log(`🌐 Web platform: Testing ${category} notification (limited functionality)`);

        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Test ${category} Report`, {
            body: `Testing ${category} notification on web platform`,
            icon: '/favicon.ico'
          });
        } else {
          console.log('🔔 Browser notifications not available or not permitted');
        }

        // Web doesn't support custom sounds, so we'll just log
        console.log(`🔊 Would play sound: ${category}.wav (not supported on web)`);
      } else {
        // Native platform testing
        await NotificationService.sendTestNotification(category);
        await SoundService.playNotificationSound(category);
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Record test result
      await this.recordTestResult({
        deviceId: this.currentDeviceId || 'unknown',
        reportId: `test_${Date.now()}`,
        category,
        soundPlayed: !isWeb, // Sound only works on native platforms
        notificationReceived: true,
        timestamp: new Date(),
        latency,
      });

      console.log(`✅ Test notification completed in ${latency}ms`);
    } catch (error) {
      console.error('❌ Error testing notification:', error);
    }
  }

  /**
   * Record test result
   */
  private static async recordTestResult(result: NotificationTestResult): Promise<void> {
    try {
      const resultsJson = await AsyncStorage.getItem(this.TEST_RESULTS_KEY);
      const results: NotificationTestResult[] = resultsJson ? JSON.parse(resultsJson) : [];
      
      results.push(result);
      
      // Keep only last 100 results
      if (results.length > 100) {
        results.splice(0, results.length - 100);
      }
      
      await AsyncStorage.setItem(this.TEST_RESULTS_KEY, JSON.stringify(results));
    } catch (error) {
      console.error('❌ Error recording test result:', error);
    }
  }

  /**
   * Get test results
   */
  static async getTestResults(): Promise<NotificationTestResult[]> {
    try {
      const resultsJson = await AsyncStorage.getItem(this.TEST_RESULTS_KEY);
      return resultsJson ? JSON.parse(resultsJson) : [];
    } catch (error) {
      console.error('❌ Error getting test results:', error);
      return [];
    }
  }

  /**
   * Clear test data
   */
  static async clearTestData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.DEVICE_REGISTRY_KEY,
        this.TEST_RESULTS_KEY,
      ]);
      console.log('🧹 Test data cleared');
    } catch (error) {
      console.error('❌ Error clearing test data:', error);
    }
  }

  /**
   * Generate test report for all categories
   */
  static async runComprehensiveTest(): Promise<void> {
    const categories: ReportCategory[] = [
      'police_checkpoint',
      'accident',
      'road_hazard',
      'traffic_jam',
      'weather_alert',
      'general'
    ];

    console.log('🚀 Starting comprehensive notification test...');

    for (const category of categories) {
      console.log(`Testing ${category}...`);
      await this.testNotificationWithSound(category);
      
      // Wait 2 seconds between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('✅ Comprehensive test completed');
  }

  /**
   * Get current device ID
   */
  static getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * Monitor real-time notifications for testing
   */
  static startNotificationMonitoring(): void {
    console.log('👁️ Starting notification monitoring for testing...');
    
    // This will be called by the real-time subscription
    // when notifications are received
  }

  /**
   * Stop notification monitoring
   */
  static stopNotificationMonitoring(): void {
    console.log('🛑 Stopping notification monitoring');
  }
}

// Export test categories for easy access
export const TEST_CATEGORIES: ReportCategory[] = [
  'police_checkpoint',
  'accident', 
  'road_hazard',
  'traffic_jam',
  'weather_alert',
  'general'
];

// Export sound file mappings for testing
export const SOUND_FILE_MAPPING = {
  police_checkpoint: 'siren.wav',
  accident: 'crash.wav',
  road_hazard: 'warning.wav',
  traffic_jam: 'traffic.wav',
  weather_alert: 'weather.wav',
  general: 'default.wav',
};
