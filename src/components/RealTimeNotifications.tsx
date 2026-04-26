import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Bell, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import React from 'react';

export default function RealTimeNotifications() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    // Subscribe to new notifications
    const channel = supabase
      .channel(`global-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        async (payload) => {
          const newNotif = payload.new;
          
          if (!newNotif.read) {
            // Show toast based on type
            showNotificationToast(newNotif);
            
            // Mark as read after showing
            await supabase
              .from('notifications')
              .update({ read: true })
              .eq('id', newNotif.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const showNotificationToast = (notif: any) => {
    const icon = getIcon(notif.type);
    
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-in fade-in slide-in-from-top-2 duration-300' : 'animate-out fade-out slide-out-to-top-2 duration-300'
        } max-w-md w-full bg-white shadow-xl rounded-2xl pointer-events-auto flex border-l-4 border-blue-500 ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              {icon}
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-bold text-gray-900">
                {notif.title}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {notif.message}
              </p>
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-100">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
          >
            Close
          </button>
        </div>
      </div>
    ), { duration: 5000, position: 'top-right' });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
      case 'assignment':
      case 'acceptance':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'alert':
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-500" />;
      case 'info':
      default:
        return <Info className="h-6 w-6 text-blue-500" />;
    }
  };

  return null; // This component doesn't render anything itself
}
