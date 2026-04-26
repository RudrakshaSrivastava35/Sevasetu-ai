import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check active sessions and sets the user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          if (sessionError.message?.includes('Failed to fetch')) {
            setError('Supabase connection failed. Please check your VITE_SUPABASE_URL in the Secrets panel.');
          } else {
            setError(sessionError.message);
          }
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (err.message?.includes('Failed to fetch')) {
          setError('Supabase connection failed. Please check your VITE_SUPABASE_URL in the Secrets panel.');
        }
        setLoading(false);
      }
    };

    initAuth();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-updates-${user.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${user.id}` 
      }, (payload) => {
        setProfile(payload.new as Profile);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1);

      if (error) throw error;
      setProfile(data?.[0] || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {error && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white p-4 text-center font-bold shadow-xl">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-4">
            <span>⚠️ {error}</span>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white text-red-600 rounded text-sm hover:bg-red-50 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
