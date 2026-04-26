import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import Layout from '../../../components/Layout';
import { Plus, Users, CheckCircle2, AlertCircle, Clock, MapPin, Briefcase, User, Star, Smile, ShieldCheck, MessageSquare } from 'lucide-react';
import type { Need, Profile } from '../../../types';

import { useLanguage } from '../../../contexts/LanguageContext';

export default function NGODashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
      
      // Subscribe to all relevant table changes for real-time dashboard
      const channel = supabase
        .channel('ngo-dashboard-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'needs' },
          () => fetchData()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'job_applications' },
          () => fetchData()
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` },
          () => fetchData()
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id, profile?.ngo_type]);

  async function fetchData() {
    if (!profile?.id) return;
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching NGO Dashboard data for type:', profile.ngo_type);
      
      let query = supabase
        .from('needs')
        .select('*, volunteer:assigned_volunteer_id(name, avg_rating)')
        .eq('is_deleted', false);

      // Robust Category Filtering
      if (profile.ngo_type) {
        const ngo_type_lower = profile.ngo_type.toLowerCase();
        // Show if: (Explicitly assigned to this NGO) OR (Unassigned, Pending, and strictly matches NGO Category)
        query = query.or(`ngo_id.eq.${profile.id},and(ngo_id.is.null,category.eq.${ngo_type_lower},status.eq.Pending)`);
      } else {
        query = query.eq('ngo_id', profile.id);
      }

      const { data: needsData, error: needsError } = await query.order('created_at', { ascending: false });

      const { data: appsData, error: appsError } = await supabase
        .from('job_applications')
        .select('*, jobs(title)')
        .order('created_at', { ascending: false });

      if (needsError) throw needsError;
      if (appsError) throw appsError;

      // Secondary Client-Side Guard: Strictly filter by category for unassigned tasks
      const filteredNeeds = (needsData || []).filter(need => {
        if (need.ngo_id === profile.id) return true;
        if (!need.ngo_id && need.status === 'Pending') {
          return need.category?.toLowerCase() === profile.ngo_type?.toLowerCase();
        }
        return false;
      });

      setNeeds(filteredNeeds);
      setApplications(appsData || []);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    active: needs.filter(n => n.status !== 'Completed').length,
    assigned: needs.filter(n => n.status === 'Assigned').length,
    pendingProofs: needs.filter(n => n.proof_submitted && !n.proof_verified).length,
    completed: needs.filter(n => n.status === 'Completed').length,
    verifiedCompleted: needs.filter(n => n.status === 'Completed' && n.proof_verified).length,
    applications: applications.filter(a => a.status === 'Pending').length,
    rating: profile?.avg_rating || 0,
    positivePercent: profile?.positive_feedback_percent || 0,
    isVerified: profile?.is_verified || false
  };

  const recentActivity = [
    ...needs.map(n => ({ 
      id: n.id, 
      type: 'need', 
      title: n.status === 'Completed' 
        ? `Task Completed: ${n.title}` 
        : n.status === 'Assigned' 
          ? `Task In Progress: ${n.title}` 
          : `New Need Posted: ${n.title}`, 
      subtitle: n.status === 'Completed' && (n as any).volunteer?.name 
        ? `Completed by ${(n as any).volunteer.name}${ (n as any).volunteer.avg_rating > 0 ? ` (${(n as any).volunteer.avg_rating} ⭐)` : '' }` 
        : n.status === 'Assigned' && (n as any).volunteer?.name 
          ? `Assigned to ${(n as any).volunteer.name}${ (n as any).volunteer.avg_rating > 0 ? ` (${(n as any).volunteer.avg_rating} ⭐)` : '' }` 
          : '',
      status: n.status, 
      date: n.status === 'Completed' ? n.completed_at : n.status === 'Assigned' ? n.accepted_at : n.created_at 
    })),
    ...applications.map(a => ({ 
      id: a.id, 
      type: 'application', 
      title: `New Application: ${a.name}`, 
      subtitle: `For job: ${a.jobs?.title || 'Unknown'}`,
      status: a.status, 
      date: a.created_at 
    }))
  ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).slice(0, 8);

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800 animate-in fade-in slide-in-from-top-2">
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('ngo_dash_overview')}</h1>
            {stats.isVerified && (
              <ShieldCheck className="w-8 h-8 text-blue-600 fill-blue-50" title={t('dash_verified')} />
            )}
          </div>
          <p className="text-gray-600">{t('dash_welcome_back')}, {profile?.name}. {t('dash_ready_impact')}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Trust Score removed as per request */}
        </div>
      </div>

      {/* Verification Overview */}
      <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold">{t('ngo_verif_system')}</h3>
            <p className="text-blue-100 text-sm">{t('ngo_verif_desc')}</p>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.verifiedCompleted}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">{t('ngo_verif_tasks')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">
              {stats.completed > 0 ? Math.round((stats.verifiedCompleted / stats.completed) * 100) : 0}%
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">{t('ngo_trust_index')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{stats.pendingProofs}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">{t('ngo_pending_review')}</p>
          </div>
        </div>
        <Link to="/dashboard/ngo/task-proofs" className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all text-sm">
          {t('ngo_verify_proofs')}
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{t('ngo_active_needs')}</span>
          </div>
          <div className="text-2xl font-bold">{loading ? '...' : stats.active}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{t('ngo_assigned')}</span>
          </div>
          <div className="text-2xl font-bold">{loading ? '...' : stats.assigned}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{t('dash_stat_completed')}</span>
          </div>
          <div className="text-2xl font-bold">{loading ? '...' : stats.completed}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{t('ngo_pending_proofs')}</span>
            </div>
            <div className="text-2xl font-bold">{loading ? '...' : stats.pendingProofs}</div>
          </div>
          <Link to="/dashboard/ngo/task-proofs" className="text-[10px] text-blue-600 font-bold mt-1 inline-block hover:underline">{t('ngo_review_now')} →</Link>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{t('dash_stat_job_apps')}</span>
            </div>
            <div className="text-2xl font-bold">{loading ? '...' : stats.applications}</div>
          </div>
          <Link to="/dashboard/ngo/job-requests" className="text-[10px] text-purple-600 font-bold mt-1 inline-block hover:underline">{t('ngo_review_now')} →</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">{t('dash_recent_activity')}</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">{t('ngo_loading_activity')}</div>
            ) : recentActivity.length === 0 ? (
              <div className="p-8 text-center text-gray-500">{t('ngo_no_activity')}</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentActivity.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        item.type === 'need' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                      }`}>
                        {item.type === 'need' ? <AlertCircle className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.title}</p>
                        {item.subtitle && <p className="text-xs text-gray-500 mb-1">{item.subtitle}</p>}
                        <p className="text-xs text-gray-400">{new Date(item.date || '').toLocaleString()}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      item.status === 'Pending' ? 'bg-orange-50 text-orange-600' :
                      item.status === 'Completed' ? 'bg-green-50 text-green-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {item.status === 'Pending' ? t('dash_status_pending') : 
                       item.status === 'Assigned' ? t('dash_status_assigned') : 
                       item.status === 'Completed' ? t('dash_status_completed') : 
                       item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 pt-4">{t('dash_quick_actions')}</h2>
          <div className="grid grid-cols-1 gap-4">
            <Link to="/dashboard/ngo/add-need" className="p-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-3 shadow-lg shadow-blue-100">
              <Plus className="w-5 h-5" />
              {t('ngo_post_new_need')}
            </Link>
            <Link to="/dashboard/ngo/job-posting" className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-gray-400" />
              {t('ngo_post_job')}
            </Link>
            <Link to="/dashboard/ngo/feedback" className="p-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              {t('ngo_view_feedback')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
