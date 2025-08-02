import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { ReportCategory } from '../types';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
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

  static getSoundForCategory(category: ReportCategory): string {
    switch (category) {
      case 'police_checkpoint':
        return 'siren.mp3';
      case 'accident':
        return 'crash.mp3';
      case 'road_hazard':
        return 'warning.mp3';
      case 'traffic_jam':
        return 'traffic.mp3';
      case 'weather_alert':
        return 'weather.mp3';
      case 'general':
      default:
        return 'default.mp3';
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
} 