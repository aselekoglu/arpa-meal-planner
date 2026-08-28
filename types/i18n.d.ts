import 'i18next';
import 'react-i18next';
import { TranslationTypes } from '@/i18n/translations/TranslationTypes';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: TranslationTypes;
    nsSeparator: '.';
    parseInterpolation: false;
  }
}

declare module 'react-i18next' {
  export function useTranslation<N extends string = any, TKPrefix extends string = any>(): {
    t: (key: string | string[], options?: Record<string, any>) => string;
    i18n: any;
    ready: boolean;
  };
}
