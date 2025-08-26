/**
 * Invariant Error Handler for Twenty CRM
 * 
 * A robust error handling and assertion utility that provides:
 * - Type-safe runtime assertions with TypeScript assertion signatures
 * - Configurable logging with verbosity levels
 * - Custom error types with enhanced stack traces
 * - Cross-platform compatibility
 * 
 * Based on the design from Apollo's invariant packages with enhancements
 * for the Twenty application ecosystem.
 */

const genericMessage = "Invariant Violation";

// Cross-platform setPrototypeOf fallback for older environments
const {
  setPrototypeOf = function (obj: any, proto: any) {
    obj.__proto__ = proto;
    return obj;
  },
} = Object as any;

/**
 * Custom error class for invariant violations
 * 
 * Features:
 * - Proper prototype chain for instanceof checks
 * - Stack trace optimization with framesToPop
 * - Support for both string messages and numeric error codes
 * - URL references for documentation lookup
 */
export class InvariantError extends Error {
  framesToPop = 1;
  name = genericMessage;
  
  constructor(message: string | number = genericMessage) {
    // Handle null, undefined, and other falsy values
    const safeMessage = message == null ? genericMessage : message;
    
    super(
      typeof safeMessage === "number"
        ? `${genericMessage}: ${safeMessage} (see https://github.com/twentyhq/twenty/tree/main/docs/errors)`
        : String(safeMessage)
    );
    
    // Ensure proper prototype chain for instanceof checks
    setPrototypeOf(this, InvariantError.prototype);
  }
}

/**
 * Runtime assertion function with TypeScript type narrowing
 * 
 * @param condition - The condition to assert
 * @param message - Error message (string) or error code (number)
 * @throws {InvariantError} When condition is falsy
 * 
 * @example
 * ```typescript
 * invariant(user, "User is required");
 * invariant(user.id, 1001); // Numeric error code
 * // TypeScript now knows user and user.id are truthy
 * ```
 */
export function invariant(
  condition: any,
  message?: string | number,
): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}

// Verbosity levels for logging control
const verbosityLevels = ["debug", "log", "warn", "error", "silent"] as const;

// Import types from types file to avoid duplication
import type { ConsoleMethodName, VerbosityLevel } from './invariant/types';

// Default verbosity level - can be overridden via environment or setVerbosity
let verbosityLevel = verbosityLevels.indexOf(
  (process.env.NODE_ENV === 'production') ? 'error' :
  (process.env.NODE_ENV === 'test') ? 'silent' : 
  'log'
);

/**
 * Creates a wrapped console method that respects verbosity levels
 * 
 * @param name - Console method name to wrap
 * @returns Wrapped console method that checks verbosity before logging
 */
function wrapConsoleMethod<M extends ConsoleMethodName>(name: M) {
  return function () {
    if (verbosityLevels.indexOf(name) >= verbosityLevel) {
      // Get the console method or fallback to console.log
      const method = (console as any)[name];
      const fallbackMethod = method || console.log;
      return fallbackMethod.apply(console, arguments as any);
    }
  } as (typeof console)[M];
}

// Individual exports for barrel compatibility
export const debug = wrapConsoleMethod("debug");
export const log = wrapConsoleMethod("log");
export const warn = wrapConsoleMethod("warn");
export const error = wrapConsoleMethod("error");



/**
 * Sets the verbosity level for logging output
 * 
 * @param level - New verbosity level
 * @returns Previous verbosity level
 * 
 * @example
 * ```typescript
 * const oldLevel = setVerbosity('error'); // Only show errors
 * setVerbosity('debug'); // Show all messages
 * setVerbosity(oldLevel); // Restore previous level
 * ```
 */
export function setVerbosity(level: VerbosityLevel): VerbosityLevel {
  const old = verbosityLevels[verbosityLevel];
  verbosityLevel = Math.max(0, verbosityLevels.indexOf(level));
  return old;
}

/**
 * Gets the current verbosity level
 * 
 * @returns Current verbosity level
 */
export function getVerbosity(): VerbosityLevel {
  return verbosityLevels[verbosityLevel];
}

// Re-export types for barrel compatibility
export type { ConsoleMethodName, VerbosityLevel } from './invariant/types';

// Default export for convenience
export default invariant;