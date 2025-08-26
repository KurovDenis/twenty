/**
 * Invariant Error Handler Module
 * 
 * Central export point for all invariant error handling functionality.
 * This module provides a complete solution for runtime assertions,
 * error handling, and logging throughout the Twenty CRM application.
 */

// Export main functionality from the core module
export {
  invariant,
  InvariantError,
  setVerbosity,
  getVerbosity,
} from '../invariant';

// Export all types
export type {
  VerbosityLevel,
  ConsoleMethodName,
  InvariantMessage,
  InvariantConfig,
  ErrorContext,
  ErrorReportingOptions,
  AssertFunction,
  SafeAssertFunction,
  LoggingFunction,
  Logger,
  ErrorHandler,
  ErrorRecoveryFunction,
  MigrationOptions,
  ValidationResult,
  ErrorCodeGuard,
  ErrorCodeMapper,
  EnvironmentConfig,
  PerformanceMetrics,
  InvariantHookOptions,
  ErrorBoundaryProps,
  ExceptionFilterOptions,
  ValidationErrorCode,
  AuthenticationErrorCode,
  DatabaseErrorCode,
  BusinessLogicErrorCode,
  SystemErrorCode,
  KnownErrorCode,
  ErrorCategory,
  ValidatedErrorCode,
  FormattedMessage,
  Optional,
  DeepReadonly,
} from './types';

// Export error code ranges and constants
export {
  verbosityLevels,
  ERROR_CODE_RANGES,
} from './types';

// Default export for convenience
export { invariant as default } from '../invariant';