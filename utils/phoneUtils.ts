export interface CountryConfig {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  format: string; // e.g. "XXX XXX XXXX"
  mask: string; // e.g. "000 000 0000"
}

export const SUPPORTED_COUNTRIES: CountryConfig[] = [
  { code: 'CO', dialCode: '+57', name: 'Colombia', flag: '🇨🇴', format: 'XXX XXX XXXX', mask: '000 000 0000' },
  { code: 'MX', dialCode: '+52', name: 'México', flag: '🇲🇽', format: 'XX XXXX XXXX', mask: '00 0000 0000' },
  { code: 'CL', dialCode: '+56', name: 'Chile', flag: '🇨🇱', format: 'X XXXX XXXX', mask: '0 0000 0000' },
  { code: 'PE', dialCode: '+51', name: 'Perú', flag: '🇵🇪', format: 'XXX XXX XXX', mask: '000 000 000' },
  { code: 'AR', dialCode: '+54', name: 'Argentina', flag: '🇦🇷', format: 'X XX XXXX XXXX', mask: '0 00 0000 0000' },
  { code: 'EC', dialCode: '+593', name: 'Ecuador', flag: '🇪🇨', format: 'X XXX XXXX', mask: '0 000 0000' },
  { code: 'US', dialCode: '+1', name: 'Estados Unidos', flag: '🇺🇸', format: 'XXX XXX XXXX', mask: '000 000 0000' },
];

/**
 * Cleans a string to contain only digits
 */
export const cleanPhone = (value: string): string => {
  return value.replace(/\D/g, '');
};

/**
 * Returns the E.164 formatted phone number
 * @param dialCode The country dial code (e.g. "+57")
 * @param phone The local phone number
 */
export const formatE164 = (dialCode: string, phone: string): string => {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return '';
  
  // If the phone already starts with the dial code (cleaned), don't duplicate it
  const cleanedDial = cleanPhone(dialCode);
  if (cleaned.startsWith(cleanedDial)) {
    return `+${cleaned}`;
  }
  
  return `${dialCode}${cleaned}`;
};

/**
 * Attempts to parse an E.164 number into dialCode and local number
 */
export const parseE164 = (e164: string): { dialCode: string; countryCode: string; localNumber: string } => {
  if (!e164 || !e164.startsWith('+')) {
    return { dialCode: '+57', countryCode: 'CO', localNumber: e164 || '' };
  }

  // Sort dial codes by length descending to match longest ones first (e.g. +593 before +5)
  const sortedCountries = [...SUPPORTED_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  
  for (const country of sortedCountries) {
    if (e164.startsWith(country.dialCode)) {
      return {
        dialCode: country.dialCode,
        countryCode: country.code,
        localNumber: e164.slice(country.dialCode.length),
      };
    }
  }

  return { dialCode: '+57', countryCode: 'CO', localNumber: e164.slice(1) };
};

/**
 * Basic formatter for UI display (adds spaces)
 */
export const formatDisplayPhone = (phone: string, countryCode: string = 'CO'): string => {
  const cleaned = cleanPhone(phone);
  const country = SUPPORTED_COUNTRIES.find(c => c.code === countryCode) || SUPPORTED_COUNTRIES[0];
  
  let formatted = '';
  let cleanedIdx = 0;
  
  for (let i = 0; i < country.format.length && cleanedIdx < cleaned.length; i++) {
    if (country.format[i] === 'X') {
      formatted += cleaned[cleanedIdx];
      cleanedIdx++;
    } else {
      formatted += country.format[i];
    }
  }
  
  return formatted;
};
