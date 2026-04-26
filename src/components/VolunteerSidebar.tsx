import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Search, 
  CheckSquare, 
  Briefcase,
  FileText,
  User,
  LogOut,
  Trash2,
  Bell,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

import { useLanguage } from '../contexts/LanguageContext';

export default function VolunteerSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();

  const menuItems = [
    { icon: LayoutDashboard, label: t('nav_dashboard'), path: '/dashboard/volunteer' },
    { icon: Bell, label: t('side_notifications'), path: '/dashboard/volunteer/notifications' },
    { icon: Search, label: t('side_available_tasks'), path: '/dashboard/volunteer/tasks' },
    { icon: CheckSquare, label: t('side_my_tasks'), path: '/dashboard/volunteer/my-tasks' },
    { icon: Briefcase, label: t('side_jobs'), path: '/dashboard/volunteer/jobs' },
    { icon: FileText, label: t('side_applications'), path: '/dashboard/volunteer/applications' },
    { icon: User, label: t('side_profile'), path: '/dashboard/volunteer/profile' },
    { icon: Trash2, label: t('side_recycle_bin'), path: '/dashboard/volunteer/recycle-bin' },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">S</div>
          <span>SevaSetu AI</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}

        {profile?.email === 'rudrakshasri35@gmail.com' && (
          <div className="pt-4 mt-4 border-t border-gray-100">
            <p className="px-4 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('dash_admin_only')}</p>
            <Link
              to="/dashboard/volunteer/admin-verification"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === '/dashboard/volunteer/admin-verification'
                  ? "bg-purple-50 text-purple-700" 
                  : "text-gray-600 hover:bg-purple-50 hover:text-purple-700"
              )}
            >
              <ShieldCheck className="w-5 h-5" />
              {t('dash_ngo_verification')}
            </Link>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-100 space-y-4">
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {t('dash_logout')}
        </button>
      </div>
    </div>
  );
}
