/**
 * Frontend types for SGR (Schema-Guided Reasoning) thinking messages
 *
 * These types support displaying real-time AI reasoning process to users
 * during business setup credential processing.
 */

/**
 * Types of SGR messages that can be displayed in the chat
 */
export enum SGRMessageType {
  THINKING = 'thinking',
  TOOL_EXECUTION = 'tool_execution',
  FINAL_RESPONSE = 'final_response',
}

/**
 * Status of tool execution
 */
export enum SGRToolExecutionStatus {
  STARTING = 'starting',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * A single step in the SGR thinking process
 */
export interface SGRThinkingStep {
  /** Step number in the sequence */
  stepNumber: number;

  /** Current AI reasoning state */
  currentState: string;

  /** List of planned remaining steps */
  plannedSteps: string[];

  /** Tool selected for execution */
  selectedTool: string;

  /** Tool execution details (optional) */
  toolExecution?: {
    status: SGRToolExecutionStatus;
    result?: any;
    error?: string;
  };

  /** When this step was executed */
  timestamp: Date;
}

/**
 * Message showing AI thinking process
 */
export interface SGRThinkingMessage {
  type: SGRMessageType.THINKING;
  content: string;
  stepNumber: number;
  currentState: string;
  plannedSteps: string[];
  timestamp: Date;
}

/**
 * Message showing tool execution progress
 */
export interface SGRToolExecutionMessage {
  type: SGRMessageType.TOOL_EXECUTION;
  toolName: string;
  status: SGRToolExecutionStatus;
  parameters?: any;
  result?: any;
  error?: string;
  timestamp: Date;
}

/**
 * Final AI response message
 */
export interface SGRFinalResponseMessage {
  type: SGRMessageType.FINAL_RESPONSE;
  content: string;
  success: boolean;
  nextAction?: string;
  timestamp: Date;
}

/**
 * Union type for all SGR messages
 */
export type SGRMessage =
  | SGRThinkingMessage
  | SGRToolExecutionMessage
  | SGRFinalResponseMessage;

/**
 * Enhanced agent chat message that can include SGR thinking information
 */
export interface EnhancedAgentChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  createdAt: Date;
  files?: Array<{ id: string; name: string; url: string }>;

  // SGR-specific fields
  sgrMessage?: SGRMessage;
  isThinking?: boolean;
  thinkingStep?: SGRThinkingStep;
}

/**
 * Props for SGR thinking display components
 */
export interface SGRThinkingDisplayProps {
  step: SGRThinkingStep;
  isActive?: boolean;
  showDetails?: boolean;
}

/**
 * Props for tool execution display
 */
export interface SGRToolExecutionDisplayProps {
  toolName: string;
  status: SGRToolExecutionStatus;
  result?: any;
  error?: string;
  timestamp: Date;
}

/**
 * Configuration for SGR UI display
 */
export interface SGRUIConfig {
  /** Show detailed thinking steps */
  showThinkingSteps: boolean;

  /** Show tool execution progress */
  showToolExecution: boolean;

  /** Auto-scroll to latest step */
  autoScrollToLatest: boolean;

  /** Animation duration for transitions */
  animationDurationMs: number;
}

/**
 * Default SGR UI configuration
 */
export const DEFAULT_SGR_UI_CONFIG: SGRUIConfig = {
  showThinkingSteps: true,
  showToolExecution: true,
  autoScrollToLatest: true,
  animationDurationMs: 300,
};

/**
 * Helper function to determine if a message contains SGR thinking information
 */
export function isSGRMessage(
  message: any,
): message is EnhancedAgentChatMessage {
  return (
    message &&
    (message.sgrMessage || message.isThinking || message.thinkingStep)
  );
}

/**
 * Helper function to extract SGR step from message content
 */
export function extractSGRStepFromContent(
  content: string,
): SGRThinkingStep | null {
  // Parse content for SGR step markers
  const stepMatch = content.match(/🤔 \*\*Шаг (\d+): (.+?)\*\*/);
  if (!stepMatch) return null;

  const stepNumber = parseInt(stepMatch[1]);
  const currentState = stepMatch[2];

  // Extract planned steps
  const stepsMatch = content.match(
    /\*\*План действий:\*\*\n((?:\d+\. .+\n?)+)/,
  );
  const plannedSteps = stepsMatch
    ? stepsMatch[1]
        .split('\n')
        .filter((s) => s.trim())
        .map((s) => s.replace(/^\d+\. /, ''))
    : [];

  // Extract selected tool
  const toolMatch = content.match(/\*\*Выбранный инструмент:\*\* (.+)/);
  const selectedTool = toolMatch ? toolMatch[1] : 'unknown';

  return {
    stepNumber,
    currentState,
    plannedSteps,
    selectedTool,
    timestamp: new Date(),
  };
}

/**
 * Helper function to determine tool execution status from content
 */
export function extractToolExecutionFromContent(content: string): {
  status: SGRToolExecutionStatus;
  result?: any;
  error?: string;
} | null {
  if (content.includes('🔧 **Выполняю:')) {
    return { status: SGRToolExecutionStatus.IN_PROGRESS };
  }

  if (
    content.includes('✅ **Инструмент') &&
    content.includes('выполнен успешно**')
  ) {
    return {
      status: SGRToolExecutionStatus.COMPLETED,
      result: {}, // Placeholder result object
    };
  }

  if (content.includes('❌ **Ошибка при выполнении')) {
    const errorMatch = content.match(
      /❌ \*\*Ошибка при выполнении.+?\*\*\n\n(.+?)\n/,
    );
    return {
      status: SGRToolExecutionStatus.FAILED,
      error: errorMatch ? errorMatch[1] : 'Unknown error',
    };
  }

  return null;
}
