-- RadarPro Database Setup with Automatic User Profile Creation
-- This SQL script sets up database triggers to automatically create user profiles
-- when users sign up, bypassing RLS policy issues during the signup process.

-- First, let's create a function that will automatically create user profiles
-- when a new user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, notification_radius, notification_preferences)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    5000,
    '{
      "police_checkpoints": true,
      "accidents": true,
      "road_hazards": true,
      "traffic_jams": true,
      "weather_alerts": true,
      "general_alerts": true
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that will call this function whenever a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies to be more permissive for viewing user data
-- This allows the timeline to show usernames from other users
DROP POLICY IF EXISTS "Users can view basic info of all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

CREATE POLICY "Users can view basic info of all users" ON public.users
    FOR SELECT USING (true);

-- Keep the existing policies for updates and inserts
-- (though inserts will now primarily happen via trigger)
CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Ensure reports policies allow viewing reports with user data
DROP POLICY IF EXISTS "Anyone can view active reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;

CREATE POLICY "Anyone can view active reports" ON public.reports
    FOR SELECT USING (status = 'active');

-- Keep existing report creation and update policies
CREATE POLICY IF NOT EXISTS "Users can create reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own reports" ON public.reports
    FOR UPDATE USING (auth.uid() = user_id);

-- Media files policies
CREATE POLICY IF NOT EXISTS "Anyone can view media files" ON public.media_files
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can create media files" ON public.media_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports 
            WHERE id = report_id AND user_id = auth.uid()
        )
    );

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.reports TO anon, authenticated;
GRANT ALL ON public.media_files TO anon, authenticated;

-- Test the trigger by checking if it exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Show current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('users', 'reports', 'media_files') 
AND schemaname = 'public'
ORDER BY tablename, policyname;
