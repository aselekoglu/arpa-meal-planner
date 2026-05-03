import {
  formatAiJobLanguageDisplay,
  normalizeLanguageInput,
  sanitizeLocaleHint,
  type AiLanguageUiMode,
  type ResponseLanguageCode,
} from '@/ai/response-languages';

export type AiProviderId = 'gemini' | 'ollama' | 'mlx';

export type AiProviderUiMode = 'per_request' | 'global_only';

export type { AiLanguageUiMode, ResponseLanguageCode };

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  providerUiMode?: AiProviderUiMode;
  responseLanguage?: ResponseLanguageCode;
  languageUiMode?: AiLanguageUiMode;
}

const STORAGE_KEY = 'aiSettings';

const DEFAULT_MODELS: Record<AiProviderId, string> = {
  gemini: 'gemini-3-flash-preview',
  ollama: '',
  mlx: '',
};

function normLanguageUiMode(raw: unknown): AiLanguageUiMode {
  return raw === 'global_only' ? 'global_only' : 'per_request';
}

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  model: DEFAULT_MODELS.gemini,
  providerUiMode: 'per_request',
  responseLanguage: 'auto',
  languageUiMode: 'per_request',
};

export function defaultModelForProvider(provider: AiProviderId): string {
  return DEFAULT_MODELS[provider];
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const provider = parsed.provider;
    if (provider !== 'gemini' && provider !== 'ollama' && provider !== 'mlx') {
      return DEFAULT_SETTINGS;
    }
    const providerUiMode =
      parsed.providerUiMode === 'global_only' ? 'global_only' : 'per_request';
    return {
      provider,
      model: typeof parsed.model === 'string' ? parsed.model : defaultModelForProvider(provider),
      providerUiMode,
      responseLanguage: normalizeLanguageInput(parsed.responseLanguage),
      languageUiMode: normLanguageUiMode(parsed.languageUiMode),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  const prev = loadAiSettings();
  const merged: AiSettings = {
    provider: settings.provider,
    model: settings.model,
    providerUiMode:
      settings.providerUiMode ?? prev.providerUiMode ?? 'per_request',
    responseLanguage: normalizeLanguageInput(
      settings.responseLanguage ?? prev.responseLanguage ?? 'auto',
    ),
    languageUiMode: normLanguageUiMode(
      settings.languageUiMode !== undefined ? settings.languageUiMode : prev.languageUiMode,
    ),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('arpa-ai-settings-updated'));
}

export function loadAiProviderUiMode(): AiProviderUiMode {
  return loadAiSettings().providerUiMode === 'global_only' ? 'global_only' : 'per_request';
}

export function saveAiProviderUiMode(mode: AiProviderUiMode): void {
  const cur = loadAiSettings();
  saveAiSettings({ ...cur, providerUiMode: mode });
}

export function showAiProviderPickerInModals(): boolean {
  return loadAiProviderUiMode() === 'per_request';
}

export function loadAiLanguageUiMode(): AiLanguageUiMode {
  return loadAiSettings().languageUiMode === 'global_only' ? 'global_only' : 'per_request';
}

export function saveAiLanguageUiMode(mode: AiLanguageUiMode): void {
  const cur = loadAiSettings();
  saveAiSettings({ ...cur, languageUiMode: mode });
}

export function showLanguagePickerInModals(): boolean {
  return loadAiLanguageUiMode() === 'per_request';
}

/** Body field for `/api/ai/*` when language is `auto`. */
export function localeHintForRequest(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return sanitizeLocaleHint(navigator.language);
}

/** Fields to merge into structured AI POST bodies (non-chat). */
export function structuredAiLanguagePayload(language: ResponseLanguageCode): {
  language: ResponseLanguageCode;
  localeHint?: string;
} {
  if (language === 'auto') {
    const localeHint = localeHintForRequest();
    return localeHint ? { language, localeHint } : { language };
  }
  return { language };
}

/** Label for AI job queue (matches structured AI payload semantics). */
export function aiJobLanguageLabel(code: ResponseLanguageCode): string {
  return formatAiJobLanguageDisplay(code, code === 'auto' ? localeHintForRequest() : undefined);
}
