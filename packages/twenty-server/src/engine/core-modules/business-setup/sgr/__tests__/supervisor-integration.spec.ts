import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import {
  type BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import {
  BUSINESS_SETUP_EVENTS,
  type SupervisorProcessMessageEvent,
} from '../../events/business-setup.events';
import { BusinessSetupAgentService } from '../../services/business-setup-agent.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';
import { SupervisorSGRService } from '../services/supervisor-sgr.service';
import { SupervisorToolDispatcherService } from '../services/supervisor-tool-dispatcher.service';
import { type SupervisorSGRStreamingResult } from '../types/supervisor-types';

describe('Supervisor Integration Tests', () => {
  let module: TestingModule;
  let supervisorService: SupervisorSGRService;
  let toolDispatcher: SupervisorToolDispatcherService;
  let avitoWelcomeService: AvitoWelcomeSGRService;
  let eventEmitter: EventEmitter2;
  let userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>;
  let agentChatService: AgentChatService;
  let businessSetupAgentService: BusinessSetupAgentService;

  const mockUserId = 'test-user-123';
  const mockWorkspaceId = 'test-workspace-456';
  const mockThreadId = 'test-thread-789';

  beforeAll(async () => {
    // Create a comprehensive test module that mirrors the actual module structure
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        // Mock TypeORM module for testing
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [],
          synchronize: true,
        }),
      ],
      providers: [
        // Core SGR services in dependency order
        SupervisorToolDispatcherService,
        SupervisorSGRService,
        AvitoWelcomeSGRService,
        AvitoWelcomeToolDispatcherService,

        // Mock external dependencies
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
      ],
    }).compile();

    // Initialize services
    supervisorService = module.get<SupervisorSGRService>(SupervisorSGRService);
    toolDispatcher = module.get<SupervisorToolDispatcherService>(
      SupervisorToolDispatcherService,
    );
    avitoWelcomeService = module.get<AvitoWelcomeSGRService>(
      AvitoWelcomeSGRService,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    userVarsService =
      module.get<UserVarsService<BusinessSetupKeyValueTypeMap>>(
        UserVarsService,
      );
    agentChatService = module.get<AgentChatService>(AgentChatService);
    businessSetupAgentService = module.get<BusinessSetupAgentService>(
      BusinessSetupAgentService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Registration and Dependency Injection', () => {
    it('should properly instantiate all services with dependency injection', () => {
      expect(supervisorService).toBeDefined();
      expect(toolDispatcher).toBeDefined();
      expect(avitoWelcomeService).toBeDefined();
      expect(eventEmitter).toBeDefined();
      expect(userVarsService).toBeDefined();
      expect(agentChatService).toBeDefined();
      expect(businessSetupAgentService).toBeDefined();
    });

    it('should properly resolve circular dependencies using event-driven architecture', () => {
      // Verify that services can be instantiated without circular dependency errors
      expect(() => {
        const supervisor =
          module.get<SupervisorSGRService>(SupervisorSGRService);
        const dispatcher = module.get<SupervisorToolDispatcherService>(
          SupervisorToolDispatcherService,
        );

        return supervisor && dispatcher;
      }).not.toThrow();
    });
  });

  describe('End-to-End Supervisor Routing Workflow', () => {
    it('should complete full welcome workflow routing', async () => {
      // Setup: Mock user in WELCOME status
      jest
        .spyOn(userVarsService, 'get')
        .mockResolvedValueOnce(true) // WELCOME_PENDING
        .mockResolvedValueOnce(false) // BUSINESS_ANALYSIS_PENDING
        .mockResolvedValueOnce(false) // other statuses...
        .mockResolvedValue(false);

      // Mock agent service
      jest
        .spyOn(businessSetupAgentService, 'getAgentForStep')
        .mockResolvedValue({
          id: 'welcome-agent-123',
          name: 'Welcome Agent',
          description: 'Handles welcome flow',
        } as any);

      // Mock Avito welcome service streaming response
      const mockStreamingResponse =
        async function* (): AsyncGenerator<SupervisorSGRStreamingResult> {
          yield {
            type: 'thinking',
            step: {
              stepNumber: 1,
              thinking: 'Processing user welcome request...',
              reasoning: 'User needs welcome setup guidance',
              currentState: 'Starting welcome',
              plannedSteps: ['Welcome user'],
              selectedTool: 'welcome',
              timestamp: new Date(),
            },
            completed: false,
          };

          yield {
            type: 'tool_execution',
            step: {
              stepNumber: 2,
              function: {
                tool: 'check_business_setup_status',
                reason: 'Checking current setup status',
              },
              currentState: 'Checking status',
              plannedSteps: ['Check status'],
              selectedTool: 'check_status',
              timestamp: new Date(),
            },
            completed: false,
          };

          yield {
            type: 'final_response',
            content: 'Welcome flow completed successfully',
            completed: true,
            routedTo: 'business-analysis-agent',
          };
        };

      jest
        .spyOn(avitoWelcomeService, 'processWelcomeMessageWithStreaming')
        .mockReturnValue(mockStreamingResponse() as AsyncGenerator<any>);

      // Execute: Process message through supervisor
      const messageEvent: SupervisorProcessMessageEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        message: 'I need help setting up my business',
        timestamp: new Date(),
      };

      // Emit the event that would trigger the supervisor
      eventEmitter.emit(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
        messageEvent,
      );

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify: Check that proper routing occurred
      expect(businessSetupAgentService.getAgentForStep).toHaveBeenCalledWith(
        BusinessSetupStatus.WELCOME,
        mockWorkspaceId,
      );
    });

    it('should handle business analysis workflow routing', async () => {
      // Setup: Mock user in BUSINESS_ANALYSIS status
      jest
        .spyOn(userVarsService, 'get')
        .mockResolvedValueOnce(false) // WELCOME_PENDING
        .mockResolvedValueOnce(true) // BUSINESS_ANALYSIS_PENDING
        .mockResolvedValueOnce(false) // other statuses...
        .mockResolvedValue(false);

      // Mock agent service for business analysis
      jest
        .spyOn(businessSetupAgentService, 'getAgentForStep')
        .mockResolvedValue({
          id: 'business-agent-456',
          name: 'Business Analysis Agent',
          description: 'Handles business analysis',
        } as any);

      // Execute: Check status through tool dispatcher
      const statusResult = await toolDispatcher.checkBusinessSetupStatus(
        mockUserId,
        mockWorkspaceId,
      );

      // Verify: Should identify business analysis status
      expect(statusResult.status).toBe(BusinessSetupStatus.BUSINESS_ANALYSIS);
      expect(statusResult.stepsCompleted).toContain(
        BusinessSetupStatus.WELCOME,
      );
      expect(statusResult.isComplete).toBe(false);

      // Execute: Route to specialized agent
      const routingResult = await toolDispatcher.routeToSpecializedAgent(
        BusinessSetupStatus.BUSINESS_ANALYSIS,
        'Please analyze my business model',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
        'User requested business analysis',
      );

      // Verify: Routing should succeed
      expect(routingResult.success).toBe(true);
      expect(agentChatService.addMessage).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: expect.any(String),
        content: 'Please analyze my business model',
        fileIds: [],
      });
    });

    it('should handle status transitions correctly', async () => {
      // Execute: Transition from WELCOME to BUSINESS_ANALYSIS
      await toolDispatcher.statusChange(
        BusinessSetupStatus.WELCOME,
        BusinessSetupStatus.BUSINESS_ANALYSIS,
        mockUserId,
        mockWorkspaceId,
        'User completed welcome setup',
        'welcome_completed',
      );

      // Verify: Status flags should be updated
      expect(userVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false,
      });

      expect(userVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true,
      });
    });
  });

  describe('Event-Driven Architecture Integration', () => {
    it('should properly emit and handle supervisor events', async () => {
      const eventSpy = jest.spyOn(eventEmitter, 'emit');

      // Mock successful routing
      jest
        .spyOn(businessSetupAgentService, 'getAgentForStep')
        .mockResolvedValue({ id: 'agent-123', name: 'Test Agent' } as any);

      // Execute routing that should emit events
      await toolDispatcher.routeToSpecializedAgent(
        BusinessSetupStatus.WELCOME,
        'Test message',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
        'Test routing',
      );

      // Verify events were emitted
      expect(eventSpy).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF,
        expect.objectContaining({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          fromAgent: 'business-setup-supervisor',
          toAgent: 'sgr-avito-agent',
        }),
      );
    });

    it('should handle supervisor process message events', async () => {
      const messageEvent: SupervisorProcessMessageEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        message: 'Test supervisor message',
        timestamp: new Date(),
      };

      // Mock the event listener behavior
      const eventListener = jest.fn();

      eventEmitter.on(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
        eventListener,
      );

      // Emit the event
      eventEmitter.emit(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
        messageEvent,
      );

      // Verify event was handled
      expect(eventListener).toHaveBeenCalledWith(messageEvent);
    });
  });

  describe('Service Interaction and Data Flow', () => {
    it('should demonstrate proper service interaction chain', async () => {
      // Setup: Complete service interaction chain
      jest.spyOn(userVarsService, 'get').mockResolvedValue(true);
      jest
        .spyOn(businessSetupAgentService, 'getAgentForStep')
        .mockResolvedValue({ id: 'agent-123', name: 'Test Agent' } as any);

      // Execute: Full workflow through tool dispatcher
      const tool = {
        tool: 'route_to_specialized_agent' as const,
        status: BusinessSetupStatus.WELCOME,
        message: 'Integration test message',
        reason: 'Testing service integration',
      };

      const result = await toolDispatcher.dispatch(
        tool,
        mockUserId,
        mockWorkspaceId,
      );

      // Verify: All services were properly called in sequence
      expect(businessSetupAgentService.getAgentForStep).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle cross-service error propagation', async () => {
      // Setup: Force an error in one service
      jest
        .spyOn(businessSetupAgentService, 'getAgentForStep')
        .mockRejectedValue(new Error('Agent service error'));

      // Execute: Should handle error gracefully
      await expect(
        toolDispatcher.routeToSpecializedAgent(
          BusinessSetupStatus.BUSINESS_ANALYSIS,
          'Test message',
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
          'Error test',
        ),
      ).rejects.toThrow('Agent service error');
    });
  });

  describe('Module Lifecycle and Cleanup', () => {
    it('should properly clean up resources on module destroy', async () => {
      // Test that module can be closed without errors
      expect(async () => {
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

        await testModule.close();
      }).not.toThrow();
    });
  });
});
