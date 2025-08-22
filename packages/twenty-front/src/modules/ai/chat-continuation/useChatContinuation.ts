import { gql, useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';

// GraphQL мутации для продолжения чата
const CONTINUE_WELCOME_CHAT = gql`
  mutation ContinueWelcomeChat($input: ChatContinuationInput!) {
    continueWelcomeChat(input: $input)
  }
`;

const TRANSITION_TO_NEXT_STEP = gql`
  mutation TransitionToNextStep($input: BusinessSetupTransitionInput!) {
    transitionToNextStep(input: $input)
  }
`;

export interface ChatContinuationInput {
  threadId: string;
  message: string;
  context?: string;
  fileIds?: string[];
}

export interface BusinessSetupTransitionInput {
  fromStep: string;
  toStep: string;
  reason: string;
  context?: string;
}

export const useChatContinuation = (threadId: string | null) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  
  const apolloClient = useApolloClient();

  const continueChat = useCallback(async (input: ChatContinuationInput) => {
    if (!threadId) {
      setError('No active chat thread');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apolloClient.mutate({
        mutation: CONTINUE_WELCOME_CHAT,
        variables: {
          input: {
            ...input,
            threadId: threadId,
          }
        }
      });

      if (data?.continueWelcomeChat) {
        setLastResponse('Chat continued successfully');
        // TODO: Обновить UI с ответом AI
      } else {
        setError('Failed to continue chat');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [threadId, apolloClient]);

  const transitionToNextStep = useCallback(async (input: BusinessSetupTransitionInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await apolloClient.mutate({
        mutation: TRANSITION_TO_NEXT_STEP,
        variables: { input }
      });

      if (data?.transitionToNextStep) {
        setNextStep(input.toStep);
        setLastResponse(`Successfully transitioned to ${input.toStep}`);
      } else {
        setError('Failed to transition to next step');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [apolloClient]);

  const resetState = useCallback(() => {
    setError(null);
    setLastResponse(null);
    setNextStep(null);
  }, []);

  return {
    continueChat,
    transitionToNextStep,
    isLoading,
    error,
    lastResponse,
    nextStep,
    resetState
  };
};
