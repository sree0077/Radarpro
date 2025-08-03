import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { Report, ReportCategory } from '../types';

// Conditional import to avoid web issues
let Marker: any = null;
if (Platform.OS !== 'web') {
  try {
    const maps = require('react-native-maps');
    Marker = maps.Marker;
  } catch (error) {
    console.warn('react-native-maps not available');
  }
}

interface ReportMarkerProps {
  report: Report;
  onPress: (report: Report) => void;
}

const getCategoryIcon = (category: ReportCategory): string => {
  switch (category) {
    case 'police_checkpoint':
      return '🚔';
    case 'accident':
      return '🚨';
    case 'road_hazard':
      return '⚠️';
    case 'traffic_jam':
      return '🚦';
    case 'weather_alert':
      return '🌧️';
    case 'general':
      return '📍';
    default:
      return '📍';
  }
};

const getCategoryColor = (category: ReportCategory): { primary: string; secondary: string; border: string } => {
  switch (category) {
    case 'police_checkpoint':
      return { primary: '#1E40AF', secondary: '#3B82F6', border: '#1D4ED8' }; // Blue
    case 'accident':
      return { primary: '#DC2626', secondary: '#EF4444', border: '#B91C1C' }; // Red
    case 'road_hazard':
      return { primary: '#D97706', secondary: '#F59E0B', border: '#B45309' }; // Orange
    case 'traffic_jam':
      return { primary: '#7C2D12', secondary: '#EA580C', border: '#9A3412' }; // Orange-Red
    case 'weather_alert':
      return { primary: '#0F766E', secondary: '#14B8A6', border: '#0D9488' }; // Teal
    case 'general':
      return { primary: '#374151', secondary: '#6B7280', border: '#4B5563' }; // Gray
    default:
      return { primary: '#374151', secondary: '#6B7280', border: '#4B5563' }; // Gray
  }
};

export const ReportMarker: React.FC<ReportMarkerProps> = ({ report, onPress }) => {
  // Don't render markers on web to avoid compatibility issues
  if (Platform.OS === 'web' || !Marker) {
    return null;
  }

  const icon = getCategoryIcon(report.category);

  return (
    <Marker
      coordinate={{
        latitude: report.latitude,
        longitude: report.longitude,
      }}
      title={report.title}
      description={report.description}
      onPress={() => onPress(report)}
    >
      {/* Clean marker design - just the symbol with text shadow for visibility */}
      <Text style={styles.markerIcon}>
        {icon}
      </Text>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerIcon: {
    fontSize: 32, // Large size for good visibility
    fontWeight: 'bold',
    textAlign: 'center',
    // Text shadow for better visibility against map backgrounds
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    // Additional shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
});
