import {
    createUnionType,
    Field,
    InputType,
    ObjectType,
    registerEnumType,
} from '@nestjs/graphql';

/**
 * Business Setup Event Types for GraphQL Subscriptions
 */
export enum BusinessSetupEventType {
  ONBOARDING_STATUS_CHANGED = 'ONBOARDING_STATUS_CHANGED',
  AI_AGENT_WELCOME_CHAT_CREATED = 'AI_AGENT_WELCOME_CHAT_CREATED',
  AI_AGENT_WELCOME_CHAT_FAILED = 'AI_AGENT_WELCOME_CHAT_FAILED',
  BUSINESS_SETUP_STEP_COMPLETED = 'BUSINESS_SETUP_STEP_COMPLETED',
  
  // SGR Streaming Events
  SGR_STREAMING_START = 'SGR_STREAMING_START',
  SGR_JSON_STREAM_START = 'SGR_JSON_STREAM_START',
  SGR_JSON_TOKEN_CHUNK = 'SGR_JSON_TOKEN_CHUNK',
  SGR_JSON_STREAM_END = 'SGR_JSON_STREAM_END',
  SGR_TOOL_CALL_PENDING = 'SGR_TOOL_CALL_PENDING',
  SGR_STREAMING_END = 'SGR_STREAMING_END',
  SGR_STREAMING_ERROR = 'SGR_STREAMING_ERROR',
  
  // Supervisor SGR Events
  SUPERVISOR_SGR_START = 'SUPERVISOR_SGR_START',
  SUPERVISOR_SGR_THINKING = 'SUPERVISOR_SGR_THINKING',
  SUPERVISOR_SGR_TOOL_EXECUTION = 'SUPERVISOR_SGR_TOOL_EXECUTION',
  SUPERVISOR_SGR_COMPLETED = 'SUPERVISOR_SGR_COMPLETED',
  SUPERVISOR_SGR_ERROR = 'SUPERVISOR_SGR_ERROR',
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
 * SGR Streaming Event Types
 */
export type SGRStreamingEvent = {
  threadId: string;
  stepId: string;
  token?: string;
  fullJson?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  error?: string;
  timestamp: Date;
  metadata?: {
    stepNumber?: number;
    totalSteps?: number;
    processingTime?: number;
    tokensEmitted?: number;
    aiModelUsed?: string;
    batchSize?: number;
  };
};

export type SupervisorSGREvent = {
  userId: string;
  workspaceId: string;
  threadId: string;
  stepId: string;
  currentState: string;
  plannedSteps: string[];
  selectedTool?: string;
  toolExecution?: {
    status: 'in_progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
  };
  timestamp: Date;
  metadata?: {
    stepNumber: number;
    totalSteps: number;
    processingTime: number;
    aiModelUsed: string;
  };
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
 * SGR Streaming Subscription Input Types
 */
@InputType()
export class SGRStreamingEventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field(() => [BusinessSetupEventType], { nullable: true })
  eventTypes?: BusinessSetupEventType[];

  @Field({ nullable: true })
  includeMetadata?: boolean;

  @Field({ nullable: true })
  enablePartialJsonParsing?: boolean;

  @Field({ nullable: true })
  enableTokenThrottling?: boolean;
}

@InputType()
export class SupervisorSGREventInput {
  @Field({ nullable: true })
  userId?: string;

  @Field()
  workspaceId: string;

  @Field({ nullable: true })
  threadId?: string;

  @Field({ nullable: true })
  includeThinkingSteps?: boolean;

  @Field({ nullable: true })
  includeToolExecution?: boolean;
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

  @Field({ nullable: true })
  sgrStreaming?: boolean;

  @Field({ nullable: true })
  supervisorSGR?: boolean;
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
 * SGR Streaming GraphQL Payload Types
 */
@ObjectType()
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

@ObjectType()
export class SGRStreamingPayload {
  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field({ nullable: true })
  token?: string;

  @Field({ nullable: true })
  fullJson?: string;

  @Field({ nullable: true })
  toolName?: string;

  @Field({ nullable: true })
  toolArgs?: string; // JSON string для GraphQL

  @Field({ nullable: true })
  error?: string;

  @Field()
  timestamp: Date;

  @Field(() => SGRStreamingMetadata, { nullable: true })
  metadata?: SGRStreamingMetadata;
}

@ObjectType()
export class SupervisorSGRToolExecution {
  @Field()
  status: string; // 'in_progress' | 'completed' | 'failed'

  @Field({ nullable: true })
  result?: string; // JSON string

