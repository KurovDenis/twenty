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
