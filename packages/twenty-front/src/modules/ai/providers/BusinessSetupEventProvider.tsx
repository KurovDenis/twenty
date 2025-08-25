import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AIAgentEvent, BusinessSetupEvent, OnboardingStatusEvent } from '../hooks/useBusinessSetupSubscriptions';
import { useBusinessSetupSubscriptions } from '../hooks/useBusinessSetupSubscriptions';

/**
 * Business Setup Event Context State
 */
export interface BusinessSetupEventState {
  // Event collections
  allEvents: BusinessSetupEvent[];
  onboardingEvents: OnboardingStatusEvent[];
  aiAgentEvents: AIAgentEvent[];
  
  // Current state
  currentOnboardingStatus: string | null;
  previousOnboardingStatus: string | null;
  activeWelcomeThread: string | null;
  lastWelcomeMessage: string | null;
  
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  hasErrors: boolean;
  lastError: Error | null;
  
  // UI state
  showWelcomePopup: boolean;
  isWelcomeMessageProcessed: boolean;
  processedEventIds: Set<string>;
}

/**
 * Business Setup Event Context Actions
 */
export interface BusinessSetupEventActions {
  // Event management
  markEventAsProcessed: (eventId: string) => void;
  clearProcessedEvents: () => void;
  clearAllEvents: () => void;
  
  // UI state management
  setShowWelcomePopup: (show: boolean) => void;
  markWelcomeMessageAsProcessed: () => void;
  
  // Error handling
  clearError: () => void;
  
  // Subscription management
  reconnectSubscriptions: () => void;
}

/**
 * Combined Context Value
 */
export interface BusinessSetupEventContextValue extends BusinessSetupEventState, BusinessSetupEventActions {}

/**
 * Create the context
 */
const BusinessSetupEventContext = createContext<BusinessSetupEventContextValue | null>(null);

/**
 * Hook to use the Business Setup Event Context
 */
export const useBusinessSetupEventContext = (): BusinessSetupEventContextValue => {
  const context = useContext(BusinessSetupEventContext);
  if (!context) {
    throw new Error('useBusinessSetupEventContext must be used within a BusinessSetupEventProvider');
  }
  return context;
};

/**
 * Business Setup Event Provider Props
 */
export interface BusinessSetupEventProviderProps {
  children: React.ReactNode;
  enableLogging?: boolean;
}

/**
 * Business Setup Event Provider Component
 * 
 * Provides centralized state management for all business setup events
 * via React Context and GraphQL subscriptions.
 */
