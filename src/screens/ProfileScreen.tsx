import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Card, 
  Text, 
  Button, 
  Switch, 
  TextInput, 
  Avatar, 
  Divider,
  List,
  Dialog,
  Portal
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useAuth } from '../contexts/AuthContext';
import { NotificationPreferences } from '../types';

export const ProfileScreen: React.FC = () => {
  const { user, appUser, updateUserProfile, signOut } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(appUser?.username || '');
  const [notificationRadius, setNotificationRadius] = useState(
    appUser?.notification_radius || 5000
  );
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    appUser?.notification_preferences || {
      police_checkpoints: true,
      accidents: true,
      road_hazards: true,
      traffic_jams: true,
      weather_alerts: true,
      general_alerts: true,
    }
  );
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!appUser) return;

    setLoading(true);
    try {
      const { error } = await updateUserProfile({
        username,
        notification_radius: notificationRadius,
        notification_preferences: notificationPreferences,
      });

      if (error) {
        Alert.alert('Error', 'Failed to update profile');
        return;
      }

      Alert.alert('Success', 'Profile updated successfully');
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setLogoutDialogVisible(false);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const toggleNotificationPreference = (key: keyof NotificationPreferences) => {
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const formatRadius = (meters: number): string => {
    if (meters < 1000) {
      return `${meters}m`;
    } else {
      return `${(meters / 1000).toFixed(1)}km`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.profileHeader}>
            <Avatar.Text 
              size={80} 
              label={appUser?.username?.charAt(0) || user?.email?.charAt(0) || 'U'} 
            />
            <View style={styles.profileInfo}>
              <Text style={styles.email}>{user?.email}</Text>
              {editing ? (
                <TextInput
                  mode="outlined"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  style={styles.usernameInput}
                />
              ) : (
                <Text style={styles.username}>{appUser?.username || 'No username set'}</Text>
              )}
            </View>
          </View>
          
          {editing ? (
            <View style={styles.editButtons}>
              <Button 
                mode="outlined" 
                onPress={() => setEditing(false)}
                style={styles.editButton}
              >
                Cancel
              </Button>
              <Button 
                mode="contained" 
                onPress={handleSaveProfile}
                loading={loading}
                style={styles.editButton}
              >
                Save
              </Button>
            </View>
          ) : (
            <Button 
              mode="outlined" 
              onPress={() => setEditing(true)}
              style={styles.editButton}
            >
              Edit Profile
            </Button>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Notification Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Notification Radius</Text>
            <Text style={styles.settingValue}>{formatRadius(notificationRadius)}</Text>
          </View>
          
          <Slider
            style={styles.slider}
            minimumValue={1000}
            maximumValue={50000}
            step={1000}
            value={notificationRadius}
            onValueChange={setNotificationRadius}
            minimumTrackTintColor="#0066FF"
            maximumTrackTintColor="#e0e0e0"
            thumbTintColor="#0066FF"
          />
          
          <Text style={styles.sliderDescription}>
            You'll receive notifications for alerts within this radius
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Alert Types</Text>
          
          <List.Item
            title="Police Checkpoints"
            description="🚔 Receive alerts about police checkpoints"
            left={() => <List.Icon icon="shield" />}
            right={() => (
              <Switch
                value={notificationPreferences.police_checkpoints}
                onValueChange={() => toggleNotificationPreference('police_checkpoints')}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Accidents"
            description="🚨 Receive alerts about accidents"
            left={() => <List.Icon icon="car-emergency" />}
            right={() => (
              <Switch
                value={notificationPreferences.accidents}
                onValueChange={() => toggleNotificationPreference('accidents')}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Road Hazards"
            description="⚠️ Receive alerts about road hazards"
            left={() => <List.Icon icon="alert" />}
            right={() => (
              <Switch
                value={notificationPreferences.road_hazards}
                onValueChange={() => toggleNotificationPreference('road_hazards')}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Traffic Jams"
            description="🚗 Receive alerts about traffic jams"
            left={() => <List.Icon icon="car" />}
            right={() => (
              <Switch
                value={notificationPreferences.traffic_jams}
                onValueChange={() => toggleNotificationPreference('traffic_jams')}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="Weather Alerts"
            description="🌧️ Receive alerts about weather conditions"
            left={() => <List.Icon icon="weather-rainy" />}
            right={() => (
              <Switch
                value={notificationPreferences.weather_alerts}
                onValueChange={() => toggleNotificationPreference('weather_alerts')}
              />
            )}
          />
          
          <Divider />
          
          <List.Item
            title="General Alerts"
            description="📍 Receive general community alerts"
            left={() => <List.Icon icon="information" />}
            right={() => (
              <Switch
                value={notificationPreferences.general_alerts}
                onValueChange={() => toggleNotificationPreference('general_alerts')}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <List.Item
            title="Sign Out"
            description="Sign out of your account"
            left={() => <List.Icon icon="logout" />}
            onPress={() => setLogoutDialogVisible(true)}
          />
        </Card.Content>
      </Card>

      <Portal>
        <Dialog
          visible={logoutDialogVisible}
          onDismiss={() => setLogoutDialogVisible(false)}
        >
          <Dialog.Title>Sign Out</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to sign out?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLogoutDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleLogout}>Sign Out</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  email: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  usernameInput: {
    marginTop: 8,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066FF',
  },
  slider: {
    height: 40,
    marginBottom: 8,
  },
  sliderDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
}); 