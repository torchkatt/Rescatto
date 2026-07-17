import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/common/SEO';
import { logger } from '../utils/logger';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

type DocType = 'terms' | 'privacy';

const LEGAL_DOCS: Record<DocType, { titleKey: string; file: string }> = {
  terms: { titleKey: 'Términos y Condiciones de Uso', file: '/terms.md' },
  privacy: { titleKey: 'Política de Tratamiento de Datos Personales', file: '/privacy.md' },
};

const LegalDoc: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Extract doc type from URL hash
  const docType: DocType = window.location.hash.includes('privacy') ? 'privacy' : 'terms';
  const doc = LEGAL_DOCS[docType];
  const version = '1.0';

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const response = await fetch(doc.file);
        if (!response.ok) throw new Error('Documento no encontrado');
        const md = await response.text();
        setContent(md);
      } catch (err: any) {
        logger.error('LegalDoc: error loading', err);
        setError('Error al cargar el documento. Por favor, intenta de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };
    loadDoc();
  }, [docType]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-red-500 text-center p-8">
          <p className="text-lg mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="text-emerald-600 hover:underline">
            Volver al inicio
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
                Versión {version} — Julio 2026
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              ← Volver
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
              Términos y Condiciones
            </button>
            <button
              onClick={() => navigate('/legal/privacy')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                docType === 'privacy' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Política de Privacidad
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-900 prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-table:border-collapse prose-th:bg-slate-50 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-slate-200">
          {content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-8 mb-3 text-slate-900">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-6 mb-2">{line.slice(4)}</h3>;
            if (line.startsWith('|') && line.endsWith('|')) {
              // Simple table rendering
              const cells = line.split('|').filter(c => c.trim());
              const isHeader = i > 0 && line.includes('---');
              if (isHeader) return null;
              return (
                <div key={i} className="flex border-b border-slate-200 py-2">
                  {cells.map((cell, j) => (
                    <div key={j} className="flex-1 px-2 text-sm">{cell.trim()}</div>
                  ))}
                </div>
              );
            }
            if (line.startsWith('- ')) return <li key={i} className="ml-6 text-slate-700">{line.slice(2)}</li>;
            if (line.startsWith('1. ')) return <li key={i} className="ml-6 text-slate-700 list-decimal">{line.slice(3)}</li>;
            if (line.trim() === '') return <div key={i} className="h-4" />;
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-slate-900">{line.slice(2, -2)}</p>;
            return <p key={i} className="text-slate-700 leading-relaxed">{line}</p>;
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-400">
            Rescatto — {doc.titleKey} — Versión {version}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Para consultas, reclamos o ejercicio de derechos ARCO: soporte@rescatto.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalDoc;
