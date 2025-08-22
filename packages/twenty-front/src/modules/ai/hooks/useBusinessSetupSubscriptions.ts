import { useEffect, useRef, useState } from 'react';
import { useSubscription } from '@apollo/client';
import { useRecoilValue } from 'recoil';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { getCurrentUserId } from '~/auth/utils/get-current-user-id';
import {
  BUSINESS_SETUP_EVENTS_SUBSCRIPTION,
  ONBOARDING_STATUS_SUBSCRIPTION,
  AI_AGENT_EVENTS_SUBSCRIPTION,
} from '../graphql/subscriptions/businessSetupEvents';

/**
 * Business Setup Event Types
 */
export type BusinessSetupEventType = 
  | 'ONBOARDING_STATUS_CHANGED'
  | 'AI_AGENT_WELCOME_CHAT_CREATED'
  | 'AI_AGENT_WELCOME_CHAT_FAILED'
  | 'BUSINESS_SETUP_STEP_COMPLETED';

export interface BusinessSetupEvent {
  id: string;
  type: BusinessSetupEventType;
  payload: any;
  metadata: {
    source: string;
    version: string;
    timestamp: Date;
    processingTime?: number;
    retryCount?: number;
  };
}

export interface OnboardingStatusEvent {
  userId: string;
  workspaceId: string;
  status: string;
  previousStatus: string;
  timestamp: Date;
}

export interface AIAgentEvent {
  eventType: string;
  threadId?: string;
  messageId?: string;
  status: string;
  error?: string;
  timestamp: Date;
}

/**
 * Hook for subscribing to all business setup events
 */
export const useBusinessSetupEventsSubscription = (options?: {
  eventTypes?: BusinessSetupEventType[];
  includeMetadata?: boolean;
}) => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const userId = getCurrentUserId();
  const [events, setEvents] = useState<BusinessSetupEvent[]>([]);
  const [connectionError, setConnectionError] = useState<Error | null>(null);
  const eventsRef = useRef(events);

  // Update ref when events change
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const { data, loading, error } = useSubscription(BUSINESS_SETUP_EVENTS_SUBSCRIPTION, {
    variables: {
      input: {
        userId,
        workspaceId: currentWorkspace?.id || '',
        eventTypes: options?.eventTypes,
        includeMetadata: options?.includeMetadata ?? true,
      },
    },
    skip: !currentWorkspace?.id || !userId,
    onError: (error) => {
      console.error('Business setup events subscription error:', error);
      setConnectionError(error);
    },
  });

  // Process incoming events
  useEffect(() => {
    if (data?.onBusinessSetupEvent) {
      const newEvent = data.onBusinessSetupEvent;
      setEvents(prevEvents => {
        // Prevent duplicate events
        const isDuplicate = prevEvents.some(event => event.id === newEvent.id);
        if (isDuplicate) {
          return prevEvents;
        }
        
        // Add new event and keep only last 50 events
        const updatedEvents = [newEvent, ...prevEvents].slice(0, 50);
        return updatedEvents;
      });
      
      // Clear connection error on successful data
      if (connectionError) {
        setConnectionError(null);
      }
    }
  }, [data, connectionError]);

  // Reset error when connection is restored
  useEffect(() => {
    if (!loading && !error && connectionError) {
      setConnectionError(null);
    }
  }, [loading, error, connectionError]);

  return {
    events,
    lastEvent: events[0] || null,
    isConnected: !loading && !error && !connectionError,
    isLoading: loading,
    connectionError: error || connectionError,
    clearEvents: () => setEvents([]),
  };
};

/**
 * Hook for subscribing to onboarding status changes only
 */
