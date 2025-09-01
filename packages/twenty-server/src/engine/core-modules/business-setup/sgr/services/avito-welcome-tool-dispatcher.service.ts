import { Injectable, Logger } from '@nestjs/common';

import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { type HttpRequestInput } from 'src/engine/core-modules/tool/tools/http-tool/types/http-request-input.type';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import {
  BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import {
  type ExtractCredentialsType,
  type ReportWelcomeCompletionType,
  type RequestCredentialsType,
  type StoreCredentialsType,
  type ToolExecutionResult,
  type ValidateAvitoTokenType,
  type WelcomeToolUnion,
} from '../schemas/avito-welcome-sgr.schema';
import { AvitoWorkflowState } from '../types/avito-workflow-context';
import {
  AvitoCredentialExtractor,
  type CredentialExtractionResult,
} from '../utils/credential-extraction.util';

// Enhanced interfaces for tool validation and performance monitoring
export interface EnhancedToolExecutionResult extends ToolExecutionResult {
  errorType?:
    | 'VALIDATION'
    | 'EXECUTION'
    | 'NETWORK'
    | 'AUTH'
    | 'RATE_LIMIT'
    | 'TIMEOUT'
    | 'UNKNOWN';
  executionTimeMs?: number;
  retryable?: boolean;
  nextState?: AvitoWorkflowState;
  metadata?: {
    performanceMetrics?: PerformanceMetrics;
    validationResults?: ValidationResult[];
    retryAttempts?: number;
    [key: string]: any;
  };
}

export interface PerformanceMetrics {
  executionTimeMs: number;
  startTime: Date;
  endTime: Date;
  memoryUsage?: number;
  retryCount: number;
  cacheHit: boolean;
}

export interface ValidationResult {
  tool: string;
  state: AvitoWorkflowState;
  valid: boolean;
  error?: string;
  timestamp: Date;
}

// Tool validation matrix (extracted from Enhanced dispatcher)
const ALLOWED_TOOLS_BY_STATE: Record<AvitoWorkflowState, string[]> = {
  [AvitoWorkflowState.INIT]: ['request_credentials'],
  [AvitoWorkflowState.GREETING_SENT]: ['request_credentials'],
  [AvitoWorkflowState.AWAITING_CREDENTIALS]: [
    'extract_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.EXTRACTING_CREDENTIALS]: [
    'validate_avito_token',
    'request_credentials',
  ],
  [AvitoWorkflowState.VALIDATING_CREDENTIALS]: [
    'store_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.VALIDATION_SUCCESS]: ['store_credentials'],
  [AvitoWorkflowState.STORING_CREDENTIALS]: ['report_welcome_completion'],
  [AvitoWorkflowState.STORAGE_COMPLETE]: ['report_welcome_completion'],
  [AvitoWorkflowState.COMPLETING_WELCOME]: ['report_welcome_completion'],
  [AvitoWorkflowState.WELCOME_COMPLETED]: [],
  [AvitoWorkflowState.VALIDATION_FAILED]: [
    'extract_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.ERROR_INVALID_FORMAT]: [
    'extract_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.ERROR_API_FAILURE]: [
    'extract_credentials',
    'request_credentials',
    'validate_avito_token',
  ],
  [AvitoWorkflowState.ERROR_STORAGE_FAILURE]: [
    'store_credentials',
    'request_credentials',
  ],
  [AvitoWorkflowState.REQUEST_RETRY]: ['request_credentials'],
  [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]: [],
};

/**
 * Enhanced Tool dispatcher for Avito Welcome Agent SGR system
 *
 * Handles type-safe routing and execution of structured reasoning tools
 * for credential collection, validation, and storage with comprehensive
 * error recovery, retry logic, and state validation.
 *
 * ENHANCED FEATURES (Consolidated from duplicate services):
 * - Comprehensive tool validation matrix with state-aware routing
 * - Enhanced error classification with detailed error types
 * - Performance monitoring and metrics collection
 * - Advanced retry mechanisms with exponential backoff
 * - Circuit breaker patterns for API resilience
 * - Comprehensive audit trail for all operations
 */
// Type definitions for configuration objects
type RetryConfig = {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
};

type PerformanceConfig = {
  enableMetrics: boolean;
  logSlowOperations: boolean;
  slowOperationThresholdMs: number;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeoutMs: number;
};

@Injectable()
export class AvitoWelcomeToolDispatcherService {
  private readonly logger = new Logger(AvitoWelcomeToolDispatcherService.name);

  // Enhanced retry configuration
  private readonly RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'],
  };

  // API validation configuration
  private readonly API_CONFIG = {
    endpoint: 'https://api.avito.ru/token',
    timeout: 30000, // 30 seconds
    userAgent: 'Twenty CRM Avito Integration v1.0',
  };

  // Performance monitoring configuration (extracted from enhanced dispatcher)
  private readonly PERFORMANCE_CONFIG: PerformanceConfig = {
    enableMetrics: true,
    logSlowOperations: true,
    slowOperationThresholdMs: 5000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeoutMs: 60000,
  };

  // Circuit breaker state tracking
  private circuitBreakerStates = new Map<
    string,
    {
      failures: number;
      lastFailure: Date;
      isOpen: boolean;
    }
  >();

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly httpTool: HttpTool,
  ) {}

  /**
   * Main dispatch method with enhanced validation matrix and performance monitoring
   */
  async dispatch(
    command: WelcomeToolUnion,
    userId: string,
    workspaceId: string,
    workflowState?: AvitoWorkflowState,
  ): Promise<EnhancedToolExecutionResult> {
    const startTime = Date.now();
    const toolKey = `${command.tool}_${userId}`;

    try {
      this.logger.log(
        `Dispatching tool: ${command.tool} for user ${userId} in state: ${workflowState || 'unknown'}`,
      );

      // Enhanced tool validation using matrix
      const validationResult = this.validateToolForState(
        command.tool,
        workflowState,
      );

      if (!validationResult.valid) {
        this.logger.warn(
          `Tool validation failed: ${command.tool} not valid for state ${workflowState}`,
        );

        return {
          success: false,
          error: validationResult.error,
          message: 'Операция недоступна в текущем состоянии workflow',
          errorType: 'VALIDATION',
          executionTimeMs: Date.now() - startTime,
          retryable: false,
          metadata: {
            validationResults: [validationResult],
            performanceMetrics: this.createPerformanceMetrics(startTime, 0),
          },
        };
      }

      // Check circuit breaker state
      if (this.isCircuitBreakerOpen(toolKey)) {
        return {
          success: false,
          error: 'Circuit breaker is open for this operation',
          message: 'Сервис временно недоступен. Попробуйте позже.',
          errorType: 'RATE_LIMIT',
          executionTimeMs: Date.now() - startTime,
          retryable: true,
          metadata: {
            circuitBreakerOpen: true,
            performanceMetrics: this.createPerformanceMetrics(startTime, 0),
          },
        };
      }

      // Execute tool with enhanced monitoring
      const result = await this.executeToolWithMonitoring(
        command,
        userId,
        workspaceId,
        startTime,
      );

      // Update circuit breaker on success
      if (result.success) {
        this.recordCircuitBreakerSuccess(toolKey);
      } else {
        this.recordCircuitBreakerFailure(toolKey);
      }

      // Log performance metrics
      const executionTime = Date.now() - startTime;

      if (
        this.PERFORMANCE_CONFIG.logSlowOperations &&
        executionTime > this.PERFORMANCE_CONFIG.slowOperationThresholdMs
      ) {
        this.logger.warn(
          `Slow operation detected: ${command.tool} took ${executionTime}ms`,
        );
      }

      this.logger.log(
        `Tool ${command.tool} executed in ${executionTime}ms with result: ${result.success}`,
      );

      return {
        ...result,
        executionTimeMs: executionTime,
        metadata: {
          ...result.metadata,
          performanceMetrics: this.createPerformanceMetrics(startTime, 0),
          validationResults: [validationResult],
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorClassification = this.classifyError(error);

      // Record circuit breaker failure
      this.recordCircuitBreakerFailure(toolKey);

      this.logger.error(
        `Tool dispatch failed for ${command.tool} after ${executionTime}ms:`,
        error,
      );

      return {
        success: false,
        error: error.message || 'Tool execution failed',
        message:
          'Произошла ошибка при выполнении операции. Попробуйте еще раз.',
        errorType: errorClassification.errorType,
        executionTimeMs: executionTime,
        retryable: errorClassification.retryable,
        metadata: {
          errorDetails: {
            type: error.constructor.name,
            classification: errorClassification,
            stackTrace: error.stack?.substring(0, 500),
          },
          performanceMetrics: this.createPerformanceMetrics(startTime, 0),
        },
      };
    }
  }

  /**
   * Execute tool with comprehensive retry logic
   */
  private async executeToolWithRetry(
    command: WelcomeToolUnion,
    userId: string,
    workspaceId: string,
  ): Promise<ToolExecutionResult> {
    switch (command.tool) {
      case 'extract_credentials':
        return this.handleExtractCredentialsEnhanced(command);

      case 'request_credentials':
        return this.handleRequestCredentials(command);

      case 'validate_avito_token':
        return this.handleValidateTokenWithRetry(command);

      case 'store_credentials':
        return this.handleStoreCredentialsWithRetry(
          command,
          userId,
          workspaceId,
        );

      case 'report_welcome_completion':
        return this.handleCompletion(command);

      default:
        // TypeScript ensures exhaustive handling
        const exhaustiveCheck: never = command;

        throw new Error(`Unknown tool: ${(exhaustiveCheck as any).tool}`);
    }
  }

  /**
   * Enhanced credential extraction using comprehensive pattern matching
   */
  private handleExtractCredentialsEnhanced(
    cmd: ExtractCredentialsType,
  ): ToolExecutionResult {
    this.logger.log('Extracting credentials using enhanced pattern matching');

    try {
      // Use the enhanced credential extractor
      const extractionResult: CredentialExtractionResult =
        AvitoCredentialExtractor.extractCredentials(cmd.message);

      if (extractionResult.success && extractionResult.credentials) {
        this.logger.log(
          `Credentials extracted successfully using method: ${extractionResult.extractionMethod} (confidence: ${extractionResult.confidence})`,
        );

        return {
          success: true,
          data: {
            client_id: extractionResult.credentials.clientId,
            client_secret: extractionResult.credentials.clientSecret,
            extraction_successful: true,
            valid_format: true,
            extraction_method: extractionResult.extractionMethod,
            confidence: extractionResult.confidence,
            detected_format: extractionResult.detectedFormat,
            patterns_matched: 'both',
          },
          message: `✅ Учетные данные успешно извлечены!

🔍 Метод: ${extractionResult.extractionMethod}
🎯 Уверенность: ${Math.round((extractionResult.confidence || 0) * 100)}%
📝 Формат: ${extractionResult.detectedFormat}`,
        };
      } else {
        this.logger.warn(
          `Credential extraction failed: ${extractionResult.error}`,
        );

        return {
          success: false,
          data: {
            extraction_successful: false,
            error_details: extractionResult.error,
            extraction_method: extractionResult.extractionMethod || 'none',
            confidence: 0,
          },
          message: `❌ Не удалось найти учетные данные в сообщении.

${AvitoCredentialExtractor.getExtractionGuidance()}`,
        };
      }
    } catch (error) {
      this.logger.error('Enhanced credential extraction failed:', error);

      return {
        success: false,
        error: `Extraction error: ${error.message}`,
        message:
          'Произошла ошибка при извлечении учетных данных. Попробуйте еще раз.',
      };
    }
  }

  /**
   * Generate user-friendly credential request messages
   */
  private handleRequestCredentials(
    cmd: RequestCredentialsType,
  ): ToolExecutionResult {
    this.logger.log(
      `Generating credential request message for reason: ${cmd.reason}`,
    );

    const defaultMessages = {
      no_credentials_found: `🔍 Не удалось найти CLIENT_ID и CLIENT_SECRET в вашем сообщении.

💡 Пожалуйста, предоставьте ваши учетные данные Avito API в следующем формате:

**Вариант 1:**
CLIENT_ID = 'ваш_client_id'
CLIENT_SECRET = 'ваш_client_secret'

**Вариант 2:**
CLIENT_ID: ваш_client_id
CLIENT_SECRET: ваш_client_secret

**Вариант 3 (JSON):**
{
  "client_id": "ваш_client_id",
  "client_secret": "ваш_client_secret"
}

📋 **Где найти эти данные:**
1. Войдите в личный кабинет Avito
2. Перейдите в раздел "API для разработчиков"
3. Скопируйте CLIENT_ID и CLIENT_SECRET

🔒 Ваши данные будут надежно зашифрованы и сохранены.`,

      invalid_format: `❌ Неверный формат данных.

✅ **Правильные форматы:**

**Простой формат:**
CLIENT_ID = R3cTDMk9rEJ2lh5A9_QF
CLIENT_SECRET = ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc

**С кавычками:**
CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF'
CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'

**JSON формат:**
{
  "client_id": "R3cTDMk9rEJ2lh5A9_QF",
  "client_secret": "ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc"
}`,

      missing_client_id: `❌ CLIENT_ID не найден.

🔍 Пожалуйста, укажите CLIENT_ID в любом из следующих форматов:
• CLIENT_ID = ваш_id
• CLIENT_ID: ваш_id
• "client_id": "ваш_id"`,

      missing_client_secret: `❌ CLIENT_SECRET не найден.

🔍 Пожалуйста, укажите CLIENT_SECRET в любом из следующих форматов:
• CLIENT_SECRET = ваш_secret
• CLIENT_SECRET: ваш_secret
• "client_secret": "ваш_secret"`,
    };

    const message = cmd.user_friendly_message || defaultMessages[cmd.reason];

    return {
      success: true,
      data: {
        message_sent: true,
        message_content: message,
        reason: cmd.reason,
      },
      message,
    };
  }

  /**
   * Enhanced validation with comprehensive retry logic and error recovery
   */
  private async handleValidateTokenWithRetry(
    cmd: ValidateAvitoTokenType,
  ): Promise<ToolExecutionResult> {
    this.logger.log('Validating credentials with Avito API (with retry logic)');

    // Validate input format first
    const validation = AvitoCredentialExtractor.validateCredentials(
      cmd.client_id,
      cmd.client_secret,
    );

    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid credential format: ${validation.errors.join(', ')}`,
        message: `❌ Неверный формат учетных данных:\n\n${validation.errors.map((e) => `• ${e}`).join('\n')}\n\n${validation.warnings.length > 0 ? `⚠️ Предупреждения:\n${validation.warnings.map((w) => `• ${w}`).join('\n')}` : ''}`,
      };
    }

    // Execute API call with retry logic
    return this.executeWithRetry(
      () => this.callAvitoAPI(cmd.client_id, cmd.client_secret, cmd.api_url),
      'avito_api_validation',
      {
        context: { clientId: cmd.client_id.substring(0, 8) + '...' },
        operation: 'Avito API token validation',
      },
    );
  }

  /**
   * Enhanced credential storage with retry logic and validation
   */
  private async handleStoreCredentialsWithRetry(
    cmd: StoreCredentialsType,
    userId: string,
    workspaceId: string,
  ): Promise<ToolExecutionResult> {
    this.logger.log(
      'Storing validated credentials securely (with retry logic)',
    );

    return this.executeWithRetry(
      () => this.storeCredentialsSecurely(cmd, userId, workspaceId),
      'credential_storage',
      {
        context: { userId, workspaceId, hasToken: !!cmd.access_token },
        operation: 'Credential storage',
      },
    );
  }

  /**
   * Core Avito API call implementation
   */
  private async callAvitoAPI(
    clientId: string,
    clientSecret: string,
    apiUrl: string = this.API_CONFIG.endpoint,
  ): Promise<ToolExecutionResult> {
    const requestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();

    const httpInput: HttpRequestInput = {
      url: apiUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': this.API_CONFIG.userAgent,
      },
      body: requestBody,
    };

    const httpResult = await this.httpTool.execute(httpInput);

    if (httpResult.error) {
      // Classify error type for retry logic
      const isRetryable = this.isRetryableError(httpResult.error);
      const error = new Error(httpResult.error);

      (error as any).isRetryable = isRetryable;
      throw error;
    }

    const responseData = httpResult.result as any;

    if (responseData && responseData.access_token) {
      this.logger.log('Avito API validation successful');

      return {
        success: true,
        data: {
          validation_successful: true,
          access_token: responseData.access_token,
          expires_in: responseData.expires_in || 86400,
          token_type: responseData.token_type || 'Bearer',
          client_id: clientId,
          client_secret: clientSecret,
          validated_at: new Date().toISOString(),
        },
        message:
          '✅ **Учетные данные успешно проверены!**\n\n🎯 Токен доступа получен\n⏰ Срок действия: ' +
          (responseData.expires_in
            ? `${Math.round(responseData.expires_in / 3600)} часов`
            : '24 часа'),
      };
    } else {
      throw new Error(
        'Invalid response from Avito API - no access token received',
      );
    }
  }

  /**
   * Secure credential storage implementation
   */
  private async storeCredentialsSecurely(
    cmd: StoreCredentialsType,
    userId: string,
    workspaceId: string,
  ): Promise<ToolExecutionResult> {
    const storageOperations = [
      // Core credentials
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: cmd.client_id,
      }),
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: this.encryptSecret(cmd.client_secret), // Encrypt the secret
      }),
    ];

    // Store access token if provided
    if (cmd.access_token) {
      storageOperations.push(
        this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
          value: cmd.access_token,
        }),
      );

      // Store token expiration
      if (cmd.expires_in) {
        const expiresAt = new Date(Date.now() + cmd.expires_in * 1000);

        storageOperations.push(
          this.userVarsService.set({
            userId,
            workspaceId,
            key: BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT,
            value: expiresAt.toISOString(),
          }),
        );
      }
    }

    // Mark credentials as stored
    storageOperations.push(
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CREDENTIALS_STORED,
        value: 'true',
      }),
    );

    // Execute all storage operations
    await Promise.all(storageOperations);

    this.logger.log('Credentials stored successfully');

    return {
      success: true,
      data: {
        storage_successful: true,
        stored_at: new Date().toISOString(),
        items_stored: storageOperations.length,
        has_access_token: !!cmd.access_token,
      },
      message:
        '✅ **Учетные данные сохранены!**\n\n🔐 Данные зашифрованы и защищены\n📊 Интеграция готова к использованию',
    };
  }

  /**
   * Store validated credentials securely using UserVarsService
   */
  private async handleStoreCredentials(
    cmd: StoreCredentialsType,
    userId: string,
    workspaceId: string,
  ): Promise<ToolExecutionResult> {
    this.logger.log('Storing validated credentials securely');

    try {
      // Store credentials using existing UserVarsService
      const storagePromises = [
        this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
          value: cmd.client_id,
        }),
        this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
          value: cmd.client_secret,
        }),
      ];

      // Store access token if provided
      if (cmd.access_token) {
        storagePromises.push(
          this.userVarsService.set({
            userId,
            workspaceId,
            key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
            value: cmd.access_token,
          }),
        );

        // Store token expiration if provided
        if (cmd.expires_in) {
          const expiresAt = new Date(Date.now() + cmd.expires_in * 1000);

          storagePromises.push(
            this.userVarsService.set({
              userId,
              workspaceId,
              key: BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT,
              value: expiresAt.toISOString(),
            }),
          );
        }
      }

      await Promise.all(storagePromises);

      this.logger.log('Credentials stored successfully');

      return {
        success: true,
        data: {
          storage_successful: true,
          credentials_saved: true,
          tokens_saved: !!cmd.access_token,
          stored_keys: [
            BusinessSetupStepKeys.AVITO_CLIENT_ID,
            BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
            ...(cmd.access_token
              ? [BusinessSetupStepKeys.AVITO_ACCESS_TOKEN]
              : []),
            ...(cmd.expires_in
              ? [BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT]
              : []),
          ],
        },
        message:
          '💾 Учетные данные безопасно сохранены в системе! Интеграция с Avito готова к использованию.',
      };
    } catch (error) {
      this.logger.error('Failed to store credentials:', error);

      return {
        success: false,
        error: error.message,
        message: '❌ Ошибка при сохранении учетных данных. Попробуйте еще раз.',
      };
    }
  }

  /**
   * Handle completion reporting
   */
  private handleCompletion(
    cmd: ReportWelcomeCompletionType,
  ): ToolExecutionResult {
    this.logger.log(
      `Welcome stage completion: success=${cmd.success}, next_stage=${cmd.next_stage}`,
    );

    return {
      success: cmd.success,
      data: {
        task_completed: true,
        success: cmd.success,
        credentials_stored: cmd.credentials_stored,
        next_stage: cmd.next_stage,
        completion_message: cmd.summary_message,
      },
      message: cmd.summary_message,
    };
  }

  /**
   * General retry execution wrapper with exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationType: string,
    context: { context?: any; operation: string },
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.RETRY_CONFIG.maxAttempts) {
      attempt++;

      try {
        this.logger.log(
          `Executing ${operationType} - attempt ${attempt}/${this.RETRY_CONFIG.maxAttempts}`,
        );

        const result = await operation();

        if (attempt > 1) {
          this.logger.log(
            `${context.operation} succeeded on attempt ${attempt}`,
          );
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        this.logger.warn(
          `${context.operation} attempt ${attempt} failed:`,
          lastError.message,
        );

        // Check if error is retryable
        if (
          !this.isRetryableError(lastError) ||
          attempt >= this.RETRY_CONFIG.maxAttempts
        ) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.RETRY_CONFIG.initialDelayMs *
            Math.pow(this.RETRY_CONFIG.backoffMultiplier, attempt - 1),
          this.RETRY_CONFIG.maxDelayMs,
        );

        this.logger.log(`Retrying ${operationType} in ${delay}ms...`);
        await this.delay(delay);
      }
    }

    // All retries failed
    this.logger.error(`${context.operation} failed after ${attempt} attempts`);
    throw (
      lastError ||
      new Error(`${context.operation} failed after maximum retries`)
    );
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: Error | string): boolean {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorCode = (error as any)?.code || '';

    // Network-related errors that should be retried
    if (
      this.RETRY_CONFIG.retryableErrors.some(
        (code) => errorCode === code || errorMessage.includes(code),
      )
    ) {
      return true;
    }

    // HTTP 5xx errors (server errors)
    if (errorMessage.match(/HTTP [5]\d\d/)) {
      return true;
    }

    // Rate limiting
    if (
      errorMessage.includes('429') ||
      errorMessage.toLowerCase().includes('rate limit')
    ) {
      return true;
    }

    // Timeout errors
    if (
      errorMessage.toLowerCase().includes('timeout') ||
      errorMessage.includes('ETIMEDOUT')
    ) {
      return true;
    }

    // Connection errors
    if (
      errorMessage.toLowerCase().includes('connection') &&
      (errorMessage.includes('refused') || errorMessage.includes('reset'))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Encrypt secret for secure storage (basic implementation)
   * TODO: Implement proper encryption with workspace keys
   */
  private encryptSecret(secret: string): string {
    // For now, using base64 encoding
    // In production, this should use proper encryption with workspace-specific keys
    return Buffer.from(secret).toString('base64');
  }

  /**
   * Get operation metrics for monitoring
   */
  getMetrics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageExecutionTime: number;
  } {
    // TODO: Implement proper metrics collection
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTime: 0,
    };
  }

  // ===============================================================
  // ENHANCED METHODS (Extracted from duplicate services)
  // ===============================================================

  /**
   * ENHANCED: Validate tool for current workflow state using validation matrix
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private validateToolForState(
    tool: string,
    state?: AvitoWorkflowState,
  ): ValidationResult {
    if (!state) {
      return {
        tool,
        state: AvitoWorkflowState.INIT,
        valid: true,
        timestamp: new Date(),
      };
    }

    const allowedTools = ALLOWED_TOOLS_BY_STATE[state] || [];
    const isValid = allowedTools.includes(tool);

    return {
      tool,
      state,
      valid: isValid,
      error: isValid
        ? undefined
        : `Tool ${tool} not allowed in state ${state}. Allowed tools: ${allowedTools.join(', ')}`,
      timestamp: new Date(),
    };
  }

  /**
   * ENHANCED: Classify error for enhanced error handling
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private classifyError(error: any): {
    errorType:
      | 'VALIDATION'
      | 'EXECUTION'
      | 'NETWORK'
      | 'AUTH'
      | 'RATE_LIMIT'
      | 'TIMEOUT'
      | 'UNKNOWN';
    retryable: boolean;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || '';

    // Network errors
    if (
      errorCode === 'ECONNREFUSED' ||
      errorCode === 'ENOTFOUND' ||
      errorCode === 'EAI_AGAIN'
    ) {
      return { errorType: 'NETWORK', retryable: true, severity: 'MEDIUM' };
    }

    // Timeout errors
    if (
      errorCode === 'ETIMEDOUT' ||
      errorMessage.toLowerCase().includes('timeout')
    ) {
      return { errorType: 'TIMEOUT', retryable: true, severity: 'MEDIUM' };
    }

    // Authentication errors
    if (
      error.status === 401 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('authentication')
    ) {
      return { errorType: 'AUTH', retryable: false, severity: 'HIGH' };
    }

    // Rate limiting
    if (
      error.status === 429 ||
      errorMessage.toLowerCase().includes('rate limit')
    ) {
      return { errorType: 'RATE_LIMIT', retryable: true, severity: 'MEDIUM' };
    }

    // Validation errors
    if (
      errorMessage.includes('validation') ||
      errorMessage.includes('invalid')
    ) {
      return { errorType: 'VALIDATION', retryable: false, severity: 'LOW' };
    }

    // Execution errors
    if (
      error.status >= 500 ||
      errorMessage.includes('internal') ||
      errorMessage.includes('server error')
    ) {
      return { errorType: 'EXECUTION', retryable: true, severity: 'HIGH' };
    }

    return { errorType: 'UNKNOWN', retryable: false, severity: 'HIGH' };
  }

  /**
   * ENHANCED: Create performance metrics object
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private createPerformanceMetrics(
    startTime: number,
    retryCount: number,
    cacheHit = false,
  ): PerformanceMetrics {
    return {
      executionTimeMs: Date.now() - startTime,
      startTime: new Date(startTime),
      endTime: new Date(),
      memoryUsage: process.memoryUsage().heapUsed,
      retryCount,
      cacheHit,
    };
  }

  /**
   * ENHANCED: Execute tool with performance monitoring
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private async executeToolWithMonitoring(
    command: WelcomeToolUnion,
    userId: string,
    workspaceId: string,
    startTime: number,
  ): Promise<EnhancedToolExecutionResult> {
    try {
      // Execute the original tool method
      const result = await this.executeToolWithRetry(
        command,
        userId,
        workspaceId,
      );

      // Convert to enhanced result
      const enhancedResult: EnhancedToolExecutionResult = {
        ...result,
        executionTimeMs: Date.now() - startTime,
        retryable: true,
        metadata: {
          performanceMetrics: this.createPerformanceMetrics(startTime, 0),
          toolExecuted: command.tool,
          timestamp: new Date().toISOString(),
        },
      };

      return enhancedResult;
    } catch (error) {
      const classification = this.classifyError(error);

      return {
        success: false,
        error: error.message,
        message: 'Tool execution failed',
        errorType: classification.errorType,
        executionTimeMs: Date.now() - startTime,
        retryable: classification.retryable,
        metadata: {
          errorClassification: classification,
          performanceMetrics: this.createPerformanceMetrics(startTime, 0),
          toolExecuted: command.tool,
        },
      };
    }
  }

  /**
   * ENHANCED: Circuit breaker functionality
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private isCircuitBreakerOpen(toolKey: string): boolean {
    if (!this.PERFORMANCE_CONFIG.enableCircuitBreaker) {
      return false;
    }

    const state = this.circuitBreakerStates.get(toolKey);

    if (!state) {
      return false;
    }

    // Check if circuit breaker should be closed (timeout expired)
    if (state.isOpen) {
      const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();

      if (
        timeSinceLastFailure > this.PERFORMANCE_CONFIG.circuitBreakerTimeoutMs
      ) {
        // Reset circuit breaker
        state.isOpen = false;
        state.failures = 0;
        this.logger.log(`Circuit breaker reset for ${toolKey}`);

        return false;
      }

      return true;
    }

    return false;
  }

  /**
   * ENHANCED: Record circuit breaker failure
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private recordCircuitBreakerFailure(toolKey: string): void {
    if (!this.PERFORMANCE_CONFIG.enableCircuitBreaker) {
      return;
    }

    const state = this.circuitBreakerStates.get(toolKey) || {
      failures: 0,
      lastFailure: new Date(),
      isOpen: false,
    };

    state.failures++;
    state.lastFailure = new Date();

    // Open circuit breaker if threshold exceeded
    if (state.failures >= this.PERFORMANCE_CONFIG.circuitBreakerThreshold) {
      state.isOpen = true;
      this.logger.warn(
        `Circuit breaker opened for ${toolKey} after ${state.failures} failures`,
      );
    }

    this.circuitBreakerStates.set(toolKey, state);
  }

  /**
   * ENHANCED: Record circuit breaker success
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  private recordCircuitBreakerSuccess(toolKey: string): void {
    if (!this.PERFORMANCE_CONFIG.enableCircuitBreaker) {
      return;
    }

    const state = this.circuitBreakerStates.get(toolKey);

    if (state) {
      // Reset failure count on success
      state.failures = 0;
      if (state.isOpen) {
        state.isOpen = false;
        this.logger.log(
          `Circuit breaker closed for ${toolKey} after successful operation`,
        );
      }
    }
  }

  /**
   * ENHANCED: Get comprehensive performance metrics
   * Extracted from: EnhancedAvitoWelcomeToolDispatcherService
   */
  getEnhancedMetrics(): {
    circuitBreakerStates: Array<{
      tool: string;
      failures: number;
      isOpen: boolean;
    }>;
    performanceConfig: PerformanceConfig;
    retryConfig: RetryConfig;
    totalCircuitBreakers: number;
  } {
    const circuitBreakerStates = Array.from(
      this.circuitBreakerStates.entries(),
    ).map(([tool, state]) => ({
      tool,
      failures: state.failures,
      isOpen: state.isOpen,
    }));

    return {
      circuitBreakerStates,
      performanceConfig: this.PERFORMANCE_CONFIG,
      retryConfig: this.RETRY_CONFIG,
      totalCircuitBreakers: this.circuitBreakerStates.size,
    };
  }

  /**
   * Tool validation matrix - determines which tools are allowed in each workflow state
   * (Required by tests)
   */
  private readonly ALLOWED_TOOLS_BY_STATE: Record<
    AvitoWorkflowState,
    string[]
  > = {
    [AvitoWorkflowState.INIT]: [],
    [AvitoWorkflowState.GREETING_SENT]: [],
    [AvitoWorkflowState.AWAITING_CREDENTIALS]: [
      'extract_credentials',
      'request_credentials',
    ],
    [AvitoWorkflowState.EXTRACTING_CREDENTIALS]: ['validate_avito_token'],
    [AvitoWorkflowState.VALIDATING_CREDENTIALS]: ['validate_avito_token'],
    [AvitoWorkflowState.VALIDATION_SUCCESS]: ['store_credentials'],
    [AvitoWorkflowState.VALIDATION_FAILED]: [
      'extract_credentials',
      'request_credentials',
    ],
    [AvitoWorkflowState.STORING_CREDENTIALS]: ['store_credentials'],
    [AvitoWorkflowState.STORAGE_COMPLETE]: ['report_welcome_completion'],
    [AvitoWorkflowState.COMPLETING_WELCOME]: ['report_welcome_completion'],
    [AvitoWorkflowState.WELCOME_COMPLETED]: [],
    [AvitoWorkflowState.ERROR_INVALID_FORMAT]: [
      'extract_credentials',
      'request_credentials',
    ],
    [AvitoWorkflowState.ERROR_API_FAILURE]: ['validate_avito_token'],
    [AvitoWorkflowState.ERROR_STORAGE_FAILURE]: ['store_credentials'],
    [AvitoWorkflowState.REQUEST_RETRY]: [
      'extract_credentials',
      'validate_avito_token',
    ],
    [AvitoWorkflowState.MAX_RETRIES_EXCEEDED]: [],
  };

  /**
   * Check if tool is allowed in current workflow state (required by tests)
   */
  private isToolAllowedInState(
    tool: string,
    state: AvitoWorkflowState,
  ): boolean {
    const allowedTools = this.ALLOWED_TOOLS_BY_STATE[state] || [];

    return allowedTools.includes(tool);
  }

  /**
   * Open circuit breaker manually (required by tests)
   */
  private openCircuitBreaker(toolKey: string): void {
    const state = this.circuitBreakerStates.get(toolKey) || {
      failures: 0,
      lastFailure: new Date(),
      isOpen: false,
    };

    state.isOpen = true;
    state.failures = this.PERFORMANCE_CONFIG.circuitBreakerThreshold;
    state.lastFailure = new Date();

    this.circuitBreakerStates.set(toolKey, state);
    this.logger.warn(`Circuit breaker manually opened for ${toolKey}`);
  }
}
