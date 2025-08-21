import { useAIChats, useCreateNewAIChatThread } from '@/ai/hooks';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

// Proper typing for Business Setup statuses
type BusinessSetupStep =
  | 'WELCOME'
  | 'BUSINESS_ANALYSIS'
  | 'SALES_FUNNEL_DESIGN';

export const useBusinessSetupAIChat = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  // ✅ Используем новый хук для управления чатами
  const aiChatsHook = useAIChats();
  console.log('🔍 useAIChats hook:', aiChatsHook);
  
  const {
    createBusinessSetupChat,
    getBusinessSetupChat,
    restoreChat,
    updateGraphQLThreadId,
  } = aiChatsHook;

  // ✅ Hook for creating new AI chat threads (tabs)
  const agentId = currentWorkspace?.defaultAgent?.id;
  const { createAgentChatThread } = useCreateNewAIChatThread({
    agentId: agentId || '',
    onCompleted: (graphqlThreadId: string) => {
      // GraphQL чат создан, ID: ${graphqlThreadId}

      // ✅ Получаем Business Setup чат и связываем с GraphQL
      const businessSetupChat = getBusinessSetupChat();
      if (businessSetupChat !== null && businessSetupChat !== undefined) {
        // Связываем локальный чат ${businessSetupChat.id} с GraphQL чатом ${graphqlThreadId}
        updateGraphQLThreadId(
          businessSetupChat.id,
          graphqlThreadId,
          agentId || '',
        );
      }

      // Business Setup чат полностью создан и синхронизирован
    },
  });

  // ✅ Создание Business Setup чата
  const createBusinessSetupAgentChatThread = useCallback(() => {
    console.log('🔧 createBusinessSetupAgentChatThread() вызван');

    if (agentId !== undefined && createAgentChatThread !== undefined) {
      console.log('🚀 Создаем Business Setup чат');

      // ✅ Создаем локальный чат через новый хук
      const _newChat = createBusinessSetupChat('Настройка системы');
      console.log('💾 Создан локальный чат:', _newChat.id);

      // ✅ Затем создаем GraphQL чат
      console.log('🚀 Вызываем createAgentChatThread()');
      createAgentChatThread();
    } else {
      console.log('❌ Не можем создать чат:', { agentId, createAgentChatThread: !!createAgentChatThread });
    }
  }, [agentId, createAgentChatThread, createBusinessSetupChat]);

  const openBusinessSetupChat = useCallback(() => {
    console.log('🔍 openBusinessSetupChat() вызван');
    console.log('🔍 Функции:', { getBusinessSetupChat, restoreChat, agentId, createAgentChatThread });

    try {
      // ✅ Проверяем, есть ли существующий Business Setup чат
      const existingChat = getBusinessSetupChat();
      console.log('🔍 existingChat:', existingChat);
      
      if (existingChat !== null && existingChat !== undefined) {
        console.log('✅ Восстанавливаем существующий Business Setup чат:', existingChat.id);
        
        // ✅ Если у чата нет GraphQL ID, создаем новый поток
        if (!existingChat.graphqlThreadId && agentId && createAgentChatThread) {
          console.log('🔧 У чата нет GraphQL ID, создаем новый поток');
          createAgentChatThread();
        }
        
        restoreChat(existingChat.id);
        console.log('✅ restoreChat выполнен');
        return;
      }

      // Создаем новый Business Setup чат
      console.log('🆕 Создаем новый Business Setup чат');
      // ✅ Создаем новый Business Setup чат
      if (agentId !== undefined && createAgentChatThread !== undefined) {
        console.log('🚀 Вызываем createBusinessSetupAgentChatThread()');
        // Вызываем createBusinessSetupAgentChatThread()
        createBusinessSetupAgentChatThread();
      } else {
        console.log('🔄 Fallback: openAskAIPage()');
        // Fallback: openAskAIPage()
        openAskAIPage();
      }
    } catch (_error) {
      // Ошибка в openBusinessSetupChat
      // Fallback - open regular AI chat
      try {
        openAskAIPage();
      } catch {
        // Silent fallback - already trying to open AI chat
      }
    }
  }, [
    getBusinessSetupChat,
    restoreChat,
    agentId,
    createAgentChatThread,
    openAskAIPage,
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
