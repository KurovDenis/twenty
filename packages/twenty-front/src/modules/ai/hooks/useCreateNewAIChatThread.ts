import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useCreateAgentChatThreadMutation } from '~/generated-metadata/graphql';

export const useCreateNewAIChatThread = ({ agentId }: { agentId: string }) => {
  const [, setCurrentThreadId] = useRecoilComponentState(
    currentAIChatThreadComponentState,
    agentId,
  );

  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const businessSetupStatus = useBusinessSetupStatus();
  
  // Prepare mutation variables with business setup context
  const mutationVariables = {
    input: {
      agentId,
      // Include businessSetupStep if user is in business setup flow
      ...(businessSetupStatus && businessSetupStatus !== 'COMPLETED' && {
        businessSetupStep: businessSetupStatus,
      }),
    },
  };
  
  const [createAgentChatThread] = useCreateAgentChatThreadMutation({
    variables: mutationVariables,
    onCompleted: (data) => {
      setCurrentThreadId(data.createAgentChatThread.id);
      openAskAIPage();
    },
  });

  return { createAgentChatThread };
};
