export type AiProviderId = 'gemini' | 'ollama' | 'mlx';

export interface AiSettings {
  provider: AiProviderId;
  model: string;
}

const STORAGE_KEY = 'aiSettings';

const DEFAULT_MODELS: Record<AiProviderId, string> = {
  gemini: 'gemini-3-flash-preview',
  ollama: '',
  mlx: '',
};

const DEFAULT_SETTINGS: AiSettings = {
  provider: 'gemini',
  model: DEFAULT_MODELS.gemini,
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
    return {
      provider,
      model: typeof parsed.model === 'string' ? parsed.model : defaultModelForProvider(provider),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
