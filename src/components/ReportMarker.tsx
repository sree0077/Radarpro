import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Report, ReportCategory } from '../types';

interface ReportMarkerProps {
  report: Report;
  onPress: (report: Report) => void;
}

const getMarkerColor = (category: ReportCategory): string => {
  switch (category) {
    case 'police_checkpoint':
      return '#FF0000'; // Red
    case 'accident':
      return '#FF6600'; // Orange
    case 'road_hazard':
      return '#FFCC00'; // Yellow
    case 'traffic_jam':
      return '#0066FF'; // Blue
    case 'weather_alert':
      return '#00CCFF'; // Light Blue
    case 'general':
    default:
      return '#666666'; // Gray
  }
};

const getMarkerIcon = (category: ReportCategory): string => {
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
    default:
      return '📍';
  }
};

export const ReportMarker: React.FC<ReportMarkerProps> = ({ report, onPress }) => {
  const markerColor = getMarkerColor(report.category);
  const markerIcon = getMarkerIcon(report.category);

  return (
    <Marker
      coordinate={{
        latitude: report.latitude,
        longitude: report.longitude,
      }}
      onPress={() => onPress(report)}
    >
      <View style={[styles.markerContainer, { backgroundColor: markerColor }]}>
        <Text style={styles.markerIcon}>{markerIcon}</Text>
        <View style={styles.markerDot} />
      </View>
    </Marker>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerIcon: {
    fontSize: 16,
    color: 'white',
  },
  markerDot: {
    position: 'absolute',
    bottom: -8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ccc',
  },
}); 