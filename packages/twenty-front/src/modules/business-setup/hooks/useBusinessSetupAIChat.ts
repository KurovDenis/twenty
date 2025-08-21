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
  const { openAskAIPage, openNewChat, restoreChat } =
    useOpenAskAIPageInCommandMenu();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  // ✅ Business Setup chat state
  const [businessSetupChatId, setBusinessSetupChatId] = useRecoilState(
    businessSetupChatIdState,
  );
  const [hasBusinessSetupChat, setHasBusinessSetupChat] = useRecoilState(
    hasBusinessSetupChatState,
  );

  // ✅ Hook for creating new AI chat threads (tabs)
  const agentId = currentWorkspace?.defaultAgent?.id;
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
    onCompleted: (chatId: string) => {
      // ✅ Сохраняем ID нового Business Setup чата
      setBusinessSetupChatId(chatId);
      setHasBusinessSetupChat(true);
    },
  });

  // ✅ Кастомный хук для создания Business Setup чата с сохранением ID
  const createBusinessSetupAgentChatThread = useCallback(() => {
    if (agentId !== undefined && createAgentChatThread !== undefined) {
      // Создаем новый чат - ID автоматически сохранится в onCompleted callback
      createAgentChatThread();
    }
  }, [agentId, createAgentChatThread]);

  const openBusinessSetupChat = useCallback(() => {
    try {
      // ✅ Проверяем, есть ли существующий Business Setup чат
      if (hasBusinessSetupChat && businessSetupChatId !== null) {
        // ✅ Восстанавливаем существующий Business Setup чат
        restoreChat(businessSetupChatId);
        return;
      }

      // ✅ Создаем новый Business Setup чат если его еще нет
      if (agentId !== undefined && createAgentChatThread !== undefined) {
        // Create new tab with AI agent for Business Setup
        createBusinessSetupAgentChatThread();
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
    hasBusinessSetupChat,
    businessSetupChatId,
    restoreChat,
    agentId,
    createAgentChatThread,
    openAskAIPage,
    openNewChat,
    setBusinessSetupChatId,
    setHasBusinessSetupChat,
    createBusinessSetupAgentChatThread,
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
    createBusinessSetupAgentChatThread,
  };
};
