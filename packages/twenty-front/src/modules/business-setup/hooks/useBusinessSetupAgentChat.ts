import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilValue } from 'recoil';
import { useCallback, useState } from 'react';
import {
  aiChatErrorRecovery,
  AIChatErrorType,
} from '@/ai/services/aiChatErrorRecovery.service';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { BusinessSetupStatus } from './useSetNextBusinessSetupStatus';
import { getAgentConfigForStatus } from '../config/businessSetupAgents.config';

export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  // State for preventing concurrent operations
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Get agent configuration for current status
  const agentConfig = getAgentConfigForStatus(businessSetupStatus);
  const agentId =
    agentConfig?.agentId ||
    currentWorkspace?.defaultAgent?.id ||
    'fallback-agent';

  // Create agent chat thread hook with business setup context
  // The backend will automatically use supervisor routing for business setup
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId,
    businessSetupStep: businessSetupStatus || undefined,
  });

  const createBusinessSetupChat = useCallback(async () => {
    if (isCreatingChat) {
      console.log('Already creating business setup chat, ignoring request');
      return;
    }

    setIsCreatingChat(true);
    setLastError(null);

    try {
      const currentStep = businessSetupStatus || 'WELCOME';

      console.log(
        'Creating business setup chat with supervisor agent for step:',
        currentStep,
      );
      console.log(
        'This will create supervisor agent that routes to appropriate specialized agents',
      );

      // ALWAYS use supervisor agent for business setup - no matter the stage
      // The supervisor will intelligently route to appropriate specialized agents
      await aiChatErrorRecovery.executeRecovery(
        async () => {
          // Use supervisor agent creation with business setup context
          return await createAgentChatThread();
        },
        {
          agentId: 'supervisor-agent', // This will be handled by the backend routing
          businessSetupStatus: currentStep,
          maxRetries: 3,
        },
      );

      console.log('Business setup supervisor thread created successfully');
    } catch (error) {
      const chatError = await aiChatErrorRecovery.handleChatCreationError(
        error instanceof Error ? error : new Error(String(error)),
        {
          agentId: 'supervisor-agent',
          businessSetupStatus: businessSetupStatus || undefined,
        },
      );

      const userMessage = aiChatErrorRecovery.getUserFriendlyMessage(chatError);
      setLastError(userMessage);

      console.error('Failed to create business setup chat thread:', chatError);

      // For business setup, don't fallback - show error
      if (businessSetupStatus === 'WELCOME') {
        console.error(
          'Cannot fallback for WELCOME stage - supervisor agent required',
        );
        throw error;
      }

      // For other stages, can fallback to standard AI
      const canFallback =
        aiChatErrorRecovery.canFallbackToStandardChat(businessSetupStatus);

      if (
        canFallback &&
        chatError.type !== AIChatErrorType.BUSINESS_SETUP_CONFLICT
      ) {
        console.log('Falling back to standard AI page due to error');
        setLastError(`${userMessage} Opening standard chat instead.`);
        openAskAIPage();
      } else {
        throw error;
      }
    } finally {
      setIsCreatingChat(false);
    }
  }, [
    businessSetupStatus,
    isCreatingChat,
    createAgentChatThread,
    openAskAIPage,
  ]);

  // NOTE: This function is kept for reference only and help text
  // It should NOT be used for automatic messages in the chat
  // All messages should be AI responses to user input
  const getWelcomeMessageForStep = useCallback(
    (step: BusinessSetupStatus): string => {
      const config = getAgentConfigForStatus(step);
      if (config?.greetingMessage) {
        return config.greetingMessage;
      }

      // Fallback messages
      const messages = {
        WELCOME:
          '🚀 Настройка интеграции Avito! Мне нужны ваши CLIENT_ID и CLIENT_SECRET для подключения к API.',
        BUSINESS_ANALYSIS:
          "🚀 Let's analyze your business! I'll help you understand your processes and opportunities.",
        SALES_FUNNEL_DESIGN:
          "🎯 Time to design your sales funnel! I'll help you create the perfect conversion path.",
        AGENT_SETUP:
          "🤖 Let's set up your AI agents! I'll help you build your automated team.",
        WORKFLOW_CREATION:
          "⚡ Time to create workflows! I'll help you automate your processes.",
        TEAM_ASSIGNMENT:
          "👥 Let's assign your team! I'll help you organize roles and responsibilities.",
        TESTING_OPTIMIZATION:
          "🧪 Let's test and optimize! I'll help you ensure everything works perfectly.",
        COMPLETED:
          '✅ Congratulations! Your business setup is complete. How can I help you today?',
      };
      return messages[step] || messages.WELCOME;
    },
    [],
  );

  return {
    createBusinessSetupChat,
    getWelcomeMessageForStep,
    isCreatingChat,
    agentConfig,
    lastError,
    clearError: () => setLastError(null),
  };
};
