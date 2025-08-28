import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { SupervisorToolDispatcherService } from '../services/supervisor-tool-dispatcher.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { BusinessSetupAgentService } from '../../services/business-setup-agent.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import { BUSINESS_SETUP_EVENTS } from '../../events/business-setup.events';
import { 
  SupervisorStepResult,
  SupervisorToolExecutionResult,
  SupervisorException,
  SupervisorErrorType
} from '../types/supervisor-types';

describe('SupervisorToolDispatcherService', () => {
  let service: SupervisorToolDispatcherService;
  let mockUserVarsService: jest.Mocked<UserVarsService<BusinessSetupKeyValueTypeMap>>;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockBusinessSetupAgentService: jest.Mocked<BusinessSetupAgentService>;
  let mockAvitoWelcomeSGRService: jest.Mocked<AvitoWelcomeSGRService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-456';
  const mockThreadId = 'thread-789';

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

    mockBusinessSetupAgentService = {
      getAgentForStep: jest.fn(),
      createAgent: jest.fn(),
      updateAgent: jest.fn()
    } as any;

    mockAvitoWelcomeSGRService = {
      processWelcomeMessageWithStreaming: jest.fn()
    } as any;

    mockEventEmitter = {
      emit: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupervisorToolDispatcherService,
        { provide: UserVarsService, useValue: mockUserVarsService },
        { provide: AgentChatService, useValue: mockAgentChatService },
        { provide: BusinessSetupAgentService, useValue: mockBusinessSetupAgentService },
        { provide: AvitoWelcomeSGRService, useValue: mockAvitoWelcomeSGRService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<SupervisorToolDispatcherService>(SupervisorToolDispatcherService);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(service).toBeInstanceOf(SupervisorToolDispatcherService);
    });
  });

  describe('Tool Dispatch', () => {
    it('should dispatch check_business_setup_status tool successfully', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'check_business_setup_status',
        reason: 'Need to check current status'
      };

      // Mock user vars to return specific status flags
      mockUserVarsService.get
        .mockResolvedValueOnce(true)  // BUSINESS_SETUP_WELCOME_PENDING
        .mockResolvedValueOnce(false) // BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING
        .mockResolvedValueOnce(false); // other statuses...

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
      expect(mockUserVarsService.get).toHaveBeenCalled();
    });

    it('should dispatch route_to_specialized_agent tool for WELCOME status', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'route_to_specialized_agent',
        target_status: BusinessSetupStatus.WELCOME,
        message: 'Welcome user',
        reason: 'User needs welcome setup'
      };

      // Mock agent service
      mockBusinessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'agent-123',
        name: 'Welcome Agent'
      } as any);

      // Mock SGR service generator
      const mockGenerator = (async function* () {
        yield { type: 'thinking', step: { stepNumber: 1 } };
        yield { type: 'final_response', content: 'Welcome complete' };
      })();
      
      mockAvitoWelcomeSGRService.processWelcomeMessageWithStreaming.mockReturnValue(mockGenerator);

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(mockBusinessSetupAgentService.getAgentForStep).toHaveBeenCalledWith(
        BusinessSetupStatus.WELCOME,
        mockWorkspaceId
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF,
        expect.objectContaining({
          userId: mockUserId,
          fromAgent: 'business-setup-supervisor',
          toAgent: 'sgr-avito-agent'
        })
      );
    });

    it('should dispatch process_directly tool', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'process_directly',
        response: 'Direct response to user',
        reason: 'Simple informational request'
      };

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('response', 'Direct response to user');
    });

    it('should dispatch status_change tool', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'status_change',
        from_status: BusinessSetupStatus.WELCOME,
        to_status: BusinessSetupStatus.BUSINESS_ANALYSIS,
        reason: 'User completed welcome setup',
        trigger_event: 'welcome_completed'
      };

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true
      });
    });

    it('should dispatch complete_routing tool', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'complete_routing',
        success: true,
        final_message: 'Routing completed successfully',
        routed_to: 'business-analysis-agent'
      };

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('completed', true);
      expect(result.data).toHaveProperty('routedTo', 'business-analysis-agent');
    });

    it('should throw error for unknown tool type', async () => {
      const tool: any = {
        tool: 'unknown_tool',
        reason: 'Testing unknown tool'
      };

      await expect(service.dispatch(tool, mockUserId, mockWorkspaceId))
        .rejects
        .toThrow(SupervisorException);
    });
  });

  describe('Business Setup Status Check', () => {
    it('should return WELCOME status when welcome is pending', async () => {
      mockUserVarsService.get
        .mockResolvedValueOnce(true)  // WELCOME_PENDING
        .mockResolvedValueOnce(false); // BUSINESS_ANALYSIS_PENDING

      const status = await service.checkBusinessSetupStatus(mockUserId, mockWorkspaceId);

      expect(status.status).toBe(BusinessSetupStatus.WELCOME);
      expect(status.isComplete).toBe(false);
      expect(status.stepsCompleted).toEqual([]);
    });

    it('should return BUSINESS_ANALYSIS status when business analysis is pending', async () => {
      mockUserVarsService.get
        .mockResolvedValueOnce(false) // WELCOME_PENDING
        .mockResolvedValueOnce(true)  // BUSINESS_ANALYSIS_PENDING
        .mockResolvedValueOnce(false); // SALES_FUNNEL_DESIGN_PENDING

      const status = await service.checkBusinessSetupStatus(mockUserId, mockWorkspaceId);

      expect(status.status).toBe(BusinessSetupStatus.BUSINESS_ANALYSIS);
      expect(status.stepsCompleted).toContain(BusinessSetupStatus.WELCOME);
    });

    it('should return COMPLETED status when no steps are pending', async () => {
      // Mock all status checks to return false (nothing pending)
      mockUserVarsService.get.mockResolvedValue(false);

      const status = await service.checkBusinessSetupStatus(mockUserId, mockWorkspaceId);

      expect(status.status).toBe(BusinessSetupStatus.COMPLETED);
      expect(status.isComplete).toBe(true);
    });

    it('should handle errors gracefully and return default status', async () => {
      mockUserVarsService.get.mockRejectedValue(new Error('Database connection failed'));

      const status = await service.checkBusinessSetupStatus(mockUserId, mockWorkspaceId);

      expect(status.status).toBe(BusinessSetupStatus.WELCOME);
      expect(status.isComplete).toBe(false);
    });
  });

  describe('Specialized Agent Routing', () => {
    it('should route to specialized agent for non-WELCOME status', async () => {
      mockBusinessSetupAgentService.getAgentForStep.mockResolvedValue({
        id: 'agent-456',
        name: 'Business Analysis Agent'
      } as any);

      const result = await service.routeToSpecializedAgent(
        BusinessSetupStatus.BUSINESS_ANALYSIS,
        'Analyze my business',
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
        'User requested business analysis'
      );

      expect(result.success).toBe(true);
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: expect.any(String),
        content: 'Analyze my business',
        fileIds: []
      });
    });

    it('should handle agent routing errors', async () => {
      mockBusinessSetupAgentService.getAgentForStep.mockRejectedValue(
        new Error('Agent not found')
      );

      await expect(
        service.routeToSpecializedAgent(
          BusinessSetupStatus.BUSINESS_ANALYSIS,
          'Test message',
          mockUserId,
          mockWorkspaceId,
          mockThreadId,
          'Test routing'
        )
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should wrap non-SupervisorException errors', async () => {
      const tool: SupervisorStepResult['function'] = {
        tool: 'check_business_setup_status',
        reason: 'Testing error handling'
      };

      mockUserVarsService.get.mockRejectedValue(new Error('Generic error'));

      const result = await service.dispatch(tool, mockUserId, mockWorkspaceId);

      // Should handle error gracefully and return default status
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
    });

    it('should preserve SupervisorException errors', async () => {
      const tool: any = {
        tool: 'invalid_tool'
      };

      await expect(service.dispatch(tool, mockUserId, mockWorkspaceId))
        .rejects
        .toBeInstanceOf(SupervisorException);
    });
  });

  describe('Status Transition', () => {
    it('should clear previous status flags when changing status', async () => {
      const fromStatus = BusinessSetupStatus.WELCOME;
      const toStatus = BusinessSetupStatus.BUSINESS_ANALYSIS;

      await service.statusChange(
        fromStatus,
        toStatus,
        mockUserId,
        mockWorkspaceId,
        'User completed welcome',
        'welcome_completed'
      );

      // Should clear welcome pending flag
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false
      });

      // Should set business analysis pending flag
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true
      });
    });
  });
});