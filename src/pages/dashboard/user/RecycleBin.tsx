import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Trash2, RotateCcw, AlertCircle, Clock, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow, isAfter, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import type { Need } from '../../../types';

export default function UserRecycleBin() {
  const { profile } = useAuth();
  const [deletedNeeds, setDeletedNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchDeletedNeeds();
    }
  }, [profile?.id]);

  async function fetchDeletedNeeds() {
    try {
      setLoading(true);
      await runAutoDelete();

      const { data, error } = await supabase
        .from('needs')
        .select('*')
        .eq('user_id', profile?.id)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDeletedNeeds(data || []);
    } catch (error) {
      console.error('Error fetching deleted needs:', error);
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  }

  async function runAutoDelete() {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('needs')
        .delete()
        .eq('user_id', profile?.id)
        .eq('is_deleted', true)
        .lt('auto_delete_at', now);
    } catch (error) {
      console.error('Auto-delete error:', error);
    }
  }

  async function handleRestore(id: string) {
    setProcessing(id);
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
      setDeletedNeeds(deletedNeeds.filter(n => n.id !== id));
      toast.success('Restored successfully');
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore');
    } finally {
      setProcessing(null);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('Permanently delete this item?')) return;
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('needs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDeletedNeeds(deletedNeeds.filter(n => n.id !== id));
      toast.success('Permanently deleted');
    } catch (error) {
      console.error('Permanent delete error:', error);
      toast.error('Failed to delete permanently');
    } finally {
      setProcessing(null);
    }
  }

  async function handleBulkAction(action: 'restore' | 'delete') {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Permanently delete ${selectedIds.length} items?`)) return;

    setProcessing('bulk');
    try {
      if (action === 'restore') {
        const { error } = await supabase
          .from('needs')
          .update({
            is_deleted: false,
            deleted_at: null,
            auto_delete_at: null
          })
          .in('id', selectedIds);
        if (error) throw error;
        toast.success(`Restored ${selectedIds.length} items`);
      } else {
        const { error } = await supabase
          .from('needs')
          .delete()
          .in('id', selectedIds);
        if (error) throw error;
        toast.success(`Deleted ${selectedIds.length} items permanently`);
      }
      setDeletedNeeds(deletedNeeds.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error(`Failed to ${action} items`);
    } finally {
      setProcessing(null);
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === deletedNeeds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletedNeeds.map(n => n.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
          <p className="text-gray-500 text-sm">Deleted requests will be stored here for 7 days.</p>
        </div>
        {selectedIds.length > 0 && (
          <div className="flex gap-2">
            <button 
              onClick={() => handleBulkAction('restore')}
              className="px-4 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-green-100 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Restore ({selectedIds.length})
            </button>
            <button 
              onClick={() => handleBulkAction('delete')}
              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 w-10">
                  <input 
                    type="checkbox" 
                    checked={deletedNeeds.length > 0 && selectedIds.length === deletedNeeds.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Problem</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Deleted At</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">Loading recycle bin...</td>
                </tr>
              ) : deletedNeeds.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Trash className="w-8 h-8 text-gray-200" />
                      <p>Recycle bin is empty</p>
                    </div>
                  </td>
                </tr>
              ) : (
                deletedNeeds.map((need) => {
                  const daysRemaining = need.auto_delete_at 
                    ? formatDistanceToNow(parseISO(need.auto_delete_at))
                    : 'N/A';
                  
                  return (
                    <motion.tr 
                      key={need.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
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
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Auto-deletes in {daysRemaining}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 font-medium">
                          {need.deleted_at ? new Date(need.deleted_at).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleRestore(need.id)}
                            disabled={!!processing}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                            title="Restore"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(need.id)}
                            disabled={!!processing}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
