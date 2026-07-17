import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * BookingSlotPicker — Selector de fecha/hora para bookings de servicios.
 *
 * Props:
 * - availableSlots: string[] — array de slots en formato ISO (ej: ["2026-07-20T09:00:00Z", ...])
 * - selectedSlot: string | null — slot seleccionado
 * - onSelect: (slot: string) => void
 * - duration?: number — duración en minutos (para mostrar info)
 */

interface BookingSlotPickerProps {
  availableSlots: string[];
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
  duration?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupSlotsByDate(slots: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const slot of slots) {
    const date = new Date(slot);
    const key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(slot);
  }
  // Sort within each date
  for (const [key, daySlots] of map) {
    daySlots.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }
  return map;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) return 'Hoy';
  if (date.getTime() === tomorrow.getTime()) return 'Mañana';

  return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(slot: string): string {
  return new Date(slot).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BookingSlotPicker: React.FC<BookingSlotPickerProps> = ({
  availableSlots,
  selectedSlot,
  onSelect,
  duration,
}) => {
  const groupedSlots = useMemo(() => groupSlotsByDate(availableSlots), [availableSlots]);
  const dates = useMemo(() => Array.from(groupedSlots.keys()).sort(), [groupedSlots]);
  const [activeDateIndex, setActiveDateIndex] = useState(0);

  // Reset to first available date when slots change
  useEffect(() => {
    setActiveDateIndex(0);
  }, [availableSlots]);

  const activeDate = dates[activeDateIndex];
  const activeDaySlots = activeDate ? groupedSlots.get(activeDate) || [] : [];

  const canGoPrev = activeDateIndex > 0;
  const canGoNext = activeDateIndex < dates.length - 1;

  if (availableSlots.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
        <Calendar size={40} className="mx-auto mb-3 text-gray-300" />
        <p className="font-bold text-gray-500 mb-1">No hay horarios disponibles</p>
        <p className="text-sm text-gray-400">Intenta con otra fecha o contacta al vendedor</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-gray-900 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-600" />
            Selecciona fecha y hora
          </h3>
          {duration && (
            <span className="text-[11px] font-bold text-gray-400 bg-gray-200/50 px-2.5 py-1 rounded-full">
              {duration} min
            </span>
          )}
        </div>

        {/* Date navigation */}
        {dates.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveDateIndex(i => Math.max(0, i - 1))}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
              {dates.map((date, i) => (
                <button
                  key={date}
                  onClick={() => setActiveDateIndex(i)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                    i === activeDateIndex
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
                  }`}
                >
                  {formatDateLabel(date)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveDateIndex(i => Math.min(dates.length - 1, i + 1))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Time slots grid */}
      <div className="p-5">
        {activeDaySlots.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {activeDaySlots.map(slot => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => onSelect(slot)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  <Clock size={12} className={isSelected ? 'text-white' : 'text-emerald-500'} />
                  {formatTime(slot)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-4">Sin horarios para esta fecha</p>
        )}
      </div>

      {/* Selected slot info */}
      {selectedSlot && (
        <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-800">
              {formatDateLabel(selectedSlot.split('T')[0])} · {formatTime(selectedSlot)}
            </span>
          </div>
          <button
            onClick={() => onSelect('')}
            className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700"
          >
            Cambiar
          </button>
        </div>
      )}
    </div>
  );
};

export default BookingSlotPicker;