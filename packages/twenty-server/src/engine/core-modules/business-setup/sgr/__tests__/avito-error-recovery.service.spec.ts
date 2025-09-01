import { type Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import { type BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import {
  AvitoErrorRecoveryService,
  AvitoErrorType,
  type AvitoErrorDetails,
} from '../services/avito-error-recovery.service';
import {
  AvitoWorkflowContextFactory,
  AvitoWorkflowState,
  type AvitoWorkflowContext,
} from '../types/avito-workflow-context';

describe('AvitoErrorRecoveryService', () => {
  let service: AvitoErrorRecoveryService;
  let mockUserVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockLogger: jest.Mocked<Logger>;

  const mockUserId = 'test-user-123';
  const mockWorkspaceId = 'test-workspace-123';
  const mockThreadId = 'test-thread-123';

  beforeEach(async () => {
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(true),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvitoErrorRecoveryService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<AvitoErrorRecoveryService>(AvitoErrorRecoveryService);

    // Mock the logger
    jest.spyOn(service as any, 'logger', 'get').mockReturnValue(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify invalid credential format error correctly', () => {
      const error = new Error('Invalid format detected');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.AWAITING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.INVALID_CREDENTIAL_FORMAT);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(true);
    });

    it('should classify API authentication error correctly', () => {
      const error = new Error('401 Unauthorized');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.API_AUTHENTICATION_FAILED);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(true);
    });

    it('should classify API rate limit error correctly', () => {
      const error = new Error('429 Too Many Requests');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.API_RATE_LIMITED);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(false);
    });

    it('should classify network error correctly', () => {
      const error = new Error('ECONNREFUSED');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.API_NETWORK_ERROR);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(false);
    });

    it('should classify timeout error correctly', () => {
      const error = new Error('Request timeout');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.API_TIMEOUT);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(false);
    });

    it('should classify storage failure correctly', () => {
      const error = new Error('Database connection failed');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.STORING_CREDENTIALS,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.STORAGE_FAILURE);
      expect(result.recoveryStrategy.recoverable).toBe(true);
      expect(result.recoveryStrategy.requiresUserAction).toBe(false);
    });

    it('should classify unknown error correctly', () => {
      const error = new Error('Unexpected error');
      const result = service.classifyError(error, {
        userId: 'test-user',
        workspaceId: 'test-workspace',
        threadId: 'test-thread',
        workflowState: AvitoWorkflowState.INIT,
        attemptCount: 1,
      });

      expect(result.errorType).toBe(AvitoErrorType.UNKNOWN_ERROR);
      expect(result.recoveryStrategy.recoverable).toBe(false);
    });
  });

  describe('Recovery Strategy Selection', () => {
    it('should return correct recovery strategy for invalid credential format', () => {
      const strategy = service.getRecoveryStrategy(
        AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
      );

      expect(strategy.maxRetries).toBe(3);
      expect(strategy.retryDelayMs).toBe(0);
      expect(strategy.requiresUserAction).toBe(true);
      expect(strategy.recoverable).toBe(true);
      expect(strategy.userMessage).toContain('Неверный формат учетных данных');
    });

    it('should return correct recovery strategy for API rate limit', () => {
      const strategy = service.getRecoveryStrategy(
        AvitoErrorType.API_RATE_LIMITED,
      );

      expect(strategy.maxRetries).toBe(5);
      expect(strategy.retryDelayMs).toBe(5000);
      expect(strategy.requiresUserAction).toBe(false);
      expect(strategy.recoverable).toBe(true);
      expect(strategy.backoffMultiplier).toBe(2);
    });

    it('should return correct recovery strategy for workflow timeout', () => {
      const strategy = service.getRecoveryStrategy(
        AvitoErrorType.WORKFLOW_TIMEOUT,
      );

      expect(strategy.maxRetries).toBe(0);
      expect(strategy.recoverable).toBe(false);
      expect(strategy.requiresUserAction).toBe(true);
      expect(strategy.userMessage).toContain('Превышено время выполнения');
    });
  });

  describe('Error Recovery Execution', () => {
    let mockContext: AvitoWorkflowContext;

    beforeEach(() => {
      mockContext = AvitoWorkflowContextFactory.create(
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );
      mockContext.state = AvitoWorkflowState.VALIDATING_CREDENTIALS;
      mockContext.attemptMetrics.attemptCount = 1;
    });

    it('should successfully recover from credential format error', async () => {
      const errorDetails: AvitoErrorDetails = {
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
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
        ),
      };

      const result = await service.recoverFromError(errorDetails, mockContext);

      expect(result.success).toBe(true);
      expect(result.newState).toBe(AvitoWorkflowState.AWAITING_CREDENTIALS);
      expect(result.requiresUserInput).toBe(true);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'avito.error.recovery.started',
        expect.objectContaining({
          errorType: AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
        }),
      );
    });

    it('should successfully recover from API rate limit with delay', async () => {
      const errorDetails: AvitoErrorDetails = {
        errorType: AvitoErrorType.API_RATE_LIMITED,
        originalError: new Error('429 Too Many Requests'),
        context: {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 1,
          timestamp: new Date(),
        },
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.API_RATE_LIMITED,
        ),
        metadata: { retryAfter: 30 },
      };

      const result = await service.recoverFromError(errorDetails, mockContext);

      expect(result.success).toBe(true);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.requiresUserInput).toBe(false);
    });

    it('should fail recovery when max attempts exceeded', async () => {
      mockContext.attemptMetrics.attemptCount = 3;
      mockContext.attemptMetrics.maxAttempts = 3;

      const errorDetails: AvitoErrorDetails = {
        errorType: AvitoErrorType.API_AUTHENTICATION_FAILED,
        originalError: new Error('401 Unauthorized'),
        context: {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 3,
          timestamp: new Date(),
        },
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.API_AUTHENTICATION_FAILED,
        ),
      };

      const result = await service.recoverFromError(errorDetails, mockContext);

      expect(result.success).toBe(false);
      expect(result.newState).toBe(AvitoWorkflowState.MAX_RETRIES_EXCEEDED);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'avito.error.recovery.failed',
        expect.objectContaining({
          reason: 'MAX_ATTEMPTS_EXCEEDED',
        }),
      );
    });

    it('should handle non-recoverable errors', async () => {
      const errorDetails: AvitoErrorDetails = {
        errorType: AvitoErrorType.WORKFLOW_TIMEOUT,
        originalError: new Error('Workflow timeout'),
        context: {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 1,
          timestamp: new Date(),
        },
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.WORKFLOW_TIMEOUT,
        ),
      };

      const result = await service.recoverFromError(errorDetails, mockContext);

      expect(result.success).toBe(false);
      expect(result.newState).toBe(AvitoWorkflowState.MAX_RETRIES_EXCEEDED);
      expect(result.requiresUserInput).toBe(true);
    });
  });

  describe('Error Tracking and Analytics', () => {
    it('should track error patterns correctly', async () => {
      // Simulate multiple errors of the same type
      for (let i = 0; i < 3; i++) {
        service.trackError(
          mockUserId,
          mockWorkspaceId,
          AvitoErrorType.API_AUTHENTICATION_FAILED,
          `authentication failure attempt ${i + 1}`,
        );
      }

      const patterns = service.analyzeErrorPatterns(
        mockUserId,
        mockWorkspaceId,
      );

      expect(patterns.frequentErrors.length).toBeGreaterThan(0);
      expect(patterns.frequentErrors[0].errorType).toBe(
        AvitoErrorType.API_AUTHENTICATION_FAILED,
      );
      expect(patterns.frequentErrors[0].count).toBe(3);
    });

    it('should calculate error rates correctly', () => {
      // Track errors
      service.trackError(
        mockUserId,
        mockWorkspaceId,
        AvitoErrorType.API_AUTHENTICATION_FAILED,
        'authentication failure',
      );

      const statistics = service.getEnhancedRecoveryStatistics();

      expect(statistics.totalErrors).toBe(1);
      expect(
        statistics.errorsByType[AvitoErrorType.API_AUTHENTICATION_FAILED],
      ).toBe(1);
    });

    it('should identify error escalation triggers', () => {
      // Simulate rapid error succession
      const now = new Date();

      for (let i = 0; i < 5; i++) {
        service.trackError(
          mockUserId,
          mockWorkspaceId,
          AvitoErrorType.API_SERVER_ERROR,
          `server error attempt ${i + 1}`,
        );
      }

      const shouldEscalate = service.shouldEscalateError(
        mockUserId,
        mockWorkspaceId,
        {
          errorType: AvitoErrorType.API_SERVER_ERROR,
          timeWindow: 60000, // 1 minute
          attemptCount: 5,
        },
      );

      expect(shouldEscalate).toBe(true);
    });
  });

  describe('Escalation Handling', () => {
    it('should trigger escalation for critical error patterns', async () => {
      // Simulate critical error pattern
      for (let i = 0; i < 5; i++) {
        service.trackError(
          mockUserId,
          mockWorkspaceId,
          AvitoErrorType.STORAGE_FAILURE,
          `storage failure attempt ${i + 1}`,
        );
      }

      const errorDetails = {
        errorType: AvitoErrorType.STORAGE_FAILURE,
        originalError: new Error('Storage failure'),
        context: {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 5,
          timestamp: new Date(),
        },
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.STORAGE_FAILURE,
        ),
      };

      const mockContext = AvitoWorkflowContextFactory.create(
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const escalated = await service.handleEscalation(
        errorDetails,
        mockContext,
      );

      expect(escalated.escalated).toBe(true);
      expect(escalated.escalationId).toBeDefined();
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'error.escalation',
        expect.objectContaining({
          errorType: AvitoErrorType.STORAGE_FAILURE,
        }),
      );
    });

    it('should not escalate minor intermittent errors', async () => {
      service.trackError(
        mockUserId,
        mockWorkspaceId,
        AvitoErrorType.API_NETWORK_ERROR,
        'network error',
      );

      const errorDetails = {
        errorType: AvitoErrorType.API_NETWORK_ERROR,
        originalError: new Error('Network error'),
        context: {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
          attemptCount: 1,
          timestamp: new Date(),
        },
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.API_NETWORK_ERROR,
        ),
      };

      const mockContext = AvitoWorkflowContextFactory.create(
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const escalated = await service.handleEscalation(
        errorDetails,
        mockContext,
      );

      expect(escalated.escalated).toBe(false);
    });
  });

  describe('Recovery Strategy Optimization', () => {
    it('should adjust retry delays based on error patterns', () => {
      // Simulate repeated API timeout errors
      for (let i = 0; i < 3; i++) {
        service.trackError(
          mockUserId,
          mockWorkspaceId,
          AvitoErrorType.API_TIMEOUT,
          `timeout error attempt ${i + 1}`,
        );
      }

      const optimizedStrategy = service.getOptimizedRecoveryStrategy(
        AvitoErrorType.API_TIMEOUT,
        mockUserId,
        mockWorkspaceId,
      );

      // Should increase retry delay for repeated timeouts
      const baseStrategy = service.getRecoveryStrategy(
        AvitoErrorType.API_TIMEOUT,
      );

      expect(optimizedStrategy.retryDelayMs).toBeGreaterThanOrEqual(
        baseStrategy.retryDelayMs,
      );
    });

    it('should reduce retries for consistently failing operations', () => {
      // Simulate consistent authentication failures
      for (let i = 0; i < 10; i++) {
        service.trackError(
          mockUserId,
          mockWorkspaceId,
          AvitoErrorType.API_AUTHENTICATION_FAILED,
          `auth failure attempt ${i + 1}`,
        );
      }

      const optimizedStrategy = service.getOptimizedRecoveryStrategy(
        AvitoErrorType.API_AUTHENTICATION_FAILED,
        mockUserId,
        mockWorkspaceId,
      );

      // Should reduce max retries for consistently failing auth
      const baseStrategy = service.getRecoveryStrategy(
        AvitoErrorType.API_AUTHENTICATION_FAILED,
      );

      expect(optimizedStrategy.maxRetries).toBeLessThanOrEqual(
        baseStrategy.maxRetries,
      );
    });
  });

  describe('Error Context Preservation', () => {
    it('should preserve error context across recovery attempts', async () => {
      const initialContext = AvitoWorkflowContextFactory.create(
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const errorDetails: AvitoErrorDetails = {
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
        recoveryStrategy: service.getRecoveryStrategy(
          AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
        ),
        metadata: {
          originalMessage: 'CLIENT_ID = invalid format',
          extractionAttempts: 2,
        },
      };

      const result = await service.recoverFromError(
        errorDetails,
        initialContext,
      );

      expect(result.success).toBe(true);
      expect(result.requiresUserInput).toBe(true);
      expect(result.message).toContain('формат');
    });
  });
});
