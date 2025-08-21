export enum ModelProvider {
  NONE = 'none',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENAI_COMPATIBLE = 'open_ai_compatible',
  OPENROUTER = 'openrouter',
}

export type ModelId =
  | 'auto'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'claude-opus-4-20250514'
  | 'claude-sonnet-4-20250514'
  | 'claude-3-5-haiku-20241022'
  | string; // Allow custom model names

export interface AIModelConfig {
  modelId: ModelId;
  label: string;
  provider: ModelProvider;
  inputCostPer1kTokensInCents: number;
  outputCostPer1kTokensInCents: number;
  openRouterModelName?: string; // Для OpenRouter - реальное имя модели в API
}

export const AI_MODELS: AIModelConfig[] = [
  {
    modelId: 'gpt-4o',
    label: 'GPT-4o',
    provider: ModelProvider.OPENAI,
    inputCostPer1kTokensInCents: 0.25,
    outputCostPer1kTokensInCents: 1.0,
  },
  {
    modelId: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    provider: ModelProvider.OPENAI,
    inputCostPer1kTokensInCents: 0.015,
    outputCostPer1kTokensInCents: 0.06,
  },
  {
    modelId: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    provider: ModelProvider.OPENAI,
    inputCostPer1kTokensInCents: 1.0,
    outputCostPer1kTokensInCents: 3.0,
  },
  {
    modelId: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    provider: ModelProvider.ANTHROPIC,
    inputCostPer1kTokensInCents: 1.5,
    outputCostPer1kTokensInCents: 7.5,
  },
  {
    modelId: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet 4',
    provider: ModelProvider.ANTHROPIC,
    inputCostPer1kTokensInCents: 0.3,
    outputCostPer1kTokensInCents: 1.5,
  },
  {
    modelId: 'claude-3-5-haiku-20241022',
    label: 'Claude Haiku 3.5',
    provider: ModelProvider.ANTHROPIC,
    inputCostPer1kTokensInCents: 0.08,
    outputCostPer1kTokensInCents: 0.4,
  },
  // OpenRouter models
  {
    modelId: 'openrouter-gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (OpenRouter)',
    provider: ModelProvider.OPENROUTER,
    inputCostPer1kTokensInCents: 0.075, // $0.000075 per 1K input tokens
    outputCostPer1kTokensInCents: 0.3,   // $0.0003 per 1K output tokens
    openRouterModelName: 'google/gemini-2.5-flash',
  },
  {
    modelId: 'openrouter-gpt-4o',
    label: 'GPT-4o (OpenRouter)',
    provider: ModelProvider.OPENROUTER,
    inputCostPer1kTokensInCents: 0.25,
    outputCostPer1kTokensInCents: 1.0,
    openRouterModelName: 'openai/gpt-4o',
  },
  {
    modelId: 'openrouter-claude-sonnet',
    label: 'Claude Sonnet (OpenRouter)',
    provider: ModelProvider.OPENROUTER,
    inputCostPer1kTokensInCents: 0.3,
    outputCostPer1kTokensInCents: 1.5,
    openRouterModelName: 'anthropic/claude-3-5-sonnet-20241022',
  },
];
