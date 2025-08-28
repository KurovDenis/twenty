import { useCallback, useEffect, useState } from 'react';
import { useAIAgentEventsSubscription } from './useBusinessSetupSubscriptions';
import { getCurrentUserId } from '~/auth/utils/get-current-user-id';
import { useNavigate } from 'react-router-dom';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { getAgentConfigForStatus, getGreetingMessage } from '@/business-setup/config/businessSetupAgents.config';

/**
 * Hook for managing AI agent welcome messages via GraphQL subscriptions
 * 
 * This hook replaces the previous local EventEmitter approach with real-time
 * GraphQL subscriptions to receive welcome chat events from the backend.
 */
export const useWelcomeMessage = () => {
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();
  const businessSetupStatus = useBusinessSetupStatus();
  const agentConfig = getAgentConfigForStatus(businessSetupStatus);
  
  // Subscribe to AI agent events via GraphQL
  const {
    agentEvents,
    welcomeChatEvents,
    chatCreatedEvents,
    chatFailedEvents,
    lastWelcomeChatEvent,
    isConnected,
    isLoading,
    connectionError,
  } = useAIAgentEventsSubscription();

  // Process welcome chat created events
  useEffect(() => {
    const latestChatCreated = chatCreatedEvents.find(event => 
      event.status === 'CHAT_CREATED' && 
      event.threadId
    );
    
    if (latestChatCreated && latestChatCreated.threadId !== threadId) {
      console.log('Welcome chat created event received:', latestChatCreated);
      
      // Get the appropriate greeting message based on business setup status
      let greetingMessage = getGreetingMessage(businessSetupStatus);
      
      // Fallback to agent config or generic message
      if (!greetingMessage) {
        if (agentConfig?.greetingMessage) {
          greetingMessage = agentConfig.greetingMessage;
        } else if (businessSetupStatus === 'WELCOME') {
          // Specific fallback for SGR Avito agent
          greetingMessage = `🤖 **Привет! Я SGR Avito Integration Assistant**

**Моя задача:** Помочь вам настроить интеграцию с Avito для автоматизации вашего бизнеса.

**Готовы начать? Отправьте мне ваши учетные данные Avito API!** 🚀`;
        } else {
          greetingMessage = '🎉 Welcome to Business Setup! Your AI assistant is ready to help you get started.';
        }
      }
      
      setThreadId(latestChatCreated.threadId!);
      setWelcomeMessage(greetingMessage);
      setShowPopup(true);
      setIsProcessing(false);
      setError(null);
    }
  }, [chatCreatedEvents, threadId]);

  // Process welcome chat failed events
  useEffect(() => {
    const latestChatFailed = chatFailedEvents.find(event => 
      event.status === 'CHAT_FAILED'
    );
    
    if (latestChatFailed) {
      console.warn('Welcome chat creation failed:', latestChatFailed.error);
      setError(latestChatFailed.error || 'Failed to create welcome chat');
      setIsProcessing(false);
    }
  }, [chatFailedEvents]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError) {
      console.error('Welcome message subscription error:', connectionError);
      setError('Connection error: Unable to receive real-time updates');
      setIsProcessing(false);
    } else if (isConnected && error?.includes('Connection error')) {
      // Clear connection errors when reconnected
      setError(null);
    }
  }, [connectionError, isConnected, error]);

  // Show welcome popup
  const showWelcomePopup = useCallback(() => {
    setShowPopup(true);
  }, []);

  // Hide welcome popup
  const hideWelcomePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  // Continue chat - navigate to the AI chat interface
  const continueChat = useCallback(() => {
    if (threadId) {
      console.log('Continuing chat with thread:', threadId);
      
      // Navigate to AI chat with the specific thread
      // Adjust the route based on your app's routing structure
      navigate(`/chat/${threadId}`);
      
      // Hide the popup
      hideWelcomePopup();
    } else {
      console.warn('No thread ID available for continuing chat');
      setError('Unable to continue chat: No thread available');
    }
  }, [threadId, navigate, hideWelcomePopup]);

  // Retry welcome chat creation (if needed)
  const retryWelcomeChat = useCallback(() => {
    setError(null);
    setIsProcessing(true);
    // Note: Retry would typically be handled by the backend
    // We just clear the error state here
  }, []);

  // Clear welcome message state
  const clearWelcomeMessage = useCallback(() => {
    setWelcomeMessage(null);
    setThreadId(null);
    setShowPopup(false);
    setError(null);
    setIsProcessing(false);
  }, []);

  return {
    // Core state
    welcomeMessage,
    showPopup,
    threadId,
    isProcessing,
    error,
    
    // Connection state
    isConnected,
    isLoading,
    connectionError,
    
    // Actions
    showWelcomePopup,
    hideWelcomePopup,
    continueChat,
    retryWelcomeChat,
    clearWelcomeMessage,
    setShowPopup,
    
    // Raw events for debugging
    agentEvents,
    welcomeChatEvents,
    chatCreatedEvents,
    chatFailedEvents,
    lastWelcomeChatEvent,
  };
};
