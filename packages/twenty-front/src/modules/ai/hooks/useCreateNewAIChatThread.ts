import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useCallback } from 'react';
import { useCreateAgentChatThreadMutation } from '~/generated-metadata/graphql';

export const useCreateNewAIChatThread = ({
  agentId,
  onCompleted,
  onError,
}: {
  agentId: string;
  onCompleted?: (chatId: string, graphqlThreadId: string) => void;
  onError?: (error: Error) => void;
}) => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  
  const [createAgentChatThread] = useCreateAgentChatThreadMutation({
    variables: { input: { agentId } },
    onCompleted: (data) => {
      const graphqlThreadId = data.createAgentChatThread.id;
      console.log('✅ Создан OpenRouter поток:', graphqlThreadId);

      // ✅ Вызываем кастомный callback с обоими ID
      if (onCompleted !== undefined) {
        // ✅ chatId будет передан из локального чата
        onCompleted('', graphqlThreadId);
      }

      // ✅ Открываем AI страницу
      openAskAIPage();
    },
    onError: (error) => {
      console.error('❌ Ошибка создания OpenRouter потока:', error);
      onError?.(error);
    },
  });

  // ✅ Возвращаем функцию для создания потока
  const createThread = useCallback(async () => {
    try {
      const result = await createAgentChatThread();
      return result;
    } catch (error) {
      console.error('❌ Ошибка при создании потока:', error);
      throw error;
    }
  }, [createAgentChatThread]);

  return { createAgentChatThread: createThread };
};
