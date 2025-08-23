import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';
import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { AgentChatMessageEntity } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatThreadEntity } from 'src/engine/metadata-modules/agent/agent-chat-thread.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentTitleGenerationService } from 'src/engine/metadata-modules/agent/agent-title-generation.service';

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

  describe('createThreadWithBusinessSetupContext', () => {
    it('should use provided agent when no business setup step specified', async () => {
      const mockThread = {
        id: 'thread-id',
        agentId: 'agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      const result = await service.createThreadWithBusinessSetupContext(
        'agent-id',
        'workspace-id',
      );

      expect(result).toBe(mockThread);
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'agent-id',
        userWorkspaceId: 'workspace-id',
      });
      expect(mockBusinessSetupAgentService.getAgentForStep).not.toHaveBeenCalled();
    });

    it('should use business setup agent when step is provided', async () => {
      const mockBusinessSetupAgent = {
        id: 'welcome-agent-id',
        name: 'welcome-agent',
        modelId: 'google/gemini-2.5-flash',
      } as AgentEntity;

      const mockThread = {
        id: 'thread-id',
        agentId: 'welcome-agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getAgentForStep.mockResolvedValue(
        mockBusinessSetupAgent,
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      const result = await service.createThreadWithBusinessSetupContext(
        'default-agent-id',
        'workspace-id',
        BusinessSetupStatus.WELCOME,
      );

      expect(result.agentId).toBe('welcome-agent-id');
      expect(mockBusinessSetupAgentService.getAgentForStep).toHaveBeenCalledWith(
        BusinessSetupStatus.WELCOME,
        'workspace-id',
      );
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'welcome-agent-id',
        userWorkspaceId: 'workspace-id',
      });
    });

    it('should fallback to original agent when business setup agent fails', async () => {
      const mockThread = {
        id: 'thread-id',
        agentId: 'default-agent-id',
        userWorkspaceId: 'workspace-id',
      } as AgentChatThreadEntity;

      mockBusinessSetupAgentService.getAgentForStep.mockRejectedValue(
        new Error('Agent creation failed'),
      );
      mockThreadRepository.create.mockReturnValue(mockThread);
      mockThreadRepository.save.mockResolvedValue(mockThread);

      // Mock console.warn to avoid console output during tests
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service.createThreadWithBusinessSetupContext(
        'default-agent-id',
        'workspace-id',
        BusinessSetupStatus.WELCOME,
      );

      expect(result.agentId).toBe('default-agent-id');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to get business setup agent for step WELCOME:',
        expect.any(Error),
      );
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'default-agent-id',
        userWorkspaceId: 'workspace-id',
      });

      consoleWarnSpy.mockRestore();
    });

    it('should handle different business setup steps correctly', async () => {
      const testCases = [
        {
          step: BusinessSetupStatus.WELCOME,
          expectedAgentId: 'welcome-agent-id',
        },
        {
          step: BusinessSetupStatus.BUSINESS_ANALYSIS,
          expectedAgentId: 'analysis-agent-id',
        },
        {
          step: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
          expectedAgentId: 'funnel-agent-id',
        },
      ];

      for (const testCase of testCases) {
        const mockAgent = {
          id: testCase.expectedAgentId,
          name: 'test-agent',
        } as AgentEntity;

        const mockThread = {
          id: 'thread-id',
          agentId: testCase.expectedAgentId,
          userWorkspaceId: 'workspace-id',
        } as AgentChatThreadEntity;

        mockBusinessSetupAgentService.getAgentForStep.mockResolvedValue(mockAgent);
        mockThreadRepository.create.mockReturnValue(mockThread);
        mockThreadRepository.save.mockResolvedValue(mockThread);

        const result = await service.createThreadWithBusinessSetupContext(
          'default-agent-id',
          'workspace-id',
          testCase.step,
        );

        expect(result.agentId).toBe(testCase.expectedAgentId);
        expect(mockBusinessSetupAgentService.getAgentForStep).toHaveBeenCalledWith(
          testCase.step,
          'workspace-id',
        );

        jest.clearAllMocks();
      }
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
      const result = await service.createThread('existing-agent-id', 'workspace-id');

      expect(result).toBe(mockThread);
      expect(mockThreadRepository.create).toHaveBeenCalledWith({
        agentId: 'existing-agent-id',
        userWorkspaceId: 'workspace-id',
      });

      // Business setup service should not be called for standard creation
      expect(mockBusinessSetupAgentService.getAgentForStep).not.toHaveBeenCalled();
    });
  });
});