/**
 * AI Agent Events Service
 * 
 * Manages storage and retrieval of AI agent events using Redis for persistence
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { BUSINESS_SETUP_EVENTS } from 'twenty-shared/types';

export interface StoredAIAgentEvent {
  id: string;
  userId: string;
  workspaceId: string;
  type: string;
  payload: any;
  timestamp: Date;
  consumed: boolean;
}

@Injectable()
export class AIAgentEventsService {
  private readonly logger = new Logger(AIAgentEventsService.name);
  private readonly eventEmitter = new EventEmitter2();
  private readonly REDIS_KEY_PREFIX = 'ai-agent-events';
  private readonly EVENT_TTL = 3600; // 1 hour TTL
  private readonly MAX_EVENTS_PER_USER = 50;

  constructor(
    private readonly redisClientService: RedisClientService,
  ) {
    // Clean up old events every 5 minutes
    setInterval(() => {
      this.cleanupOldEvents();
    }, 5 * 60 * 1000);
  }

  /**
   * Store an AI agent event in Redis
   */
  private async storeEvent(event: Omit<StoredAIAgentEvent, 'id' | 'consumed'>): Promise<void> {
    const redis = this.redisClientService.getClient();
    const eventWithId: StoredAIAgentEvent = {
      ...event,
      id: this.generateEventId(),
      consumed: false,
    };

    const userKey = this.getUserEventsKey(event.userId, event.workspaceId);
    const eventKey = this.getEventKey(eventWithId.id);
    
    try {
      // Store the individual event
      await redis.setex(
        eventKey,
        this.EVENT_TTL,
        JSON.stringify(eventWithId)
      );

      // Add to user's event list
      await redis.lpush(userKey, eventWithId.id);
      
      // Trim the list to keep only the latest events
      await redis.ltrim(userKey, 0, this.MAX_EVENTS_PER_USER - 1);
      
      // Set TTL on the user list
      await redis.expire(userKey, this.EVENT_TTL);
      
      this.logger.log(`Stored AI agent event: ${event.type} for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to store event: ${error}`);
      throw error;
    }
  }

  /**
   * Get events for a specific user since a timestamp
   */
  async getEventsForUser(
    userId: string,
    workspaceId: string,
    since: Date,
  ): Promise<Array<{ type: string; payload: any; timestamp: string }>> {
    const redis = this.redisClientService.getClient();
    const userKey = this.getUserEventsKey(userId, workspaceId);

    try {
      // Get all event IDs for the user
      const eventIds = await redis.lrange(userKey, 0, -1);
      
      if (eventIds.length === 0) {
        return [];
      }

      // Get the actual events
      const pipeline = redis.pipeline();
      eventIds.forEach(id => {
        pipeline.get(this.getEventKey(id));
      });
      
      const results = await pipeline.exec();
      const events: StoredAIAgentEvent[] = [];
      
      for (const result of results || []) {
        if (result && result[1]) {
          try {
            const event = JSON.parse(result[1] as string) as StoredAIAgentEvent;
            event.timestamp = new Date(event.timestamp); // Parse timestamp
            events.push(event);
          } catch (parseError) {
            this.logger.warn(`Failed to parse event: ${parseError}`);
          }
        }
      }

      // Filter events by timestamp and consumed status
      const recentEvents = events
        .filter(event => event.timestamp > since && !event.consumed)
        .map(event => ({
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp.toISOString(),
        }));

      // Mark events as consumed
      const eventsToMarkConsumed = events.filter(event => event.timestamp > since && !event.consumed);
      if (eventsToMarkConsumed.length > 0) {
        const markConsumedPipeline = redis.pipeline();
        eventsToMarkConsumed.forEach(event => {
          const updatedEvent = { ...event, consumed: true };
          markConsumedPipeline.setex(
            this.getEventKey(event.id),
            this.EVENT_TTL,
            JSON.stringify(updatedEvent)
          );
        });
        await markConsumedPipeline.exec();
      }

      return recentEvents;
    } catch (error) {
      this.logger.error(`Failed to get events for user ${userId}: ${error}`);
      return [];
    }
  }

  /**
   * Event listeners for AI agent events
   */
  
  @OnEvent(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED)
  async handleWelcomeChatCreated(payload: {
    userId: string;
    workspaceId: string;
    threadId: string;
    aiResponse: string;
    timestamp: Date;
  }): Promise<void> {
    await this.storeEvent({
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
      payload: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        aiResponse: payload.aiResponse,
        timestamp: payload.timestamp.toISOString(),
      },
      timestamp: payload.timestamp,
    });
  }

  @OnEvent(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED)
  async handleWelcomeChatCreationFailed(payload: {
    userId: string;
    workspaceId: string;
    error: string;
    attempts: number;
    timestamp: Date;
  }): Promise<void> {
    await this.storeEvent({
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED,
      payload: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        error: payload.error,
        attempts: payload.attempts,
        timestamp: payload.timestamp.toISOString(),
      },
      timestamp: payload.timestamp,
    });
  }

  @OnEvent(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED)
  async handleWelcomeChatCreationStarted(payload: {
    userId: string;
    workspaceId: string;
    timestamp: Date;
  }): Promise<void> {
    await this.storeEvent({
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED,
      payload: {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        timestamp: payload.timestamp.toISOString(),
      },
      timestamp: payload.timestamp,
    });
  }

  /**
   * Test method to simulate welcome chat creation
   */
  async simulateWelcomeChatCreated(userId: string, workspaceId: string): Promise<void> {
    const mockEvent = {
      userId,
      workspaceId,
      threadId: `thread-${Date.now()}`,
      aiResponse: `🎉 Welcome to Business Setup Wizard!\n\nHi there! I'm your AI assistant, and I'm here to help you automate your business and set up efficient processes.\n\nLet's start with a simple question: What type of business do you have?\n\nI'll guide you through each step to help you design your sales funnel and optimize your customer journey!`,
      timestamp: new Date(),
    };

    await this.handleWelcomeChatCreated(mockEvent);
    this.logger.log(`Simulated welcome chat created for user ${userId}`);
  }

  /**
   * Clean up events older than TTL
   */
  private async cleanupOldEvents(): Promise<void> {
    const redis = this.redisClientService.getClient();
    
    try {
      // Redis TTL will automatically handle cleanup
      // This method can be used for additional cleanup logic if needed
      this.logger.log('Redis TTL handles automatic cleanup of old events');
    } catch (error) {
      this.logger.error(`Error during cleanup: ${error}`);
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get Redis key for user events list
   */
  private getUserEventsKey(userId: string, workspaceId: string): string {
    return `${this.REDIS_KEY_PREFIX}:users:${userId}:${workspaceId}`;
  }

  /**
   * Get Redis key for individual event
   */
  private getEventKey(eventId: string): string {
    return `${this.REDIS_KEY_PREFIX}:events:${eventId}`;
  }
}