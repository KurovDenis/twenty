import { useCallback } from 'react';

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

export interface ErrorClassification {
  type: 'timeout' | 'network' | 'authentication' | 'server' | 'unknown';
  severity: 'low' | 'medium' | 'high';
  recoverable: boolean;
}

/**
 * Hook for error recovery with exponential backoff retry mechanism
 * Implements memory-specified error handling improvements
 */
export const useErrorRecovery = () => {
  
  /**
   * Execute operation with retry logic and exponential backoff
   */
  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    config: RetryConfig = {}
  ): Promise<T> => {
    const {
      baseDelayMs = 1000,
      maxDelayMs = 30000,
      backoffMultiplier = 2
    } = config;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Classify error to determine if retry is worthwhile
        const classification = classifyError(lastError);
        
        console.warn(
          `Operation failed on attempt ${attempt}/${maxRetries}`,
          { 
            error: lastError.message, 
            attempt, 
            classification,
            recoverable: classification.recoverable 
          }
        );
        
        // Don't retry non-recoverable errors
        if (!classification.recoverable) {
          throw new Error(
            `Non-recoverable error: ${lastError.message}`
          );
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw new Error(
            `Operation failed after ${maxRetries} attempts: ${lastError.message}`
          );
        }
        
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        );
        const jitter = Math.random() * 0.1 * delay; // 10% jitter
        const totalDelay = delay + jitter;
        
        console.debug(`Retrying in ${Math.round(totalDelay)}ms...`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }

    // This should never be reached due to the throw in the loop
    throw lastError!;
  }, []);

  /**
   * Classify error to determine retry strategy
   */
  const classifyError = useCallback((error: Error): ErrorClassification => {
    const message = error.message.toLowerCase();
    
    // Timeout errors - usually recoverable
    if (message.includes('timeout') || message.includes('timed out')) {
      return { type: 'timeout', severity: 'medium', recoverable: true };
    }
    
    // Network errors - usually recoverable
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('connection') || message.includes('offline')) {
      return { type: 'network', severity: 'medium', recoverable: true };
    }
    
    // Authentication errors - not recoverable without user action
    if (message.includes('auth') || message.includes('unauthorized') || 
        message.includes('forbidden') || message.includes('401') || 
        message.includes('403')) {
      return { type: 'authentication', severity: 'high', recoverable: false };
    }
    
    // Server errors - might be recoverable
    if (message.includes('server') || message.includes('500') || 
        message.includes('502') || message.includes('503')) {
      return { type: 'server', severity: 'high', recoverable: true };
    }
    
    // Default classification
    return { type: 'unknown', severity: 'high', recoverable: false };
  }, []);

  /**
   * Execute operation with specific error handling for different types
   */
  const executeWithClassification = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> => {
    try {
      return await executeWithRetry(operation, maxRetries);
    } catch (error) {
      const classification = classifyError(error instanceof Error ? error : new Error(String(error)));
      
      // Enhance error with classification info
      const enhancedError = new Error(
        `${error instanceof Error ? error.message : String(error)} (${classification.type}, ${classification.severity})`
      );
      
      // Add classification to error object for upstream handling
      (enhancedError as any).classification = classification;
      
      throw enhancedError;
    }
  }, [executeWithRetry, classifyError]);

  /**
   * Execute with custom retry logic for specific error types
   */
  const executeWithCustomRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    retryConfig: {
      maxRetries?: number;
      retryOn?: Array<'timeout' | 'network' | 'server'>;
      skipOn?: Array<'authentication' | 'unknown'>;
    } = {}
  ): Promise<T> => {
    const {
      maxRetries = 3,
      retryOn = ['timeout', 'network', 'server'],
      skipOn = ['authentication']
    } = retryConfig;

    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classification = classifyError(lastError);
        
        // Check if we should skip retry for this error type
        if (skipOn.includes(classification.type as any)) {
          throw lastError;
        }
        
        // Check if we should retry for this error type
        if (!retryOn.includes(classification.type as any)) {
          throw lastError;
        }
        
        // Don't retry on last attempt
        if (attempt === maxRetries) {
          throw new Error(
            `Operation failed after ${maxRetries} attempts: ${lastError.message}`
          );
        }
        
        // Wait before retry (simple exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }, [classifyError]);

  return {
    executeWithRetry,
    executeWithClassification,
    executeWithCustomRetry,
    classifyError,
  };
};