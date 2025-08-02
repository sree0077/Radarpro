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

export interface Report {
  id: string;
  user_id: string;
  category: ReportCategory;
  description: string;
  latitude: number;
  longitude: number;
  report_timestamp: string;
  status: ReportStatus;
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