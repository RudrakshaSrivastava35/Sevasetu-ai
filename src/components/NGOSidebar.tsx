import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  PlusCircle, 
  ClipboardList, 
  Briefcase, 
  User,
  LogOut,
  Star,
  ShieldCheck,
  Trash2,
  Bell,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../contexts/LanguageContext';

export default function NGOSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();

  const menuItems = [
    { icon: LayoutDashboard, label: t('nav_dashboard'), path: '/dashboard/ngo' },
    { icon: Bell, label: t('vol_notifications'), path: '/dashboard/ngo/notifications' },
    { icon: PlusCircle, label: t('ngo_post_need'), path: '/dashboard/ngo/add-need' },
    { icon: ClipboardList, label: t('ngo_manage_needs'), path: '/dashboard/ngo/manage-needs' },
    { icon: ShieldCheck, label: t('dash_ngo_verification'), path: '/dashboard/ngo/task-proofs' },
    { icon: Briefcase, label: t('ngo_donations'), path: '/dashboard/ngo/jobs' },
    { icon: Star, label: t('ngo_volunteers'), path: '/dashboard/ngo/job-requests' },
    { icon: User, label: t('vol_profile'), path: '/dashboard/ngo/profile' },
    { icon: Trash2, label: t('common_delete'), path: '/dashboard/ngo/recycle-bin' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Verified': return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'Rejected': return <XCircle className="w-3 h-3 text-red-600" />;
      default: return <Clock className="w-3 h-3 text-orange-600" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Verified': return 'bg-green-50 text-green-700 border-green-100';
      case 'Rejected': return 'bg-red-50 text-red-700 border-red-100';
      default: return 'bg-orange-50 text-orange-700 border-orange-100';
    }
  };

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
              to="/dashboard/ngo/admin-verification"
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === '/dashboard/ngo/admin-verification'
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

      <div className="p-4 space-y-4 border-t border-gray-100">
        {profile?.email !== 'rudrakshasri35@gmail.com' && (
          <div className={cn(
            "px-4 py-3 rounded-xl border flex flex-col gap-2",
            getStatusStyle(profile?.verification_status || 'Pending')
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{t('dash_status')}</span>
              {getStatusIcon(profile?.verification_status || 'Pending')}
            </div>
            <p className="text-xs font-bold">
              {profile?.verification_status === 'Verified' ? t('dash_verified') : 
               profile?.verification_status === 'Rejected' ? t('dash_rejected') : 
               t('dash_pending')}
            </p>
          </div>
        )}

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
