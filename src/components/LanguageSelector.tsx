import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Languages } from 'lucide-react';

export default function LanguageSelector({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 ${className}`}>
      <button
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          language === 'en'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <span>🇬🇧</span>
        <span>English</span>
      </button>
      <button
        onClick={() => setLanguage('hi')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
          language === 'hi'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
      >
        <span>🇮🇳</span>
        <span>हिंदी</span>
      </button>
    </div>
  );
}
