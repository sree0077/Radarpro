import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase';
import { reportExpiryService } from '../services/reportExpiryService';
import { User as AppUser } from '../types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<AppUser>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = SupabaseService.supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadUserProfile(session.user.id);
          // Start expiry service when user logs in
          reportExpiryService.start();
        } else {
          setAppUser(null);
          // Stop expiry service when user logs out
          reportExpiryService.stop();
        }

        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { user } = await SupabaseService.getCurrentUser();
      setUser(user);
      
      if (user) {
        await loadUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await SupabaseService.getUserProfile(userId);
      if (error) {
        console.error('❌ Error loading user profile:', error);

        // If user profile doesn't exist, DO NOT create it automatically
        // This should only happen during signup, not login
        if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
          console.log('⚠️ User profile not found - user needs to sign up first');
          // Force logout since the user doesn't have a valid profile
          await SupabaseService.signOut();
          setUser(null);
          setAppUser(null);
        }
        return;
      }
      setAppUser(data);
    } catch (error) {
      console.error('❌ Error loading user profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await SupabaseService.signIn(email, password);
    return { error };
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await SupabaseService.signUp(email, password, username);

    if (!error && data.user) {
      console.log('🔧 Creating user profile for:', data.user.id);

      // Create user profile
      console.log('🔧 Creating user profile for:', data.user.id);

      const { data: profileData, error: profileError } = await SupabaseService.createUserProfile(
        data.user.id,
        email,
        username
      );

      if (profileError) {
        console.error('❌ Error creating user profile:', profileError);

        // If profile creation fails, clean up the auth user
        console.log('🧹 Profile creation failed, cleaning up auth user...');
        await SupabaseService.signOut();

        // If profile creation fails due to missing table, provide helpful message
        if (profileError.code === '42P01') {
          return {
            error: {
              message: 'Database not set up. Please contact administrator to set up the database tables.'
            }
          };
        }

        return {
          error: {
            message: 'Failed to create user profile. Please try again.'
          }
        };
      }

      console.log('✅ User profile created successfully');
      // Set the app user immediately after successful profile creation
      setAppUser(profileData);
    }

    return { error };
  };

  const signOut = async () => {
    await SupabaseService.signOut();
    setUser(null);
    setAppUser(null);
  };

  const updateUserProfile = async (updates: Partial<AppUser>) => {
    if (!user) return { error: new Error('No user logged in') };
    
    const { data, error } = await SupabaseService.updateUserProfile(user.id, updates);
    
    if (!error && data) {
      setAppUser(prev => prev ? { ...prev, ...updates } : null);
    }
    
    return { error };
  };

  const value: AuthContextType = {
    user,
    appUser,
    loading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 