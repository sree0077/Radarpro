import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { Text, Chip, FAB, Snackbar, IconButton } from 'react-native-paper';
import { TimelineBranch } from '../components/TimelineBranch';
import { Report, ReportCategory } from '../types';
import { SupabaseService } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';

interface TimelineScreenProps {
  navigation: any;
}

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ navigation }) => {
  const { appUser } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<ReportCategory[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [newReportNotification, setNewReportNotification] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const subscriptionRef = useRef<any>(null);
  const refreshIconRotation = useRef(new Animated.Value(0)).current;

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

  const categories: { category: ReportCategory; label: string; icon: string; color: string }[] = [
    { category: 'police_checkpoint', label: 'Police', icon: '🚔', color: getCategoryColor('police_checkpoint') },
    { category: 'accident', label: 'Accident', icon: '🚨', color: getCategoryColor('accident') },
    { category: 'road_hazard', label: 'Hazard', icon: '⚠️', color: getCategoryColor('road_hazard') },
    { category: 'traffic_jam', label: 'Traffic', icon: '🚗', color: getCategoryColor('traffic_jam') },
    { category: 'weather_alert', label: 'Weather', icon: '🌧️', color: getCategoryColor('weather_alert') },
    { category: 'general', label: 'General', icon: '📍', color: getCategoryColor('general') },
  ];

  useEffect(() => {
    initializeScreen();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  // Refresh reports when appUser changes (profile switch)
  useEffect(() => {
    if (appUser) {
      setOffset(0);
      loadReports(true);
    }
  }, [appUser?.id]);

  useEffect(() => {
    filterReports();
  }, [reports, selectedCategories, userLocation]);

  const initializeScreen = async () => {
    await Promise.all([
      loadUserLocation(),
      loadReports(),
      SupabaseService.ensureUserUsernames(), // Ensure all users have usernames
    ]);
    setLoading(false);
  };

  const loadUserLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  const loadReports = async (isRefresh = false) => {
    try {
      const currentOffset = isRefresh ? 0 : offset;
      
      const { data, error } = isRefresh
        ? await SupabaseService.refreshReports(20, currentOffset)
        : await SupabaseService.getActiveReports(20, currentOffset);
      
      if (error) {
        console.error('Error loading reports:', error);
        return;
      }

      const newReports = data || [];
      
      if (isRefresh) {
        setReports(newReports);
        setOffset(20);
      } else {
        // Prevent duplicate reports by checking IDs
        setReports(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const uniqueNewReports = newReports.filter(r => !existingIds.has(r.id));
          return [...prev, ...uniqueNewReports];
        });
        setOffset(prev => prev + 20);
      }

      setHasMore(newReports.length === 20);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = SupabaseService.subscribeToReports(async (payload) => {
      console.log('📡 Timeline real-time update received:', payload.eventType);

      if (payload.eventType === 'INSERT') {
        // For new reports, fetch the complete data with user info
        try {
          const { data: newReport, error } = await SupabaseService.getReportById(payload.new.id);
          if (error) {
            console.error('Error fetching new report:', error);
            return;
          }
          if (newReport) {
            setReports(prev => {
              // Check if report already exists to prevent duplicates
              const exists = prev.some(r => r.id === newReport.id);
              if (exists) return prev;

              // Show notification for new report
              setNewReportNotification(`New ${newReport.category} report by ${newReport.user?.username || 'Anonymous'}`);
              setSnackbarVisible(true);

              return [newReport, ...prev];
            });
          }
        } catch (error) {
          console.error('Error in INSERT handler:', error);
        }
      } else if (payload.eventType === 'UPDATE') {
        // Handle report updates including expiry
        try {
          const { data: updatedReport, error } = await SupabaseService.getReportById(payload.new.id);
          if (error) {
            console.error('Error fetching updated report:', error);
            return;
          }

          if (updatedReport) {
            // Check if report was marked as expired
            if (updatedReport.status === 'expired') {
              // Remove expired report from timeline
              setReports(prev => prev.filter(report => report.id !== updatedReport.id));
              setNewReportNotification('Report expired and removed');
              setSnackbarVisible(true);
            } else {
              // Update active report
              setReports(prev =>
                prev.map(report =>
                  report.id === payload.new.id ? updatedReport : report
                )
              );
              setNewReportNotification(`Report updated by ${updatedReport.user?.username || 'Anonymous'}`);
              setSnackbarVisible(true);
            }
          }
        } catch (error) {
          console.error('Error in UPDATE handler:', error);
        }
      } else if (payload.eventType === 'DELETE') {
        setReports(prev =>
          prev.filter(report => report.id !== payload.old.id)
        );

        // Show notification for deleted report
        setNewReportNotification('Report removed');
        setSnackbarVisible(true);
      }
    });

    subscriptionRef.current = subscription;
    return subscription;
  };

  const filterReports = () => {
    let filtered = reports;

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(report => 
        selectedCategories.includes(report.category)
      );
    }

    // Filter by user's notification radius if location is available
    if (userLocation && appUser) {
      filtered = filtered.filter(report => 
        LocationService.isWithinRadius(
          userLocation.latitude,
          userLocation.longitude,
          report.latitude,
          report.longitude,
          appUser.notification_radius
        )
      );
    }

    setFilteredReports(filtered);
  };

  const toggleCategory = (category: ReportCategory) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setOffset(0);

    // Animate refresh icon
    Animated.timing(refreshIconRotation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      refreshIconRotation.setValue(0);
    });

    await loadReports(true);

    // Show success notification
    setNewReportNotification('Timeline refreshed successfully');
    setSnackbarVisible(true);

    setRefreshing(false);
  };

  const handleManualRefresh = () => {
    onRefresh();
  };

  const hideSnackbar = () => {
    setSnackbarVisible(false);
    setNewReportNotification(null);
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    await loadReports();
    setLoadingMore(false);
  };

  const handleReportPress = (report: Report) => {
    navigation.navigate('ReportDetail', { report });
  };

  const handleNewReport = () => {
    navigation.navigate('NewReport');
  };





  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading timeline...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Refresh Button */}
      <View style={styles.headerContainer}>
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item.category}
            renderItem={({ item }) => (
              <Chip
                mode={selectedCategories.includes(item.category) ? 'flat' : 'outlined'}
                selected={selectedCategories.includes(item.category)}
                onPress={() => toggleCategory(item.category)}
                style={[
                  styles.filterChip,
                  selectedCategories.includes(item.category) && {
                    backgroundColor: item.color,
                  }
                ]}
                textStyle={[
                  styles.filterChipText,
                  selectedCategories.includes(item.category) && {
                    color: 'white',
                  }
                ]}
              >
                {item.icon} {item.label}
              </Chip>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterList}
          />
        </View>

        {/* Manual Refresh Button */}
        <View style={styles.refreshButtonContainer}>
          <IconButton
            icon="refresh"
            size={24}
            iconColor="#0066FF"
            containerColor="white"
            onPress={handleManualRefresh}
            disabled={refreshing}
            style={[
              styles.refreshButton,
              {
                transform: [
                  {
                    rotate: refreshIconRotation.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          {refreshing && (
            <ActivityIndicator
              size="small"
              color="#0066FF"
              style={styles.refreshIndicator}
            />
          )}
        </View>
      </View>

      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <TimelineBranch
            report={item}
            onPress={handleReportPress}
            isLeft={index % 2 === 1}
            isFirst={index === 0}
            isLast={index === filteredReports.length - 1}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
        contentContainerStyle={styles.reportsList}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreContainer}>
              <ActivityIndicator size="small" color="#0066FF" />
              <Text style={styles.loadingMoreText}>Loading more...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedCategories.length > 0 
                ? 'No reports match your selected filters'
                : 'No reports available yet'
              }
            </Text>
          </View>
        }
      />

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewReport}
        label="New Report"
      />

      {/* Real-time Update Notification */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={hideSnackbar}
        duration={3000}
        style={styles.snackbar}
        action={{
          label: 'Dismiss',
          onPress: hideSnackbar,
        }}
      >
        {newReportNotification}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  filterContainer: {
    flex: 1,
    paddingVertical: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reportsList: {
    paddingBottom: 80, // Space for FAB
    paddingTop: 16,
    flexGrow: 1,
  },
  loadingMoreContainer: {
    padding: 16,
    alignItems: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#0066FF',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  refreshButtonContainer: {
    marginLeft: 8,
    alignItems: 'center',
  },
  refreshButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  refreshIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  snackbar: {
    backgroundColor: '#0066FF',
  },

});