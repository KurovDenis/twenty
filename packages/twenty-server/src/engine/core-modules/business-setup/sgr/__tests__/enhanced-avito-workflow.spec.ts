import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

// Services under test
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import {
  AvitoErrorRecoveryService,
  AvitoErrorType,
} from '../services/avito-error-recovery.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';
import { AvitoWorkflowHealthService } from '../services/avito-workflow-health.service';

// Dependencies

// Types and utilities
import {
  type ExtractCredentialsType,
  type StoreCredentialsType,
  type ValidateAvitoTokenType,
} from '../schemas/avito-welcome-sgr.schema';
import {
  AvitoWorkflowContextFactory,
  AvitoWorkflowState,
  AvitoWorkflowStateValidator,
} from '../types/avito-workflow-context';
import {
  AvitoCredentialExtractor,
  type CredentialExtractionResult,
} from '../utils/credential-extraction.util';

describe('Enhanced Avito SGR Workflow', () => {
  let module: TestingModule;
  let toolDispatcher: AvitoWelcomeToolDispatcherService;
  let errorRecovery: AvitoErrorRecoveryService;
  let healthService: AvitoWorkflowHealthService;
  let userVarsService: jest.Mocked<UserVarsService>;
  let httpTool: jest.Mocked<HttpTool>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Test data
  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-456';
  const mockThreadId = 'thread-789';
  const mockClientId = 'test_client_id_12345';
  const mockClientSecret = 'test_client_secret_67890abcdef';
  const mockAccessToken = 'access_token_xyz789';

  beforeEach(async () => {
    // Create mocks
    const mockUserVarsService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    };

    const mockHttpTool = {
      execute: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        AvitoWelcomeToolDispatcherService,
        AvitoErrorRecoveryService,
        AvitoWorkflowHealthService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: HttpTool,
          useValue: mockHttpTool,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    toolDispatcher = module.get<AvitoWelcomeToolDispatcherService>(
      AvitoWelcomeToolDispatcherService,
    );
    errorRecovery = module.get<AvitoErrorRecoveryService>(
      AvitoErrorRecoveryService,
    );
    healthService = module.get<AvitoWorkflowHealthService>(
      AvitoWorkflowHealthService,
    );
    userVarsService = module.get(UserVarsService);
    httpTool = module.get(HttpTool);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('AvitoCredentialExtractor', () => {
    describe('extractCredentials', () => {
      it('should extract credentials from standard KEY=VALUE format', () => {
        const message = `
          CLIENT_ID = ${mockClientId}
          CLIENT_SECRET = ${mockClientSecret}
        `;

        const result: CredentialExtractionResult =
          AvitoCredentialExtractor.extractCredentials(message);

        expect(result.success).toBe(true);
        expect(result.credentials?.clientId).toBe(mockClientId);
        expect(result.credentials?.clientSecret).toBe(mockClientSecret);
        expect(result.extractionMethod).toBe('standard_equals');
        expect(result.confidence).toBeGreaterThan(0.9);
      });

      it('should extract credentials from JSON format', () => {
        const message = `
          {
            "client_id": "${mockClientId}",
            "client_secret": "${mockClientSecret}"
          }
        `;

        const result = AvitoCredentialExtractor.extractCredentials(message);

        expect(result.success).toBe(true);
        expect(result.credentials?.clientId).toBe(mockClientId);
        expect(result.credentials?.clientSecret).toBe(mockClientSecret);
        expect(result.extractionMethod).toBe('json_parsing');
      });

      it('should extract credentials from colon-separated format', () => {
        const message = `
          CLIENT_ID: ${mockClientId}
          CLIENT_SECRET: ${mockClientSecret}
        `;

        const result = AvitoCredentialExtractor.extractCredentials(message);

        expect(result.success).toBe(true);
        expect(result.credentials?.clientId).toBe(mockClientId);
        expect(result.credentials?.clientSecret).toBe(mockClientSecret);
      });

      it('should fail to extract from invalid format', () => {
        const message = 'Some random text without credentials';

        const result = AvitoCredentialExtractor.extractCredentials(message);

        expect(result.success).toBe(false);
        expect(result.error).toContain(
          'Could not extract valid CLIENT_ID and CLIENT_SECRET',
        );
      });

      it('should validate credential format correctly', () => {
        const validResult = AvitoCredentialExtractor.validateCredentials(
          mockClientId,
          mockClientSecret,
        );

        expect(validResult.valid).toBe(true);
        expect(validResult.errors).toHaveLength(0);

        const invalidResult = AvitoCredentialExtractor.validateCredentials(
          'short',
          'alsoshort',
        );

        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AvitoWorkflowStateValidator', () => {
    describe('isValidTransition', () => {
      it('should allow valid state transitions', () => {
        expect(
          AvitoWorkflowStateValidator.isValidTransition(
            AvitoWorkflowState.INIT,
            AvitoWorkflowState.GREETING_SENT,
          ),
        ).toBe(true);

        expect(
          AvitoWorkflowStateValidator.isValidTransition(
            AvitoWorkflowState.AWAITING_CREDENTIALS,
            AvitoWorkflowState.EXTRACTING_CREDENTIALS,
          ),
        ).toBe(true);

        expect(
          AvitoWorkflowStateValidator.isValidTransition(
            AvitoWorkflowState.VALIDATION_SUCCESS,
            AvitoWorkflowState.STORING_CREDENTIALS,
          ),
        ).toBe(true);
      });

      it('should reject invalid state transitions', () => {
        expect(
          AvitoWorkflowStateValidator.isValidTransition(
            AvitoWorkflowState.INIT,
            AvitoWorkflowState.WELCOME_COMPLETED,
          ),
        ).toBe(false);

        expect(
          AvitoWorkflowStateValidator.isValidTransition(
            AvitoWorkflowState.WELCOME_COMPLETED,
            AvitoWorkflowState.INIT,
          ),
        ).toBe(false);
      });
    });

    describe('isToolAllowedInState', () => {
      it('should allow correct tools in appropriate states', () => {
        expect(
          AvitoWorkflowStateValidator.isToolAllowedInState(
            'extract_credentials',
            AvitoWorkflowState.AWAITING_CREDENTIALS,
          ),
        ).toBe(true);

        expect(
          AvitoWorkflowStateValidator.isToolAllowedInState(
            'validate_avito_token',
            AvitoWorkflowState.EXTRACTING_CREDENTIALS,
          ),
        ).toBe(true);
      });

      it('should reject tools in inappropriate states', () => {
        expect(
          AvitoWorkflowStateValidator.isToolAllowedInState(
            'store_credentials',
            AvitoWorkflowState.AWAITING_CREDENTIALS,
          ),
        ).toBe(false);

        expect(
          AvitoWorkflowStateValidator.isToolAllowedInState(
            'extract_credentials',
            AvitoWorkflowState.WELCOME_COMPLETED,
          ),
        ).toBe(false);
      });
    });
  });

  describe('AvitoWelcomeToolDispatcherService', () => {
    describe('dispatch', () => {
      it('should validate workflow state before executing tools', async () => {
        const command: ExtractCredentialsType = {
          tool: 'extract_credentials',
          message: `CLIENT_ID = ${mockClientId}\nCLIENT_SECRET = ${mockClientSecret}`,
        };

        // Test with invalid state
        const invalidStateResult = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.WELCOME_COMPLETED,
        );

        expect(invalidStateResult.success).toBe(false);
        expect(invalidStateResult.error).toContain(
          'not allowed in workflow state',
        );
      });

      it('should extract credentials successfully with enhanced patterns', async () => {
        const command: ExtractCredentialsType = {
          tool: 'extract_credentials',
          message: `CLIENT_ID = ${mockClientId}\nCLIENT_SECRET = ${mockClientSecret}`,
        };

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.AWAITING_CREDENTIALS,
        );

        expect(result.success).toBe(true);
        expect(result.data.client_id).toBe(mockClientId);
        expect(result.data.client_secret).toBe(mockClientSecret);
        expect(result.data.extraction_successful).toBe(true);
      });

      it('should validate Avito token with retry logic', async () => {
        const command: ValidateAvitoTokenType = {
          tool: 'validate_avito_token',
          client_id: mockClientId,
          client_secret: mockClientSecret,
          api_url: 'https://api.avito.ru/token',
        };

        // Mock successful API response
        httpTool.execute.mockResolvedValue({
          result: {
            access_token: mockAccessToken,
            expires_in: 3600,
            token_type: 'Bearer',
          },
          error: undefined,
        });

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.VALIDATING_CREDENTIALS,
        );

        expect(result.success).toBe(true);
        expect(result.data.access_token).toBe(mockAccessToken);
        expect(result.data.validation_successful).toBe(true);
        expect(httpTool.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://api.avito.ru/token',
            method: 'POST',
          }),
        );
      });

      it('should handle API validation failures with proper error classification', async () => {
        const command: ValidateAvitoTokenType = {
          tool: 'validate_avito_token',
          client_id: 'invalid_id',
          client_secret: 'invalid_secret',
          api_url: 'https://api.avito.ru/token',
        };

        // Mock API error response
        httpTool.execute.mockResolvedValue({
          result: null,
          error: 'HTTP 401: Unauthorized',
        });

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.VALIDATING_CREDENTIALS,
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('401');
      });

      it('should store credentials securely with encryption', async () => {
        const command: StoreCredentialsType = {
          tool: 'store_credentials',
          client_id: mockClientId,
          client_secret: mockClientSecret,
          access_token: mockAccessToken,
          expires_in: 3600,
        };

        userVarsService.set.mockResolvedValue(undefined);

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.STORING_CREDENTIALS,
        );

        expect(result.success).toBe(true);
        expect(result.data.storage_successful).toBe(true);
        expect(userVarsService.set).toHaveBeenCalledTimes(4); // CLIENT_ID, CLIENT_SECRET, ACCESS_TOKEN, STORED flag
      });
    });

    describe('retry logic', () => {
      it('should retry retryable errors with exponential backoff', async () => {
        const command: ValidateAvitoTokenType = {
          tool: 'validate_avito_token',
          client_id: mockClientId,
          client_secret: mockClientSecret,
          api_url: 'https://api.avito.ru/token',
        };

        // Mock network error that should be retried
        httpTool.execute
          .mockRejectedValueOnce(new Error('ECONNREFUSED'))
          .mockRejectedValueOnce(new Error('ETIMEDOUT'))
          .mockResolvedValueOnce({
            result: {
              access_token: mockAccessToken,
              expires_in: 3600,
            },
            error: undefined,
          });

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.VALIDATING_CREDENTIALS,
        );

        expect(result.success).toBe(true);
        expect(httpTool.execute).toHaveBeenCalledTimes(3); // 2 failures + 1 success
      });

      it('should not retry non-retryable errors', async () => {
        const command: ValidateAvitoTokenType = {
          tool: 'validate_avito_token',
          client_id: 'invalid',
          client_secret: 'invalid',
          api_url: 'https://api.avito.ru/token',
        };

        // Mock 400 error (bad request - not retryable)
        httpTool.execute.mockResolvedValue({
          result: null,
          error: 'HTTP 400: Bad Request - Invalid client credentials',
        });

        const result = await toolDispatcher.dispatch(
          command,
          mockUserId,
          mockWorkspaceId,
          AvitoWorkflowState.VALIDATING_CREDENTIALS,
        );

        expect(result.success).toBe(false);
        expect(httpTool.execute).toHaveBeenCalledTimes(1); // No retries
      });
    });
  });

  describe('AvitoErrorRecoveryService', () => {
    describe('classifyError', () => {
      it('should correctly classify credential format errors', () => {
        const error = new Error('Invalid credential format detected');
        const context = {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.AWAITING_CREDENTIALS,
          attemptCount: 1,
        };

        const errorDetails = errorRecovery.classifyError(error, context);

        expect(errorDetails.errorType).toBe(
          AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
        );
        expect(errorDetails.recoveryStrategy.recoverable).toBe(true);
        expect(errorDetails.recoveryStrategy.requiresUserAction).toBe(true);
      });

      it('should correctly classify API authentication errors', () => {
        const error = new Error('401 Unauthorized - Invalid credentials');
        const context = {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 1,
        };

        const errorDetails = errorRecovery.classifyError(error, context);

        expect(errorDetails.errorType).toBe(
          AvitoErrorType.API_AUTHENTICATION_FAILED,
        );
        expect(errorDetails.recoveryStrategy.maxRetries).toBe(2);
      });

      it('should correctly classify rate limiting errors', () => {
        const error = new Error('429 Too Many Requests - Rate limit exceeded');
        const context = {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 1,
        };

        const errorDetails = errorRecovery.classifyError(error, context);

        expect(errorDetails.errorType).toBe(AvitoErrorType.API_RATE_LIMITED);
        expect(errorDetails.recoveryStrategy.retryDelayMs).toBe(5000);
        expect(errorDetails.recoveryStrategy.requiresUserAction).toBe(false);
      });
    });

    describe('executeRecovery', () => {
      it('should execute credential error recovery by resetting to awaiting state', async () => {
        const errorDetails = {
          errorType: AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
          originalError: new Error('Invalid format'),
          context: {
            userId: mockUserId,
            workspaceId: mockWorkspaceId,
            threadId: mockThreadId,
            workflowState: AvitoWorkflowState.EXTRACTING_CREDENTIALS,
            attemptCount: 1,
            timestamp: new Date(),
          },
          recoveryStrategy: {
            maxRetries: 3,
            retryDelayMs: 0,
            backoffMultiplier: 1,
            userMessage: 'Invalid credential format',
            technicalMessage: 'Format validation failed',
            recoverable: true,
            requiresUserAction: true,
          },
        };

        const workflowContext = AvitoWorkflowContextFactory.create(
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        );

        const result = await errorRecovery.executeRecovery(
          errorDetails,
          workflowContext,
        );

        expect(result.success).toBe(true);
        expect(result.newState).toBe(AvitoWorkflowState.AWAITING_CREDENTIALS);
        expect(result.requiresUserInput).toBe(true);
      });

      it('should handle max retries exceeded', async () => {
        const errorDetails = {
          errorType: AvitoErrorType.API_NETWORK_ERROR,
          originalError: new Error('Network error'),
          context: {
            userId: mockUserId,
            workspaceId: mockWorkspaceId,
            threadId: mockThreadId,
            workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
            attemptCount: 3, // Exceeds max retries
            timestamp: new Date(),
          },
          recoveryStrategy: {
            maxRetries: 2,
            retryDelayMs: 3000,
            backoffMultiplier: 1.5,
            userMessage: 'Network error occurred',
            technicalMessage: 'Network connectivity failed',
            recoverable: true,
            requiresUserAction: false,
          },
        };

        const workflowContext = AvitoWorkflowContextFactory.create(
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        );

        const result = await errorRecovery.executeRecovery(
          errorDetails,
          workflowContext,
        );

        expect(result.success).toBe(false);
        expect(result.newState).toBe(AvitoWorkflowState.MAX_RETRIES_EXCEEDED);
      });
    });
  });

  describe('AvitoWorkflowHealthService', () => {
    describe('performHealthCheck', () => {
      it('should perform comprehensive health check', async () => {
        // Mock database check
        userVarsService.get.mockResolvedValue('test-value');

        const healthResult = await healthService.performHealthCheck();

        expect(healthResult.status).toBeDefined();
        expect(healthResult.details).toHaveLength(5); // Database, API, Performance, Errors, Resources
        expect(healthResult.metrics).toBeDefined();
        expect(healthResult.timestamp).toBeInstanceOf(Date);
      });

      it('should detect database connectivity issues', async () => {
        // Mock database failure
        userVarsService.get.mockRejectedValue(
          new Error('Database connection failed'),
        );

        const healthResult = await healthService.performHealthCheck();

        const dbHealth = healthResult.details.find(
          (detail) => detail.component === 'database',
        );

        expect(dbHealth?.status).toBe('CRITICAL');
        expect(dbHealth?.message).toContain('Database connection failed');
      });
    });

    describe('event handling', () => {
      it('should track workflow metrics from events', () => {
        const startPayload = {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          timestamp: new Date(),
        };

        healthService.onWorkflowStarted(startPayload);

        const metrics = healthService.getMetrics();

        expect(metrics.totalWorkflows).toBe(1);
      });

      it('should track completion metrics', () => {
        const completionPayload = {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          success: true,
          credentialsValidated: true,
          credentialsStored: true,
          totalExecutionTimeMs: 5000,
          timestamp: new Date(),
        };

        // First start a workflow
        healthService.onWorkflowStarted({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          timestamp: new Date(),
        });

        // Then complete it
        healthService.onWorkflowCompleted(completionPayload);

        const metrics = healthService.getMetrics();

        expect(metrics.successfulWorkflows).toBe(1);
        expect(metrics.credentialsValidated).toBe(1);
        expect(metrics.credentialsStored).toBe(1);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow with error recovery', async () => {
      // Simulate a workflow that fails and recovers
      const workflowContext = AvitoWorkflowContextFactory.create(
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      // Start workflow
      healthService.onWorkflowStarted({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        timestamp: new Date(),
      });

      // Simulate extraction failure
      const extractCommand: ExtractCredentialsType = {
        tool: 'extract_credentials',
        message: 'Invalid message without credentials',
      };

      const extractResult = await toolDispatcher.dispatch(
        extractCommand,
        mockUserId,
        mockWorkspaceId,
        AvitoWorkflowState.AWAITING_CREDENTIALS,
      );

      expect(extractResult.success).toBe(false);

      // Classify and recover from error
      const error = new Error('Credentials not found in message');
      const errorDetails = errorRecovery.classifyError(error, {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        workflowState: AvitoWorkflowState.AWAITING_CREDENTIALS,
        attemptCount: 1,
      });

      const recoveryResult = await errorRecovery.executeRecovery(
        errorDetails,
        workflowContext,
      );

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.newState).toBe(
        AvitoWorkflowState.AWAITING_CREDENTIALS,
      );
      expect(recoveryResult.requiresUserInput).toBe(true);

      // Verify events were emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'avito.error.recovery.started',
        expect.any(Object),
      );
    });

    it('should validate complete successful workflow', async () => {
      // Mock all successful responses
      httpTool.execute.mockResolvedValue({
        result: {
          access_token: mockAccessToken,
          expires_in: 3600,
          token_type: 'Bearer',
        },
        error: undefined,
      });

      userVarsService.set.mockResolvedValue(undefined);

      // Extract credentials
      const extractCommand: ExtractCredentialsType = {
        tool: 'extract_credentials',
        message: `CLIENT_ID = ${mockClientId}\nCLIENT_SECRET = ${mockClientSecret}`,
      };

      const extractResult = await toolDispatcher.dispatch(
        extractCommand,
        mockUserId,
        mockWorkspaceId,
        AvitoWorkflowState.AWAITING_CREDENTIALS,
      );

      expect(extractResult.success).toBe(true);

      // Validate credentials
      const validateCommand: ValidateAvitoTokenType = {
        tool: 'validate_avito_token',
        client_id: mockClientId,
        client_secret: mockClientSecret,
        api_url: 'https://api.avito.ru/token',
      };

      const validateResult = await toolDispatcher.dispatch(
        validateCommand,
        mockUserId,
        mockWorkspaceId,
        AvitoWorkflowState.VALIDATING_CREDENTIALS,
      );

      expect(validateResult.success).toBe(true);

      // Store credentials
      const storeCommand: StoreCredentialsType = {
        tool: 'store_credentials',
        client_id: mockClientId,
        client_secret: mockClientSecret,
        access_token: mockAccessToken,
        expires_in: 3600,
      };

      const storeResult = await toolDispatcher.dispatch(
        storeCommand,
        mockUserId,
        mockWorkspaceId,
        AvitoWorkflowState.STORING_CREDENTIALS,
      );

      expect(storeResult.success).toBe(true);

      // Verify all operations succeeded
      expect(extractResult.data.extraction_successful).toBe(true);
      expect(validateResult.data.validation_successful).toBe(true);
      expect(storeResult.data.storage_successful).toBe(true);
    });
  });
});
