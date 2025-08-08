import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ReportCategory, NotificationSound } from '../types';

export class SoundService {
  private static readonly STORAGE_KEY = 'custom_notification_sounds';
  private static soundObjects: Map<string, Audio.Sound> = new Map();
  
  // Default sound mappings for each category
  // Using custom sound files from assets/sounds/notifications
  private static readonly DEFAULT_SOUNDS: Record<ReportCategory, any> = {
    police_checkpoint: require('../../assets/sounds/notifications/siren.wav'),
    accident: require('../../assets/sounds/notifications/crash.wav'),
    road_hazard: require('../../assets/sounds/notifications/warning.wav'),
    traffic_jam: require('../../assets/sounds/notifications/traffic.wav'),
    weather_alert: require('../../assets/sounds/notifications/weather.wav'),
    general: require('../../assets/sounds/notifications/default.wav'),
  };

  // Sound metadata
  private static readonly SOUND_METADATA: Record<ReportCategory, NotificationSound> = {
    police_checkpoint: {
      id: 'police_siren',
      name: 'Police Siren',
      category: 'police_checkpoint',
      file_path: require('../../assets/sounds/notifications/siren.wav'),
      duration: 2000,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
    accident: {
      id: 'crash_alert',
      name: 'Crash Alert',
      category: 'accident',
      file_path: require('../../assets/sounds/notifications/crash.wav'),
      duration: 1500,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
    road_hazard: {
      id: 'warning_beep',
      name: 'Warning Beep',
      category: 'road_hazard',
      file_path: require('../../assets/sounds/notifications/warning.wav'),
      duration: 1000,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
    traffic_jam: {
      id: 'traffic_horn',
      name: 'Traffic Horn',
      category: 'traffic_jam',
      file_path: require('../../assets/sounds/notifications/traffic.wav'),
      duration: 1200,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
    weather_alert: {
      id: 'weather_chime',
      name: 'Weather Chime',
      category: 'weather_alert',
      file_path: require('../../assets/sounds/notifications/weather.wav'),
      duration: 1800,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
    general: {
      id: 'default_notification',
      name: 'Default Notification',
      category: 'general',
      file_path: require('../../assets/sounds/notifications/default.wav'),
      duration: 1000,
      is_custom: false,
      created_at: new Date().toISOString(),
    },
  };

  /**
   * Initialize audio settings
   */
  static async initialize(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      console.log('🔊 Audio service initialized');
    } catch (error) {
      console.error('❌ Error initializing audio service:', error);
    }
  }

  /**
   * Play notification sound for a category
   */
  static async playNotificationSound(
    category: ReportCategory,
    customSoundPath?: string
  ): Promise<void> {
    try {
      console.log(`🔊 Playing notification sound for category: ${category}`);

      // Try to use preloaded custom sound first
      const soundKey = customSoundPath || category;
      let sound = this.soundObjects.get(soundKey);

      if (sound) {
        // Use preloaded custom sound
        await sound.replayAsync();
        console.log(`✅ Played custom sound for ${category}`);
      } else if (customSoundPath) {
        // Load custom sound on demand
        try {
          const { sound: newSound } = await Audio.Sound.createAsync({ uri: customSoundPath });
          await newSound.playAsync();
          this.soundObjects.set(soundKey, newSound);
          console.log(`✅ Played custom sound from path: ${customSoundPath}`);
        } catch (error) {
          console.warn(`⚠️ Failed to load custom sound, falling back to default for ${category}`);
          await this.playDefaultSound(category);
        }
      } else {
        // Load default sound for category
        await this.playDefaultSound(category);
      }
    } catch (error) {
      console.error(`❌ Error playing notification sound for ${category}:`, error);
      // Fallback to system notification sound
      await this.playSystemNotificationSound();
    }
  }

  /**
   * Play default sound for a category
   */
  private static async playDefaultSound(category: ReportCategory): Promise<void> {
    try {
      const soundPath = this.DEFAULT_SOUNDS[category];
      if (soundPath) {
        const { sound } = await Audio.Sound.createAsync(soundPath);
        await sound.playAsync();
        console.log(`✅ Played default sound for ${category}`);

        // Clean up after playing
        setTimeout(async () => {
          await sound.unloadAsync();
        }, 3000);
      } else {
        await this.playSystemNotificationSound();
      }
    } catch (error) {
      console.warn(`⚠️ Failed to play default sound for ${category}, using system sound`);
      await this.playSystemNotificationSound();
    }
  }

  /**
   * Play system default notification sound
   */
  static async playSystemNotificationSound(): Promise<void> {
    try {
      // Use a simple beep sound for demonstration
      // In production, this would use platform-specific system sounds
      console.log('🔊 Playing system notification sound');

      // For demo purposes, we'll just log the sound play
      // The actual notification will be handled by the notification service
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error playing system notification sound:', error);
    }
  }

  /**
   * Preload all notification sounds
   */
  static async preloadSounds(): Promise<void> {
    try {
      console.log('🔊 Preloading notification sounds...');

      // Preload custom sound files
      for (const [category, soundPath] of Object.entries(this.DEFAULT_SOUNDS)) {
        if (soundPath) {
          try {
            const { sound } = await Audio.Sound.createAsync(soundPath);
            this.soundObjects.set(category, sound);
            console.log(`✅ Preloaded sound for ${category}`);
          } catch (error) {
            console.warn(`⚠️ Failed to preload sound for ${category}:`, error);
            // Fallback to system sound for this category
          }
        }
      }

      console.log('✅ Notification sounds preloaded');
    } catch (error) {
      console.error('❌ Error preloading sounds:', error);
    }
  }

  /**
   * Get available sounds for a category
   */
  static async getAvailableSounds(category: ReportCategory): Promise<NotificationSound[]> {
    try {
      const customSounds = await this.getCustomSounds();
      const categorySounds = customSounds.filter(sound => sound.category === category);
      
      // Add default sound
      const defaultSound = this.SOUND_METADATA[category];
      
      return [defaultSound, ...categorySounds];
    } catch (error) {
      console.error('❌ Error getting available sounds:', error);
      return [this.SOUND_METADATA[category]];
    }
  }

  /**
   * Get all custom sounds
   */
  static async getCustomSounds(): Promise<NotificationSound[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Error getting custom sounds:', error);
      return [];
    }
  }

  /**
   * Add custom sound
   */
  static async addCustomSound(sound: Omit<NotificationSound, 'id' | 'created_at'>): Promise<NotificationSound> {
    try {
      const customSounds = await this.getCustomSounds();
      
      const newSound: NotificationSound = {
        ...sound,
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        is_custom: true,
      };
      
      customSounds.push(newSound);
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(customSounds));
      
      console.log(`🔊 Added custom sound: ${newSound.name}`);
      return newSound;
    } catch (error) {
      console.error('❌ Error adding custom sound:', error);
      throw error;
    }
  }

  /**
   * Remove custom sound
   */
  static async removeCustomSound(soundId: string): Promise<void> {
    try {
      const customSounds = await this.getCustomSounds();
      const filteredSounds = customSounds.filter(sound => sound.id !== soundId);
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSounds));
      
      // Remove from loaded sounds
      this.soundObjects.delete(soundId);
      
      console.log(`🔊 Removed custom sound: ${soundId}`);
    } catch (error) {
      console.error('❌ Error removing custom sound:', error);
      throw error;
    }
  }

