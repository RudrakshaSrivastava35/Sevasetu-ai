import React, { useState, useEffect } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Heart, ArrowRight, Building2, Wallet, Users, Layout as LayoutIcon, CheckCircle2, Filter, MapPin, Search, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Need } from '../../../types';

export default function Donation() {
  const { profile } = useAuth();
  const [causes, setCauses] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [donatingId, setDonatingId] = useState<string | null>(null);
  const [customAmounts, setCustomAmounts] = useState<{[key: string]: string}>({});
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>(profile?.location || '');
  const [isFilterActive, setIsFilterActive] = useState(false);

  const categories = ['All', 'Medical', 'Education', 'Food', 'Social', 'Other'];

  useEffect(() => {
    if (profile?.location && !selectedLocation) {
      setSelectedLocation(profile.location);
    }
  }, [profile]);

  useEffect(() => {
    fetchCauses();
    
    // Subscribe to needs changes for real-time progress updates
    const channel = supabase
      .channel('donation-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'needs' }, () => {
        fetchCauses();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCategory, selectedLocation]);

  async function fetchCauses() {
    setLoading(true);
    try {
      let query = supabase
        .from('needs')
        .select('*, profiles:ngo_id(name, verification_status)')
        .eq('donation_enabled', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      // Apply Filters
      if (selectedCategory !== 'All') {
        query = query.eq('category', selectedCategory);
      }
      if (selectedLocation) {
        query = query.ilike('location', `%${selectedLocation}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fallback Logic: If no exact matches for filtered state
      if (data && data.length === 0 && (selectedCategory !== 'All' || selectedLocation)) {
        setIsFilterActive(false);
        // Try same category different location if location was set
        if (selectedLocation) {
           let fallbackQuery = supabase
            .from('needs')
            .select('*, profiles:ngo_id(name, verification_status)')
            .eq('donation_enabled', true)
            .eq('is_deleted', false);
          
          if (selectedCategory !== 'All') {
            fallbackQuery = fallbackQuery.eq('category', selectedCategory);
          }
          
          const { data: fallbackData } = await fallbackQuery.order('created_at', { ascending: false }).limit(5);
          if (fallbackData && fallbackData.length > 0) {
            setCauses(fallbackData);
            return;
          }
        }
        
        // Final fallback: just show all active fundraisers
        const { data: allData } = await supabase
          .from('needs')
          .select('*, profiles:ngo_id(name, verification_status)')
          .eq('donation_enabled', true)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(10);
        
        setCauses(allData || []);
      } else {
        setIsFilterActive(true);
        setCauses(data || []);
      }
    } catch (error) {
      console.error('Error fetching causes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDonate(needId: string, amount: number) {
    if (!profile?.id) {
      toast.error('Please login to donate');
      return;
    }

    if (amount < 10) {
      toast.error('Minimum donation is ₹10');
      return;
    }

    setDonatingId(needId);
    try {
      // 1. Insert donation record
      const { error: donationError } = await supabase
        .from('donations')
        .insert({
          user_id: profile.id,
          need_id: needId,
          amount: amount
        });

      if (donationError) throw donationError;

      // 2. Update raised_amount in needs table using rpc or direct update
      // Since we don't have a specific RPC, let's fetch current and update (prone to race conditions but okay for demo)
      const need = causes.find(c => c.id === needId);
      if (need) {
        const newRaised = (need.raised_amount || 0) + amount;
        const { error: updateError } = await supabase
          .from('needs')
          .update({ raised_amount: newRaised })
          .eq('id', needId);

        if (updateError) throw updateError;
      }

      toast.success('Thank you for your generous contribution!');
      fetchCauses();
    } catch (error: any) {
      toast.error(handleSupabaseError(error));
    } finally {
      setDonatingId(null);
    }
  }

  const handleCustomAmountChange = (needId: string, value: string) => {
    setCustomAmounts(prev => ({ ...prev, [needId]: value }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Support a Cause</h1>
          <p className="text-gray-600">Your direct contribution makes an immediate impact on these community needs.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-100 italic text-sm font-medium">
          <Wallet className="w-4 h-4" />
          Demo Mode: No real charges applied
        </div>
      </div>

      {/* Smart Filters */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Filter className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Smart Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Category</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium text-gray-900 appearance-none"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Near Location</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by city..."
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium text-gray-900"
              />
            </div>
          </div>

          <div className="flex items-end pb-1">
            <div className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
              isFilterActive 
                ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                : 'bg-amber-50 text-amber-700 border border-amber-100'
            }`}>
              {isFilterActive ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Showing Personalized Results
                </>
              ) : (
                <>
                  <LayoutIcon className="w-3.5 h-3.5" />
                  Showing Broad Results (No direct match)
                </>
              )}
            </div>
          </div>
        </div>

        {(selectedCategory !== 'All' || selectedLocation) && (
          <div className="pt-2 flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Active Filters:</span>
            {selectedCategory !== 'All' && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold">{selectedCategory}</span>
            )}
            {selectedLocation && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold">{selectedLocation}</span>
            )}
            <button 
              onClick={() => {
                setSelectedCategory('All');
                setSelectedLocation(profile?.location || '');
              }}
              className="text-[10px] font-bold text-blue-600 hover:underline ml-2"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {loading ? (
          <div className="col-span-full py-24 flex flex-col items-center justify-center text-gray-500 gap-4">
            <LayoutIcon className="w-12 h-12 animate-pulse text-gray-300" />
            <p className="font-medium animate-pulse">Finding active fundraisers...</p>
          </div>
        ) : causes.length === 0 ? (
          <div className="col-span-full bg-white p-16 rounded-3xl border border-dashed border-gray-200 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
              <Heart className="w-10 h-10 text-gray-300" />
            </div>
            <div>
              <p className="text-gray-900 font-bold text-xl">No active fundraisers found</p>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">NGOs have not enabled donations for any community needs yet. Check back later!</p>
            </div>
          </div>
        ) : (
          causes.map((item) => {
            const raised = item.raised_amount || 0;
            const target = item.target_amount || 1;
            const progress = Math.min(Math.round((raised / target) * 100), 100);
            const isCompleted = raised >= target;
            const isNgoVerified = (item as any).profiles?.verification_status === 'Verified';
            const customAmount = customAmounts[item.id] || '';

            return (
              <div key={item.id} className={`bg-white rounded-3xl border transition-all duration-300 flex flex-col ${
                isCompleted 
                  ? 'border-green-100 bg-green-50/10' 
                  : 'border-gray-100 hover:shadow-xl hover:shadow-blue-50/50 hover:border-blue-100'
              }`}>
                <div className="p-8 space-y-6 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-1">
                        <Building2 className="w-3 h-3" />
                        <span>{(item as any).profiles?.name || 'Partner NGO'}</span>
                        {isNgoVerified && <CheckCircle2 className="w-3 h-3" />}
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        {item.title}
                        {isCompleted && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                      </h3>
                    </div>
                    <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-500'}`}>
                      <Heart className={`w-6 h-6 ${isCompleted ? 'fill-current' : ''}`} />
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{item.description}</p>
                  
                  {!isNgoVerified && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-700 text-xs font-medium flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        Donations are temporarily locked while this NGO is undergoing verification. 
                        We only allow contributions to verified partners for your safety.
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-end justify-between">
                      <div className="space-y-1 text-center sm:text-left">
                        <p className="text-2xl font-black text-gray-900 tracking-tight">₹{raised.toLocaleString()}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Raised of ₹{target.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-black tracking-tight ${isCompleted ? 'text-green-600' : 'text-blue-600'}`}>{progress}%</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Funded</p>
                      </div>
                    </div>

                    <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
                          isCompleted ? 'bg-green-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      >
                        {progress > 10 && <div className="w-full h-full bg-white/20 animate-pulse" />}
                      </div>
                    </div>
                  </div>

                  {!isCompleted && isNgoVerified && (
                    <div className="space-y-6 pt-4 animate-in fade-in zoom-in-95 duration-500">
                      <div className="grid grid-cols-3 gap-3">
                        {[100, 500, 1000].map(amt => (
                          <button 
                            key={amt}
                            onClick={() => handleDonate(item.id, amt)}
                            disabled={donatingId !== null}
                            className="py-3 bg-gray-50 text-gray-700 rounded-2xl font-bold hover:bg-blue-50 hover:text-blue-600 border border-transparent hover:border-blue-100 transition-all text-sm active:scale-95 disabled:opacity-50"
                          >
                            ₹{amt}
                          </button>
                        ))}
                      </div>

                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold group-focus-within:text-blue-600 transition-colors">₹</span>
                        <input 
                          type="number" 
                          placeholder="Custom amount (min ₹10)"
                          value={customAmount}
                          onChange={(e) => handleCustomAmountChange(item.id, e.target.value)}
                          className="w-full pl-9 pr-24 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium text-gray-900"
                        />
                        <button 
                          onClick={() => {
                            const amt = parseFloat(customAmount);
                            if (amt >= 10) handleDonate(item.id, amt);
                            else toast.error('Minimum amount is ₹10');
                          }}
                          disabled={donatingId !== null || !customAmount}
                          className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95 disabled:opacity-50 disabled:shadow-none"
                        >
                          {donatingId === item.id ? '...' : 'Donate'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className={`px-8 py-4 flex items-center justify-between border-t transition-colors ${
                  isCompleted ? 'bg-green-50 border-green-100 rounded-b-3xl' : 'bg-gray-50/50 border-gray-50 rounded-b-3xl'
                }`}>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {isNgoVerified ? (
                       <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                       <Clock className="w-3 h-3 text-orange-400" />
                    )}
                    <span>{isNgoVerified ? 'Verified Partner' : 'Verification Pending'}</span>
                  </div>
                  {isCompleted ? (
                    <span className="text-[10px] font-black text-green-700 uppercase tracking-[0.2em] animate-pulse">Fully Funded</span>
                  ) : (
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Urgent Aid</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-blue-100 relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-white/20 transition-all duration-700" />
        
        <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10 text-center sm:text-left">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 shadow-xl">
            <Heart className="w-10 h-10 text-white fill-white/20" />
          </div>
          <div>
            <h4 className="text-2xl font-black mb-1">Make a bigger impact</h4>
            <p className="text-blue-100 font-medium">Your donation goes directly to supporting field operations and logistics managed by our partner NGOs.</p>
          </div>
        </div>
        
        <button className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-xl active:scale-95 group-hover:translate-x-1 duration-300 relative z-10 flex items-center gap-2">
          Contact Support <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
