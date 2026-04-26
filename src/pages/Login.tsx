import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../lib/supabase';
import Layout from '../components/Layout';
import { LogIn } from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) throw authError;

      if (authData.user) {
        // Fetch profile to get role
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .limit(1);

        if (profileError) throw profileError;

        const profileData = profiles?.[0];

        if (!profileData) {
          throw new Error('User profile not found. Please register again or contact support.');
        }

        navigate(`/dashboard/${profileData.role}`);
      }
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto py-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <LogIn className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{t('auth_welcome_back')}</h1>
          <p className="text-gray-600">{t('auth_sign_in_desc')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('auth_email')}</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('auth_password')}</label>
            <input
              type="password"
              name="password"
              required
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('auth_signing_in') : t('auth_sign_in_btn')}
          </button>

          <p className="text-center text-sm text-gray-500">
            {t('auth_no_account')} <Link to="/register" className="text-blue-600 font-bold hover:underline">{t('auth_register_now')}</Link>
          </p>
        </form>
      </div>
    </Layout>
  );
}
