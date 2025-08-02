import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DatabaseInit } from './src/services/databaseInit';

export default function App() {
  useEffect(() => {
    // Initialize database when app starts
    DatabaseInit.initializeDatabase().then((success) => {
      if (success) {
        console.log('Database ready');
      } else {
        console.log('Database initialization failed - manual setup required');
      }
    });
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