export const BusinessSetupEventProvider: React.FC<BusinessSetupEventProviderProps> = ({
  children,
  enableLogging = false,
}) => {
  // Local state
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);
  const [isWelcomeMessageProcessed, setIsWelcomeMessageProcessed] = useState(false);
  const [processedEventIds, setProcessedEventIds] = useState(new Set<string>());
  const [lastError, setLastError] = useState<Error | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  
  // Subscribe to all business setup events
  const subscriptions = useBusinessSetupSubscriptions();
  
  // Log events if enabled
  useEffect(() => {
    if (enableLogging && subscriptions.lastOnboardingChange) {
      console.log('Onboarding status changed:', subscriptions.lastOnboardingChange);
    }
  }, [subscriptions.lastOnboardingChange, enableLogging]);
  
  useEffect(() => {
    if (enableLogging && subscriptions.lastWelcomeChatEvent) {
      console.log('Welcome chat event:', subscriptions.lastWelcomeChatEvent);
    }
  }, [subscriptions.lastWelcomeChatEvent, enableLogging]);
  
  // Handle connection errors
  useEffect(() => {
    if (subscriptions.hasErrors) {
      const error = subscriptions.businessSetupEvents.connectionError ||
                   subscriptions.onboardingStatus.connectionError ||
                   subscriptions.agentEvents.connectionError;
      
      if (error && error !== lastError) {
        setLastError(error);
        if (enableLogging) {
          console.error('Business setup subscription error:', error);
        }
      }
    } else if (subscriptions.isConnected && lastError) {
      // Clear error when reconnected
      setLastError(null);
      if (enableLogging) {
        console.log('Business setup subscriptions reconnected');
      }
    }
  }, [subscriptions.hasErrors, subscriptions.isConnected, lastError, enableLogging]);
  
  // Process new welcome chat events
  useEffect(() => {
    const latestWelcomeEvent = subscriptions.lastWelcomeChatEvent;
    
    if (latestWelcomeEvent && 
        latestWelcomeEvent.status === 'CHAT_CREATED' &&
        !processedEventIds.has(`welcome-${latestWelcomeEvent.threadId}`)) {
      
      if (enableLogging) {
        console.log('Processing new welcome chat event:', latestWelcomeEvent);
      }
      
      // Mark as processed
      setProcessedEventIds(prev => new Set([...prev, `welcome-${latestWelcomeEvent.threadId}`]));
      
      // Show welcome popup
      setShowWelcomePopup(true);
      setIsWelcomeMessageProcessed(false);
    }
  }, [subscriptions.lastWelcomeChatEvent, processedEventIds, enableLogging]);
  
  // Actions
  const markEventAsProcessed = useCallback((eventId: string) => {
    setProcessedEventIds(prev => new Set([...prev, eventId]));
  }, []);
  
  const clearProcessedEvents = useCallback(() => {
    setProcessedEventIds(new Set());
  }, []);
  
  const clearAllEvents = useCallback(() => {
    subscriptions.clearAllEvents();
    clearProcessedEvents();
    setLastError(null);
  }, [subscriptions, clearProcessedEvents]);
  
  const markWelcomeMessageAsProcessed = useCallback(() => {
    setIsWelcomeMessageProcessed(true);
  }, []);
  
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);
  
  const reconnectSubscriptions = useCallback(() => {
    setReconnectTrigger(prev => prev + 1);
    if (enableLogging) {
      console.log('Triggering subscription reconnect');
    }
  }, [enableLogging]);
  
  // Compute derived state
  const currentOnboardingStatus = subscriptions.onboardingStatus.currentStatus;
  const previousOnboardingStatus = subscriptions.onboardingStatus.previousStatus;
  const activeWelcomeThread = subscriptions.lastWelcomeChatEvent?.threadId || null;
  const lastWelcomeMessage = subscriptions.lastWelcomeChatEvent?.status === 'CHAT_CREATED' 
    ? '🎉 Добро пожаловать в интеграцию с Avito! Нажмите, чтобы начать настройку API.' 
    : null;
  
  // Build context value
  const contextValue: BusinessSetupEventContextValue = {
    // Event collections
    allEvents: subscriptions.businessSetupEvents.events,
    onboardingEvents: subscriptions.onboardingStatus.statusEvents,
    aiAgentEvents: subscriptions.agentEvents.agentEvents,
    
    // Current state
    currentOnboardingStatus,
    previousOnboardingStatus,
    activeWelcomeThread,
    lastWelcomeMessage,
    
    // Connection state
    isConnected: subscriptions.isConnected,
    isLoading: subscriptions.isLoading,
    hasErrors: subscriptions.hasErrors,
    lastError,
    
    // UI state
    showWelcomePopup,
    isWelcomeMessageProcessed,
    processedEventIds,
    
    // Actions
    markEventAsProcessed,
    clearProcessedEvents,
    clearAllEvents,
    setShowWelcomePopup,
    markWelcomeMessageAsProcessed,
    clearError,
    reconnectSubscriptions,
  };
  
  return (
    <BusinessSetupEventContext.Provider value={contextValue}>
      {children}
    </BusinessSetupEventContext.Provider>
  );
};

/**
 * HOC for components that need business setup event context
 */
export const withBusinessSetupEvents = <P extends object>(
  Component: React.ComponentType<P>
) => {
  return React.forwardRef<any, P>((props, ref) => (
    <BusinessSetupEventProvider>
      <Component {...props} ref={ref} />
    </BusinessSetupEventProvider>
  ));
};

/**
 * Hook for simplified access to welcome message state
 */
export const useWelcomeMessageState = () => {
  const context = useBusinessSetupEventContext();
  
  return {
    hasWelcomeMessage: !!context.lastWelcomeMessage,
    welcomeMessage: context.lastWelcomeMessage,
    showPopup: context.showWelcomePopup,
    threadId: context.activeWelcomeThread,
    isProcessed: context.isWelcomeMessageProcessed,
    
    setShowPopup: context.setShowWelcomePopup,
    markAsProcessed: context.markWelcomeMessageAsProcessed,
  };
};

/**
 * Hook for simplified access to onboarding status
 */
export const useOnboardingState = () => {
  const context = useBusinessSetupEventContext();
  
  return {
    currentStatus: context.currentOnboardingStatus,
    previousStatus: context.previousOnboardingStatus,
    isCompleted: context.currentOnboardingStatus === 'COMPLETED',
    statusEvents: context.onboardingEvents,
  };
};