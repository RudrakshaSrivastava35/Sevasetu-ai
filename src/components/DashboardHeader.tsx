import React from 'react';
import LanguageSelector from './LanguageSelector';
import { useAuth } from '../hooks/useAuth';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DashboardHeader() {
  const { profile } = useAuth();

  const notificationsPath = profile?.role === 'ngo' 
    ? '/dashboard/ngo/notifications' 
    : profile?.role === 'volunteer' 
    ? '/dashboard/volunteer/notifications' 
    : '/dashboard/user/notifications';

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        {/* Breadcrumbs or search could go here */}
      </div>

      <div className="flex items-center gap-6">
        <LanguageSelector />
        
        <Link 
          to={notificationsPath}
          className="p-2 text-gray-400 hover:text-blue-600 transition-colors relative"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </Link>

        <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-gray-900">{profile?.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{profile?.role}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
            {profile?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
}