  /**
   * Test play a sound
   */
  static async testPlaySound(soundPath: string): Promise<void> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: soundPath });
      await sound.playAsync();
      
      // Unload after playing
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 3000);
      
      console.log('🔊 Test played sound');
    } catch (error) {
      console.error('❌ Error test playing sound:', error);
      throw error;
    }
  }

  /**
   * Get sound metadata
   */
  static getSoundMetadata(category: ReportCategory): NotificationSound {
    return this.SOUND_METADATA[category];
  }

  /**
   * Cleanup loaded sounds
   */
  static async cleanup(): Promise<void> {
    try {
      for (const [key, sound] of this.soundObjects.entries()) {
        await sound.unloadAsync();
      }
      this.soundObjects.clear();
      console.log('🔊 Cleaned up loaded sounds');
    } catch (error) {
      console.error('❌ Error cleaning up sounds:', error);
    }
  }

  /**
   * Set volume for notification sounds
   */
  static async setVolume(volume: number): Promise<void> {
    try {
      // Volume should be between 0.0 and 1.0
      const normalizedVolume = Math.max(0, Math.min(1, volume));
      
      for (const sound of this.soundObjects.values()) {
        await sound.setVolumeAsync(normalizedVolume);
      }
      
      console.log(`🔊 Set notification volume to ${normalizedVolume}`);
    } catch (error) {
      console.error('❌ Error setting volume:', error);
    }
  }

  /**
   * Check if sound file exists
   */
  static async validateSoundFile(filePath: string): Promise<boolean> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: filePath });
      await sound.unloadAsync();
      return true;
    } catch (error) {
      return false;
    }
  }
}
