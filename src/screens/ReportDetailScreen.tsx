import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Card, Chip, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Report } from '../types';
import { LocationService } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';

interface ReportDetailScreenProps {
  route: {
    params: {
      report: Report;
    };
  };
  navigation: any;
}

export const ReportDetailScreen: React.FC<ReportDetailScreenProps> = ({ route, navigation }) => {
  const { report } = route.params;
  const { appUser } = useAuth();

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      police_checkpoint: '🚔',
      accident: '🚨',
      road_hazard: '⚠️',
      traffic_jam: '🚗',
      weather_alert: '🌧️',
      general: '📍',
    };
    return icons[category] || '📍';
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      police_checkpoint: 'Police Checkpoint',
      accident: 'Accident',
      road_hazard: 'Road Hazard',
      traffic_jam: 'Traffic Jam',
      weather_alert: 'Weather Alert',
      general: 'General',
    };
    return labels[category] || 'General';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'resolved':
        return '#2196F3';
      case 'expired':
        return '#FF9800';
      default:
        return '#666';
    }
  };

  const formatDistance = (distance: number) => {
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    } else {
      return `${(distance / 1000).toFixed(1)}km`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const calculateDistance = () => {
    if (!appUser) return null;
    
    try {
      // This would need to be implemented with actual user location
      // For now, we'll show a placeholder
      return 'Distance calculation not available';
    } catch (error) {
      return 'Distance calculation error';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <View style={styles.categoryContainer}>
              <Text style={styles.categoryIcon}>{getCategoryIcon(report.category)}</Text>
              <Chip 
                mode="outlined" 
                style={[styles.statusChip, { borderColor: getStatusColor(report.status) }]}
              >
                <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                  {report.status.toUpperCase()}
                </Text>
              </Chip>
            </View>
            <Text style={styles.categoryLabel}>{getCategoryLabel(report.category)}</Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{report.description}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <View style={styles.locationInfo}>
              <MaterialCommunityIcons name="map-marker" size={16} color="#666" />
              <Text style={styles.locationText}>
                {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
              </Text>
            </View>
            {calculateDistance() && (
              <View style={styles.distanceInfo}>
                <MaterialCommunityIcons name="ruler" size={16} color="#666" />
                <Text style={styles.distanceText}>{calculateDistance()}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Report Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reported by:</Text>
              <Text style={styles.detailValue}>
                {report.user?.username || 'Anonymous'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reported at:</Text>
              <Text style={styles.detailValue}>
                {formatTimestamp(report.report_timestamp)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last updated:</Text>
              <Text style={styles.detailValue}>
                {formatTimestamp(report.updated_at)}
              </Text>
            </View>
          </View>

          {report.media_files && report.media_files.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Media Files</Text>
              <Text style={styles.mediaCount}>
                {report.media_files.length} file(s) attached
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.button}
        >
          Back to Timeline
        </Button>
      </View>
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
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  statusChip: {
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  divider: {
    marginVertical: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  mediaCount: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  buttonContainer: {
    padding: 16,
  },
  button: {
    marginBottom: 16,
  },
}); 