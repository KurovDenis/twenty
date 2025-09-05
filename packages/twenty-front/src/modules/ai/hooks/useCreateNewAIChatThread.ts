import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';
import { BusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useCreateAgentChatThreadMutation } from '~/generated-metadata/graphql';

export const useCreateNewAIChatThread = ({
  agentId,
  businessSetupStep,
}: {
  agentId: string;
  businessSetupStep?: BusinessSetupStatus;
}) => {
  const [, setCurrentThreadId] = useRecoilComponentState(
    currentAIChatThreadComponentState,
    agentId,
  );

  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const currentBusinessSetupStatus = useBusinessSetupStatus();

  // Use provided businessSetupStep or fall back to current status
  const effectiveBusinessSetupStep =
    businessSetupStep || currentBusinessSetupStatus;

  // Prepare mutation variables with business setup context
  const mutationVariables = {
    input: {
      agentId,
      // Include businessSetupStep if user is in business setup flow
      ...(effectiveBusinessSetupStep &&
        effectiveBusinessSetupStep !== 'COMPLETED' && {
          businessSetupStep: effectiveBusinessSetupStep,
        }),
    },
  };

  const [createAgentChatThread] = useCreateAgentChatThreadMutation({
    variables: mutationVariables,
    onCompleted: (data) => {
      const newThreadId = data.createAgentChatThread.id;
      console.log('🎉 SUCCESS: Created new chat thread:', newThreadId, 'with agent:', data.createAgentChatThread.agentId);
      setCurrentThreadId(newThreadId);
      openAskAIPage();
    },
    onError: (error) => {
      console.error('❌ ERROR: Failed to create agent chat thread:', error);
    },
  });
  
  console.log('=== useCreateNewAIChatThread Hook ===');
  console.log('agentId:', agentId);
  console.log('businessSetupStep:', businessSetupStep);
  console.log('currentBusinessSetupStatus:', currentBusinessSetupStatus);
  console.log('effectiveBusinessSetupStep:', effectiveBusinessSetupStep);
  console.log('mutationVariables:', mutationVariables);

  return { createAgentChatThread };
};
