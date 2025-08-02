import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Card, Chip, Avatar } from 'react-native-paper';
import { Report, ReportCategory } from '../types';
import { LocationService } from '../services/locationService';

interface ReportCardProps {
  report: Report;
  onPress: (report: Report) => void;
  userLocation?: { latitude: number; longitude: number };
}

const getCategoryColor = (category: ReportCategory): string => {
  switch (category) {
    case 'police_checkpoint':
      return '#FF0000';
    case 'accident':
      return '#FF6600';
    case 'road_hazard':
      return '#FFCC00';
    case 'traffic_jam':
      return '#0066FF';
    case 'weather_alert':
      return '#00CCFF';
    case 'general':
    default:
      return '#666666';
  }
};

const getCategoryLabel = (category: ReportCategory): string => {
  switch (category) {
    case 'police_checkpoint':
      return 'Police Checkpoint';
    case 'accident':
      return 'Accident';
    case 'road_hazard':
      return 'Road Hazard';
    case 'traffic_jam':
      return 'Traffic Jam';
    case 'weather_alert':
      return 'Weather Alert';
    case 'general':
    default:
      return 'General';
  }
};

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
    default:
      return '📍';
  }
};

const formatTimestamp = (report_timestamp: string): string => {
  const date = new Date(report_timestamp);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return date.toLocaleDateString();
};

export const ReportCard: React.FC<ReportCardProps> = ({ 
  report, 
  onPress, 
  userLocation 
}) => {
  const categoryColor = getCategoryColor(report.category);
  const categoryLabel = getCategoryLabel(report.category);
  const categoryIcon = getCategoryIcon(report.category);

  const distance = userLocation 
    ? LocationService.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        report.latitude,
        report.longitude
      )
    : null;

  const hasMedia = report.media_files && report.media_files.length > 0;
  const photoMedia = report.media_files?.find(m => m.file_type === 'photo');
  const audioMedia = report.media_files?.find(m => m.file_type === 'audio');

  return (
    <TouchableOpacity onPress={() => onPress(report)}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.userInfo}>
              <Avatar.Text 
                size={32} 
                label={report.user?.username?.charAt(0) || 'U'} 
              />
              <View style={styles.userDetails}>
                <Text style={styles.username}>
                  {report.user?.username || 'Anonymous'}
                </Text>
                <Text style={styles.timestamp}>
                  {formatTimestamp(report.report_timestamp)}
                </Text>
              </View>
            </View>
            <Chip 
              mode="outlined"
              textStyle={{ color: categoryColor }}
              style={[styles.categoryChip, { borderColor: categoryColor }]}
            >
              {categoryIcon} {categoryLabel}
            </Chip>
          </View>

          <Text style={styles.description}>{report.description}</Text>

          {hasMedia && (
            <View style={styles.mediaContainer}>
              {photoMedia && (
                <View style={styles.mediaItem}>
                  <Image 
                    source={{ uri: photoMedia.file_url }} 
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <Text style={styles.mediaLabel}>📷 Photo</Text>
                </View>
              )}
              {audioMedia && (
                <View style={styles.mediaItem}>
                  <View style={styles.audioIndicator}>
                    <Text style={styles.audioIcon}>🎤</Text>
                  </View>
                  <Text style={styles.mediaLabel}>🎵 Voice Message</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.footer}>
            {distance && (
              <Text style={styles.distance}>
                📍 {LocationService.formatDistance(distance)} away
              </Text>
            )}
            <View style={[styles.statusIndicator, { backgroundColor: categoryColor }]}>
              <Text style={styles.statusText}>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  categoryChip: {
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
  mediaContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mediaItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  mediaImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  mediaLabel: {
    fontSize: 12,
    color: '#666',
  },
  audioIndicator: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  audioIcon: {
    fontSize: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  distance: {
    fontSize: 12,
    color: '#666',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
}); 