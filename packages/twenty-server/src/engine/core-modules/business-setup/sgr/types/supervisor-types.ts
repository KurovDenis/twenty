import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import { SupervisorStepResult, BusinessSetupProgress } from '../schemas/supervisor-sgr.schema';

/**
 * Supervisor Agent Configuration
 */
export interface SupervisorAgentConfig {
  name: 'business-setup-supervisor';
  modelId: 'google/gemini-2.5-flash';
  maxSteps: number;
  timeoutMs: number;
  isCustom: true;
}

/**
 * Agent mapping for all business setup stages
 */
export const BUSINESS_SETUP_AGENT_MAPPING: Record<BusinessSetupStatus, string> = {
  [BusinessSetupStatus.WELCOME]: 'sgr-avito-agent',
  [BusinessSetupStatus.BUSINESS_ANALYSIS]: 'business-analysis-agent',
  [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 'funnel-designer-agent',
  [BusinessSetupStatus.AGENT_SETUP]: 'agent-orchestrator-agent',
  [BusinessSetupStatus.WORKFLOW_CREATION]: 'workflow-generator-agent',
  [BusinessSetupStatus.TEAM_ASSIGNMENT]: 'team-assignment-agent',
  [BusinessSetupStatus.TESTING_OPTIMIZATION]: 'testing-optimization-agent',
  [BusinessSetupStatus.COMPLETED]: 'no-agent-needed'
};

/**
 * Route message payload for supervisor routing
 */
export interface RouteMessagePayload {
  userId: string;
  workspaceId: string;
  threadId: string;
  message: string;
  currentStatus?: BusinessSetupStatus;
  timestamp: Date;
}

/**
 * Supervisor thinking step for transparent reasoning display
 */
export interface SupervisorThinkingStep {
  stepNumber: number;
  currentState: string;
  plannedSteps: string[];
  selectedTool: string;
  toolExecution?: {
    status: 'in_progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
  };
  timestamp: Date;
}

/**
 * Supervisor SGR streaming result types
 */
export type SupervisorSGRStreamingResult = 
  | SupervisorThinkingStreamResult
  | SupervisorToolExecutionStreamResult
  | SupervisorFinalResponseStreamResult;

export interface SupervisorThinkingStreamResult {
  type: 'thinking';
  step: SupervisorThinkingStep;
  completed: boolean;
}

export interface SupervisorToolExecutionStreamResult {
  type: 'tool_execution';
  step: SupervisorThinkingStep;
  completed: boolean;
}

export interface SupervisorFinalResponseStreamResult {
  type: 'final_response';
  content: string;
  completed: boolean;
  routedTo?: string;
}

/**
 * Supervisor execution result with streaming context
 */
export interface SupervisorExecutionResultWithStreaming {
  success: boolean;
  routedTo?: string;
  finalMessage: string;
  steps_executed: string[];
  streamingSteps?: SupervisorThinkingStep[];
  error?: string;
  timestamp: Date;
}

/**
 * Business setup key-value type mapping extension
 */
export interface BusinessSetupKeyValueTypeMapExtension {
  // Supervisor specific settings
  SUPERVISOR_ENABLED: boolean;
  SUPERVISOR_MAX_STEPS: number;
  SUPERVISOR_TIMEOUT_MS: number;
  
  // Business setup progress tracking
  BUSINESS_SETUP_CURRENT_STATUS: BusinessSetupStatus;
  BUSINESS_SETUP_STEPS_COMPLETED: BusinessSetupStatus[];
  BUSINESS_SETUP_LAST_UPDATED: string; // ISO date string
  
  // Agent routing history
  BUSINESS_SETUP_ROUTING_HISTORY: Array<{
    timestamp: string;
    fromStatus: BusinessSetupStatus;
    toStatus: BusinessSetupStatus;
    reason: string;
  }>;
}

/**
 * Tool execution result for supervisor tools
 */
export interface SupervisorToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  message: string;
  timestamp: Date;
}

/**
 * Supervisor status interface for debugging and monitoring
 */
export interface SupervisorStatus {
  supervisorEnabled: boolean;
  currentBusinessSetupStatus?: BusinessSetupStatus;
  lastProcessedAt?: Date;
  activeThreads?: number;
}

/**
 * Supervisor agent prompt system configuration
 */
export interface SupervisorPromptConfig {
  systemPrompt: string;
  taskInstructions: string;
  routingRules: Record<BusinessSetupStatus, string>;
  errorHandling: string;
}

/**
 * Supervisor tool dispatcher interface
 */
