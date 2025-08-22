import { createUnionType, Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';

/**
 * Business Setup Event Types for GraphQL Subscriptions
 */
export enum BusinessSetupEventType {
  ONBOARDING_STATUS_CHANGED = 'ONBOARDING_STATUS_CHANGED',
  AI_AGENT_WELCOME_CHAT_CREATED = 'AI_AGENT_WELCOME_CHAT_CREATED',
  AI_AGENT_WELCOME_CHAT_FAILED = 'AI_AGENT_WELCOME_CHAT_FAILED',
  BUSINESS_SETUP_STEP_COMPLETED = 'BUSINESS_SETUP_STEP_COMPLETED',
}

registerEnumType(BusinessSetupEventType, {
  name: 'BusinessSetupEventType',
  description: 'Types of business setup events',
});

/**
 * Base Event Interfaces (matching existing shared types)
 */
export type OnboardingStatusChangedEvent = {
  userId: string;
  workspaceId: string;
  status: string;
  previousStatus: string;
  timestamp: Date;
};

export type WelcomeChatCreatedEvent = {
  userId: string;
  workspaceId: string;
  threadId: string;
  aiResponse: string;
  timestamp: Date;
};

export type WelcomeChatCreationFailedEvent = {
  userId: string;
  workspaceId: string;
  error: string;
  attempts: number;
  timestamp: Date;
};

/**
 * GraphQL Subscription Input Types
 */
@InputType()
export class BusinessSetupEventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;

  @Field(() => [BusinessSetupEventType], { nullable: true })
  eventTypes?: BusinessSetupEventType[];

  @Field({ nullable: true })
  includeMetadata?: boolean;
}

@InputType()
export class OnboardingEventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;
}

@InputType()
export class AIAgentEventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;

  @Field({ nullable: true })
  threadId?: string;
}

/**
 * GraphQL Subscription Response Types
 */
@ObjectType()
export class EventMetadata {
  @Field()
  source: string;

  @Field()
  version: string;

  @Field()
  timestamp: Date;

  @Field({ nullable: true })
  processingTime?: number;

  @Field({ nullable: true })
  retryCount?: number;
}

@ObjectType()
export class OnboardingStatusChangedPayload {
  @Field()
  userId: string;

  @Field()
  workspaceId: string;

  @Field()
  status: string;

  @Field()
  previousStatus: string;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class AIAgentWelcomeChatPayload {
  @Field()
  userId: string;

  @Field()
  workspaceId: string;

  @Field()
  threadId: string;

  @Field()
  aiResponse: string;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class AIAgentWelcomeChatErrorPayload {
  @Field()
  userId: string;

  @Field()
  workspaceId: string;

  @Field()
  error: string;

  @Field()
  attempts: number;

  @Field()
  timestamp: Date;
}

/**
 * Union type for different event payloads
 */
export const BusinessSetupEventPayload = createUnionType({
  name: 'BusinessSetupEventPayload',
  types: () => [
    OnboardingStatusChangedPayload,
    AIAgentWelcomeChatPayload,
    AIAgentWelcomeChatErrorPayload,
  ] as const,
  resolveType(value) {
    if ('status' in value && 'previousStatus' in value) {
      return OnboardingStatusChangedPayload;
    }
    if ('threadId' in value && 'aiResponse' in value) {
      return AIAgentWelcomeChatPayload;
    }
    if ('error' in value && 'attempts' in value) {
      return AIAgentWelcomeChatErrorPayload;
    }
    return null;
  },
});

/**
 * Main subscription event wrapper
 */
@ObjectType()
export class SubscriptionEventPayload {
  @Field()
  id: string;

  @Field(() => BusinessSetupEventType)
  type: BusinessSetupEventType;

  @Field(() => BusinessSetupEventPayload)
  payload: typeof BusinessSetupEventPayload;

  @Field(() => EventMetadata)
  metadata: EventMetadata;
}

/**
 * Response types for specific subscriptions
 */
@ObjectType()
export class OnboardingStatusSubscriptionResponse {
  @Field()
  userId: string;

  @Field()
  workspaceId: string;

  @Field()
  status: string;

  @Field()
  previousStatus: string;

  @Field()
  timestamp: Date;
}

@ObjectType()
export class AIAgentEventSubscriptionResponse {
  @Field()
  eventType: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  messageId?: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  error?: string;

  @Field()
  timestamp: Date;
}

/**
 * Subscription channel constants
 */
export const SUBSCRIPTION_CHANNELS = {
  BUSINESS_SETUP_EVENTS: 'businessSetupEvents',
  ONBOARDING_EVENTS: 'onboardingEvents',
  AI_AGENT_EVENTS: 'aiAgentEvents',
  CHAT_EVENTS: 'chatEvents',
} as const;

/**
 * Event Router for determining subscription channels
 */
export class EventRouter {
  static routeEvent(eventType: BusinessSetupEventType): string[] {
    const channels: string[] = [];
    
    // Add to main channel
    channels.push(SUBSCRIPTION_CHANNELS.BUSINESS_SETUP_EVENTS);
    
    // Add to category-specific channels
    if (eventType.startsWith('ONBOARDING_')) {
      channels.push(SUBSCRIPTION_CHANNELS.ONBOARDING_EVENTS);
    }
    
    if (eventType.startsWith('AI_AGENT_')) {
      channels.push(SUBSCRIPTION_CHANNELS.AI_AGENT_EVENTS);
    }
    
    return channels;
  }

  static getUserSpecificChannel(userId: string): string {
    return `user:${userId}:events`;
  }

  static getWorkspaceSpecificChannel(workspaceId: string): string {
    return `workspace:${workspaceId}:events`;
  }
}