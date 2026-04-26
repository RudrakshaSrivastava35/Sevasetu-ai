import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, Heart, User, LayoutDashboard, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

import LanguageSelector from './LanguageSelector';

import { useLanguage } from '../contexts/LanguageContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const dashboardLink = profile?.role === 'ngo' 
    ? '/dashboard/ngo' 
    : profile?.role === 'volunteer' 
    ? '/dashboard/volunteer' 
    : '/dashboard/user';

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-[#1a1a1a]">
      <nav className="bg-white border-b border-[#e5e5e5] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-blue-600 fill-blue-600" />
                <span className="text-xl font-bold tracking-tight">SevaSetu AI</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden sm:flex sm:items-center sm:gap-6">
              <LanguageSelector className="mr-2" />
              {user ? (
                <>
                  <Link to={dashboardLink} className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center gap-1">
                    <LayoutDashboard className="w-4 h-4" />
                    {t('nav_dashboard')}
                  </Link>
                  <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-semibold text-gray-900">{profile?.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{profile?.role}</span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title={t('nav_sign_out')}
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600">{t('nav_login')}</Link>
                  <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                    {t('nav_register')}
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-6 space-y-1">
            <div className="px-3 py-3 border-b border-gray-50 mb-2">
              <LanguageSelector />
            </div>
            {user ? (
              <>
                <Link
                  to={dashboardLink}
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav_dashboard')}
                </Link>
                <div className="pt-4 border-t border-gray-100">
                  <div className="px-3 py-2 text-sm font-bold text-gray-500 uppercase tracking-widest">
                    {profile?.name} ({profile?.role})
                  </div>
                  <button
                    onClick={() => { handleSignOut(); setIsMenuOpen(false); }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    {t('nav_sign_out')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav_login')}
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 rounded-md text-base font-medium text-blue-600 hover:bg-blue-50"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('nav_register')}
                </Link>
              </>
            )}
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-[#e5e5e5] py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-blue-600 fill-blue-600" />
            <span className="text-lg font-bold tracking-tight">SevaSetu AI</span>
          </div>
          <p className="text-sm text-gray-500">
            {t('footer_desc')}
          </p>
          <div className="mt-8 pt-8 border-t border-gray-100 text-xs text-gray-400 uppercase tracking-widest font-bold">
            &copy; 2026 SevaSetu AI. {t('footer_rights')}
          </div>
        </div>
      </footer>
    </div>
  );
}
