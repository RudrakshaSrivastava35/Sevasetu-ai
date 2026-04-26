import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { analyzeSentiment } from '../services/sentimentService';
import { Star, X, Send, Loader2, Smile, Meh, Frown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  ngoId: string;
  needId: string;
  ngoName: string;
}

export default function FeedbackModal({ isOpen, onClose, ngoId, needId, ngoName }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) return;

    setSubmitting(true);
    try {
      // 1. Analyze Sentiment
      const { sentiment, score } = await analyzeSentiment(comment);

      // 2. Submit Feedback
      const { data: feedback, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          ngo_id: ngoId,
          need_id: needId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          rating,
          comment,
          sentiment_type: sentiment,
          sentiment_score: score
        })
        .select()
        .single();

      if (feedbackError) throw feedbackError;

      // 3. Update NGO Stats (In a real app, this would be a database trigger)
      // For this demo, we'll do it manually
      const { data: profiles } = await supabase.from('profiles').select('*').eq('id', ngoId).limit(1);
      const ngoData = profiles?.[0];
      if (ngoData) {
        const newTotalReviews = (ngoData.total_reviews || 0) + 1;
        const newAvgRating = ((ngoData.avg_rating || 0) * (ngoData.total_reviews || 0) + rating) / newTotalReviews;
        
        // Calculate positive feedback %
        const { data: allFeedback } = await supabase.from('feedback').select('sentiment_type').eq('ngo_id', ngoId);
        const positiveCount = allFeedback?.filter(f => f.sentiment_type === 'Positive').length || 0;
        const newPositivePercent = Math.round((positiveCount / newTotalReviews) * 100);

        // Verification Logic
        const isVerified = newAvgRating >= 4.2 && (ngoData.completed_tasks_count || 0) >= 20 && newPositivePercent >= 80;

        await supabase.from('profiles').update({
          avg_rating: newAvgRating,
          total_reviews: newTotalReviews,
          positive_feedback_percent: newPositivePercent,
          is_verified: isVerified
        }).eq('id', ngoId);
      }

      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

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
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600">
              <h2 className="text-xl font-bold text-white">Rate your experience</h2>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              <div className="text-center space-y-2">
                <p className="text-gray-500 text-sm uppercase font-bold tracking-widest">How was your work with</p>
                <h3 className="text-2xl font-bold text-gray-900">{ngoName}</h3>
              </div>

              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star 
                      className={`w-10 h-10 ${
                        star <= (hoveredRating || rating) 
                          ? 'text-amber-400 fill-amber-400' 
                          : 'text-gray-200'
                      }`} 
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-700 uppercase tracking-widest">
                  Your Comments
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us about your experience..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 bg-gray-50 p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <Smile className="w-4 h-4" />
                  <span>AI Sentiment Analysis Enabled</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={rating === 0 || submitting}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing & Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Feedback
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
