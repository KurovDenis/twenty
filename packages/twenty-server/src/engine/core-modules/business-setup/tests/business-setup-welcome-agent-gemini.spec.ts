import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';

import { BusinessSetupWelcomeAgentService } from '../services/business-setup-welcome-agent.service';

describe('BusinessSetupWelcomeAgentService - Gemini Model Testing', () => {
  let service: BusinessSetupWelcomeAgentService;
  let agentExecutionService: AgentExecutionService;
  let agentRepository: Repository<AgentEntity>;

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockAgentExecutionService = {
    executeAgent: jest.fn().mockResolvedValue({
      result: { response: 'Hello!' },
    }),
  };

  const mockAgentChatService = {
    createThread: jest.fn().mockResolvedValue({ id: 'thread-123' }),
    addMessage: jest.fn(),
  };

  const mockUserService = {
    findById: jest.fn().mockResolvedValue({
      firstName: 'Test',
      email: 'test@example.com',
    }),
  };

  const mockWorkspaceService = {
    findById: jest.fn().mockResolvedValue({
      displayName: 'Test Workspace',
    }),
  };

  const mockAgentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    findOneOrFail: jest.fn(),
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
        {
          provide: getRepositoryToken(AgentEntity, 'core'),
          useValue: mockAgentRepository,
        },
      ],
    }).compile();

    service = module.get<BusinessSetupWelcomeAgentService>(
      BusinessSetupWelcomeAgentService,
    );
    agentExecutionService = module.get<AgentExecutionService>(
      AgentExecutionService,
    );
    agentRepository = module.get<Repository<AgentEntity>>(
      getRepositoryToken(AgentEntity, 'core'),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Welcome Chat Creation With Gemini Model', () => {
    it('should create a welcome agent with the Gemini model if it does not exist', async () => {
      // Setup
      mockAgentRepository.findOne.mockResolvedValue(null);
      mockAgentRepository.save.mockImplementation((agent) =>
        Promise.resolve({
          ...agent,
          id: 'agent-123',
        }),
      );

      // Trigger welcome chat creation
      await service['handleOnboardingStatusChange']({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'IN_PROGRESS',
        timestamp: new Date(),
      });

      // Verify agent creation
      expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: 'Welcome Greeting Bot',
          workspaceId: 'workspace-123',
        },
      });

      expect(mockAgentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Welcome Greeting Bot',
          modelId: 'google/gemini-2.5-flash', // Verify correct model is used
          workspaceId: 'workspace-123',
        }),
      );
    });

    it('should use an existing welcome agent if it exists', async () => {
      // Setup
      const existingAgent = {
        id: 'agent-123',
        name: 'Welcome Greeting Bot',
        modelId: 'google/gemini-2.5-flash',
        workspaceId: 'workspace-123',
      };

      mockAgentRepository.findOne.mockResolvedValue(existingAgent);

      // Trigger welcome chat creation
      await service['handleOnboardingStatusChange']({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'IN_PROGRESS',
        timestamp: new Date(),
      });

      // Verify agent not created again
      expect(mockAgentRepository.save).not.toHaveBeenCalled();

      // Verify agent execution uses the existing agent
      expect(mockAgentExecutionService.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: existingAgent,
          context: expect.objectContaining({
            modelId: 'google/gemini-2.5-flash', // Verify context contains correct model
          }),
        }),
      );
    });

    it('should always use the Gemini model in the context regardless of agent', async () => {
      // Setup
      mockAgentRepository.findOne.mockResolvedValue({
        id: 'agent-123',
        name: 'Welcome Greeting Bot',
        modelId: 'some-other-model', // Different model in agent
        workspaceId: 'workspace-123',
      });

      // Trigger welcome chat creation
      await service['handleOnboardingStatusChange']({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        status: 'COMPLETED',
        previousStatus: 'IN_PROGRESS',
        timestamp: new Date(),
      });

      // Verify execution context always has the correct model
      expect(mockAgentExecutionService.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            modelId: 'google/gemini-2.5-flash', // Enforced model in context
          }),
        }),
      );
    });
  });
});
