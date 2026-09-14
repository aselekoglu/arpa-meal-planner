import { parseJsonOrThrow } from '../json.js';
import {
  AiImageInput,
  AiProvider,
  AiProviderError,
  AiTask,
  AiTaskOptions,
} from '../types.js';

type OpenAIResponseContent = {
  type?: string;
  text?: string;
  refusal?: string;
};

type OpenAIResponseItem = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponsePayload = {
  output_text?: string;
  output?: OpenAIResponseItem[];
  status?: string;
  incomplete_details?: { reason?: string };
  error?: { message?: string };
};

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new AiProviderError('OPENAI_API_KEY is not configured on the server', 503);
  }
  return key;
}

function defaultOpenAIModel(task: AiTask): string {
  switch (task) {
    case 'scan-receipt':
      return (
        process.env.AI_OPENAI_VISION_MODEL?.trim() ||
        process.env.AI_OPENAI_MODEL?.trim() ||
        'gpt-5.6-luna'
      );
    default:
      return process.env.AI_OPENAI_MODEL?.trim() || 'gpt-5.6-luna';
  }
}

function extractOutputText(data: OpenAIResponsePayload): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (
        (content.type === 'output_text' || content.type === 'text') &&
        typeof content.text === 'string'
      ) {
        parts.push(content.text);
      }
    }
  }
  return parts.join('\n').trim();
}

export class OpenAIProvider implements AiProvider {
  readonly id = 'openai' as const;
  readonly supportsImage = false;
  readonly supportsVisionInput = true;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = getOpenAIKey();
    this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  private modelFor(options: AiTaskOptions): string {
    return options.model?.trim() || defaultOpenAIModel(options.task);
  }

  private async callResponses(
    input: unknown,
    options: AiTaskOptions,
    jsonMode = false,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      model: this.modelFor(options),
      input,
      store: false,
    };

    if (options.systemInstruction?.trim()) {
      body.instructions = options.systemInstruction.trim();
    }
    if (options.useWebSearch) {
      body.tools = [{ type: 'web_search' }];
    }
    if (jsonMode) {
      body.text = {
        format: {
          type: 'json_object',
        },
      };
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as OpenAIResponsePayload;
    if (!response.ok) {
      throw new AiProviderError(
        data.error?.message || `OpenAI request failed (${response.status})`,
        response.status === 401 || response.status === 403 ? 503 : 502,
      );
    }

    const text = extractOutputText(data);
    if (!text) {
      if (data.status === 'incomplete') {
        throw new AiProviderError(
          `OpenAI response was incomplete${data.incomplete_details?.reason ? `: ${data.incomplete_details.reason}` : ''}`,
          422,
        );
      }
      throw new AiProviderError('OpenAI returned an empty response', 422);
    }
    return text;
  }

  async generateText(prompt: string, options: AiTaskOptions): Promise<string> {
    return this.callResponses(prompt, options, false);
  }

  async generateJson<T>(prompt: string, options: AiTaskOptions): Promise<T> {
    const jsonPrompt = `${prompt}\n\nReturn valid JSON only.`;
    const raw = await this.callResponses(jsonPrompt, options, true);
    return parseJsonOrThrow<T>(raw, options.task);
  }

  async generateJsonFromImage<T>(
    prompt: string,
    image: AiImageInput,
    options: AiTaskOptions,
  ): Promise<T> {
    const input = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${prompt}\n\nReturn valid JSON only.`,
          },
          {
            type: 'input_image',
            detail: 'high',
            image_url: `data:${image.mimeType};base64,${image.data}`,
          },
        ],
      },
    ];
    const raw = await this.callResponses(input, options, true);
    return parseJsonOrThrow<T>(raw, options.task);
  }

  async generateImage(): Promise<string> {
    throw new AiProviderError(
      'Image generation is not yet supported by the OpenAI provider in Arpa',
      400,
    );
  }
}
