// ✅ Local Event Type Definitions (to avoid runtime module resolution issues)
// These types are defined locally to ensure server startup works properly

export const BUSINESS_SETUP_EVENTS = {
  // Onboarding events
  ONBOARDING_STATUS_CHANGED: 'onboarding.status.changed',
  
  // AI Agent events
  AI_AGENT_WELCOME_CHAT_CREATION_STARTED: 'ai-agent.welcome.chat-creation-started',
  AI_AGENT_WELCOME_CHAT_CREATED: 'ai-agent.welcome.chat-created',
  AI_AGENT_WELCOME_CHAT_CREATION_FAILED: 'ai-agent.welcome.chat-creation-failed',
  
  // Chat Continuation events
  AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED: 'ai-agent.welcome.user-message-received',
  AI_AGENT_WELCOME_AI_RESPONSE_GENERATED: 'ai-agent.welcome.ai-response-generated',
  BUSINESS_SETUP_READY_FOR_NEXT_STEP: 'business-setup.ready-for-next-step',
  BUSINESS_SETUP_STEP_TRANSITION: 'business-setup.step-transition',
  
  // Chat events
  CHAT_MESSAGE_ADDED: 'chat.message.added',
  CHAT_STATUS_UPDATED: 'chat.status.updated',
} as const;

export type BusinessSetupEventType = typeof BUSINESS_SETUP_EVENTS[keyof typeof BUSINESS_SETUP_EVENTS];

export interface BusinessSetupEventPayload {
  userId: string;
  workspaceId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OnboardingStatusChangedEvent extends BusinessSetupEventPayload {
  status: string;
  previousStatus: string;
}

export interface WelcomeChatCreationStartedEvent extends BusinessSetupEventPayload {}

export interface WelcomeChatCreatedEvent extends BusinessSetupEventPayload {
  threadId: string;
  aiResponse: string;
}

export interface WelcomeChatCreationFailedEvent extends BusinessSetupEventPayload {
  error: string;
  attempts: number;
}

export interface UserMessageReceivedEvent extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
}

export interface AIResponseGeneratedEvent extends BusinessSetupEventPayload {
  threadId: string;
  response: string;
  context: Record<string, any>;
}

export interface BusinessSetupStepTransitionEvent extends BusinessSetupEventPayload {
  fromStep: string;
  toStep: string;
  reason: string;
}

export interface ChatMessageAddedEvent extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
  role: 'user' | 'assistant';
}

export interface ChatStatusUpdatedEvent extends BusinessSetupEventPayload {
  threadId: string;
  status: string;
  previousStatus: string;
}

export type BusinessSetupEvent = 
  | OnboardingStatusChangedEvent
  | WelcomeChatCreationStartedEvent
  | WelcomeChatCreatedEvent
  | WelcomeChatCreationFailedEvent
  | UserMessageReceivedEvent
  | AIResponseGeneratedEvent
  | BusinessSetupStepTransitionEvent
  | ChatMessageAddedEvent
  | ChatStatusUpdatedEvent;

export function isValidBusinessSetupEvent(event: any): event is BusinessSetupEvent {
  return event && 
         typeof event.userId === 'string' && 
         typeof event.workspaceId === 'string' &&
         event.timestamp instanceof Date;
}

export function isOnboardingStatusChangedEvent(event: BusinessSetupEvent): event is OnboardingStatusChangedEvent {
  return 'status' in event && 'previousStatus' in event && !('threadId' in event);
}

export function isWelcomeChatCreatedEvent(event: BusinessSetupEvent): event is WelcomeChatCreatedEvent {
  return 'threadId' in event && 'aiResponse' in event && !('error' in event);
}

export function isWelcomeChatCreationFailedEvent(event: BusinessSetupEvent): event is WelcomeChatCreationFailedEvent {
  return 'error' in event && 'attempts' in event;
}

