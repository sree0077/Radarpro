import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, Card } from 'react-native-paper';
import { Report, ReportCategory } from '../types';
import { ExpiryIndicator } from './ExpiryIndicator';

interface TimelineBranchProps {
  report: Report;
  onPress: (report: Report) => void;
  isLeft: boolean;
  isFirst: boolean;
  isLast: boolean;
}

const getCategoryColor = (category: ReportCategory): string => {
  switch (category) {
    case 'police_checkpoint':
      return '#FF4444'; // Red
    case 'weather_alert':
      return '#00BFFF'; // Light Blue
    case 'accident':
      return '#0066FF'; // Blue
    case 'general':
      return '#666666'; // Gray
    case 'road_hazard':
      return '#FF8800'; // Orange
    case 'traffic_jam':
      return '#8A2BE2'; // Purple
    default:
      return '#666666';
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

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
};

export const TimelineBranch: React.FC<TimelineBranchProps> = ({
  report,
  onPress,
  isLeft,
  isFirst,
  isLast
}) => {
  const categoryColor = getCategoryColor(report.category);
  const categoryIcon = getCategoryIcon(report.category);

  const truncateDescription = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <View style={styles.container}>
      {/* Timeline Line */}
      <View style={styles.timelineContainer}>
        {!isFirst && <View style={styles.timelineLineTop} />}
        <View style={[styles.timelineNode, { backgroundColor: categoryColor }]}>
          <Text style={styles.nodeIcon}>{categoryIcon}</Text>
        </View>
        {!isLast && <View style={styles.timelineLineBottom} />}
      </View>

      {/* Branch Line */}
      <View style={[
        styles.branchLine,
        isLeft ? styles.branchLineLeft : styles.branchLineRight,
        { backgroundColor: categoryColor }
      ]} />

      {/* Branch Card */}
      <TouchableOpacity
        style={[
          styles.cardContainer,
          isLeft ? styles.cardLeft : styles.cardRight
        ]}
        onPress={() => onPress(report)}
      >
        <Card style={[
          styles.card,
          { borderLeftColor: categoryColor, borderLeftWidth: 4 }
        ]}>
          <Card.Content style={styles.cardContent}>
            {/* Header */}
            <View style={styles.header}>
              <Avatar.Text 
                size={24} 
                label={report.user?.username?.charAt(0) || 'U'}
                style={styles.avatar}
              />
              <View style={styles.headerText}>
                <Text style={styles.username}>
                  {report.user?.username || 'Anonymous'}
                </Text>
                <Text style={styles.timestamp}>
                  {formatTimestamp(report.report_timestamp)}
                </Text>
              </View>
              <ExpiryIndicator 
                category={report.category}
                updatedAt={report.updated_at}
                compact={true}
              />
            </View>

            {/* Category */}
            <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
              <Text style={styles.categoryText}>
                {categoryIcon} {report.category.replace('_', ' ').toUpperCase()}
              </Text>
            </View>

            {/* Description */}
            <Text style={styles.description}>
              {truncateDescription(report.description)}
            </Text>

            {/* Media indicator */}
            {report.media_files && report.media_files.length > 0 && (
              <View style={styles.mediaIndicator}>
                {report.media_files.some(m => m.file_type === 'photo') && (
                  <Text style={styles.mediaIcon}>📷</Text>
                )}
                {report.media_files.some(m => m.file_type === 'audio') && (
                  <Text style={styles.mediaIcon}>🎤</Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  timelineContainer: {
    alignItems: 'center',
    width: 40,
  },
  timelineLineTop: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
  },
  timelineLineBottom: {
    width: 2,
    height: 20,
    backgroundColor: '#E0E0E0',
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  nodeIcon: {
    fontSize: 14,
  },
  branchLine: {
    height: 2,
    width: 20,
  },
  branchLineLeft: {
    marginRight: 8,
  },
  branchLineRight: {
    marginLeft: 8,
  },
  cardContainer: {
    flex: 1,
    maxWidth: '70%',
  },
  cardLeft: {
    alignSelf: 'flex-start',
  },
  cardRight: {
    alignSelf: 'flex-end',
  },
  card: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContent: {
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    marginRight: 8,
  },
  headerText: {
    flex: 1,
  },
  username: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 9,
    color: 'white',
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    color: '#333',
    lineHeight: 16,
    marginBottom: 4,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
  },
  mediaIcon: {
    fontSize: 12,
    marginLeft: 4,
  },
});
