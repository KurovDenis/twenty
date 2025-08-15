import { gql } from '@apollo/client';

export const SEND_WELCOME_AGENT_MESSAGE = gql`
  mutation SendWelcomeAgentMessage($input: SendWelcomeAgentMessageInput!) {
    sendWelcomeAgentMessage(input: $input) {
      id
      threadId
      role
      content
      createdAt
      metadata
    }
  }
`;

export interface SendWelcomeAgentMessageInput {
  agentId: string;
  threadId: string;
  workspaceId: string;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
  }>;
}

export interface SendWelcomeAgentMessageResponse {
  sendWelcomeAgentMessage: {
    id: string;
    threadId: string;
    role: string;
    content: string;
    createdAt: string;
    metadata?: Record<string, any>;
  };
}

// Temporary hook until codegen is run
export const useSendWelcomeAgentMessageMutation = () => {
  // This is a placeholder - will be replaced by generated code
  return [
    async (options: { variables: { input: SendWelcomeAgentMessageInput } }) => {
      // Placeholder implementation
      console.warn('useSendWelcomeAgentMessageMutation: This is a placeholder. Run codegen to generate the real hook.');
      return {
        data: {
          sendWelcomeAgentMessage: {
            id: 'placeholder-message-id',
            threadId: options.variables.input.threadId,
            role: 'assistant',
            content: 'This is a placeholder response. The real AI agent will respond when the backend is properly connected.',
            createdAt: new Date().toISOString(),
            metadata: {},
          }
        }
      };
    }
  ];
};
