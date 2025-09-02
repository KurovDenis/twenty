import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RedisPubSub } from 'graphql-redis-subscriptions';

import {
    DEFAULT_SGR_STREAMING_CONFIG,
    SGRStreamEvent,
    SGRStreamEventType,
} from '../sgr/types/sgr-stream.types';
import {
    BusinessSetupEventType,
    OnboardingStatusChangedEvent,
    SUBSCRIPTION_CHANNELS,
    SubscriptionEventPayload,
    SupervisorSGREvent,
    WelcomeChatCreatedEvent,
    WelcomeChatCreationFailedEvent
} from '../types/business-setup-subscription.types';

/**
 * Enhanced EventEmitterBridge Service
 * 
 * Расширенный сервис для обработки SGR стриминга событий с оптимизацией производительности
 */
@Injectable()
export class EventEmitterBridgeService implements OnModuleDestroy {
  private readonly logger = new Logger(EventEmitterBridgeService.name);
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;
  
  // SGR Streaming оптимизации
  private readonly tokenThrottleMs = DEFAULT_SGR_STREAMING_CONFIG.tokenThrottleMs;
  private readonly maxTokensPerBatch = DEFAULT_SGR_STREAMING_CONFIG.maxTokensPerChunk;
  private readonly sgrMetrics = {
    totalEventsProcessed: 0,
    totalTokensEmitted: 0,
    averageProcessingTime: 0,
    errorRate: 0,
    lastResetTime: Date.now(),
  };

  // Token buffering для throttling
  private readonly tokenBuffers = new Map<string, string[]>();
  private readonly tokenTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(@Inject('PUB_SUB') private readonly pubSub: RedisPubSub) {}

  /**
   * Handles onboarding status change events and publishes to subscription
   */
  @OnEvent('onboarding.status.changed')
  async handleOnboardingStatusChange(
    payload: OnboardingStatusChangedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing onboarding status change: ${payload.status} for user ${payload.userId}`,
      );

      const subscriptionPayload = this.formatEventForSubscription({
        type: BusinessSetupEventType.ONBOARDING_STATUS_CHANGED,
        payload,
        source: 'EventEmitterBridge',
      });

      await this.publishToSubscriptionWithRetry(
        'businessSetupEvents',
        subscriptionPayload,
      );

      this.logger.log(
        `Successfully published onboarding status change to subscription`,
      );
    } catch (error) {
      this.logger.error('Failed to publish onboarding status change:', error);
    }
  }

  /**
   * Handles AI agent welcome chat creation events
   */
  @OnEvent('ai-agent.welcome.chat-created')
  async handleWelcomeChatCreated(
    payload: WelcomeChatCreatedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing welcome chat created event for user ${payload.userId}, thread ${payload.threadId}`,
      );

      const subscriptionPayload = this.formatEventForSubscription({
        type: BusinessSetupEventType.AI_AGENT_WELCOME_CHAT_CREATED,
        payload,
        source: 'EventEmitterBridge',
      });

      await this.publishToSubscriptionWithRetry(
        'businessSetupEvents',
        subscriptionPayload,
      );
      await this.publishToSubscriptionWithRetry(
        'aiAgentEvents',
        subscriptionPayload,
      );

