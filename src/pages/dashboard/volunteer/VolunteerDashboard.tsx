import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Search, CheckCircle2, AlertCircle, Clock, MapPin, ArrowRight, Briefcase, User, Trophy, Star, ShieldCheck, Info } from 'lucide-react';
import type { Need } from '../../../types';

import { useLanguage } from '../../../contexts/LanguageContext';

export default function VolunteerDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({ available: 0, active: 0, completed: 0, applications: 0 });
  const [recentTasks, setRecentTasks] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [availableRes, activeRes, completedRes, recentRes, appsRes] = await Promise.all([
        supabase.from('needs').select('id', { count: 'exact', head: true }).eq('status', 'Pending').eq('is_deleted', false),
        supabase.from('needs').select('id', { count: 'exact', head: true }).eq('assigned_volunteer_id', profile?.id).eq('status', 'Assigned').eq('is_deleted', false),
        supabase.from('needs').select('id', { count: 'exact', head: true }).eq('assigned_volunteer_id', profile?.id).eq('status', 'Completed').eq('is_deleted', false),
        supabase.from('needs').select('*, profiles:ngo_id(name)').eq('assigned_volunteer_id', profile?.id).eq('is_deleted', false).order('created_at', { ascending: false }).limit(3),
        supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('user_id', profile?.id)
      ]);

      setStats({
        available: availableRes.count || 0,
        active: activeRes.count || 0,
        completed: completedRes.count || 0,
        applications: appsRes.count || 0
      });
      console.log('Volunteer Dashboard Stats:', {
        available: availableRes.count,
        active: activeRes.count,
        completed: completedRes.count,
        applications: appsRes.count
      });
      console.log('Recent Tasks:', recentRes.data);
      setRecentTasks(recentRes.data || []);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button 
            onClick={fetchData}
            className="text-xs font-bold underline uppercase tracking-wider hover:text-red-900"
          >
            {t('common_retry')}
          </button>
        </div>
      )}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('nav_dashboard')}</h1>
        <p className="text-gray-600">{t('dash_welcome_back')}, {profile?.name}. {t('dash_ready_impact')}</p>
      </div>

      {/* Volunteer Profile & Trust Score Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
              <User className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-bold text-gray-900">{profile?.name}</h2>
                <ShieldCheck className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-gray-500 font-medium">{profile?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-green-100">
                  {t('dash_verified_vol')}
                </span>
                {profile?.location && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="w-3 h-3" /> {profile.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center md:justify-end gap-12 border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-12 w-full md:w-auto">
            <div className="text-center group">
              <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                <Star className="w-4 h-4 fill-current" />
                <p className="text-2xl font-bold text-gray-900">{profile?.avg_rating || 0}</p>
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-amber-500 transition-colors">{t('dash_avg_rating')}</p>
            </div>
            <div className="text-center group">
              <p className="text-2xl font-bold text-gray-900 mb-1">{profile?.total_reviews || 0}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-blue-500 transition-colors">{t('dash_reviews')}</p>
            </div>
            <div className="text-center group">
              <p className="text-2xl font-bold text-green-600 mb-1">{profile?.completed_tasks_count || 0}</p>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-green-600 transition-colors">{t('dash_impact')}</p>
            </div>
            {/* Trust Score removed as per request */}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('dash_stat_available')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.available}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('dash_stat_active')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.active}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('dash_stat_completed')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.completed}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('dash_stat_job_apps')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.applications}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">{t('dash_recent_tasks')}</h2>
            <Link to="/dashboard/volunteer/my-tasks" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              {t('dash_view_all')} <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">{t('common_loading')}</div>
            ) : recentTasks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No tasks accepted yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentTasks.map((task) => (
                  <div key={task.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        task.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {task.status === 'Completed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{task.title}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-[10px] text-gray-500 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> {task.location}
                          </p>
                          <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                            <Info className="w-2.5 h-2.5" /> {(task as any).profiles?.name || 'NGO'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      task.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {task.status === 'Assigned' ? 'In Progress' : task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{t('dash_quick_actions')}</h2>
          <div className="grid grid-cols-1 gap-4">
            <Link to="/dashboard/volunteer/tasks" className="p-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-3 shadow-lg shadow-blue-100">
              <Search className="w-5 h-5" />
              {t('dash_find_new_tasks')}
            </Link>
            <Link to="/dashboard/volunteer/profile" className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              {t('dash_update_profile')}
            </Link>
            <Link to="/leaderboard" className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              {t('dash_ngo_leaderboard')}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-blue-600 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl shadow-blue-100">
          <div className="relative z-10">
            <h2 className="text-2xl font-bold mb-2">{t('dash_find_mission_title')}</h2>
            <p className="text-blue-100 mb-6 max-w-md">{t('dash_find_mission_desc')}</p>
            <Link to="/dashboard/volunteer/tasks" className="inline-block px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors">
              {t('dash_browse_tasks')}
            </Link>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <Search className="w-64 h-64" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('dash_empowering_comm')}</h2>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">{t('dash_empowering_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
