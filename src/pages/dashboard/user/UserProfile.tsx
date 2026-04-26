import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { User, Mail, MapPin, Save, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function UserProfile() {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    location: profile?.location || ''
  });

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('id', profile?.id);

      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    if (!confirm('Are you absolutely sure? This will permanently delete your account and all your data. This action cannot be undone.')) return;
    
    setLoading(true);
    try {
      // Delete profile (RLS will check if it's the current user)
      // Note: Full auth account deletion usually requires admin privileges or a specialized API,
      // but deleting the profile row will trigger ON DELETE CASCADE if configured.
      // For this demo, we'll delete the profile and then sign out.
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile?.id);

      if (error) throw error;
      
      toast.success('Account deleted successfully');
      await signOut();
      window.location.href = '/';
    } catch (err: any) {
      setError(handleSupabaseError(err));
      toast.error('Failed to delete account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm">Update your personal information.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 to-blue-400"></div>
        <div className="px-8 pb-8">
          <div className="relative -mt-12 mb-6">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              <User className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-green-700 text-sm">
                <Save className="w-5 h-5" />
                Profile updated successfully!
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
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

              <div className="space-y-2 sm:col-span-2">
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
            </div>

            <button
              disabled={loading}
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

          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-500 mb-6">Once you delete your account, there is no going back. Please be certain.</p>
            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="px-6 py-3 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
