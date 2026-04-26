import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Clock, CheckCircle2, Users, MapPin, X, AlertCircle, Calendar, Info, Trash2, Star, Trophy, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import type { Need } from '../../../types';
import ReviewModal from '../../../components/ReviewModal';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function MyRequests() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<Need | null>(null);
  const [selectedNGO, setSelectedNGO] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewTask, setReviewTask] = useState<Need | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchRequests();
    }
  }, [profile?.id]);

  async function fetchRequests() {
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*, profiles:ngo_id(name, ngo_type, ngo_registration_number, avg_rating, total_reviews, positive_feedback_percent, completed_tasks_count, is_verified), volunteer:assigned_volunteer_id(name)')
        .eq('user_id', profile?.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: true,
          deleted_at: now.toISOString(),
          auto_delete_at: autoDeleteAt.toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setRequests(requests.filter(r => r.id !== id));
      if (selectedRequest?.id === id) setSelectedRequest(null);

      toast((tt) => (
        <div className="flex items-center gap-3">
          <span>{t('my_req_deleted')}</span>
          <button 
            onClick={async () => {
              toast.dismiss(tt.id);
              await handleRestore(id);
            }}
            className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors uppercase tracking-wider"
          >
            {t('my_req_undo')}
          </button>
        </div>
      ), { duration: 5000 });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('common_error'));
    }
  }

  async function handleRestore(id: string) {
    try {
      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: false,
          deleted_at: null,
          auto_delete_at: null
        })
        .eq('id', id);

      if (error) throw error;
      fetchRequests();
      toast.success(t('my_req_restore_success'));
    } catch (error) {
      console.error('Restore error:', error);
      toast.error(t('my_req_restore_failed'));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    try {
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: true,
          deleted_at: now.toISOString(),
          auto_delete_at: autoDeleteAt.toISOString()
        })
        .in('id', selectedIds);

      if (error) throw error;
      
      setRequests(requests.filter(r => !selectedIds.includes(r.id)));
      const count = selectedIds.length;
      setSelectedIds([]);
      toast.success(`${count} ${t('my_req_bulk_delete')}`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error(t('common_error'));
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === requests.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(requests.map(r => r.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('my_req_title')}</h1>
          <p className="text-gray-500 text-sm">{t('my_req_subtitle')}</p>
        </div>
        {selectedIds.length > 0 && (
          <button 
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100 transition-all border border-red-100"
          >
            <Trash2 className="w-4 h-4" /> {t('common_delete')} ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={requests.length > 0 && selectedIds.length === requests.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('my_req_problem')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('dash_status_label')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">{t('jobs_table_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">{t('common_loading')}</td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">{t('my_req_no_found')}</td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(request.id)}
                        onChange={() => toggleSelect(request.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{request.title}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" /> {request.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          {request.status === 'Pending' && <Clock className="w-4 h-4 text-gray-400" />}
                          {request.status === 'Assigned' && <Users className="w-4 h-4 text-orange-500" />}
                          {request.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            request.status === 'Pending' ? 'text-gray-500' :
                            request.status === 'Assigned' ? 'text-orange-600' :
                            'text-green-600'
                          }`}>
                            {request.status === 'Pending' ? t('dash_status_pending') : 
                             request.status === 'Assigned' ? t('dash_status_assigned') : 
                             t('dash_status_completed')}
                          </span>
                        </div>
                        {(request as any).profiles && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded border border-blue-100">
                             <ShieldCheck className="w-2.5 h-2.5" /> Assigned by:- {(request as any).profiles.name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => setSelectedRequest(request)}
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          {t('common_view')}
                        </button>
                        {request.status === 'Completed' && (
                          <button 
                            onClick={() => setReviewTask(request)}
                            className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition-all"
                            title="Review Task"
                          >
                            <Star className="w-4 h-4 fill-amber-500" />
                          </button>
                        )}
                        {request.user_id === profile?.id && (
                          <button 
                            onClick={() => handleDelete(request.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Request"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
              <div className="relative h-32 bg-gradient-to-br from-blue-600 to-indigo-700 p-6">
                <button 
                  onClick={() => setSelectedNGO(null)}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute -bottom-8 left-6">
                  <div className="w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center text-3xl font-black text-blue-600 border-4 border-white">
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
                      Based on verified task completion and user feedback patterns.
                    </p>
                  </div>
                </div>

                {selectedNGO.ngo_registration_number && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 italic">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Registration #</p>
                    <p className="text-sm font-medium text-gray-700">{selectedNGO.ngo_registration_number}</p>
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
      {/* Request Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRequest(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{t('my_req_details_title')}</h2>
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('my_req_problem')}</h3>
                  <p className="text-lg font-bold text-gray-900">{selectedRequest.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_description')}</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedRequest.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('ngo_urgency_label')}</h3>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedRequest.urgency === 'High' ? 'bg-red-50 text-red-700' :
                      selectedRequest.urgency === 'Medium' ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      <AlertCircle className="w-4 h-4" />
                      {selectedRequest.urgency === 'High' ? t('ngo_urgency_high') : 
                       selectedRequest.urgency === 'Medium' ? t('ngo_urgency_medium') : 
                       t('ngo_urgency_low')}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">NGO Assigned</h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                        <Users className="w-4 h-4" />
                        <span className="text-sm font-bold">Assigned by:- {(selectedRequest as any).profiles?.name || t('my_req_not_assigned')}</span>
                      </div>
                      {(selectedRequest as any).profiles && (
                        <button
                          onClick={() => setSelectedNGO((selectedRequest as any).profiles)}
                          className="text-xs font-bold text-blue-600 hover:underline text-left pl-1"
                        >
                          View NGO Details & Trust Score →
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('reg_location')}</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{selectedRequest.location}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_posted_on')}</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(selectedRequest.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      selectedRequest.status === 'Completed' ? 'bg-green-100' :
                      selectedRequest.status === 'Assigned' ? 'bg-orange-100' :
                      'bg-gray-100'
                    }`}>
                      {selectedRequest.status === 'Completed' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                      {selectedRequest.status === 'Assigned' && <Users className="w-5 h-5 text-orange-600" />}
                      {selectedRequest.status === 'Pending' && <Clock className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('my_req_current_status')}</p>
                      <p className="font-bold text-gray-900">
                        {selectedRequest.status === 'Pending' ? t('dash_status_pending') : 
                         selectedRequest.status === 'Assigned' ? t('dash_status_assigned') : 
                         t('dash_status_completed')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  {t('common_close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {reviewTask && (
        <ReviewModal
          isOpen={!!reviewTask}
          onClose={() => {
            setReviewTask(null);
            fetchRequests();
          }}
          taskId={reviewTask.id}
          taskTitle={reviewTask.title}
          ngoId={reviewTask.ngo_id}
        />
      )}
    </div>
  );
}
