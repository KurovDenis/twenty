import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import { BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import {
  AvitoWorkflowContext,
  AvitoWorkflowState,
} from '../types/avito-workflow-context';

/**
 * Error types specific to Avito integration workflow
 */
export enum AvitoErrorType {
  // Credential-related errors
  INVALID_CREDENTIAL_FORMAT = 'INVALID_CREDENTIAL_FORMAT',
  CREDENTIALS_NOT_FOUND = 'CREDENTIALS_NOT_FOUND',
  DUPLICATE_CREDENTIALS = 'DUPLICATE_CREDENTIALS',

  // API-related errors
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API = 'API',

  // Storage-related errors
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',

  // Workflow-related errors
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  WORKFLOW_TIMEOUT = 'WORKFLOW_TIMEOUT',
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',

  // System errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SYSTEM_UNAVAILABLE = 'SYSTEM_UNAVAILABLE',
}

/**
 * Error recovery strategy configuration
 */
export interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  fallbackAction?: () => Promise<void>;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  requiresUserAction: boolean;
}

/**
 * Detailed error information for analysis and recovery
 */
export interface AvitoErrorDetails {
  errorType: AvitoErrorType;
  originalError: Error | string;
  context: {
    userId: string;
    workspaceId: string;
    threadId: string;
    workflowState: AvitoWorkflowState;
    attemptCount: number;
    timestamp: Date;
  };
  recoveryStrategy: ErrorRecoveryStrategy;
  metadata?: Record<string, any>;
}

/**
 * Recovery execution result
 */
export interface RecoveryResult {
  success: boolean;
  newState?: AvitoWorkflowState;
  message?: string;
  requiresUserInput?: boolean;
  retryAfterMs?: number;
  fallbackExecuted?: boolean;
}

/**
 * Comprehensive error recovery service for Avito workflow
 *
 * Provides intelligent error classification, recovery strategies,
 * and automated fallback mechanisms for robust workflow execution.
 */
@Injectable()
export class AvitoErrorRecoveryService {
  private readonly logger = new Logger(AvitoErrorRecoveryService.name);

