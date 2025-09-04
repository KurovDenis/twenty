/**
 * AI Chat Error Handling Service
 *
 * Provides comprehensive error handling and fallback mechanisms for:
 * - Chat thread creation failures
 * - SGR connection issues
 * - Agent selection problems
 * - Business setup stage conflicts
 */

import { BusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import {
  SGR_AVITO_AGENT_ID,
  getAgentConfigForStatus,
} from '@/business-setup/config/businessSetupAgents.config';

export enum AIChatErrorType {
  THREAD_CREATION_FAILED = 'thread_creation_failed',
  SGR_CONNECTION_FAILED = 'sgr_connection_failed',
  AGENT_NOT_FOUND = 'agent_not_found',
  BUSINESS_SETUP_CONFLICT = 'business_setup_conflict',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  UNKNOWN_ERROR = 'unknown_error',
}

export interface AIChatError {
  type: AIChatErrorType;
  message: string;
  originalError?: Error;
  context?: {
    agentId?: string;
    threadId?: string;
    businessSetupStatus?: BusinessSetupStatus;
    attemptCount?: number;
  };
  recoverable: boolean;
  fallbackAction?: () => Promise<void>;
}

export interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelay: number;
  fallbackToStandardChat: boolean;
  showUserNotification: boolean;
  logError: boolean;
}

/**
 * Error Recovery Service
 */
export class AIChatErrorRecoveryService {
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000; // 1 second

  /**
   * Handle chat creation errors with automatic recovery
   */
  async handleChatCreationError(
    error: Error,
    context: {
      agentId?: string;
      businessSetupStatus?: BusinessSetupStatus;
      attemptCount?: number;
    },
  ): Promise<AIChatError> {
    const chatError = this.categorizeError(error, context);

    console.error('AI Chat Creation Error:', {
      type: chatError.type,
      message: chatError.message,
      context: chatError.context,
      recoverable: chatError.recoverable,
    });

    return chatError;
  }

  /**
   * Handle SGR connection errors
   */
  async handleSGRConnectionError(
    error: Error,
    context: {
      agentId: string;
      threadId: string;
      attemptCount?: number;
    },
  ): Promise<AIChatError> {
    const sgrError: AIChatError = {
      type: AIChatErrorType.SGR_CONNECTION_FAILED,
      message: `Failed to establish SGR connection for agent ${context.agentId}`,
      originalError: error,
      context,
      recoverable: true,
    };

    console.error('SGR Connection Error:', {
      agentId: context.agentId,
      threadId: context.threadId,
      error: error.message,
      attemptCount: context.attemptCount || 0,
    });

    return sgrError;
  }