      this.logger.log(
        `Successfully published welcome chat created to subscriptions`,
      );
    } catch (error) {
      this.logger.error('Failed to publish welcome chat created:', error);
    }
  }

  /**
   * Handles AI agent welcome chat creation failure events
   */
  @OnEvent('ai-agent.welcome.chat-creation-failed')
  async handleWelcomeChatCreationFailed(
    payload: WelcomeChatCreationFailedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Processing welcome chat creation failed event for user ${payload.userId}`,
      );

      const subscriptionPayload = this.formatEventForSubscription({
        type: BusinessSetupEventType.AI_AGENT_WELCOME_CHAT_FAILED,
        payload,
        source: 'EventEmitterBridge',
      });

      await this.publishToSubscriptionWithRetry(
        'businessSetupEvents',
        subscriptionPayload,
      );
      await this.publishToSubscriptionWithRetry(
        'aiAgentEvents',
        subscriptionPayload,
      );

      this.logger.log(
        `Successfully published welcome chat creation failed to subscriptions`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to publish welcome chat creation failed:',
        error,
      );
    }
  }

  // ========================================
  // SGR STREAMING EVENT HANDLERS
  // ========================================

  /**
   * Обработчик SGR стриминга событий от SupervisorSGRService
   */
  @OnEvent('sgr.streaming.event')
  async handleSGRStreamingEvent(payload: SGRStreamEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(
        `Processing SGR streaming event: ${payload.type} for thread ${payload.payload?.threadId}`,
      );

      // Санитизация payload для безопасности
      const sanitizedPayload = this.sanitizeSGRPayload(payload);
      
      // Форматирование для подписки
      const subscriptionPayload = this.formatSGRStreamingEvent(sanitizedPayload);
      
      // Определение каналов для публикации
      const channels = this.getSGRStreamingChannels(payload.type);
      
      // Публикация в соответствующие каналы
      await Promise.all(
        channels.map(channel =>
          this.publishToSubscriptionWithRetry(channel, subscriptionPayload)
        )
      );

      // Обновление метрик
      this.updateSGRMetrics(startTime, payload.type);
      
      this.logger.debug(
        `Successfully published SGR streaming event to ${channels.length} channels`,
      );
      
    } catch (error) {
      this.logger.error('Failed to publish SGR streaming event:', error);
      this.updateErrorMetrics();
    }
  }

  /**
   * Обработчик Supervisor SGR событий
   */
  @OnEvent('supervisor.sgr.event')
  async handleSupervisorSGREvent(payload: SupervisorSGREvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(
        `Processing Supervisor SGR event for user ${payload.userId}, thread ${payload.threadId}`,
      );

      // Санитизация payload
      const sanitizedPayload = this.sanitizeSupervisorSGRPayload(payload);
      
      // Форматирование для подписки
      const subscriptionPayload = this.formatSupervisorSGREvent(sanitizedPayload);
      
      // Публикация в каналы
      await this.publishToSubscriptionWithRetry(
        SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS,
        subscriptionPayload
      );

      this.updateSGRMetrics(startTime, 'SUPERVISOR_SGR');
      
      this.logger.debug(
        `Successfully published Supervisor SGR event`,
      );
      
    } catch (error) {
      this.logger.error('Failed to publish Supervisor SGR event:', error);
      this.updateErrorMetrics();
    }
  }

  /**
   * Обработчик JSON токен-событий с throttling
   */
  @OnEvent('sgr.json.token.chunk')
  async handleSGRTokenChunk(payload: { token: string; threadId: string; stepId: string }): Promise<void> {
    // Throttling для частых токен-событий
    await this.throttledTokenEmission(payload);
  }

  // ========================================
  // OPTIMIZATION METHODS
  // ========================================

  /**
   * Throttled emission токен-событий для оптимизации производительности
   */
  private async throttledTokenEmission(payload: { token: string; threadId: string; stepId: string }): Promise<void> {
    const key = `token-buffer-${payload.threadId}-${payload.stepId}`;
    
    // Добавление токена в буфер
    if (!this.tokenBuffers.has(key)) {
      this.tokenBuffers.set(key, []);
    }
    
    this.tokenBuffers.get(key)!.push(payload.token);
    
    // Проверка условий для эмиссии
    if (this.tokenBuffers.get(key)!.length >= this.maxTokensPerBatch) {
      await this.emitTokenBatch(key, payload.threadId, payload.stepId);
    } else {
      // Clear existing timeout
      if (this.tokenTimeouts.has(key)) {
        clearTimeout(this.tokenTimeouts.get(key)!);
      }
      
      // Schedule delayed emission
      const timeout = setTimeout(() => {
        this.emitTokenBatch(key, payload.threadId, payload.stepId);
      }, this.tokenThrottleMs);
      
      this.tokenTimeouts.set(key, timeout);
    }
  }

  /**
   * Эмиссия батча токенов
   */
  private async emitTokenBatch(key: string, threadId: string, stepId: string): Promise<void> {
    const tokens = this.tokenBuffers.get(key) || [];
    if (tokens.length === 0) return;
    
    const tokenBatch = tokens.join('');
    this.tokenBuffers.delete(key);
    this.tokenTimeouts.delete(key);
    
    const subscriptionPayload = this.formatSGRStreamingEvent({
      type: SGRStreamEventType.JSON_TOKEN_CHUNK,
      payload: {
        threadId,
        stepId,
        token: tokenBatch,
        timestamp: new Date(),
        metadata: {
          tokensEmitted: tokens.length,
          batchSize: tokenBatch.length,
        },
      },
    });
    
    await this.publishToSubscriptionWithRetry(
      SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS,
      subscriptionPayload
    );

    this.sgrMetrics.totalTokensEmitted += tokens.length;
  }

  // ========================================
  // SECURITY METHODS
  // ========================================

  /**
   * Санитизация SGR payload для удаления чувствительных данных
   */
  private sanitizeSGRPayload(payload: SGRStreamEvent): SGRStreamEvent {
    if (payload.type === SGRStreamEventType.TOOL_CALL_PENDING && payload.payload) {
      return {
        ...payload,
        payload: {
          ...payload.payload,
          toolArgs: this.sanitizeJSON(payload.payload.toolArgs || '{}'),
        },
      };
    }
    
    if (payload.type === SGRStreamEventType.JSON_STREAM_END && payload.payload?.fullJson) {
      return {
        ...payload,
        payload: {
          ...payload.payload,
          fullJson: this.sanitizeJSON(payload.payload.fullJson),
        },
      };
    }
    
    return payload;
  }

  /**
   * Санитизация Supervisor SGR payload
   */
  private sanitizeSupervisorSGRPayload(payload: SupervisorSGREvent): SupervisorSGREvent {
    return {
      ...payload,
      toolExecution: payload.toolExecution ? {
        ...payload.toolExecution,
        result: this.removeSensitiveData(payload.toolExecution.result),
      } : undefined,
    };
  }

  /**
   * Удаление чувствительных данных из объекта
   */
  private removeSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;
    
    const sensitiveKeys = DEFAULT_SGR_STREAMING_CONFIG.sanitizationConfig.sensitiveKeys;
    
    if (Array.isArray(data)) {
      return data.map(item => this.removeSensitiveData(item));
    }
    
    const sanitized = { ...data };
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    // Рекурсивная очистка вложенных объектов
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.removeSensitiveData(value);
      }
    }
    
    return sanitized;
  }

  /**
   * Санитизация JSON строки
   */
  private sanitizeJSON(jsonString: string): string {
    try {
      const parsed = JSON.parse(jsonString);
      const sanitized = this.removeSensitiveData(parsed);
      return JSON.stringify(sanitized);
    } catch {
      // Если JSON некорректный, возвращаем как есть
      return jsonString;
    }
  }

  // ========================================
  // FORMATTING METHODS
  // ========================================

  /**
   * Форматирование SGR стриминга события для подписки
   */
  private formatSGRStreamingEvent(payload: SGRStreamEvent): SubscriptionEventPayload {
    const eventType = this.mapSGREventTypeToBusinessSetupType(payload.type);

    return {
      id: this.generateEventId(),
      type: eventType,
      payload: {
        ...payload.payload,
        timestamp: new Date(),
      },
      metadata: {
        source: 'EventEmitterBridge',
        version: '2.0.0',
        timestamp: new Date(),
        processingTime: Date.now(),
        sgrStreaming: true,
      },
    };
  }

  /**
   * Форматирование Supervisor SGR события
   */
  private formatSupervisorSGREvent(payload: SupervisorSGREvent): SubscriptionEventPayload {
    return {
      id: this.generateEventId(),
      type: BusinessSetupEventType.SUPERVISOR_SGR_THINKING,
      payload: {
        ...payload,
        timestamp: new Date(),
      },
      metadata: {
        source: 'EventEmitterBridge',
        version: '2.0.0',
        timestamp: new Date(),
        processingTime: Date.now(),
        supervisorSGR: true,
      },
    };
  }

  /**
   * Маппинг SGR типов событий в BusinessSetupEventType
   */
  private mapSGREventTypeToBusinessSetupType(sgrType: SGRStreamEventType): BusinessSetupEventType {
    const mapping: Record<SGRStreamEventType, BusinessSetupEventType> = {
      [SGRStreamEventType.PROCESS_START]: BusinessSetupEventType.SGR_STREAMING_START,
      [SGRStreamEventType.JSON_STREAM_START]: BusinessSetupEventType.SGR_JSON_STREAM_START,
      [SGRStreamEventType.JSON_TOKEN_CHUNK]: BusinessSetupEventType.SGR_JSON_TOKEN_CHUNK,
      [SGRStreamEventType.JSON_STREAM_END]: BusinessSetupEventType.SGR_JSON_STREAM_END,
      [SGRStreamEventType.TOOL_CALL_PENDING]: BusinessSetupEventType.SGR_TOOL_CALL_PENDING,
      [SGRStreamEventType.PROCESS_END]: BusinessSetupEventType.SGR_STREAMING_END,
      [SGRStreamEventType.PROCESS_ERROR]: BusinessSetupEventType.SGR_STREAMING_ERROR,
    };
    
    return mapping[sgrType] || BusinessSetupEventType.SGR_STREAMING_ERROR;
  }

  // ========================================
  // CHANNEL ROUTING
  // ========================================

  /**
   * Определение каналов для SGR стриминга событий
   */
  private getSGRStreamingChannels(eventType: SGRStreamEventType): string[] {
    const channels: string[] = [SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS];
    
    // Добавление специфичных каналов
    if (eventType === SGRStreamEventType.JSON_TOKEN_CHUNK) {
      channels.push(SUBSCRIPTION_CHANNELS.SGR_TOKEN_STREAMING);
    }
    
    if (eventType === SGRStreamEventType.TOOL_CALL_PENDING) {
      channels.push(SUBSCRIPTION_CHANNELS.SGR_TOOL_EXECUTION);
    }
    
    if (eventType === SGRStreamEventType.PROCESS_ERROR) {
      channels.push(SUBSCRIPTION_CHANNELS.SGR_ERROR_EVENTS);
    }
    
    return channels;
  }

  // ========================================
  // METRICS AND MONITORING
  // ========================================

  /**
   * Обновление метрик SGR стриминга
   */
  private updateSGRMetrics(startTime: number, eventType: string): void {
    const processingTime = Date.now() - startTime;
    
    this.sgrMetrics.totalEventsProcessed++;
    this.sgrMetrics.averageProcessingTime = 
      (this.sgrMetrics.averageProcessingTime + processingTime) / 2;
    
    // Логирование метрик каждые 100 событий
    if (this.sgrMetrics.totalEventsProcessed % 100 === 0) {
      this.logger.log('SGR Streaming Metrics:', this.sgrMetrics);
    }
  }

  /**
   * Обновление метрик ошибок
   */
  private updateErrorMetrics(): void {
    this.sgrMetrics.errorRate = 
      (this.sgrMetrics.errorRate * 0.9) + 0.1; // Exponential moving average
  }

  /**
   * Получение текущих метрик
   */
  getSGRMetrics() {
    return { 
      ...this.sgrMetrics,
      uptime: Date.now() - this.sgrMetrics.lastResetTime,
    };
  }

  /**
   * Сброс метрик
   */
  resetSGRMetrics(): void {
    this.sgrMetrics.totalEventsProcessed = 0;
    this.sgrMetrics.totalTokensEmitted = 0;
    this.sgrMetrics.averageProcessingTime = 0;
    this.sgrMetrics.errorRate = 0;
    this.sgrMetrics.lastResetTime = Date.now();
  }

  /**
   * Publishes to subscription channel with retry mechanism
   */
  private async publishToSubscriptionWithRetry(
    channel: string,
    payload: any,
  ): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.pubSub.publish(channel, payload);

        return; // Success
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt} failed to publish to ${channel}:`,
          error,
        );

        if (attempt === this.maxRetries) {
          this.logger.error(
            `All ${this.maxRetries} attempts failed to publish to ${channel}`,
          );
          throw error;
        }

        // Exponential backoff
        const delayMs = Math.pow(2, attempt) * this.retryDelayMs;

        await this.delay(delayMs);
      }
    }
  }

  /**
   * Formats an event for GraphQL subscription consumption
   */
  private formatEventForSubscription(event: {
    type: BusinessSetupEventType;
    payload: any;
    source: string;
  }): SubscriptionEventPayload {
    return {
      id: this.generateEventId(),
      type: event.type,
      payload: event.payload,
      metadata: {
        source: event.source,
        version: '1.0.0',
        timestamp: new Date(),
        processingTime: Date.now(),
      },
    };
  }

  /**
   * Generates a unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Enhanced health check с SGR метриками
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    sgrMetrics: any;
    errorRate: number;
    activeTokenBuffers: number;
  }> {
    try {
      await this.pubSub.publish('healthCheck', { timestamp: new Date() });

      return {
        isHealthy: true,
        sgrMetrics: this.getSGRMetrics(),
        errorRate: this.sgrMetrics.errorRate,
        activeTokenBuffers: this.tokenBuffers.size,
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);

      return {
        isHealthy: false,
        sgrMetrics: this.getSGRMetrics(),
        errorRate: this.sgrMetrics.errorRate,
        activeTokenBuffers: this.tokenBuffers.size,
      };
    }
  }

  /**
   * Cleanup метод для освобождения ресурсов
   */
  onModuleDestroy(): void {
    // Очистка всех таймаутов
    for (const timeout of this.tokenTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.tokenTimeouts.clear();
    this.tokenBuffers.clear();
  }
}
