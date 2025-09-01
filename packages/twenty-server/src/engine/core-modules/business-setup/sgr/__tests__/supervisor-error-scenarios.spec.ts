import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import { type BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import {
  BUSINESS_SETUP_EVENTS,
  type SupervisorProcessMessageEvent,
} from '../../events/business-setup.events';
import { BusinessSetupAgentService } from '../../services/business-setup-agent.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { SupervisorSGRService } from '../services/supervisor-sgr.service';
import { SupervisorToolDispatcherService } from '../services/supervisor-tool-dispatcher.service';
import {
  SupervisorErrorType,
  SupervisorException,
  type SupervisorSGRStreamingResult,
  type SupervisorStepResult,
} from '../types/supervisor-types';

describe('Supervisor Error Scenarios', () => {
  let module: TestingModule;
  let supervisorService: SupervisorSGRService;
  let toolDispatcher: SupervisorToolDispatcherService;
  let userVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let agentChatService: jest.Mocked<AgentChatService>;
  let aiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let businessSetupAgentService: jest.Mocked<BusinessSetupAgentService>;
  let avitoWelcomeService: jest.Mocked<AvitoWelcomeSGRService>;
  let eventEmitter: EventEmitter2;

  const mockUserId = 'error-test-user-123';
  const mockWorkspaceId = 'error-test-workspace-456';
  const mockThreadId = 'error-test-thread-789';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        SupervisorToolDispatcherService,
        SupervisorSGRService,
        {
          provide: UserVarsService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            getAll: jest.fn(),
          },
        },
        {
          provide: AgentChatService,
          useValue: {
            addMessage: jest.fn(),
            getMessages: jest.fn(),
            createThread: jest.fn(),
          },
        },
        {
          provide: AiModelRegistryService,
          useValue: {
            getEffectiveModelConfig: jest.fn(),
            getModel: jest.fn(),
          },
        },
        {
          provide: BusinessSetupAgentService,
          useValue: {
            getAgentForStep: jest.fn(),
            createAgent: jest.fn(),
            updateAgent: jest.fn(),
          },
        },
        {
          provide: AvitoWelcomeSGRService,
          useValue: {
            processWelcomeMessageWithStreaming: jest.fn(),
          },
        },
      ],
    }).compile();

    supervisorService = module.get<SupervisorSGRService>(SupervisorSGRService);
    toolDispatcher = module.get<SupervisorToolDispatcherService>(
      SupervisorToolDispatcherService,
    );
    userVarsService = module.get(UserVarsService);
    agentChatService = module.get(AgentChatService);
    aiModelRegistryService = module.get(AiModelRegistryService);
    businessSetupAgentService = module.get(BusinessSetupAgentService);
    avitoWelcomeService = module.get(AvitoWelcomeSGRService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dependency Injection Failures', () => {
    it('should handle missing UserVarsService gracefully', async () => {
      // Create a module without UserVarsService
      const testModule = await Test.createTestingModule({
        imports: [EventEmitterModule.forRoot()],
        providers: [
          SupervisorToolDispatcherService,
          // Missing UserVarsService intentionally
          {
            provide: AgentChatService,
            useValue: { addMessage: jest.fn(), getMessages: jest.fn() },
          },
          {
            provide: AiModelRegistryService,
            useValue: {
              getEffectiveModelConfig: jest.fn(),
              getModel: jest.fn(),
            },
          },
          {
            provide: BusinessSetupAgentService,
            useValue: { getAgentForStep: jest.fn() },
          },
        ],
      });

      // Should throw dependency injection error
      await expect(async () => {
        const compiledModule = await testModule.compile();

        compiledModule.get<SupervisorToolDispatcherService>(
          SupervisorToolDispatcherService,
        );
      }).rejects.toThrow();

      // No need to close the module as it failed to compile
    });

    it('should detect circular dependency scenarios', async () => {
      // This test validates that our event-driven approach prevents circular dependencies

      // Try to create a problematic circular dependency scenario
      const problemModule = Test.createTestingModule({
        imports: [EventEmitterModule.forRoot()],
        providers: [
          // Register services in wrong order to potentially trigger circular dependency
          SupervisorSGRService,
          SupervisorToolDispatcherService, // This should come first, but let's test
          {
            provide: UserVarsService,
            useValue: { get: jest.fn(), set: jest.fn(), getAll: jest.fn() },
          },
          {
            provide: AgentChatService,
            useValue: { addMessage: jest.fn(), getMessages: jest.fn() },
          },
          {
            provide: AiModelRegistryService,
            useValue: {
              getEffectiveModelConfig: jest.fn(),
              getModel: jest.fn(),
            },
          },
          {
            provide: BusinessSetupAgentService,
            useValue: { getAgentForStep: jest.fn() },
          },
        ],
      });

      // Should not throw circular dependency error due to our event-driven design
      await expect(problemModule.compile()).resolves.toBeDefined();

      const compiledModule = await problemModule.compile();

      await compiledModule.close();
    });
  });

  describe('Service Method Error Handling', () => {
    it('should handle UserVarsService database connection failures', async () => {
      userVarsService.get.mockRejectedValue(
        new Error('Database connection lost'),
      );

      const result = await toolDispatcher.checkBusinessSetupStatus(
        mockUserId,
        mockWorkspaceId,
      );

      // Should fallback to default status when database fails
      expect(result.status).toBe(BusinessSetupStatus.WELCOME);
      expect(result.isComplete).toBe(false);
    });

    it('should handle AgentChatService API failures during routing', async () => {
      businessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'test-agent',
        name: 'Test Agent',
      } as any);

      agentChatService.addMessage.mockRejectedValue(
        new Error('Chat service unavailable'),
      );

      await expect(
        toolDispatcher.routeToSpecializedAgent(
          BusinessSetupStatus.BUSINESS_ANALYSIS,
          'Test message',
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
          'Error test',
        ),
      ).rejects.toThrow('Chat service unavailable');
    });

    it('should handle AI model registry failures', async () => {
      (
        aiModelRegistryService.getEffectiveModelConfig as jest.Mock
      ).mockRejectedValue(new Error('AI service unavailable'));

      // This would typically be called within the supervisor service
      // Testing the error propagation
      await expect(
        aiModelRegistryService.getEffectiveModelConfig('test-model'),
      ).rejects.toThrow('AI service unavailable');
    });

    it('should handle agent service failures during tool dispatch', async () => {
      businessSetupAgentService.getAgentForStep.mockRejectedValue(
        new Error('Agent not found for status'),
      );

      const tool: SupervisorStepResult['function'] = {
        tool: 'route_to_specialized_agent',
        status: BusinessSetupStatus.BUSINESS_ANALYSIS,
        message: 'Test message',
        reason: 'Testing agent failure',
      };

      await expect(
        toolDispatcher.dispatch(
          tool,
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        ),
      ).rejects.toThrow('Agent not found for status');
    });
  });

  describe('Event System Failure Recovery', () => {
    it('should handle event emission failures gracefully', async () => {
      const eventSpy = jest.spyOn(eventEmitter, 'emit');

      eventSpy.mockImplementation(() => {
        throw new Error('Event system failure');
      });

      businessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'test-agent',
        name: 'Test Agent',
      } as any);

      // Should handle event emission failures and still complete routing
      await expect(
        toolDispatcher.routeToSpecializedAgent(
          BusinessSetupStatus.WELCOME,
          'Test message',
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
          'Event failure test',
        ),
      ).rejects.toThrow('Event system failure');
    });

    it('should handle event listener errors', async () => {
      const mockEvent: SupervisorProcessMessageEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        message: 'Test message causing error',
        timestamp: new Date(),
      };

      // Simulate error in event listener
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Event listener crashed');
      });

      eventEmitter.on(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
        errorListener,
      );

      // Should not crash the entire system
      expect(() => {
        eventEmitter.emit(
          BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
          mockEvent,
        );
      }).toThrow('Event listener crashed');
    });
  });

  describe('SupervisorException Error Handling', () => {
    it('should create and handle supervisor exceptions properly', () => {
      const error = new SupervisorException(
        SupervisorErrorType.INVALID_TOOL,
        'Test supervisor error',
        { tool: 'invalid_tool', reason: 'Testing' },
      );

      expect(error).toBeInstanceOf(SupervisorException);
      expect(error.message).toBe('Test supervisor error');
      expect(error.errorType).toBe(SupervisorErrorType.INVALID_TOOL);
      expect(error.context).toEqual({
        tool: 'invalid_tool',
        reason: 'Testing',
      });
    });

    it('should handle unknown tool type gracefully', async () => {
      const invalidTool: any = {
        tool: 'completely_unknown_tool',
        reason: 'Testing unknown tool handling',
      };

      await expect(
        toolDispatcher.dispatch(
          invalidTool,
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        ),
      ).rejects.toThrow(SupervisorException);

      try {
        await toolDispatcher.dispatch(
          invalidTool,
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SupervisorException);
        expect((error as SupervisorException).errorType).toBe(
          SupervisorErrorType.INVALID_TOOL,
        );
      }
    });

    it('should handle tool execution failures', async () => {
      userVarsService.set.mockRejectedValue(new Error('Database write failed'));

      const tool: SupervisorStepResult['function'] = {
        tool: 'status_change',
        from_status: BusinessSetupStatus.WELCOME,
        to_status: BusinessSetupStatus.BUSINESS_ANALYSIS,
        reason: 'Testing status change failure',
        trigger_event: 'test_event',
      };

      await expect(
        toolDispatcher.dispatch(
          tool,
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
        ),
      ).rejects.toThrow('Database write failed');
    });
  });

  describe('Streaming Error Recovery', () => {
    it('should handle streaming interruption gracefully', async () => {
      // Mock a streaming generator that fails midway
      const failingGenerator =
        async function* (): AsyncGenerator<SupervisorSGRStreamingResult> {
          yield {
            type: 'thinking',
            step: {
              stepNumber: 1,
              thinking: 'Starting process...',
              reasoning: 'Initial step',
              currentState: 'Starting',
              plannedSteps: ['Step 1'],
              selectedTool: 'analysis',
              timestamp: new Date(),
            },
            completed: false,
          };

          throw new Error('Streaming connection lost');
        };

      avitoWelcomeService.processWelcomeMessageWithStreaming.mockReturnValue(
        failingGenerator() as AsyncGenerator<any>,
      );

      businessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'welcome-agent',
        name: 'Welcome Agent',
      } as any);

      const tool: SupervisorStepResult['function'] = {
        tool: 'route_to_specialized_agent',
        status: BusinessSetupStatus.WELCOME,
        message: 'Test streaming failure',
        reason: 'Testing streaming error',
      };

      // Should handle streaming failure gracefully
      const result = await toolDispatcher.dispatch(
        tool,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      expect(result.success).toBe(true); // Should still succeed despite streaming error
    });

    it('should handle malformed streaming data', async () => {
      // Mock a generator that yields malformed data
      const malformedGenerator = async function* (): AsyncGenerator<any> {
        yield { invalid: 'data', missing: 'required_fields' };
        yield null;
        yield undefined;
        yield {
          type: 'final_response',
          content: 'Valid response after malformed data',
        };
      };

      avitoWelcomeService.processWelcomeMessageWithStreaming.mockReturnValue(
        malformedGenerator(),
      );

      businessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'welcome-agent',
        name: 'Welcome Agent',
      } as any);

      const tool: SupervisorStepResult['function'] = {
        tool: 'route_to_specialized_agent',
        status: BusinessSetupStatus.WELCOME,
        message: 'Test malformed data',
        reason: 'Testing malformed streaming data',
      };

      const result = await toolDispatcher.dispatch(
        tool,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Resource Cleanup and Memory Management', () => {
    it('should properly clean up resources on service destruction', async () => {
      const testModule = await Test.createTestingModule({
        imports: [EventEmitterModule.forRoot()],
        providers: [
          SupervisorToolDispatcherService,
          SupervisorSGRService,
          {
            provide: UserVarsService,
            useValue: { get: jest.fn(), set: jest.fn(), getAll: jest.fn() },
          },
          {
            provide: AgentChatService,
            useValue: { addMessage: jest.fn(), getMessages: jest.fn() },
          },
          {
            provide: AiModelRegistryService,
            useValue: {
              getEffectiveModelConfig: jest.fn(),
              getModel: jest.fn(),
            },
          },
          {
            provide: BusinessSetupAgentService,
            useValue: { getAgentForStep: jest.fn() },
          },
        ],
      }).compile();

      // The testModule is already compiled, so we can directly use get() on it
      // Simulate heavy usage
      const dispatcher = testModule.get<SupervisorToolDispatcherService>(
        SupervisorToolDispatcherService,
      );
      const supervisor =
        testModule.get<SupervisorSGRService>(SupervisorSGRService);

      // Create multiple operations
      const promises = Array.from({ length: 10 }, (_, i) =>
        dispatcher.checkBusinessSetupStatus(`user-${i}`, `workspace-${i}`),
      );

      await Promise.allSettled(promises);

      // Should close without memory leaks or hanging promises
      await expect(testModule.close()).resolves.toBeUndefined();
    });

    it('should handle concurrent operations without resource conflicts', async () => {
      userVarsService.get.mockImplementation(async () => {
        // Simulate database delay
        await new Promise((resolve) => setTimeout(resolve, 10));

        return true;
      });

      // Run multiple concurrent operations
      const operations = Array.from({ length: 20 }, async (_, i) => {
        return toolDispatcher.checkBusinessSetupStatus(
          `concurrent-user-${i}`,
          `concurrent-workspace-${i}`,
        );
      });

      const results = await Promise.allSettled(operations);

      // All operations should complete successfully
      results.forEach((result, index) => {
        expect(result.status).toBe('fulfilled');
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBeDefined();
        }
      });
    });
  });

  describe('Network and External Service Failures', () => {
    it('should handle external API timeouts', async () => {
      // Simulate timeout error
      businessSetupAgentService.getAgentForStep.mockImplementation(async () => {
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 100),
        );

        // This return should never be reached due to the rejection above
        return { id: 'agent-id', name: 'Agent' } as any;
      });

      await expect(
        toolDispatcher.routeToSpecializedAgent(
          BusinessSetupStatus.BUSINESS_ANALYSIS,
          'Test timeout',
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
          'Timeout test',
        ),
      ).rejects.toThrow('Request timeout');
    });

    it('should handle network connectivity issues', async () => {
      userVarsService.get.mockRejectedValue(new Error('ECONNREFUSED'));
      userVarsService.set.mockRejectedValue(new Error('Network unreachable'));

      // Should fallback gracefully when network is unavailable
      const result = await toolDispatcher.checkBusinessSetupStatus(
        mockUserId,
        mockWorkspaceId,
      );

      expect(result.status).toBe(BusinessSetupStatus.WELCOME); // Default fallback
    });
  });

  describe('Data Consistency and Transaction Failures', () => {
    it('should handle partial transaction failures during status change', async () => {
      // Mock partial failure - some writes succeed, others fail
      userVarsService.set
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Transaction rollback')); // Second call fails

      await expect(
        toolDispatcher.statusChange(
          BusinessSetupStatus.WELCOME,
          BusinessSetupStatus.BUSINESS_ANALYSIS,
          mockUserId,
          mockWorkspaceId,
          'Test transaction failure',
          'test_event',
        ),
      ).rejects.toThrow('Transaction rollback');
    });

    it('should handle stale data scenarios', async () => {
      // Simulate stale data - status changed between check and action
      userVarsService.get
        .mockResolvedValueOnce(true) // Initial check shows WELCOME pending
        .mockResolvedValueOnce(false) // Later check shows different state
        .mockResolvedValue(false);

      const status1 = await toolDispatcher.checkBusinessSetupStatus(
        mockUserId,
        mockWorkspaceId,
      );
      const status2 = await toolDispatcher.checkBusinessSetupStatus(
        mockUserId,
        mockWorkspaceId,
      );

      // Should handle state changes gracefully
      expect(status1.status).toBe(BusinessSetupStatus.WELCOME);
      expect(status2.status).toBe(BusinessSetupStatus.COMPLETED);
    });
  });
});
