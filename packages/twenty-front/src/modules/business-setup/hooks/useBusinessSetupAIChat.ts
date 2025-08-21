import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { useCallback } from 'react';

// Proper typing for Business Setup statuses
type BusinessSetupStep =
  | 'WELCOME'
  | 'BUSINESS_ANALYSIS'
  | 'SALES_FUNNEL_DESIGN';

export const useBusinessSetupAIChat = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const businessSetupStatus = useBusinessSetupStatus();

  const openBusinessSetupChat = useCallback(() => {
    try {
      // Basic call without complex context
      openAskAIPage(
        "I'm ready to help you set up your business automation! Let's get started.",
      );
    } catch (error) {
      console.error('Failed to open AI chat:', error);

      // Fallback - open regular AI chat
      try {
        openAskAIPage();
      } catch (fallbackError) {
        console.error('Fallback AI chat also failed:', fallbackError);
      }
    }
  }, [openAskAIPage]);

  const openContextualChat = useCallback(
    (step: BusinessSetupStep) => {
      const messages: Record<BusinessSetupStep, string> = {
        WELCOME:
          "I'm ready to help you set up your business automation! Let's get started.",
        BUSINESS_ANALYSIS:
          "Let's analyze your business together. What industry are you in?",
        SALES_FUNNEL_DESIGN:
          "Great! Now let's design your sales funnel. What's your current conversion rate?",
      };

      const message = messages[step];

      try {
        openAskAIPage(message);
      } catch (error) {
        console.error('Failed to open contextual chat:', error);
        openBusinessSetupChat(); // Fallback
      }
    },
    [openAskAIPage, openBusinessSetupChat],
  );

  return {
    openBusinessSetupChat,
    openContextualChat,
  };
};
