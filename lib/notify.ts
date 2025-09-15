import { toast } from 'react-hot-toast';
import { t, type TranslationKey } from './i18n';

// Centralized notification utility using i18n
export const notify = {
  success: (message: string | TranslationKey, params?: Record<string, string | number>) => {
    const text = typeof message === 'string' ? message : t(message, params);
    toast.success(text);
  },

  error: (message: string | TranslationKey, params?: Record<string, string | number>) => {
    const text = typeof message === 'string' ? message : t(message, params);
    toast.error(text);
  },

  warning: (message: string | TranslationKey, params?: Record<string, string | number>) => {
    const text = typeof message === 'string' ? message : t(message, params);
    toast(text, { icon: '⚠️' });
  },

  info: (message: string | TranslationKey, params?: Record<string, string | number>) => {
    const text = typeof message === 'string' ? message : t(message, params);
    toast(text, { icon: 'ℹ️' });
  },

  // Convenience methods for common use cases
  saveSuccess: (itemName?: string) => {
    if (itemName) {
      notify.success(t('common.success') + `: ${itemName} erfolgreich gespeichert`);
    } else {
      notify.success(t('common.success'));
    }
  },

  saveError: () => {
    notify.error('Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.');
  },

  deleteSuccess: (itemName?: string) => {
    if (itemName) {
      notify.success(`${itemName} erfolgreich gelöscht`);
    } else {
      notify.success('Erfolgreich gelöscht');
    }
  },

  deleteError: () => {
    notify.error('Löschen fehlgeschlagen. Bitte versuchen Sie es erneut.');
  },

  loadError: () => {
    notify.error('Daten konnten nicht geladen werden');
  },

  validationError: () => {
    notify.error(t('inventory.validationError'));
  }
};

// Legacy aliases for backwards compatibility
export const notifySuccess = notify.success;
export const notifyError = notify.error;
export const notifyWarning = notify.warning;
export const notifyInfo = notify.info;