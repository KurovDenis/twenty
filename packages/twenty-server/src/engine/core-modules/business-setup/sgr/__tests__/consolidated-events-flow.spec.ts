import { Test, type TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';

import { type BusinessSetupKeyValueTypeMap } from '../../business-setup.service';

// Import services
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';
import {
  AvitoErrorRecoveryService,
  AvitoErrorType,
} from '../services/avito-error-recovery.service';
import { AvitoWorkflowHealthService } from '../services/avito-workflow-health.service';

// Import event types and constants
import {
  BUSINESS_SETUP_EVENTS,
  type BusinessSetupEvent,
  type WelcomeChatCreatedEvent,
  isValidBusinessSetupEvent,
  isWelcomeChatCreatedEvent,
  isOnboardingStatusChangedEvent,
} from '../../events/business-setup.events';

// Import workflow types
import { AvitoWorkflowState } from '../types/avito-workflow-context';

interface EventCapture {
  event: string;
  payload: any;
  timestamp: Date;
}

describe('Consolidated Business Setup Events Flow Tests', () => {
  let avitoWelcomeService: AvitoWelcomeSGRService;
  let toolDispatcherService: AvitoWelcomeToolDispatcherService;
  let errorRecoveryService: AvitoErrorRecoveryService;
  let healthService: AvitoWorkflowHealthService;

  let mockUserVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockHttpTool: jest.Mocked<HttpTool>;

  let capturedEvents: EventCapture[] = [];

  const mockUserId = 'event-test-user-123';
  const mockWorkspaceId = 'event-test-workspace-123';
  const mockThreadId = 'event-test-thread-123';

  beforeEach(async () => {
    capturedEvents = [];

    // Mock services
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(true),
    } as any;

    mockAgentChatService = {
      addMessage: jest.fn().mockResolvedValue({ id: 'msg-123' }),
      getMessages: jest.fn().mockResolvedValue([]),
    } as any;

    mockAiModelRegistryService = {
      getEffectiveModelConfig: jest.fn().mockReturnValue({
        modelId: 'google/gemini-2.5-flash',
        provider: 'google',
      }),
      getModel: jest.fn().mockReturnValue({
        modelId: 'google/gemini-2.5-flash',
        model: {},
      }),
    } as any;

    // Mock EventEmitter with event capture
    mockEventEmitter = {
      emit: jest.fn().mockImplementation((event: string, payload: any) => {
        capturedEvents.push({
          event,
          payload,
          timestamp: new Date(),
        });

        return true;
      }),
      on: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    mockHttpTool = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
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
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: HttpTool,
          useValue: mockHttpTool,
        },
      ],
    }).compile();

    avitoWelcomeService = module.get<AvitoWelcomeSGRService>(
      AvitoWelcomeSGRService,
    );
    toolDispatcherService = module.get<AvitoWelcomeToolDispatcherService>(
      AvitoWelcomeToolDispatcherService,
    );
    errorRecoveryService = module.get<AvitoErrorRecoveryService>(
      AvitoErrorRecoveryService,
    );
    healthService = module.get<AvitoWorkflowHealthService>(
      AvitoWorkflowHealthService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    capturedEvents = [];
  });

  describe('Event Constants and Types Validation', () => {
    it('should have all required event constants defined', () => {
      expect(BUSINESS_SETUP_EVENTS.ONBOARDING_STATUS_CHANGED).toBe(
        'onboarding.status.changed',
      );
      expect(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED).toBe(
        'ai-agent.welcome.chat-creation-started',
      );
      expect(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED).toBe(
        'ai-agent.welcome.chat-created',
      );
      expect(BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_ROUTE_MESSAGE).toBe(
        'business-setup.route-message',
      );
      expect(BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE).toBe(
        'supervisor.process-message',
      );
      expect(BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_STATUS_CHANGED).toBe(
        'business-setup.status-changed',
      );
    });

    it('should validate business setup event structure correctly', () => {
      const validEvent: BusinessSetupEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        timestamp: new Date(),
        metadata: { test: 'data' },
      };

      expect(isValidBusinessSetupEvent(validEvent)).toBe(true);

      const invalidEvent = {
        userId: mockUserId,
        // Missing workspaceId and timestamp
      };

      expect(isValidBusinessSetupEvent(invalidEvent)).toBe(false);
    });

    it('should correctly identify specific event types', () => {
      const welcomeChatEvent: WelcomeChatCreatedEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        timestamp: new Date(),
        threadId: mockThreadId,
        aiResponse: 'Welcome response',
      };

      expect(isWelcomeChatCreatedEvent(welcomeChatEvent)).toBe(true);
      expect(isOnboardingStatusChangedEvent(welcomeChatEvent)).toBe(false);
    });
  });

  describe('Workflow Start and Initialization Events', () => {
    it('should emit workflow started events correctly', () => {
      healthService.onWorkflowStarted({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        timestamp: new Date(),
      });

      const startedEvents = capturedEvents.filter((e) =>
        e.event.includes('workflow'),
      );

      expect(startedEvents.length).toBeGreaterThan(0);
    });

    it('should emit welcome chat creation events', async () => {
      await avitoWelcomeService.processWelcomeMessage(
        'Привет! Хочу настроить Avito',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const chatEvents = capturedEvents.filter(
        (e) =>
          e.event ===
            BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED ||
          e.event === BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
      );

      expect(chatEvents.length).toBeGreaterThan(0);

      // Verify event payload structure
      chatEvents.forEach((event) => {
        expect(event.payload).toHaveProperty('userId', mockUserId);
        expect(event.payload).toHaveProperty('workspaceId', mockWorkspaceId);
        expect(event.payload).toHaveProperty('timestamp');
      });
    });
  });

  describe('User Message and AI Response Events', () => {
    it('should emit user message received events', async () => {
      const userMessage =
        "CLIENT_ID = 'test' CLIENT_SECRET = 'test_secret_with_enough_length'";

      await avitoWelcomeService.processWelcomeMessage(
        userMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const messageEvents = capturedEvents.filter(
        (e) =>
          e.event ===
          BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED,
      );

      expect(messageEvents.length).toBeGreaterThan(0);

      const event = messageEvents[0];

      expect(event.payload).toHaveProperty('userId', mockUserId);
      expect(event.payload).toHaveProperty('threadId', mockThreadId);
      expect(event.payload).toHaveProperty('message');
    });

    it('should emit AI response generated events', async () => {
      await avitoWelcomeService.processWelcomeMessage(
        'Привет!',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const responseEvents = capturedEvents.filter(
        (e) =>
          e.event ===
          BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_AI_RESPONSE_GENERATED,
      );

      expect(responseEvents.length).toBeGreaterThan(0);

      const event = responseEvents[0];

      expect(event.payload).toHaveProperty('userId', mockUserId);
      expect(event.payload).toHaveProperty('threadId', mockThreadId);
      expect(event.payload).toHaveProperty('response');
      expect(event.payload).toHaveProperty('context');
    });
  });

  describe('State Transition Events', () => {
    it('should emit business setup step transition events', () => {
      healthService.onWorkflowStateChanged({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        fromState: AvitoWorkflowState.INIT,
        toState: AvitoWorkflowState.GREETING_SENT,
        executionTimeMs: 150,
        timestamp: new Date(),
      });

      const transitionEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_STEP_TRANSITION,
      );

      expect(transitionEvents.length).toBeGreaterThan(0);

      const event = transitionEvents[0];

      expect(event.payload).toHaveProperty('fromStep');
      expect(event.payload).toHaveProperty('toStep');
      expect(event.payload).toHaveProperty('reason');
    });

    it('should emit supervisor status transition events', () => {
      // Simulate supervisor status change
      mockEventEmitter.emit(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_STATUS_TRANSITION,
        {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          timestamp: new Date(),
          threadId: mockThreadId,
          fromStatus: 'IDLE',
          toStatus: 'PROCESSING',
          reason: 'User message received',
          automatic: true,
        },
      );

      const supervisorEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.SUPERVISOR_STATUS_TRANSITION,
      );

      expect(supervisorEvents.length).toBe(1);

      const event = supervisorEvents[0];

      expect(event.payload).toHaveProperty('fromStatus', 'IDLE');
      expect(event.payload).toHaveProperty('toStatus', 'PROCESSING');
      expect(event.payload).toHaveProperty('automatic', true);
    });
  });

  describe('Error and Recovery Events', () => {
    it('should emit error recovery events', async () => {
      // Simulate error recovery
      healthService.onErrorRecoveryStarted({
        errorType: AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        attemptCount: 1,
        timestamp: new Date(),
      });

      const recoveryEvents = capturedEvents.filter((e) =>
        e.event.includes('error.recovery'),
      );

      expect(recoveryEvents.length).toBeGreaterThan(0);

      const event = recoveryEvents[0];

      expect(event.payload).toHaveProperty(
        'errorType',
        AvitoErrorType.INVALID_CREDENTIAL_FORMAT,
      );
      expect(event.payload).toHaveProperty('attemptCount', 1);
    });

    it('should emit supervisor error events', () => {
      // Simulate supervisor error
      mockEventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED, {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        timestamp: new Date(),
        threadId: mockThreadId,
        errorType: 'VALIDATION_ERROR',
        errorMessage: 'Invalid input format',
        context: { step: 'credential_validation' },
        recoverable: true,
      });

      const errorEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED,
      );

      expect(errorEvents.length).toBe(1);

      const event = errorEvents[0];

      expect(event.payload).toHaveProperty('errorType', 'VALIDATION_ERROR');
      expect(event.payload).toHaveProperty('recoverable', true);
    });
  });

  describe('Completion and Success Events', () => {
    it('should emit workflow completion events', () => {
      healthService.onWorkflowCompleted({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        success: true,
        credentialsValidated: true,
        credentialsStored: true,
        totalExecutionTimeMs: 5000,
        timestamp: new Date(),
      });

      const completionEvents = capturedEvents.filter(
        (e) => e.event.includes('completed') || e.event.includes('completion'),
      );

      expect(completionEvents.length).toBeGreaterThan(0);

      // Find the specific completion event
      const completedEvent = completionEvents.find(
        (e) => e.payload.success === true,
      );

      expect(completedEvent).toBeDefined();
      expect(completedEvent!.payload).toHaveProperty(
        'credentialsValidated',
        true,
      );
      expect(completedEvent!.payload).toHaveProperty('credentialsStored', true);
    });

    it('should emit ready for next step events', async () => {
      // Process complete workflow to trigger next step readiness
      await avitoWelcomeService.processWelcomeMessage(
        "CLIENT_ID = 'test' CLIENT_SECRET = 'test_secret_with_enough_length'",
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      const nextStepEvents = capturedEvents.filter(
        (e) =>
          e.event === BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_READY_FOR_NEXT_STEP,
      );

      expect(nextStepEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Message Routing Events', () => {
    it('should emit route message events', () => {
      // Simulate message routing
      mockEventEmitter.emit(
        BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_ROUTE_MESSAGE,
        {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          timestamp: new Date(),
          threadId: mockThreadId,
          message: 'Route this message to appropriate handler',
          currentStatus: 'AWAITING_CREDENTIALS',
        },
      );

      const routingEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_ROUTE_MESSAGE,
      );

      expect(routingEvents.length).toBe(1);

      const event = routingEvents[0];

      expect(event.payload).toHaveProperty('message');
      expect(event.payload).toHaveProperty(
        'currentStatus',
        'AWAITING_CREDENTIALS',
      );
    });

    it('should emit supervisor process message events', () => {
      mockEventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE, {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        timestamp: new Date(),
        threadId: mockThreadId,
        message: 'Process this message',
      });

      const processEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
      );

      expect(processEvents.length).toBe(1);
      expect(processEvents[0].payload).toHaveProperty(
        'message',
        'Process this message',
      );
    });
  });

  describe('Agent Handoff Events', () => {
    it('should emit agent handoff events', () => {
      mockEventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF, {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        timestamp: new Date(),
        threadId: mockThreadId,
        fromAgent: 'supervisor',
        toAgent: 'avito_specialist',
        handoffReason: 'Specialized Avito integration required',
        contextPreserved: true,
        userMessage: 'Need help with Avito setup',
      });

      const handoffEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF,
      );

      expect(handoffEvents.length).toBe(1);

      const event = handoffEvents[0];

      expect(event.payload).toHaveProperty('fromAgent', 'supervisor');
      expect(event.payload).toHaveProperty('toAgent', 'avito_specialist');
      expect(event.payload).toHaveProperty('contextPreserved', true);
    });
  });

  describe('Event Flow Sequencing', () => {
    it('should emit events in correct chronological order for complete workflow', async () => {
      const startTime = Date.now();

      // Execute complete workflow and capture events
      healthService.onWorkflowStarted({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        timestamp: new Date(startTime),
      });

      await avitoWelcomeService.processWelcomeMessage(
        'Привет! Настраиваю Avito',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      await avitoWelcomeService.processWelcomeMessage(
        "CLIENT_ID = 'test' CLIENT_SECRET = 'test_secret_with_enough_length'",
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      healthService.onWorkflowCompleted({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        success: true,
        credentialsValidated: true,
        credentialsStored: true,
        totalExecutionTimeMs: 5000,
        timestamp: new Date(startTime + 5000),
      });

      // Verify events are in chronological order
      for (let i = 1; i < capturedEvents.length; i++) {
        expect(capturedEvents[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          capturedEvents[i - 1].timestamp.getTime(),
        );
      }

      // Verify specific event sequence
      const eventTypes = capturedEvents.map((e) => e.event);

      // Should include workflow start, message processing, and completion
      expect(eventTypes).toContain(
        BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED,
      );
      expect(eventTypes).toContain(
        BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_AI_RESPONSE_GENERATED,
      );
    });
  });

  describe('Event Payload Validation', () => {
    it('should include all required fields in event payloads', async () => {
      await avitoWelcomeService.processWelcomeMessage(
        'Test message',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      // Validate that all captured events have required base fields
      capturedEvents.forEach((eventCapture) => {
        const { payload } = eventCapture;

        // All business setup events should have these base fields
        expect(payload).toHaveProperty('userId');
        expect(payload).toHaveProperty('workspaceId');
        expect(payload).toHaveProperty('timestamp');
        expect(payload.timestamp).toBeInstanceOf(Date);

        // Verify userId and workspaceId are correct
        expect(payload.userId).toBe(mockUserId);
        expect(payload.workspaceId).toBe(mockWorkspaceId);
      });
    });

    it('should include event-specific fields in specialized events', () => {
      // Test user message event
      mockEventEmitter.emit(
        BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED,
        {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          timestamp: new Date(),
          threadId: mockThreadId,
          message: 'Test message',
        },
      );

      const messageEvent = capturedEvents.find(
        (e) =>
          e.event ===
          BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED,
      );

      expect(messageEvent).toBeDefined();
      expect(messageEvent!.payload).toHaveProperty('threadId', mockThreadId);
      expect(messageEvent!.payload).toHaveProperty('message', 'Test message');
    });
  });

  describe('Event Error Handling', () => {
    it('should handle malformed event payloads gracefully', () => {
      // Test with malformed payload
      const malformedPayload = {
        userId: mockUserId,
        // Missing required fields
      };

      expect(() => {
        mockEventEmitter.emit(
          BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_STATUS_CHANGED,
          malformedPayload,
        );
      }).not.toThrow();

      // Verify event was still captured
      const statusEvents = capturedEvents.filter(
        (e) => e.event === BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_STATUS_CHANGED,
      );

      expect(statusEvents.length).toBe(1);
    });
  });

  describe('Event Performance and Volume', () => {
    it('should handle high volume of events efficiently', async () => {
      const startTime = Date.now();
      const eventCount = 100;

      // Generate many events rapidly
      for (let i = 0; i < eventCount; i++) {
        mockEventEmitter.emit(BUSINESS_SETUP_EVENTS.CHAT_MESSAGE_ADDED, {
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          timestamp: new Date(),
          threadId: mockThreadId,
          message: `Message ${i}`,
          role: 'user',
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle 100 events in reasonable time (< 100ms)
      expect(duration).toBeLessThan(100);
      expect(capturedEvents.length).toBe(eventCount);
    });
  });
});
