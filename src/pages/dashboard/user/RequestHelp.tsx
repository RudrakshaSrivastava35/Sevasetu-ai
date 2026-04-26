import React, { useState } from 'react';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import { Send, AlertCircle, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function RequestHelp() {
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'medical',
    location: profile?.location || '',
    urgency: 'Medium',
    latitude: null as number | null,
    longitude: null as number | null
  });

  const captureLocation = () => {
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFormData(prev => ({ 
          ...prev, 
          latitude, 
          longitude 
        }));

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
          );
          const data = await response.json();
          
          if (data && data.display_name) {
            const address = data.address;
            const city = address.city || address.town || address.village || address.suburb || '';
            const state = address.state || '';
            
            const readableAddress = [city, state].filter(Boolean).join(', ');
            setFormData(prev => ({ 
              ...prev, 
              location: readableAddress || data.display_name.split(',').slice(0, 3).join(',')
            }));
          }
        } catch (err) {
          console.error('Error in reverse geocoding:', err);
        } finally {
          setGeoLoading(false);
          toast.success(t('ngo_gps_success'));
        }
      },
      (err) => {
        console.error(err);
        setGeoLoading(false);
        toast.error(t('ngo_gps_denied'));
      }
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Force lowercase category for DB constraint safety
      const finalCategory = formData.category.toLowerCase();

      // Create the need
      const { data: newNeed, error: insertError } = await supabase
        .from('needs')
        .insert([{
          ...formData,
          category: finalCategory,
          user_id: profile?.id,
          status: 'Pending'
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Smart Routing: Notify NGOs of the SAME category
      try {
        const { data: matchingNGOs } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'ngo')
          .eq('ngo_type', formData.category);

        if (matchingNGOs && matchingNGOs.length > 0) {
          const notifications = matchingNGOs.map(ngo => ({
            user_id: ngo.id,
            task_id: newNeed.id,
            title: `🏥 New ${formData.category} Request`,
            message: `A new ${formData.category.toLowerCase()} help request has been posted: "${formData.title}" in ${formData.location}.`,
            type: 'need_alert'
          }));

          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifErr) {
        console.error('Error sending NGO notifications:', notifErr);
      }

      setSuccess(true);
      setFormData({ 
        title: '', 
        description: '', 
        category: 'medical', 
        location: profile?.location || '',
        urgency: 'Medium',
        latitude: null,
        longitude: null
      });
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('req_help_title')}</h1>
        <p className="text-gray-500 text-sm">{t('req_help_subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3 text-green-700 text-sm">
            <Send className="w-5 h-5" />
            {t('req_help_success')}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('ngo_need_title_label')}</label>
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t('req_help_title_placeholder')}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('ngo_need_desc_label')}</label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t('req_help_desc_placeholder')}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('ngo_category_label')}</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            >
              <option value="medical">{t('cat_medical')}</option>
              <option value="education">{t('cat_education')}</option>
              <option value="food">{t('cat_food')}</option>
              <option value="social">{t('cat_social')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('ngo_location_label')}</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  required
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={t('ngo_location_placeholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={captureLocation}
                disabled={geoLoading}
                className={`px-4 rounded-lg border flex items-center justify-center transition-all ${
                  formData.latitude ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {geoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              </button>
            </div>
            {formData.latitude && (
              <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">
                {t('reg_gps_captured')}: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">{t('ngo_urgency_label')}</label>
          <div className="flex gap-3">
            {[
              { key: 'Low', label: t('ngo_urgency_low') },
              { key: 'Medium', label: t('ngo_urgency_medium') },
              { key: 'High', label: t('ngo_urgency_high') }
            ].map((urgency) => (
              <button
                key={urgency.key}
                type="button"
                onClick={() => setFormData({ ...formData, urgency: urgency.key })}
                className={`flex-1 py-3 rounded-lg font-bold transition-all border ${
                  formData.urgency === urgency.key 
                    ? urgency.key === 'High' ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100' :
                      urgency.key === 'Medium' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' :
                      'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-blue-500'
                }`}
              >
                {urgency.label}
              </button>
            ))}
          </div>
        </div>

        <button
          disabled={loading}
          type="submit"
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? t('jobs_submitting') : (
            <>
              <Send className="w-5 h-5" />
              {t('req_help_submit_btn')}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
