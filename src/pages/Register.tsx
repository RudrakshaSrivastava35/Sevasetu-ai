import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../lib/supabase';
import Layout from '../components/Layout';
import { User, Users, Heart, ArrowRight, ArrowLeft, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import type { UserRole } from '../types';
import toast from 'react-hot-toast';

import { useLanguage } from '../contexts/LanguageContext';

export default function Register() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    ngo_type: 'medical',
    skills: [] as string[],
    ngo_registration_number: '',
    ngo_website: '',
  });

  const [ngoDocument, setNgoDocument] = useState<File | null>(null);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('reg_gps_not_supported'));
      return;
    }

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
          // Reverse geocoding using Nominatim (OpenStreetMap)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            {
              headers: {
                'Accept-Language': language
              }
            }
          );
          const data = await response.json();
          
          if (data && data.display_name) {
            // Extract a cleaner address (City, State/Country)
            const address = data.address;
            const city = address.city || address.town || address.village || address.suburb || '';
            const state = address.state || '';
            const country = address.country || '';
            
            const readableAddress = [city, state, country].filter(Boolean).join(', ');
            
            setFormData(prev => ({ 
              ...prev, 
              location: readableAddress || data.display_name.split(',').slice(0, 3).join(',')
            }));
          } else {
            setFormData(prev => ({ ...prev, location: t('reg_gps_captured') }));
          }
        } catch (err) {
          console.error('Error in reverse geocoding:', err);
          setFormData(prev => ({ ...prev, location: t('reg_gps_captured') }));
        } finally {
          setGeoLoading(false);
          toast.success(t('reg_gps_success'));
        }
      },
      (err) => {
        console.error(err);
        setGeoLoading(false);
        toast.error(t('reg_gps_error'));
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const skillsOptions = [
    { id: 'medical', label: t('reg_skills_medical') },
    { id: 'education', label: t('reg_skills_education') },
    { id: 'food', label: t('reg_skills_food') },
    { id: 'social', label: t('reg_skills_social') },
    { id: 'other', label: t('reg_skills_other') }
  ];

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep(2);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSkillToggle = (skill: string) => {
    const newSkills = formData.skills.includes(skill)
      ? formData.skills.filter(s => s !== skill)
      : [...formData.skills, skill];
    setFormData({ ...formData, skills: newSkills });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: role
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        let ngoDocumentUrl = null;

        // Upload NGO Document if exists
        if (role === 'ngo' && ngoDocument) {
          const fileExt = ngoDocument.name.split('.').pop();
          const fileName = `${authData.user.id}/registration_proof_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ngo-documents')
            .upload(fileName, ngoDocument);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('ngo-documents')
            .getPublicUrl(fileName);
          
          ngoDocumentUrl = publicUrl;
        }

        // 2. Create profile in 'profiles' table
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            role: role,
            location: formData.location,
            latitude: formData.latitude,
            longitude: formData.longitude,
            skills: role === 'volunteer' ? formData.skills : null,
            ngo_type: role === 'ngo' ? (formData.ngo_type || '').toLowerCase() : null,
            ngo_registration_number: role === 'ngo' ? formData.ngo_registration_number : null,
            ngo_website: role === 'ngo' ? formData.ngo_website : null,
            ngo_document_url: ngoDocumentUrl,
            verification_status: role === 'ngo' ? 'Pending' : null
          });

        if (profileError) throw profileError;

        // Redirect based on role
        navigate(`/dashboard/${role}`);
      }
    } catch (err: any) {
      setError(handleSupabaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{t('reg_title')}</h1>
          <p className="text-gray-600">{t('reg_desc')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-bold mb-6 text-center">{t('reg_select_role')}</h2>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleRoleSelect('ngo')}
                className="flex items-center gap-4 p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-600 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t('reg_ngo_title')}</h3>
                  <p className="text-sm text-gray-500">{t('reg_ngo_desc_short')}</p>
                </div>
                <ArrowRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-blue-600" />
              </button>

              <button
                onClick={() => handleRoleSelect('volunteer')}
                className="flex items-center gap-4 p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-green-600 hover:bg-green-50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100">
                  <Heart className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t('reg_vol_title')}</h3>
                  <p className="text-sm text-gray-500">{t('reg_vol_desc_short')}</p>
                </div>
                <ArrowRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-green-600" />
              </button>

              <button
                onClick={() => handleRoleSelect('user')}
                className="flex items-center gap-4 p-6 bg-white border-2 border-gray-100 rounded-2xl hover:border-purple-600 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100">
                  <User className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{t('reg_user_title')}</h3>
                  <p className="text-sm text-gray-500">{t('reg_user_desc_short')}</p>
                </div>
                <ArrowRight className="w-5 h-5 ml-auto text-gray-300 group-hover:text-purple-600" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-600 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> {t('reg_change_role')} ({role?.toUpperCase()})
            </button>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  {role === 'ngo' ? t('reg_ngo_name') : t('reg_full_name')}
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder={role === 'ngo' ? t('reg_ngo_name') : t('reg_full_name')}
                />
              </div>

              {role === 'ngo' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_ngo_type')}</label>
                    <select
                      name="ngo_type"
                      value={formData.ngo_type}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="medical">{t('cat_medical')}</option>
                      <option value="education">{t('cat_education')}</option>
                      <option value="food">{t('cat_food')}</option>
                      <option value="social">{t('cat_social')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_reg_number')}</label>
                    <input
                      type="text"
                      name="ngo_registration_number"
                      required
                      value={formData.ngo_registration_number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="e.g. NGO123456"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_website')}</label>
                    <input
                      type="url"
                      name="ngo_website"
                      value={formData.ngo_website}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="https://example.org"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_reg_proof')}</label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      required
                      onChange={(e) => setNgoDocument(e.target.files?.[0] || null)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                  </div>
                </div>
              )}

              {role === 'volunteer' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_skills')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {skillsOptions.map(skill => (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() => handleSkillToggle(skill.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          formData.skills.includes(skill.id)
                            ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {formData.skills.includes(skill.id) && <CheckCircle2 className="w-4 h-4" />}
                        {skill.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('reg_location')}</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      name="location"
                      required
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      placeholder="City, State"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={captureLocation}
                    disabled={geoLoading}
                    className={`px-4 rounded-xl border flex items-center justify-center transition-all ${
                      formData.latitude 
                        ? 'bg-green-50 border-green-200 text-green-600' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                    title="Use Current Location"
                  >
                    {geoLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                  </button>
                </div>
                {formData.latitude && (
                  <p className="mt-1 text-[10px] text-green-600 font-bold uppercase tracking-widest">
                    {t('reg_gps_captured')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('auth_email')}</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{t('auth_password')}</label>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('reg_creating') : t('reg_complete')}
            </button>

            <p className="text-center text-sm text-gray-500">
              {t('reg_already_have_account')} <Link to="/login" className="text-blue-600 font-bold hover:underline">{t('auth_sign_in_btn')}</Link>
            </p>
          </form>
        )}
      </div>
    </Layout>
  );
}
