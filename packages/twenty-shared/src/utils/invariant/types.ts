/**
 * TypeScript Type Definitions for Invariant Error Handler
 * 
 * Comprehensive type definitions for the invariant error handling system
 * used throughout the Twenty CRM application.
 */

/**
 * Verbosity levels for logging control
 */
export const verbosityLevels = ["debug", "log", "warn", "error", "silent"] as const;

/**
 * Union type of all available verbosity levels
 */
export type VerbosityLevel = (typeof verbosityLevels)[number];

/**
 * Console method names (excluding 'silent')
 */
export type ConsoleMethodName = Exclude<VerbosityLevel, "silent">;

/**
 * Error code ranges for different error categories
 */
export const ERROR_CODE_RANGES = {
  VALIDATION: { min: 1000, max: 1999 },
  AUTHENTICATION: { min: 2000, max: 2999 },
  DATABASE: { min: 3000, max: 3999 },
  BUSINESS_LOGIC: { min: 4000, max: 4999 },
  SYSTEM: { min: 5000, max: 5999 },
} as const;

/**
 * Error categories for classification
 */
export type ErrorCategory = keyof typeof ERROR_CODE_RANGES;

/**
 * Validation error codes (1000-1999)
 */
export type ValidationErrorCode = 
  | 1001 // Invalid input data
  | 1002 // Missing required field
  | 1003 // Invalid format
  | 1004 // Invalid range
  | 1005 // Invalid type
  | 1006 // Invalid length
  | 1007 // Invalid pattern
  | 1008 // Invalid email format
  | 1009 // Invalid URL format
  | 1010; // Invalid phone format

/**
 * Authentication error codes (2000-2999)
 */
export type AuthenticationErrorCode = 
  | 2001 // Invalid credentials
  | 2002 // Token expired
  | 2003 // Token invalid
  | 2004 // Access denied
  | 2005 // Insufficient permissions
  | 2006 // Account locked
  | 2007 // Account suspended
  | 2008 // Account not found
  | 2009 // Password too weak
  | 2010; // Two-factor required

/**
 * Database error codes (3000-3999)
 */
export type DatabaseErrorCode = 
  | 3001 // Connection failed
  | 3002 // Query failed
  | 3003 // Transaction failed
  | 3004 // Constraint violation
  | 3005 // Record not found
  | 3006 // Duplicate entry
  | 3007 // Foreign key violation
  | 3008 // Data corruption
  | 3009 // Migration failed
  | 3010; // Backup failed

/**
 * Business logic error codes (4000-4999)
 */
export type BusinessLogicErrorCode = 
  | 4001 // Business rule violation
  | 4002 // Workflow error
  | 4003 // State transition invalid
  | 4004 // Resource conflict
  | 4005 // Quota exceeded
  | 4006 // Operation not allowed
  | 4007 // Dependency missing
  | 4008 // Circular reference
  | 4009 // Invalid operation
  | 4010; // Process failed

/**
 * System error codes (5000-5999)
 */
export type SystemErrorCode = 
  | 5001 // Service unavailable
  | 5002 // Timeout
  | 5003 // Network error
  | 5004 // Configuration error
  | 5005 // Resource exhausted
  | 5006 // External service error
  | 5007 // Cache error
  | 5008 // File system error
  | 5009 // Memory error
  | 5010; // CPU error

/**
 * Union of all predefined error codes
 */
export type KnownErrorCode = 
  | ValidationErrorCode
  | AuthenticationErrorCode
  | DatabaseErrorCode
  | BusinessLogicErrorCode
  | SystemErrorCode;

/**
 * Message type for invariant assertions
 */
export type InvariantMessage = string | KnownErrorCode | number;

/**
 * Configuration options for invariant error handling
 */
export interface InvariantConfig {
  /** Default verbosity level */
  defaultVerbosity: VerbosityLevel;
  /** Whether to include stack traces in production */
  includeStackInProduction: boolean;
  /** Base URL for error documentation */
  errorDocumentationUrl: string;
  /** Whether to sanitize error messages in production */
  sanitizeInProduction: boolean;
  /** Maximum error message length */
  maxMessageLength: number;
}

/**
 * Error context information
 */
export interface ErrorContext {
  /** Component or module where error occurred */
  component?: string;
  /** User ID if available */
  userId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Timestamp when error occurred */
  timestamp?: Date;
}

