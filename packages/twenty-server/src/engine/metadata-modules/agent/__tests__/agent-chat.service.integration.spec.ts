import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { AgentChatMessageEntity } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatThreadEntity } from 'src/engine/metadata-modules/agent/agent-chat-thread.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentTitleGenerationService } from 'src/engine/metadata-modules/agent/agent-title-generation.service';
import { type AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';

describe('AgentChatService Integration Tests', () => {
  let service: AgentChatService;
  let businessSetupAgentService: BusinessSetupAgentService;
  let threadRepository: Repository<AgentChatThreadEntity>;

  const mockThreadRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
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
    businessSetupAgentService = module.get<BusinessSetupAgentService>(
      BusinessSetupAgentService,
    );
    threadRepository = module.get<Repository<AgentChatThreadEntity>>(
      getRepositoryToken(AgentChatThreadEntity, 'core'),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createThread', () => {
    it('should create thread with standard logic', async () => {
      const mockThread = {
        id: 'thread-id',
        agentId: 'agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      const result = await service.createThread('agent-id', 'workspace-id');

      expect(result).toBe(mockThread);
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'agent-id',
        userWorkspaceId: 'workspace-id',
      });
      expect(mockThreadRepository.save).toHaveBeenCalledWith(mockThread);
    });
  });

  describe('createThreadWithSupervisorAgent', () => {
    it('should create thread with supervisor agent', async () => {
      const mockSupervisorAgent = {
        id: 'supervisor-agent-id',
        name: 'supervisor-agent',
        modelId: 'google/gemini-2.5-flash',
      } as AgentEntity;

      const mockThread = {
        id: 'thread-id',
        agentId: 'supervisor-agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getSupervisorAgent.mockResolvedValue(
        mockSupervisorAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      const result =
        await service.createThreadWithSupervisorAgent('workspace-id');

      expect(result.agentId).toBe('supervisor-agent-id');
      expect(
        mockBusinessSetupAgentService.getSupervisorAgent,
      ).toHaveBeenCalledWith('workspace-id');
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'supervisor-agent-id',
        userWorkspaceId: 'workspace-id',
      });
    });

    it('should handle supervisor agent failure gracefully', async () => {
      mockBusinessSetupAgentService.getSupervisorAgent.mockRejectedValue(
        new Error('Agent creation failed'),
      );

      // Mock console.error to avoid console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        service.createThreadWithSupervisorAgent('workspace-id'),
      ).rejects.toThrow('Agent creation failed');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create thread with supervisor agent:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('backward compatibility', () => {
    it('should maintain backward compatibility with existing chat creation', async () => {
      const mockThread = {
        id: 'thread-id',
        agentId: 'existing-agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Test that existing createThread method still works
      const result = await service.createThread(
        'existing-agent-id',
        'workspace-id',
      );

      expect(result).toBe(mockThread);
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'existing-agent-id',
        userWorkspaceId: 'workspace-id',
      });

      // Business setup service should not be called for standard creation
      expect(
        mockBusinessSetupAgentService.getAgentForStep,
      ).not.toHaveBeenCalled();
    });
  });
});