  /**
   * Categorize errors and determine recovery strategy
   */
  private categorizeError(
    error: Error,
    context: {
      agentId?: string;
      businessSetupStatus?: BusinessSetupStatus;
      attemptCount?: number;
    },
  ): AIChatError {
    const attemptCount = context.attemptCount || 0;

    // Network-related errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        type: AIChatErrorType.NETWORK_ERROR,
        message:
          'Network connection failed. Please check your internet connection.',
        originalError: error,
        context,
        recoverable: attemptCount < this.maxRetries,
      };
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return {
        type: AIChatErrorType.TIMEOUT_ERROR,
        message: 'Request timed out. The server may be busy.',
        originalError: error,
        context,
        recoverable: attemptCount < this.maxRetries,
      };
    }

    // Authentication errors
    if (
      error.message.includes('401') ||
      error.message.includes('unauthorized')
    ) {
      return {
        type: AIChatErrorType.AUTHENTICATION_ERROR,
        message:
          'Authentication failed. Please refresh the page and try again.',
        originalError: error,
        context,
        recoverable: false,
      };
    }

    // Agent not found
    if (
      error.message.includes('agent') &&
      error.message.includes('not found')
    ) {
      return {
        type: AIChatErrorType.AGENT_NOT_FOUND,
        message: `Agent ${context.agentId} not found. Using fallback agent.`,
        originalError: error,
        context,
        recoverable: true,
      };
    }

    // Business setup conflicts
    if (
      context.businessSetupStatus === 'WELCOME' &&
      context.agentId !== SGR_AVITO_AGENT_ID
    ) {
      return {
        type: AIChatErrorType.BUSINESS_SETUP_CONFLICT,
        message:
          'Wrong agent selected for WELCOME stage. SGR Avito Agent is required.',
        originalError: error,
        context,
        recoverable: true,
      };
    }

    // Generic thread creation failure
    if (error.message.includes('thread') || error.message.includes('create')) {
      return {
        type: AIChatErrorType.THREAD_CREATION_FAILED,
        message: 'Failed to create chat thread. Please try again.',
        originalError: error,
        context,
        recoverable: attemptCount < this.maxRetries,
      };
    }

    // Unknown error
    return {
      type: AIChatErrorType.UNKNOWN_ERROR,
      message: 'An unexpected error occurred. Please try again.',
      originalError: error,
      context,
      recoverable: attemptCount < this.maxRetries,
    };
  }

  /**
   * Execute recovery strategy with exponential backoff
   */
  async executeRecovery<T>(
    operation: () => Promise<T>,
    context: {
      agentId?: string;
      businessSetupStatus?: BusinessSetupStatus;
      maxRetries?: number;
    },
  ): Promise<T> {
    const maxRetries = context.maxRetries || this.maxRetries;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s, 8s...
          const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          console.log(
            `Retrying operation (attempt ${attempt}/${maxRetries})...`,
          );
        }

        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const chatError = await this.handleChatCreationError(lastError, {
          ...context,
          attemptCount: attempt,
        });

        // If error is not recoverable, stop trying
        if (!chatError.recoverable) {
          throw lastError;
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  /**
   * Get fallback agent for failed business setup scenarios
   */
  getFallbackAgent(
    businessSetupStatus: BusinessSetupStatus | null | undefined,
  ): string {
    // For WELCOME stage, ALWAYS use SGR Avito Agent - no fallback allowed
    if (businessSetupStatus === 'WELCOME') {
      return SGR_AVITO_AGENT_ID;
    }

    // For other stages, try to get configured agent
    const agentConfig = getAgentConfigForStatus(businessSetupStatus);
    if (agentConfig) {
      return agentConfig.agentId;
    }

    // Final fallback to general agent
    return 'general-ai-agent';
  }

  /**
   * Check if fallback to standard chat is allowed
   */
  canFallbackToStandardChat(
    businessSetupStatus: BusinessSetupStatus | null | undefined,
  ): boolean {
    // NEVER fallback to standard chat during WELCOME stage
    if (businessSetupStatus === 'WELCOME') {
      return false;
    }

    // Allow fallback for other stages
    return true;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate user-friendly error message
   */
  getUserFriendlyMessage(error: AIChatError): string {
    const messages = {
      [AIChatErrorType.THREAD_CREATION_FAILED]:
        'Unable to start chat. Please try again in a moment.',
      [AIChatErrorType.SGR_CONNECTION_FAILED]:
        'Connection to AI assistant failed. Retrying...',
      [AIChatErrorType.AGENT_NOT_FOUND]:
        'AI assistant not available. Using alternative assistant.',
      [AIChatErrorType.BUSINESS_SETUP_CONFLICT]:
        'Setting up specialized assistant for your business setup...',
      [AIChatErrorType.NETWORK_ERROR]:
        'Network connection issue. Please check your internet connection.',
      [AIChatErrorType.TIMEOUT_ERROR]:
        'Request timed out. The server may be busy, please try again.',
      [AIChatErrorType.AUTHENTICATION_ERROR]:
        'Authentication required. Please refresh the page.',
      [AIChatErrorType.UNKNOWN_ERROR]:
        'Something went wrong. Please try again.',
    };

    return messages[error.type] || messages[AIChatErrorType.UNKNOWN_ERROR];
  }
}

// Singleton instance
export const aiChatErrorRecovery = new AIChatErrorRecoveryService();
