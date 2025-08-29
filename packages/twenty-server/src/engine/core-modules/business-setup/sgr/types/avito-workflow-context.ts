/**
 * Enhanced Avito Workflow State Management
 *
 * Defines strict state machine patterns for the Avito credential collection
 * and validation workflow with comprehensive context tracking.
 */

// Re-export AvitoErrorType for consolidated access
export { AvitoErrorType } from '../services/avito-error-recovery.service';

export enum AvitoWorkflowState {
  // Initial states
  INIT = 'INIT',
  GREETING_SENT = 'GREETING_SENT',

  // Credential collection states
  AWAITING_CREDENTIALS = 'AWAITING_CREDENTIALS',
  EXTRACTING_CREDENTIALS = 'EXTRACTING_CREDENTIALS',

  // Validation states
  VALIDATING_CREDENTIALS = 'VALIDATING_CREDENTIALS',
  VALIDATION_SUCCESS = 'VALIDATION_SUCCESS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Storage states
  STORING_CREDENTIALS = 'STORING_CREDENTIALS',
  STORAGE_COMPLETE = 'STORAGE_COMPLETE',

  // Completion states
  COMPLETING_WELCOME = 'COMPLETING_WELCOME',
  WELCOME_COMPLETED = 'WELCOME_COMPLETED',

  // Error states
  ERROR_INVALID_FORMAT = 'ERROR_INVALID_FORMAT',
  ERROR_API_FAILURE = 'ERROR_API_FAILURE',
  ERROR_STORAGE_FAILURE = 'ERROR_STORAGE_FAILURE',
  REQUEST_RETRY = 'REQUEST_RETRY',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
}

/**
 * State transition log entry
 */
export interface StateTransitionLog {
  fromState: AvitoWorkflowState;
  toState: AvitoWorkflowState;
  timestamp: Date;
  trigger: 'USER_INPUT' | 'API_RESPONSE' | 'TIMEOUT' | 'ERROR' | 'MANUAL';
  metadata?: Record<string, any>;
  duration: number;
}

/**
 * Error entry for error history tracking
 */
export interface ErrorEntry {
  error: string;
  errorCode?: string;
  state: AvitoWorkflowState;
  timestamp: Date;
  recoverable: boolean;
  retryCount: number;
}

/**
 * Workflow metrics for performance tracking
 */
export interface AvitoWorkflowMetrics {
  completedSteps: number;
  totalSteps: number; // Required for error rate calculation
  averageStepDurationMs: number;
  bottleneckStates: AvitoWorkflowState[];
  recoveryRate: number;
  errorRate: number; // Error rate calculation
  apiResponseTimes: number[];
  totalErrors?: number; // Required for error tracking
  errorsByType?: Record<string, number>; // Used in workflow monitoring
  errorsBySeverity?: Record<string, number>; // Used in workflow monitoring
  escalatedCount?: number; // Used in workflow monitoring
  resolvedCount?: number; // Used in workflow monitoring
  averageResolutionTime?: number; // Used in tests
  escalatedErrors?: any[]; // Used in tests
}

/**
 * Storage audit entry for security tracking
 */
export interface StorageAuditEntry {
  operation: string;
  timestamp: Date;
  success: boolean;
  details?: Record<string, any>;
}

/**
 * Secure storage result interface
 */
export interface SecureStorageResult {
  encrypted: boolean;
  stored: boolean;
  encryptionKeyId?: string;
  storageLocation?: string;
  integrityHash?: string;
  auditTrail: StorageAuditEntry[];
}

/**
 * Legacy interface for backward compatibility
 */
export interface StorageResult extends SecureStorageResult {
  success: boolean;
  error?: string;
}

/**
 * Workflow metrics interface for monitoring
 */
export interface WorkflowMetrics extends AvitoWorkflowMetrics {}

/**
 * Credential validation status enumeration
 */
export enum CredentialValidationStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  INVALID = 'INVALID',
  EXPIRED = 'EXPIRED',
  API_ERROR = 'API_ERROR',
}

/**
 * Storage operation status enumeration
 */
export enum StorageOperationStatus {
  PENDING = 'PENDING',
  STORING = 'STORING',
  STORED = 'STORED',
  FAILED = 'FAILED',
  ENCRYPTED = 'ENCRYPTED',
}

/**
 * Credential extraction patterns and formats
 */
export interface CredentialExtractionPattern {
  name: string;
  clientIdRegex: RegExp;
  clientSecretRegex: RegExp;
  description: string;
  examples: string[];
}

/**
 * Credential format validation rules
 */
export interface CredentialValidationRules {
  clientId: {
    minLength: number;
    maxLength: number;
    pattern: RegExp;
    description: string;
  };
  clientSecret: {
    minLength: number;
    maxLength: number;
    pattern: RegExp;
    description: string;
  };
}

/**
 * Avito API credential storage structure
 */
export interface AvitoCredentials {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  lastValidatedAt?: Date;
  validationStatus?: CredentialValidationStatus;
  encryptionStatus?: StorageOperationStatus;
}

/**
 * API validation result structure
 */
