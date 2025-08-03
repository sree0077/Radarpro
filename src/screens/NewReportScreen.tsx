import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { 
  TextInput, 
  Button, 
  Text, 
  Chip, 
  Card, 
  IconButton,
  Portal,
  Modal,
  ActivityIndicator
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { ReportCategory } from '../types';
import { SupabaseService } from '../services/supabase';
import { LocationService } from '../services/locationService';
import { useAuth } from '../contexts/AuthContext';

interface NewReportScreenProps {
  navigation: any;
}

export const NewReportScreen: React.FC<NewReportScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  const categories: { category: ReportCategory; label: string; icon: string; color: string }[] = [
    { category: 'police_checkpoint', label: 'Police Checkpoint', icon: '🚔', color: '#FF0000' },
    { category: 'accident', label: 'Accident', icon: '🚨', color: '#FF6600' },
    { category: 'road_hazard', label: 'Road Hazard', icon: '⚠️', color: '#FFCC00' },
    { category: 'traffic_jam', label: 'Traffic Jam', icon: '🚗', color: '#0066FF' },
    { category: 'weather_alert', label: 'Weather Alert', icon: '🌧️', color: '#00CCFF' },
    { category: 'general', label: 'General', icon: '📍', color: '#666666' },
  ];

  useEffect(() => {
    getCurrentLocation();
    setupAudio();
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const currentLocation = await LocationService.getCurrentLocation();
      if (currentLocation) {
        setLocation(currentLocation);
        const address = await LocationService.reverseGeocode(
          currentLocation.latitude,
          currentLocation.longitude
        );
        if (address) {
          setLocationAddress(
            `${address.street || ''} ${address.city || ''} ${address.region || ''}`.trim()
          );
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
    }
  };

  const startRecording = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      setRecording(null);
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playAudio = async () => {
    if (!audioUri) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });

      await newSound.playAsync();
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const stopAudio = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const removePhoto = () => {
    setPhotoUri(null);
  };

  const removeAudio = () => {
    setAudioUri(null);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
  };

  const submitReport = async () => {
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Please set a location');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a report');
      return;
    }

    setLoading(true);

    try {
      // Create the report
      const reportData = {
        user_id: user.id,
        category,
        description: description.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
      };

      const { data: report, error: reportError } = await SupabaseService.createReport(reportData);

      if (reportError) {
        console.error('Error creating report:', reportError);

        // Provide specific error messages for common issues
        if (reportError.code === '23503') {
          Alert.alert(
            'Profile Error',
            'Your user profile is not set up properly. Please try logging out and logging back in.',
            [
              { text: 'OK' }
            ]
          );
          return;
        } else if (reportError.code === '42P01') {
          Alert.alert(
            'Database Error',
            'The database is not set up properly. Please contact the administrator.',
            [
              { text: 'OK' }
            ]
          );
          return;
        }

        throw reportError;
      }

      // Upload media files if any
      if (report) {
        if (photoUri) {
          const photoFile = await createFileFromUri(photoUri, 'photo.jpg');
          await SupabaseService.uploadMedia(photoFile, report.id, 'photo');
        }

        if (audioUri) {
          const audioFile = await createFileFromUri(audioUri, 'audio.m4a');
          await SupabaseService.uploadMedia(audioFile, report.id, 'audio');
        }
      }

      Alert.alert('Success', 'Report submitted successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createFileFromUri = async (uri: string, fileName: string): Promise<File> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type });
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoriesContainer}>
            {categories.map((cat) => (
              <Chip
                key={cat.category}
                mode={category === cat.category ? 'flat' : 'outlined'}
                selected={category === cat.category}
                onPress={() => setCategory(cat.category)}
                style={[
                  styles.categoryChip,
                  category === cat.category && { backgroundColor: cat.color }
                ]}
                textStyle={[
                  styles.categoryChipText,
                  category === cat.category && { color: 'white' }
                ]}
              >
                {cat.icon} {cat.label}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            mode="outlined"
            placeholder="Describe what you observed..."
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            style={styles.descriptionInput}
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Location</Text>
          <Button
            mode="outlined"
            onPress={() => setLocationModalVisible(true)}
            icon="map-marker"
            style={styles.locationButton}
          >
            {locationAddress || 'Set Location'}
          </Button>
          {location && (
            <Text style={styles.locationText}>
              📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Photo</Text>
          <View style={styles.mediaButtons}>
            <Button mode="outlined" onPress={takePhoto} icon="camera">
              Take Photo
            </Button>
            <Button mode="outlined" onPress={pickPhoto} icon="image">
              Choose Photo
            </Button>
          </View>
          {photoUri && (
            <View style={styles.mediaPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              <IconButton
                icon="close"
                size={20}
                onPress={removePhoto}
                style={styles.removeButton}
              />
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Voice Message</Text>
          <View style={styles.mediaButtons}>
            {!isRecording ? (
              <Button mode="outlined" onPress={startRecording} icon="microphone">
                Start Recording
              </Button>
            ) : (
              <Button mode="contained" onPress={stopRecording} icon="stop">
                Stop Recording
              </Button>
            )}
          </View>
          {audioUri && (
            <View style={styles.mediaPreview}>
              <View style={styles.audioPreview}>
                <IconButton
                  icon={isPlaying ? "stop" : "play"}
                  size={24}
                  onPress={isPlaying ? stopAudio : playAudio}
                />
                <Text style={styles.audioText}>Voice Message</Text>
              </View>
              <IconButton
                icon="close"
                size={20}
                onPress={removeAudio}
                style={styles.removeButton}
              />
            </View>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={submitReport}
        loading={loading}
        disabled={loading || !category || !description.trim() || !location}
        style={styles.submitButton}
      >
        Submit Report
      </Button>

      <Portal>
        <Modal
          visible={locationModalVisible}
          onDismiss={() => setLocationModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Location</Text>
          <Text style={styles.modalText}>
            Current location: {locationAddress || 'Not available'}
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              getCurrentLocation();
              setLocationModalVisible(false);
            }}
          >
            Use Current Location
          </Button>
        </Modal>
      </Portal>
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
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    marginBottom: 8,
  },
  categoryChipText: {
    fontSize: 12,
  },
  descriptionInput: {
    marginBottom: 8,
  },
  locationButton: {
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mediaPreview: {
    position: 'relative',
    alignItems: 'center',
  },
  photoPreview: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    minWidth: 200,
  },
  audioText: {
    marginLeft: 8,
    fontSize: 14,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
  },
  submitButton: {
    margin: 16,
    marginTop: 8,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalText: {
    marginBottom: 16,
    color: '#666',
  },
}); 