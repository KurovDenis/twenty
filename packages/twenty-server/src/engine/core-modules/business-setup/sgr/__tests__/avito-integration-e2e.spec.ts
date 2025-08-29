import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

// Enhanced services
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import { AvitoErrorRecoveryService } from '../services/avito-error-recovery.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';
import { AvitoWorkflowHealthService } from '../services/avito-workflow-health.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';

// Dependencies

// Types
import { BusinessSetupStepKeys } from '../../business-setup.service';
import {
  AvitoWorkflowContextFactory,
  AvitoWorkflowState,
} from '../types/avito-workflow-context';

/**
 * End-to-End Integration Test for Avito SGR Workflow
 *
 * This test suite validates the complete workflow from user credential input
 * to successful Avito API integration, including error recovery scenarios.
 */
describe('Avito SGR Integration E2E', () => {
  let module: TestingModule;
  let sgrService: AvitoWelcomeSGRService;
  let toolDispatcher: AvitoWelcomeToolDispatcherService;
  let errorRecovery: AvitoErrorRecoveryService;
  let healthService: AvitoWorkflowHealthService;
  let userVarsService: jest.Mocked<UserVarsService>;
  let agentChatService: jest.Mocked<AgentChatService>;
  let httpTool: jest.Mocked<HttpTool>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Test data - using realistic but safe test credentials
  const testData = {
    userId: 'test-user-123',
    workspaceId: 'test-workspace-456',
    threadId: 'test-thread-789',
    validClientId: 'TEST_CLIENT_ID_12345',
    validClientSecret: 'TEST_CLIENT_SECRET_67890ABCDEF123456789',
    invalidClientId: 'invalid',
    invalidClientSecret: 'invalid',
    mockAccessToken: 'mock_access_token_xyz789',
    mockExpiresIn: 3600,
  };

  const successfulAvitoAPIResponse = {
    access_token: testData.mockAccessToken,
    expires_in: testData.mockExpiresIn,
    token_type: 'Bearer',
  };

  beforeEach(async () => {
    // Create comprehensive mocks
    const mockUserVarsService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const mockAgentChatService = {
      addMessage: jest.fn().mockResolvedValue(undefined),
    };

    const mockAiModelRegistryService = {
      getModel: jest.fn().mockReturnValue({
        generate: jest.fn(),
      }),
    };

    const mockHttpTool = {
      execute: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        AvitoWelcomeSGRService,
        AvitoWelcomeToolDispatcherService,
        AvitoErrorRecoveryService,
        AvitoWorkflowHealthService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: AgentChatService,
          useValue: mockAgentChatService,
        },
        {
          provide: AiModelRegistryService,
          useValue: mockAiModelRegistryService,
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

    sgrService = module.get<AvitoWelcomeSGRService>(AvitoWelcomeSGRService);
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
    agentChatService = module.get(AgentChatService);
    httpTool = module.get(HttpTool);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('Complete Successful Workflow', () => {
    it('should execute complete workflow from credential input to storage', async () => {
      // Mock Avito API success response
      httpTool.execute.mockResolvedValue({
        result: successfulAvitoAPIResponse,
        error: undefined,
      });

      // Mock workflow context storage/retrieval
      userVarsService.get.mockResolvedValue(null); // No existing context

      // Simulate user sending credentials
      const userMessage = `
        Вот мои учетные данные для Avito:
        CLIENT_ID = ${testData.validClientId}
        CLIENT_SECRET = ${testData.validClientSecret}
      `;

      // Execute workflow
      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        userMessage,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Verify workflow execution
      expect(results.length).toBeGreaterThan(0);

      // Check that final result indicates success
      const finalResult = results[results.length - 1];

      expect(finalResult.completed).toBe(true);
      expect(finalResult.content).toContain('успешно');

      // Verify API was called
      expect(httpTool.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('api.avito.ru/token'),
          method: 'POST',
          body: expect.stringContaining('grant_type=client_credentials'),
        }),
      );

      // Verify credentials were stored
      expect(userVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: testData.validClientId,
      });

      expect(userVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: expect.any(String), // Encrypted value
      });

      expect(userVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
        value: testData.mockAccessToken,
      });
    });

    it('should handle multiple credential formats correctly', async () => {
      const testFormats = [
        // JSON format
        `{
          "client_id": "${testData.validClientId}",
          "client_secret": "${testData.validClientSecret}"
        }`,

        // Colon-separated format
        `CLIENT_ID: ${testData.validClientId}
         CLIENT_SECRET: ${testData.validClientSecret}`,

        // Environment variable format
        `export CLIENT_ID=${testData.validClientId}
         export CLIENT_SECRET=${testData.validClientSecret}`,
      ];

      httpTool.execute.mockResolvedValue({
        result: successfulAvitoAPIResponse,
        error: undefined,
      });

      for (const [index, messageFormat] of testFormats.entries()) {
        jest.clearAllMocks();

        const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
          messageFormat,
          testData.userId,
          `${testData.workspaceId}-${index}`,
          `${testData.threadId}-${index}`,
        );

        const results = [];

        for await (const result of workflowGenerator) {
          results.push(result);
        }

        // Verify each format was processed successfully
        const finalResult = results[results.length - 1];

        expect(finalResult.completed).toBe(true);
        expect(finalResult.content).toContain('успешно');

        // Verify API was called for each format
        expect(httpTool.execute).toHaveBeenCalled();
      }
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from invalid credential format', async () => {
      const invalidMessage =
        'Here are my credentials but in wrong format: abc123 and def456';

      userVarsService.get.mockResolvedValue(null);

      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        invalidMessage,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Should provide guidance for correct format
      const errorResult = results.find((r) => r.content?.includes('формат'));

      expect(errorResult).toBeDefined();
      expect(errorResult?.content).toContain('CLIENT_ID');
      expect(errorResult?.content).toContain('CLIENT_SECRET');
    });

    it('should handle API authentication failures', async () => {
      // Mock API authentication failure
      httpTool.execute.mockResolvedValue({
        result: null,
        error: 'HTTP 401: Unauthorized - Invalid client credentials',
      });

      const userMessage = `
        CLIENT_ID = ${testData.invalidClientId}
        CLIENT_SECRET = ${testData.invalidClientSecret}
      `;

      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        userMessage,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Should indicate authentication failure and ask for correct credentials
      const authErrorResult = results.find((r) =>
        r.content?.includes('аутентификации'),
      );

      expect(authErrorResult).toBeDefined();
      expect(authErrorResult?.content).toContain('правильность');
    });

    it('should handle network errors with retry logic', async () => {
      // Mock network error followed by success
      httpTool.execute
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          result: successfulAvitoAPIResponse,
          error: undefined,
        });

      const userMessage = `
        CLIENT_ID = ${testData.validClientId}
        CLIENT_SECRET = ${testData.validClientSecret}
      `;

      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        userMessage,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Should eventually succeed after retries
      const finalResult = results[results.length - 1];

      expect(finalResult.completed).toBe(true);
      expect(finalResult.content).toContain('успешно');

      // Verify multiple API calls were made (retries)
      expect(httpTool.execute).toHaveBeenCalledTimes(3);
    });

    it('should handle rate limiting gracefully', async () => {
      // Mock rate limiting error followed by success
      httpTool.execute
        .mockResolvedValueOnce({
          result: null,
          error: 'HTTP 429: Too Many Requests',
        })
        .mockResolvedValueOnce({
          result: successfulAvitoAPIResponse,
          error: undefined,
        });

      const userMessage = `
        CLIENT_ID = ${testData.validClientId}
        CLIENT_SECRET = ${testData.validClientSecret}
      `;

      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        userMessage,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Should indicate rate limiting and eventual success
      const rateLimitResult = results.find((r) =>
        r.content?.includes('ограничил'),
      );

      expect(rateLimitResult).toBeDefined();

      const finalResult = results[results.length - 1];

      expect(finalResult.completed).toBe(true);
      expect(finalResult.content).toContain('успешно');
    });
  });

  describe('State Machine Validation', () => {
    it('should enforce correct state transitions', async () => {
      const context = AvitoWorkflowContextFactory.create(
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      // Test valid transitions
      expect(() => {
        return sgrService['transitionToState'](
          context,
          AvitoWorkflowState.GREETING_SENT,
        );
      }).not.toThrow();

      // Test invalid transitions
      context.state = AvitoWorkflowState.WELCOME_COMPLETED;
      await expect(async () => {
        return sgrService['transitionToState'](
          context,
          AvitoWorkflowState.INIT,
        );
      }).rejects.toThrow('Invalid state transition');
    });

    it('should validate tools allowed in specific states', () => {
      // Test extract_credentials in AWAITING_CREDENTIALS
      const extractCommand = {
        tool: 'extract_credentials' as const,
        message: 'test message',
      };

      expect(() => {
        return toolDispatcher.dispatch(
          extractCommand,
          testData.userId,
          testData.workspaceId,
          AvitoWorkflowState.AWAITING_CREDENTIALS,
        );
      }).not.toThrow();

      // Test invalid tool in wrong state
      expect(async () => {
        return toolDispatcher.dispatch(
          extractCommand,
          testData.userId,
          testData.workspaceId,
          AvitoWorkflowState.WELCOME_COMPLETED,
        );
      }).rejects.toMatchObject({
        success: false,
        error: expect.stringContaining('not allowed'),
      });
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should track workflow execution metrics', async () => {
      // Start tracking
      healthService.onWorkflowStarted({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        threadId: testData.threadId,
        timestamp: new Date(),
      });

      // Simulate successful completion
      healthService.onWorkflowCompleted({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        threadId: testData.threadId,
        success: true,
        credentialsValidated: true,
        credentialsStored: true,
        totalExecutionTimeMs: 3000,
        timestamp: new Date(),
      });

      const metrics = healthService.getMetrics();

      expect(metrics.totalWorkflows).toBe(1);
      expect(metrics.successfulWorkflows).toBe(1);
      expect(metrics.credentialsValidated).toBe(1);
      expect(metrics.credentialsStored).toBe(1);
    });

    it('should perform health checks on all components', async () => {
      // Mock successful database check
      userVarsService.get.mockResolvedValue('test-value');

      const healthResult = await healthService.performHealthCheck();

      expect(healthResult.status).toBeDefined();
      expect(healthResult.details).toHaveLength(5);
      expect(healthResult.metrics).toBeDefined();

      // Check individual component health
      const componentStatuses = healthResult.details.map((d) => d.component);

      expect(componentStatuses).toContain('database');
      expect(componentStatuses).toContain('avito-api');
      expect(componentStatuses).toContain('workflow-performance');
      expect(componentStatuses).toContain('error-rates');
      expect(componentStatuses).toContain('system-resources');
    });
  });

  describe('Security and Compliance', () => {
    it('should encrypt sensitive credential data', async () => {
      httpTool.execute.mockResolvedValue({
        result: successfulAvitoAPIResponse,
        error: undefined,
      });

      const storeCommand = {
        tool: 'store_credentials' as const,
        client_id: testData.validClientId,
        client_secret: testData.validClientSecret,
        access_token: testData.mockAccessToken,
      };

      await toolDispatcher.dispatch(
        storeCommand,
        testData.userId,
        testData.workspaceId,
        AvitoWorkflowState.STORING_CREDENTIALS,
      );

      // Verify that CLIENT_SECRET was encrypted (not stored as plain text)
      const secretCall = userVarsService.set.mock.calls.find(
        (call) => call[0].key === BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
      );

      expect(secretCall).toBeDefined();
      expect(secretCall![0].value).not.toBe(testData.validClientSecret);
      expect(secretCall![0].value).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
    });

    it('should create comprehensive audit trail', async () => {
      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        `CLIENT_ID = ${testData.validClientId}\nCLIENT_SECRET = ${testData.validClientSecret}`,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      httpTool.execute.mockResolvedValue({
        result: successfulAvitoAPIResponse,
        error: undefined,
      });

      const results = [];

      for await (const result of workflowGenerator) {
        results.push(result);
      }

      // Verify events were emitted for audit trail
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'avito.workflow.started',
        expect.any(Object),
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'avito.workflow.completed',
        expect.any(Object),
      );
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent workflow executions', async () => {
      const concurrentCount = 5;
      const promises = [];

      httpTool.execute.mockResolvedValue({
        result: successfulAvitoAPIResponse,
        error: undefined,
      });

      for (let i = 0; i < concurrentCount; i++) {
        const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
          `CLIENT_ID = ${testData.validClientId}_${i}\nCLIENT_SECRET = ${testData.validClientSecret}_${i}`,
          `${testData.userId}_${i}`,
          `${testData.workspaceId}_${i}`,
          `${testData.threadId}_${i}`,
        );

        promises.push(async () => {
          const results = [];

          for await (const result of workflowGenerator) {
            results.push(result);
          }

          return results;
        });
      }

      const allResults = await Promise.all(promises.map((p) => p()));

      // Verify all workflows completed successfully
      expect(allResults).toHaveLength(concurrentCount);
      allResults.forEach((results) => {
        const finalResult = results[results.length - 1];

        expect(finalResult.completed).toBe(true);
      });
    });

    it('should respect timeout constraints', async () => {
      // Mock slow response that should timeout
      httpTool.execute.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  result: successfulAvitoAPIResponse,
                  error: undefined,
                }),
              65000,
            ),
          ), // 65 seconds - longer than typical timeout
      );

      const workflowGenerator = sgrService.processWelcomeMessageWithStreaming(
        `CLIENT_ID = ${testData.validClientId}\nCLIENT_SECRET = ${testData.validClientSecret}`,
        testData.userId,
        testData.workspaceId,
        testData.threadId,
      );

      const results = [];
      let completedNormally = false;

      try {
        for await (const result of workflowGenerator) {
          results.push(result);
        }
        completedNormally = true;
      } catch (error) {
        expect(error.message).toContain('timeout');
      }

      // Either should complete with timeout handling or throw timeout error
      if (completedNormally) {
        const timeoutResult = results.find(
          (r) => r.content?.includes('timeout') || r.content?.includes('время'),
        );

        expect(timeoutResult).toBeDefined();
      }
    }, 70000); // Extend test timeout to 70 seconds
  });

  describe('Integration with External Services', () => {
    it('should validate against real Avito API structure', async () => {
      // Test with realistic Avito API response structure
      const realisticAvitoResponse = {
        access_token: 'actual_token_format_example',
        expires_in: 86400,
        token_type: 'Bearer',
        scope: 'public',
      };

      httpTool.execute.mockResolvedValue({
        result: realisticAvitoResponse,
        error: undefined,
      });

      const validateCommand = {
        tool: 'validate_avito_token' as const,
        client_id: testData.validClientId,
        client_secret: testData.validClientSecret,
        api_url: 'https://api.avito.ru/token',
      };

      const result = await toolDispatcher.dispatch(
        validateCommand,
        testData.userId,
        testData.workspaceId,
        AvitoWorkflowState.VALIDATING_CREDENTIALS,
      );

      expect(result.success).toBe(true);
      expect(result.data.access_token).toBe(
        realisticAvitoResponse.access_token,
      );
      expect(result.data.expires_in).toBe(realisticAvitoResponse.expires_in);
      expect(result.data.token_type).toBe(realisticAvitoResponse.token_type);
    });

    it('should handle various Avito API error responses', async () => {
      const errorScenarios = [
        {
          response: { result: null, error: 'HTTP 400: Bad Request' },
          expectedErrorType: 'format',
        },
        {
          response: { result: null, error: 'HTTP 401: Unauthorized' },
          expectedErrorType: 'authentication',
        },
        {
          response: { result: null, error: 'HTTP 429: Too Many Requests' },
          expectedErrorType: 'rate limit',
        },
        {
          response: { result: null, error: 'HTTP 500: Internal Server Error' },
          expectedErrorType: 'server error',
        },
      ];

      for (const scenario of errorScenarios) {
        jest.clearAllMocks();
        httpTool.execute.mockResolvedValue(scenario.response);

        const validateCommand = {
          tool: 'validate_avito_token' as const,
          client_id: testData.validClientId,
          client_secret: testData.validClientSecret,
          api_url: 'https://api.avito.ru/token',
        };

        const result = await toolDispatcher.dispatch(
          validateCommand,
          testData.userId,
          testData.workspaceId,
          AvitoWorkflowState.VALIDATING_CREDENTIALS,
        );

        expect(result.success).toBe(false);
        expect(result.error || result.message).toEqual(
          expect.stringContaining(scenario.response.error.split(':')[1].trim()),
        );
      }
    });
  });
});
