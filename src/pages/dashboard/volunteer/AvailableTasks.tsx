import React, { useState, useEffect } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { MapPin, AlertCircle, Clock, CheckCircle2, X, Info, Search, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Need } from '../../../types';

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function AvailableTasks() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Need | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
    
    // Real-time subscription for available tasks
    const channel = supabase
      .channel('available-tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'needs', filter: 'status=eq.Pending' },
        () => fetchTasks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*, profiles:ngo_id(name, verification_status)')
        .eq('status', 'Pending')
        .eq('is_deleted', false)
        .order('urgency', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const sorted = (data || []).sort((a, b) => {
        const priority = { 'High': 3, 'Medium': 2, 'Low': 1 };
        return (priority[b.urgency as keyof typeof priority] || 0) - (priority[a.urgency as keyof typeof priority] || 0);
      });

      setTasks(sorted);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(taskId: string) {
    if (!profile?.id) {
      alert('You must be logged in to accept tasks.');
      return;
    }
    if (profile.role !== 'volunteer') {
      alert('Only volunteers can accept tasks. Your current role is: ' + profile.role);
      return;
    }

    setAccepting(true);
    try {
      const { error, count } = await supabase
        .from('needs')
        .update({
          status: 'Assigned',
          assigned_volunteer_id: profile.id,
          accepted_at: new Date().toISOString()
        }, { count: 'exact' })
        .eq('id', taskId)
        .eq('status', 'Pending');

      if (error) throw error;
      
      if (count === 0) {
        alert('Could not accept task. It may have been taken by someone else.');
        setAccepting(false);
        fetchTasks();
        return;
      }
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Notify NGO
        await supabase.from('notifications').insert({
          user_id: task.ngo_id,
          title: 'Task Accepted',
          message: `Volunteer ${profile.name} has accepted your task: ${task.title}`,
          type: 'acceptance',
          task_id: taskId
        });

        // Notify Requesting User (if any)
        if (task.user_id) {
          await supabase.from('notifications').insert({
            user_id: task.user_id,
            title: 'Volunteer Found',
            message: `A volunteer has accepted your help request: ${task.title}`,
            type: 'info',
            task_id: taskId
          });
        }
      }
      
      setTasks(tasks.filter(t => t.id !== taskId));
      setSelectedTask(null);
      setSuccessMessage('Task accepted successfully! You can find it in "My Tasks".');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      console.error('Error accepting task:', error);
      alert('Failed to accept task: ' + (error.message || 'Unknown error'));
    } finally {
      setAccepting(false);
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const skillMatch = profile?.skills?.some(skill => {
      const taskCategory = task.category.toLowerCase();
      const userSkill = skill.toLowerCase();
      return taskCategory.includes(userSkill) || userSkill.includes(taskCategory);
    });
    const locationMatch = task.location.toLowerCase().includes(profile?.location?.toLowerCase() || '');

    // If GPS is available, prioritize distance
    let nearby = locationMatch;
    if (profile?.latitude && profile?.longitude && task.latitude && task.longitude) {
      const dist = calculateDistance(profile.latitude, profile.longitude, task.latitude, task.longitude);
      nearby = dist <= 10; // Within 10km for list visibility
    }

    return matchesSearch && (skillMatch || nearby);
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between text-red-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button 
            onClick={fetchTasks}
            className="text-xs font-bold underline uppercase tracking-wider hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Smart Matched Tasks</h1>
          <p className="text-gray-500 text-sm">Showing tasks that match your skills and location.</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800"
          >
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium">{successMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Problem</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Urgency & Match</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">Loading tasks...</td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    No tasks match your profile right now. Try updating your skills or location in your profile!
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const skillMatch = profile?.skills?.some(skill => {
                    const taskCategory = task.category.toLowerCase();
                    const userSkill = skill.toLowerCase();
                    return taskCategory.includes(userSkill) || userSkill.includes(taskCategory);
                  });
                  
                  let distance = null;
                  if (profile?.latitude && profile?.longitude && task.latitude && task.longitude) {
                    distance = calculateDistance(profile.latitude, profile.longitude, task.latitude, task.longitude);
                  }

                  const isNgoVerified = (task as any).profiles?.verification_status === 'Verified';

                  return (
                    <tr key={task.id} className={`hover:bg-gray-50/50 transition-colors ${task.urgency === 'High' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{task.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                            <Clock className="w-3 h-3" /> {new Date(task.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 mt-1">
                            <Info className="w-2.5 h-2.5" /> Assigned by:- {(task as any).profiles?.name || 'NGO'}
                            {isNgoVerified && <CheckCircle2 className="w-3 h-3 ml-0.5" />}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                            task.urgency === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                            task.urgency === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-green-50 text-green-700 border-green-100'
                          )}>
                            {task.urgency}
                          </span>
                          {skillMatch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] font-bold uppercase tracking-wider">
                              Skill Match
                            </span>
                          )}
                          {distance !== null && (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 border rounded text-[10px] font-bold uppercase tracking-wider",
                              distance < 2 ? "bg-green-50 text-green-700 border-green-100" :
                              distance < 5 ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                              "bg-gray-50 text-gray-700 border-gray-100"
                            )}>
                              <MapPin className="w-2.5 h-2.5" />
                              {distance.toFixed(1)} km away
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedTask(task)}
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Details Modal */}
      <AnimatePresence>
        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTask(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Task Details</h2>
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Problem</h3>
                  <p className="text-lg font-bold text-gray-900">{selectedTask.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Description</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Location</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{selectedTask.location}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Posted Time</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{new Date(selectedTask.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Urgency</h3>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium ${
                      selectedTask.urgency === 'High' ? 'bg-red-50 text-red-700' :
                      selectedTask.urgency === 'Medium' ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    }`}>
                      <AlertCircle className="w-4 h-4" />
                      {selectedTask.urgency}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">NGO</h3>
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                      <Info className="w-4 h-4" />
                      <span className="text-sm font-bold">Assigned by:- {(selectedTask as any).profiles?.name || 'NGO'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Reject
                </button>
                <button 
                  disabled={accepting}
                  onClick={() => handleAccept(selectedTask.id)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                >
                  {accepting ? 'Accepting...' : 'Accept Task'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
