import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Users, CheckCircle2, Clock, MapPin, Search, X, AlertCircle, Calendar, Trash2, Star, Send, Bell, RotateCcw, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import type { Need } from '../../../types';
import { useLanguage } from '../../../contexts/LanguageContext';

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

export default function ManageNeeds() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [undoing, setUndoing] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchNeeds();

      const channel = supabase
        .channel('manage-needs-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'needs' },
          () => fetchNeeds()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id, profile?.ngo_type]);

  async function fetchNeeds() {
    if (!profile?.id) return;
    
    try {
      // Robust Fetch Logic: Show needs assigned to this NGO OR needs of their category
      let query = supabase
        .from('needs')
        .select('*, volunteer:assigned_volunteer_id(name, avg_rating)')
        .eq('is_deleted', false);

      if (profile.ngo_type) {
        const ngo_type_lower = profile.ngo_type.toLowerCase();
        // Show if: (Explicitly assigned to this NGO) OR (Unassigned, Pending, and strictly matches NGO Category)
        query = query.or(`ngo_id.eq.${profile.id},and(ngo_id.is.null,category.eq.${ngo_type_lower},status.eq.Pending)`);
      } else {
        query = query.eq('ngo_id', profile.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      
      // Secondary Client-Side Guard: Strictly filter by category for unassigned tasks
      const filteredResults = (data || []).filter(need => {
        if (need.ngo_id === profile.id) return true;
        if (!need.ngo_id && need.status === 'Pending') {
          return need.category?.toLowerCase() === profile.ngo_type?.toLowerCase();
        }
        return false;
      });

      setNeeds(filteredResults);
    } catch (error) {
      console.error('Error fetching needs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const needToDelete = needs.find(n => n.id === id);
    if (!needToDelete) return;

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
      
      const newNeeds = needs.filter(n => n.id !== id);
      setNeeds(newNeeds);
      if (selectedNeed?.id === id) setSelectedNeed(null);

      toast((t) => (
        <div className="flex items-center gap-3">
          <span>Need moved to Recycle Bin</span>
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
      console.error('Error deleting need:', error);
      toast.error('Failed to delete need');
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
      fetchNeeds(); // Refresh to get the restored item back
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
      
      setNeeds(needs.filter(n => !selectedIds.includes(n.id)));
      const deletedCount = selectedIds.length;
      setSelectedIds([]);

      toast.success(`${deletedCount} items moved to Recycle Bin`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('Failed to delete multiple items');
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredNeeds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNeeds.map(n => n.id));
    }
  };

  async function notifyVolunteers(need: Need) {
    setNotifying(need.id);
    const loadingToast = toast.loading('Finding nearby volunteers...');

    try {
      // Find all active volunteers
      const { data: volunteers, error: volError } = await supabase
        .from('profiles')
        .select('id, name, skills, location, latitude, longitude, verification_status')
        .eq('role', 'volunteer');

      if (volError) throw volError;
      
      if (!volunteers || volunteers.length === 0) {
        toast.dismiss(loadingToast);
        toast.error(`No volunteers registered in the system yet.`, { duration: 4000 });
        return;
      }

      // Filter by proximity and relevance
      const nearbyVolunteers = volunteers.filter(v => {
        // Normalize locations
        const needLoc = (need.location || '').toLowerCase().trim();
        const volLoc = (v.location || '').toLowerCase().trim();

        // 1. GPS Distance Check (if both have lats/lngs)
        let isNearby = false;
        if (need.latitude && need.longitude && v.latitude && v.longitude) {
          const dist = calculateDistance(
            need.latitude, 
            need.longitude, 
            v.latitude, 
            v.longitude
          );
          if (dist <= 15) isNearby = true;
        } 
        
        // 2. City/Location string match fallback
        // Check if either string contains the other, or if they share keywords (e.g. "Lucknow" match "Lucknow City")
        const cityMatch = (volLoc && needLoc) && (
          volLoc.includes(needLoc) || 
          needLoc.includes(volLoc) ||
          volLoc.split(/[\s,]+/).some(word => word.length > 3 && needLoc.includes(word)) ||
          needLoc.split(/[\s,]+/).some(word => word.length > 3 && volLoc.includes(word))
        );

        if (!isNearby && !cityMatch) return false;

        // 3. Skills checking - be inclusive
        // If they have no skills specified, treat them as generalists (always match)
        if (!v.skills || v.skills.length === 0 || (v.skills.length === 1 && !v.skills[0])) {
          return true;
        }
        
        const needCat = (need.category || '').toLowerCase().trim();
        // Match if any skill includes the category or vice versa, OR if they have "Help" or "Service" generalist skills
        return v.skills.some(skill => {
          if (!skill) return false;
          const s = skill.toLowerCase().trim();
          return s.includes(needCat) || 
                 needCat.includes(s) || 
                 s.includes('help') || 
                 s.includes('service') ||
                 s.includes('volunteer');
        });
      });

      // If no volunteers matched with skills, fall back to ANYONE in the same city/area
      let directMatches = nearbyVolunteers;
      if (directMatches.length === 0) {
        // Last resort: Fallback to any volunteer in the same city/proxmity ignoring skills
        directMatches = volunteers.filter(v => {
            const needLoc = (need.location || '').toLowerCase().trim();
            const volLoc = (v.location || '').toLowerCase().trim();
            
            const cityMatch = (volLoc && needLoc) && (volLoc.includes(needLoc) || needLoc.includes(volLoc));
            
            if (cityMatch) return true;
            
            if (need.latitude && need.longitude && v.latitude && v.longitude) {
                const dist = calculateDistance(need.latitude, need.longitude, v.latitude, v.longitude);
                return dist <= 25; // Slightly larger radius for fallback
            }
            return false;
        });
      }

      if (directMatches.length === 0) {
        toast.dismiss(loadingToast);
        toast.error(`No volunteers found in ${need.location || 'this area'}.`, { duration: 4000 });
        return;
      }

      const notifications = directMatches.map(v => ({
        user_id: v.id,
        task_id: need.id,
        title: '📍 Nearby Help Needed!',
        message: `NGO ${profile?.name} is looking for help: "${need.title}" in ${need.location}.`,
        type: 'task_alert'
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) throw notifError;
      
      // Also mark the NGO as the one managing this need if not already set
      if (!need.ngo_id) {
        await supabase
          .from('needs')
          .update({ ngo_id: profile?.id })
          .eq('id', need.id);
        fetchNeeds();
      }
      
      toast.dismiss(loadingToast);
      toast.success(`Notifications sent to ${directMatches.length} nearby volunteers!`, { icon: '🔔' });

    } catch (error: any) {
      console.error('Error notifying volunteers:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to notify volunteers: ' + error.message);
    } finally {
      setNotifying(null);
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  const filteredNeeds = needs.filter(need => {
    const matchesSearch = need.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          need.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          need.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // Strict category filtering in client side too (Extra safety)
    if (need.ngo_id === profile?.id) return true;
    if (!need.ngo_id && profile?.ngo_type) {
        return need.category?.toLowerCase() === profile.ngo_type.toLowerCase();
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Needs</h1>
          <p className="text-gray-500 text-sm">Track and manage community requests.</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold hover:bg-red-100 transition-all border border-red-100"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search needs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={filteredNeeds.length > 0 && selectedIds.length === filteredNeeds.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Problem</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Time & Urgency</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Volunteer</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading needs...</td>
                </tr>
              ) : filteredNeeds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No needs found.</td>
                </tr>
              ) : (
                filteredNeeds.map((need) => (
                  <tr key={need.id} className={`hover:bg-gray-50/50 transition-colors ${need.urgency === 'High' && need.status === 'Pending' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(need.id)}
                        onChange={() => toggleSelect(need.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{need.title}</div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                        <MapPin className="w-3 h-3" /> {need.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                          <Clock className="w-3 h-3" /> {new Date(need.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                          need.urgency === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                          need.urgency === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-green-50 text-green-700 border-green-100'
                        )}>
                          {need.urgency}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {need.status === 'Pending' && <Clock className="w-4 h-4 text-gray-400" />}
                        {need.status === 'Assigned' && !need.proof_submitted && <Users className="w-4 h-4 text-orange-500" />}
                        {need.status === 'Assigned' && need.proof_submitted && <AlertCircle className="w-4 h-4 text-amber-500" />}
                        {need.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          need.status === 'Pending' ? 'text-gray-500' :
                          need.status === 'Assigned' ? (need.proof_submitted ? 'text-amber-600' : 'text-orange-600') :
                          'text-green-600'
                        )}>
                          {need.status === 'Pending' ? t('dash_status_pending') : 
                           need.status === 'Assigned' ? t('dash_status_assigned') : 
                           t('dash_status_completed')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {need.assigned_volunteer_id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-bold text-blue-600">
                            {(need as any).volunteer?.name?.[0] || 'V'}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-gray-600 font-medium">{(need as any).volunteer?.name || 'Assigned'}</span>
                            {(need as any).volunteer?.avg_rating > 0 && (
                              <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                                <Star className="w-2.5 h-2.5 fill-amber-500" />
                                {(need as any).volunteer.avg_rating}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={() => setSelectedNeed(need)}
                          className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          View
                        </button>
                        {need.ngo_id === profile?.id && (
                          <button 
                            onClick={() => handleDelete(need.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Need"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedNeed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedNeed(null)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Need Details</h2>
                <button 
                  onClick={() => setSelectedNeed(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Problem</h3>
                  <p className="text-lg font-bold text-gray-900">{selectedNeed.title}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Description</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedNeed.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Category</h3>
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-bold capitalize",
                      selectedNeed.category === 'medical' ? 'bg-red-50 text-red-700' :
                      selectedNeed.category === 'education' ? 'bg-blue-50 text-blue-700' :
                      selectedNeed.category === 'food' ? 'bg-green-50 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    )}>
                      {selectedNeed.category}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Urgency</h3>
                    <div className={cn(
                      "inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium",
                      selectedNeed.urgency === 'High' ? 'bg-red-50 text-red-700' :
                      selectedNeed.urgency === 'Medium' ? 'bg-orange-50 text-orange-700' :
                      'bg-green-50 text-green-700'
                    )}>
                      <AlertCircle className="w-4 h-4" />
                      {selectedNeed.urgency}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Location</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{selectedNeed.location}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Posted On</h3>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">
                        {new Date(selectedNeed.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {(selectedNeed.status === 'Completed' || selectedNeed.proof_submitted) && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                          {selectedNeed.status === 'Completed' ? 'Completed By' : 'Assigned To'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-900 font-medium">{(selectedNeed as any).volunteer?.name || 'Volunteer'}</p>
                          {(selectedNeed as any).volunteer?.avg_rating > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold">
                              <Star className="w-3 h-3 fill-amber-500" />
                              {(selectedNeed as any).volunteer.avg_rating}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">
                          {selectedNeed.status === 'Completed' ? 'Completed On' : 'Submission Status'}
                        </h3>
                        <p className="text-sm text-gray-900 font-medium">
                          {selectedNeed.status === 'Completed' 
                            ? (selectedNeed.completed_at ? new Date(selectedNeed.completed_at).toLocaleString() : 'N/A')
                            : (selectedNeed.proof_submitted ? 'Proof Submitted' : 'Pending')}
                        </p>
                      </div>
                    </div>
                    {selectedNeed.proof_images && selectedNeed.proof_images.length > 0 && (
                      <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Proof of Completion</h3>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          {selectedNeed.proof_images.map((url, i) => (
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
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        selectedNeed.status === 'Completed' ? 'bg-green-100' :
                        selectedNeed.status === 'Assigned' ? 'bg-orange-100' :
                        'bg-gray-100'
                      )}>
                        {selectedNeed.status === 'Completed' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {selectedNeed.status === 'Assigned' && <Users className="w-5 h-5 text-orange-600" />}
                        {selectedNeed.status === 'Pending' && <Clock className="w-5 h-5 text-gray-600" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Status</p>
                        <p className="font-bold text-gray-900">{selectedNeed.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                {selectedNeed.status === 'Pending' && (
                  <button 
                    onClick={() => notifyVolunteers(selectedNeed)}
                    disabled={!!notifying}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    <Bell className="w-4 h-4" />
                    {notifying === selectedNeed.id ? 'Sending...' : 'Notify Nearby Volunteers'}
                  </button>
                )}
                {selectedNeed.proof_submitted && !selectedNeed.proof_verified && (
                  <Link 
                    to="/dashboard/ngo/task-proofs"
                    className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Verify Proof
                  </Link>
                )}
                <button 
                  onClick={() => setSelectedNeed(null)}
                  className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 transition-all"
                >
                  Close
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
