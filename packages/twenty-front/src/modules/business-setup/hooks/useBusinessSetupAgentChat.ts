import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilValue } from 'recoil';
import { useCallback, useState } from 'react';
import { aiChatErrorRecovery, AIChatErrorType } from '@/ai/services/aiChatErrorRecovery.service';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { BusinessSetupStatus } from './useSetNextBusinessSetupStatus';
import {
  BUSINESS_SETUP_AGENTS,
  SGR_AVITO_AGENT_ID,
  shouldForceAgent,
  shouldAutoGreet,
  getGreetingMessage,
  getAgentConfigForStatus
} from '../config/businessSetupAgents.config';

export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  
  // State for preventing concurrent operations
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Get agent configuration for current status
  const agentConfig = getAgentConfigForStatus(businessSetupStatus);
  const agentId = agentConfig?.agentId || currentWorkspace?.defaultAgent?.id || 'fallback-agent';
  
  // Create specialized agent chat thread hook with business setup context
  const { createAgentChatThread } = useCreateNewAIChatThread({ 
    agentId,
    businessSetupStep: businessSetupStatus || undefined 
  });
  
  // Create SGR Avito agent thread hook for WELCOME stage
  const { createAgentChatThread: createSGRThread } = useCreateNewAIChatThread({ 
    agentId: SGR_AVITO_AGENT_ID,
    businessSetupStep: 'WELCOME'
  });

  /**
   * Create specialized SGR Avito Agent for WELCOME stage with error recovery
   */
  const createSGRAvitoAgentWithGreeting = useCallback(async () => {
    console.log('Creating SGR Avito Agent for WELCOME stage with auto-greeting');
    
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`SGR Avito Agent creation attempt ${attempt}/${maxRetries}`);
        
        // Use error recovery service for robust SGR agent creation
        await aiChatErrorRecovery.executeRecovery(
          async () => {
            console.log('Executing SGR Avito Agent creation with error recovery');
            return await createSGRThread();
          },
          {
            agentId: SGR_AVITO_AGENT_ID,
            businessSetupStatus: 'WELCOME',
            maxRetries: 1 // Let our outer loop handle retries
          }
        );
        
        console.log('SGR Avito Agent thread created successfully');
        setLastError(null);
        return; // Success!
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`SGR Avito Agent creation attempt ${attempt} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    const finalError = lastError || new Error('Unknown error occurred');
    const chatError = await aiChatErrorRecovery.handleChatCreationError(
      finalError,
      {
        agentId: SGR_AVITO_AGENT_ID,
        businessSetupStatus: 'WELCOME'
      }
    );
    
    const userMessage = aiChatErrorRecovery.getUserFriendlyMessage(chatError);
    setLastError(`Failed to create SGR Avito Agent after ${maxRetries} attempts: ${userMessage}`);
    
    console.error('Failed to create SGR Avito Agent after all retries:', chatError);
    
    // For WELCOME stage, SGR Avito Agent is REQUIRED - no fallback allowed
    if (businessSetupStatus === 'WELCOME') {
      throw new Error(`SGR Avito Agent is required for WELCOME stage: ${userMessage}`);
    }
    
    throw finalError;
  }, [createSGRThread, businessSetupStatus]);

  const createBusinessSetupChat = useCallback(async () => {
    if (isCreatingChat) {
      console.log('Already creating business setup chat, ignoring request');
      return;
    }
    
    setIsCreatingChat(true);
    setLastError(null);
    
    try {
      const currentStep = businessSetupStatus || 'WELCOME';
      
      console.log('Creating business setup chat with SGR agent for step:', currentStep);
      console.log('This will create specialized welcome-agent with Avito SGR support');
      
      if (currentStep === 'WELCOME') {
        // FORCE SGR Avito Agent for WELCOME stage with error recovery
        await createSGRAvitoAgentWithGreeting();
      } else {
        // For other stages, use regular business setup agent with error recovery
        await aiChatErrorRecovery.executeRecovery(
          async () => {
            return await createAgentChatThread();
          },
          {
            agentId,
            businessSetupStatus: currentStep,
            maxRetries: 2
          }
        );
      }
      
      console.log('Business setup chat thread created successfully');
      
    } catch (error) {
      const chatError = await aiChatErrorRecovery.handleChatCreationError(
        error instanceof Error ? error : new Error(String(error)),
        {
          agentId,
          businessSetupStatus: businessSetupStatus || undefined
        }
      );
      
      const userMessage = aiChatErrorRecovery.getUserFriendlyMessage(chatError);
      setLastError(userMessage);
      
      console.error('Failed to create business setup chat thread:', chatError);
      
      // Check if we can fallback to standard AI page
      const canFallback = aiChatErrorRecovery.canFallbackToStandardChat(businessSetupStatus);
      
      if (canFallback && chatError.type !== AIChatErrorType.BUSINESS_SETUP_CONFLICT) {
        console.log('Falling back to standard AI page due to error');
        setLastError(`${userMessage} Opening standard chat instead.`);
        openAskAIPage();
      } else {
        // For WELCOME stage or critical errors, show error but don't fallback
        console.error('Cannot fallback for WELCOME stage or critical error');
        throw error;
      }
    } finally {
      setIsCreatingChat(false);
    }
  }, [businessSetupStatus, isCreatingChat, createSGRAvitoAgentWithGreeting, createAgentChatThread, openAskAIPage, agentId]);

  // NOTE: This function is kept for reference only and help text
  // It should NOT be used for automatic messages in the chat
  // All messages should be AI responses to user input
  const getWelcomeMessageForStep = useCallback((step: BusinessSetupStatus): string => {
    const config = getAgentConfigForStatus(step);
    if (config?.greetingMessage) {
      return config.greetingMessage;
    }
    
    // Fallback messages
    const messages = {
      WELCOME: "🚀 Настройка интеграции Avito! Мне нужны ваши CLIENT_ID и CLIENT_SECRET для подключения к API.",
      BUSINESS_ANALYSIS: "🚀 Let's analyze your business! I'll help you understand your processes and opportunities.",
      SALES_FUNNEL_DESIGN: "🎯 Time to design your sales funnel! I'll help you create the perfect conversion path.",
      AGENT_SETUP: "🤖 Let's set up your AI agents! I'll help you build your automated team.",
      WORKFLOW_CREATION: "⚡ Time to create workflows! I'll help you automate your processes.",
      TEAM_ASSIGNMENT: "👥 Let's assign your team! I'll help you organize roles and responsibilities.",
      TESTING_OPTIMIZATION: "🧪 Let's test and optimize! I'll help you ensure everything works perfectly.",
      COMPLETED: "✅ Congratulations! Your business setup is complete. How can I help you today?",
    };
    return messages[step] || messages.WELCOME;
  }, []);

  return { 
    createBusinessSetupChat, 
    getWelcomeMessageForStep,
    isCreatingChat,
    agentConfig,
    lastError,
    clearError: () => setLastError(null)
  };
};