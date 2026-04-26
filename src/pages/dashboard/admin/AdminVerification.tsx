import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { CheckCircle, XCircle, Clock, FileText, ExternalLink, ShieldCheck, ShieldAlert, Search, Filter } from 'lucide-react';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import type { Profile } from '../../../types';

export default function AdminVerification() {
  const [ngos, setNgos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Verified' | 'Rejected'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchNgos();
  }, []);

  async function fetchNgos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ngo')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNgos(data || []);
    } catch (error) {
      console.error('Error fetching NGOs:', error);
      toast.error('Failed to load NGO list');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(id: string, status: 'Verified' | 'Rejected') {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          verification_status: status,
          is_verified: status === 'Verified'
        })
        .eq('id', id);

      if (error) throw error;
      
      setNgos(prev => prev.map(ngo => 
        ngo.id === id ? { ...ngo, verification_status: status, is_verified: status === 'Verified' } : ngo
      ));
      
      toast.success(`NGO ${status === 'Verified' ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error('Failed to update status');
    } finally {
      setProcessing(null);
    }
  }

  const filteredNgos = ngos.filter(ngo => {
    const matchesFilter = filter === 'All' || ngo.verification_status === filter;
    const matchesSearch = ngo.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         ngo.ngo_registration_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ngo.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Verified': return 'text-green-600 bg-green-50 border-green-200';
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            NGO Verification Center
          </h1>
          <p className="text-gray-500 text-sm">Review and verify organization credentials to ensure platform trust.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, email or registration ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
          >
            <option value="All">All NGOs</option>
            <option value="Pending">Pending Review</option>
            <option value="Verified">Verified Only</option>
            <option value="Rejected">Rejected Only</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Organization</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Credentials</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Document</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading NGOs...</td>
                </tr>
              ) : filteredNgos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No NGOs found matching filters.</td>
                </tr>
              ) : (
                filteredNgos.map((ngo) => (
                  <tr key={ngo.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{ngo.name}</div>
                      <div className="text-xs text-gray-500">{ngo.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-700">ID: {ngo.ngo_registration_number || 'Not Provided'}</div>
                      {ngo.ngo_website && (
                        <a href={ngo.ngo_website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs mt-1">
                          <ExternalLink className="w-3 h-3" /> Website
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {ngo.ngo_document_url ? (
                        <a 
                          href={ngo.ngo_document_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all border border-gray-200"
                        >
                          <FileText className="w-3 h-3" />
                          View Proof
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No document</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit",
                        getStatusStyle(ngo.verification_status || 'Pending')
                      )}>
                        {ngo.verification_status === 'Verified' ? <CheckCircle className="w-3 h-3" /> :
                         ngo.verification_status === 'Rejected' ? <XCircle className="w-3 h-3" /> : 
                         <Clock className="w-3 h-3" />}
                        {ngo.verification_status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ngo.verification_status !== 'Verified' && (
                          <button
                            onClick={() => handleVerification(ngo.id, 'Verified')}
                            disabled={!!processing}
                            className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-all border border-green-200 disabled:opacity-50"
                            title="Approve NGO"
                          >
                            Approve
                          </button>
                        )}
                        {ngo.verification_status !== 'Rejected' && (
                          <button
                            onClick={() => handleVerification(ngo.id, 'Rejected')}
                            disabled={!!processing}
                            className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-all border border-red-200 disabled:opacity-50"
                          >
                            Reject
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
    </div>
  );
}