export interface ValidationResult {
  success: boolean;
  error?: string;
  errorType?:
    | 'TIMEOUT'
    | 'AUTH'
    | 'NETWORK'
    | 'VALIDATION'
    | 'EXECUTION'
    | 'UNKNOWN'
    | 'API'
    | 'RATE_LIMIT';
  accessToken?: string;
  expiresIn?: number;
  tokenType?: string;
  validatedAt?: Date;
  apiResponseTime?: number;
  retryAfter?: number;
}

/**
 * Workflow attempt tracking
 */
export interface AttemptMetrics {
  attemptCount: number;
  maxAttempts: number;
  firstAttemptAt: Date;
  lastAttemptAt?: Date;
  failureReasons: string[];
  retryDelayMs?: number;
}

/**
 * Complete workflow context for state persistence
 */
export interface AvitoWorkflowContext {
  // Core identifiers
  userId: string;
  workspaceId: string;
  threadId: string;
  workflowId: string;

  // State management with transition log
  state: AvitoWorkflowState;
  previousState?: AvitoWorkflowState;
  stateChangedAt: Date;
  stateTransitionLog: StateTransitionLog[];

  // Enhanced attempt tracking
  attemptMetrics: AttemptMetrics;

  // Credential data with validation status
  credentials?: AvitoCredentials;
  validationResult?: ValidationResult;
  storageResult?: StorageResult;

  // Error tracking with recovery info
  lastError?: string;
  errorHistory: ErrorEntry[];

  // Workflow metadata with version tracking
  workflowStartedAt: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  workflowVersion: string;

  // Performance metrics
  metrics: AvitoWorkflowMetrics;

  // User interaction tracking
  userInteractions: Array<{
    type: 'MESSAGE_SENT' | 'CREDENTIALS_PROVIDED' | 'RETRY_REQUESTED';
    timestamp: Date;
    content?: string;
    metadata?: Record<string, any>;
  }>;

  // Integration settings
  integrations: {
    avitoApiEndpoint: string;
    backupStorageEnabled: boolean;
    monitoringEnabled: boolean;
    healthCheckInterval: number;
  };

  // Configuration with complete type safety
  config: {
    maxAttempts: number;
    timeoutMs: number;
    retryDelayMs: number;
    enableAutoRetry: boolean;
    enableEncryption: boolean;
    enableAuditLog: boolean;
    apiTimeoutMs: number;
    validationStrictMode: boolean;
    allowedCredentialFormats: string[];
  };
}

/**
 * State transition validation matrix
 */
export const VALID_STATE_TRANSITIONS: Record<
  AvitoWorkflowState,
  AvitoWorkflowState[]
