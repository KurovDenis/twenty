import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { BusinessSetupWelcomeAgentService } from './services/business-setup-welcome-agent.service';

describe('BusinessSetupWelcomeAgentService', () => {
  let service: BusinessSetupWelcomeAgentService;
  let eventEmitter: EventEmitter2;
  let agentExecutionService: AgentExecutionService;
  let agentChatService: AgentChatService;
  let userService: UserService;
  let workspaceService: WorkspaceService;

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockAgentExecutionService = {
    executeAgent: jest.fn(),
  };

  const mockAgentChatService = {
    createThread: jest.fn(),
    addMessage: jest.fn(),
  };

  const mockUserService = {
    findById: jest.fn(),
  };

  const mockWorkspaceService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupWelcomeAgentService,
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: AgentExecutionService,
          useValue: mockAgentExecutionService,
        },
        {
          provide: AgentChatService,
          useValue: mockAgentChatService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: WorkspaceService,
          useValue: mockWorkspaceService,
        },
      ],
    }).compile();

    service = module.get<BusinessSetupWelcomeAgentService>(BusinessSetupWelcomeAgentService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    agentExecutionService = module.get<AgentExecutionService>(AgentExecutionService);
    agentChatService = module.get<AgentChatService>(AgentChatService);
    userService = module.get<UserService>(UserService);
    workspaceService = module.get<WorkspaceService>(WorkspaceService);

    // Mock logger
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleOnboardingStatusChange', () => {
    it('should create welcome chat when onboarding status changes to COMPLETED', async () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'BOOK_ONBOARDING',
        timestamp: new Date(),
      };

      const mockThread = { id: 'thread-123' };
      const mockAIResponse = { content: 'Welcome message' };

      mockAgentChatService.createThread.mockResolvedValue(mockThread);
      mockAgentExecutionService.executeAgent.mockResolvedValue(mockAIResponse);
      mockAgentChatService.addMessage.mockResolvedValue({});
      mockUserService.findById.mockResolvedValue({ firstName: 'John', email: 'john@example.com' });
      mockWorkspaceService.findById.mockResolvedValue({ displayName: 'Test Workspace' });

      // Act
      await service['handleOnboardingStatusChange'](payload);

      // Assert
      expect(mockAgentChatService.createThread).toHaveBeenCalledWith('welcome-agent', 'workspace-123');
      expect(mockAgentExecutionService.executeAgent).toHaveBeenCalled();
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith({
        threadId: 'thread-123',
        role: 'assistant',
        content: 'Welcome message',
        fileIds: []
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('ai-agent.welcome.chat-created', expect.objectContaining({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        threadId: 'thread-123',
        aiResponse: 'Welcome message'
      }));
    });

    it('should not create welcome chat when onboarding status is not COMPLETED', async () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'INVITE_TEAM',
        previousStatus: 'SYNC_EMAIL',
        timestamp: new Date(),
      };

      // Act
      await service['handleOnboardingStatusChange'](payload);

      // Assert
      expect(mockAgentChatService.createThread).not.toHaveBeenCalled();
      expect(mockAgentExecutionService.executeAgent).not.toHaveBeenCalled();
    });

    it('should not create welcome chat when previous status was already COMPLETED', async () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'COMPLETED',
        timestamp: new Date(),
      };

      // Act
      await service['handleOnboardingStatusChange'](payload);

      // Assert
      expect(mockAgentChatService.createThread).not.toHaveBeenCalled();
      expect(mockAgentExecutionService.executeAgent).not.toHaveBeenCalled();
    });

    it('should handle errors and emit failure event', async () => {
      // Arrange
      const payload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'BOOK_ONBOARDING',
        timestamp: new Date(),
      };

      const error = new Error('Failed to create chat');
      mockAgentChatService.createThread.mockRejectedValue(error);

      // Act
      await service['handleOnboardingStatusChange'](payload);

      // Assert
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('ai-agent.welcome.chat-creation-failed', expect.objectContaining({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        error: 'Failed to create chat',
        attempts: 3
      }));
    });
  });

  describe('validateEventPayload', () => {
    it('should validate correct payload', () => {
      // Arrange
      const validPayload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'BOOK_ONBOARDING',
        timestamp: new Date(),
      };

      // Act
      const result = service['validateEventPayload'](validPayload);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject invalid payload', () => {
      // Arrange
      const invalidPayload = {
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        // missing previousStatus and timestamp
      };

      // Act
      const result = service['validateEventPayload'](invalidPayload);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getPersonalizedWelcomePrompt', () => {
    it('should generate personalized welcome prompt', async () => {
      // Arrange
      const userId = 'user-123';
      const workspaceId = 'workspace-123';
      const mockUser = { firstName: 'John', email: 'john@example.com' };
      const mockWorkspace = { displayName: 'Test Workspace' };

      mockUserService.findById.mockResolvedValue(mockUser);
      mockWorkspaceService.findById.mockResolvedValue(mockWorkspace);

      // Act
      const result = await service['getPersonalizedWelcomePrompt'](userId, workspaceId);

      // Assert
      expect(result).toContain('Hi John!');
      expect(result).toContain('Test Workspace');
      expect(result).toContain('Welcome to Business Setup Wizard');
    });

    it('should fallback to default prompt when user/workspace data is unavailable', async () => {
      // Arrange
      const userId = 'user-123';
      const workspaceId = 'workspace-123';

      mockUserService.findById.mockRejectedValue(new Error('User not found'));
      mockWorkspaceService.findById.mockRejectedValue(new Error('Workspace not found'));

      // Act
      const result = await service['getPersonalizedWelcomePrompt'](userId, workspaceId);

      // Assert
      expect(result).toContain('Hi there!');
      expect(result).toContain('Welcome to Business Setup Wizard');
    });
  });
});
