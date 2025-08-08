export interface User {
  id: string;
  email: string;
  username?: string;
  avatar_url?: string;
  notification_radius: number;
  notification_preferences: NotificationPreferences;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  police_checkpoints: boolean;
  accidents: boolean;
  road_hazards: boolean;
  traffic_jams: boolean;
  weather_alerts: boolean;
  general_alerts: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
  custom_sound?: string;
  frequency: NotificationFrequency;
  display_duration: number; // in seconds
  show_in_app: boolean;
  show_system: boolean;
  priority: NotificationPriority;
}

export interface ComprehensiveNotificationPreferences {
  police_checkpoints: NotificationSettings;
  accidents: NotificationSettings;
  road_hazards: NotificationSettings;
  traffic_jams: NotificationSettings;
  weather_alerts: NotificationSettings;
  general_alerts: NotificationSettings;
  global_settings: GlobalNotificationSettings;
}

export interface GlobalNotificationSettings {
  master_enabled: boolean;
  quiet_hours: QuietHours;
  location_based: boolean;
  notification_radius: number;
  batch_notifications: boolean;
  auto_cleanup_days: number;
}

export interface QuietHours {
  enabled: boolean;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  days: number[]; // 0-6 (Sunday-Saturday)
}

export type NotificationFrequency = 'immediate' | 'every_5min' | 'every_15min' | 'hourly' | 'daily';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationStatus = 'unread' | 'read' | 'dismissed' | 'archived';

export interface Report {
  id: string;
  user_id: string;
  category: ReportCategory;
  description: string;
  latitude: number;
  longitude: number;
  report_timestamp: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  media_files?: MediaFile[];
  user?: User;
}

export type ReportCategory = 
  | 'police_checkpoint'
  | 'accident'
  | 'road_hazard'
  | 'traffic_jam'
  | 'weather_alert'
  | 'general';

export type ReportStatus = 'active' | 'resolved' | 'expired';

export interface MediaFile {
  id: string;
  report_id: string;
  file_type: 'photo' | 'audio';
  file_url: string;
  file_name: string;
  created_at: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: any;
  sound?: string;
}

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  category: ReportCategory;
  report_id?: string;
  user_id?: string;
  username?: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  created_at: string;
  read_at?: string;
  dismissed_at?: string;
  archived_at?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  metadata?: {
    sound_played: boolean;
    vibration_played: boolean;
    display_duration: number;
    retry_count: number;
    delivery_method: 'in_app' | 'system' | 'both';
  };
}

export interface NotificationHistory {
  notifications: StoredNotification[];
  total_count: number;
  unread_count: number;
  last_cleanup: string;
}

export interface NotificationBatch {
  id: string;
  category: ReportCategory;
  notifications: StoredNotification[];
  created_at: string;
  summary: string;
}

export interface NotificationSound {
  id: string;
  name: string;
  category: ReportCategory;
  file_path: string;
  duration: number;
  is_custom: boolean;
  created_at: string;
}