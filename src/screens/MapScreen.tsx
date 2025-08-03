import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { FAB, Portal, Modal, Text, Button, Snackbar } from 'react-native-paper';

import { ReportCard } from '../components/ReportCard';
import { ReportMarker } from '../components/ReportMarker';
import { Report } from '../types';
import { SupabaseService } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';

export const MapScreen: React.FC = () => {
  const { appUser } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region>({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newReportNotification, setNewReportNotification] = useState<string | null>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const mapRef = useRef<MapView>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    initializeMap();
    loadReports();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const initializeMap = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      if (location) {
        setUserLocation(location);
        setRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Unable to get your current location');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      const { data, error } = await SupabaseService.getActiveReports();
      if (error) {
        console.error('Error loading reports:', error);
        Alert.alert('Error', 'Failed to load reports. Please try again.');
        return;
      }
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports. Please try again.');
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = SupabaseService.subscribeToReports(async (payload) => {
      console.log('📡 Real-time update received:', payload.eventType);

      if (payload.eventType === 'INSERT') {
        // Fetch complete report data with user info for new reports
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
              setNewReportNotification(`New ${newReport.category} report added`);
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
              // Remove expired report from map
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
              setNewReportNotification('Report updated');
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



  const handleReportPress = (report: Report) => {
    setSelectedReport(report);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedReport(null);
  };

  const centerOnUser = async () => {
    try {
      const location = await LocationService.getCurrentLocation();
      if (location && mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    } catch (error) {
      console.error('Error centering on user:', error);
    }
  };



  const hideSnackbar = () => {
    setSnackbarVisible(false);
    setNewReportNotification(null);
  };

  const filterReportsByRadius = () => {
    if (!userLocation || !appUser) return reports;
    
    return reports.filter(report => 
      LocationService.isWithinRadius(
        userLocation.latitude,
        userLocation.longitude,
        report.latitude,
        report.longitude,
        appUser.notification_radius
      )
    );
  };

  const filteredReports = filterReportsByRadius();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {/* Render report markers */}
        {filteredReports.map((report) => (
          <ReportMarker
            key={report.id}
            report={report}
            onPress={handleReportPress}
          />
        ))}
      </MapView>



      <FAB
        style={styles.fab}
        icon="crosshairs-gps"
        onPress={centerOnUser}
        label="My Location"
      />

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={closeModal}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedReport && (
            <View style={styles.modalContent}>
              <ReportCard
                report={selectedReport}
                onPress={handleReportPress}
                userLocation={userLocation}
              />
              <Button
                mode="contained"
                onPress={closeModal}
                style={styles.closeButton}
              >
                Close
              </Button>
            </View>
          )}
        </Modal>
      </Portal>

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
  },
  map: {
    flex: 1,
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