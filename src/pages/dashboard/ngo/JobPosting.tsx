import React, { useState } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Briefcase, Send, AlertCircle } from 'lucide-react';

export default function JobPosting() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills_required: '',
    location: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('jobs')
        .insert([{
          ...formData,
          skills_required: formData.skills_required.split(',').map(s => s.trim()),
          ngo_id: profile?.id
        }]);

      if (error) throw error;
      setSuccess(true);
      setFormData({ title: '', description: '', skills_required: '', location: '' });
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Post a Job</h1>
        <p className="text-gray-500 text-sm">Find skilled volunteers or employees for your NGO.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-green-700 text-sm">
            <Send className="w-5 h-5" />
            Job posted successfully!
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Job Title</label>
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g. Social Media Manager"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Description</label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the role and responsibilities..."
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Skills (comma separated)</label>
            <input
              required
              type="text"
              value={formData.skills_required}
              onChange={(e) => setFormData({ ...formData, skills_required: e.target.value })}
              placeholder="e.g. Design, Writing"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Location</label>
            <input
              required
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g. Remote / Lucknow"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Posting...' : (
            <>
              <Briefcase className="w-5 h-5" />
              Post Job
            </>
          )}
        </button>
      </form>
    </div>
  );
}
