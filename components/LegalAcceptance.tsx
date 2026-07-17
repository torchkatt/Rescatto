import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckSquare, Square } from 'lucide-react';

interface LegalAcceptanceProps {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
  error?: string;
}

const LegalAcceptance: React.FC<LegalAcceptanceProps> = ({ accepted, onChange, error }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <label className="flex items-start gap-3 cursor-pointer group">
        <button
          type="button"
          onClick={() => onChange(!accepted)}
          className={`mt-0.5 flex-shrink-0 transition-colors ${
            accepted ? 'text-emerald-600' : 'text-slate-300 group-hover:text-slate-400'
          }`}
          aria-label={accepted ? 'Aceptado' : 'No aceptado'}
        >
          {accepted ? <CheckSquare size={20} /> : <Square size={20} />}
        </button>
        <span className="text-sm text-slate-600 leading-relaxed select-none">
          {t('legal_accept_text') || 'He leído y acepto los'}{' '}
          <Link
            to="/legal/terms"
            target="_blank"
            className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2 hover:no-underline transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {t('legal_terms') || 'Términos y Condiciones de Uso'}
          </Link>
          {' '}{t('legal_and') || 'y la'}{' '}
          <Link
            to="/legal/privacy"
            target="_blank"
            className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2 hover:no-underline transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {t('legal_privacy') || 'Política de Tratamiento de Datos Personales'}
          </Link>
          .
        </span>
      </label>
      {error && (
        <p className="text-xs text-red-500 ml-8">{error}</p>
      )}
    </div>
  );
};

export default LegalAcceptance;
