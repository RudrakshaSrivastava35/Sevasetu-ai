import React, { useState, useEffect } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Heart, Briefcase, AlertCircle, Clock, MapPin, Loader2, Users, Trash2, Star, Trophy, X, Info, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { addDays } from 'date-fns';
import { useLanguage } from '../../../contexts/LanguageContext';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
export default function UserDashboard() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({ total: 0, completed: 0 });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNGO, setSelectedNGO] = useState<any | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*, ngo:ngo_id(name, ngo_type, ngo_registration_number, avg_rating, total_reviews, positive_feedback_percent, completed_tasks_count, is_verified), volunteer:assigned_volunteer_id(name)')
        .eq('user_id', profile?.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const total = data?.length || 0;
      const completed = data?.filter(d => d.status === 'Completed').length || 0;

      setStats({ total, completed });
      setRecentRequests(data?.slice(0, 5) || []);
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t('common_confirm_delete'))) return;
    
    try {
      const { error } = await supabase
        .from('needs')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          auto_delete_at: addDays(new Date(), 7).toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      setRecentRequests(recentRequests.filter(r => r.id !== id));
      toast.success(t('user_moved_recycle'));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('user_delete_failed'));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('nav_dashboard')}</h1>
          <p className="text-gray-600">{t('dash_welcome_back')}, {profile?.name}. {t('user_dash_help')}</p>
        </div>
        <Link to="/dashboard/user/request" className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2">
          <Heart className="w-4 h-4" /> {t('user_request_help')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('user_total_req')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.total}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('user_comp_req')}</span>
          </div>
          <div className="text-3xl font-bold">{loading ? '...' : stats.completed}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">{t('side_my_requests')}</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">{t('common_loading')}</div>
          ) : recentRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">{t('common_no_data')}</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentRequests.map(req => {
                let distance = null;
                if (profile?.latitude && profile?.longitude && req.volunteer?.latitude && req.volunteer?.longitude) {
                  distance = calculateDistance(profile.latitude, profile.longitude, req.volunteer.latitude, req.volunteer.longitude);
                }

                return (
                  <div key={req.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">{req.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          req.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-100' :
                          req.status === 'Assigned' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                          'bg-gray-50 text-gray-500 border-gray-100'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(req.created_at).toLocaleDateString()}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.location}</span>
                      </div>
                    </div>

                      <div className="flex flex-col items-end gap-2">
                        {req.ngo && (
                          <button
                            onClick={() => setSelectedNGO(req.ngo)}
                            className="flex items-center gap-2 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-all"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Assigned by:- {req.ngo.name}
                          </button>
                        )}
                        {req.volunteer && (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                              <Users className="w-4 h-4 text-blue-600" />
                              {req.volunteer.name}
                            </div>
                            {distance !== null && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-1">
                                <MapPin className="w-2.5 h-2.5" />
                                {distance.toFixed(1)} km {t('user_away')}
                              </div>
                            )}
                          </div>
                        )}
                        {!req.volunteer && req.status === 'Pending' && !req.ngo && (
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 italic">{t('user_finding_vol')}</span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleDelete(req.id);
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title={t('common_delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
          <Heart className="w-12 h-12 mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">{t('user_support_cause')}</h2>
          <p className="text-blue-100 mb-6">{t('user_support_desc')}</p>
          <Link to="/dashboard/user/donate" className="inline-block px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors">
            {t('side_donate')}
          </Link>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white">
          <Briefcase className="w-12 h-12 mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">{t('user_find_opp')}</h2>
          <p className="text-indigo-100 mb-6">{t('user_find_opp_desc')}</p>
          <Link to="/dashboard/user/jobs" className="inline-block px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-blue-50 transition-colors">
            {t('ngo_post_job')}
          </Link>
        </div>
      </div>

      {/* NGO Info Modal */}
      <AnimatePresence>
        {selectedNGO && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNGO(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="relative h-32 bg-gradient-to-br from-indigo-600 to-blue-700 p-6">
                <button 
                  onClick={() => setSelectedNGO(null)}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute -bottom-8 left-6">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center text-3xl font-black text-indigo-600 border-4 border-white">
                    {selectedNGO.name.charAt(0)}
                  </div>
                </div>
              </div>

              <div className="pt-12 p-8 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedNGO.name}</h2>
                    {selectedNGO.is_verified && <CheckCircle2 className="w-5 h-5 text-blue-600 fill-blue-50" />}
                  </div>
                  <p className="text-gray-500 font-medium">{selectedNGO.ngo_type} NGO</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-2 text-amber-500 mb-1">
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-lg font-black">{selectedNGO.avg_rating || '5.0'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avg Rating</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Trophy className="w-4 h-4" />
                      <span className="text-lg font-black">{selectedNGO.completed_tasks_count || 0}</span>
                    </div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Tasks Done</p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-blue-100 relative overflow-hidden group">
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-black text-indigo-900 uppercase tracking-tight">Trust Score</p>
                      <span className="text-xl font-black text-indigo-600">{selectedNGO.positive_feedback_percent || 100}%</span>
                    </div>
                    <div className="h-2.5 bg-indigo-200/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedNGO.positive_feedback_percent || 100}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
                      />
                    </div>
                    <p className="mt-3 text-xs font-bold text-indigo-700/70 leading-tight">
                      Verified community impact score based on user feedback.
                    </p>
                  </div>
                </div>

                {selectedNGO.ngo_registration_number && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 italic">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-medium text-gray-700">Registered Organization</p>
                  </div>
                )}

                <button 
                  onClick={() => setSelectedNGO(null)}
                  className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 uppercase tracking-widest text-xs"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
