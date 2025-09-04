import { SGRThinkingStep, SGRToolExecutionStatus } from './sgr-message.types';

/**
 * Типы событий для детального SGR стриминга
 * Соответствуют событиям бэкенда из Фазы 1
 */
export type SGRStreamEventType =
  | 'SGR_PROCESS_START'
  | 'SGR_JSON_STREAM_START'
  | 'SGR_JSON_TOKEN_CHUNK'
  | 'SGR_JSON_STREAM_END'
  | 'SGR_TOOL_CALL_PENDING'
  | 'SGR_PROCESS_END'
  | 'SGR_PROCESS_ERROR';

/**
 * Payload для событий SGR стриминга
 */
export type SGRStreamEventPayload = {
  threadId: string;
  stepId: string;
  token?: string;
  fullJson?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
  metadata?: {
    stepNumber?: number;
    totalSteps?: number;
    processingTime?: number;
    tokensEmitted?: number;
  };
};

/**
 * Событие SGR стриминга
 */
export type SGRStreamEvent = {
  type: SGRStreamEventType;
  payload: SGRStreamEventPayload;
};

/**
 * Состояние SGR стриминга для UI
 */
export type SGRStreamingStatus =
  | 'idle' // Ожидание
  | 'starting' // Начало процесса
  | 'streaming_json' // Стриминг JSON от LLM
  | 'parsing' // Парсинг JSON
  | 'tool_pending' // Ожидание выполнения инструмента
  | 'completed' // Завершено
  | 'error'; // Ошибка

/**
 * Данные для визуализации JSON стриминга
 */
export type JSONStreamingData = {
  rawJson: string;
  parsedJson?: Record<string, unknown>;
  isValidJson: boolean;
  currentToken: string;
  totalTokens: number;
  streamingSpeed: number; // токенов в секунду
};

/**
 * Данные для визуализации инструмента
 */
export type ToolCallData = {
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: SGRToolExecutionStatus;
  executionTime?: number;
  result?: unknown;
  error?: string;
};

/**
 * Полное состояние SGR визуализации
 */
export type SGRVisualizationState = {
  status: SGRStreamingStatus;
  threadId: string | null;
  stepId: string | null;
  currentStep?: SGRThinkingStep;
  jsonStreaming?: JSONStreamingData;
  toolCall?: ToolCallData;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  totalProcessingTime?: number;
};
