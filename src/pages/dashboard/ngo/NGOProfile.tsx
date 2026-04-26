import React, { useState, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { User, Mail, MapPin, Building2, Save, AlertCircle, Globe, Hash, FileText, Upload, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NGOProfile() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    location: profile?.location || '',
    ngo_type: (profile?.ngo_type || 'social').toLowerCase() as any,
    ngo_registration_number: profile?.ngo_registration_number || '',
    ngo_website: profile?.ngo_website || '',
    ngo_document_url: profile?.ngo_document_url || ''
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Verified': return 'text-green-600 bg-green-50 border-green-200';
      case 'Rejected': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verified': return <CheckCircle className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}-${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ngo-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('ngo-documents')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, ngo_document_url: publicUrl }));
      toast.success('Document uploaded successfully');
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(handleSupabaseError(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...formData,
          ngo_type: formData.ngo_type.toLowerCase(),
          // Reset status to Pending if document or reg number changes and was previously Rejected
          verification_status: (profile?.verification_status === 'Rejected') ? 'Pending' : profile?.verification_status
        })
        .eq('id', profile?.id);

      if (error) throw error;
      setSuccess(true);
      toast.success('Profile updated successfully');
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">NGO Profile</h1>
        <p className="text-gray-500 text-sm">Update your organization's information.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400 flex items-end justify-end p-4">
          <div className={cn(
            "px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-2",
            getStatusColor(profile?.verification_status || 'Pending')
          )}>
            {getStatusIcon(profile?.verification_status || 'Pending')}
            {profile?.verification_status || 'Pending'} Verification
          </div>
        </div>
        <div className="px-8 pb-8">
          <div className="relative -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white overflow-hidden">
              {profile?.ngo_document_url ? (
                <img src={profile.ngo_document_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-12 h-12 text-blue-600" />
              )}
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-8">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Organization Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    disabled
                    type="email"
                    value={profile?.email}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Verification Info */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Registration Number</label>
                <div className="relative">
                  <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.ngo_registration_number}
                    onChange={(e) => setFormData({ ...formData, ngo_registration_number: e.target.value })}
                    placeholder="Enter registration No."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Website URL</label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={formData.ngo_website}
                    onChange={(e) => setFormData({ ...formData, ngo_website: e.target.value })}
                    placeholder="https://example.org"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">NGO Type</label>
                <select
                  value={formData.ngo_type}
                  onChange={(e) => setFormData({ ...formData, ngo_type: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                >
                  <option value="medical">Medical</option>
                  <option value="education">Education</option>
                  <option value="food">Food</option>
                  <option value="social">Social Work</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Location</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Document Upload */}
              <div className="sm:col-span-2 space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Registration Document</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
                    formData.ngo_document_url ? "border-green-200 bg-green-50/30" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/30"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden" 
                    accept=".pdf,image/*"
                  />
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-500">Uploading document...</p>
                    </div>
                  ) : formData.ngo_document_url ? (
                    <div className="flex flex-col items-center gap-2 text-green-600">
                      <FileText className="w-10 h-10" />
                      <p className="font-bold">Document Uploaded</p>
                      <p className="text-xs text-green-500">Click to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-10 h-10 text-gray-300" />
                      <p className="font-bold text-gray-600">Upload Registration Proof</p>
                      <p className="text-xs text-gray-400">PDF or Image (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              disabled={loading || uploading}
              type="submit"
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
