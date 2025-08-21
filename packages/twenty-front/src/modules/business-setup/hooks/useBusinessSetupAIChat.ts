import { useCreateNewAIChatThread } from '@/ai/hooks/useCreateNewAIChatThread';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  businessSetupChatIdState,
  hasBusinessSetupChatState,
} from '@/business-setup/states/businessSetupChatState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useCallback } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

// Proper typing for Business Setup statuses
type BusinessSetupStep =
  | 'WELCOME'
  | 'BUSINESS_ANALYSIS'
  | 'SALES_FUNNEL_DESIGN';

export const useBusinessSetupAIChat = () => {
  const { openAskAIPage, openNewChat } = useOpenAskAIPageInCommandMenu();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  // ✅ Business Setup chat state (for fallback)
  const [, setBusinessSetupChatId] = useRecoilState(businessSetupChatIdState);
  const [, setHasBusinessSetupChat] = useRecoilState(hasBusinessSetupChatState);

  // ✅ Hook for creating new AI chat threads (tabs)
  const agentId = currentWorkspace?.defaultAgent?.id;
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
  });

  const openBusinessSetupChat = useCallback(() => {
    try {
      // ✅ Always create a new Business Setup chat thread (tab)
      if (agentId !== undefined && createAgentChatThread !== undefined) {
        // Create new tab with AI agent for Business Setup
        createAgentChatThread();
      } else {
        // ✅ Fallback: Create new Business Setup chat with old method
        const newChatId = openNewChat('Настройка системы');

        if (newChatId !== null && newChatId !== undefined) {
          setBusinessSetupChatId(newChatId);
          setHasBusinessSetupChat(true);
        }
      }
    } catch {
      // Fallback - open regular AI chat
      try {
        openAskAIPage();
      } catch {
        // Silent fallback - already trying to open AI chat
      }
    }
  }, [
    agentId,
    createAgentChatThread,
    openAskAIPage,
    openNewChat,
    setBusinessSetupChatId,
    setHasBusinessSetupChat,
  ]);

  const openContextualChat = useCallback(
    (step: BusinessSetupStep) => {
      const messages: Record<BusinessSetupStep, string> = {
        WELCOME: 'Настройка системы',
        BUSINESS_ANALYSIS:
          "Let's analyze your business together. What industry are you in?",
        SALES_FUNNEL_DESIGN:
          "Great! Now let's design your sales funnel. What's your current conversion rate?",
      };

      const message = messages[step];

      try {
        openAskAIPage(message);
      } catch {
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
