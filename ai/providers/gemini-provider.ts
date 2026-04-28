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
    return process.env.AI_GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image-preview';
  }
  return process.env.AI_GEMINI_TEXT_MODEL?.trim() || 'gemini-3-flash-preview';
}

export class GeminiProvider implements AiProvider {
  readonly id = 'gemini' as const;
  readonly supportsImage = true;
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({ apiKey: getGeminiKey() });
  }

  private modelFor(options: AiTaskOptions): string {
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
      config: {
        systemInstruction: options.systemInstruction,
        tools: options.useWebSearch ? [{ googleSearch: {} }] : undefined,
        responseMimeType: 'application/json',
      },
    });
    return parseJsonOrThrow<T>(response.text || '', `${options.task}`);
  }

  async generateImage(prompt: string, options: AiTaskOptions): Promise<string> {
    const model = this.modelFor(options);
    const response = await this.client.models.generateContent({
      model,
      contents: prompt,
      config: {
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: options.size || '1K',
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new AiProviderError('Failed to generate image', 422);
  }
}
