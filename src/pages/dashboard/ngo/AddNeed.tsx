import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../../../lib/supabase';
import { useAuth } from '../../../hooks/useAuth';
import Layout from '../../../components/Layout';
import { ArrowLeft, Send, MapPin, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function AddNeed() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'medical',
    location: profile?.location || '',
    urgency: 'Medium',
    latitude: null as number | null,
    longitude: null as number | null,
    donation_enabled: false,
    target_amount: ''
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    setError(null);

    try {
      const finalCategory = formData.category.toLowerCase();
      const dataToInsert = {
        ...formData,
        category: finalCategory,
        ngo_id: profile.id,
        status: 'Pending',
        target_amount: formData.donation_enabled ? parseFloat(formData.target_amount) : null
      };

      const { error: insertError } = await supabase
        .from('needs')
        .insert(dataToInsert);

      if (insertError) throw insertError;

      navigate('/dashboard/ngo');
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('ngo_add_need_title')}</h1>
        <p className="text-gray-500 text-sm">{t('ngo_add_need_subtitle')}</p>
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">{t('ngo_need_title_label')}</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder={t('ngo_need_title_placeholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">{t('ngo_need_desc_label')}</label>
            <textarea
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
              placeholder={t('ngo_need_desc_placeholder')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">{t('ngo_category_label')}</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                <option value="medical">{t('cat_medical')}</option>
                <option value="education">{t('cat_education')}</option>
                <option value="food">{t('cat_food')}</option>
                <option value="social">{t('cat_social')}</option>
              </select>
            </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">{t('ngo_urgency_label')}</label>
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
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-2">{t('ngo_location_label')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="location"
                required
                value={formData.location}
                onChange={handleInputChange}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                placeholder={t('ngo_location_placeholder')}
              />
              <button
                type="button"
                onClick={captureLocation}
                disabled={geoLoading}
                className={`px-4 rounded-lg border flex items-center justify-center transition-all ${
                  formData.latitude ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                title="Capture GPS Coordinates"
              >
                {geoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              </button>
            </div>
            {formData.latitude && (
              <p className="text-[10px] text-green-600 font-bold mt-1 uppercase tracking-widest">
                {t('reg_gps_captured')}: {formData.latitude.toFixed(4)}, {formData.longitude?.toFixed(4)}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="donation_enabled"
                name="donation_enabled"
                checked={formData.donation_enabled}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 transition-all"
              />
              <label htmlFor="donation_enabled" className="text-sm font-bold text-gray-700">{t('ngo_enable_donations')}</label>
            </div>

            {formData.donation_enabled && (
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">{t('ngo_target_amount')} (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 font-bold">₹</span>
                  <input
                    type="number"
                    name="target_amount"
                    required={formData.donation_enabled}
                    min="10"
                    value={formData.target_amount}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    placeholder={t('ngo_target_placeholder')}
                  />
                </div>
                <p className="text-[10px] text-blue-600 mt-2">{t('ngo_donation_info')}</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? t('ngo_posting') : <><Send className="w-5 h-5" /> {t('ngo_post_btn')}</>}
          </button>
        </form>
      </div>
    </div>
  );
}
