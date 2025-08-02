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
      try {
        const { error: usersError } = await supabase
          .from('users')
          .select('id')
          .limit(1);

        const { error: reportsError } = await supabase
          .from('reports')
          .select('id')
          .limit(1);

        const { error: mediaError } = await supabase
          .from('media_files')
          .select('id')
          .limit(1);

        // If any table doesn't exist, we need to set up the database
        if (usersError?.code === '42P01' || reportsError?.code === '42P01' || mediaError?.code === '42P01') {
          console.log('Tables do not exist, database setup required');
          return false;
        }
      } catch (error) {
        console.error('Error checking tables:', error);
        return false;
      }

      // If we reach here, all tables exist and database is already initialized
      console.log('Database already initialized');
      return true;
    } catch (error) {
      console.error('Error during database initialization:', error);
      return false;
    }
  }

  // This function would handle the actual database setup
  // For now, we'll rely on manual setup via the database_schema.sql file
  static async setupDatabase(): Promise<boolean> {
    console.log('Database setup should be done manually using database_schema.sql file');
    console.log('Please run the SQL commands from database_schema.sql in your Supabase dashboard');
    return false;
  }
}