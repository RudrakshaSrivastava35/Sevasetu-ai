import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { CheckCircle2, XCircle, Clock, MapPin, ExternalLink, ShieldCheck, AlertTriangle, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { TaskProof, Need, Review } from '../../../types';

interface ProofWithTask extends TaskProof {
  task: Need;
  volunteer: { name: string; id: string };
  review?: Review;
}

export default function TaskProofs() {
  const { profile } = useAuth();
  const [proofs, setProofs] = useState<ProofWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchProofs();
    }
  }, [profile?.id]);

  async function fetchProofs() {
    try {
      const { data, error } = await supabase
        .from('task_proofs')
        .select(`
          *, 
          task:task_id!inner(*), 
          volunteer:volunteer_id(name, id)
        `)
        .eq('task.ngo_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch reviews for these tasks
      const taskIds = data?.map(p => p.task_id) || [];
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .in('task_id', taskIds);

      const proofsWithReviews = data?.map(proof => ({
        ...proof,
        review: reviews?.find((r: any) => r.task_id === proof.task_id)
      }));

      setProofs(proofsWithReviews || []);
    } catch (error) {
      console.error('Error fetching proofs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(proofId: string, taskId: string, action: 'Verified' | 'Rejected') {
    setProcessing(proofId);
    try {
      // Update proof status
      const { error: proofError } = await supabase
        .from('task_proofs')
        .update({ verification_status: action })
        .eq('id', proofId);

      if (proofError) throw proofError;

      if (action === 'Verified') {
        // Update task status
        const { error: taskError } = await supabase
          .from('needs')
          .update({ 
            status: 'Completed',
            proof_verified: true,
            completed_at: new Date().toISOString()
          })
          .eq('id', taskId);

        if (taskError) throw taskError;
      }

      setProofs(proofs.map(p => p.id === proofId ? { ...p, verification_status: action } : p));
      
      // Notify volunteer
      const proof = proofs.find(p => p.id === proofId);
      if (proof) {
        await supabase.from('notifications').insert({
          user_id: proof.volunteer_id,
          title: action === 'Verified' ? 'Task Proof Approved!' : 'Task Proof Rejected',
          message: action === 'Verified' 
            ? `Your proof for "${proof.task.title}" has been verified. Great job!`
            : `Your proof for "${proof.task.title}" was rejected by the NGO. Please check and re-submit if needed.`,
          type: 'proof_result'
        });
      }

    } catch (error) {
      console.error('Error processing proof:', error);
      alert('Failed to process action. Please try again.');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Task Proofs</h1>
        <p className="text-gray-500 text-sm">Review and verify task completion proofs submitted by volunteers.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : proofs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 text-center space-y-3">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No proofs submitted yet</h3>
          <p className="text-gray-500 max-w-xs mx-auto">When volunteers submit completion proofs, they will appear here for your review.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {proofs.map((proof) => (
            <motion.div
              key={proof.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
            >
                <div className="aspect-video relative group">
                  <img 
                    src={proof.image_url} 
                    alt="Task Proof" 
                    className="w-full h-full object-cover"
                  />
                  <a 
                    href={proof.image_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> View Full Size
                    </span>
                  </a>
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm ${
                      proof.verification_status === 'Verified' ? 'bg-green-500 text-white' :
                      proof.verification_status === 'Rejected' ? 'bg-red-500 text-white' :
                      'bg-amber-500 text-white'
                    }`}>
                      {proof.verification_status}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col space-y-4">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{proof.task.title}</h3>
                    <p className="text-sm text-gray-500">Submitted by <span className="font-bold text-gray-700">{proof.volunteer.name}</span></p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>Submitted on {new Date(proof.created_at).toLocaleString()}</span>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span className="text-xs font-medium text-gray-600">Location Match</span>
                      </div>
                      {proof.distance ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          proof.distance <= 500 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {proof.distance < 1000 ? `${Math.round(proof.distance)}m` : `${(proof.distance/1000).toFixed(1)}km`}
                          {proof.distance <= 500 ? ' (Likely Valid)' : ' (Suspicious)'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No GPS data</span>
                      )}
                    </div>

                    {proof.review && (
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">User Confirmation</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-2.5 h-2.5 ${i < proof.review!.rating ? 'fill-amber-500 text-amber-500' : 'text-amber-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-amber-900 italic line-clamp-2">"{proof.review.comment}"</p>
                      </div>
                    )}
                  </div>

                  {proof.verification_status === 'Pending' && (
                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={() => handleAction(proof.id, proof.task_id, 'Rejected')}
                        disabled={!!processing}
                        className="flex-1 py-3 border border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleAction(proof.id, proof.task_id, 'Verified')}
                        disabled={!!processing}
                        className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
