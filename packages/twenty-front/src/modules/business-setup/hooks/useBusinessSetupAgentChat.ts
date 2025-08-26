import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilValue } from 'recoil';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { BusinessSetupStatus } from './useSetNextBusinessSetupStatus';

export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  
  // Get default agent ID as fallback
  const defaultAgentId = currentWorkspace?.defaultAgent?.id || 'fallback-agent';
  
  // Create specialized agent chat thread hook with business setup context
  const { createAgentChatThread } = useCreateNewAIChatThread({ 
    agentId: defaultAgentId,
    businessSetupStep: businessSetupStatus || undefined 
  });

  const createBusinessSetupChat = async () => {
    const currentStep = businessSetupStatus || 'WELCOME';
    
    console.log('Creating business setup chat with SGR agent for step:', currentStep);
    console.log('This will create specialized welcome-agent with Avito SGR support');
    
    try {
      // Create specialized business setup agent thread
      // The backend will automatically create/find the appropriate agent
      // based on businessSetupStep and use SGR for WELCOME step
      await createAgentChatThread();
      
      console.log('Business setup chat thread created successfully');
      // createAgentChatThread automatically opens the AI page with the new thread
    } catch (error) {
      console.error('Failed to create business setup chat thread:', error);
      // Fallback to standard AI page
      console.log('Falling back to standard AI page');
      openAskAIPage();
    }
  };

  // NOTE: This function is kept for reference only and help text
  // It should NOT be used for automatic messages in the chat
  // All messages should be AI responses to user input
  const getWelcomeMessageForStep = (step: BusinessSetupStatus): string => {
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
  };

  return { createBusinessSetupChat, getWelcomeMessageForStep };
};