  @Field({ nullable: true })
  error?: string;
}

@ObjectType()
export class SupervisorSGRMetadata {
  @Field()
  stepNumber: number;

  @Field()
  totalSteps: number;

  @Field()
  processingTime: number;

  @Field()
  aiModelUsed: string;
}

@ObjectType()
export class SupervisorSGRPayload {
  @Field()
  userId: string;

  @Field()
  workspaceId: string;

  @Field()
  threadId: string;

  @Field()
  stepId: string;

  @Field()
  currentState: string;

  @Field(() => [String])
  plannedSteps: string[];

  @Field({ nullable: true })
  selectedTool?: string;

  @Field(() => SupervisorSGRToolExecution, { nullable: true })
  toolExecution?: SupervisorSGRToolExecution;

  @Field()
  timestamp: Date;

  @Field(() => SupervisorSGRMetadata, { nullable: true })
  metadata?: SupervisorSGRMetadata;
}

/**
 * Union type for different event payloads
 */
export const BusinessSetupEventPayload = createUnionType({
  name: 'BusinessSetupEventPayload',
  types: () =>
    [
      OnboardingStatusChangedPayload,
      AIAgentWelcomeChatPayload,
      AIAgentWelcomeChatErrorPayload,
      SGRStreamingPayload,
      SupervisorSGRPayload,
    ] as const,
  resolveType(value) {
    // SGR Streaming events
    if ('stepId' in value && 'threadId' in value) {
      if ('currentState' in value && 'plannedSteps' in value) {
        return SupervisorSGRPayload;
      }
      return SGRStreamingPayload;
    }
    
    // Legacy events
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
  
  // SGR Streaming каналы
  SGR_STREAMING_EVENTS: 'sgrStreamingEvents',
  SGR_TOKEN_STREAMING: 'sgrTokenStreaming',
  SGR_TOOL_EXECUTION: 'sgrToolExecution',
  SGR_ERROR_EVENTS: 'sgrErrorEvents',
  
  // Supervisor SGR каналы
  SUPERVISOR_SGR_EVENTS: 'supervisorSgrEvents',
  SUPERVISOR_THINKING: 'supervisorThinking',
  SUPERVISOR_TOOL_EXECUTION: 'supervisorToolExecution',
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

    // SGR Streaming events routing
    if (eventType.startsWith('SGR_')) {
      channels.push(SUBSCRIPTION_CHANNELS.SGR_STREAMING_EVENTS);
      
      // Specific SGR channels
      switch (eventType) {
        case BusinessSetupEventType.SGR_JSON_TOKEN_CHUNK:
        case BusinessSetupEventType.SGR_JSON_STREAM_START:
        case BusinessSetupEventType.SGR_JSON_STREAM_END:
          channels.push(SUBSCRIPTION_CHANNELS.SGR_TOKEN_STREAMING);
          break;
          
        case BusinessSetupEventType.SGR_TOOL_CALL_PENDING:
          channels.push(SUBSCRIPTION_CHANNELS.SGR_TOOL_EXECUTION);
          break;
          
        case BusinessSetupEventType.SGR_STREAMING_ERROR:
          channels.push(SUBSCRIPTION_CHANNELS.SGR_ERROR_EVENTS);
          break;
      }
    }

    // Supervisor SGR events routing
    if (eventType.startsWith('SUPERVISOR_SGR_')) {
      channels.push(SUBSCRIPTION_CHANNELS.SUPERVISOR_SGR_EVENTS);
      
      // Specific supervisor channels
      switch (eventType) {
        case BusinessSetupEventType.SUPERVISOR_SGR_THINKING:
          channels.push(SUBSCRIPTION_CHANNELS.SUPERVISOR_THINKING);
          break;
          
        case BusinessSetupEventType.SUPERVISOR_SGR_TOOL_EXECUTION:
          channels.push(SUBSCRIPTION_CHANNELS.SUPERVISOR_TOOL_EXECUTION);
          break;
      }
    }

    return channels;
  }

  static getUserSpecificChannel(userId: string): string {
    return `user:${userId}:events`;
  }

  static getWorkspaceSpecificChannel(workspaceId: string): string {
    return `workspace:${workspaceId}:events`;
  }

  static getSGRSpecificChannel(threadId: string): string {
    return `thread:${threadId}:sgr-events`;
  }

  static getSGRTokenStreamingChannel(threadId: string): string {
    return `thread:${threadId}:sgr-tokens`;
  }

  static getSGRDebugChannel(threadId: string): string {
    return `thread:${threadId}:sgr-debug`;
  }
}
