import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { TranslationTypes } from './translations/TranslationTypes';
import en from './translations/en.json';
import tr from './translations/tr.json';

const resources: Record<string, { translation: TranslationTypes }> = {
  en: { translation: en },
  tr: { translation: tr },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    fallbackLng: 'en',
    nsSeparator: '.',
    keySeparator: '.',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
