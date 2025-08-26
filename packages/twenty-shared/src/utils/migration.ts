/**
 * Migration Utilities for Invariant Error Handler
 * 
 * Provides compatibility layers and migration helpers for existing
 * assertion utilities in the Twenty codebase:
 * - packages/twenty-server/src/utils/assert.ts
 * - packages/twenty-shared/src/utils/assertUnreachable.ts
 */

import { type HttpException } from '@nestjs/common';
import { invariant, warn } from './invariant';

/**
 * Compatibility wrapper for the existing assert utility in twenty-server
 * 
 * Maintains the same API while using the new invariant error handler internally.
 * This allows for gradual migration without breaking existing code.
 * 
 * @param condition - The condition to assert
 * @param message - Optional error message
 * @param ErrorType - Optional custom error constructor (NestJS HttpException)
 */
export const legacyAssert = (
  condition: unknown,
  message?: string,
  ErrorType?: new (message?: string) => HttpException,
): asserts condition => {
  if (!condition) {
    // Log migration warning in development
    if (process.env.NODE_ENV === 'development') {
      warn(
        'Legacy assert usage detected. Consider migrating to invariant for better error handling.'
      );
    }

    if (ErrorType) {
      if (message) {
        throw new ErrorType(message);
      }
      throw new ErrorType();
    }

    // Use invariant for standard Error throwing
    invariant(condition, message);
  }
};

/**
 * Enhanced assert function that bridges legacy and new error handling
 * 
 * Provides the legacy API while optionally using InvariantError for better
 * error tracking and logging capabilities.
 * 
 * @param condition - The condition to assert
 * @param message - Error message or numeric error code
 * @param ErrorType - Optional custom error constructor
 * @param useInvariant - Whether to use InvariantError instead of legacy Error
 */
export const enhancedAssert = (
  condition: unknown,
  message?: string | number,
  ErrorType?: new (message?: string) => HttpException,
  useInvariant: boolean = false,
): asserts condition => {
  if (!condition) {
    if (ErrorType) {
      const errorMessage = typeof message === 'number' 
        ? `Error ${message}` 
        : message;
      
      if (errorMessage) {
        throw new ErrorType(errorMessage);
      }
      throw new ErrorType();
    }

    if (useInvariant) {
      // Use the new invariant error handler
      invariant(condition, message);
    } else {
      // Use legacy Error for backward compatibility
      throw new Error(typeof message === 'string' ? message : 'Assertion failed');
    }
  }
};

// Note: assertUnreachable is already available from ./assertUnreachable
// This compatibility wrapper was removed to avoid duplicate exports

/**
 * Migration helper function to convert existing assert calls to invariant
 * 
 * This function can be used during migration to gradually convert
 * assert usage to invariant while maintaining logging.
 * 
 * @param oldAssert - The legacy assert function
 * @returns New function that uses invariant internally
 */
export const migrateToInvariant = (oldAssert: Function) => {
  return (condition: unknown, message?: string) => {
    if (process.env.NODE_ENV === 'development') {
      warn(
        'Legacy assert usage detected. Please migrate to invariant.',
        'Condition:', condition,
        'Message:', message
      );
    }
    
    invariant(condition, message);
  };
};

/**
 * Validation helper that provides both legacy and new error handling
 * 
 * Useful for gradual migration where some parts of the codebase
 * expect legacy Error types while others can handle InvariantError.
 * 
 * @param condition - Condition to validate
 * @param message - Error message or code
 * @param options - Migration options
 */
export const validateCondition = (
  condition: unknown,
  message?: string | number,
  options: {
    useLegacy?: boolean;
    logWarning?: boolean;
    errorCode?: number;
  } = {}
): asserts condition => {
  const { useLegacy = false, logWarning = true, errorCode } = options;
  
  if (!condition) {
    if (logWarning && process.env.NODE_ENV === 'development') {
      warn('Validation failed:', message);
    }
    
    if (useLegacy) {
      throw new Error(
        typeof message === 'string' 
          ? message 
          : `Validation failed${errorCode ? ` (${errorCode})` : ''}`
      );
    } else {
      invariant(condition, message || errorCode);
    }
  }
};

/**
 * Error code migration helper
 * 
 * Helps convert string-based error messages to numeric codes
 * for better error tracking and documentation.
 * 
 * @param errorMap - Map of string messages to error codes
 * @returns Function that converts messages to codes
 */
export const createErrorCodeMigrator = (errorMap: Record<string, number>) => {
  return (message: string): number => {
    const code = errorMap[message];
    if (code !== undefined) {
      return code;
    }
    
    // Log unmapped error message in development
    if (process.env.NODE_ENV === 'development') {
      warn('Unmapped error message:', message);
    }
    
    return 9999; // Generic unmapped error code
  };
};

/**
 * Batch migration utility for converting multiple assert calls
 * 
 * Useful for migrating entire modules or files at once.
 * 
 * @param assertions - Array of assertion configurations
 */
export const batchMigrate = (
  assertions: Array<{
    condition: unknown;
    message?: string | number;
    legacy?: boolean;
  }>
) => {
  const results: Array<{ success: boolean; error?: Error }> = [];
  
  assertions.forEach(({ condition, message, legacy = false }) => {
    try {
      if (legacy) {
        if (!condition) {
          throw new Error(typeof message === 'string' ? message : 'Assertion failed');
        }
      } else {
        invariant(condition, message);
      }
      results.push({ success: true });
    } catch (error) {
      results.push({ success: false, error: error as Error });
    }
  });
  
  return results;
};

/**
 * Type-safe migration helper for specific assertion patterns
 * 
 * Provides compile-time type safety while migrating from legacy patterns.
 */
export const typeSafeMigrate = {
  /**
   * Migrate null checks
   */
  notNull: <T>(value: T | null | undefined, message?: string): asserts value is T => {
    invariant(value != null, message || 'Value must not be null or undefined');
  },
  
  /**
   * Migrate truthy checks
   */
  truthy: <T>(value: T, message?: string): asserts value => {
    invariant(value, message || 'Value must be truthy');
  },
  
  /**
   * Migrate type checks
   */
  isType: <T>(value: unknown, typeGuard: (x: unknown) => x is T, message?: string): asserts value is T => {
    invariant(typeGuard(value), message || 'Value does not match expected type');
  },
  
  /**
   * Migrate array checks
   */
  isArray: <T>(value: unknown, message?: string): asserts value is T[] => {
    invariant(Array.isArray(value), message || 'Value must be an array');
  },
  
  /**
   * Migrate string checks
   */
  isString: (value: unknown, message?: string): asserts value is string => {
    invariant(typeof value === 'string', message || 'Value must be a string');
  },
  
  /**
   * Migrate number checks
   */
  isNumber: (value: unknown, message?: string): asserts value is number => {
    invariant(typeof value === 'number' && !isNaN(value), message || 'Value must be a valid number');
  }
};

// Export function types for external use
export type LegacyAssertFunction = typeof legacyAssert;