// Simple i18n implementation for German (de-CH) locale
import de from '@/locales/de.json';

type DeepKeyPath<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, any>
    ? `${K}.${DeepKeyPath<T[K]>}`
    : K
  : never;

type TranslationKey = DeepKeyPath<typeof de>;

class I18n {
  private locale = 'de-CH';
  private translations = de;

  // Get nested translation by dot notation key
  t(key: TranslationKey, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let value: any = this.translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key; // Return key as fallback
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation key does not resolve to string: ${key}`);
      return key;
    }

    // Replace placeholders with params
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return paramKey in params ? String(params[paramKey]) : match;
      });
    }

    return value;
  }

  // Format date for de-CH locale (dd.mm.yyyy, HH:mm)
  formatDate(date: Date | string, options?: {
    showTime?: boolean;
    timeZone?: string;
  }): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const timeZone = options?.timeZone || 'Europe/Zurich';

    if (options?.showTime) {
      return new Intl.DateTimeFormat('de-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone
      }).format(d);
    }

    return new Intl.DateTimeFormat('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone
    }).format(d);
  }

  // Format currency for de-CH locale (CHF 1'234.50)
  formatCurrency(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;

    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  // Format number for de-CH locale (1'234.50)
  formatNumber(value: number | string, options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;

    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: options?.minimumFractionDigits ?? 0,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2
    }).format(num);
  }

  getLocale(): string {
    return this.locale;
  }
}

// Export singleton instance
export const i18n = new I18n();

// Export types for external use
export type { TranslationKey };

// Hook for use in React components
export const useTranslation = () => {
  return {
    t: i18n.t.bind(i18n),
    formatDate: i18n.formatDate.bind(i18n),
    formatCurrency: i18n.formatCurrency.bind(i18n),
    formatNumber: i18n.formatNumber.bind(i18n),
    locale: i18n.getLocale()
  };
};

// Export utility functions for direct use
export const t = i18n.t.bind(i18n);
export const formatDate = i18n.formatDate.bind(i18n);
export const formatCurrency = i18n.formatCurrency.bind(i18n);
export const formatNumber = i18n.formatNumber.bind(i18n);