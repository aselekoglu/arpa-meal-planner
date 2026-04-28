import { parseJsonOrThrow } from '../json.js';
import { AiProvider, AiProviderError, AiTask, AiTaskOptions } from '../types.js';

type MlxCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: { message?: string };
};

function defaultMlxModel(task: AiTask): string {
  switch (task) {
    case 'generate-plan':
      return process.env.AI_MLX_PLAN_MODEL?.trim() || process.env.AI_MLX_MODEL?.trim() || 'mlx-community/Llama-3.1-8B-Instruct-4bit';
    case 'import-recipe':
      return process.env.AI_MLX_IMPORT_MODEL?.trim() || process.env.AI_MLX_MODEL?.trim() || 'mlx-community/Llama-3.1-8B-Instruct-4bit';
    default:
      return process.env.AI_MLX_MODEL?.trim() || 'mlx-community/Llama-3.1-8B-Instruct-4bit';
  }
}

export class MlxProvider implements AiProvider {
  readonly id = 'mlx' as const;
  readonly supportsImage = false;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor() {
    this.baseUrl = (process.env.MLX_BASE_URL || 'http://127.0.0.1:8080/v1').replace(/\/$/, '');
    this.apiKey = process.env.MLX_API_KEY?.trim();
  }

  private modelFor(options: AiTaskOptions): string {
    return options.model?.trim() || defaultMlxModel(options.task);
  }

  private async callCompletions(prompt: string, options: AiTaskOptions): Promise<string> {
    const model = this.modelFor(options);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          ...(options.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as MlxCompletionResponse;
    if (!response.ok) {
      throw new AiProviderError(
        data.error?.message || `MLX request failed (${response.status}). Check MLX_BASE_URL and model.`,
        502
      );
    }
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new AiProviderError('MLX returned an empty response', 422);
    }
    return text;
  }

  async generateText(prompt: string, options: AiTaskOptions): Promise<string> {
    return this.callCompletions(prompt, options);
  }

  async generateJson<T>(prompt: string, options: AiTaskOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nReturn only valid JSON. Do not include markdown fences or extra commentary.`;
    const raw = await this.callCompletions(jsonPrompt, options);
    return parseJsonOrThrow<T>(raw, options.task);
  }

  async generateImage(): Promise<string> {
    throw new AiProviderError('Image generation is not supported by MLX provider', 400);
  }
}
