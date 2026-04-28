import { AiProviderError } from './types.js';

export function parseJsonOrThrow<T>(raw: string, context: string): T {
  const source = raw.trim();
  if (!source) {
    throw new AiProviderError(`Empty response while parsing ${context}`, 422);
  }

  try {
    return JSON.parse(source) as T;
  } catch {
    const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1]?.trim() ?? source;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      const objectMatch = candidate.match(/\{[\s\S]*\}/);
      const arrayMatch = candidate.match(/\[[\s\S]*\]/);
      const fallback = objectMatch?.[0] ?? arrayMatch?.[0];
      if (!fallback) {
        throw new AiProviderError(`Failed to parse ${context} JSON response`, 422);
      }
      try {
        return JSON.parse(fallback) as T;
      } catch {
        throw new AiProviderError(`Failed to parse ${context} JSON response`, 422);
      }
    }
  }
}
