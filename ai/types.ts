export type AiProviderId = 'gemini' | 'ollama' | 'mlx';

export type AiTask =
  | 'chat'
  | 'import-recipe'
  | 'generate-plan'
  | 'grocery-group'
  | 'generate-meal-image';

export interface AiTaskOptions {
  task: AiTask;
  model?: string;
  size?: string;
  systemInstruction?: string;
  useWebSearch?: boolean;
}

export class AiProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'AiProviderError';
    this.status = status;
  }
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly supportsImage: boolean;
  generateText(prompt: string, options: AiTaskOptions): Promise<string>;
  generateJson<T>(prompt: string, options: AiTaskOptions): Promise<T>;
  generateImage(prompt: string, options: AiTaskOptions): Promise<string>;
}
