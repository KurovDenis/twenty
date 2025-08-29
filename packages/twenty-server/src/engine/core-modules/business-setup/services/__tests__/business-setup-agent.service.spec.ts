import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { AgentService } from 'src/engine/metadata-modules/agent/agent.service';
import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';
import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';

describe('BusinessSetupAgentService', () => {
  let service: BusinessSetupAgentService;
  let agentRepository: Repository<AgentEntity>;
  let agentService: AgentService;

  const mockAgentRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockAgentService = {
    createOneAgent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupAgentService,
        {
          provide: getRepositoryToken(AgentEntity, 'core'),
          useValue: mockAgentRepository,
        },
        {
          provide: AgentService,
          useValue: mockAgentService,
        },
      ],
    }).compile();

    service = module.get<BusinessSetupAgentService>(BusinessSetupAgentService);
    agentRepository = module.get<Repository<AgentEntity>>(
      getRepositoryToken(AgentEntity, 'core'),
    );
    agentService = module.get<AgentService>(AgentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAgentForStep', () => {
    it('should return welcome agent for WELCOME status', async () => {
      const mockAgent = {
        id: 'agent-id',
        name: 'welcome-agent',
        modelId: 'google/gemini-2.5-flash',
        workspaceId: 'workspace-id',
      } as AgentEntity;

      mockAgentRepository.findOne.mockResolvedValue(mockAgent);

      const agent = await service.getAgentForStep(
        BusinessSetupStatus.WELCOME,
        'workspace-id',
      );

      expect(agent.name).toBe('welcome-agent');
      expect(agent.modelId).toBe('google/gemini-2.5-flash');
      expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'welcome-agent', workspaceId: 'workspace-id' },
      });
    });

    it('should return business analysis agent for BUSINESS_ANALYSIS status', async () => {
      const mockAgent = {
        id: 'agent-id',
        name: 'business-analysis-agent',
        modelId: 'auto',
        workspaceId: 'workspace-id',
      } as AgentEntity;

      mockAgentRepository.findOne.mockResolvedValue(mockAgent);

      const agent = await service.getAgentForStep(
        BusinessSetupStatus.BUSINESS_ANALYSIS,
        'workspace-id',
      );

      expect(agent.name).toBe('business-analysis-agent');
      expect(agent.modelId).toBe('auto');
      expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'business-analysis-agent', workspaceId: 'workspace-id' },
      });
    });

    it('should create agent if not exists', async () => {
      const mockCreatedAgent = {
        id: 'new-agent-id',
        name: 'welcome-agent',
        modelId: 'google/gemini-2.5-flash',
        workspaceId: 'workspace-id',
      } as AgentEntity;

      mockAgentRepository.findOne.mockResolvedValue(null);
      mockAgentService.createOneAgent.mockResolvedValue(mockCreatedAgent);

      const agent = await service.getAgentForStep(
        BusinessSetupStatus.WELCOME,
        'workspace-id',
      );

      expect(agent).toBeDefined();
      expect(agent.name).toBe('welcome-agent');
      expect(mockAgentService.createOneAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'welcome-agent',
          label: 'Welcome AI Assistant',
          modelId: 'google/gemini-2.5-flash',
          isCustom: true,
        }),
        'workspace-id',
      );
    });

    it('should throw error for COMPLETED status', async () => {
      await expect(
        service.getAgentForStep(BusinessSetupStatus.COMPLETED, 'workspace-id'),
      ).rejects.toThrow('No agent needed for COMPLETED status');
    });

    it('should throw error for invalid step', async () => {
      await expect(
        service.getAgentForStep(
          'INVALID_STEP' as BusinessSetupStatus,
          'workspace-id',
        ),
      ).rejects.toThrow('No agent mapping for step: INVALID_STEP');
    });

    it('should handle all business setup steps correctly', async () => {
      const steps = [
        { step: BusinessSetupStatus.WELCOME, expectedName: 'welcome-agent' },
        {
          step: BusinessSetupStatus.BUSINESS_ANALYSIS,
          expectedName: 'business-analysis-agent',
        },
        {
          step: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
          expectedName: 'funnel-designer-agent',
        },
        {
          step: BusinessSetupStatus.AGENT_SETUP,
          expectedName: 'agent-orchestrator-agent',
        },
        {
          step: BusinessSetupStatus.WORKFLOW_CREATION,
          expectedName: 'workflow-generator-agent',
        },
        {
          step: BusinessSetupStatus.TEAM_ASSIGNMENT,
          expectedName: 'team-assignment-agent',
        },
        {
          step: BusinessSetupStatus.TESTING_OPTIMIZATION,
          expectedName: 'testing-optimization-agent',
        },
      ];

      for (const { step, expectedName } of steps) {
        const mockAgent = {
          id: 'agent-id',
          name: expectedName,
          workspaceId: 'workspace-id',
        } as AgentEntity;

        mockAgentRepository.findOne.mockResolvedValue(mockAgent);

        const agent = await service.getAgentForStep(step, 'workspace-id');

        expect(agent.name).toBe(expectedName);
        expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
          where: { name: expectedName, workspaceId: 'workspace-id' },
        });

        jest.clearAllMocks();
      }
    });
  });

  describe('agent configurations', () => {
    it('should create welcome agent with correct configuration', async () => {
      mockAgentRepository.findOne.mockResolvedValue(null);
      const mockCreatedAgent = {
        id: 'new-agent-id',
        name: 'welcome-agent',
      } as AgentEntity;

      mockAgentService.createOneAgent.mockResolvedValue(mockCreatedAgent);

      await service.getAgentForStep(
        BusinessSetupStatus.WELCOME,
        'workspace-id',
      );

      expect(mockAgentService.createOneAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'welcome-agent',
          label: 'Welcome AI Assistant',
          description: 'AI assistant for welcome step in business setup',
          modelId: 'google/gemini-2.5-flash',
          isCustom: true,
          prompt: expect.stringContaining(
            'Welcome AI assistant for Business Setup Wizard',
          ),
        }),
        'workspace-id',
      );
    });

    it('should create business analysis agent with auto model', async () => {
      mockAgentRepository.findOne.mockResolvedValue(null);
      const mockCreatedAgent = {
        id: 'new-agent-id',
        name: 'business-analysis-agent',
      } as AgentEntity;

      mockAgentService.createOneAgent.mockResolvedValue(mockCreatedAgent);

      await service.getAgentForStep(
        BusinessSetupStatus.BUSINESS_ANALYSIS,
        'workspace-id',
      );

      expect(mockAgentService.createOneAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'business-analysis-agent',
          label: 'Business Analysis AI',
          modelId: 'auto',
          isCustom: true,
        }),
        'workspace-id',
      );
    });
  });
});
