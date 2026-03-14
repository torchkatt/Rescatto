import React, { useState, useEffect, useRef } from 'react';
import { SUPPORTED_COUNTRIES, cleanPhone, formatE164, parseE164, formatDisplayPhone } from '../../../utils/phoneUtils';
import { ChevronDown, Check } from 'lucide-react';

interface PhoneInputProps {
  value: string; // Expected in E.164 format or raw
  onChange: (e164: string) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  error,
  label,
  placeholder,
  className = '',
}) => {
  const parsed = parseE164(value);
  const [selectedCountry, setSelectedCountry] = useState(
    SUPPORTED_COUNTRIES.find(c => c.code === parsed.countryCode) || SUPPORTED_COUNTRIES[0]
  );
  const [localNumber, setLocalNumber] = useState(parsed.localNumber);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update local state if value changes from outside
  useEffect(() => {
    const newParsed = parseE164(value);
    setLocalNumber(newParsed.localNumber);
    setSelectedCountry(SUPPORTED_COUNTRIES.find(c => c.code === newParsed.countryCode) || SUPPORTED_COUNTRIES[0]);
  }, [value]);

  const handleLocalNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = cleanPhone(e.target.value);
    setLocalNumber(cleaned);
    onChange(formatE164(selectedCountry.dialCode, cleaned));
  };

  const handleCountrySelect = (country: typeof SUPPORTED_COUNTRIES[0]) => {
    setSelectedCountry(country);
    setIsOpen(false);
    onChange(formatE164(country.dialCode, localNumber));
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-2">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Country Selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 px-3 h-[52px] border-y border-l bg-gray-50 rounded-l-xl transition-all hover:bg-gray-100 ${
              error ? 'border-red-300' : 'border-gray-200'
            }`}
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm font-bold text-gray-700">{selectedCountry.dialCode}</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-[100] max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              <div className="p-2 space-y-1">
                {SUPPORTED_COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySelect(country)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      selectedCountry.code === country.code ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{country.flag}</span>
                      <span className="text-sm font-medium">{country.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{country.dialCode}</span>
                    </div>
                    {selectedCountry.code === country.code && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Local Number Input */}
        <div className="relative flex-1">
          <input
            type="tel"
            value={formatDisplayPhone(localNumber, selectedCountry.code)}
            onChange={handleLocalNumberChange}
            placeholder={placeholder || selectedCountry.format}
            className={`w-full h-[52px] px-4 border rounded-r-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-base transition-all font-medium ${
              error ? 'border-red-300 bg-red-50/10' : 'border-gray-200 bg-white'
            }`}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500 ml-1 font-medium">{error}</p>}
    </div>
  );
};
