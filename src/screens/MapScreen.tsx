import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { FAB, Portal, Modal, Text, Button } from 'react-native-paper';
import { ReportMarker } from '../components/ReportMarker';
import { ReportCard } from '../components/ReportCard';
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
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    initializeMap();
    loadReports();
    setupRealtimeSubscription();
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
      const { data, error } = await SupabaseService.getReports();
      if (error) {
        console.error('Error loading reports:', error);
        return;
      }
      setReports(data || []);
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

  const handleMarkerPress = (report: Report) => {
    setSelectedReport(report);
    setModalVisible(true);
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
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
      >
        {filteredReports.map((report) => (
          <ReportMarker
            key={report.id}
            report={report}
            onPress={handleMarkerPress}
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
}); 