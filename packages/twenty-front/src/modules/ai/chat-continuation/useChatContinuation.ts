import { gql, useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';

// NOTE: CONTINUE_WELCOME_CHAT mutation removed as all message processing
// now goes through SupervisorSGRService routing automatically when users
// send messages to supervisor agent threads

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
    // LEGACY FUNCTION - No longer used
    // All message processing now goes through SupervisorSGRService automatically
    // when users send messages to supervisor agent threads via the chat UI

    console.warn(
      'continueChat called but is deprecated. Messages should be sent through chat UI.',
    );
    setError(
      'This function is deprecated. Please use the chat interface directly.',
    );
  }, []);

  const transitionToNextStep = useCallback(
    async (input: BusinessSetupTransitionInput) => {
      setIsLoading(true);
      setError(null);

      try {
        const { data } = await apolloClient.mutate({
          mutation: TRANSITION_TO_NEXT_STEP,
          variables: { input },
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
    },
    [apolloClient],
  );

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
    resetState,
  };
};