  // Error recovery configurations for different error types
  private readonly RECOVERY_STRATEGIES: Record<
    AvitoErrorType,
    ErrorRecoveryStrategy
  > = {
    [AvitoErrorType.INVALID_CREDENTIAL_FORMAT]: {
      maxRetries: 3,
      retryDelayMs: 0, // Immediate retry with user guidance
      backoffMultiplier: 1,
      userMessage:
        '❌ Неверный формат учетных данных. Пожалуйста, проверьте CLIENT_ID и CLIENT_SECRET и отправьте их в правильном формате.',
      technicalMessage: 'Invalid credential format detected during extraction',
      recoverable: true,
      requiresUserAction: true,
    },

    [AvitoErrorType.CREDENTIALS_NOT_FOUND]: {
      maxRetries: 3,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      userMessage:
        '🔍 Не удалось найти учетные данные в сообщении. Пожалуйста, предоставьте CLIENT_ID и CLIENT_SECRET в поддерживаемом формате.',
      technicalMessage: 'No credentials found in user message',
      recoverable: true,
      requiresUserAction: true,
    },

    [AvitoErrorType.API_AUTHENTICATION_FAILED]: {
      maxRetries: 2,
      retryDelayMs: 1000,
      backoffMultiplier: 2,
      userMessage:
        '🔐 Ошибка аутентификации API. Проверьте правильность CLIENT_ID и CLIENT_SECRET. Возможно, они истекли или были изменены.',
      technicalMessage: 'Avito API authentication failed',
      recoverable: true,
      requiresUserAction: true,
    },

    [AvitoErrorType.API_RATE_LIMITED]: {
      maxRetries: 5,
      retryDelayMs: 5000,
      backoffMultiplier: 2,
      userMessage:
        '⏳ API Avito временно ограничил количество запросов. Повторяю попытку через несколько секунд...',
      technicalMessage: 'Avito API rate limit exceeded',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.API_SERVER_ERROR]: {
      maxRetries: 3,
      retryDelayMs: 2000,
      backoffMultiplier: 2,
      userMessage: '🔧 Временная ошибка сервера Avito. Повторяю попытку...',
      technicalMessage: 'Avito API server error (5xx)',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.API_NETWORK_ERROR]: {
      maxRetries: 3,
      retryDelayMs: 3000,
      backoffMultiplier: 1.5,
      userMessage:
        '🌐 Ошибка сетевого соединения. Проверьте подключение к интернету.',
      technicalMessage: 'Network connectivity error',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.API_TIMEOUT]: {
      maxRetries: 2,
      retryDelayMs: 5000,
      backoffMultiplier: 2,
      userMessage:
        '⏰ Превышено время ожидания ответа от API Avito. Повторяю попытку...',
      technicalMessage: 'API request timeout',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.API]: {
      maxRetries: 3,
      retryDelayMs: 2000,
      backoffMultiplier: 2,
      userMessage: '🔧 Ошибка API Avito. Повторяю попытку...',
      technicalMessage: 'General API error',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.STORAGE_FAILURE]: {
      maxRetries: 3,
      retryDelayMs: 1000,
      backoffMultiplier: 2,
      userMessage: '💾 Ошибка при сохранении данных. Повторяю попытку...',
      technicalMessage: 'Database storage operation failed',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.WORKFLOW_TIMEOUT]: {
      maxRetries: 0,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      userMessage:
        '⏰ Превышено время выполнения операции. Пожалуйста, начните заново.',
      technicalMessage: 'Workflow execution timeout exceeded',
      recoverable: false,
      requiresUserAction: true,
    },

    [AvitoErrorType.MAX_ATTEMPTS_EXCEEDED]: {
      maxRetries: 0,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      userMessage:
        '🚫 Превышено максимальное количество попыток. Пожалуйста, обратитесь в поддержку или попробуйте позже.',
      technicalMessage: 'Maximum retry attempts exceeded',
      recoverable: false,
      requiresUserAction: true,
    },

    [AvitoErrorType.INVALID_STATE_TRANSITION]: {
      maxRetries: 0,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      userMessage: '⚠️ Неверное состояние процесса. Начинаю заново...',
      technicalMessage: 'Invalid workflow state transition attempted',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.DUPLICATE_CREDENTIALS]: {
      maxRetries: 0,
      retryDelayMs: 0,
      backoffMultiplier: 1,
      userMessage: '⚠️ Учетные данные уже настроены. Хотите обновить их?',
      technicalMessage: 'Credentials already exist for this workspace',
      recoverable: true,
      requiresUserAction: true,
    },

    [AvitoErrorType.ENCRYPTION_FAILURE]: {
      maxRetries: 2,
      retryDelayMs: 500,
      backoffMultiplier: 2,
      userMessage: '🔐 Ошибка шифрования данных. Повторяю попытку...',
      technicalMessage: 'Credential encryption failed',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.SYSTEM_UNAVAILABLE]: {
      maxRetries: 1,
      retryDelayMs: 10000,
      backoffMultiplier: 1,
      userMessage: '🔧 Система временно недоступна. Повторяю попытку...',
      technicalMessage: 'System components unavailable',
      recoverable: true,
      requiresUserAction: false,
    },

    [AvitoErrorType.UNKNOWN_ERROR]: {
      maxRetries: 1,
      retryDelayMs: 2000,
      backoffMultiplier: 1,
      userMessage: '❓ Неизвестная ошибка. Попробую еще раз...',
      technicalMessage: 'Unclassified error occurred',
      recoverable: true,
      requiresUserAction: false,
    },
  };

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Classify error and determine appropriate recovery strategy
   */
  classifyError(
    error: Error | string,
    context: {
      userId: string;
      workspaceId: string;
      threadId: string;
      workflowState: AvitoWorkflowState;
      attemptCount: number;
    },
  ): AvitoErrorDetails {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorCode = (error as any)?.code || '';

    let errorType = AvitoErrorType.UNKNOWN_ERROR;

    // Classify error based on patterns
    if (
      errorMessage.includes('credential') &&
      errorMessage.includes('format')
    ) {
      errorType = AvitoErrorType.INVALID_CREDENTIAL_FORMAT;
    } else if (
      errorMessage.includes('credentials') &&
      errorMessage.includes('not found')
    ) {
      errorType = AvitoErrorType.CREDENTIALS_NOT_FOUND;
    } else if (
      errorMessage.includes('401') ||
      errorMessage.includes('authentication')
    ) {
      errorType = AvitoErrorType.API_AUTHENTICATION_FAILED;
    } else if (
      errorMessage.includes('429') ||
      errorMessage.includes('rate limit')
    ) {
      errorType = AvitoErrorType.API_RATE_LIMITED;
    } else if (
      errorMessage.match(/5\d\d/) ||
      errorMessage.includes('server error')
    ) {
      errorType = AvitoErrorType.API_SERVER_ERROR;
    } else if (
      errorCode.includes('ECONNREFUSED') ||
      errorCode.includes('ENOTFOUND') ||
      errorMessage.includes('network')
    ) {
      errorType = AvitoErrorType.API_NETWORK_ERROR;
    } else if (
      errorMessage.includes('timeout') ||
      errorCode.includes('ETIMEDOUT')
    ) {
      errorType = AvitoErrorType.API_TIMEOUT;
    } else if (
      errorMessage.includes('storage') ||
      errorMessage.includes('database')
    ) {
      errorType = AvitoErrorType.STORAGE_FAILURE;
    } else if (errorMessage.includes('workflow timeout')) {
      errorType = AvitoErrorType.WORKFLOW_TIMEOUT;
    } else if (
      errorMessage.includes('max attempts') ||
      errorMessage.includes('maximum retries')
    ) {
      errorType = AvitoErrorType.MAX_ATTEMPTS_EXCEEDED;
    } else if (errorMessage.includes('invalid state transition')) {
      errorType = AvitoErrorType.INVALID_STATE_TRANSITION;
    } else if (errorMessage.includes('encryption')) {
      errorType = AvitoErrorType.ENCRYPTION_FAILURE;
    } else if (errorMessage.includes('system unavailable')) {
      errorType = AvitoErrorType.SYSTEM_UNAVAILABLE;
    }

    this.logger.warn(`Classified error as ${errorType}: ${errorMessage}`);

    return {
      errorType,
      originalError: error,
      context: {
        ...context,
        timestamp: new Date(),
      },
      recoveryStrategy: this.RECOVERY_STRATEGIES[errorType],
      metadata: {
        errorCode,
        stackTrace: error instanceof Error ? error.stack : undefined,
      },
    };
  }