export interface ISupervisorToolDispatcher {
  dispatch(
    tool: SupervisorStepResult['function'],
    userId: string,
    workspaceId: string
  ): Promise<SupervisorToolExecutionResult>;
  
  checkBusinessSetupStatus(
    userId: string,
    workspaceId: string
  ): Promise<BusinessSetupProgress>;
  
  routeToSpecializedAgent(
    status: BusinessSetupStatus,
    message: string,
    userId: string,
    workspaceId: string,
    threadId: string,
    reason: string
  ): Promise<SupervisorToolExecutionResult>;
  
  processDirectly(
    response: string,
    reason: string
  ): Promise<SupervisorToolExecutionResult>;
  
  statusChange(
    fromStatus: BusinessSetupStatus,
    toStatus: BusinessSetupStatus,
    userId: string,
    workspaceId: string,
    reason: string,
    triggerEvent?: string
  ): Promise<SupervisorToolExecutionResult>;
  
  completeRouting(
    success: boolean,
    finalMessage: string,
    routedTo?: string
  ): Promise<SupervisorToolExecutionResult>;
}

/**
 * Supervisor SGR service interface
 */
export interface ISupervisorSGRService {
  processMessageWithStreaming(
    userMessage: string,
    userId: string,
    workspaceId: string,
    threadId: string
  ): AsyncGenerator<SupervisorSGRStreamingResult>;
}

/**
 * Supervisor exceptions and error types
 */
export enum SupervisorErrorType {
  ROUTING_FAILED = 'ROUTING_FAILED',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  STATUS_TRANSITION_FAILED = 'STATUS_TRANSITION_FAILED',
  SGR_WORKFLOW_FAILED = 'SGR_WORKFLOW_FAILED',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  STREAMING_TIMEOUT = 'STREAMING_TIMEOUT',
  INVALID_BUSINESS_SETUP_STATE = 'INVALID_BUSINESS_SETUP_STATE'
}

export class SupervisorException extends Error {
  constructor(
    public readonly type: SupervisorErrorType,
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SupervisorException';
  }
}

/**
 * Supervisor configuration constants
 */
export const SUPERVISOR_CONFIG = {
  AGENT_NAME: 'business-setup-supervisor',
  MODEL_ID: 'google/gemini-2.5-flash',
  MAX_STEPS: 10,
  TIMEOUT_MS: 30000,
  STEP_TIMEOUT_MS: 5000,
  RETRY_ATTEMPTS: 3
} as const;

/**
 * Event payload types for supervisor events
 */
export interface SupervisorEventPayload {
  userId: string;
  workspaceId: string;
  threadId: string;
  timestamp: Date;
}

export interface SupervisorRoutingEventPayload extends SupervisorEventPayload {
  message: string;
  fromStatus?: BusinessSetupStatus;
  toStatus?: BusinessSetupStatus;
  routedTo?: string;
  success: boolean;
  reason?: string;
  error?: string;
}

export interface SupervisorThinkingEventPayload extends SupervisorEventPayload {
  step: SupervisorThinkingStep;
  completed: boolean;
}

export interface SupervisorCompletionEventPayload extends SupervisorEventPayload {
  success: boolean;
  finalMessage: string;
  routedTo?: string;
  stepsExecuted: string[];
  executionTimeMs: number;
}

/**
 * Business setup state detection helpers
 */
export interface BusinessSetupStateDetection {
  isActive: boolean;
  currentStatus: BusinessSetupStatus;
  canProgress: boolean;
  requiresUserInput: boolean;
  nextStatus?: BusinessSetupStatus;
  estimatedCompletionPercent: number;
}

/**
 * Supervisor routing decision context
 */
export interface SupervisorRoutingContext {
  userMessage: string;
  businessSetupState: BusinessSetupStateDetection;
  threadHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  userProfile?: {
    businessType?: string;
    industry?: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
  };
}

/**
 * Agent handoff information
 */
export interface AgentHandoffInfo {
  fromAgent: string;
  toAgent: string;
  handoffReason: string;
  contextPreserved: boolean;
  userMessage: string;
  expectedResponse: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Type-safe event names for supervisor
 */
export const SUPERVISOR_EVENTS = {
  ROUTE_MESSAGE: 'supervisor.route-message',
  THINKING_STEP: 'supervisor.thinking-step',
  ROUTING_COMPLETED: 'supervisor.routing-completed',
  STATUS_CHANGED: 'supervisor.status-changed',
  AGENT_CREATED: 'supervisor.agent-created',
  ERROR_OCCURRED: 'supervisor.error-occurred'
} as const;

export type SupervisorEventName = typeof SUPERVISOR_EVENTS[keyof typeof SUPERVISOR_EVENTS];