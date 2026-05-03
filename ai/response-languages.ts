/** Single source of truth for AI response language codes (client + server). */

export const RESPONSE_LANGUAGE_CODES = ['auto', 'en', 'tr', 'de', 'es', 'fr', 'it'] as const;

export type ResponseLanguageCode = (typeof RESPONSE_LANGUAGE_CODES)[number];

export const RESPONSE_LANGUAGE_LABELS: Record<ResponseLanguageCode, string> = {
  auto: 'Auto',
  en: 'English',
  tr: 'Turkish',
  de: 'German',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
};

export type AiLanguageUiMode = 'per_request' | 'global_only';

const ALLOWED = new Set<string>(RESPONSE_LANGUAGE_CODES);

export function normalizeLanguageInput(raw: unknown): ResponseLanguageCode {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (ALLOWED.has(s)) return s as ResponseLanguageCode;
  return 'auto';
}

/** Safe to embed in prompts; rejects unexpected shapes. */
export function sanitizeLocaleHint(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 32) return undefined;
  if (!/^[A-Za-z]{2}(-[A-Za-z0-9]+)*$/u.test(trimmed)) return undefined;
  return trimmed;
}

/** Short label for AI job queue rows (browser locale hint only when code is auto). */
export function formatAiJobLanguageDisplay(
  code: ResponseLanguageCode,
  localeHint?: string,
): string {
  const label = RESPONSE_LANGUAGE_LABELS[code];
  if (code === 'auto') {
    const h = localeHint?.trim();
    return h ? `${label} · ${h}` : label;
  }
  return `${label} (${code})`;
}
