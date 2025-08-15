import { DynamicTool } from '@langchain/core/tools';
import { AgentExecutionResult, AgentState } from '@twenty/shared';

export interface AgentContext {
  workspaceId: string;
  userId: string;
  threadId: string;
  userWorkspaceId: string;
}

export interface ILangGraphAgent {
  execute(
    messages: any[], // LangChain messages
    context: AgentContext,
    currentState?: AgentState,
  ): Promise<AgentExecutionResult & { state: AgentState }>;
  
  getTools(): DynamicTool[];
  getStateSchema(): object;
  getSystemPrompt(): string;
}

export interface LangGraphConfig {
  graphType: 'welcome' | 'sales' | 'support';
  tools: string[];
  stateSchema: object;
  workflowDefinition: object;
  circuitBreakerConfig?: CircuitBreakerConfig;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  timeout: number;
  name: string;
}

export interface SendAgentMessageInput {
  agentId: string;
  threadId: string;
  workspaceId: string;
  messages: any[]; // AgentMessage[]
}

export interface CreateAgentThreadInput {
  agentId: string;
  userWorkspaceId: string;
}
