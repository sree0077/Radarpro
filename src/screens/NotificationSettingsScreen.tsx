import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  List,
  Switch,
  Divider,
  ProgressBar,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ComprehensiveNotificationPreferences,
  NotificationSettings,
  ReportCategory,
  NotificationFrequency,
  NotificationPriority,
  GlobalNotificationSettings,
} from '../types';
import { NotificationService } from '../services/notificationService';
import { NotificationStorage } from '../services/notificationStorage';

export const NotificationSettingsScreen: React.FC = () => {
  const [preferences, setPreferences] = useState<ComprehensiveNotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    loadPreferences();
    loadStatistics();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await NotificationService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await NotificationStorage.getNotificationStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const savePreferences = async (newPreferences: ComprehensiveNotificationPreferences) => {
    try {
      await NotificationService.saveNotificationPreferences(newPreferences);
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Failed to save notification preferences');
    }
  };

  const updateCategorySettings = async (category: ReportCategory, settings: Partial<NotificationSettings>) => {
    if (!preferences) return;
    
    // Map ReportCategory to ComprehensiveNotificationPreferences keys
    const categoryKey = category === 'police_checkpoint' ? 'police_checkpoints' : category;
    
    const newPreferences = {
      ...preferences,
      [categoryKey]: { ...preferences[categoryKey as keyof ComprehensiveNotificationPreferences], ...settings },
    };
    await savePreferences(newPreferences);
  };

  const updateGlobalSettings = async (settings: Partial<GlobalNotificationSettings>) => {
    if (!preferences) return;
    
    const newPreferences = {
      ...preferences,
      global_settings: { ...preferences.global_settings, ...settings },
    };
    await savePreferences(newPreferences);
  };

  const sendTestNotification = async (category: ReportCategory) => {
    try {
      await NotificationService.sendTestNotification(category);
      Alert.alert('Test Notification', 'Test notification sent successfully!');
    } catch (error) {
      console.error('Error sending test notification:', error);
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const getCategoryDisplayName = (category: ReportCategory): string => {
    const names: Record<ReportCategory, string> = {
      police_checkpoint: 'Police Checkpoints',
      accident: 'Accidents',
      road_hazard: 'Road Hazards',
      traffic_jam: 'Traffic Jams',
      weather_alert: 'Weather Alerts',
      general: 'General Reports',
    };
    return names[category];
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

  const getFrequencyDisplayName = (frequency: NotificationFrequency): string => {
    const names: Record<NotificationFrequency, string> = {
      immediate: 'Immediate',
      every_5min: 'Every 5 minutes',
      every_15min: 'Every 15 minutes',
      hourly: 'Hourly',
      daily: 'Daily',
    };
    return names[frequency];
  };

  const getPriorityDisplayName = (priority: NotificationPriority): string => {
    const names: Record<NotificationPriority, string> = {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
    };
    return names[priority];
  };

  const getPriorityColor = (priority: NotificationPriority): string => {
    const colors: Record<NotificationPriority, string> = {
      low: '#4CAF50',
      normal: '#2196F3',
      high: '#FF9800',
      urgent: '#F44336',
    };
    return colors[priority];
  };

  if (loading || !preferences) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ProgressBar indeterminate />
          <Text style={styles.loadingText}>Loading notification settings...</Text>
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
            <Text style={styles.title}>Notification Settings</Text>
            <Text style={styles.subtitle}>
              Customize how and when you receive notifications for different types of reports
            </Text>
          </Card.Content>
        </Card>

        {/* Global Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Global Settings</Text>
            
            <List.Item
              title="Master Notifications"
              description={preferences.global_settings.enabled ? 'Enabled' : 'Disabled'}
              left={() => <List.Icon icon="bell" />}
              right={() => (
                <Switch
                  value={preferences.global_settings.enabled}
                  onValueChange={(value) => updateGlobalSettings({ enabled: value })}
                />
              )}
            />
            
            <Divider />
            
            <List.Item
              title="Sound Enabled"
              description={preferences.global_settings.sound_enabled ? 'Enabled' : 'Disabled'}
              left={() => <List.Icon icon="volume-high" />}
              right={() => (
                <Switch
                  value={preferences.global_settings.sound_enabled}
                  onValueChange={(value) => updateGlobalSettings({ sound_enabled: value })}
                />
              )}
            />
            
            <Divider />
            
            <List.Item
              title="Vibration Enabled"
              description={preferences.global_settings.vibration_enabled ? 'Enabled' : 'Disabled'}
              left={() => <List.Icon icon="vibrate" />}
              right={() => (
                <Switch
                  value={preferences.global_settings.vibration_enabled}
                  onValueChange={(value) => updateGlobalSettings({ vibration_enabled: value })}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* Category Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Alert Categories</Text>

            {(['police_checkpoint', 'accident', 'road_hazard', 'traffic_jam', 'weather_alert', 'general'] as ReportCategory[])
              .map((category) => {
                const categoryKey = category === 'police_checkpoint' ? 'police_checkpoints' : category;
                const settings = preferences[categoryKey as keyof ComprehensiveNotificationPreferences] as NotificationSettings;
                
                // Skip rendering if settings are not available yet
                if (!settings) {
                  return null;
                }
                
                return (
                  <View key={category}>
                    <List.Item
                      title={getCategoryDisplayName(category)}
                      description={`${getCategoryEmoji(category)} ${getFrequencyDisplayName(settings.frequency)} • ${getPriorityDisplayName(settings.priority)}`}
                      left={() => <List.Icon icon={getCategoryIcon(category)} />}
                      right={() => (
                        <View style={styles.categoryControls}>
                          <Chip
                            style={[styles.priorityChip, { backgroundColor: getPriorityColor(settings.priority) }]}
                            textStyle={{ color: 'white', fontSize: 10 }}
                          >
                            {getPriorityDisplayName(settings.priority)}
                          </Chip>
                          <Switch
                            value={settings.enabled}
                            onValueChange={(value) => updateCategorySettings(category, { enabled: value })}
                          />
                        </View>
                      )}
                    />
                    <Divider />
                  </View>
                );
              })}
          </Card.Content>
        </Card>

        {/* Statistics */}
        {statistics && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Statistics</Text>
              <Text>Total Notifications Sent: {statistics.total_sent || 0}</Text>
              <Text>Notifications This Week: {statistics.this_week || 0}</Text>
            </Card.Content>
          </Card>
        )}

        {/* Test Notifications */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Test Notifications</Text>
            <Button
              mode="outlined"
              onPress={() => sendTestNotification('general')}
              style={styles.testButton}
              icon="play"
            >
              Send Test Notification
            </Button>
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  categoryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityChip: {
    height: 24,
  },
  testButton: {
    marginTop: 8,
  },
});
