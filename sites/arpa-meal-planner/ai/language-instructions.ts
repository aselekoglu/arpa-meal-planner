import type { ResponseLanguageCode } from './response-languages.js';
import { RESPONSE_LANGUAGE_LABELS, sanitizeLocaleHint } from './response-languages.js';

/** Fixed chat behavior: no preference picker; mirror user language from conversation. */
export const CHAT_CONTEXT_LANGUAGE_INSTRUCTION =
  "Respond in the same language as the user's messages in this conversation. Stay consistent with that language across replies.";

export interface StructuredLanguagePromptOpts {
  language: ResponseLanguageCode;
  localeHintRaw?: unknown;
}

export function buildStructuredLanguageInstruction(opts: StructuredLanguagePromptOpts): string {
  const { language } = opts;
  const localeHint = sanitizeLocaleHint(opts.localeHintRaw);

  if (language !== 'auto') {
    const label = RESPONSE_LANGUAGE_LABELS[language];
    return `\n\nLANGUAGE: All user-visible natural language in your response (names, ingredients, steps, tags, categories, and any prose fields) must be in ${label} (${language}).`;
  }

  const fallback =
    localeHint ?
      ` If the inputs do not clearly imply a language, use ${localeHint} for all user-visible natural language in your response.`
    : '';
  return `\n\nLANGUAGE: Infer the appropriate language from the user's inputs (names, URLs, context). When ambiguous or missing, prefer clear, natural wording.${fallback}`;
}

/**
 * Strong locale enforcement for structured JSON routes. Model providers honor this as a real system
 * role (Gemini/Ollama/MLX), which survives web search / JSON-schema focus better than a trailing user hint.
 */
export function buildStructuredLanguageSystemInstruction(opts: StructuredLanguagePromptOpts): string {
  const label = RESPONSE_LANGUAGE_LABELS[opts.language];
  const code = opts.language;
  return [
    `Mandatory output locale: ${label} (ISO-like code ${code}).`,
    `Every human-readable string in your JSON response must be written entirely in ${label}, especially each cooking-step line inside any "instructions" arrays.`,
    `If sources or tools return another language, translate faithfully into ${label} before emitting JSON.`,
    `Do not leave user-facing recipe text in English unless the locale code is exactly en.`,
  ].join(' ');
}

/**
 * Fetch-instructions: Gemini JSON + googleSearch often underweights systemInstruction relative to the
 * user message—duplicate locale rules at the TOP of the user prompt as well.
 */
export function buildFetchInstructionsLanguageLead(opts: StructuredLanguagePromptOpts): {
  userPromptPrefix: string;
  systemInstruction?: string;
} {
  const { language } = opts;
  const autoHint = buildStructuredLanguageInstruction(opts).trim();

  if (language !== 'auto') {
    const sys = buildStructuredLanguageSystemInstruction(opts);
    const label = RESPONSE_LANGUAGE_LABELS[language];
    const code = language;
    const hardJsonRule = [
      `JSON OUTPUT — NON-NEGOTIABLE:`,
      `The "instructions" array must contain ONLY strings written in ${label} (${code}).`,
      `Translate every cooking step from websites/tools into ${label} before returning JSON.`,
      `English-only steps are WRONG unless ${code} is literally en.`,
    ].join(' ');
    return {
      userPromptPrefix: `${hardJsonRule}\n\n${sys}\n\n`,
      systemInstruction: sys,
    };
  }

  return {
    userPromptPrefix: autoHint ? `${autoHint}\n\n` : '',
    systemInstruction: undefined,
  };
}