  /**
   * Execute recovery strategy for the given error
   */
  async executeRecovery(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    const { errorType, recoveryStrategy, context } = errorDetails;

    this.logger.log(
      `Executing recovery for ${errorType} - attempt ${context.attemptCount}/${recoveryStrategy.maxRetries}`,
    );

    // Emit recovery event for monitoring
    this.eventEmitter.emit('avito.error.recovery.started', {
      errorType,
      userId: context.userId,
      workspaceId: context.workspaceId,
      attemptCount: context.attemptCount,
      timestamp: new Date(),
    });

    try {
      // Check if we've exceeded max retries
      if (
        context.attemptCount >= recoveryStrategy.maxRetries &&
        recoveryStrategy.maxRetries > 0
      ) {
        return this.handleMaxRetriesExceeded(errorDetails, workflowContext);
      }

      // Execute recovery based on error type
      const result = await this.executeSpecificRecovery(
        errorDetails,
        workflowContext,
      );

      // Emit success event
      this.eventEmitter.emit('avito.error.recovery.succeeded', {
        errorType,
        userId: context.userId,
        workspaceId: context.workspaceId,
        recoveryResult: result,
        timestamp: new Date(),
      });

      return result;
    } catch (recoveryError) {
      this.logger.error(
        `Recovery execution failed for ${errorType}:`,
        recoveryError,
      );

      // Emit failure event
      this.eventEmitter.emit('avito.error.recovery.failed', {
        errorType,
        userId: context.userId,
        workspaceId: context.workspaceId,
        originalError: errorDetails.originalError,
        recoveryError: recoveryError.message,
        timestamp: new Date(),
      });

      return {
        success: false,
        message:
          'Ошибка при выполнении восстановления. Попробуйте начать заново.',
        requiresUserInput: true,
      };
    }
  }

