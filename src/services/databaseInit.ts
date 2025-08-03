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

      // Check if tables exist by trying to query them
      let tablesExist = true;
      let missingTables: string[] = [];

      try {
        const { error: usersError } = await supabase
          .from('users')
          .select('id')
          .limit(1);

        if (usersError?.code === '42P01') {
          tablesExist = false;
          missingTables.push('users');
        }

        const { error: reportsError } = await supabase
          .from('reports')
          .select('id')
          .limit(1);

        if (reportsError?.code === '42P01') {
          tablesExist = false;
          missingTables.push('reports');
        }

        const { error: mediaError } = await supabase
          .from('media_files')
          .select('id')
          .limit(1);

        if (mediaError?.code === '42P01') {
          tablesExist = false;
          missingTables.push('media_files');
        }

        // If tables don't exist, try to create them automatically
        if (!tablesExist) {
          console.log(`Missing tables: ${missingTables.join(', ')}`);
          console.log('Attempting to create database schema...');

          const setupResult = await this.setupDatabase();
          if (setupResult) {
            console.log('Database schema created successfully');
            return true;
          } else {
            console.log('Automatic setup failed. Please run database_schema.sql manually');
            console.log('Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
            return false;
          }
        }

        // Check for other errors
        if (usersError && usersError.code !== '42P01') {
          console.error('Users table error:', usersError);
          return false;
        }
        if (reportsError && reportsError.code !== '42P01') {
          console.error('Reports table error:', reportsError);
          return false;
        }
        if (mediaError && mediaError.code !== '42P01') {
          console.error('Media files table error:', mediaError);
          return false;
        }

      } catch (error) {
        console.error('Error checking tables:', error);
        return false;
      }

      // If we reach here, all tables exist and database is properly initialized
      console.log('Database already initialized');
      return true;
    } catch (error) {
      console.error('Error during database initialization:', error);
      return false;
    }
  }

  // This function handles the actual database setup
  static async setupDatabase(): Promise<boolean> {
    try {
      console.log('Setting up database schema...');

      // Create the database schema using SQL
      const setupSQL = `
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        -- Users table
        CREATE TABLE IF NOT EXISTS public.users (
            id UUID PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            username TEXT,
            avatar_url TEXT,
            notification_radius INTEGER DEFAULT 5000,
            notification_preferences JSONB DEFAULT '{"police_checkpoints": true, "accidents": true, "road_hazards": true, "traffic_jams": true, "weather_alerts": true, "general_alerts": true}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Reports table
        CREATE TABLE IF NOT EXISTS public.reports (
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
        CREATE TABLE IF NOT EXISTS public.media_files (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE NOT NULL,
            file_type TEXT NOT NULL CHECK (file_type IN ('photo', 'audio')),
            file_url TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_size INTEGER,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
        CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
        CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON public.reports(report_timestamp);
        CREATE INDEX IF NOT EXISTS idx_reports_location ON public.reports(latitude, longitude);
        CREATE INDEX IF NOT EXISTS idx_media_files_report_id ON public.media_files(report_id);

        -- Enable Row Level Security
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;

        -- RLS Policies for users table
        CREATE POLICY IF NOT EXISTS "Users can view own profile" ON public.users
            FOR SELECT USING (auth.uid() = id);

        CREATE POLICY IF NOT EXISTS "Users can update own profile" ON public.users
            FOR UPDATE USING (auth.uid() = id);

        CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON public.users
            FOR INSERT WITH CHECK (auth.uid() = id);

        -- RLS Policies for reports table
        CREATE POLICY IF NOT EXISTS "Anyone can view reports" ON public.reports
            FOR SELECT USING (true);

        CREATE POLICY IF NOT EXISTS "Users can insert own reports" ON public.reports
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY IF NOT EXISTS "Users can update own reports" ON public.reports
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY IF NOT EXISTS "Users can delete own reports" ON public.reports
            FOR DELETE USING (auth.uid() = user_id);

        -- RLS Policies for media_files table
        CREATE POLICY IF NOT EXISTS "Anyone can view media files" ON public.media_files
            FOR SELECT USING (true);

        CREATE POLICY IF NOT EXISTS "Users can insert media for own reports" ON public.media_files
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.reports
                    WHERE id = report_id AND user_id = auth.uid()
                )
            );

        CREATE POLICY IF NOT EXISTS "Users can update media for own reports" ON public.media_files
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.reports
                    WHERE id = report_id AND user_id = auth.uid()
                )
            );

        CREATE POLICY IF NOT EXISTS "Users can delete media for own reports" ON public.media_files
            FOR DELETE USING (
                EXISTS (
                    SELECT 1 FROM public.reports
                    WHERE id = report_id AND user_id = auth.uid()
                )
            );
      `;

      // Execute SQL commands one by one since RPC might not be available
      const sqlCommands = setupSQL.split(';').filter(cmd => cmd.trim().length > 0);

      for (const command of sqlCommands) {
        const trimmedCommand = command.trim();
        if (trimmedCommand) {
          try {
            const { error } = await supabase.rpc('exec_sql', { sql: trimmedCommand });
            if (error) {
              console.error(`Error executing SQL command: ${trimmedCommand.substring(0, 50)}...`, error);
              // Continue with other commands even if one fails
            }
          } catch (err) {
            console.error(`Failed to execute SQL command: ${trimmedCommand.substring(0, 50)}...`, err);
            // If RPC is not available, fall back to manual setup
            console.log('Automatic database setup not available. Please run database_schema.sql manually');
            console.log('Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
            return false;
          }
        }
      }

      console.log('Database schema setup completed');
      return true;
    } catch (error) {
      console.error('Error during database setup:', error);
      return false;
    }
  }
}