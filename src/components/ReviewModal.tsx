import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Star, X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  ngoId: string;
}

export default function ReviewModal({ isOpen, onClose, taskId, taskTitle }: ReviewModalProps) {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isResolved, setIsResolved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || isResolved === null) return;

    setLoading(true);
    try {
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          task_id: taskId,
          user_id: profile.id,
          rating,
          comment: `[Resolved: ${isResolved ? 'Yes' : 'No'}] ${comment}`
        });

      if (reviewError) throw reviewError;

      // Update need status: if it was completed, we keep it completed. If reopened, we might handle it.
      // For now, feedback confirms it's done.
      const { error: updateError } = await supabase
        .from('needs')
        .update({ status: isResolved ? 'Completed' : 'Assigned' }) 
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast.success(t('rev_success'));
      onClose();
    } catch (error: any) {
      console.error('Review error:', error);
      toast.error(t('rev_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{t('rev_title')}</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm font-medium text-blue-800">{t('rev_reviewing')}: {taskTitle}</p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('rev_resolved_q')}</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsResolved(true)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                      isResolved === true 
                        ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-green-600'
                    }`}
                  >
                    {t('rev_yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsResolved(false)}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all border ${
                      isResolved === false 
                        ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100' 
                        : 'bg-white border-gray-200 text-gray-600 hover:border-red-600'
                    }`}
                  >
                    {t('rev_no')}
                  </button>
                </div>
              </div>

              <div className="space-y-3 text-center">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('rev_rate_vol')}</label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('rev_experience_label')}</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder={t('rev_experience_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              <button
                disabled={loading || isResolved === null}
                type="submit"
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? t('rev_submitting') : <><Send className="w-5 h-5" /> {t('rev_submit_btn')}</>}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
