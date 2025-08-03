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

    // First check if user profile already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, username')
      .eq('id', userId)
      .single();

    if (existingUser) {
      // If user exists but has no username, update it
      if (!existingUser.username && username) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ username })
          .eq('id', userId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating username:', updateError);
          return { data: existingUser, error: updateError };
        }

        return { data: updatedUser, error: null };
      }

      return { data: existingUser, error: null };
    }

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
      ])
      .select()
      .single();
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



  // Utility method to ensure all users have usernames
  static async ensureUserUsernames() {
    console.log('🔧 Ensuring all users have usernames...');
    
    // Get all users without usernames
    const { data: usersWithoutUsernames, error: fetchError } = await supabase
      .from('users')
      .select('id, email')
      .is('username', null);
    
    if (fetchError) {
      console.error('❌ Error fetching users without usernames:', fetchError);
      return { error: fetchError };
    }
    
    if (!usersWithoutUsernames || usersWithoutUsernames.length === 0) {
      console.log('✅ All users already have usernames');
      return { success: true };
    }
    
    console.log(`📝 Found ${usersWithoutUsernames.length} users without usernames`);
    
    // Update each user with a default username
    for (const user of usersWithoutUsernames) {
      const defaultUsername = user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ username: defaultUsername })
        .eq('id', user.id);
      
      if (updateError) {
        console.error(`❌ Error updating username for user ${user.id}:`, updateError);
      } else {
        console.log(`✅ Updated username for user ${user.id} to: ${defaultUsername}`);
      }
    }
    
    return { success: true };
  }

  static async updateUserProfile(userId: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  }

  // Report methods
  static async createReport(report: Omit<Report, 'id' | 'report_timestamp' | 'status' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          ...report,
          status: 'active',
        },
      ])
      .select(`
        *,
        user:users(id, username, avatar_url)
      `)
      .single();
    return { data, error };
  }

  static async getReports(limit = 50, offset = 0) {
    console.log('🔍 Fetching reports...');
    
    // First, get reports without user data
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('report_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return { data: null, error: reportsError };
    }
    
    if (!reports) {
      return { data: [], error: null };
    }
    
    console.log('📊 Reports fetched:', reports.length);
    
    // Then, fetch user data for each report
    const reportsWithUsers = await Promise.all(
      reports.map(async (report) => {
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, username, avatar_url')
            .eq('id', report.user_id)
            .single();
          
          if (userError) {
            console.error(`❌ Error fetching user data for report ${report.id}:`, userError);
            return {
              ...report,
              user: null,
              media_files: []
            };
          }
          
          // Log only if there's an issue
          if (!userData || !userData.username) {
            console.log(`⚠️ User data issue for report ${report.id}:`, {
              user_id: report.user_id,
              user: userData ? {
                id: userData.id,
                username: userData.username,
                hasUsername: !!userData.username
              } : 'NO USER DATA'
            });
          }
          
          // Fetch media files
          const { data: mediaFiles } = await supabase
            .from('media_files')
            .select('*')
            .eq('report_id', report.id);
          
          return {
            ...report,
            user: userData,
            media_files: mediaFiles || []
          };
        } catch (error) {
          console.error(`❌ Error processing report ${report.id}:`, error);
          return {
            ...report,
            user: null,
            media_files: []
          };
        }
      })
    );
    
    return { data: reportsWithUsers, error: null };
  }

  static async getReportById(reportId: string) {
    console.log('🔍 Fetching report by ID:', reportId);
    
    // First, get the report
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();
    
    if (reportError) {
      console.error('❌ Error fetching report:', reportError);
      return { data: null, error: reportError };
    }
    
    if (!report) {
      return { data: null, error: new Error('Report not found') };
    }
    
    // Then, fetch user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, username, avatar_url')
      .eq('id', report.user_id)
      .single();
    
    if (userError) {
      console.error('❌ Error fetching user data:', userError);
      return { data: null, error: userError };
    }
    
    // Fetch media files
    const { data: mediaFiles } = await supabase
      .from('media_files')
      .select('*')
      .eq('report_id', reportId);
    
    const reportWithUser = {
      ...report,
      user: userData,
      media_files: mediaFiles || []
    };
    
    console.log('✅ Report with user data:', {
      id: reportWithUser.id,
      user: reportWithUser.user ? {
        id: reportWithUser.user.id,
        username: reportWithUser.user.username,
        hasUsername: !!reportWithUser.user.username
      } : 'NO USER DATA'
    });
    
    return { data: reportWithUser, error: null };
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
    console.log('📡 Setting up real-time subscription for reports...');

    const channel = supabase
      .channel('reports')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
        },
        (payload) => {
          console.log('📡 Real-time payload received:', {
            event: payload.eventType,
            table: payload.table,
            reportId: payload.new?.id || payload.old?.id,
            status: payload.new?.status || payload.old?.status
          });
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });

    return channel;
  }

  static subscribeToUserReports(userId: string, callback: (payload: any) => void) {
    console.log('📡 Setting up real-time subscription for user reports:', userId);

    const channel = supabase
      .channel(`user_reports_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📡 User reports real-time payload received:', {
            event: payload.eventType,
            userId: userId,
            reportId: payload.new?.id || payload.old?.id
          });
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log('📡 User reports subscription status:', status);
      });

    return channel;
  }

  // Enhanced method for manual refresh with better error handling
  static async refreshReports(limit = 50, offset = 0) {
    console.log('🔄 Manual refresh triggered...');

    try {
      const result = await this.getActiveReports(limit, offset);

      if (result.error) {
        console.error('❌ Manual refresh failed:', result.error);
        throw new Error('Failed to refresh reports');
      }

      console.log('✅ Manual refresh completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Manual refresh error:', error);
      throw error;
    }
  }

  // Report expiry methods
  static async getActiveReports(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          user:users(id, username, avatar_url)
        `)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      return { data, error };
    } catch (error) {
      console.error('Error fetching active reports:', error);
      return { data: null, error };
    }
  }

  static async markReportsAsExpired(reportIds: string[]) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .in('id', reportIds)
        .select();

      return { data, error };
    } catch (error) {
      console.error('Error marking reports as expired:', error);
      return { data: null, error };
    }
  }

  static async deleteExpiredReports(olderThanHours = 24) {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      const { data, error } = await supabase
        .from('reports')
        .delete()
        .eq('status', 'expired')
        .lt('updated_at', cutoffTime.toISOString());

      return { data, error };
    } catch (error) {
      console.error('Error deleting expired reports:', error);
      return { data: null, error };
    }
  }
} 