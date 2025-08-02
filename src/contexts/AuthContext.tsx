import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase';
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
        } else {
          setAppUser(null);
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
        console.error('Error loading user profile:', error);
        return;
      }
      setAppUser(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await SupabaseService.signIn(email, password);
    return { error };
  };

  const signUp = async (email: string, password: string, username?: string) => {
    const { data, error } = await SupabaseService.signUp(email, password, username);
    
    if (!error && data.user) {
      // Create user profile
      await SupabaseService.createUserProfile(data.user.id, email, username);
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