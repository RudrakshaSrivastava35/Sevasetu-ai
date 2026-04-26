import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Briefcase, Building2, Clock, CheckCircle2, XCircle, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MyApplications() {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchApplications();
    }
  }, [profile?.id]);

  async function fetchApplications() {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*, jobs(title, location, profiles:ngo_id(name))')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm('Withdraw this application?')) return;
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setApplications(applications.filter(a => a.id !== id));
      toast.success('Application withdrawn');
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast.error('Failed to withdraw application');
    } finally {
      setProcessing(null);
    }
  }

  const filteredApps = applications.filter(app => 
    app.jobs?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.jobs?.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Job Applications</h1>
          <p className="text-gray-500 text-sm">Track the status of your applications with NGOs.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search applications..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading applications...</div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No applications yet</h3>
            <p className="text-gray-500 mt-2">Explore job opportunities and start applying!</p>
          </div>
        ) : (
          filteredApps.map((app) => (
            <div key={app.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900">{app.jobs?.title}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    app.status === 'Accepted' ? 'bg-green-50 text-green-600' :
                    app.status === 'Rejected' ? 'bg-red-50 text-red-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {app.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" /> {app.jobs?.profiles?.name}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(app.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status</p>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    {app.status === 'Pending' && <Clock className="w-4 h-4 text-orange-500" />}
                    {app.status === 'Accepted' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {app.status === 'Rejected' && <XCircle className="w-4 h-4 text-red-500" />}
                    <span className="text-sm font-bold text-gray-900">{app.status}</span>
                  </div>
                </div>
                {app.status === 'Pending' && (
                  <button
                    onClick={() => handleWithdraw(app.id)}
                    disabled={processing === app.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Withdraw Application"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
