import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { Text, Chip, FAB } from 'react-native-paper';
import { ReportCard } from '../components/ReportCard';
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

  const categories: { category: ReportCategory; label: string; icon: string }[] = [
    { category: 'police_checkpoint', label: 'Police', icon: '🚔' },
    { category: 'accident', label: 'Accident', icon: '🚨' },
    { category: 'road_hazard', label: 'Hazard', icon: '⚠️' },
    { category: 'traffic_jam', label: 'Traffic', icon: '🚗' },
    { category: 'weather_alert', label: 'Weather', icon: '🌧️' },
    { category: 'general', label: 'General', icon: '📍' },
  ];

  useEffect(() => {
    initializeScreen();
    setupRealtimeSubscription();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, selectedCategories, userLocation]);

  const initializeScreen = async () => {
    await Promise.all([
      loadUserLocation(),
      loadReports(),
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
      const { data, error } = await SupabaseService.getReports(20, currentOffset);
      
      if (error) {
        console.error('Error loading reports:', error);
        return;
      }

      const newReports = data || [];
      
      if (isRefresh) {
        setReports(newReports);
        setOffset(20);
      } else {
        setReports(prev => [...prev, ...newReports]);
        setOffset(prev => prev + 20);
      }

      setHasMore(newReports.length === 20);
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = SupabaseService.subscribeToReports((payload) => {
      if (payload.eventType === 'INSERT') {
        setReports(prev => [payload.new, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setReports(prev => 
          prev.map(report => 
            report.id === payload.new.id ? payload.new : report
          )
        );
      } else if (payload.eventType === 'DELETE') {
        setReports(prev => 
          prev.filter(report => report.id !== payload.old.id)
        );
      }
    });

    return () => subscription.unsubscribe();
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
    await loadReports(true);
    setRefreshing(false);
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
              style={styles.filterChip}
              textStyle={styles.filterChipText}
            >
              {item.icon} {item.label}
            </Chip>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            onPress={handleReportPress}
            userLocation={userLocation}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.1}
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterChip: {
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
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
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
}); 