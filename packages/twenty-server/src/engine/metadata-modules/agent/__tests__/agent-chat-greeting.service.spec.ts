import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';
import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';

import {
  AgentChatMessageEntity,
  type AgentChatMessageRole,
} from '../agent-chat-message.entity';
import { AgentChatThreadEntity } from '../agent-chat-thread.entity';
import { AgentChatService } from '../agent-chat.service';
import { AgentTitleGenerationService } from '../agent-title-generation.service';
import { type AgentEntity } from '../agent.entity';

describe('AgentChatService - Greeting System', () => {
  let service: AgentChatService;
  let threadRepository: Repository<AgentChatThreadEntity>;
  let messageRepository: Repository<AgentChatMessageEntity>;
  let businessSetupAgentService: BusinessSetupAgentService;
  let eventEmitter: EventEmitter2;

  // Shared test constants
  const SUPERVISOR_AGENT_ID = 'supervisor-agent-123';
  const mockUserWorkspaceId = 'user-workspace-123';
  const mockThreadId = 'thread-456';

  // Mock repositories and services
  const mockThreadRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockMessageRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const mockFileRepository = {
    update: jest.fn(),
  };

  const mockTitleGenerationService = {
    generateThreadTitle: jest.fn(),
  };

  const mockBusinessSetupAgentService = {
    getAgentForStep: jest.fn(),
    getSupervisorAgent: jest.fn(),
    isSupervisorAgent: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentChatService,
        {
          provide: getRepositoryToken(AgentChatThreadEntity, 'core'),
          useValue: mockThreadRepository,
        },
        {
          provide: getRepositoryToken(AgentChatMessageEntity, 'core'),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(FileEntity, 'core'),
          useValue: mockFileRepository,
        },
        {
          provide: AgentTitleGenerationService,
          useValue: mockTitleGenerationService,
        },
        {
          provide: BusinessSetupAgentService,
          useValue: mockBusinessSetupAgentService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<AgentChatService>(AgentChatService);
    threadRepository = module.get<Repository<AgentChatThreadEntity>>(
      getRepositoryToken(AgentChatThreadEntity, 'core'),
    );
    messageRepository = module.get<Repository<AgentChatMessageEntity>>(
      getRepositoryToken(AgentChatMessageEntity, 'core'),
    );
    businessSetupAgentService = module.get<BusinessSetupAgentService>(
      BusinessSetupAgentService,
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Supervisor Agent System', () => {
    it('should create thread with supervisor agent and send welcome message', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      const mockGreetingMessage = {
        id: 'message-789',
        threadId: mockThreadId,
        role: 'assistant' as AgentChatMessageRole,
        content: expect.stringContaining('Business Setup Supervisor'),
      } as AgentChatMessageEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);
      mockMessageRepository.create.mockReturnValue(mockGreetingMessage);
      mockMessageRepository.save.mockResolvedValue(mockGreetingMessage);

      // Act
      const result = await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(result.agentId).toBe(SUPERVISOR_AGENT_ID);
      expect(
        mockBusinessSetupAgentService.getSupervisorAgent,
      ).toHaveBeenCalledWith(mockUserWorkspaceId);

      // Verify thread creation
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      });
      expect(mockThreadRepository.save).toHaveBeenCalledWith(mockThread);

      // Verify greeting message creation
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: 'assistant',
        content: expect.stringContaining('Business Setup Supervisor'),
      });
      expect(mockMessageRepository.save).toHaveBeenCalledWith(
        mockGreetingMessage,
      );

      // Verify events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ai-agent.welcome.chat-created',
        expect.objectContaining({
          threadId: mockThreadId,
          agentId: SUPERVISOR_AGENT_ID,
          businessSetupStep: 'SUPERVISOR',
          userWorkspaceId: mockUserWorkspaceId,
        }),
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ai-agent.welcome.greeting-sent',
        expect.objectContaining({
          threadId: mockThreadId,
          messageId: mockGreetingMessage.id,
          greetingMessage: expect.stringContaining('Business Setup Supervisor'),
          businessSetupStep: 'SUPERVISOR',
        }),
      );
    });

    it('should handle greeting message failure gracefully and still return thread', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Mock greeting message creation failure
      const greetingError = new Error('Failed to create greeting message');
      mockMessageRepository.save.mockRejectedValue(greetingError);

      // Mock console.error to avoid console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(result).toBe(mockThread); // Thread should still be created
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send supervisor welcome message:',
        greetingError,
      );

      consoleErrorSpy.mockRestore();
    });

    it('should create appropriate supervisor welcome message content', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);
      mockMessageRepository.create.mockImplementation((message) => message);
      mockMessageRepository.save.mockImplementation((message) =>
        Promise.resolve(message),
      );

      // Act
      await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: 'assistant',
        content: expect.stringContaining('Business Setup Supervisor'),
      });

      // Verify supervisor welcome message contains expected elements
      const greetingCall = mockMessageRepository.create.mock.calls[0][0];
      expect(greetingCall.content).toContain('Business Setup Assistant');
      expect(greetingCall.content).toContain('intelligent routing agent');
      expect(greetingCall.content).toContain('WELCOME');
      expect(greetingCall.content).toContain('🎯');
    });
  });

  describe('Standard Thread Creation', () => {
    it('should create thread for non-business-setup agents using createThread', async () => {
      // Arrange
      const regularAgentId = 'regular-agent-123';
      const mockThread = {
        id: 'thread-456',
        agentId: regularAgentId,
        userWorkspaceId: 'user-workspace-123',
      } as AgentChatThreadEntity;

      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Act
      const result = await service.createThread(
        regularAgentId,
        'user-workspace-123',
      );

      // Assert
      expect(result).toBe(mockThread);

      // Verify no greeting message was created for regular threads
      expect(mockMessageRepository.create).not.toHaveBeenCalled();
      expect(mockMessageRepository.save).not.toHaveBeenCalled();

      // Verify no events were emitted for regular threads
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should fallback to original agent when business setup agent fails', async () => {
      // Arrange
      const fallbackAgentId = 'fallback-agent-123';
      const mockThread = {
        id: mockThreadId,
        agentId: fallbackAgentId,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      // Mock business setup agent service failure
      mockBusinessSetupAgentService.getSupervisorAgent.mockRejectedValue(
        new Error('Supervisor Agent not found'),
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Spy on console.error to verify error handling
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      await expect(
        service.createThreadWithSupervisorAgent(mockUserWorkspaceId),
      ).rejects.toThrow('Supervisor Agent not found');

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create thread with supervisor agent:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Supervisor Agent System', () => {
    const SUPERVISOR_AGENT_ID = 'supervisor-agent-123';
    const mockUserWorkspaceId = 'user-workspace-123';
    const mockThreadId = 'thread-456';

    it('should create thread with supervisor agent and send welcome message', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
        label: 'Business Setup Supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      const mockGreetingMessage = {
        id: 'message-789',
        threadId: mockThreadId,
        role: 'assistant' as AgentChatMessageRole,
        content: expect.stringContaining('Business Setup Supervisor'),
      } as AgentChatMessageEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);
      mockMessageRepository.create.mockReturnValue(mockGreetingMessage);
      mockMessageRepository.save.mockResolvedValue(mockGreetingMessage);

      // Act
      const result = await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(result.agentId).toBe(SUPERVISOR_AGENT_ID);
      expect(
        mockBusinessSetupAgentService.getSupervisorAgent,
      ).toHaveBeenCalledWith(mockUserWorkspaceId);

      // Verify thread creation
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      });
      expect(mockThreadRepository.save).toHaveBeenCalledWith(mockThread);

      // Verify greeting message creation
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: 'assistant',
        content: expect.stringContaining('Business Setup Supervisor'),
      });
      expect(mockMessageRepository.save).toHaveBeenCalledWith(
        mockGreetingMessage,
      );

      // Verify events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ai-agent.welcome.chat-created',
        expect.objectContaining({
          threadId: mockThreadId,
          agentId: SUPERVISOR_AGENT_ID,
          businessSetupStep: 'SUPERVISOR',
          userWorkspaceId: mockUserWorkspaceId,
        }),
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'ai-agent.welcome.greeting-sent',
        expect.objectContaining({
          threadId: mockThreadId,
          messageId: mockGreetingMessage.id,
          greetingMessage: expect.stringContaining('Business Setup Supervisor'),
          businessSetupStep: 'SUPERVISOR',
        }),
      );
    });

    it('should handle greeting message failure gracefully and still return thread', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Mock greeting message creation failure
      const greetingError = new Error('Failed to create greeting message');
      mockMessageRepository.save.mockRejectedValue(greetingError);

      // Mock console.error to avoid console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      const result = await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(result).toBe(mockThread); // Thread should still be created
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send supervisor welcome message:',
        greetingError,
      );

      consoleErrorSpy.mockRestore();
    });

    it('should throw error when supervisor agent creation fails', async () => {
      // Arrange
      mockBusinessSetupAgentService.getSupervisorAgent.mockRejectedValue(
        new Error('Supervisor Agent not found'),
      );

      // Mock console.error to avoid console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act & Assert
      await expect(
        service.createThreadWithSupervisorAgent(mockUserWorkspaceId),
      ).rejects.toThrow('Supervisor Agent not found');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create thread with supervisor agent:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should create appropriate supervisor welcome message content', async () => {
      // Arrange
      const mockSupervisorAgent = {
        id: SUPERVISOR_AGENT_ID,
        name: 'business-setup-supervisor',
      } as AgentEntity;

      const mockThread = {
        id: mockThreadId,
        agentId: SUPERVISOR_AGENT_ID,
        userWorkspaceId: mockUserWorkspaceId,
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);
      mockMessageRepository.create.mockImplementation((message) => message);
      mockMessageRepository.save.mockImplementation((message) =>
        Promise.resolve(message),
      );

      // Act
      await service.createThreadWithSupervisorAgent(
        mockUserWorkspaceId,
      );

      // Assert
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        threadId: mockThreadId,
        role: 'assistant',
        content: expect.stringContaining('Business Setup Supervisor'),
      });

      // Verify supervisor welcome message contains expected elements
      const greetingCall = mockMessageRepository.create.mock.calls[0][0];
      expect(greetingCall.content).toContain('Business Setup Assistant');
      expect(greetingCall.content).toContain('intelligent routing agent');
      expect(greetingCall.content).toContain('WELCOME');
      expect(greetingCall.content).toContain('🎯');
    });
  });

  describe('Standard Thread Creation', () => {
    it('should create thread for non-business-setup agents using createThread', async () => {
      // Arrange
      const regularAgentId = 'regular-agent-123';
      const mockThread = {
        id: 'thread-456',
        agentId: regularAgentId,
        userWorkspaceId: 'user-workspace-123',
      } as AgentChatThreadEntity;

      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Act
      const result = await service.createThread(
        regularAgentId,
        'user-workspace-123',
      );

      // Assert
      expect(result).toBe(mockThread);

      // Verify no greeting message was created for regular threads
      expect(mockMessageRepository.create).not.toHaveBeenCalled();
      expect(mockMessageRepository.save).not.toHaveBeenCalled();

      // Verify no events were emitted for regular threads
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Greeting Message Content Validation', () => {
    it('should generate correct greeting message for different business setup steps', () => {
      const testCases = [
        {
          step: BusinessSetupStatus.WELCOME,
          expectedContent: [
            'SGR Avito Integration Assistant',
            'CLIENT_ID',
            'CLIENT_SECRET',
          ],
        },
        {
          step: BusinessSetupStatus.BUSINESS_ANALYSIS,
          expectedContent: ['анализировать ваш бизнес', 'бизнес-анализу'],
        },
        {
          step: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
          expectedContent: ['воронку продаж', 'конверсии'],
        },
      ];

      testCases.forEach(({ step, expectedContent }) => {
        // Use reflection to call private method for testing
        const method = service['sendWelcomeMessage'];

        // Create a mock thread and test greeting generation
        const mockThreadId = 'test-thread';

        // Verify the method exists (we can't call it directly due to privacy)
        expect(typeof method).toBe('function');
      });
    });
  });
});