> = {
  [AvitoWorkflowState.INIT]: [AvitoWorkflowState.GREETING_SENT],

  [AvitoWorkflowState.GREETING_SENT]: [AvitoWorkflowState.AWAITING_CREDENTIALS],

  [AvitoWorkflowState.AWAITING_CREDENTIALS]: [
    AvitoWorkflowState.EXTRACTING_CREDENTIALS,
    AvitoWorkflowState.ERROR_INVALID_FORMAT,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  [AvitoWorkflowState.EXTRACTING_CREDENTIALS]: [
    AvitoWorkflowState.VALIDATING_CREDENTIALS,
    AvitoWorkflowState.ERROR_INVALID_FORMAT,
  ],

  [AvitoWorkflowState.VALIDATING_CREDENTIALS]: [
    AvitoWorkflowState.VALIDATION_SUCCESS,
    AvitoWorkflowState.VALIDATION_FAILED,
    AvitoWorkflowState.ERROR_API_FAILURE,
  ],

  [AvitoWorkflowState.VALIDATION_SUCCESS]: [
    AvitoWorkflowState.STORING_CREDENTIALS,
  ],

  [AvitoWorkflowState.VALIDATION_FAILED]: [
    AvitoWorkflowState.AWAITING_CREDENTIALS,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  [AvitoWorkflowState.STORING_CREDENTIALS]: [
    AvitoWorkflowState.STORAGE_COMPLETE,
    AvitoWorkflowState.ERROR_STORAGE_FAILURE,
  ],

  [AvitoWorkflowState.STORAGE_COMPLETE]: [
    AvitoWorkflowState.COMPLETING_WELCOME,
  ],

  [AvitoWorkflowState.COMPLETING_WELCOME]: [
    AvitoWorkflowState.WELCOME_COMPLETED,
  ],

  [AvitoWorkflowState.ERROR_INVALID_FORMAT]: [
    AvitoWorkflowState.AWAITING_CREDENTIALS,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  [AvitoWorkflowState.ERROR_API_FAILURE]: [
    AvitoWorkflowState.AWAITING_CREDENTIALS,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  [AvitoWorkflowState.ERROR_STORAGE_FAILURE]: [
    AvitoWorkflowState.STORING_CREDENTIALS,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  [AvitoWorkflowState.REQUEST_RETRY]: [
    AvitoWorkflowState.AWAITING_CREDENTIALS,
    AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
  ],

  // Terminal states
  [AvitoWorkflowState.WELCOME_COMPLETED]: [],
  [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]: [],
};

/**
 * Tools allowed in each state for validation
 */
export const ALLOWED_TOOLS_BY_STATE: Record<AvitoWorkflowState, string[]> = {
  [AvitoWorkflowState.INIT]: [],
  [AvitoWorkflowState.GREETING_SENT]: ['request_credentials'],
  [AvitoWorkflowState.AWAITING_CREDENTIALS]: [
    'extract_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.EXTRACTING_CREDENTIALS]: ['validate_avito_token'],
  [AvitoWorkflowState.VALIDATING_CREDENTIALS]: [],
  [AvitoWorkflowState.VALIDATION_SUCCESS]: ['store_credentials'],
  [AvitoWorkflowState.VALIDATION_FAILED]: ['request_credentials'],
  [AvitoWorkflowState.STORING_CREDENTIALS]: [],
  [AvitoWorkflowState.STORAGE_COMPLETE]: ['report_welcome_completion'],
  [AvitoWorkflowState.COMPLETING_WELCOME]: [],
  [AvitoWorkflowState.WELCOME_COMPLETED]: [],
  [AvitoWorkflowState.ERROR_INVALID_FORMAT]: ['request_credentials'],
  [AvitoWorkflowState.ERROR_API_FAILURE]: ['request_credentials'],
  [AvitoWorkflowState.ERROR_STORAGE_FAILURE]: ['store_credentials'],
  [AvitoWorkflowState.REQUEST_RETRY]: ['request_credentials'],
  [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]: [],
};

/**
 * Enhanced default workflow configuration
 */
export const DEFAULT_WORKFLOW_CONFIG = {
  maxAttempts: 3,
  timeoutMs: 600000, // 10 minutes
  retryDelayMs: 2000, // 2 seconds base delay
  enableAutoRetry: true,
  enableEncryption: true,
  enableAuditLog: true,
  apiTimeoutMs: 30000, // 30 seconds for API calls
  validationStrictMode: true,
  allowedCredentialFormats: [
    'KEY_VALUE_EQUALS',
    'KEY_VALUE_COLON',
    'JSON_FORMAT',
    'YAML_FORMAT',
    'MULTILINE_TEXT',
  ],
};

/**
 * Credential extraction patterns for multiple formats
 */
export const CREDENTIAL_EXTRACTION_PATTERNS: CredentialExtractionPattern[] = [
  {
    name: 'KEY_VALUE_EQUALS',
    clientIdRegex: /CLIENT_ID\s*=\s*['"\`]?([A-Za-z0-9_-]+)['"\`]?/i,
    clientSecretRegex: /CLIENT_SECRET\s*=\s*['"\`]?([A-Za-z0-9_-]+)['"\`]?/i,
    description: 'KEY = VALUE format',
    examples: ['CLIENT_ID = abc123', 'CLIENT_SECRET = xyz789def456'],
  },
  {
    name: 'KEY_VALUE_COLON',
    clientIdRegex: /CLIENT_ID\s*:\s*['"\`]?([A-Za-z0-9_-]+)['"\`]?/i,
    clientSecretRegex: /CLIENT_SECRET\s*:\s*['"\`]?([A-Za-z0-9_-]+)['"\`]?/i,
    description: 'KEY: VALUE format',
    examples: ['CLIENT_ID: abc123', 'CLIENT_SECRET: xyz789def456'],
  },
  {
    name: 'JSON_FORMAT',
    clientIdRegex: /['"]client_id['"]\s*:\s*['"]([A-Za-z0-9_-]+)['"]/i,
    clientSecretRegex: /['"]client_secret['"]\s*:\s*['"]([A-Za-z0-9_-]+)['"]/i,
    description: 'JSON format',
    examples: ['{"client_id": "abc123", "client_secret": "xyz789"}'],
  },
];

/**
 * Credential validation rules based on Avito API requirements
 */
export const CREDENTIAL_VALIDATION_RULES: CredentialValidationRules = {
  clientId: {
    minLength: 10,
    maxLength: 50,
    pattern: /^[A-Za-z0-9_-]+$/,
    description:
      'CLIENT_ID должен содержать 10-50 символов (буквы, цифры, _, -)',
  },
  clientSecret: {
    minLength: 20,
    maxLength: 100,
    pattern: /^[A-Za-z0-9_-]+$/,
    description:
      'CLIENT_SECRET должен содержать 20-100 символов (буквы, цифры, _, -)',
  },
};

/**
 * Workflow state validation helper
 */
export class AvitoWorkflowStateValidator {
  /**
   * Validate if state transition is allowed
   */
  static isValidTransition(
    from: AvitoWorkflowState,
    to: AvitoWorkflowState,
  ): boolean {
    const allowedTransitions = VALID_STATE_TRANSITIONS[from] || [];

    return allowedTransitions.includes(to);
  }

  /**
   * Validate if tool is allowed in current state
   */
  static isToolAllowedInState(
    tool: string,
    state: AvitoWorkflowState,
  ): boolean {
    const allowedTools = ALLOWED_TOOLS_BY_STATE[state] || [];

    return allowedTools.includes(tool);
  }

  /**
   * Check if state is terminal (workflow complete)
   */
  static isTerminalState(state: AvitoWorkflowState): boolean {
    return [
      AvitoWorkflowState.WELCOME_COMPLETED,
      AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
    ].includes(state);
  }

  /**
   * Check if state is error state
   */
  static isErrorState(state: AvitoWorkflowState): boolean {
    return [
      AvitoWorkflowState.ERROR_INVALID_FORMAT,
      AvitoWorkflowState.ERROR_API_FAILURE,
      AvitoWorkflowState.ERROR_STORAGE_FAILURE,
      AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
    ].includes(state);
  }

  /**
   * Get user-friendly state description with enhanced context
   */
  static getStateDescription(
    state: AvitoWorkflowState,
    context?: AvitoWorkflowContext,
  ): string {
    const descriptions: Record<AvitoWorkflowState, string> = {
      [AvitoWorkflowState.INIT]: 'Инициализация workflow интеграции с Avito',
      [AvitoWorkflowState.GREETING_SENT]:
        'Приветствие отправлено, запрос учетных данных',
      [AvitoWorkflowState.AWAITING_CREDENTIALS]:
        'Ожидание CLIENT_ID и CLIENT_SECRET от пользователя',
      [AvitoWorkflowState.EXTRACTING_CREDENTIALS]:
        'Извлечение и анализ учетных данных',
      [AvitoWorkflowState.VALIDATING_CREDENTIALS]:
        'Проверка учетных данных через Avito API',
      [AvitoWorkflowState.VALIDATION_SUCCESS]:
        'Учетные данные успешно подтверждены',
      [AvitoWorkflowState.VALIDATION_FAILED]:
        'Учетные данные не прошли валидацию',
      [AvitoWorkflowState.STORING_CREDENTIALS]:
        'Шифрование и сохранение учетных данных',
      [AvitoWorkflowState.STORAGE_COMPLETE]:
        'Учетные данные безопасно сохранены',
      [AvitoWorkflowState.COMPLETING_WELCOME]: 'Завершение этапа интеграции',
      [AvitoWorkflowState.WELCOME_COMPLETED]:
        'Интеграция с Avito успешно завершена',
      [AvitoWorkflowState.ERROR_INVALID_FORMAT]:
        'Ошибка: неверный формат учетных данных',
      [AvitoWorkflowState.ERROR_API_FAILURE]:
        'Ошибка: сбой при обращении к API Avito',
      [AvitoWorkflowState.ERROR_STORAGE_FAILURE]:
        'Ошибка: сбой при сохранении данных',
      [AvitoWorkflowState.REQUEST_RETRY]: 'Запрос повторной попытки настройки',
      [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]:
        'Превышено максимальное количество попыток',
    };

    let description = descriptions[state] || `Unknown state: ${state}`;

    // Add context information if available
    if (context) {
      const attempt = context.attemptMetrics.attemptCount;
      const maxAttempts = context.attemptMetrics.maxAttempts;

      if (attempt > 0) {
        description += ` (попытка ${attempt}/${maxAttempts})`;
      }
    }

    return description;
  }
}

/**
 * Enhanced context factory for creating new workflow contexts
 */
export class AvitoWorkflowContextFactory {
  static create(
    userId: string,
    workspaceId: string,
    threadId: string,
    config = DEFAULT_WORKFLOW_CONFIG,
  ): AvitoWorkflowContext {
    const now = new Date();
    const workflowId = `avito_${userId}_${Date.now()}`;

    return {
      userId,
      workspaceId,
      threadId,
      workflowId,
      state: AvitoWorkflowState.INIT,
      stateChangedAt: now,
      stateTransitionLog: [],
      attemptMetrics: {
        attemptCount: 0,
        maxAttempts: config.maxAttempts,
        firstAttemptAt: now,
        failureReasons: [],
        retryDelayMs: config.retryDelayMs,
      },
      errorHistory: [],
      workflowStartedAt: now,
      timeoutAt: new Date(now.getTime() + config.timeoutMs),
      workflowVersion: '2.0.0',
      metrics: {
        completedSteps: 0,
        totalSteps: 7, // Default workflow has 7 main steps
        averageStepDurationMs: 0,
        bottleneckStates: [],
        recoveryRate: 0,
        errorRate: 0, // Initialize error rate
        apiResponseTimes: [],
      },
      config: {
        maxAttempts: config.maxAttempts,
        timeoutMs: config.timeoutMs,
        retryDelayMs: config.retryDelayMs,
        enableAutoRetry: config.enableAutoRetry,
        enableEncryption: config.enableEncryption,
        enableAuditLog: config.enableAuditLog,
        apiTimeoutMs: config.apiTimeoutMs,
        validationStrictMode: config.validationStrictMode,
        allowedCredentialFormats: config.allowedCredentialFormats,
      },
      userInteractions: [],
      integrations: {
        avitoApiEndpoint: 'https://api.avito.ru/token',
        backupStorageEnabled: true,
        monitoringEnabled: true,
        healthCheckInterval: 30000,
      },
    };
  }

  /**
   * Create context from existing partial data
   */
  static fromPartial(
    partialContext: Partial<AvitoWorkflowContext> &
      Pick<AvitoWorkflowContext, 'userId' | 'workspaceId' | 'threadId'>,
  ): AvitoWorkflowContext {
    const baseContext = AvitoWorkflowContextFactory.create(
      partialContext.userId,
      partialContext.workspaceId,
      partialContext.threadId,
      partialContext.config,
    );

    return { ...baseContext, ...partialContext };
  }

  /**
   * Clone context with state transition
   */
  static transitionState(
    context: AvitoWorkflowContext,
    newState: AvitoWorkflowState,
    trigger: StateTransitionLog['trigger'] = 'MANUAL',
    metadata?: Record<string, any>,
  ): AvitoWorkflowContext {
    const now = new Date();
    const duration = now.getTime() - context.stateChangedAt.getTime();

    const transitionLog: StateTransitionLog = {
      fromState: context.state,
      toState: newState,
      timestamp: now,
      trigger,
      metadata,
      duration,
    };

    return {
      ...context,
      previousState: context.state,
      state: newState,
      stateChangedAt: now,
      stateTransitionLog: [...context.stateTransitionLog, transitionLog],
      metrics: {
        ...context.metrics,
        completedSteps: AvitoWorkflowStateValidator.isTerminalState(newState)
          ? context.metrics.completedSteps + 1
          : context.metrics.completedSteps,
        averageStepDurationMs:
          (context.metrics.averageStepDurationMs *
            context.stateTransitionLog.length +
            duration) /
          (context.stateTransitionLog.length + 1),
      },
    };
  }
}

/**
 * Utility functions for working with workflow contexts
 */
export class AvitoWorkflowUtils {
  /**
   * Check if workflow has timed out
   */
  static isTimedOut(context: AvitoWorkflowContext): boolean {
    return context.timeoutAt ? new Date() > context.timeoutAt : false;
  }

  /**
   * Calculate remaining time for workflow
   */
  static getRemainingTime(context: AvitoWorkflowContext): number {
    if (!context.timeoutAt) return Infinity;

    return Math.max(0, context.timeoutAt.getTime() - Date.now());
  }

  /**
   * Get workflow duration so far
   */
  static getWorkflowDuration(context: AvitoWorkflowContext): number {
    const endTime = context.completedAt || new Date();

    return endTime.getTime() - context.workflowStartedAt.getTime();
  }

  /**
   * Check if retry is allowed
   */
  static canRetry(context: AvitoWorkflowContext): boolean {
    return (
      context.attemptMetrics.attemptCount <
        context.attemptMetrics.maxAttempts &&
      !AvitoWorkflowStateValidator.isTerminalState(context.state) &&
      !this.isTimedOut(context)
    );
  }

  /**
   * Calculate next retry delay using exponential backoff
   */
  static getNextRetryDelay(context: AvitoWorkflowContext): number {
    const { attemptCount, retryDelayMs } = context.attemptMetrics;
    const baseDelay = retryDelayMs || 2000;

    return Math.min(baseDelay * Math.pow(2, attemptCount), 30000);
  }

  /**
   * Add error to context history
   */
  static addError(
    context: AvitoWorkflowContext,
    error: string,
    errorCode?: string,
    recoverable = true,
  ): AvitoWorkflowContext {
    const errorEntry: ErrorEntry = {
      error,
      errorCode,
      state: context.state,
      timestamp: new Date(),
      recoverable,
      retryCount: 0,
    };

    return {
      ...context,
      lastError: error,
      errorHistory: [...context.errorHistory, errorEntry],
      metrics: {
        ...context.metrics,
        recoveryRate:
          context.errorHistory.length /
          Math.max(1, context.stateTransitionLog.length || 1),
      },
    };
  }

  /**
   * Record user interaction
   */
  static recordUserInteraction(
    context: AvitoWorkflowContext,
    type: AvitoWorkflowContext['userInteractions'][0]['type'],
    content?: string,
    metadata?: Record<string, any>,
  ): AvitoWorkflowContext {
    return {
      ...context,
      userInteractions: [
        ...context.userInteractions,
        {
          type,
          timestamp: new Date(),
          content,
          metadata,
        },
      ],
    };
  }
}

// ===============================================================
// CONSOLIDATED INTERFACES (Extracted from duplicate services)
// ===============================================================

/**
 * Enhanced error classification for consolidated error handling
 * Extracted from: AvitoWorkflowErrorRecoveryService
 */
export enum ConsolidatedErrorType {
  // Core errors
  INVALID_CREDENTIALS = 'invalid_credentials',
  API_TIMEOUT = 'api_timeout',
  NETWORK_ERROR = 'network_error',

  // State machine errors
  INVALID_STATE_TRANSITION = 'invalid_state_transition',
  WORKFLOW_TIMEOUT = 'workflow_timeout',
  CONTEXT_CORRUPTION = 'context_corruption',

  // Tool errors
  TOOL_VALIDATION_FAILED = 'tool_validation_failed',
  TOOL_EXECUTION_TIMEOUT = 'tool_execution_timeout',
  TOOL_CIRCUIT_BREAKER = 'tool_circuit_breaker',

  // Enhanced error types
  CREDENTIAL_FORMAT_ERROR = 'credential_format_error',
  API_AUTHENTICATION_FAILED = 'api_authentication_failed',
  API_RATE_LIMITED = 'api_rate_limited',
  STORAGE_ENCRYPTION_FAILED = 'storage_encryption_failed',
  MONITORING_FAILURE = 'monitoring_failure',
  ESCALATION_REQUIRED = 'escalation_required',
}

/**
 * Performance tracking data structure
 * Extracted from: AvitoWorkflowMonitoringService
 */
export interface ConsolidatedPerformanceData {
  executionTimeMs: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
  networkLatencyMs: number;
  apiResponseTimes: number[];
  throughputPerMinute: number;

  // Percentile data
  responseTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };

  // Resource utilization
  resourceUtilization: {
    memory: number;
    cpu: number;
    connections: number;
    diskIO: number;
  };

  // Trend analysis
  performanceTrend: 'improving' | 'degrading' | 'stable';
  lastOptimizationAt?: Date;
}

/**
 * Enhanced validation results with detailed feedback
 * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
 */
export interface ConsolidatedValidationResult {
  success: boolean;
  errorType?: ConsolidatedErrorType;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recoverable?: boolean;
  retryable?: boolean;
  retryAfterMs?: number;

  // Enhanced validation details
  validationSteps: Array<{
    step: string;
    success: boolean;
    duration: number;
    error?: string;
  }>;

  // API-specific validation
  apiValidationStatus?: {
    endpoint: string;
    responseCode: number;
    responseTime: number;
    authenticated: boolean;
    rateLimitRemaining?: number;
  };

  // Security validation
  securityValidation?: {
    encryptionEnabled: boolean;
    integrityVerified: boolean;
    auditTrailCreated: boolean;
  };

  metadata?: Record<string, any>;
}

/**
 * Health monitoring components status
 * Extracted from: AvitoWorkflowHealthService
 */
export interface ConsolidatedComponentHealth {
  component: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  responseTime: number;
  lastCheck: Date;

  // Error tracking
  errorRate: number;
  lastError?: {
    message: string;
    timestamp: Date;
    recoverable: boolean;
  };

  // Performance metrics
  metrics: {
    throughput: number;
    latency: number;
    availability: number;
    errorCount: number;
  };

  // Circuit breaker status
  circuitBreaker?: {
    isOpen: boolean;
    failureCount: number;
    lastFailure: Date;
    recoveryAttempts: number;
  };
}

/**
 * Enhanced workflow error with comprehensive tracking
 * Extracted from: AvitoWorkflowErrorRecoveryService
 */
export interface ConsolidatedWorkflowError {
  id: string;
  type: ConsolidatedErrorType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;

  // Error context
  context: {
    state: AvitoWorkflowState;
    userId: string;
    workspaceId: string;
    threadId: string;
    attemptCount: number;
  };

  // Recovery information
  recovery: {
    recoverable: boolean;
    attempted: boolean;
    successful?: boolean;
    strategy?: string;
    retryCount: number;
    escalated: boolean;
    resolutionTime?: number;
  };

  // Error analysis
  analysis: {
    category: 'TRANSIENT' | 'PERSISTENT' | 'CONFIGURATION' | 'SYSTEM';
    pattern?: string;
    frequency: number;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    predictedRecurrence?: Date;
  };

  // Stack trace and debugging
  stackTrace?: string;
  debugInfo?: Record<string, any>;
}

/**
 * Consolidated workflow context with all enhanced features
 * This interface consolidates features from all duplicate services for comprehensive workflow management
 */
export interface ConsolidatedWorkflowContext {
  // Core context (from base AvitoWorkflowContext)
  userId: string;
  workspaceId: string;
  threadId: string;
  workflowId: string;
  currentState: AvitoWorkflowState;

  // Enhanced state management (from AvitoWorkflowStateMachineService)
  stateHistory: StateTransitionLog[];
  stateMetrics: {
    totalTransitions: number;
    averageTransitionTime: number;
    stateDistribution: Record<AvitoWorkflowState, number>;
    bottleneckStates: AvitoWorkflowState[];
  };

  // Comprehensive error management (from AvitoWorkflowErrorRecoveryService)
  errorHistory: ConsolidatedWorkflowError[];
  errorMetrics: {
    totalErrors: number;
    errorsByType: Record<ConsolidatedErrorType, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
    escalationRate: number;
    averageResolutionTime: number;
  };

  // Advanced performance tracking (from AvitoWorkflowMonitoringService)
  performanceMetrics: ConsolidatedPerformanceData;
  performanceHistory: Array<{
    timestamp: Date;
    snapshot: ConsolidatedPerformanceData;
  }>;

  // Enhanced validation tracking (from EnhancedAvitoWelcomeToolDispatcherService)
  validationResults: ConsolidatedValidationResult[];
  validationMetrics: {
    totalValidations: number;
    successRate: number;
    averageValidationTime: number;
    failuresByType: Record<ConsolidatedErrorType, number>;
  };

  // Health monitoring integration (from AvitoWorkflowHealthService)
  healthMetrics: {
    overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
    componentHealth: ConsolidatedComponentHealth[];
    lastHealthCheck: Date;
    healthScore: number; // 0-100
    healthTrend: 'improving' | 'degrading' | 'stable';
  };

  // Workflow lifecycle management
  lifecycle: {
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    timeoutAt?: Date;
    totalDuration?: number;
    workflowVersion: string;
    lastUpdatedAt: Date;
  };

  // Enhanced user interaction tracking
  userInteractions: Array<{
    id: string;
    type:
      | 'MESSAGE_SENT'
      | 'CREDENTIALS_PROVIDED'
      | 'RETRY_REQUESTED'
      | 'ERROR_REPORTED'
      | 'WORKFLOW_CANCELLED';
    timestamp: Date;
    content?: string;
    success: boolean;
    responseTime?: number;
    metadata?: Record<string, any>;
  }>;

  // Advanced configuration with feature flags
  configuration: {
    // Core settings
    maxAttempts: number;
    timeoutMs: number;
    retryDelayMs: number;
    enableAutoRetry: boolean;

    // Security settings
    enableEncryption: boolean;
    enableAuditLog: boolean;
    enableIntegrityChecks: boolean;

    // Monitoring settings
    enablePerformanceTracking: boolean;
    enableHealthMonitoring: boolean;
    enablePredictiveAlerts: boolean;

    // Validation settings
    validationStrictMode: boolean;
    enableCircuitBreaker: boolean;
    enableFallbackMechanisms: boolean;

    // Feature flags
    features: {
      enhancedErrorRecovery: boolean;
      realTimeMonitoring: boolean;
      predictiveAnalytics: boolean;
      autoOptimization: boolean;
    };
  };

  // Integration status and metadata
  integrations: {
    avitoApi: {
      endpoint: string;
      connected: boolean;
      lastConnectionCheck: Date;
      apiVersion: string;
      rateLimitStatus?: {
        remaining: number;
        resetAt: Date;
        limit: number;
      };
    };

    monitoring: {
      enabled: boolean;
      dashboardUrl?: string;
      alertsConfigured: boolean;
      metricsCollectionInterval: number;
    };

    storage: {
      provider: string;
      encrypted: boolean;
      backupEnabled: boolean;
      lastBackupAt?: Date;
    };
  };

  // Predictive analytics and insights
  analytics: {
    predictions: Array<{
      metric: string;
      currentValue: number;
      predictedValue: number;
      confidence: number;
      timeToThreshold: number;
      recommendation: string;
    }>;

    riskAssessment: {
      level: 'low' | 'medium' | 'high' | 'critical';
      factors: string[];
      mitigationSuggestions: string[];
      lastAssessment: Date;
    };

    trends: {
      performance: 'improving' | 'degrading' | 'stable';
      errorRate: 'increasing' | 'decreasing' | 'stable';
      userSatisfaction: 'improving' | 'degrading' | 'stable';
    };
  };

  // Workflow metadata for debugging and analysis
  metadata: {
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    environment: 'development' | 'staging' | 'production';
    region?: string;
    clientInfo?: {
      userAgent: string;
      ipAddress: string;
      sessionId: string;
    };
    customFields: Record<string, any>;
  };
}

/**
 * Factory for creating ConsolidatedWorkflowContext instances
 */
export class ConsolidatedWorkflowContextFactory {
  /**
   * Create a new consolidated workflow context
   */
  static create(
    userId: string,
    workspaceId: string,
    threadId: string,
    options: {
      priority?: ConsolidatedWorkflowContext['metadata']['priority'];
      environment?: ConsolidatedWorkflowContext['metadata']['environment'];
      features?: Partial<
        ConsolidatedWorkflowContext['configuration']['features']
      >;
      tags?: string[];
    } = {},
  ): ConsolidatedWorkflowContext {
    const now = new Date();
    const workflowId = `consolidated_${userId}_${Date.now()}`;

    return {
      userId,
      workspaceId,
      threadId,
      workflowId,
      currentState: AvitoWorkflowState.INIT,

      stateHistory: [],
      stateMetrics: {
        totalTransitions: 0,
        averageTransitionTime: 0,
        stateDistribution: {
          [AvitoWorkflowState.INIT]: 0,
          [AvitoWorkflowState.GREETING_SENT]: 0,
          [AvitoWorkflowState.AWAITING_CREDENTIALS]: 0,
          [AvitoWorkflowState.EXTRACTING_CREDENTIALS]: 0,
          [AvitoWorkflowState.VALIDATING_CREDENTIALS]: 0,
          [AvitoWorkflowState.VALIDATION_SUCCESS]: 0,
          [AvitoWorkflowState.VALIDATION_FAILED]: 0,
          [AvitoWorkflowState.STORING_CREDENTIALS]: 0,
          [AvitoWorkflowState.STORAGE_COMPLETE]: 0,
          [AvitoWorkflowState.COMPLETING_WELCOME]: 0,
          [AvitoWorkflowState.WELCOME_COMPLETED]: 0,
          [AvitoWorkflowState.ERROR_INVALID_FORMAT]: 0,
          [AvitoWorkflowState.ERROR_API_FAILURE]: 0,
          [AvitoWorkflowState.ERROR_STORAGE_FAILURE]: 0,
          [AvitoWorkflowState.REQUEST_RETRY]: 0,
          [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]: 0,
        },
        bottleneckStates: [],
      },

      errorHistory: [],
      errorMetrics: {
        totalErrors: 0,
        errorsByType: {} as Record<ConsolidatedErrorType, number>,
        errorsBySeverity: {},
        recoverySuccessRate: 0,
        escalationRate: 0,
        averageResolutionTime: 0,
      },

      performanceMetrics: {
        executionTimeMs: 0,
        memoryUsageMB: 0,
        cpuUsagePercent: 0,
        networkLatencyMs: 0,
        apiResponseTimes: [],
        throughputPerMinute: 0,
        responseTimePercentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
        resourceUtilization: { memory: 0, cpu: 0, connections: 0, diskIO: 0 },
        performanceTrend: 'stable',
      },

      performanceHistory: [],
      validationResults: [],
      validationMetrics: {
        totalValidations: 0,
        successRate: 0,
        averageValidationTime: 0,
        failuresByType: {} as Record<ConsolidatedErrorType, number>,
      },

      healthMetrics: {
        overallHealth: 'UNKNOWN',
        componentHealth: [],
        lastHealthCheck: now,
        healthScore: 100,
        healthTrend: 'stable',
      },

      lifecycle: {
        createdAt: now,
        workflowVersion: '3.0.0-consolidated',
        lastUpdatedAt: now,
      },

      userInteractions: [],

      configuration: {
        maxAttempts: 3,
        timeoutMs: 600000,
        retryDelayMs: 2000,
        enableAutoRetry: true,
        enableEncryption: true,
        enableAuditLog: true,
        enableIntegrityChecks: true,
        enablePerformanceTracking: true,
        enableHealthMonitoring: true,
        enablePredictiveAlerts: true,
        validationStrictMode: true,
        enableCircuitBreaker: true,
        enableFallbackMechanisms: true,
        features: {
          enhancedErrorRecovery: true,
          realTimeMonitoring: true,
          predictiveAnalytics: true,
          autoOptimization: false,
          ...options.features,
        },
      },

      integrations: {
        avitoApi: {
          endpoint: 'https://api.avito.ru/token',
          connected: false,
          lastConnectionCheck: now,
          apiVersion: 'v1',
        },
        monitoring: {
          enabled: true,
          alertsConfigured: false,
          metricsCollectionInterval: 30000,
        },
        storage: {
          provider: 'encrypted-storage',
          encrypted: true,
          backupEnabled: true,
        },
      },

      analytics: {
        predictions: [],
        riskAssessment: {
          level: 'low',
          factors: [],
          mitigationSuggestions: [],
          lastAssessment: now,
        },
        trends: {
          performance: 'stable',
          errorRate: 'stable',
          userSatisfaction: 'stable',
        },
      },

      metadata: {
        tags: options.tags || [],
        priority: options.priority || 'medium',
        environment: options.environment || 'production',
        customFields: {},
      },
    };
  }

  /**
   * Convert from legacy AvitoWorkflowContext to ConsolidatedWorkflowContext
   */
  static fromLegacyContext(
    legacyContext: AvitoWorkflowContext,
  ): ConsolidatedWorkflowContext {
    const consolidated = ConsolidatedWorkflowContextFactory.create(
      legacyContext.userId,
      legacyContext.workspaceId,
      legacyContext.threadId,
    );

    // Map legacy fields to consolidated structure
    consolidated.currentState = legacyContext.state;
    consolidated.stateHistory = legacyContext.stateTransitionLog;
    consolidated.lifecycle.createdAt = legacyContext.workflowStartedAt;
    consolidated.lifecycle.completedAt = legacyContext.completedAt;
    consolidated.lifecycle.timeoutAt = legacyContext.timeoutAt;

    // Map legacy errors to consolidated error structure
    consolidated.errorHistory = legacyContext.errorHistory.map(
      (error, index) => ({
        id: `legacy_error_${index}`,
        type: ConsolidatedErrorType.INVALID_CREDENTIALS, // Default mapping
        severity: 'MEDIUM',
        message: error.error,
        timestamp: error.timestamp,
        context: {
          state: error.state,
          userId: legacyContext.userId,
          workspaceId: legacyContext.workspaceId,
          threadId: legacyContext.threadId,
          attemptCount: error.retryCount,
        },
        recovery: {
          recoverable: error.recoverable,
          attempted: false,
          retryCount: error.retryCount,
          escalated: false,
        },
        analysis: {
          category: 'TRANSIENT',
          frequency: 1,
          trend: 'STABLE',
        },
      }),
    );

    // Map legacy performance metrics
    consolidated.performanceMetrics.apiResponseTimes =
      legacyContext.metrics.apiResponseTimes;
    consolidated.performanceMetrics.executionTimeMs =
      legacyContext.metrics.averageStepDurationMs;

    return consolidated;
  }
}
