import {
  createUnionType,
  Field,
  InputType,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';

/**
 * Детальные типы событий для SGR стриминга
 * Обеспечивают контракт данных между бэкендом и фронтендом
 */
export enum SGRStreamEventType {
  // Сигнализирует о начале всего мыслительного процесса
  PROCESS_START = 'SGR_PROCESS_START',
  // Начало генерации JSON ответа от LLM
  JSON_STREAM_START = 'SGR_JSON_STREAM_START',
  // Один токен (часть) из генерируемого JSON
  JSON_TOKEN_CHUNK = 'SGR_JSON_TOKEN_CHUNK',
  // Генерация JSON завершена, полный текст доступен
  JSON_STREAM_END = 'SGR_JSON_STREAM_END',
  // AI выбрал инструмент, полный JSON был успешно распарсен
  TOOL_CALL_PENDING = 'SGR_TOOL_CALL_PENDING',
  // Сигнализирует о завершении всего мыслительного процесса
  PROCESS_END = 'SGR_PROCESS_END',
  // Ошибка в процессе
  PROCESS_ERROR = 'SGR_PROCESS_ERROR',
}

registerEnumType(SGRStreamEventType, {
  name: 'SGRStreamEventTypeInternal',
  description: 'Types of SGR streaming events (internal)',
});

/**
 * Базовый интерфейс для всех SGR стриминг событий
 */
export interface BaseSGRStreamEvent {
  threadId: string;
  stepId: string;
  timestamp: Date;
}

/**
 * Метаданные для SGR событий
 */
@ObjectType('SGRStreamingMetadataInternal')
export class SGRStreamingMetadata {
  @Field({ nullable: true })
  stepNumber?: number;

  @Field({ nullable: true })
  totalSteps?: number;

  @Field({ nullable: true })
  processingTime?: number;

  @Field({ nullable: true })
  tokensEmitted?: number;

  @Field({ nullable: true })
  aiModelUsed?: string;

  @Field({ nullable: true })
  batchSize?: number;
}

/**
 * Payload для различных типов SGR событий
 */
@ObjectType('SGRProcessStartPayloadInternal')
export class SGRProcessStartPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRJsonStreamStartPayloadInternal')
export class SGRJsonStreamStartPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRJsonTokenChunkPayloadInternal')
export class SGRJsonTokenChunkPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  token: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRJsonStreamEndPayloadInternal')
export class SGRJsonStreamEndPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  fullJson: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRToolCallPendingPayloadInternal')
export class SGRToolCallPendingPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  toolName: string;

  @Field()
  toolArgs: string; // JSON string для GraphQL совместимости

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRProcessEndPayloadInternal')
export class SGRProcessEndPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType('SGRProcessErrorPayloadInternal')
export class SGRProcessErrorPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  error: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

/**
 * Union type для всех SGR streaming payloads
 */
export const SGRStreamingPayloadUnion = createUnionType({
  name: 'SGRStreamingPayloadInternal',
  types: () =>
    [
      SGRProcessStartPayload,
      SGRJsonStreamStartPayload,
      SGRJsonTokenChunkPayload,
      SGRJsonStreamEndPayload,
      SGRToolCallPendingPayload,
      SGRProcessEndPayload,
      SGRProcessErrorPayload,
    ] as const,
  resolveType(value) {
    if ('error' in value) {
      return SGRProcessErrorPayload;
    }
    if ('token' in value) {
      return SGRJsonTokenChunkPayload;
    }
    if ('fullJson' in value) {
      return SGRJsonStreamEndPayload;
    }
    if ('toolName' in value && 'toolArgs' in value) {
      return SGRToolCallPendingPayload;
    }

    // Определение по структуре может быть расширено
    return SGRProcessStartPayload;
  },
});

/**
 * TypeScript типы для внутреннего использования (не GraphQL)
 */
export type SGRStreamEvent =
  | { type: SGRStreamEventType.PROCESS_START; payload: SGRProcessStartPayload }
  | {
      type: SGRStreamEventType.JSON_STREAM_START;
      payload: SGRJsonStreamStartPayload;
    }
  | {
      type: SGRStreamEventType.JSON_TOKEN_CHUNK;
      payload: SGRJsonTokenChunkPayload;
    }
  | {
      type: SGRStreamEventType.JSON_STREAM_END;
      payload: SGRJsonStreamEndPayload;
    }
  | {
      type: SGRStreamEventType.TOOL_CALL_PENDING;
      payload: SGRToolCallPendingPayload;
    }
  | { type: SGRStreamEventType.PROCESS_END; payload: SGRProcessEndPayload }
  | { type: SGRStreamEventType.PROCESS_ERROR; payload: SGRProcessErrorPayload };

/**
 * Интерфейс для санитизации данных
 */
export interface SGRDataSanitizationConfig {
  sensitiveKeys: string[];
  maxJsonLength: number;
  maxTokenLength: number;
  enablePartialJsonParsing: boolean;
}

/**
 * Конфигурация SGR стриминга
 */
export interface SGRStreamingConfig {
  // Throttling настройки
  tokenThrottleMs: number;
  maxTokensPerChunk: number;
  maxTokensPerBatch: number;

  // Парсинг JSON
  enablePartialJsonParsing: boolean;
  jsonParsingTimeoutMs: number;

  // Обработка ошибок
  maxRetryAttempts: number;
  retryDelayMs: number;

  // Безопасность
  enableSanitization: boolean;
  sanitizationConfig: SGRDataSanitizationConfig;

  // Мониторинг
  enableMetrics: boolean;
  metricsLogInterval: number;
}

/**
 * Input типы для GraphQL подписок
 */
@InputType('SGRStreamingEventInputInternal')
export class SGRStreamingEventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field(() => [SGRStreamEventType], { nullable: true })
  eventTypes?: SGRStreamEventType[];

  @Field({ nullable: true })
  includeMetadata?: boolean;

  @Field({ nullable: true })
  enablePartialJsonParsing?: boolean;
}

