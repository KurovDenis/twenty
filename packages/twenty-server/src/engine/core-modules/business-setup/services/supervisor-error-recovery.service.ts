import { Injectable, Logger } from '@nestjs/common';

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  timeoutMs?: number;
}

export interface ErrorClassification {
  type:
    | 'timeout'
    | 'network'
    | 'authentication'
    | 'server'
    | 'validation'
    | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  retryDelay?: number;
}

export class SupervisorException extends Error {
  constructor(
    public readonly type: string,
    message: string,
    public readonly metadata?: any,
  ) {
    super(message);
    this.name = 'SupervisorException';
  }
}

export enum SupervisorErrorType {
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  INVALID_TOOL = 'INVALID_TOOL',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  CREDENTIAL_VALIDATION_FAILED = 'CREDENTIAL_VALIDATION_FAILED',
  STATUS_TRANSITION_FAILED = 'STATUS_TRANSITION_FAILED',
  CACHE_ERROR = 'CACHE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

/**
 * Service for error recovery with exponential backoff retry mechanisms
 * Implements memory-specified error handling improvements
 */
@Injectable()
export class SupervisorErrorRecoveryService {
  private readonly logger = new Logger(SupervisorErrorRecoveryService.name);

  /**
   * Execute operation with retry logic and exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2,
      timeoutMs = 30000,
    } = config;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wrap operation with timeout
        if (timeoutMs > 0) {
          return await this.withTimeout(operation(), timeoutMs);
        } else {
          return await operation();
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Classify error to determine recovery strategy
        const classification = this.classifyError(lastError);

        this.logger.warn(
          `Operation failed on attempt ${attempt}/${maxRetries}`,
          {
            error: lastError.message,
            attempt,
            classification,
            recoverable: classification.recoverable,
          },
        );

        // Don't retry non-recoverable errors
        if (!classification.recoverable) {
          throw new SupervisorException(
            SupervisorErrorType.TOOL_EXECUTION_FAILED,
            `Non-recoverable error: ${lastError.message}`,
            {
              originalError: lastError,
              classification,
              attempts: attempt,
            },
          );
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw new SupervisorException(
            SupervisorErrorType.TOOL_EXECUTION_FAILED,
            `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
            {
              originalError: lastError,
              attempts: maxRetries,
              classification,
            },
          );
        }

        // Calculate delay with exponential backoff and jitter
        const baseDelay = classification.retryDelay || baseDelayMs;
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs,
        );
        const jitter = Math.random() * 0.1 * delay; // 10% jitter
        const totalDelay = delay + jitter;

        this.logger.debug(
          `Retrying in ${Math.round(totalDelay)}ms (attempt ${attempt + 1}/${maxRetries})`,
        );

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }

    // This should never be reached due to the throw in the loop
    throw lastError!;
  }

  /**
   * Classify error to determine retry strategy and recovery approach
   */
  classifyError(error: Error): ErrorClassification {
    const message = error.message.toLowerCase();

    // Timeout errors - usually recoverable with longer timeout
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        type: 'timeout',
        severity: 'medium',
        recoverable: true,
        retryDelay: 2000, // Longer delay for timeout retries
      };
    }

    // Network errors - usually recoverable
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('econnrefused') ||
      message.includes('enotfound')
    ) {
      return {
        type: 'network',
        severity: 'medium',
        recoverable: true,
        retryDelay: 1500,
      };
    }

    // Authentication errors - not recoverable without user action
    if (
      message.includes('auth') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('401') ||
      message.includes('403') ||
      message.includes('invalid credentials')
    ) {
      return {
        type: 'authentication',
        severity: 'high',
        recoverable: false,
      };
    }

    // Server errors - might be recoverable depending on type
    if (
      message.includes('server') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('internal server error')
    ) {
      return {
        type: 'server',
        severity: 'high',
        recoverable: true,
        retryDelay: 3000, // Longer delay for server errors
      };
    }

    // Validation errors - usually not recoverable without fixing input
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('missing')
    ) {
      return {
        type: 'validation',
        severity: 'medium',
        recoverable: false,
      };
    }

    // Check for specific Supervisor error types
    if (error instanceof SupervisorException) {
      switch (error.type) {
        case SupervisorErrorType.AGENT_NOT_FOUND:
        case SupervisorErrorType.PROVIDER_NOT_FOUND:
          return {
            type: 'validation',
            severity: 'high',
            recoverable: false,
          };

        case SupervisorErrorType.CACHE_ERROR:
          return {
            type: 'server',
            severity: 'low',
            recoverable: true,
            retryDelay: 500,
          };

        case SupervisorErrorType.TIMEOUT_ERROR:
          return {
            type: 'timeout',
            severity: 'medium',
            recoverable: true,
            retryDelay: 2000,
          };

        default:
          return {
            type: 'unknown',
            severity: 'high',
            recoverable: true,
          };
      }
    }

    // Default classification for unknown errors
    return {
      type: 'unknown',
      severity: 'high',
      recoverable: false,
    };
  }

  /**
   * Execute operation with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new SupervisorException(
            SupervisorErrorType.TIMEOUT_ERROR,
            `Operation timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Execute with circuit breaker pattern for repeated failures
   */
  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    circuitConfig: {
      failureThreshold?: number;
      resetTimeoutMs?: number;
      monitorWindowMs?: number;
    } = {},
  ): Promise<T> {
    // This would implement a circuit breaker pattern
    // For now, delegate to regular retry mechanism
    return this.executeWithRetry(operation);
  }

  /**
   * Execute with bulkhead pattern for resource isolation
   */
  async executeWithBulkhead<T>(
    operation: () => Promise<T>,
    bulkheadName: string,
    maxConcurrent = 10,
  ): Promise<T> {
    // This would implement a bulkhead pattern for resource isolation
    // For now, delegate to regular retry mechanism
    return this.executeWithRetry(operation);
  }

  /**
   * Create enhanced error with recovery suggestions
   */
  createRecoveryError(
    originalError: Error,
    classification: ErrorClassification,
    suggestions: string[],
  ): SupervisorException {
    return new SupervisorException(
      SupervisorErrorType.TOOL_EXECUTION_FAILED,
      originalError.message,
      {
        originalError,
        classification,
        recoverySuggestions: suggestions,
        timestamp: new Date(),
      },
    );
  }

  /**
   * Get recovery suggestions based on error classification
   */
  getRecoverySuggestions(classification: ErrorClassification): string[] {
    switch (classification.type) {
      case 'timeout':
        return [
          'Increase timeout duration',
          'Check network connectivity',
          'Retry with exponential backoff',
        ];

      case 'network':
        return [
          'Check internet connection',
          'Verify service endpoints are accessible',
          'Check for firewall or proxy issues',
        ];

      case 'authentication':
        return [
          'Verify credentials are correct',
          'Check if tokens have expired',
          'Ensure proper permissions are set',
        ];

      case 'server':
        return [
          'Check service status',
          'Retry after a delay',
          'Contact system administrator',
        ];

      case 'validation':
        return [
          'Verify input parameters',
          'Check required fields are provided',
          'Validate data format and types',
        ];

      default:
        return [
          'Check application logs',
          'Retry the operation',
          'Contact technical support',
        ];
    }
  }
}
