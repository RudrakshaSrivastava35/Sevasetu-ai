import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError } from '../lib/supabase';
import Layout from '../components/Layout';
import { Trophy, Star, CheckCircle2, TrendingUp, ShieldCheck, AlertCircle } from 'lucide-react';
import type { Profile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

export default function Leaderboard() {
  const { t } = useLanguage();
  const [ngos, setNgos] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'tasks' | 'trusted'>('rating');

  useEffect(() => {
    fetchLeaderboard();
    
    // Real-time subscription for leaderboard updates
    const channel = supabase
      .channel('leaderboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: 'role=eq.ngo' },
        () => fetchLeaderboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sortBy]);

  async function fetchLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ngo');

      if (sortBy === 'rating') {
        query = query.order('avg_rating', { ascending: false });
      } else if (sortBy === 'tasks') {
        query = query.order('completed_tasks_count', { ascending: false });
      } else if (sortBy === 'trusted') {
        query = query.order('positive_feedback_percent', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      setNgos(data || []);
    } catch (error: any) {
      console.error('Error fetching leaderboard:', error);
      setError(handleSupabaseError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <Trophy className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">{t('lead_title')}</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('lead_subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => setSortBy('rating')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              sortBy === 'rating' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t('lead_top_rated')}
          </button>
          <button
            onClick={() => setSortBy('tasks')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              sortBy === 'tasks' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t('lead_most_active')}
          </button>
          <button
            onClick={() => setSortBy('trusted')}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              sortBy === 'trusted' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {t('lead_most_trusted')}
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
          {error && (
            <div className="p-8 bg-red-50 border-b border-red-100 flex items-center justify-between text-red-800">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button 
                onClick={fetchLeaderboard}
                className="text-xs font-bold underline uppercase tracking-wider hover:text-red-900"
              >
                {t('common_retry')}
              </button>
            </div>
          )}
          {loading ? (
            <div className="p-12 text-center text-gray-500">{t('lead_loading')}</div>
          ) : ngos.length === 0 ? (
            <div className="p-12 text-center text-gray-500">{t('lead_no_found')}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {ngos.map((ngo, index) => (
                <div key={ngo.id} className="p-6 flex flex-col sm:flex-row items-center gap-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-6 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl ${
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-slate-100 text-slate-600' :
                      index === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-50 text-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900">{ngo.name}</h3>
                        {ngo.is_verified && (
                          <ShieldCheck className="w-5 h-5 text-blue-600 fill-blue-50" title={t('dash_verified')} />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                          {ngo.avg_rating?.toFixed(1) || '0.0'} ({ngo.total_reviews || 0} {t('lead_reviews')})
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {ngo.completed_tasks_count || 0} {t('lead_tasks')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t('lead_trust_score')}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              (ngo.positive_feedback_percent || 0) > 80 ? 'bg-green-500' :
                              (ngo.positive_feedback_percent || 0) > 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${ngo.positive_feedback_percent || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900">{ngo.positive_feedback_percent || 0}%</span>
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <TrendingUp className={`w-6 h-6 ${
                        (ngo.positive_feedback_percent || 0) > 80 ? 'text-green-500' : 'text-gray-300'
                      }`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
