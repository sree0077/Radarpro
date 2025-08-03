import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Animated } from 'react-native';
import { FAB, Portal, Modal, Text, Button, Snackbar, IconButton } from 'react-native-paper';
import { SupabaseService } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { Report, ReportCategory } from '../types';
import { ReportCard } from '../components/ReportCard';

interface MapScreenProps {
  navigation: any;
}

export const MapScreen: React.FC<MapScreenProps> = ({ navigation }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<ReportCategory[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [notificationRadius, setNotificationRadius] = useState(5); // km
  const refreshAnimation = new Animated.Value(0);

  useEffect(() => {
    loadReports();
    getCurrentLocation();
    
    // Set up real-time subscription
    const subscription = SupabaseService.subscribeToReports((payload) => {
      console.log('📡 Real-time update received:', payload);
      if (payload.eventType === 'INSERT') {
        loadReports(); // Refresh all reports when new one is added
        showSnackbar('New report added nearby!');
      } else if (payload.eventType === 'UPDATE') {
        loadReports(); // Refresh when report is updated
      } else if (payload.eventType === 'DELETE') {
        loadReports(); // Refresh when report is deleted
      }
    });

    return () => {
      if (subscription) {
        SupabaseService.unsubscribeFromReports(subscription);
      }
    };
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, selectedCategories, userLocation, notificationRadius]);

  const getCurrentLocation = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);
      const { data, error } = showRefreshIndicator
        ? await SupabaseService.refreshReports()
        : await SupabaseService.getActiveReports();
      
      if (error) {
        console.error('Error loading reports:', error);
        showSnackbar('Error loading reports');
        return;
      }

      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      showSnackbar('Error loading reports');
    } finally {
      setLoading(false);
      setShowRefreshIndicator(false);
    }
  };

  const filterReports = () => {
    let filtered = reports;

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(report => selectedCategories.includes(report.category));
    }

    // Filter by notification radius if user location is available
    if (userLocation && notificationRadius > 0) {
      filtered = filtered.filter(report => {
        const distance = LocationService.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          report.latitude,
          report.longitude
        );
        return distance <= notificationRadius;
      });
    }

    setFilteredReports(filtered);
  };

  const handleRefresh = async () => {
    setShowRefreshIndicator(true);
    
    // Start rotation animation
    Animated.loop(
      Animated.timing(refreshAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ).start();

    await loadReports();

    // Stop animation
    refreshAnimation.stopAnimation();
    refreshAnimation.setValue(0);
  };

  const handleReportPress = (report: Report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const handleNewReport = () => {
    navigation.navigate('NewReport');
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const hideSnackbar = () => {
    setSnackbarVisible(false);
  };

  const spin = refreshAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Web fallback for map */}
      <View style={[styles.map, styles.webMapFallback]}>
        <Text style={styles.webMapText}>
          Map view is not available on web. Please use the mobile app to view the map and report markers.
        </Text>
        <Text style={styles.webMapSubtext}>
          Active reports: {filteredReports.length}
        </Text>
        
        {/* Show list of reports on web */}
        <View style={styles.reportsList}>
          {filteredReports.slice(0, 3).map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onPress={handleReportPress}
              userLocation={userLocation}
            />
          ))}
          {filteredReports.length > 3 && (
            <Text style={styles.moreReportsText}>
              +{filteredReports.length - 3} more reports...
            </Text>
          )}
        </View>
      </View>

      {/* Refresh Button */}
      <View style={styles.refreshContainer}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <IconButton
            icon="refresh"
            size={24}
            mode="contained"
            onPress={handleRefresh}
            style={styles.refreshButton}
            disabled={showRefreshIndicator}
          />
        </Animated.View>
        {showRefreshIndicator && (
          <ActivityIndicator
            size="small"
            color="#0066FF"
            style={styles.refreshIndicator}
          />
        )}
      </View>

      {/* Floating Action Button */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleNewReport}
        label="New Report"
      />

      {/* Report Details Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {selectedReport && (
              <ReportCard
                report={selectedReport}
                onPress={() => {}}
                userLocation={userLocation}
              />
            )}
            <Button
              mode="contained"
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              Close
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Snackbar for notifications */}
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
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  webMapFallback: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  reportsList: {
    width: '100%',
    maxWidth: 600,
  },
  moreReportsText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
  },
  refreshContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    alignItems: 'center',
  },
  refreshButton: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  refreshIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 16,
  },
  closeButton: {
    marginTop: 16,
  },
  snackbar: {
    backgroundColor: '#0066FF',
  },
});
