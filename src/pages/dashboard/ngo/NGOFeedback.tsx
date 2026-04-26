import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Star, MessageSquare, Smile, Meh, Frown, Calendar, User } from 'lucide-react';
import type { Feedback } from '../../../types';

export default function NGOFeedback() {
  const { profile } = useAuth();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) {
      fetchFeedback();
      
      // Real-time subscription for new feedback
      const channel = supabase
        .channel('ngo-feedback')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'feedback', filter: `ngo_id=eq.${profile.id}` },
          () => fetchFeedback()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id]);

  async function fetchFeedback() {
    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*, user:user_id(name)')
        .eq('ngo_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  }

  const sentimentStats = {
    positive: feedbacks.filter(f => f.sentiment_type === 'Positive').length,
    neutral: feedbacks.filter(f => f.sentiment_type === 'Neutral').length,
    negative: feedbacks.filter(f => f.sentiment_type === 'Negative').length,
    total: feedbacks.length
  };

  const positivePercent = sentimentStats.total > 0 
    ? Math.round((sentimentStats.positive / sentimentStats.total) * 100) 
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Community Feedback</h1>
        <p className="text-gray-600">See what volunteers and donors are saying about your impact.</p>
      </div>

      {/* Sentiment Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <Smile className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Positive</p>
            <p className="text-2xl font-bold text-gray-900">{positivePercent}%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
            <Meh className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Neutral</p>
            <p className="text-2xl font-bold text-gray-900">
              {sentimentStats.total > 0 ? Math.round((sentimentStats.neutral / sentimentStats.total) * 100) : 0}%
            </p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
            <Frown className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Negative</p>
            <p className="text-2xl font-bold text-gray-900">
              {sentimentStats.total > 0 ? Math.round((sentimentStats.negative / sentimentStats.total) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          Recent Reviews
        </h2>
        
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">Loading feedback...</div>
          ) : feedbacks.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 italic">
              No feedback received yet.
            </div>
          ) : (
            feedbacks.map((feedback) => (
              <div key={feedback.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {feedback.user?.name?.[0] || <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{feedback.user?.name || 'Anonymous User'}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-3 h-3 ${i < feedback.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} 
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(feedback.created_at).toLocaleDateString()}
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      feedback.sentiment_type === 'Positive' ? 'bg-green-50 text-green-600' :
                      feedback.sentiment_type === 'Negative' ? 'bg-red-50 text-red-600' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {feedback.sentiment_type === 'Positive' ? <Smile className="w-3 h-3" /> :
                       feedback.sentiment_type === 'Negative' ? <Frown className="w-3 h-3" /> :
                       <Meh className="w-3 h-3" />}
                      {feedback.sentiment_type}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed italic">"{feedback.comment}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
