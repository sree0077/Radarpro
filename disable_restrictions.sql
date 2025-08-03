-- Remove RLS policies and disable email confirmation
-- This script removes all Row Level Security restrictions to simplify authentication

-- Disable RLS on all tables
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view basic info of all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

DROP POLICY IF EXISTS "Anyone can view active reports" ON public.reports;
DROP POLICY IF EXISTS "Anyone can view reports" ON public.reports;
DROP POLICY IF EXISTS "Users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can update own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;

DROP POLICY IF EXISTS "Anyone can view media files" ON public.media_files;
DROP POLICY IF EXISTS "Users can create media files" ON public.media_files;
DROP POLICY IF EXISTS "Users can insert media for own reports" ON public.media_files;
DROP POLICY IF EXISTS "Users can update media for own reports" ON public.media_files;

-- Grant full access to authenticated and anonymous users
GRANT ALL PRIVILEGES ON public.users TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.reports TO anon, authenticated;
GRANT ALL PRIVILEGES ON public.media_files TO anon, authenticated;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'reports', 'media_files');

-- Show that no policies exist
SELECT COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'reports', 'media_files');
