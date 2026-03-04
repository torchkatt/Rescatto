import React from 'react';
import { Calendar } from 'lucide-react';

export type DateRangePreset = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisMonth' | 'custom';

interface DateRangePickerProps {
    selectedPreset: DateRangePreset;
    onPresetChange: (preset: DateRangePreset) => void;
    customStart?: string;
    customEnd?: string;
    onCustomRangeChange?: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    selectedPreset,
    onPresetChange,
    customStart,
    customEnd,
    onCustomRangeChange,
}) => {
    const presets: { value: DateRangePreset; label: string }[] = [
        { value: 'today', label: 'Hoy' },
        { value: 'yesterday', label: 'Ayer' },
        { value: 'last7Days', label: 'Últimos 7 días' },
        { value: 'last30Days', label: 'Últimos 30 días' },
        { value: 'thisMonth', label: 'Este mes' },
        { value: 'custom', label: 'Personalizado' },
    ];

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-3">
                <Calendar size={18} className="text-gray-600" />
                <h3 className="font-semibold text-gray-700">Período</h3>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                {presets.map(preset => (
                    <button
                        key={preset.value}
                        onClick={() => onPresetChange(preset.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 ${selectedPreset === preset.value
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {selectedPreset === 'custom' && onCustomRangeChange && (
                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Desde
                        </label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => onCustomRangeChange(e.target.value, customEnd || '')}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white appearance-none min-w-0 text-base focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Hasta
                        </label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => onCustomRangeChange(customStart || '', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white appearance-none min-w-0 text-base focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangePicker;