/**
 * Error reporting options
 */
export interface ErrorReportingOptions {
  /** Whether to report to external service */
  reportToService: boolean;
  /** Service endpoint URL */
  serviceUrl?: string;
  /** API key for service */
  apiKey?: string;
  /** Whether to include user data */
  includeUserData: boolean;
  /** Custom tags for categorization */
  tags?: string[];
}

/**
 * Assertion function type with type narrowing
 */
export type AssertFunction = <T>(
  condition: T,
  message?: InvariantMessage,
  context?: ErrorContext
) => asserts condition;

/**
 * Safe assertion function type that returns boolean
 */
export type SafeAssertFunction = <T>(
  condition: T,
  message?: InvariantMessage,
  context?: ErrorContext
) => condition is NonNullable<T>;

/**
 * Logging function type
 */
export type LoggingFunction = (...args: any[]) => void;

/**
 * Logger interface
 */
export interface Logger {
  debug: LoggingFunction;
  log: LoggingFunction;
  warn: LoggingFunction;
  error: LoggingFunction;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (
  error: Error,
  context?: ErrorContext
) => void | Promise<void>;

/**
 * Error recovery function type
 */
export type ErrorRecoveryFunction<T> = (
  error: Error,
  context?: ErrorContext
) => T | Promise<T>;

/**
 * Migration options for legacy code
 */
export interface MigrationOptions {
  /** Use legacy error types */
  useLegacy?: boolean;
  /** Log migration warnings */
  logWarning?: boolean;
  /** Error code to use */
  errorCode?: number;
}

/**
 * Batch validation result
 */
export interface ValidationResult {
  /** Field name if applicable */
  field?: string;
  /** Error message or code */
  message: InvariantMessage;
  /** Whether validation passed */
  isValid: boolean;
}

/**
 * Type guard for error codes
 */
export type ErrorCodeGuard<T extends KnownErrorCode> = (code: number) => code is T;

/**
 * Error code mapper type
 */
export type ErrorCodeMapper = (message: string) => number;

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfig {
  development: Partial<InvariantConfig>;
  test: Partial<InvariantConfig>;
  staging: Partial<InvariantConfig>;
  production: Partial<InvariantConfig>;
}

/**
 * Performance metrics for invariant operations
 */
export interface PerformanceMetrics {
  /** Total number of assertions */
  assertionCount: number;
  /** Number of failed assertions */
  failureCount: number;
  /** Average execution time */
  averageExecutionTime: number;
  /** Error distribution by code */
  errorDistribution: Record<number, number>;
}

/**
 * Hook options for React integration
 */
export interface InvariantHookOptions {
  /** Custom error handler */
  onError?: ErrorHandler;
  /** Whether to clear error automatically */
  autoClear?: boolean;
  /** Timeout for auto-clear */
  clearTimeout?: number;
}

/**
 * Generic error information interface
 */
export interface ErrorInfo {
  /** Component stack trace */
  componentStack: string;
  /** Additional error information */
  [key: string]: any;
}

/**
 * Error boundary props
 * Generic interface that can be used with any framework
 */
export interface ErrorBoundaryProps {
  /** Child components */
  children: any;
  /** Custom fallback component */
  fallback?: (error: Error, errorInfo: ErrorInfo) => any;
  /** Error handler callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show error details */
  showErrorDetails?: boolean;
}

/**
 * NestJS filter options
 */
export interface ExceptionFilterOptions {
  /** Whether to log errors */
  logErrors: boolean;
  /** Custom response transformer */
  responseTransformer?: (error: Error) => Record<string, any>;
  /** Whether to include stack traces */
  includeStack: boolean;
}

/**
 * Utility type for making properties optional
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for deep readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Type for error code validation
 */
export type ValidatedErrorCode<T extends ErrorCategory> = 
  T extends 'VALIDATION' ? ValidationErrorCode :
  T extends 'AUTHENTICATION' ? AuthenticationErrorCode :
  T extends 'DATABASE' ? DatabaseErrorCode :
  T extends 'BUSINESS_LOGIC' ? BusinessLogicErrorCode :
  T extends 'SYSTEM' ? SystemErrorCode :
  never;

/**
 * Conditional type for message format based on input
 */
export type FormattedMessage<T> = 
  T extends number ? `Invariant Violation: ${T} (see ${string})` :
  T extends string ? T :
  string;