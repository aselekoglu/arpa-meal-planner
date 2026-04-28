import { parseJsonOrThrow } from '../json.js';
import { AiProvider, AiProviderError, AiTask, AiTaskOptions } from '../types.js';

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

function defaultOllamaModel(task: AiTask): string {
  switch (task) {
    case 'generate-plan':
      return process.env.AI_OLLAMA_PLAN_MODEL?.trim() || process.env.AI_OLLAMA_MODEL?.trim() || 'llama3.1:8b';
    case 'import-recipe':
      return process.env.AI_OLLAMA_IMPORT_MODEL?.trim() || process.env.AI_OLLAMA_MODEL?.trim() || 'llama3.1:8b';
    default:
      return process.env.AI_OLLAMA_MODEL?.trim() || 'llama3.1:8b';
  }
}

export class OllamaProvider implements AiProvider {
  readonly id = 'ollama' as const;
  readonly supportsImage = false;
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
  }

  private modelFor(options: AiTaskOptions): string {
    return options.model?.trim() || defaultOllamaModel(options.task);
  }

  private async callChat(prompt: string, options: AiTaskOptions): Promise<string> {
    const model = this.modelFor(options);
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          ...(options.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as OllamaChatResponse & { error?: string };
    if (!response.ok) {
      throw new AiProviderError(data.error || `Ollama request failed (${response.status})`, 502);
    }
    const text = data.message?.content?.trim();
    if (!text) {
      throw new AiProviderError('Ollama returned an empty response', 422);
    }
    return text;
  }

  async generateText(prompt: string, options: AiTaskOptions): Promise<string> {
    return this.callChat(prompt, options);
  }

  async generateJson<T>(prompt: string, options: AiTaskOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nReturn only valid JSON. Do not include markdown fences or extra commentary.`;
    const raw = await this.callChat(jsonPrompt, options);
    return parseJsonOrThrow<T>(raw, options.task);
  }

  async generateImage(): Promise<string> {
    throw new AiProviderError('Image generation is not supported by Ollama provider', 400);
  }
}
