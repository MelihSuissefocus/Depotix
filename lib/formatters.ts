import { useLocale } from 'next-intl';

// Swiss German (de-CH) formatting functions
export const formatCurrencyCHF = (amount: number, locale: string = 'de-CH'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDateDeCH = (date: Date | string | null, locale: string = 'de-CH', options?: Intl.DateTimeFormatOptions): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  return new Intl.DateTimeFormat(locale, { ...defaultOptions, ...options }).format(dateObj);
};

export const formatDateTimeDeCH = (date: Date | string | null, locale: string = 'de-CH'): string => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

export const formatNumberDeCH = (number: number, locale: string = 'de-CH', options?: Intl.NumberFormatOptions): string => {
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };

  return new Intl.NumberFormat(locale, { ...defaultOptions, ...options }).format(number);
};

export const formatPercentage = (value: number, locale: string = 'de-CH'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

// React hooks for formatting with current locale
export const useFormatters = () => {
  const locale = useLocale();
  
  return {
    formatCurrency: (amount: number) => formatCurrencyCHF(amount, locale),
    formatDate: (date: Date | string | null, options?: Intl.DateTimeFormatOptions) => 
      formatDateDeCH(date, locale, options),
    formatDateTime: (date: Date | string | null) => formatDateTimeDeCH(date, locale),
    formatNumber: (number: number, options?: Intl.NumberFormatOptions) => 
      formatNumberDeCH(number, locale, options),
    formatPercentage: (value: number) => formatPercentage(value, locale),
  };
};

// Currency formatting specifically for Swiss Francs
export const formatCHF = (amount: number): string => {
  return `CHF ${formatNumberDeCH(amount)}`;
};

// Date formatting for Swiss German
export const formatSwissDate = (date: Date | string | null): string => {
  return formatDateDeCH(date, 'de-CH');
};

// Number formatting with Swiss German locale
export const formatSwissNumber = (number: number): string => {
  return formatNumberDeCH(number, 'de-CH');
};
