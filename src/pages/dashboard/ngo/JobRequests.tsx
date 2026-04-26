import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { CheckCircle2, XCircle, Clock, User, Briefcase, Mail, Star, FileText } from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function JobRequests() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchApplications();
    }
  }, [profile?.id]);

  async function fetchApplications() {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*, jobs(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(id: string, status: 'Accepted' | 'Rejected') {
    setUpdating(id);
    const application = applications.find(a => a.id === id);
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      setApplications(applications.map(app => app.id === id ? { ...app, status } : app));

      // Notify Volunteer
      if (status === 'Accepted' && application?.user_id) {
        await supabase.from('notifications').insert({
          user_id: application.user_id,
          title: 'Application Accepted!',
          message: `The NGO has accepted your application for: ${application.jobs?.title}`,
          type: 'success',
          task_id: application.job_id
        });
      }
    } catch (error) {
      console.error('Error updating application status:', error);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dash_stat_job_apps')}</h1>
        <p className="text-gray-500 text-sm">Review candidate profiles and resumes to select the best fit for your team.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loading ? (
          <div className="text-center py-12 text-gray-500">{t('common_loading')}</div>
        ) : applications.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{t('jobs_no_found')}</h3>
            <p className="text-gray-500 mt-2">{t('jobs_subtitle')}</p>
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                    {app.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{app.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail className="w-3 h-3" /> {app.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    app.status === 'Accepted' ? 'bg-green-100 text-green-700' :
                    app.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {app.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Applied For</label>
                    <div className="flex items-center gap-2 text-gray-700 font-medium">
                      <Briefcase className="w-4 h-4 text-blue-500" />
                      {app.jobs?.title}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_skills')}</label>
                    <div className="flex items-center gap-2 text-gray-700">
                      <Star className="w-4 h-4 text-amber-500" />
                      {app.skills}
                    </div>
                  </div>
                  {app.resume_url && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Resume</label>
                      <a 
                        href={app.resume_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {t('jobs_view_resume')}
                      </a>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_experience')}</label>
                    <div className="text-gray-700">{app.experience}</div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_why_join')}</label>
                    <p className="text-sm text-gray-600 leading-relaxed">{app.why_join}</p>
                  </div>
                </div>
              </div>

              {app.status === 'Pending' && (
                <div className="flex items-center gap-3 pt-4">
                  <button 
                    disabled={updating === app.id}
                    onClick={() => handleStatusUpdate(app.id, 'Accepted')}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {t('jobs_accept')}
                  </button>
                  <button 
                    disabled={updating === app.id}
                    onClick={() => handleStatusUpdate(app.id, 'Rejected')}
                    className="flex-1 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    {t('jobs_reject')}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
