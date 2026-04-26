import React, { useState, useEffect } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Bell, Clock, MapPin, Search, CheckSquare, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import type { Notification } from '../../../types';

export default function NGONotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications();
      
      const channel = supabase
        .channel(`ngo-notifications-${profile.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
          () => fetchNotifications()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  async function fetchNotifications() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  async function deleteNotification(id: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NGO Notifications</h1>
          <p className="text-gray-500 text-sm">Track task acceptances and important community updates.</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
            {unreadCount} New
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button 
            onClick={fetchNotifications}
            className="text-xs font-bold underline uppercase tracking-wider hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-gray-500 py-20">
            <Bell className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="font-medium text-gray-400">All clear! No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`p-6 flex flex-col sm:flex-row gap-4 transition-colors ${!n.read ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    n.type === 'acceptance' ? 'bg-green-100 text-green-600' :
                    n.type === 'assignment' ? 'bg-blue-100 text-blue-600' :
                    n.type === 'need_alert' ? 'bg-red-100 text-red-600 animate-pulse' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {n.type === 'acceptance' ? <CheckSquare className="w-5 h-5" /> : 
                     n.type === 'need_alert' ? <AlertCircle className="w-5 h-5" /> :
                     <Bell className="w-5 h-5" />}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className={`text-sm font-bold ${!n.read ? 'text-gray-900' : 'text-gray-600'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {n.message}
                    </p>
                    
                    <div className="pt-3 flex items-center gap-4">
                      {n.task_id && (
                        <Link 
                          to="/dashboard/ngo/manage-needs"
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Manage Needs
                        </Link>
                      )}
                      <button 
                        onClick={() => markAsRead(n.id)}
                        disabled={n.read}
                        className={`text-xs font-bold flex items-center gap-1 ${n.read ? 'text-gray-300 cursor-default' : 'text-gray-500 hover:text-gray-900'}`}
                      >
                        <CheckSquare className="w-3 h-3" /> Mark Read
                      </button>
                      <button 
                        onClick={() => deleteNotification(n.id)}
                        className="text-xs font-bold text-gray-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
