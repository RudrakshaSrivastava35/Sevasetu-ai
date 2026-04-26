/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import NGODashboard from './pages/dashboard/ngo/NGODashboard';
import VolunteerDashboard from './pages/dashboard/volunteer/VolunteerDashboard';
import UserDashboard from './pages/dashboard/user/UserDashboard';
import AddNeed from './pages/dashboard/ngo/AddNeed';
import TaskList from './pages/dashboard/volunteer/TaskList';
import RequestHelp from './pages/dashboard/user/RequestHelp';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole?: string }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // Admin bypass: allow rudrakshasri35@gmail.com to access any protected route
  if (profile?.email === 'rudrakshasri35@gmail.com') return <>{children}</>;
  
  if (allowedRole && profile?.role !== allowedRole) return <Navigate to="/" />;

  return <>{children}</>;
}

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { testConnection } from './lib/supabase';

const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL.startsWith('https://') &&
  !import.meta.env.VITE_SUPABASE_URL.includes('your-project.supabase.co')
);

function ConfigWarning() {
  const [showSql, setShowSql] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<'checking' | 'success' | 'failed' | 'idle'>('idle');
  const [connectionError, setConnectionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isSupabaseConfigured) {
      checkConnection();
    }
  }, []);

  async function checkConnection() {
    setConnectionStatus('checking');
    const result = await testConnection();
    if (result.success) {
      setConnectionStatus('success');
    } else {
      setConnectionStatus('failed');
      setConnectionError(result.error);
    }
  }
  
  // If Supabase is configured and connection is successful, only show the toggle button
  if (isSupabaseConfigured && connectionStatus === 'success' && !showSql) {
    return (
      <button 
        onClick={() => setShowSql(true)}
        className="fixed bottom-4 right-4 z-50 p-2 bg-amber-100 text-amber-800 rounded-full shadow-lg border border-amber-200 hover:bg-amber-200 transition-all"
        title="Database SQL Setup"
      >
        <AlertTriangle className="w-5 h-5" />
      </button>
    );
  }

  const sqlCommands = `-- Run this in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ngo', 'volunteer', 'user')),
  location TEXT,
  skills TEXT[],
  ngo_type TEXT,
   ngo_registration_number TEXT,
  ngo_document_url TEXT,
  ngo_website TEXT,
  verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected')),
  avg_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  positive_feedback_percent INTEGER DEFAULT 0,
  completed_tasks_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure columns exist in profiles table if it already exists
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ngo_registration_number') THEN
      ALTER TABLE profiles ADD COLUMN ngo_registration_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ngo_document_url') THEN
      ALTER TABLE profiles ADD COLUMN ngo_document_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ngo_website') THEN
      ALTER TABLE profiles ADD COLUMN ngo_website TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ngo_type') THEN
      ALTER TABLE profiles ADD COLUMN ngo_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='verification_status') THEN
      ALTER TABLE profiles ADD COLUMN verification_status TEXT DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Rejected'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avg_rating') THEN
      ALTER TABLE profiles ADD COLUMN avg_rating DECIMAL(3,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='total_reviews') THEN
      ALTER TABLE profiles ADD COLUMN total_reviews INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='positive_feedback_percent') THEN
      ALTER TABLE profiles ADD COLUMN positive_feedback_percent INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='completed_tasks_count') THEN
      ALTER TABLE profiles ADD COLUMN completed_tasks_count INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_verified') THEN
      ALTER TABLE profiles ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='latitude') THEN
      ALTER TABLE profiles ADD COLUMN latitude DECIMAL(9,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='longitude') THEN
      ALTER TABLE profiles ADD COLUMN longitude DECIMAL(9,6);
    END IF;

    -- Ensure id is Primary Key and unique
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='profiles' AND constraint_type='PRIMARY KEY'
    ) THEN
        -- Keep only one row per ID if duplicates exist
        DELETE FROM profiles a USING profiles b 
        WHERE a.id = b.id AND a.created_at > b.created_at;
        
        ALTER TABLE profiles ADD PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  need_id UUID REFERENCES needs(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  sentiment_type TEXT CHECK (sentiment_type IN ('Positive', 'Neutral', 'Negative')),
  sentiment_score DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure columns exist in needs table if it already exists
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='needs') THEN
    CREATE TABLE needs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('medical', 'education', 'food', 'social')),
      location TEXT NOT NULL,
      urgency TEXT NOT NULL CHECK (urgency IN ('Low', 'Medium', 'High')),
      status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Assigned', 'Completed')),
      assigned_volunteer_id UUID REFERENCES profiles(id),
      ngo_id UUID REFERENCES profiles(id),
      user_id UUID REFERENCES profiles(id),
      proof_images TEXT[],
      accepted_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
      is_deleted BOOLEAN DEFAULT false,
      deleted_at TIMESTAMP WITH TIME ZONE,
      auto_delete_at TIMESTAMP WITH TIME ZONE,
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6)
    );
  ELSE
    -- Add missing columns to existing table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='proof_images') THEN
      ALTER TABLE needs ADD COLUMN proof_images TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='accepted_at') THEN
      ALTER TABLE needs ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='completed_at') THEN
      ALTER TABLE needs ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='user_id') THEN
      ALTER TABLE needs ADD COLUMN user_id UUID REFERENCES profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='ngo_id') THEN
      ALTER TABLE needs ADD COLUMN ngo_id UUID REFERENCES profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='proof_submitted') THEN
      ALTER TABLE needs ADD COLUMN proof_submitted BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='proof_verified') THEN
      ALTER TABLE needs ADD COLUMN proof_verified BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='is_deleted') THEN
      ALTER TABLE needs ADD COLUMN is_deleted BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='deleted_at') THEN
      ALTER TABLE needs ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='auto_delete_at') THEN
      ALTER TABLE needs ADD COLUMN auto_delete_at TIMESTAMP WITH TIME ZONE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='latitude') THEN
      ALTER TABLE needs ADD COLUMN latitude DECIMAL(9,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='longitude') THEN
      ALTER TABLE needs ADD COLUMN longitude DECIMAL(9,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='donation_enabled') THEN
      ALTER TABLE needs ADD COLUMN donation_enabled BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='target_amount') THEN
      ALTER TABLE needs ADD COLUMN target_amount DECIMAL(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='needs' AND column_name='raised_amount') THEN
      ALTER TABLE needs ADD COLUMN raised_amount DECIMAL(12,2) DEFAULT 0;
    END IF;

    -- Update category constraint
    ALTER TABLE needs DROP CONSTRAINT IF EXISTS needs_category_check;

    -- Sanitize categories before applying new constraint
    UPDATE needs SET category = LOWER(category);
    UPDATE needs SET category = 'social' WHERE category NOT IN ('medical', 'food', 'education', 'social');
    
    -- Update profiles ngo_type to lowercase
    UPDATE profiles SET ngo_type = LOWER(ngo_type) WHERE role = 'ngo';
    UPDATE profiles SET ngo_type = 'social' WHERE (ngo_type IS NULL OR ngo_type NOT IN ('medical', 'food', 'education', 'social')) AND role = 'ngo';

    -- Apply new category constraint
    ALTER TABLE needs ADD CONSTRAINT needs_category_check CHECK (category IN ('medical', 'food', 'education', 'social'));

    -- Add soft delete to jobs if it already exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='jobs') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='is_deleted') THEN
        ALTER TABLE jobs ADD COLUMN is_deleted BOOLEAN DEFAULT false;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='deleted_at') THEN
        ALTER TABLE jobs ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='jobs' AND column_name='auto_delete_at') THEN
        ALTER TABLE jobs ADD COLUMN auto_delete_at TIMESTAMP WITH TIME ZONE;
      END IF;
    END IF;

    -- Add missing columns to job_applications if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='job_applications') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='job_applications' AND column_name='resume_url') THEN
        ALTER TABLE job_applications ADD COLUMN resume_url TEXT;
      END IF;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS task_proofs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES needs(id) ON DELETE CASCADE,
  volunteer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  distance DECIMAL(10,2),
  verification_status TEXT NOT NULL DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified', 'Suspicious', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  need_id UUID REFERENCES needs(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Update task_proofs if it already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='task_proofs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_proofs' AND column_name='latitude') THEN
      ALTER TABLE task_proofs ADD COLUMN latitude DECIMAL(9,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_proofs' AND column_name='longitude') THEN
      ALTER TABLE task_proofs ADD COLUMN longitude DECIMAL(9,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_proofs' AND column_name='distance') THEN
      ALTER TABLE task_proofs ADD COLUMN distance DECIMAL(10,2);
    END IF;
    -- Add distance constraint to task_proofs
    ALTER TABLE task_proofs DROP CONSTRAINT IF EXISTS task_proofs_verification_status_check;
    ALTER TABLE task_proofs ADD CONSTRAINT task_proofs_verification_status_check CHECK (verification_status IN ('Pending', 'Verified', 'Suspicious', 'Rejected'));
  END IF;
END $$;

-- Update notifications if it already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notifications' AND column_name='task_id') THEN
      ALTER TABLE notifications ADD COLUMN task_id UUID REFERENCES needs(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Triggers for automatic profile metric updates
CREATE OR REPLACE FUNCTION update_volunteer_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_volunteer_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT assigned_volunteer_id INTO v_volunteer_id FROM needs WHERE id = OLD.task_id;
    ELSE
        SELECT assigned_volunteer_id INTO v_volunteer_id FROM needs WHERE id = NEW.task_id;
    END IF;

    IF v_volunteer_id IS NOT NULL THEN
        UPDATE profiles
        SET 
            avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews r JOIN needs n ON r.task_id = n.id WHERE n.assigned_volunteer_id = v_volunteer_id),
            total_reviews = (SELECT COUNT(*) FROM reviews r JOIN needs n ON r.task_id = n.id WHERE n.assigned_volunteer_id = v_volunteer_id),
            positive_feedback_percent = (
                SELECT COALESCE(ROUND(COUNT(CASE WHEN rating >= 4 THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0)
                FROM reviews r 
                JOIN needs n ON r.task_id = n.id 
                WHERE n.assigned_volunteer_id = v_volunteer_id
            )
        WHERE id = v_volunteer_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_review_change ON reviews;
CREATE TRIGGER on_review_change
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_volunteer_metrics();

CREATE OR REPLACE FUNCTION update_volunteer_task_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'Completed' AND (OLD.status IS NULL OR OLD.status != 'Completed')) OR 
       (OLD.status = 'Completed' AND NEW.status != 'Completed') THEN
        
        IF NEW.assigned_volunteer_id IS NOT NULL THEN
            UPDATE profiles
            SET completed_tasks_count = (SELECT COUNT(*) FROM needs WHERE assigned_volunteer_id = NEW.assigned_volunteer_id AND status = 'Completed')
            WHERE id = NEW.assigned_volunteer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_task_status_change ON needs;
CREATE TRIGGER on_task_status_change
AFTER UPDATE ON needs
FOR EACH ROW EXECUTE FUNCTION update_volunteer_task_count();

CREATE OR REPLACE FUNCTION update_ngo_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_ngo_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN v_ngo_id := OLD.ngo_id; ELSE v_ngo_id := NEW.ngo_id; END IF;

    UPDATE profiles
    SET 
        avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM feedback WHERE ngo_id = v_ngo_id),
        total_reviews = (SELECT COUNT(*) FROM feedback WHERE ngo_id = v_ngo_id),
        positive_feedback_percent = (
            SELECT COALESCE(ROUND(COUNT(CASE WHEN sentiment_type = 'Positive' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0)
            FROM feedback 
            WHERE ngo_id = v_ngo_id
        )
    WHERE id = v_ngo_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_feedback_change ON feedback;
CREATE TRIGGER on_feedback_change
AFTER INSERT OR UPDATE OR DELETE ON feedback
FOR EACH ROW EXECUTE FUNCTION update_ngo_metrics();

CREATE OR REPLACE FUNCTION update_user_metrics()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN v_user_id := OLD.user_id; ELSE v_user_id := NEW.user_id; END IF;

    IF v_user_id IS NOT NULL THEN
        UPDATE profiles
        SET 
            positive_feedback_percent = (
                SELECT COALESCE(ROUND(COUNT(CASE WHEN status = 'Completed' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)), 0)
                FROM needs 
                WHERE user_id = v_user_id AND is_deleted = false
            )
        WHERE id = v_user_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_task_change ON needs;
CREATE TRIGGER on_user_task_change
AFTER INSERT OR UPDATE OR DELETE ON needs
FOR EACH ROW EXECUTE FUNCTION update_user_metrics();

CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES needs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES needs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  skills_required TEXT[],
  location TEXT NOT NULL,
  ngo_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  auto_delete_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  skills TEXT NOT NULL,
  experience TEXT NOT NULL,
  why_join TEXT NOT NULL,
  resume_url TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Note: Ensure 'resumes' bucket exists in your Supabase Storage.
-- Set bucket to Public: False (for security) and add appropriate policies.

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Basic Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON profiles;
DROP POLICY IF EXISTS "Admin profile access for rudrakshasri35" ON profiles;
DROP POLICY IF EXISTS "Admin profile access sevasetu" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile." ON profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin profile access sevasetu" ON profiles FOR ALL 
  USING (auth.jwt() ->> 'email' = 'admin@sevasetu.com');
CREATE POLICY "Users can delete their own profile." ON profiles FOR DELETE USING (auth.uid() = id);

-- Needs Policies
DROP POLICY IF EXISTS "Needs are viewable by everyone." ON needs;
DROP POLICY IF EXISTS "Authenticated users can insert needs." ON needs;
DROP POLICY IF EXISTS "Volunteers can accept pending needs." ON needs;
DROP POLICY IF EXISTS "Assigned volunteers can update their tasks." ON needs;
DROP POLICY IF EXISTS "NGOs can update their own needs." ON needs;
DROP POLICY IF EXISTS "Users can update their own needs." ON needs;
DROP POLICY IF EXISTS "NGOs can delete their own needs." ON needs;
DROP POLICY IF EXISTS "Users can delete their own needs." ON needs;
DROP POLICY IF EXISTS "Volunteers can delete assigned needs." ON needs;
DROP POLICY IF EXISTS "Volunteers can update assigned needs." ON needs;
DROP POLICY IF EXISTS "Users can manage their own needs" ON needs;
DROP POLICY IF EXISTS "NGOs can manage their own needs" ON needs;
DROP POLICY IF EXISTS "Volunteers can manage assigned tasks" ON needs;
DROP POLICY IF EXISTS "Volunteers can accept pending needs" ON needs;
DROP POLICY IF EXISTS "Admin access for rudrakshasri35" ON needs;
DROP POLICY IF EXISTS "Admin access sevasetu" ON needs;

CREATE POLICY "Needs are viewable by everyone." ON needs FOR SELECT USING (true);
CREATE POLICY "Users can manage their own needs" ON needs FOR ALL 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "NGOs can manage their own needs" ON needs FOR ALL 
  USING (auth.uid() = ngo_id) 
  WITH CHECK (auth.uid() = ngo_id);
CREATE POLICY "Volunteers can manage assigned tasks" ON needs FOR ALL 
  USING (auth.uid() = assigned_volunteer_id) 
  WITH CHECK (auth.uid() = assigned_volunteer_id);
CREATE POLICY "Volunteers can accept pending needs" ON needs FOR UPDATE 
  USING (status = 'Pending') 
  WITH CHECK (status = 'Assigned' AND assigned_volunteer_id = auth.uid());
CREATE POLICY "Admin access sevasetu" ON needs FOR ALL 
  USING (auth.jwt() ->> 'email' = 'admin@sevasetu.com');

-- Reviews Policies
DROP POLICY IF EXISTS "Reviews are viewable by everyone." ON reviews;
DROP POLICY IF EXISTS "Users can insert reviews for their own tasks." ON reviews;
CREATE POLICY "Reviews are viewable by everyone." ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert reviews for their own tasks." ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs Policies
DROP POLICY IF EXISTS "Jobs are viewable by everyone." ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs." ON jobs;
DROP POLICY IF EXISTS "NGOs can update their own jobs." ON jobs;
DROP POLICY IF EXISTS "NGOs can delete their own jobs." ON jobs;
DROP POLICY IF EXISTS "NGOs can manage their own jobs" ON jobs;

CREATE POLICY "Jobs are viewable by everyone." ON jobs FOR SELECT USING (true);
CREATE POLICY "NGOs can manage their own jobs" ON jobs FOR ALL 
  USING (auth.uid() = ngo_id) 
  WITH CHECK (auth.uid() = ngo_id);

-- Applications Policies
DROP POLICY IF EXISTS "NGOs can view applications for their jobs" ON job_applications;
DROP POLICY IF EXISTS "Users can apply for jobs" ON job_applications;
DROP POLICY IF EXISTS "NGOs can update applications for their jobs" ON job_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can delete their own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can withdraw their applications" ON job_applications;
DROP POLICY IF EXISTS "Users can manage their own applications" ON job_applications;
DROP POLICY IF EXISTS "NGOs can manage applications for their jobs" ON job_applications;
DROP POLICY IF EXISTS "NGOs can update application status" ON job_applications;

CREATE POLICY "Users can apply for jobs" ON job_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own applications" ON job_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own applications" ON job_applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "NGOs can view applications for their jobs" ON job_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_applications.job_id AND jobs.ngo_id = auth.uid()));

CREATE POLICY "NGOs can update applications for their jobs" ON job_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_applications.job_id AND jobs.ngo_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_applications.job_id AND jobs.ngo_id = auth.uid()));

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications." ON notifications;
DROP POLICY IF EXISTS "System can insert notifications." ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications." ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications." ON notifications;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "Users can manage their own notifications" ON notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT
  WITH CHECK (true);

-- Donations Policies
DROP POLICY IF EXISTS "Donations are viewable by everyone." ON donations;
DROP POLICY IF EXISTS "Users can insert their own donations." ON donations;
DROP POLICY IF EXISTS "Users can delete their own donations." ON donations;
DROP POLICY IF EXISTS "Donations are viewable by everyone" ON donations;
DROP POLICY IF EXISTS "Users can manage their own donations" ON donations;

CREATE POLICY "Donations are viewable by everyone" ON donations FOR SELECT USING (true);
CREATE POLICY "Users can manage their own donations" ON donations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Feedback Policies
DROP POLICY IF EXISTS "Feedback is viewable by everyone." ON feedback;
DROP POLICY IF EXISTS "Users can insert feedback." ON feedback;
CREATE POLICY "Feedback is viewable by everyone." ON feedback FOR SELECT USING (true);
CREATE POLICY "Users can insert feedback." ON feedback FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Task Proofs Policies
DROP POLICY IF EXISTS "Task proofs are viewable by assigned NGO and volunteer." ON task_proofs;
DROP POLICY IF EXISTS "Volunteers can insert their own task proofs." ON task_proofs;
DROP POLICY IF EXISTS "NGOs can update task proof status." ON task_proofs;

CREATE POLICY "Task proofs are viewable by assigned NGO and volunteer." ON task_proofs FOR SELECT USING (
  auth.uid() = volunteer_id OR 
  EXISTS (SELECT 1 FROM needs WHERE needs.id = task_id AND needs.ngo_id = auth.uid())
);
CREATE POLICY "Volunteers can insert their own task proofs." ON task_proofs FOR INSERT WITH CHECK (auth.uid() = volunteer_id);
CREATE POLICY "NGOs can update task proof status." ON task_proofs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM needs WHERE needs.id = task_id AND needs.ngo_id = auth.uid())
);

-- 6. Storage Setup (Run these to fix "Bucket not found" errors)
INSERT INTO storage.buckets (id, name, public)
VALUES ('proof-images', 'proof-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-proofs', 'task-proofs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('ngo-documents', 'ngo-documents', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('proof-images', 'task-proofs', 'ngo-documents', 'resumes'));
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('proof-images', 'task-proofs', 'ngo-documents', 'resumes') AND auth.role() = 'authenticated');
`;

  return (
    <div className={`p-4 border-b ${connectionStatus === 'failed' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 shrink-0 ${connectionStatus === 'failed' ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="text-sm font-medium flex-1">
            {!isSupabaseConfigured ? (
              <><strong>Supabase is not configured.</strong> Please set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the <strong>Secrets</strong> panel.</>
            ) : connectionStatus === 'checking' ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testing Supabase connection...</span>
              </div>
            ) : connectionStatus === 'failed' ? (
              <div className="space-y-1">
                <p><strong>Connection Failed:</strong> {connectionError}</p>
                <div className="text-xs space-y-1 opacity-90">
                  <p>• Make sure your project is <strong>unpaused</strong> in the Supabase Dashboard.</p>
                  <p>• Check the <strong>Secrets</strong> panel for typos or extra spaces.</p>
                </div>
              </div>
            ) : (
              <><strong>Database Schema Required.</strong> If you see "table not found" errors, you need to set up your Supabase tables.</>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isSupabaseConfigured && connectionStatus === 'failed' && (
              <button 
                onClick={checkConnection}
                className="text-xs font-bold underline uppercase tracking-wider hover:opacity-75"
              >
                Retry Connection
              </button>
            )}
            <button 
              onClick={() => setShowSql(!showSql)}
              className="text-xs font-bold underline uppercase tracking-wider hover:opacity-75"
            >
              {showSql ? 'Hide SQL' : 'Show SQL Setup'}
            </button>
          </div>
        </div>
        
        {showSql && (
          <div className="mt-2">
            <p className="text-xs mb-2 font-bold">Troubleshooting Tips:</p>
            <ul className="text-[10px] list-disc list-inside mb-4 space-y-1">
              <li><strong>Table not found?</strong> Run the SQL script below in your Supabase SQL Editor.</li>
              <li><strong>Email rate limit exceeded?</strong> Go to <strong>Authentication &gt; Providers &gt; Email</strong> in Supabase and disable <strong>"Confirm email"</strong> for instant registration.</li>
            </ul>
            <p className="text-xs mb-2 font-bold">Copy and run this in your Supabase SQL Editor:</p>
            <pre className="bg-amber-100 p-4 rounded-lg text-[10px] font-mono overflow-x-auto whitespace-pre">
              {sqlCommands}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

import NGODashboardLayout from './components/NGODashboardLayout';
import ManageNeeds from './pages/dashboard/ngo/ManageNeeds';
import TaskProofs from './pages/dashboard/ngo/TaskProofs';
import JobPosting from './pages/dashboard/ngo/JobPosting';
import JobRequests from './pages/dashboard/ngo/JobRequests';
import NGOProfile from './pages/dashboard/ngo/NGOProfile';

import VolunteerDashboardLayout from './components/VolunteerDashboardLayout';
import AvailableTasks from './pages/dashboard/volunteer/AvailableTasks';
import MyTasks from './pages/dashboard/volunteer/MyTasks';
import VolunteerNotifications from './pages/dashboard/volunteer/VolunteerNotifications';
import VolunteerProfile from './pages/dashboard/volunteer/VolunteerProfile';

import UserDashboardLayout from './components/UserDashboardLayout';
import MyRequests from './pages/dashboard/user/MyRequests';
import Donation from './pages/dashboard/user/Donation';
import Jobs from './pages/dashboard/user/Jobs';
import UserProfile from './pages/dashboard/user/UserProfile';

import MyApplications from './pages/dashboard/user/MyApplications';
import Leaderboard from './pages/Leaderboard';
import NGOFeedback from './pages/dashboard/ngo/NGOFeedback';
import NGONotifications from './pages/dashboard/ngo/NGONotifications';
import NGORecycleBin from './pages/dashboard/ngo/RecycleBin';
import AdminVerification from './pages/dashboard/admin/AdminVerification';
import VolunteerRecycleBin from './pages/dashboard/volunteer/RecycleBin';
import UserRecycleBin from './pages/dashboard/user/RecycleBin';
import UserNotifications from './pages/dashboard/user/UserNotifications';
import RealTimeNotifications from './components/RealTimeNotifications';

import { LanguageProvider } from './contexts/LanguageContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Toaster position="top-right" />
        <RealTimeNotifications />
        <Router>
          <ConfigWarning />
          <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          
          {/* NGO Routes with Sidebar Layout */}
          <Route path="/dashboard/ngo" element={
            <ProtectedRoute allowedRole="ngo">
              <NGODashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<NGODashboard />} />
            <Route path="notifications" element={<NGONotifications />} />
            <Route path="add-need" element={<AddNeed />} />
            <Route path="manage-needs" element={<ManageNeeds />} />
            <Route path="task-proofs" element={<TaskProofs />} />
            <Route path="jobs" element={<JobPosting />} />
            <Route path="job-requests" element={<JobRequests />} />
            <Route path="feedback" element={<NGOFeedback />} />
            <Route path="profile" element={<NGOProfile />} />
            <Route path="recycle-bin" element={<NGORecycleBin />} />
            <Route path="admin-verification" element={<AdminVerification />} />
          </Route>

          {/* Volunteer Routes with Sidebar Layout */}
          <Route path="/dashboard/volunteer" element={
            <ProtectedRoute allowedRole="volunteer">
              <VolunteerDashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<VolunteerDashboard />} />
            <Route path="tasks" element={<AvailableTasks />} />
            <Route path="notifications" element={<VolunteerNotifications />} />
            <Route path="my-tasks" element={<MyTasks />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="applications" element={<MyApplications />} />
            <Route path="profile" element={<VolunteerProfile />} />
            <Route path="recycle-bin" element={<VolunteerRecycleBin />} />
            <Route path="admin-verification" element={<AdminVerification />} />
          </Route>

          {/* User Routes with Sidebar Layout */}
          <Route path="/dashboard/user" element={
            <ProtectedRoute allowedRole="user">
              <UserDashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<UserDashboard />} />
            <Route path="notifications" element={<UserNotifications />} />
            <Route path="request" element={<RequestHelp />} />
            <Route path="requests" element={<MyRequests />} />
            <Route path="donate" element={<Donation />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="applications" element={<MyApplications />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="recycle-bin" element={<UserRecycleBin />} />
            <Route path="admin-verification" element={<AdminVerification />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
    </LanguageProvider>
  );
}
