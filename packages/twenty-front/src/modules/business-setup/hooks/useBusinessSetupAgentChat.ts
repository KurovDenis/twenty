import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { BusinessSetupStatus } from './useSetNextBusinessSetupStatus';

export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const createBusinessSetupChat = () => {
    const currentStep = businessSetupStatus || 'WELCOME';
    
    console.log('Creating business setup chat with step:', currentStep);
    console.log('Opening empty chat interface - no pre-filled messages');
    
    // CHANGED: Open empty chat without pre-filled message
    // Let user type their own message to trigger AI response
    // This prevents confusing automatic messages and allows natural conversation flow
    openAskAIPage();
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