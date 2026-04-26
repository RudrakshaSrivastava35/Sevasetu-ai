import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { CheckCircle2, Clock, MapPin, AlertCircle, X, Calendar, Info, Camera, Upload, Image as ImageIcon, Loader2, Star, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import type { Need } from '../../../types';
import FeedbackModal from '../../../components/FeedbackModal';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function MyTasks() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Need | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [feedbackTask, setFeedbackTask] = useState<Need | null>(null);
  const [proofModalTask, setProofModalTask] = useState<Need | null>(null);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchMyTasks();
      
      // Real-time subscription for my tasks
      const channel = supabase
        .channel('my-tasks')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'needs', filter: `assigned_volunteer_id=eq.${profile.id}` },
          () => fetchMyTasks()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  async function fetchMyTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('needs')
        .select('*, profiles:ngo_id(name)')
        .eq('assigned_volunteer_id', profile?.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (error: any) {
      console.error('Error fetching my tasks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, taskId: string) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${taskId}/${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('proof-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('proof-images')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      
      // Update task with new image URLs
      const currentTask = tasks.find(t => t.id === taskId);
      const updatedImages = [...(currentTask?.proof_images || []), ...urls];

      const { error: updateError } = await supabase
        .from('needs')
        .update({ proof_images: updatedImages })
        .eq('id', taskId);

      if (updateError) throw updateError;

      setTasks(tasks.map(t => t.id === taskId ? { ...t, proof_images: updatedImages } : t));
      if (selectedTask?.id === taskId) {
        setSelectedTask({ ...selectedTask, proof_images: updatedImages });
      }
    } catch (error: any) {
      console.error('Error uploading proof:', error);
      alert('Failed to upload proof. Make sure the "proof-images" bucket exists in Supabase Storage and is public.');
    } finally {
      setUploading(false);
    }
  }

  async function handleProofSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!proofModalTask || !proofImage || !profile?.id) return;

    setUploading(true);
    try {
      // 1. Get current location first
      toast.loading('Capturing geo-location...', { id: 'geo' });
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000 
        });
      }).catch(err => {
        console.error('Geo error:', err);
        return null;
      });
      toast.dismiss('geo');

      if (!position) {
        toast.error('Location is required for verification. Please enable GPS.');
        setUploading(false);
        return;
      }

      const { latitude, longitude } = position.coords;

      // 2. Upload image to 'task-proofs' bucket
      const fileExt = proofImage.name.split('.').pop();
      const fileName = `${proofModalTask.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(filePath, proofImage);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(filePath);

      // 3. Calculate distance if task has coordinates
      let distance = null;
      if (proofModalTask.latitude && proofModalTask.longitude) {
        const d = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3;
          const φ1 = lat1 * Math.PI/180;
          const φ2 = lat2 * Math.PI/180;
          const Δφ = (lat2-lat1) * Math.PI/180;
          const Δλ = (lon2-lon1) * Math.PI/180;
          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        distance = d(latitude, longitude, Number(proofModalTask.latitude), Number(proofModalTask.longitude));
      }

      // 4. Insert into task_proofs
      const { error: proofError } = await supabase
        .from('task_proofs')
        .insert({
          task_id: proofModalTask.id,
          volunteer_id: profile.id,
          image_url: publicUrl,
          latitude,
          longitude,
          distance,
          verification_status: 'Pending'
        });

      if (proofError) throw proofError;

      // 5. Update needs table
      const { data: needData } = await supabase
        .from('needs')
        .select('proof_images')
        .eq('id', proofModalTask.id)
        .single();

      const currentImages = needData?.proof_images || [];
      const updatedImages = [...currentImages, publicUrl];

      const { error: updateError } = await supabase
        .from('needs')
        .update({ 
          proof_submitted: true,
          proof_images: updatedImages
        })
        .eq('id', proofModalTask.id);

      if (updateError) throw updateError;

      // 6. Notify NGO
      await supabase.from('notifications').insert({
        user_id: proofModalTask.ngo_id,
        title: 'Task Proof Submitted',
        message: `Volunteer ${profile.name} has submitted geo-tagged proof for task: ${proofModalTask.title}`,
        type: 'proof_submission',
        task_id: proofModalTask.id
      });

      setTasks(tasks.map(t => t.id === proofModalTask.id ? { ...t, proof_submitted: true } : t));
      setProofModalTask(null);
      setProofImage(null);
      setProofPreview(null);
      toast.success('Proof submitted! NGO verification pending.');
    } catch (error: any) {
      console.error('Error submitting proof:', error);
      toast.error('Failed to submit proof. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  async function handleComplete(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.proof_submitted && !task.proof_images?.length) {
      toast.error('Please upload proof images first');
      return;
    }

    setUpdating(taskId);
    try {
      // 1. Get current location
      toast.loading('Verifying location...', { id: 'geo' });
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true,
          timeout: 10000 
        });
      });
      toast.dismiss('geo');

      const { latitude, longitude } = position.coords;
      
      // 2. Calculate distance if task has coordinates
      let distance = -1;
      let verificationStatus: 'Pending' | 'Verified' | 'Suspicious' = 'Pending';
      
      // Simple mock: if task has no coords, we'll use a 500m logic or just mark as Pending
      if (task.latitude && task.longitude) {
        // Import getDistance or define it
        const d = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3;
          const φ1 = lat1 * Math.PI/180;
          const φ2 = lat2 * Math.PI/180;
          const Δφ = (lat2-lat1) * Math.PI/180;
          const Δλ = (lon2-lon1) * Math.PI/180;
          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        distance = d(latitude, longitude, Number(task.latitude), Number(task.longitude));
        verificationStatus = distance <= 500 ? 'Verified' : 'Suspicious';
      }

      // 3. Update or create task proof entry
      const { data: existingProofs } = await supabase
        .from('task_proofs')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingProofs && existingProofs.length > 0) {
        await supabase
          .from('task_proofs')
          .update({
            latitude,
            longitude,
            distance: distance > 0 ? distance : null,
            verification_status: verificationStatus
          })
          .eq('id', existingProofs[0].id);
      } else {
        // Create a basic entry if only images were uploaded via handleFileUpload
        await supabase
          .from('task_proofs')
          .insert({
            task_id: taskId,
            volunteer_id: profile?.id,
            image_url: task.proof_images?.[0] || '',
            latitude,
            longitude,
            distance: distance > 0 ? distance : null,
            verification_status: verificationStatus
          });
      }

      // 4. Mark task as proof submitted (Wait for NGO verification)
      const { error: updateError } = await supabase
        .from('needs')
        .update({
          proof_submitted: true,
          proof_verified: verificationStatus === 'Verified'
        })
        .eq('id', taskId);

      if (updateError) throw updateError;
      
      toast.success(t('task_proof_submitted'));

      // 5. Notify user
      await supabase.from('notifications').insert({
        user_id: task.user_id,
        title: 'Task Completed',
        message: `Your request "${task.title}" has been completed by ${profile?.name}. Please confirm.`,
        type: 'task_completion',
        task_id: taskId
      });

      // 6. Update local state
      setTasks(tasks.map(t => t.id === taskId ? { 
        ...t, 
        status: 'Completed' as const, 
        completed_at: new Date().toISOString(),
        proof_submitted: true,
        proof_verified: verificationStatus === 'Verified'
      } : t));
      
      toast.success(verificationStatus === 'Verified' ? 'Task verified and completed!' : 'Task completed with location warning.');
      setFeedbackTask(task);
    } catch (error: any) {
      console.error('Completion error:', error);
      const msg = error.code === 1 ? 'Location access denied. Verification failed.' : 'Failed to complete task.';
      toast.error(msg);
      toast.dismiss('geo');
    } finally {
      setUpdating(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: true,
          deleted_at: now.toISOString(),
          auto_delete_at: autoDeleteAt.toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      setTasks(tasks.filter(t => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);

      toast((t) => (
        <div className="flex items-center gap-3">
          <span>Task moved to Recycle Bin</span>
          <button 
            onClick={async () => {
              toast.dismiss(t.id);
              await handleRestore(id);
            }}
            className="px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors uppercase tracking-wider"
          >
            Undo
          </button>
        </div>
      ), { duration: 5000 });
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete task');
    }
  }

  async function handleRestore(id: string) {
    try {
      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: false,
          deleted_at: null,
          auto_delete_at: null
        })
        .eq('id', id);

      if (error) throw error;
      fetchMyTasks();
      toast.success('Restored successfully');
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore');
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    try {
      const now = new Date();
      const autoDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('needs')
        .update({
          is_deleted: true,
          deleted_at: now.toISOString(),
          auto_delete_at: autoDeleteAt.toISOString()
        })
        .in('id', selectedIds);

      if (error) throw error;
      
      setTasks(tasks.filter(t => !selectedIds.includes(t.id)));
      const count = selectedIds.length;
      setSelectedIds([]);
      toast.success(`${count} tasks moved to Recycle Bin`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete tasks');
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === tasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tasks.map(t => t.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">Tasks you have accepted and are working on.</p>
            {profile?.avg_rating > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-100">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                {profile.avg_rating} Rating
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={() => fetchMyTasks()}
            disabled={loading}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading your tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No tasks accepted yet</h3>
            <p className="text-gray-500 mt-2">Go to Available Tasks to find missions to help with.</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4 relative group">
              <input 
                type="checkbox" 
                checked={selectedIds.includes(task.id)}
                onChange={() => toggleSelect(task.id)}
                className="absolute top-4 right-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-lg">{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      task.status === 'Completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {task.status === 'Assigned' ? 'In Progress' : task.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {task.location}
                    </div>
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {task.urgency}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <Info className="w-2.5 h-2.5" /> Assigned by:- {(task as any).profiles?.name || 'NGO'}
                    </div>
                  </div>
                </div>
                
                  <div className="flex items-center gap-3">
                    {task.status === 'Assigned' && (
                      <button 
                        onClick={() => setProofModalTask(task)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-100"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete Task
                      </button>
                    )}
                    {task.status === 'Completed' && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-100">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Completed
                      </div>
                    )}
                    {task.proof_submitted && task.status === 'Assigned' && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-100">
                        <Clock className="w-3.5 h-3.5" />
                        Pending NGO Verification
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedTask(task)}
                      className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors"
                    >
                      View Details
                    </button>
                  <button 
                    onClick={() => handleDelete(task.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove Task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {task.proof_images && task.proof_images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {task.proof_images.map((url, i) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt="Proof" 
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
              )}
              
              <div className="text-sm text-gray-600 line-clamp-2 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                "{task.description}"
              </div>
            </div>
          ))
        )}
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
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Assigned By NGO</h3>
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                      <Info className="w-4 h-4" />
                      <span className="text-sm font-bold">Assigned by:- {(selectedTask as any).profiles?.name || 'NGO'}</span>
                    </div>
                  </div>
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
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Posted On</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(selectedTask.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedTask.status === 'Completed' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Completed On</h3>
                      <p className="text-sm text-gray-900 font-medium">
                        {selectedTask.completed_at ? new Date(selectedTask.completed_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Proof of Completion</h3>
                      <div className="grid grid-cols-2 gap-4 mt-2">
                        {selectedTask.proof_images?.map((url, i) => (
                          <img 
                            key={i} 
                            src={url} 
                            alt={`Proof ${i + 1}`} 
                            className="w-full h-32 object-cover rounded-xl border border-gray-100"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setSelectedTask(null)}
                  className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Close
                </button>
                {selectedTask.status !== 'Completed' && (
                  <button 
                    disabled={updating === selectedTask.id}
                    onClick={() => handleComplete(selectedTask.id)}
                    className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                  >
                    {updating === selectedTask.id ? 'Updating...' : 'Mark as Done'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Proof Submission Modal */}
      <AnimatePresence>
        {proofModalTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setProofModalTask(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Submit Official Proof</h2>
                <button 
                  onClick={() => setProofModalTask(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleProofSubmit} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">1. Upload Image Proof</label>
                    <div 
                      onClick={() => proofInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer group"
                    >
                      {proofPreview ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden">
                          <img src={proofPreview} alt="Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-sm font-bold">Change Image</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Camera className="w-8 h-8 text-gray-400 mx-auto" />
                          <p className="text-sm text-gray-500 font-medium">Click to upload photo</p>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={proofInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProofImage(file);
                            setProofPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setProofModalTask(null)}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={uploading || !proofImage}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                      {uploading ? 'Submitting...' : 'Upload & Verify Location'}
                    </button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {feedbackTask && (
        <FeedbackModal
          isOpen={!!feedbackTask}
          onClose={() => setFeedbackTask(null)}
          ngoId={feedbackTask.ngo_id}
          needId={feedbackTask.id}
          ngoName={(feedbackTask as any).profiles?.name || 'NGO'}
        />
      )}
    </div>
  );
}
