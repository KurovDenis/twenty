import {
  aiChatsState,
  currentChatIdState,
  type AIChat,
} from '@/ai/states/aiChatState';
import { useCommandMenu } from '@/command-menu/hooks/useCommandMenu';
import { CommandMenuPages } from '@/command-menu/types/CommandMenuPages';
import { t } from '@lingui/core/macro';
import { useCallback } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { IconSparkles } from 'twenty-ui/display';
import { v4 } from 'uuid';

export const useOpenAskAIPageInCommandMenu = () => {
  const { navigateCommandMenu } = useCommandMenu();
  const [aiChats, setAiChats] = useRecoilState(aiChatsState);
  const setCurrentChatId = useSetRecoilState(currentChatIdState);

  // ✅ Создание нового чата
  const openNewChat = useCallback(
    (initialMessage?: string) => {
      const chatId = v4();

      const newChat: AIChat = {
        id: chatId,
        title: initialMessage || t`Ask AI`,
        context: initialMessage ? 'business-setup' : 'general',
        initialMessage: initialMessage || null,
        messages: initialMessage
          ? [
              {
                role: 'assistant',
                content: initialMessage,
                timestamp: new Date(),
              },
            ]
          : [],
        createdAt: new Date(),
        lastAccessed: new Date(),
        isActive: true,
        isBusinessSetup: !!initialMessage,
      };

      setAiChats((prev) => ({ ...prev, [chatId]: newChat }));
      setCurrentChatId(chatId);

      navigateCommandMenu({
        page: CommandMenuPages.AskAI,
        pageTitle: initialMessage || t`Ask AI`,
        pageIcon: IconSparkles,
        pageId: chatId,
      });

      return chatId;
    },
    [setAiChats, setCurrentChatId, navigateCommandMenu],
  );

  // ✅ Восстановление существующего чата
  const restoreChat = useCallback(
    (chatId: string) => {
      if (aiChats[chatId] !== undefined) {
        // Обновляем время последнего доступа
        setAiChats((prev) => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            lastAccessed: new Date(),
          },
        }));

        setCurrentChatId(chatId);
        navigateCommandMenu({
          page: CommandMenuPages.AskAI,
          pageTitle: aiChats[chatId].initialMessage || t`Ask AI`,
          pageIcon: IconSparkles,
          pageId: chatId,
        });
      } else {
        // Fallback на новый чат
        openNewChat();
      }
    },
    [aiChats, setAiChats, setCurrentChatId, navigateCommandMenu, openNewChat],
  );

  // ✅ Обратная совместимость с существующим API
  const openAskAIPage = useCallback(
    (pageTitle?: string | null) => {
      if (pageTitle !== null && pageTitle !== undefined) {
        // Если передается заголовок, создаем новый чат с этим сообщением
        return openNewChat(pageTitle);
      } else {
        // Если заголовок не передается, создаем пустой чат
        return openNewChat();
      }
    },
    [openNewChat],
  );

  return {
    openAskAIPage,
    restoreChat,
    openNewChat,
  };
};