/**
 * Расширенный контекст для SGR стриминга с conversation log
 */
export interface ExtendedSupervisorStreamingContext {
  userId: string;
  workspaceId: string;
  threadId: string;
  userMessage: string;
  maxSteps: number;
  stepNumber: number;
  conversationLog: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Результат детального стриминга JSON
 */
export interface DetailedStreamingResult {
  fullJson: string;
  tokens: string[];
  isValidJson: boolean;
  parsedData?: Record<string, unknown>;
  streamingDuration: number;
  tokenCount: number;
}

/**
 * Статистика SGR стриминга
 */
export interface SGRStreamingStats {
  totalEventsProcessed: number;
  totalTokensEmitted: number;
  averageTokensPerSecond: number;
  averageProcessingTime: number;
  errorRate: number;
  successfulStreams: number;
  failedStreams: number;
  connectionDrops: number;
}

/**
 * Константы конфигурации по умолчанию
 */
export const DEFAULT_SGR_STREAMING_CONFIG: SGRStreamingConfig = {
  // Throttling
  tokenThrottleMs: 100,
  maxTokensPerChunk: 10,
  maxTokensPerBatch: 50,

  // JSON парсинг
  enablePartialJsonParsing: true,
  jsonParsingTimeoutMs: 5000,

  // Retry логика
  maxRetryAttempts: 3,
  retryDelayMs: 1000,

  // Безопасность
  enableSanitization: true,
  sanitizationConfig: {
    sensitiveKeys: [
      'password',
      'token',
      'apiKey',
      'secret',
      'client_secret',
      'access_token',
      'refresh_token',
      'private_key',
      'auth_token',
    ],
    maxJsonLength: 10000,
    maxTokenLength: 1000,
    enablePartialJsonParsing: true,
  },

  // Мониторинг
  enableMetrics: true,
  metricsLogInterval: 100,
} as const;

/**
 * Каналы подписки для SGR стриминга
 */
export const SGR_STREAMING_CHANNELS = {
  // Основные каналы
  SGR_STREAMING_EVENTS: 'sgrStreamingEvents',
  SGR_TOKEN_STREAMING: 'sgrTokenStreaming',
  SGR_TOOL_EXECUTION: 'sgrToolExecution',
  SGR_ERROR_EVENTS: 'sgrErrorEvents',

  // Специфичные каналы
  SGR_JSON_EVENTS: 'sgrJsonEvents',
  SGR_PROCESS_EVENTS: 'sgrProcessEvents',

  // Debugging каналы (только для development)
  SGR_DEBUG_EVENTS: 'sgrDebugEvents',
  SGR_METRICS_EVENTS: 'sgrMetricsEvents',
} as const;

/**
 * Роутер событий для SGR стриминга
 */
export class SGRStreamingEventRouter {
  static routeSGRStreamingEvent(eventType: SGRStreamEventType): string[] {
    const channels: string[] = [];

    // Основной канал для всех SGR событий
    channels.push(SGR_STREAMING_CHANNELS.SGR_STREAMING_EVENTS);

    // Специфичные каналы по типу события
    switch (eventType) {
      case SGRStreamEventType.JSON_TOKEN_CHUNK:
      case SGRStreamEventType.JSON_STREAM_START:
      case SGRStreamEventType.JSON_STREAM_END:
        channels.push(SGR_STREAMING_CHANNELS.SGR_JSON_EVENTS);
        channels.push(SGR_STREAMING_CHANNELS.SGR_TOKEN_STREAMING);
        break;

      case SGRStreamEventType.TOOL_CALL_PENDING:
        channels.push(SGR_STREAMING_CHANNELS.SGR_TOOL_EXECUTION);
        break;

      case SGRStreamEventType.PROCESS_ERROR:
        channels.push(SGR_STREAMING_CHANNELS.SGR_ERROR_EVENTS);
        break;

      case SGRStreamEventType.PROCESS_START:
      case SGRStreamEventType.PROCESS_END:
        channels.push(SGR_STREAMING_CHANNELS.SGR_PROCESS_EVENTS);
        break;
    }

    return channels;
  }

  static getUserSpecificSGRChannel(userId: string, threadId: string): string {
    return `user:${userId}:thread:${threadId}:sgr-events`;
  }

  static getWorkspaceSpecificSGRChannel(workspaceId: string): string {
    return `workspace:${workspaceId}:sgr-events`;
  }

  static getDebugChannel(threadId: string): string {
    return `debug:thread:${threadId}:sgr-events`;
  }
}

/**
 * Помощники для валидации и санитизации
 */
export class SGRStreamingValidators {
  static isValidThreadId(threadId: string): boolean {
    return typeof threadId === 'string' && threadId.length > 0;
  }

  static isValidStepId(stepId: string): boolean {
    return typeof stepId === 'string' && stepId.length > 0;
  }

  static isValidToken(token: string, maxLength = 1000): boolean {
    return typeof token === 'string' && token.length <= maxLength;
  }

  static isValidJson(jsonString: string, maxLength = 10000): boolean {
    if (
      !jsonString ||
      typeof jsonString !== 'string' ||
      jsonString.length > maxLength
    ) {
      return false;
    }

    try {
      JSON.parse(jsonString);

      return true;
    } catch {
      return false;
    }
  }

  static sanitizeToolArgs(
    toolArgs: Record<string, any>,
    sensitiveKeys: string[],
  ): Record<string, any> {
    if (!toolArgs || typeof toolArgs !== 'object') {
      return {};
    }

    const sanitized = { ...toolArgs };

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
