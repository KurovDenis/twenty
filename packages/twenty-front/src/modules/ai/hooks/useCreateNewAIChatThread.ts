import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useCreateAgentChatThreadMutation } from '~/generated-metadata/graphql';

export const useCreateNewAIChatThread = ({
  agentId,
  onCompleted,
}: {
  agentId: string;
  onCompleted?: (chatId: string) => void;
}) => {
  const [, setCurrentThreadId] = useRecoilComponentState(
    currentAIChatThreadComponentState,
    agentId,
  );

  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const [createAgentChatThread] = useCreateAgentChatThreadMutation({
    variables: { input: { agentId } },
    onCompleted: (data) => {
      const chatId = data.createAgentChatThread.id;
      setCurrentThreadId(chatId);

      // ✅ Вызываем кастомный callback если передан
      if (onCompleted) {
        onCompleted(chatId);
      }

      openAskAIPage();
    },
  });

  return { createAgentChatThread };
};
