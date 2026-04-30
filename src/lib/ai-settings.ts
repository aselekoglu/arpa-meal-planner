export type AiProviderId = 'gemini' | 'ollama' | 'mlx';

export type AiProviderUiMode = 'per_request' | 'global_only';

export interface AiSettings {
  provider: AiProviderId;
  model: string;
  providerUiMode?: AiProviderUiMode;
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
    const providerUiMode =
      parsed.providerUiMode === 'global_only' ? 'global_only' : 'per_request';
    return {
      provider,
      model: typeof parsed.model === 'string' ? parsed.model : defaultModelForProvider(provider),
      providerUiMode,
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

