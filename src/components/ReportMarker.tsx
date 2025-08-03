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
      return '🚗';
    case 'weather_alert':
      return '🌧️';
    case 'general':
      return '📍';
    default:
      return '📍';
  }
};

export const ReportMarker: React.FC<ReportMarkerProps> = ({ report, onPress }) => {
  // Don't render markers on web to avoid compatibility issues
  if (Platform.OS === 'web' || !Marker) {
    return null;
  }

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
      {/* Custom marker with category icon */}
      <View style={styles.markerContainer}>
        <Text style={styles.markerIcon}>
          {getCategoryIcon(report.category)}
        </Text>
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  markerIcon: {
    fontSize: 20,
  },
});
