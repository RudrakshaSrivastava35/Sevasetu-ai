import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { Heart, Users, HandHelping, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

import { useLanguage } from '../contexts/LanguageContext';

export default function Landing() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();

  const dashboardLink = profile?.role === 'ngo' 
    ? '/dashboard/ngo' 
    : profile?.role === 'volunteer' 
    ? '/dashboard/volunteer' 
    : '/dashboard/user';

  return (
    <Layout>
      <div className="flex flex-col items-center text-center py-12 sm:py-24">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-bold uppercase tracking-widest mb-8">
          <Heart className="w-3 h-3 fill-current" />
          {t('landing_subtitle')}
        </div>
        
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-gray-900 mb-6 max-w-4xl">
          {t('landing_title')}
        </h1>
        
        <p className="text-xl text-gray-600 mb-10 max-w-2xl leading-relaxed">
          {t('landing_desc')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          {user ? (
            <Link 
              to={dashboardLink}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
            >
              {t('landing_go_to_dashboard')} <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <>
              <Link 
                to="/register"
                className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                {t('landing_get_started')}
              </Link>
              <Link 
                to="/login"
                className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-lg hover:bg-gray-50 transition-all"
              >
                {t('landing_sign_in')}
              </Link>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-left">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">{t('landing_for_ngos')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('landing_ngo_desc')}
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-left">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-6">
              <HandHelping className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">{t('landing_for_volunteers')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('landing_vol_desc')}
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-left">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-6">
              <Heart className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">{t('landing_for_communities')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('landing_community_desc')}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
