import { createClient } from '@supabase/supabase-js';
import { User, Report, MediaFile, NotificationPreferences } from '../types';

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  return SUPABASE_URL !== 'https://placeholder.supabase.co' &&
         SUPABASE_URL !== 'https://your-project-id.supabase.co' &&
         SUPABASE_ANON_KEY !== 'placeholder-key' &&
         !SUPABASE_ANON_KEY.includes('your_actual_key_here');
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class SupabaseService {
  static supabase = supabase;

  // Check if Supabase is configured
  static isConfigured() {
    return isSupabaseConfigured();
  }

  // Auth methods
  static async signUp(email: string, password: string, username?: string) {
    if (!this.isConfigured()) {
      return {
        data: null,
        error: { message: 'Supabase is not configured. Please set up your environment variables.' }
      };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });
    return { data, error };
  }

  static async signIn(email: string, password: string) {
    if (!this.isConfigured()) {
      return {
        data: null,
        error: { message: 'Supabase is not configured. Please set up your environment variables.' }
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }

  static async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  }

  // User profile methods
  static async createUserProfile(userId: string, email: string, username?: string) {
    const defaultPreferences: NotificationPreferences = {
      police_checkpoints: true,
      accidents: true,
      road_hazards: true,
      traffic_jams: true,
      weather_alerts: true,
      general_alerts: true,
    };

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          username,
          notification_radius: 5000, // 5km default
          notification_preferences: defaultPreferences,
        },
      ]);
    return { data, error };
  }

  static async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  }

  static async updateUserProfile(userId: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  }

  // Report methods
  static async createReport(report: Omit<Report, 'id' | 'timestamp' | 'status'>) {
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          ...report,
          status: 'active',
        },
      ])
      .select()
      .single();
    return { data, error };
  }

  static async getReports(limit = 50, offset = 0) {
    const { data, error } = await supabase
      .from('reports')
      .select(`
        *,
        user:users(id, username, avatar_url),
        media_files:media_files(*)
      `)
      .order('report_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    return { data, error };
  }

  static async getReportsByLocation(lat: number, lng: number, radius: number) {
    const { data, error } = await supabase
      .rpc('get_reports_within_radius', {
        lat_param: lat,
        lng_param: lng,
        radius_param: radius,
      });
    return { data, error };
  }

  static async updateReportStatus(reportId: string, status: Report['status']) {
    const { data, error } = await supabase
      .from('reports')
      .update({ status })
      .eq('id', reportId);
    return { data, error };
  }

  // Media methods
  static async uploadMedia(file: File, reportId: string, fileType: 'photo' | 'audio') {
    const fileName = `${reportId}_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('media')
      .upload(fileName, file);

    if (error) return { data: null, error };

    const { data: urlData } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    const { data: mediaRecord, error: mediaError } = await supabase
      .from('media_files')
      .insert([
        {
          report_id: reportId,
          file_type: fileType,
          file_url: urlData.publicUrl,
          file_name: fileName,
        },
      ])
      .select()
      .single();

    return { data: mediaRecord, error: mediaError };
  }

  // Real-time subscriptions
  static subscribeToReports(callback: (payload: any) => void) {
    return supabase
      .channel('reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
        },
        callback
      )
      .subscribe();
  }

  static subscribeToUserReports(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`user_reports_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }
} 