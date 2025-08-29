import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RedisPubSub } from 'graphql-redis-subscriptions';

import {
  BusinessSetupEventType,
  OnboardingStatusChangedEvent,
  SubscriptionEventPayload,
  WelcomeChatCreatedEvent,
  WelcomeChatCreationFailedEvent,
} from '../types/business-setup-subscription.types';

/**
 * EventEmitterBridge Service
 *
 * Bridges NestJS EventEmitter2 events to GraphQL subscriptions via RedisPubSub.
 * This enables real-time communication between backend events and frontend components.
 */
@Injectable()
export class EventEmitterBridgeService {
  private readonly logger = new Logger(EventEmitterBridgeService.name);
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

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
   * Health check method
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pubSub.publish('healthCheck', { timestamp: new Date() });

      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);

      return false;
    }
  }
}
