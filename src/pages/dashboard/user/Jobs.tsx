import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Briefcase, MapPin, Building2, Search, X, Calendar, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function Jobs() {
  const { t } = useLanguage();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applying, setApplying] = useState(false);
  const [appliedJobs, setAppliedJobs] = useState<string[]>([]);
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    email: profile?.email || '',
    skills: '',
    experience: '',
    why_join: ''
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    fetchJobs();
    if (profile?.id) {
      fetchAppliedJobs();
      setFormData(prev => ({
        ...prev,
        name: profile.name || prev.name,
        email: profile.email || prev.email
      }));
    }
  }, [profile?.id, profile?.name, profile?.email]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert(t('jobs_resume_type_error'));
        e.target.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        alert(t('jobs_resume_size_error'));
        e.target.value = '';
        return;
      }
      setResumeFile(file);
    }
  };

  async function fetchAppliedJobs() {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('user_id', profile?.id);
      
      if (error) throw error;
      setAppliedJobs(data.map(app => app.job_id));
    } catch (error) {
      console.error('Error fetching applied jobs:', error);
    }
  }

  async function fetchJobs() {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*, profiles:ngo_id(name)')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.id || !selectedJob) return;
    
    setApplying(true);
    try {
      let resume_url = '';
      
      if (resumeFile) {
        const fileExt = 'pdf';
        const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile);

        if (uploadError) {
          if (uploadError.message.includes('Bucket not found')) {
            throw new Error('Storage bucket "resumes" not found. Please create it in your Supabase dashboard to enable resume uploads.');
          }
          throw uploadError;
        }

        // Get public URL (assuming bucket is public or we use it for simplicity in demo)
        const { data: { publicUrl } } = supabase.storage
          .from('resumes')
          .getPublicUrl(fileName);
        
        resume_url = publicUrl;
      }

      const { error } = await supabase
        .from('job_applications')
        .insert([{
          job_id: selectedJob.id,
          user_id: profile.id,
          ...formData,
          resume_url
        }]);

      if (error) throw error;
      
      setAppliedJobs([...appliedJobs, selectedJob.id]);
      setShowApplyForm(false);
      setSelectedJob(null);
      setFormData({ ...formData, skills: '', experience: '', why_join: '' });
      setResumeFile(null);
    } catch (error: any) {
      console.error('Error applying for job:', error);
      let errorMessage = error.message || t('jobs_apply_failed');
      
      if (errorMessage.includes('resume_url') || errorMessage.includes('column not found')) {
        errorMessage = 'Database schema is out of date. Please run the latest SQL script from the "SQL Setup" button at the bottom of the page to add the "resume_url" column.';
      }
      
      alert(errorMessage);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('jobs_title')}</h1>
          <p className="text-gray-500 text-sm">{t('jobs_subtitle')}</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder={t('jobs_search_placeholder')}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('jobs_table_title')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('jobs_table_ngo')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">{t('jobs_table_location')}</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">{t('jobs_table_action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">{t('common_loading')}</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">{t('jobs_no_found')}</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{job.title}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-1">{job.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building2 className="w-3 h-3 text-gray-400" /> {job.profiles?.name || t('reg_ngo_title')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-3 h-3 text-gray-400" /> {job.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedJob(job)}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                      >
                        {t('common_view')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{t('jobs_details_title')}</h2>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_position')}</h3>
                  <p className="text-lg font-bold text-gray-900">{selectedJob.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_description')}</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedJob.description}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_skills_req')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedJob.skills_required?.map((skill: string) => (
                      <span key={skill} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {skill}
                      </span>
                    )) || <span className="text-sm text-gray-400 italic">No specific skills listed</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('reg_ngo_title')}</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">{selectedJob.profiles?.name || t('reg_ngo_title')}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('reg_location')}</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{selectedJob.location}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">{t('jobs_posted_on')}</h3>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {new Date(selectedJob.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  {t('common_close')}
                </button>
                <button 
                  disabled={appliedJobs.includes(selectedJob.id)}
                  onClick={() => setShowApplyForm(true)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
                    appliedJobs.includes(selectedJob.id) 
                      ? 'bg-green-50 text-green-700 shadow-none' 
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                  }`}
                >
                  {appliedJobs.includes(selectedJob.id) ? (
                     <>
                       <CheckCircle2 className="w-5 h-5" />
                       {t('jobs_applied')}
                     </>
                   ) : t('jobs_apply_now')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Apply Form Modal */}
      <AnimatePresence>
        {showApplyForm && selectedJob && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApplyForm(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{t('jobs_apply_title')}</h2>
                  <p className="text-xs text-gray-500 mt-1">{selectedJob.title} at {selectedJob.profiles?.name}</p>
                </div>
                <button 
                  onClick={() => setShowApplyForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleApply} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_full_name')}</label>
                    <input 
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_email')}</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_skills')}</label>
                  <input 
                    required
                    type="text"
                    placeholder={t('jobs_skills_placeholder')}
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_experience')}</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder={t('jobs_exp_placeholder')}
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_why_join')}</label>
                  <textarea 
                    required
                    rows={3}
                    placeholder={t('jobs_motivation_placeholder')}
                    value={formData.why_join}
                    onChange={(e) => setFormData({ ...formData, why_join: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                </div>
                
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{t('jobs_upload_resume')}</label>
                  <div className="mt-1 flex justify-center px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 transition-all cursor-pointer relative group">
                    <input 
                      type="file" 
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Info className="w-5 h-5 text-blue-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-600">
                          {resumeFile ? resumeFile.name : t('jobs_upload_resume')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">PDF max. 2MB</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowApplyForm(false)}
                    className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                  >
                    {t('common_cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={applying}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {applying ? t('jobs_submitting') : t('jobs_submit_btn')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
