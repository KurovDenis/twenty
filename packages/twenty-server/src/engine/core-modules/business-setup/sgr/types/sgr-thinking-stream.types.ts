/**
 * Types for SGR (Schema-Guided Reasoning) Thinking Streams
 *
 * These types support transparent AI reasoning by allowing real-time visibility
 * into the AI's thinking process during business setup credential processing.
 *
 * Design Goals:
 * - Show step-by-step AI reasoning to users
 * - Provide progress indicators during tool execution
 * - Enable graceful error handling and fallbacks
 * - Support streaming updates for better UX
 */

/**
 * Represents a single step in the SGR thinking process
 */
export interface SGRThinkingStep {
  /** Step number in the reasoning sequence (1, 2, 3...) */
  stepNumber: number;

  /** Current AI reasoning state description */
  currentState: string;

  /** List of planned remaining steps */
  plannedSteps: string[];

  /** Tool selected for execution in this step */
  selectedTool: string;

  /** Tool execution status and results (optional, filled during execution) */
  toolExecution?: {
    status: 'in_progress' | 'completed' | 'failed';
    result?: any;
    error?: string;
  };

  /** When this step was executed */
  timestamp: Date;
}

/**
 * Streaming result from SGR processing
 * Used for real-time updates to the chat interface
 */
export interface SGRStreamingResult {
  /** Type of streaming update */
  type: 'thinking' | 'tool_execution' | 'final_response';

  /** Step information (for thinking and tool_execution types) */
  step?: SGRThinkingStep;

  /** Final response content (for final_response type) */
  content?: string;

  /** Whether the entire SGR process is completed */
  completed: boolean;

  /** Workflow state for tracking progress */
  workflowState?: any;

  /** Workflow context with user data */
  workflowContext?: any;

  /** Error information if process failed */
  error?: any;

  /** Timestamp for event */
  timestamp?: string;

  /** Duration of workflow processing */
  workflowDuration?: number;

  /** Whether the process is complete (alias of completed) */
  isComplete?: boolean;
}

/**
 * Chat message type for showing AI thinking process
 */
export interface ThinkingMessage {
  type: 'thinking';
  content: string;
  stepNumber: number;
  currentState: string;
  plannedSteps: string[];
  timestamp: Date;
}

/**
 * Chat message type for showing tool execution progress
 */
export interface ToolExecutionMessage {
  type: 'tool_execution';
  toolName: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed';
  parameters?: any;
  result?: any;
  error?: string;
  timestamp: Date;
}

/**
 * Chat message type for final AI response
 */
export interface FinalResponseMessage {
  type: 'final_response';
  content: string;
  success: boolean;
  nextAction?: string;
  timestamp: Date;
}

/**
 * Union type for all SGR-related chat messages
 */
export type SGRChatMessage =
  | ThinkingMessage
  | ToolExecutionMessage
  | FinalResponseMessage;

/**
 * Context passed to SGR streaming functions
 */
export interface SGRStreamingContext {
  userId: string;
  workspaceId: string;
  threadId: string;
  userMessage: string;
  maxSteps?: number;
}

/**
 * Result of SGR workflow execution with streaming support
 */
export interface SGRExecutionResult {
  success: boolean;
  credentials_stored: boolean;
  next_stage: 'business_analysis' | 'error_retry';
  summary: string;
  steps_executed: string[];
  error?: string;
  streamingSteps?: SGRThinkingStep[];
}

/**
 * Configuration for SGR thinking visibility
 */
export interface SGRThinkingConfig {
  /** Whether to show detailed thinking steps */
  showThinkingSteps: boolean;

  /** Whether to show tool execution details */
  showToolExecution: boolean;

  /** Maximum time to wait for each step (ms) */
  stepTimeoutMs: number;

  /** Whether to fall back to legacy processing on streaming failure */
  enableFallback: boolean;
}

/**
 * Default configuration for SGR thinking streams
 */
export const DEFAULT_SGR_THINKING_CONFIG: SGRThinkingConfig = {
  showThinkingSteps: true,
  showToolExecution: true,
  stepTimeoutMs: 10000, // 10 seconds per step
  enableFallback: true,
};

/**
 * Error types specific to SGR streaming
 */
export enum SGRStreamingError {
  STREAMING_TIMEOUT = 'STREAMING_TIMEOUT',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_STEP_RESULT = 'INVALID_STEP_RESULT',
  CONTEXT_MISSING = 'CONTEXT_MISSING',
  MAX_STEPS_EXCEEDED = 'MAX_STEPS_EXCEEDED',
}

/**
 * Exception class for SGR streaming errors
 */
export class SGRStreamingException extends Error {
  constructor(
    public readonly errorType: SGRStreamingError,
    message: string,
    public readonly context?: any,
  ) {
    super(message);
    this.name = 'SGRStreamingException';
  }
}