  /**
   * Execute specific recovery strategies based on error type
   */
  private async executeSpecificRecovery(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    const { errorType, recoveryStrategy } = errorDetails;

    switch (errorType) {
      case AvitoErrorType.INVALID_CREDENTIAL_FORMAT:
      case AvitoErrorType.CREDENTIALS_NOT_FOUND:
        return this.recoverFromCredentialError(errorDetails, workflowContext);

      case AvitoErrorType.API_AUTHENTICATION_FAILED:
        return this.recoverFromAuthError(errorDetails, workflowContext);

      case AvitoErrorType.API_RATE_LIMITED:
      case AvitoErrorType.API_SERVER_ERROR:
      case AvitoErrorType.API_NETWORK_ERROR:
      case AvitoErrorType.API_TIMEOUT:
        return this.recoverFromAPIError(errorDetails, workflowContext);

      case AvitoErrorType.STORAGE_FAILURE:
        return this.recoverFromStorageError(errorDetails, workflowContext);

      case AvitoErrorType.INVALID_STATE_TRANSITION:
        return this.recoverFromStateError(errorDetails, workflowContext);

      case AvitoErrorType.WORKFLOW_TIMEOUT:
        return this.recoverFromTimeoutError(errorDetails, workflowContext);

      default:
        return {
          success: false,
          message: recoveryStrategy.userMessage,
          requiresUserInput: recoveryStrategy.requiresUserAction,
          retryAfterMs: recoveryStrategy.retryDelayMs,
        };
    }
  }

  /**
   * Recovery strategies for different error types
   */
  private async recoverFromCredentialError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    // Reset to credential awaiting state
    const newState = AvitoWorkflowState.AWAITING_CREDENTIALS;

