import { gql } from '@apollo/client';
import { AGENT_FRAGMENT } from '../fragments/agentFragment';

export const FIND_MANY_AGENTS = gql`
  ${AGENT_FRAGMENT}
  query FindManyAgents {
    findManyAgents {
      ...AgentFields
    }
  }
`;

// Temporary hook until codegen is run
export const useFindManyAgentsQuery = (options?: { variables?: any }) => {
  // This is a placeholder - will be replaced by generated code
  console.warn('useFindManyAgentsQuery: This is a placeholder. Run codegen to generate the real hook.');
  
  return {
    data: [
      {
        id: 'welcome-agent-id',
        name: 'Welcome Agent',
        label: 'Welcome Agent',
        description: 'AI assistant to help new users get started',
        icon: 'sparkles',
        prompt: 'You are a helpful AI assistant for new users',
        modelId: 'gpt-4',
        responseFormat: 'text',
        roleId: null,
        isCustom: false,
        agentType: 'langgraph',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ],
    loading: false,
    error: null,
  };
};
