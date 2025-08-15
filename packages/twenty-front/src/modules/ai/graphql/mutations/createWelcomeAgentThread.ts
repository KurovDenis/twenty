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

// Temporary hook until codegen is run
export const useCreateWelcomeAgentThreadMutation = () => {
  // This is a placeholder - will be replaced by generated code
  return [
    async (options: { variables: { input: CreateWelcomeAgentThreadInput } }) => {
      // Placeholder implementation
      console.warn('useCreateWelcomeAgentThreadMutation: This is a placeholder. Run codegen to generate the real hook.');
      return {
        data: {
          createWelcomeAgentThread: {
            id: 'placeholder-id',
            agentId: options.variables.input.agentId,
            userWorkspaceId: 'placeholder-workspace-id',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        }
      };
    }
  ];
};