export const useOnboardingStatusSubscription = () => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const userId = getCurrentUserId();
  const [statusEvents, setStatusEvents] = useState<OnboardingStatusEvent[]>([]);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  const { data, loading, error } = useSubscription(ONBOARDING_STATUS_SUBSCRIPTION, {
    variables: {
      input: {
        userId,
        workspaceId: currentWorkspace?.id || '',
      },
    },
    skip: !currentWorkspace?.id || !userId,
    onError: (error) => {
      console.error('Onboarding status subscription error:', error);
      setConnectionError(error);
    },
  });

  // Process incoming onboarding status events
  useEffect(() => {
    if (data?.onOnboardingStatusChanged) {
      const newEvent = data.onOnboardingStatusChanged;
      setStatusEvents(prevEvents => {
        // Keep only last 10 status events
        return [newEvent, ...prevEvents].slice(0, 10);
      });
      
      if (connectionError) {
        setConnectionError(null);
      }
    }
  }, [data, connectionError]);

  return {
    statusEvents,
    currentStatus: statusEvents[0]?.status || null,
    previousStatus: statusEvents[0]?.previousStatus || null,
    lastStatusChange: statusEvents[0] || null,
    isConnected: !loading && !error && !connectionError,
    isLoading: loading,
    connectionError: error || connectionError,
  };
};

/**
 * Hook for subscribing to AI agent events only
 */
export const useAIAgentEventsSubscription = (options?: {
  threadId?: string;
}) => {
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const userId = getCurrentUserId();
  const [agentEvents, setAgentEvents] = useState<AIAgentEvent[]>([]);
  const [connectionError, setConnectionError] = useState<Error | null>(null);

  const { data, loading, error } = useSubscription(AI_AGENT_EVENTS_SUBSCRIPTION, {
    variables: {
      input: {
        userId,
        workspaceId: currentWorkspace?.id || '',
        threadId: options?.threadId,
      },
    },
    skip: !currentWorkspace?.id || !userId,
    onError: (error) => {
      console.error('AI agent events subscription error:', error);
      setConnectionError(error);
    },
  });

  // Process incoming AI agent events
  useEffect(() => {
    if (data?.onAIAgentEvents) {
      const newEvent = data.onAIAgentEvents;
      setAgentEvents(prevEvents => {
        // Keep only last 20 agent events
        return [newEvent, ...prevEvents].slice(0, 20);
      });
      
      if (connectionError) {
        setConnectionError(null);
      }
    }
  }, [data, connectionError]);

  // Filter events by type
  const welcomeChatEvents = agentEvents.filter(event => 
    event.eventType.includes('WELCOME_CHAT')
  );

  const chatCreatedEvents = agentEvents.filter(event => 
    event.status === 'CHAT_CREATED'
  );

  const chatFailedEvents = agentEvents.filter(event => 
    event.status === 'CHAT_FAILED'
  );

  return {
    agentEvents,
    welcomeChatEvents,
    chatCreatedEvents,
    chatFailedEvents,
    lastEvent: agentEvents[0] || null,
    lastWelcomeChatEvent: welcomeChatEvents[0] || null,
    isConnected: !loading && !error && !connectionError,
    isLoading: loading,
    connectionError: error || connectionError,
  };
};

/**
 * Combined hook that provides all subscription data in one place
 */
export const useBusinessSetupSubscriptions = () => {
  const businessSetupEvents = useBusinessSetupEventsSubscription();
  const onboardingStatus = useOnboardingStatusSubscription();
  const agentEvents = useAIAgentEventsSubscription();

  const isConnected = businessSetupEvents.isConnected && 
                     onboardingStatus.isConnected && 
                     agentEvents.isConnected;

  const isLoading = businessSetupEvents.isLoading || 
                   onboardingStatus.isLoading || 
                   agentEvents.isLoading;

  const hasErrors = !!(businessSetupEvents.connectionError || 
                      onboardingStatus.connectionError || 
                      agentEvents.connectionError);

  return {
    // Individual subscriptions
    businessSetupEvents,
    onboardingStatus,
    agentEvents,
    
    // Combined state
    isConnected,
    isLoading,
    hasErrors,
    
    // Quick access to important events
    lastOnboardingChange: onboardingStatus.lastStatusChange,
    lastWelcomeChatEvent: agentEvents.lastWelcomeChatEvent,
    
    // Utility methods
    clearAllEvents: () => {
      businessSetupEvents.clearEvents();
    },
  };
};