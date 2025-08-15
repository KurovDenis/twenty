import { gql } from '@apollo/client';

export const CREATE_WELCOME_AGENT_THREAD = gql`
  mutation CreateWelcomeAgentThread($input: CreateWelcomeAgentThreadInput!) {
    createWelcomeAgentThread(input: $input) {
      id
      agentId
      userWorkspaceId
      createdAt
      updatedAt
    }
  }
`;

export interface CreateWelcomeAgentThreadInput {
  agentId: string;
}

export interface CreateWelcomeAgentThreadResponse {
  createWelcomeAgentThread: {
    id: string;
    agentId: string;
    userWorkspaceId: string;
    createdAt: string;
    updatedAt: string;
  };
}
