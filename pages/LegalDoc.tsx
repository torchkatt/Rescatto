import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/common/SEO';
import { logger } from '../utils/logger';

type DocType = 'terms' | 'privacy';

const LegalDoc: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const docType: DocType = location.pathname.includes('privacy') ? 'privacy' : 'terms';
  const version = '1.0';

  const docConfig: Record<DocType, { titleKey: string; file: string }> = {
    terms: { titleKey: t('legal_terms_title') || 'Términos y Condiciones de Uso', file: '/terms.md' },
    privacy: { titleKey: t('legal_privacy_title') || 'Política de Tratamiento de Datos Personales', file: '/privacy.md' },
  };

  const doc = docConfig[docType];

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const response = await fetch(doc.file);
        if (!response.ok) throw new Error('Not found');
        const md = await response.text();
        setContent(md);
      } catch (err: any) {
        logger.error('LegalDoc: error loading', err);
        setError(t('legal_error'));
      } finally {
        setLoading(false);
      }
    };
    setLoading(true);
    setContent('');
    setError('');
    loadDoc();
  }, [docType, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">{t('legal_loading') || 'Cargando...'}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-red-500 text-center p-8">
          <p className="text-lg mb-4">{error || t('legal_error') || 'Error al cargar el documento.'}</p>
          <button onClick={() => navigate('/')} className="text-emerald-600 hover:underline">
            {t('legal_back') || '← Volver'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-outfit">
      <SEO title={doc.titleKey} description={`${doc.titleKey} de Rescatto`} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{doc.titleKey}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {(t('legal_version') || 'Versión')} {version} — Julio 2026
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              {t('legal_back') || '← Volver'}
            </button>
          </div>
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => navigate('/legal/terms')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                docType === 'terms' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('legal_terms_title') || 'Términos y Condiciones'}
            </button>
            <button
              onClick={() => navigate('/legal/privacy')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                docType === 'privacy' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('legal_privacy_title') || 'Política de Privacidad'}
            </button>
          </div>
        </div>

        {/* Content — Markdown rendered as HTML sections */}
        <div className="prose prose-slate max-w-none">
          {content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-4 text-slate-900">{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-8 mb-3 text-slate-900">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-6 mb-2 text-slate-900">{line.slice(4)}</h3>;
            if (line.startsWith('- ')) return <li key={i} className="ml-6 text-slate-700 list-disc">{line.slice(2)}</li>;
            if (/^\d+\.\s/.test(line)) return <li key={i} className="ml-6 text-slate-700 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
            if (line.trim() === '') return <div key={i} className="h-4" />;
            return <p key={i} className="text-slate-700 leading-relaxed">{line}</p>;
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-400">
            Rescatto — {doc.titleKey}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {(t('legal_contact') || 'Consultas: soporte@rescatto.com')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalDoc;
