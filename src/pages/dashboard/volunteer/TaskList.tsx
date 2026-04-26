import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import Layout from '../../../components/Layout';
import { ArrowLeft, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Need } from '../../../types';

export default function TaskList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailableTasks();
  }, []);

  async function fetchAvailableTasks() {
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*, profiles:ngo_id(name)')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptTask(taskId: string) {
    if (!profile?.id) return;
    setProcessingId(taskId);

    try {
      const { error } = await supabase
        .from('needs')
        .update({
          status: 'Assigned',
          assigned_volunteer_id: profile.id
        })
        .eq('id', taskId);

      if (error) throw error;

      // Remove from list and show success
      setTasks(tasks.filter(t => t.id !== taskId));
      alert('Task accepted successfully!');
    } catch (error) {
      console.error('Error accepting task:', error);
      alert('Failed to accept task. Please try again.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/dashboard/volunteer')}
          className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-600 mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Available Tasks</h1>
          <p className="text-gray-600">Browse and accept community needs that match your skills.</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <p className="text-center py-12 text-gray-500">Finding tasks for you...</p>
          ) : tasks.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">All caught up!</h3>
              <p className="text-gray-500">There are no pending tasks at the moment. Check back later.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                      task.urgency === 'High' ? 'bg-red-50 text-red-600' :
                      task.urgency === 'Medium' ? 'bg-orange-50 text-orange-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {task.urgency} Urgency
                    </span>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{task.category}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{task.title}</h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">{task.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" /> {task.location}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      Assigned by:- {(task as any).profiles?.name || 'NGO'}
                    </div>
                  </div>
                </div>
                <div className="sm:w-48 flex flex-col justify-center gap-3">
                  <button
                    onClick={() => handleAcceptTask(task.id)}
                    disabled={processingId === task.id}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
                  >
                    {processingId === task.id ? 'Accepting...' : 'Accept Task'}
                  </button>
                  <button className="w-full py-3 bg-gray-50 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all">
                    View NGO
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
