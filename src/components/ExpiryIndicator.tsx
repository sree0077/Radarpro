import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { ReportExpiryService } from '../services/reportExpiryService';
import { ReportCategory } from '../types';

interface ExpiryIndicatorProps {
  category: ReportCategory;
  updatedAt: string;
  style?: any;
  compact?: boolean;
}

export const ExpiryIndicator: React.FC<ExpiryIndicatorProps> = ({
  category,
  updatedAt,
  style,
  compact = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = ReportExpiryService.getTimeUntilExpiry(category, updatedAt);
      const expired = ReportExpiryService.isReportExpired(category, updatedAt);
      
      setTimeRemaining(remaining);
      setIsExpired(expired);
    };

    // Update immediately
    updateTimer();

    // Update every 30 seconds
    const interval = setInterval(updateTimer, 30000);

    return () => clearInterval(interval);
  }, [category, updatedAt]);

  if (isExpired) {
    return null; // Don't show indicator for expired reports
  }

  const isAboutToExpire = timeRemaining <= 1;
  const expiryTime = ReportExpiryService.getExpiryTimeForCategory(category);

  const getColor = () => {
    if (isAboutToExpire) return '#FF4444'; // Red for about to expire
    if (timeRemaining <= expiryTime * 0.3) return '#FF8800'; // Orange for < 30% time left
    return '#4CAF50'; // Green for plenty of time
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={[styles.compactDot, { backgroundColor: getColor() }]} />
        <Text style={[styles.compactText, { color: getColor() }]}>
          {formatTime(timeRemaining)}
        </Text>
      </View>
    );
  }

  return (
    <Chip
      mode="outlined"
      style={[
        styles.chip,
        { borderColor: getColor() },
        style
      ]}
      textStyle={[styles.chipText, { color: getColor() }]}
      icon={isAboutToExpire ? 'clock-alert' : 'clock-outline'}
    >
      {isAboutToExpire ? 'Expiring soon' : `${formatTime(timeRemaining)} left`}
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    backgroundColor: 'transparent',
    marginVertical: 2,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  compactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
