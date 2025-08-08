import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { WebNotificationService } from '../services/webNotificationService';
import {
  Card,
  Text,
  Button,
  List,
  Chip,
  Divider,
  ProgressBar,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  MultiDeviceTestingUtils, 
  TestDevice, 
  NotificationTestResult,
  TEST_CATEGORIES,
  SOUND_FILE_MAPPING 
} from '../utils/multiDeviceTesting';
import { ReportCategory } from '../types';

export const MultiDeviceTestScreen: React.FC = () => {
  const [currentDevice, setCurrentDevice] = useState<TestDevice | null>(null);
  const [registeredDevices, setRegisteredDevices] = useState<TestDevice[]>([]);
  const [testResults, setTestResults] = useState<NotificationTestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isWeb] = useState(Platform.OS === 'web');
  const [webNotificationInfo, setWebNotificationInfo] = useState<any>(null);

  useEffect(() => {
    initializeTestEnvironment();
  }, []);

  const initializeTestEnvironment = async () => {
    try {
      setLoading(true);

      // Initialize web notifications if on web
      if (isWeb) {
        await WebNotificationService.initialize();
        setWebNotificationInfo(WebNotificationService.getWebNotificationInfo());
      }

      // Initialize current device
      const device = await MultiDeviceTestingUtils.initializeTestDevice();
      setCurrentDevice(device);

      // Load registered devices and test results
      await refreshData();

      // Start monitoring
      MultiDeviceTestingUtils.startNotificationMonitoring();
    } catch (error) {
      console.error('Error initializing test environment:', error);
      Alert.alert('Error', 'Failed to initialize testing environment');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      const [devices, results] = await Promise.all([
        MultiDeviceTestingUtils.getRegisteredDevices(),
        MultiDeviceTestingUtils.getTestResults(),
      ]);
      
      setRegisteredDevices(devices);
      setTestResults(results);
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const createTestReport = async (category: ReportCategory) => {
    try {
      setIsRunningTest(true);
      
      const report = await MultiDeviceTestingUtils.createTestReport(
        category,
        `Multi-device test: ${category} from ${currentDevice?.name}`
      );
      
      if (report) {
        Alert.alert(
          'Test Report Created',
          `Created ${category} report. Other devices should receive notifications with ${SOUND_FILE_MAPPING[category]} sound.`,
          [{ text: 'OK', onPress: refreshData }]
        );
      } else {
        Alert.alert('Error', 'Failed to create test report');
      }
    } catch (error) {
      console.error('Error creating test report:', error);
      Alert.alert('Error', 'Failed to create test report');
    } finally {
      setIsRunningTest(false);
    }
  };

  const testLocalNotification = async (category: ReportCategory) => {
    try {
      setIsRunningTest(true);
      await MultiDeviceTestingUtils.testNotificationWithSound(category);
      await refreshData();
      
      Alert.alert(
        'Local Test Complete',
        `Tested ${category} notification with ${SOUND_FILE_MAPPING[category]} sound on this device.`
      );
    } catch (error) {
      console.error('Error testing local notification:', error);
      Alert.alert('Error', 'Failed to test local notification');
    } finally {
      setIsRunningTest(false);
    }
  };

  const runComprehensiveTest = async () => {
    try {
      setIsRunningTest(true);
      
      Alert.alert(
        'Comprehensive Test',
        'This will test all notification categories with their custom sounds. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Test',
            onPress: async () => {
              await MultiDeviceTestingUtils.runComprehensiveTest();
              await refreshData();
              Alert.alert('Test Complete', 'All notification categories have been tested.');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error running comprehensive test:', error);
      Alert.alert('Error', 'Failed to run comprehensive test');
    } finally {
      setIsRunningTest(false);
    }
  };

  const clearTestData = async () => {
    Alert.alert(
      'Clear Test Data',
      'This will clear all test results and device registry. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await MultiDeviceTestingUtils.clearTestData();
            await refreshData();
            Alert.alert('Cleared', 'Test data has been cleared.');
          }
        }
      ]
    );
  };

  const getCategoryIcon = (category: ReportCategory): string => {
    const icons: Record<ReportCategory, string> = {
      police_checkpoint: 'shield-check',
      accident: 'car-crash',
      road_hazard: 'alert-triangle',
      traffic_jam: 'traffic-cone',
      weather_alert: 'weather-lightning-rainy',
      general: 'information',
    };
    return icons[category];
  };

  const getCategoryEmoji = (category: ReportCategory): string => {
    const emojis: Record<ReportCategory, string> = {
      police_checkpoint: '🚔',
      accident: '🚗',
      road_hazard: '⚠️',
      traffic_jam: '🚦',
      weather_alert: '🌧️',
      general: '📍',
    };
    return emojis[category];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ProgressBar indeterminate />
          <Text style={styles.loadingText}>Initializing test environment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Multi-Device Notification Testing</Text>
            <Text style={styles.subtitle}>
              Test real-time notifications with custom sounds across multiple devices
            </Text>
          </Card.Content>
        </Card>

        {/* Current Device Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Current Device</Text>
            {currentDevice && (
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{currentDevice.name}</Text>
                <Text style={styles.deviceDetails}>
                  {currentDevice.platform} • ID: {currentDevice.id.slice(-8)}
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Test Controls */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Test Controls</Text>
            
            <Button
              mode="contained"
              onPress={runComprehensiveTest}
              disabled={isRunningTest}
              style={styles.testButton}
              icon="play-circle"
            >
              Run Comprehensive Test
            </Button>
            
            <Button
              mode="outlined"
              onPress={refreshData}
              style={styles.testButton}
              icon="refresh"
            >
              Refresh Data
            </Button>
            
            <Button
              mode="outlined"
              onPress={clearTestData}
              style={styles.testButton}
              icon="delete"
            >
              Clear Test Data
            </Button>
          </Card.Content>
        </Card>

        {/* Category Tests */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Test by Category</Text>
            <Text style={styles.subtitle}>
              Create reports or test local notifications for each category
            </Text>

            {TEST_CATEGORIES.map((category) => (
              <View key={category}>
                <List.Item
                  title={`${getCategoryEmoji(category)} ${category.replace('_', ' ').toUpperCase()}`}
                  description={`Sound: ${SOUND_FILE_MAPPING[category]}`}
                  left={() => <List.Icon icon={getCategoryIcon(category)} />}
                  right={() => (
                    <View style={styles.categoryActions}>
                      <IconButton
                        icon="broadcast"
                        mode="contained-tonal"
                        size={20}
                        onPress={() => createTestReport(category)}
                        disabled={isRunningTest}
                      />
                      <IconButton
                        icon="volume-high"
                        mode="contained-tonal"
                        size={20}
                        onPress={() => testLocalNotification(category)}
                        disabled={isRunningTest}
                      />
                    </View>
                  )}
                />
                <Divider />
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Registered Devices */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Registered Test Devices ({registeredDevices.length})</Text>
            
            {registeredDevices.map((device) => (
              <View key={device.id} style={styles.deviceItem}>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>
                    {device.name} {device.isCurrentDevice ? '(Current)' : ''}
                  </Text>
                  <Text style={styles.deviceDetails}>
                    {device.platform} • {device.id.slice(-8)}
                  </Text>
                </View>
                <Chip
                  mode="outlined"
                  compact
                  style={[
                    styles.statusChip,
                    { backgroundColor: device.isCurrentDevice ? '#e8f5e8' : '#f5f5f5' }
                  ]}
                >
                  {device.isCurrentDevice ? 'Active' : 'Remote'}
                </Chip>
              </View>
            ))}
            
            {registeredDevices.length === 0 && (
              <Text style={styles.emptyText}>No devices registered yet</Text>
            )}
          </Card.Content>
        </Card>

        {/* Test Results */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Recent Test Results ({testResults.length})</Text>
            
            {testResults.slice(-10).reverse().map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultCategory}>
                    {getCategoryEmoji(result.category)} {result.category}
                  </Text>
                  <Text style={styles.resultDetails}>
                    Device: {result.deviceId.slice(-8)} • 
                    Sound: {result.soundPlayed ? '✅' : '❌'} • 
                    Notification: {result.notificationReceived ? '✅' : '❌'}
                  </Text>
                  <Text style={styles.resultTime}>
                    {new Date(result.timestamp).toLocaleTimeString()} • {result.latency}ms
                  </Text>
                </View>
              </View>
            ))}
            
            {testResults.length === 0 && (
              <Text style={styles.emptyText}>No test results yet</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  deviceInfo: {
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  testButton: {
    marginBottom: 8,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statusChip: {
    height: 24,
  },
  resultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultInfo: {
    flex: 1,
  },
  resultCategory: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultDetails: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  resultTime: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.5,
    fontStyle: 'italic',
    padding: 20,
  },
});
