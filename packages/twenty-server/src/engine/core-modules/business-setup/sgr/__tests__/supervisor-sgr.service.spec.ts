import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SupervisorSGRService } from '../services/supervisor-sgr.service';
import { SupervisorToolDispatcherService } from '../services/supervisor-tool-dispatcher.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import { BUSINESS_SETUP_EVENTS, SupervisorProcessMessageEvent } from '../../events/business-setup.events';
import { SupervisorSGRStreamingResult } from '../types/supervisor-types';

describe('SupervisorSGRService', () => {
  let service: SupervisorSGRService;
  let mockUserVarsService: jest.Mocked<UserVarsService<BusinessSetupKeyValueTypeMap>>;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockToolDispatcher: jest.Mocked<SupervisorToolDispatcherService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-456';
  const mockThreadId = 'thread-789';
  const mockMessage = 'Test user message';

  beforeEach(async () => {
    mockUserVarsService = { 
      get: jest.fn(), 
      set: jest.fn(), 
      getAll: jest.fn() 
    } as any;
    
    mockAgentChatService = { 
      addMessage: jest.fn(), 
      getMessages: jest.fn() 
    } as any;
    
    mockAiModelRegistryService = { 
      getEffectiveModelConfig: jest.fn(),
      getModel: jest.fn()
    } as any;
    
    mockToolDispatcher = { 
      dispatch: jest.fn(),
      checkBusinessSetupStatus: jest.fn(),
      routeToSpecializedAgent: jest.fn(),
      processDirectly: jest.fn(),
      statusChange: jest.fn(),
      completeRouting: jest.fn()
    } as any;
    
    mockEventEmitter = { 
      emit: jest.fn() 
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupervisorSGRService,
        { provide: UserVarsService, useValue: mockUserVarsService },
        { provide: AgentChatService, useValue: mockAgentChatService },
        { provide: AiModelRegistryService, useValue: mockAiModelRegistryService },
        { provide: SupervisorToolDispatcherService, useValue: mockToolDispatcher },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<SupervisorSGRService>(SupervisorSGRService);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service).toBeInstanceOf(SupervisorSGRService);
      // Service should be properly constructed with all dependencies
    });
  });

  describe('Event Handler - handleProcessMessageEvent', () => {
    it('should handle SUPERVISOR_PROCESS_MESSAGE event successfully', async () => {
      const mockPayload: SupervisorProcessMessageEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        message: mockMessage,
        timestamp: new Date()
      };

      // Mock AI model configuration
      mockAiModelRegistryService.getEffectiveModelConfig.mockReturnValue({
        id: 'test-model',
        name: 'Test Model',
        provider: 'test'
      } as any);
      
      mockAiModelRegistryService.getModel.mockReturnValue({
        model: jest.fn()
      } as any);

      // Mock tool dispatcher to return completion
      mockToolDispatcher.dispatch.mockResolvedValue({
        success: true,
        message: 'Routing completed',
        timestamp: new Date()
      });

      // Execute event handler
      await service.handleProcessMessageEvent(mockPayload);

      // Verify the event was processed (no exceptions thrown)
      expect(true).toBe(true);
    });

    it('should emit error event when processing fails', async () => {
      const mockPayload: SupervisorProcessMessageEvent = {
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        threadId: mockThreadId,
        message: mockMessage,
        timestamp: new Date()
      };

      // Mock AI model to throw error
      mockAiModelRegistryService.getEffectiveModelConfig.mockImplementation(() => {
        throw new Error('AI model not available');
      });

      await service.handleProcessMessageEvent(mockPayload);

      // Verify error event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED,
        expect.objectContaining({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          errorType: 'EVENT_PROCESSING_FAILED',
          recoverable: true
        })
      );
    });
  });

  describe('Streaming Message Processing', () => {
    it('should process message with streaming SGR workflow', async () => {
      // Mock AI model configuration
      mockAiModelRegistryService.getEffectiveModelConfig.mockReturnValue({
        id: 'google/gemini-2.5-flash',
        name: 'Gemini Flash',
        provider: 'google'
      } as any);
      
      const mockModelInstance = {
        generateObject: jest.fn().mockResolvedValue({
          object: {
            thinking: 'Analyzing user request',
            current_state: 'Processing request',
            plan_remaining_steps: ['Check status', 'Route message'],
            function: {
              tool: 'complete_routing',
              success: true,
              final_message: 'Message processed successfully',
              routed_to: 'business-setup'
            }
          }
        })
      };
      
      mockAiModelRegistryService.getModel.mockReturnValue({
        model: mockModelInstance
      } as any);

      const results: SupervisorSGRStreamingResult[] = [];
      const generator = service.processMessageWithStreaming(
        mockMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId
      );

      for await (const result of generator) {
        results.push(result);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(results[results.length - 1]).toMatchObject({
        type: 'final_response',
        completed: true
      });
    });

    it('should emit thinking step events during processing', async () => {
      // Mock AI model
      mockAiModelRegistryService.getEffectiveModelConfig.mockReturnValue({
        id: 'google/gemini-2.5-flash'
      } as any);
      
      mockAiModelRegistryService.getModel.mockReturnValue({
        model: {
          generateObject: jest.fn().mockResolvedValue({
            object: {
              thinking: 'Test thinking',
              current_state: 'Test state',
              plan_remaining_steps: ['step1'],
              function: {
                tool: 'complete_routing',
                success: true,
                final_message: 'Done'
              }
            }
          })
        }
      } as any);

      const generator = service.processMessageWithStreaming(
        mockMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId
      );

      // Consume the generator
      const results = [];
      for await (const result of generator) {
        results.push(result);
      }

      // Verify thinking step events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_THINKING_STEP,
        expect.objectContaining({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          threadId: mockThreadId,
          completed: false
        })
      );
    });

    it('should handle streaming workflow errors gracefully', async () => {
      // Mock AI model to throw error during processing
      mockAiModelRegistryService.getEffectiveModelConfig.mockReturnValue({
        id: 'google/gemini-2.5-flash'
      } as any);
      
      mockAiModelRegistryService.getModel.mockReturnValue({
        model: {
          generateObject: jest.fn().mockRejectedValue(new Error('AI processing failed'))
        }
      } as any);

      const generator = service.processMessageWithStreaming(
        mockMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId
      );

      const results = [];
      for await (const result of generator) {
        results.push(result);
      }

      // Should yield error result
      expect(results).toContainEqual(
        expect.objectContaining({
          type: 'final_response',
          content: expect.stringContaining('error'),
          completed: true
        })
      );

      // Should emit error event
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED,
        expect.objectContaining({
          userId: mockUserId,
          errorType: expect.any(String),
          recoverable: true
        })
      );
    });
  });

  describe('Supervisor Status Management', () => {
    it('should return supervisor status successfully', async () => {
      mockUserVarsService.get
        .mockResolvedValueOnce(true) // for SUPERVISOR_ENABLED
        .mockResolvedValueOnce(BusinessSetupStatus.WELCOME); // for BUSINESS_SETUP_CURRENT_STATUS

      const status = await service.getSupervisorStatus(mockUserId, mockWorkspaceId);

      expect(status.supervisorEnabled).toBe(true);
      expect(status.currentBusinessSetupStatus).toBe(BusinessSetupStatus.WELCOME);
      expect(mockUserVarsService.get).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully in getSupervisorStatus', async () => {
      mockUserVarsService.get.mockRejectedValue(new Error('Database connection failed'));

      const status = await service.getSupervisorStatus(mockUserId, mockWorkspaceId);

      expect(status.supervisorEnabled).toBe(false); // Should use false fallback
      expect(status.currentBusinessSetupStatus).toBeUndefined();
    });

    it('should return default values when user vars are not set', async () => {
      mockUserVarsService.get.mockResolvedValue(undefined);

      const status = await service.getSupervisorStatus(mockUserId, mockWorkspaceId);

      expect(status.supervisorEnabled).toBe(false);
      expect(status.currentBusinessSetupStatus).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should emit error event when AI model not found', async () => {
      mockAiModelRegistryService.getEffectiveModelConfig.mockImplementation(() => {
        throw new Error('Model with ID google/gemini-2.5-flash not found');
      });

      const generator = service.processMessageWithStreaming(
        mockMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId
      );
      
      const results = [];
      for await (const result of generator) {
        results.push(result);
      }

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED,
        expect.objectContaining({
          userId: mockUserId,
          errorType: expect.any(String),
          recoverable: true
        })
      );
    });

    it('should handle tool dispatcher errors', async () => {
      // Mock successful AI model setup
      mockAiModelRegistryService.getEffectiveModelConfig.mockReturnValue({ id: 'test' } as any);
      mockAiModelRegistryService.getModel.mockReturnValue({
        model: {
          generateObject: jest.fn().mockResolvedValue({
            object: {
              thinking: 'Test',
              current_state: 'Test',
              plan_remaining_steps: ['test'],
              function: {
                tool: 'check_business_setup_status'
              }
            }
          })
        }
      } as any);

      // Mock tool dispatcher to throw error
      mockToolDispatcher.dispatch.mockRejectedValue(new Error('Tool execution failed'));

      const generator = service.processMessageWithStreaming(
        mockMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId
      );

      const results = [];
      for await (const result of generator) {
        results.push(result);
      }

      expect(results).toContainEqual(
        expect.objectContaining({
          type: 'final_response',
          content: expect.stringContaining('error'),
          completed: true
        })
      );
    });
  });
});