import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DatabaseInit } from './src/services/databaseInit';
import { NotificationService } from './src/services/notificationService';
import { SoundService } from './src/services/soundService';
import { OfflineNotificationService } from './src/services/offlineNotificationService';

export default function App() {
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database when app starts
        const dbSuccess = await DatabaseInit.initializeDatabase();
        if (dbSuccess) {
          console.log('✅ Database ready');
        } else {
          console.log('⚠️ Database initialization failed - manual setup required');
        }

        // Initialize notification services
        console.log('🔔 Initializing notification services...');
        await NotificationService.initialize();
        console.log('✅ NotificationService initialized');

        await SoundService.initialize();
        console.log('✅ SoundService initialized');

        await OfflineNotificationService.initialize();
        console.log('✅ OfflineNotificationService initialized');

        // Preload sounds for better performance
        await SoundService.preloadSounds();
        console.log('✅ Notification sounds preloaded');

        console.log('🎉 App initialization complete!');
      } catch (error) {
        console.error('❌ App initialization error:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <PaperProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </AuthProvider>
    </PaperProvider>
  );
} 