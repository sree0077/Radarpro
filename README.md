# RadarPro - Community Safety & Information App

A React Native mobile application with Supabase backend for real-time community safety and information sharing. Users can report and receive alerts about various community events like police checkpoints, accidents, road hazards, traffic jams, and weather alerts.

## Features

### Core Functionality
- **User Authentication**: Secure registration and login using Supabase Auth
- **Event Reporting**: Submit reports for predefined categories with location and media
- **Real-time Updates**: Live synchronization across all users using Supabase real-time subscriptions
- **Media Support**: Photo capture/upload and voice message recording for each report

### Notification System
- **Push Notifications**: Custom notifications for different alert types
- **Custom Sounds**: Distinct audio files for each alert category (siren for police, crash for accidents, etc.)
- **Location-based Filtering**: Only show alerts within user-defined radius
- **Preference Management**: Enable/disable specific alert types

### User Interface
- **Interactive Map**: Display all active alerts with custom markers for each event type
- **Timeline Feed**: Chronological list of all alerts with timestamps and media
- **Report Submission**: Comprehensive form with category selection, description, location, and media
- **Profile Management**: User settings, notification preferences, and account management

## Tech Stack

- **Frontend**: React Native with Expo
- **Backend**: Supabase (PostgreSQL + Real-time + Auth + Storage)
- **Navigation**: React Navigation
- **UI Components**: React Native Paper
- **Maps**: React Native Maps
- **Notifications**: Expo Notifications
- **Media**: Expo Camera, Expo AV, Expo Image Picker
- **Location**: Expo Location

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Supabase account

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd radarpro
npm install
```

### 2. Supabase Setup

#### Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key

#### Database Schema
Run the following SQL in your Supabase SQL editor:

```sql
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
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
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
CREATE INDEX idx_reports_category ON public.reports(category);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_timestamp ON public.reports(timestamp DESC);
CREATE INDEX idx_reports_location ON public.reports USING GIST (point(latitude, longitude));
CREATE INDEX idx_media_files_report_id ON public.media_files(report_id);

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
    timestamp TIMESTAMP WITH TIME ZONE,
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
        r.timestamp,
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

-- Storage bucket for media files
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true);

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
```

#### Storage Setup
1. Create a storage bucket named `media` in your Supabase dashboard
2. Set the bucket to public
3. Configure the storage policies as shown in the SQL above

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_EXPO_PROJECT_ID=your_expo_project_id
```

Update the Supabase configuration in `src/services/supabase.ts`:

```typescript
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
```

### 4. Notification Setup

#### Expo Push Notifications
1. Create an Expo account and project
2. Get your Expo project ID
3. Update the project ID in `src/services/notificationService.ts`

#### Custom Sounds
Add custom sound files to your project:
- `siren.mp3` - Police checkpoints
- `crash.mp3` - Accidents
- `warning.mp3` - Road hazards
- `traffic.mp3` - Traffic jams
- `weather.mp3` - Weather alerts
- `default.mp3` - General alerts

### 5. Run the Application

```bash
# Start the development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ReportCard.tsx   # Report display component
│   └── ReportMarker.tsx # Map marker component
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Authentication context
├── navigation/          # Navigation configuration
│   └── AppNavigator.tsx # Main navigation setup
├── screens/             # Application screens
│   ├── AuthScreen.tsx   # Login/registration
│   ├── MapScreen.tsx    # Interactive map
│   ├── TimelineScreen.tsx # Report timeline
│   ├── NewReportScreen.tsx # Report submission
│   └── ProfileScreen.tsx # User profile
├── services/            # API and utility services
│   ├── supabase.ts      # Supabase client and methods
│   ├── notificationService.ts # Push notifications
│   └── locationService.ts # Geolocation utilities
└── types/               # TypeScript type definitions
    └── index.ts         # Application types
```

## Key Features Implementation

### Real-time Updates
The app uses Supabase real-time subscriptions to automatically update the map and timeline when new reports are created or existing ones are modified.

### Location-based Filtering
Users can set their notification radius and the app will only show alerts within that distance from their current location.

### Media Handling
- Photos are captured using the device camera or selected from the gallery
- Voice messages are recorded using the device microphone
- All media is uploaded to Supabase Storage and linked to reports

### Custom Notifications
Each alert type has its own custom sound and notification styling to help users quickly identify the type of alert.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please open an issue in the GitHub repository or contact the development team. 