import { GoogleGenAI } from '@google/genai';
import { parseJsonOrThrow } from '../json.js';
import { AiProvider, AiProviderError, AiTask, AiTaskOptions } from '../types.js';

function getGeminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AiProviderError('GEMINI_API_KEY is not configured on the server', 503);
  }
  return key;
}

function defaultGeminiModel(task: AiTask): string {
  if (task === 'generate-meal-image') {
    return process.env.AI_GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
  }
  return process.env.AI_GEMINI_TEXT_MODEL?.trim() || 'gemini-3-flash-preview';
}

export function geminiJsonGenerationConfig(
  options: Pick<AiTaskOptions, 'systemInstruction' | 'useWebSearch'>,
) {
  return {
    systemInstruction: options.systemInstruction,
    tools: options.useWebSearch ? [{ googleSearch: {} }] : undefined,
    // Search grounded GenerateContent calls can return no candidate when JSON mode is forced.
    ...(options.useWebSearch ? {} : { responseMimeType: 'application/json' }),
  };
}

export function geminiImageDataUri(mimeType: string | undefined, data: string): string {
  return `data:${mimeType || 'image/png'};base64,${data}`;
}

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini' as const;
  readonly supportsImage = true;
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: getGeminiKey() });
  }

  private modelFor(options: AiTaskOptions): string {
    if (options.task === 'generate-meal-image') {
      return defaultGeminiModel(options.task);
    }
    return options.model?.trim() || defaultGeminiModel(options.task);
  }

  async generateText(prompt: string, options: AiTaskOptions): Promise<string> {
    const model = this.modelFor(options);
    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: options.systemInstruction,
        tools: options.useWebSearch ? [{ googleSearch: {} }] : undefined,
      },
    });
    return response.text || '';
  }

  async generateJson<T>(prompt: string, options: AiTaskOptions): Promise<T> {
    const model = this.modelFor(options);
    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: geminiJsonGenerationConfig(options),
    });
    const text = response.text || '';
    if (!text.trim()) {
      const reason =
        response.candidates?.[0]?.finishReason ||
        response.promptFeedback?.blockReason ||
        'no candidates';
      throw new AiProviderError(`Gemini returned no text for ${options.task} (${reason})`, 422);
    }
    return parseJsonOrThrow<T>(text, `${options.task}`);
  }

  async generateImage(prompt: string, options: AiTaskOptions): Promise<string> {
    const model = this.modelFor(options);
    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        imageConfig: {
          imageSize: options.size || '1K',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return geminiImageDataUri(part.inlineData.mimeType, part.inlineData.data);
      }
    }
    throw new AiProviderError('Failed to generate image', 422);
  }
}