    return {
      success: true,
      newState,
      message: errorDetails.recoveryStrategy.userMessage,
      requiresUserInput: true,
    };
  }

  private async recoverFromAuthError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    // Clear any stored invalid credentials and request new ones
    await this.clearStoredCredentials(
      workflowContext.userId,
      workflowContext.workspaceId,
    );

    return {
      success: true,
      newState: AvitoWorkflowState.AWAITING_CREDENTIALS,
      message: errorDetails.recoveryStrategy.userMessage,
      requiresUserInput: true,
    };
  }

  private async recoverFromAPIError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    const { recoveryStrategy } = errorDetails;

    // For retryable API errors, stay in current state and retry
    return {
      success: true,
      message: recoveryStrategy.userMessage,
      requiresUserInput: false,
      retryAfterMs: recoveryStrategy.retryDelayMs,
    };
  }

  private async recoverFromStorageError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    // Retry storage operation
    return {
      success: true,
      message: errorDetails.recoveryStrategy.userMessage,
      requiresUserInput: false,
      retryAfterMs: errorDetails.recoveryStrategy.retryDelayMs,
    };
  }

  private async recoverFromStateError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    // Reset to initial state
    return {
      success: true,
      newState: AvitoWorkflowState.INIT,
      message: 'Перезапускаю процесс с начала...',
      requiresUserInput: false,
    };
  }

  private async recoverFromTimeoutError(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    // Clear context and start fresh
    await this.clearWorkflowContext(
      workflowContext.userId,
      workflowContext.workspaceId,
      workflowContext.threadId,
    );

    return {
      success: false,
      newState: AvitoWorkflowState.INIT,
      message: errorDetails.recoveryStrategy.userMessage,
      requiresUserInput: true,
    };
  }

  /**
   * Handle maximum retries exceeded
   */
  private async handleMaxRetriesExceeded(
    errorDetails: AvitoErrorDetails,
    workflowContext: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    this.logger.error(`Max retries exceeded for ${errorDetails.errorType}`);

    // Execute fallback if available
    if (errorDetails.recoveryStrategy.fallbackAction) {
      try {
        await errorDetails.recoveryStrategy.fallbackAction();

        return {
          success: true,
          message: 'Использован резервный способ восстановления.',
          fallbackExecuted: true,
          requiresUserInput: false,
        };
      } catch (fallbackError) {
        this.logger.error('Fallback action failed:', fallbackError);
      }
    }

    return {
      success: false,
      newState: AvitoWorkflowState.MAX_RETRIES_EXCEEDED,
      message:
        'Превышено максимальное количество попыток. Пожалуйста, обратитесь в поддержку.',
      requiresUserInput: true,
    };
  }

  /**
   * Helper methods for cleanup operations
   */
  private async clearStoredCredentials(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Clear potentially invalid stored credentials
      const keysToDelete = [
        'AVITO_CLIENT_ID',
        'AVITO_CLIENT_SECRET',
        'AVITO_ACCESS_TOKEN',
        'AVITO_TOKEN_EXPIRES_AT',
        'AVITO_CREDENTIALS_STORED',
      ];

      for (const key of keysToDelete) {
        try {
          await this.userVarsService.delete({ userId, workspaceId, key });
        } catch (error) {
          // Ignore deletion errors for non-existent keys
        }
      }

      this.logger.log('Cleared stored Avito credentials');
    } catch (error) {
      this.logger.warn('Failed to clear stored credentials:', error);
    }
  }

  private async clearWorkflowContext(
    userId: string,
    workspaceId: string,
    threadId: string,
  ): Promise<void> {
    try {
      const contextKey = `avito_workflow_context_${userId}_${workspaceId}_${threadId}`;

      await this.userVarsService.delete({
        userId,
        workspaceId,
        key: contextKey,
      });
      this.logger.log('Cleared workflow context');
    } catch (error) {
      this.logger.warn('Failed to clear workflow context:', error);
    }
  }

  /**
   * Get recovery statistics for monitoring
   */
  getRecoveryStatistics(): {
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    errorTypeFrequency: Record<AvitoErrorType, number>;
  } {
    // TODO: Implement proper statistics collection
    return {
      totalRecoveries: 0,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      errorTypeFrequency: {} as Record<AvitoErrorType, number>,
    };
  }

  // ===============================================================
  // ENHANCED PROPERTIES (Consolidated from duplicate services)
  // ===============================================================

  private errorHistory = new Map<
    string,
    Array<{
      errorType: AvitoErrorType;
      timestamp: Date;
      context: string;
      resolved: boolean;
      resolutionMethod?: string;
    }>
  >();

  private escalatedErrors = new Set<string>();

  // ===============================================================
  // ENHANCED METHODS (Consolidated from duplicate services)
  // ===============================================================

  /**
   * ENHANCED: Comprehensive error classification with severity levels
   * Extracted from: AvitoWorkflowErrorRecoveryService
   */
  classifyErrorWithSeverity(
    error: any,
    context?: AvitoWorkflowContext,
  ): {
    errorType: AvitoErrorType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    recoverable: boolean;
    escalationRequired: boolean;
    priority: number;
  } {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || error.status;

    // Credential format errors
    if (
      errorMessage.includes('format') ||
      errorMessage.includes('invalid credential')
    ) {
      return {
        errorType: AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
        severity: 'LOW',
        recoverable: true,
        escalationRequired: false,
        priority: 1,
      };
    }

    // Authentication failures
    if (errorCode === 401 || errorMessage.includes('authentication')) {
      return {
        errorType: AvitoErrorType.API_AUTHENTICATION_FAILED,
        severity: 'MEDIUM',
        recoverable: true,
        escalationRequired: false,
        priority: 2,
      };
    }

    // Rate limiting
    if (errorCode === 429 || errorMessage.includes('rate limit')) {
      return {
        errorType: AvitoErrorType.API_RATE_LIMITED,
        severity: 'MEDIUM',
        recoverable: true,
        escalationRequired: false,
        priority: 2,
      };
    }

    // Server errors
    if (errorCode >= 500 || errorMessage.includes('server error')) {
      return {
        errorType: AvitoErrorType.API_SERVER_ERROR,
        severity: 'HIGH',
        recoverable: true,
        escalationRequired: false,
        priority: 3,
      };
    }

    // Storage failures
    if (
      errorMessage.includes('storage') ||
      errorMessage.includes('encryption')
    ) {
      return {
        errorType: AvitoErrorType.STORAGE_FAILURE,
        severity: 'HIGH',
        recoverable: true,
        escalationRequired: true,
        priority: 4,
      };
    }

    // System failures
    if (
      errorMessage.includes('system') ||
      errorMessage.includes('memory') ||
      errorMessage.includes('resource')
    ) {
      return {
        errorType: AvitoErrorType.SYSTEM_UNAVAILABLE,
        severity: 'CRITICAL',
        recoverable: false,
        escalationRequired: true,
        priority: 5,
      };
    }

    // Workflow timeouts
    if (context && context.timeoutAt && new Date() > context.timeoutAt) {
      return {
        errorType: AvitoErrorType.WORKFLOW_TIMEOUT,
        severity: 'MEDIUM',
        recoverable: false,
        escalationRequired: false,
        priority: 2,
      };
    }

    // Default classification
    return {
      errorType: AvitoErrorType.UNKNOWN_ERROR,
      severity: 'HIGH',
      recoverable: false,
      escalationRequired: true,
      priority: 4,
    };
  }

  /**
   * ENHANCED: Advanced error tracking with history
   * Extracted from: AvitoWorkflowErrorRecoveryService
   */
  trackError(
    userId: string,
    workspaceId: string,
    errorType: AvitoErrorType,
    context: string,
    resolved = false,
    resolutionMethod?: string,
  ): void {
    const userKey = `${userId}_${workspaceId}`;

    if (!this.errorHistory.has(userKey)) {
      this.errorHistory.set(userKey, []);
    }

    const userErrors = this.errorHistory.get(userKey)!;

    userErrors.push({
      errorType,
      timestamp: new Date(),
      context,
      resolved,
      resolutionMethod,
    });

    // Keep only last 50 errors per user
    if (userErrors.length > 50) {
      userErrors.splice(0, userErrors.length - 50);
    }

    this.logger.log(
      `Error tracked for user ${userId}: ${errorType} (resolved: ${resolved})`,
    );
  }

  /**
   * ENHANCED: Error pattern analysis for predictive recovery
   * Extracted from: AvitoWorkflowErrorRecoveryService
   */
  analyzeErrorPatterns(
    userId: string,
    workspaceId: string,
  ): {
    frequentErrors: Array<{ errorType: AvitoErrorType; count: number }>;
    recoverySuccess: number;
    escalationRate: number;
    recommendations: string[];
  } {
    const userKey = `${userId}_${workspaceId}`;
    const userErrors = this.errorHistory.get(userKey) || [];

    if (userErrors.length === 0) {
      return {
        frequentErrors: [],
        recoverySuccess: 0,
        escalationRate: 0,
        recommendations: ['No error history available'],
      };
    }

    // Count error types
    const errorCounts = new Map<AvitoErrorType, number>();
    let resolvedCount = 0;

    userErrors.forEach((error) => {
      errorCounts.set(
        error.errorType,
        (errorCounts.get(error.errorType) || 0) + 1,
      );
      if (error.resolved) resolvedCount++;
    });

    const frequentErrors = Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({ errorType, count }))
      .sort((a, b) => b.count - a.count);

    const recoverySuccess =
      userErrors.length > 0 ? resolvedCount / userErrors.length : 0;
    const escalationRate =
      this.escalatedErrors.size / Math.max(userErrors.length, 1);

    // Generate recommendations
    const recommendations: string[] = [];

    if (
      frequentErrors[0]?.errorType === AvitoErrorType.INVALID_CREDENTIAL_FORMAT
    ) {
      recommendations.push(
        'Consider providing credential format examples proactively',
      );
    }

    if (
      frequentErrors[0]?.errorType === AvitoErrorType.API_AUTHENTICATION_FAILED
    ) {
      recommendations.push('Suggest credential verification process');
    }

    if (recoverySuccess < 0.7) {
      recommendations.push(
        'Low recovery success rate - consider additional fallback mechanisms',
      );
    }

    if (escalationRate > 0.3) {
      recommendations.push('High escalation rate - review recovery strategies');
    }

    return {
      frequentErrors,
      recoverySuccess,
      escalationRate,
      recommendations,
    };
  }

  /**
   * ENHANCED: Automated escalation handling
   * Extracted from: AvitoWorkflowErrorRecoveryService
   */
  async handleEscalation(
    errorDetails: AvitoErrorDetails,
    context: AvitoWorkflowContext,
  ): Promise<{
    escalated: boolean;
    escalationId?: string;
    supportNotified: boolean;
    userNotified: boolean;
  }> {
    const escalationId = `escalation_${Date.now()}_${errorDetails.context.userId}`;

    if (this.escalatedErrors.has(escalationId)) {
      return {
        escalated: false,
        supportNotified: false,
        userNotified: false,
      };
    }

    this.escalatedErrors.add(escalationId);

    try {
      // Emit escalation event
      this.eventEmitter.emit('error.escalation', {
        escalationId,
        errorType: errorDetails.errorType,
        severity: 'HIGH',
        userId: errorDetails.context.userId,
        workspaceId: errorDetails.context.workspaceId,
        context: errorDetails.context,
        timestamp: new Date(),
      });

      this.logger.error(`Error escalated: ${escalationId}`, {
        errorType: errorDetails.errorType,
        userId: errorDetails.context.userId,
        workspaceId: errorDetails.context.workspaceId,
      });

      // Track escalation
      this.trackError(
        errorDetails.context.userId,
        errorDetails.context.workspaceId,
        errorDetails.errorType,
        'escalated',
        false,
      );

      return {
        escalated: true,
        escalationId,
        supportNotified: true,
        userNotified: true,
      };
    } catch (error) {
      this.logger.error('Failed to handle escalation:', error);

      return {
        escalated: false,
        supportNotified: false,
        userNotified: false,
      };
    }
  }

  /**
   * ENHANCED: Comprehensive recovery metrics
   * Extracted from: AvitoWorkflowErrorRecoveryService
   */
  getEnhancedRecoveryStatistics(): {
    totalErrors: number;
    errorsByType: Record<AvitoErrorType, number>;
    errorsBySeverity: Record<string, number>;
    recoverySuccessRate: number;
    escalationRate: number;
    averageRecoveryTime: number;
    activeEscalations: number;
  } {
    let totalErrors = 0;
    const errorsByType: Record<AvitoErrorType, number> = {} as Record<
      AvitoErrorType,
      number
    >;
    const errorsBySeverity: Record<string, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    let resolvedErrors = 0;

    // Aggregate statistics from all users
    this.errorHistory.forEach((userErrors) => {
      userErrors.forEach((error) => {
        totalErrors++;
        errorsByType[error.errorType] =
          (errorsByType[error.errorType] || 0) + 1;

        if (error.resolved) {
          resolvedErrors++;
        }

        // Classify severity for statistics
        const classification = this.classifyErrorWithSeverity({
          message: error.errorType,
        });

        errorsBySeverity[classification.severity]++;
      });
    });

    const recoverySuccessRate =
      totalErrors > 0 ? resolvedErrors / totalErrors : 0;
    const escalationRate = this.escalatedErrors.size / Math.max(totalErrors, 1);

    return {
      totalErrors,
      errorsByType,
      errorsBySeverity,
      recoverySuccessRate,
      escalationRate,
      averageRecoveryTime: 0, // TODO: Implement timing tracking
      activeEscalations: this.escalatedErrors.size,
    };
  }

  /**
   * Get recovery strategy for a specific error type (required by tests)
   */
  getRecoveryStrategy(errorType: AvitoErrorType): ErrorRecoveryStrategy {
    return (
      this.RECOVERY_STRATEGIES[errorType] ||
      this.RECOVERY_STRATEGIES[AvitoErrorType.UNKNOWN_ERROR]
    );
  }

  /**
   * Execute error recovery process (required by tests)
   */
  async recoverFromError(
    errorDetails: AvitoErrorDetails,
    context: AvitoWorkflowContext,
  ): Promise<RecoveryResult> {
    try {
      const strategy = this.getRecoveryStrategy(errorDetails.errorType);

      if (!strategy.recoverable) {
        return {
          success: false,
          message: strategy.userMessage,
          requiresUserInput: strategy.requiresUserAction,
        };
      }

      // Apply recovery strategy
      const shouldRetry =
        errorDetails.context.attemptCount < strategy.maxRetries;

      if (shouldRetry) {
        const retryDelay =
          strategy.retryDelayMs *
          Math.pow(
            strategy.backoffMultiplier,
            errorDetails.context.attemptCount,
          );

        return {
          success: true,
          message: strategy.userMessage,
          requiresUserInput: strategy.requiresUserAction,
          retryAfterMs: retryDelay,
        };
      } else {
        // Max retries exceeded - escalate
        const escalationResult = await this.handleEscalation(
          errorDetails,
          context,
        );

        return {
          success: false,
          message: 'Maximum recovery attempts exceeded',
          requiresUserInput: true,
          fallbackExecuted: escalationResult.escalated,
        };
      }
    } catch (error) {
      this.logger.error('Error recovery failed:', error);

      return {
        success: false,
        message: 'Recovery process failed',
        requiresUserInput: true,
      };
    }
  }

  /**
   * Check if error should be escalated (required by tests)
   */
  shouldEscalateError(
    userId: string,
    workspaceId: string,
    criteria: {
      errorType: AvitoErrorType;
      attemptCount: number;
      timeWindow?: number;
    },
  ): boolean {
    const userKey = `${userId}_${workspaceId}`;
    const userErrors = this.errorHistory.get(userKey) || [];

    // Immediate escalation criteria
    if (criteria.errorType === AvitoErrorType.SYSTEM_UNAVAILABLE) {
      return true;
    }

    if (criteria.attemptCount >= 5) {
      return true;
    }

    // Pattern-based escalation
    const recentErrors = userErrors.filter((error) => {
      const timeDiff = Date.now() - error.timestamp.getTime();

      return timeDiff < (criteria.timeWindow || 3600000); // Default 1 hour
    });

    if (recentErrors.length >= 3) {
      return true;
    }

    return false;
  }

  /**
   * Get optimized recovery strategy based on user history (required by tests)
   */
  getOptimizedRecoveryStrategy(
    errorType: AvitoErrorType,
    userId: string,
    workspaceId: string,
  ): ErrorRecoveryStrategy {
    const baseStrategy = this.getRecoveryStrategy(errorType);
    const analysis = this.analyzeErrorPatterns(userId, workspaceId);

    // If user has frequent errors of this type, adjust strategy
    const frequentError = analysis.frequentErrors.find(
      (e) => e.errorType === errorType,
    );

    if (frequentError && frequentError.count > 3) {
      // Reduce retries and increase user guidance for frequent errors
      return {
        ...baseStrategy,
        maxRetries: Math.max(1, baseStrategy.maxRetries - 1),
        requiresUserAction: true,
        userMessage: `${baseStrategy.userMessage} (Частая ошибка - рекомендуем проверить настройки)`,
      };
    }

    return baseStrategy;
  }
}
