import { supabase } from './supabase';
import { SupabaseService } from './supabase';

export class DatabaseInit {
  static async initializeDatabase() {
    try {
      console.log('Initializing database...');

      // Check if Supabase is configured
      if (!SupabaseService.isConfigured()) {
        console.log('Supabase is not configured - skipping database initialization');
        console.log('Please configure your Supabase environment variables in .env file');
        return false;
      }
      
      // Check if tables exist
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['users', 'reports', 'media_files']);

      if (tablesError) {
        console.error('Error checking tables:', tablesError);
        return false;
      }

      // If all tables exist, database is already initialized
      if (tables && tables.length === 3) {
        console.log('Database already initialized');
        return true;
      }

      console.log('Setting up database schema...');
      
      // Run the initialization SQL
      const { error } = await supabase.rpc('exec_sql', {
        sql: `
          -- Drop existing policies first (if they exist)
          DROP POLICY IF EXISTS "Anyone can view media files" ON storage.objects;
          DROP POLICY IF EXISTS "Authenticated users can upload media files" ON storage.objects;
          DROP POLICY IF EXISTS "Anyone can view media files" ON public.media_files;
          DROP POLICY IF EXISTS "Users can create media files" ON public.media_files;
          DROP POLICY IF EXISTS "Anyone can view active reports" ON public.reports;
          DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
          DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
          DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
          DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
          DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

          -- Drop existing triggers and functions
          DROP TRIGGER IF EXISTS update_reports_updated_at ON public.reports;
          DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
          DROP FUNCTION IF EXISTS update_updated_at_column();
          DROP FUNCTION IF EXISTS get_reports_within_radius(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

          -- Drop existing tables
          DROP TABLE IF EXISTS public.media_files CASCADE;
          DROP TABLE IF EXISTS public.reports CASCADE;
          DROP TABLE IF EXISTS public.users CASCADE;

          -- Enable necessary extensions
          CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

          -- Users table (extends Supabase auth.users)
          CREATE TABLE public.users (
              id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
              email TEXT NOT NULL,
              username TEXT,
              avatar_url TEXT,
              notification_radius INTEGER DEFAULT 5000,
              notification_preferences JSONB DEFAULT '{
                  "police_checkpoints": true,
                  "accidents": true,
                  "road_hazards": true,
                  "traffic_jams": true,
                  "weather_alerts": true,
                  "general_alerts": true
              }',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Reports table
          CREATE TABLE public.reports (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
              category TEXT NOT NULL CHECK (category IN ('police_checkpoint', 'accident', 'road_hazard', 'traffic_jam', 'weather_alert', 'general')),
              description TEXT NOT NULL,
              latitude DOUBLE PRECISION NOT NULL,
              longitude DOUBLE PRECISION NOT NULL,
              report_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'expired')),
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Media files table
          CREATE TABLE public.media_files (
              id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
              report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
              file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'audio')),
              file_url TEXT NOT NULL,
              file_name TEXT NOT NULL,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
          CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
          CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON public.reports(report_timestamp DESC);
          CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports USING GIST (point(latitude, longitude));
          CREATE INDEX IF NOT EXISTS idx_media_files_report_id ON public.media_files(report_id);

          -- Function to get reports within radius
          CREATE OR REPLACE FUNCTION get_reports_within_radius(
              lat_param DOUBLE PRECISION,
              lng_param DOUBLE PRECISION,
              radius_param DOUBLE PRECISION
          )
          RETURNS TABLE (
              id UUID,
              user_id UUID,
              category TEXT,
              description TEXT,
              latitude DOUBLE PRECISION,
              longitude DOUBLE PRECISION,
              report_timestamp TIMESTAMP WITH TIME ZONE,
              status TEXT,
              distance DOUBLE PRECISION
          )
          LANGUAGE plpgsql
          AS $$
          BEGIN
              RETURN QUERY
              SELECT 
                  r.id,
                  r.user_id,
                  r.category,
                  r.description,
                  r.latitude,
                  r.longitude,
                  r.report_timestamp,
                  r.status,
                  (
                      6371000 * acos(
                          cos(radians(lat_param)) * 
                          cos(radians(r.latitude)) * 
                          cos(radians(r.longitude) - radians(lng_param)) + 
                          sin(radians(lat_param)) * 
                          sin(radians(r.latitude))
                      )
                  ) AS distance
              FROM public.reports r
              WHERE r.status = 'active'
              AND (
                  6371000 * acos(
                      cos(radians(lat_param)) * 
                      cos(radians(r.latitude)) * 
                      cos(radians(r.longitude) - radians(lng_param)) + 
                      sin(radians(lat_param)) * 
                      sin(radians(r.latitude))
                  )
              ) <= radius_param
              ORDER BY distance;
          END;
          $$;

          -- Row Level Security (RLS) policies
          ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

          -- Users policies
          CREATE POLICY "Users can view their own profile" ON public.users
              FOR SELECT USING (auth.uid() = id);

          CREATE POLICY "Users can update their own profile" ON public.users
              FOR UPDATE USING (auth.uid() = id);

          CREATE POLICY "Users can insert their own profile" ON public.users
              FOR INSERT WITH CHECK (auth.uid() = id);

          -- Reports policies
          CREATE POLICY "Anyone can view active reports" ON public.reports
              FOR SELECT USING (status = 'active');

          CREATE POLICY "Users can create reports" ON public.reports
              FOR INSERT WITH CHECK (auth.uid() = user_id);

          CREATE POLICY "Users can update their own reports" ON public.reports
              FOR UPDATE USING (auth.uid() = user_id);

          -- Media files policies
          CREATE POLICY "Anyone can view media files" ON public.media_files
              FOR SELECT USING (true);

          CREATE POLICY "Users can create media files" ON public.media_files
              FOR INSERT WITH CHECK (
                  EXISTS (
                      SELECT 1 FROM public.reports 
                      WHERE id = report_id AND user_id = auth.uid()
                  )
              );

          -- Storage bucket for media files (only if it doesn't exist)
          INSERT INTO storage.buckets (id, name, public) 
          VALUES ('media', 'media', true)
          ON CONFLICT (id) DO NOTHING;

          -- Storage policies
          CREATE POLICY "Anyone can view media files" ON storage.objects
              FOR SELECT USING (bucket_id = 'media');

          CREATE POLICY "Authenticated users can upload media files" ON storage.objects
              FOR INSERT WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

          -- Triggers for updated_at
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
          END;
          $$ language 'plpgsql';

          CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

          CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON public.reports
              FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        `
      });

      if (error) {
        console.error('Error initializing database:', error);
        return false;
      }

      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Error in database initialization:', error);
      return false;
    }
  }
} 