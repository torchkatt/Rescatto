import React, { useState, useEffect } from 'react';
import { Venue } from '../../types';
import { aiService } from '../../services/aiService';
import { dataService } from '../../services/dataService';
import { Zap, CloudRain, Cloud, TrendingDown, Package, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { logger } from '../../utils/logger';

interface Props {
  venue: Venue;
}

export const MerchantAIPredictions: React.FC<Props> = ({ venue }) => {
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any>(null);
  const [weather] = useState({ temp: 18, condition: 'Cloudy', icon: <Cloud className="text-gray-400" /> });

  useEffect(() => {
    fetchPrediction();
  }, [venue.id]);

  const fetchPrediction = async () => {
    if (!venue?.id) return;
    setLoading(true);
    try {
      // 1. Obtener historial real de los últimos 7 días
      const analytics = await dataService.getAnalytics(venue.id);
      const history = analytics.chartData || [];
      
      // 2. Mock weather for tomorrow (Bogotá-ish)
      const mockWeather = {
        condition: 'Rainy',
        temp: 14,
        humidity: 85
      };

      // 3. Obtener predicción de Gemini
      const result = await aiService.getMerchantPredictions(venue, history, mockWeather);
      setPrediction(result);
    } catch (error) {
      logger.error("Error fetching AI predictions", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-emerald-600" size={32} />
        <p className="text-slate-500 font-medium italic">Gemini está analizando tus tendencias...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Zap className="text-emerald-400" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Predicción para Mañana</h3>
            <p className="text-xs text-slate-400">Powered by Gemini AI 1.5 Flash</p>
          </div>
        </div>
        <button 
            onClick={fetchPrediction}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Recalcular"
        >
            <RefreshCw size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Prediction Metric 1: Waste */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desperdicio Estimado</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-slate-900">{prediction?.predictedWasteKg || 0}</span>
              <span className="text-slate-500 font-bold">kg</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold">
              <AlertCircle size={14} />
              Riesgo Moderado
            </div>
          </div>

          {/* Prediction Metric 2: Recommendation */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Publicación Sugerida</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-600">{prediction?.recommendedPacks || 0}</span>
              <span className="text-slate-500 font-bold">Packs</span>
            </div>
            <p className="text-xs text-slate-500">Para optimizar tu inventario</p>
          </div>

          {/* Weather Context */}
          <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
            <div className="bg-white p-3 rounded-xl shadow-sm">
                <CloudRain className="text-blue-500" size={24} />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Clima Mañana</p>
                <p className="font-black text-slate-900">14°C • Lluvioso</p>
            </div>
          </div>
        </div>

        {/* AI Insight Box */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-600">
            <TrendingDown size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-black text-emerald-700 uppercase tracking-tighter">AI Insight</span>
            </div>
            <p className="text-slate-800 font-medium leading-relaxed italic">
              &ldquo;{prediction?.insight || 'Analizando variables de entorno...'}&rdquo;
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${(prediction?.confidenceScore || 0.5) * 100}%` }}
                ></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Confianza IA: {Math.round((prediction?.confidenceScore || 0) * 100)}%</span>
          </div>
          <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-emerald-100">
            <Package size={18} />
            Programar Packs Sugeridos
          </button>
        </div>
      </div>
    </div>
  );
};
