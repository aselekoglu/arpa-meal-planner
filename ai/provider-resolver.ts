import { GeminiProvider } from './providers/gemini-provider.js';
import { MlxProvider } from './providers/mlx-provider.js';
import { OllamaProvider } from './providers/ollama-provider.js';
import { AiProvider, AiProviderError, AiProviderId } from './types.js';

export function parseProviderId(raw: unknown): AiProviderId | undefined {
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim().toLowerCase();
  if (value === 'gemini' || value === 'ollama' || value === 'mlx') {
    return value;
  }
  return undefined;
}

export function getDefaultProviderId(): AiProviderId {
  const configured = parseProviderId(process.env.AI_PROVIDER_DEFAULT);
  return configured || 'gemini';
}

export function resolveProvider(rawProvider: unknown): AiProvider {
  const requested = parseProviderId(rawProvider);
  if (rawProvider != null && requested == null) {
    throw new AiProviderError('Unsupported AI provider. Use gemini, ollama, or mlx.', 400);
  }

  const providerId = requested || getDefaultProviderId();
  switch (providerId) {
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'mlx':
      return new MlxProvider();
    default:
      throw new AiProviderError('Unsupported AI provider', 400);
  }
}
