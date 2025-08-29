import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { type Repository } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';

import {
  type BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../business-setup.service';
import { AvitoWelcomeSGRService } from '../sgr/services/avito-welcome-sgr.service';
import { type CredentialsExtractionResult } from '../types/avito.types';

import { BusinessSetupWelcomeAgentService } from './business-setup-welcome-agent.service';

describe('BusinessSetupWelcomeAgentService - Avito Integration', () => {
  let service: BusinessSetupWelcomeAgentService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockAgentExecutionService: jest.Mocked<AgentExecutionService>;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockUserService: jest.Mocked<UserService>;
  let mockWorkspaceService: jest.Mocked<WorkspaceService>;
  let mockUserVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let mockAvitoWelcomeSGRService: any;
  let mockAgentRepository: jest.Mocked<Repository<AgentEntity>>;

  const mockUser: User = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  } as User;

  const mockWorkspace: Workspace = {
    id: 'workspace-123',
    displayName: 'Test Workspace',
  } as Workspace;

  beforeEach(async () => {
    // Create mocked services
    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    mockAgentExecutionService = {
      executeAgent: jest.fn(),
    } as any;

    mockAgentChatService = {
      createThread: jest.fn(),
      addMessage: jest.fn(),
    } as any;

    mockUserService = {
      findById: jest.fn(),
    } as any;

    mockWorkspaceService = {
      findById: jest.fn(),
    } as any;

    mockUserVarsService = {
      set: jest.fn(),
    } as any;

    mockAvitoWelcomeSGRService = {
      processWelcomeMessage: jest.fn(),
      processWelcomeMessageWithStreaming: jest.fn().mockReturnValue(
        (async function* () {
          yield { type: 'thinking', step: 'Analyzing message' };
          yield { type: 'final_response', content: 'Analysis complete' };
        })(),
      ),
    } as any;

    mockAgentRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupWelcomeAgentService,
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: AgentExecutionService, useValue: mockAgentExecutionService },
        { provide: AgentChatService, useValue: mockAgentChatService },
        { provide: UserService, useValue: mockUserService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: UserVarsService, useValue: mockUserVarsService },
        {
          provide: AvitoWelcomeSGRService,
          useValue: mockAvitoWelcomeSGRService,
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
  });

  describe('extractCredentialsFromMessage', () => {
    it('should extract credentials from standard format with equals sign', () => {
      const message =
        "CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF'\nCLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'";

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.clientId).toBe('R3cTDMk9rEJ2lh5A9_QF');
      expect(result.clientSecret).toBe(
        'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
      );
    });

    it('should extract credentials from colon format', () => {
      const message = 'CLIENT_ID: test123\nCLIENT_SECRET: secret456';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.clientId).toBe('test123');
      expect(result.clientSecret).toBe('secret456');
    });

    it('should extract credentials with quotes', () => {
      const message = 'CLIENT_ID="quoted_id"\nCLIENT_SECRET="quoted_secret"';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.clientId).toBe('quoted_id');
      expect(result.clientSecret).toBe('quoted_secret');
    });

    it('should handle spaces around separators', () => {
      const message =
        'CLIENT_ID  :  spaced_id\nCLIENT_SECRET  =  spaced_secret';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.clientId).toBe('spaced_id');
      expect(result.clientSecret).toBe('spaced_secret');
    });

    it('should return invalid for incomplete credentials (only CLIENT_ID)', () => {
      const message = 'CLIENT_ID: test123';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.clientId).toBe('test123');
      expect(result.clientSecret).toBeNull();
    });

    it('should return invalid for incomplete credentials (only CLIENT_SECRET)', () => {
      const message = 'CLIENT_SECRET: secret456';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.clientId).toBeNull();
      expect(result.clientSecret).toBe('secret456');
    });

    it('should return invalid for malformed message', () => {
      const message = 'Hello, I want to integrate with Avito';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(false);
      expect(result.clientId).toBeNull();
      expect(result.clientSecret).toBeNull();
    });

    it('should handle case insensitive keys', () => {
      const message = 'client_id: lower_id\nclient_secret: lower_secret';

      const result = (service as any).extractCredentialsFromMessage(message);

      expect(result.isValid).toBe(true);
      expect(result.clientId).toBe('lower_id');
      expect(result.clientSecret).toBe('lower_secret');
    });
  });

  describe('parseValidationResult', () => {
    it('should return true for successful validation response', () => {
      const successResponse =
        'HTTP request successful, access_token received, status: 200';

      const result = (service as any).parseValidationResult(successResponse);

      expect(result).toBe(true);
    });

    it('should return true for Russian success message', () => {
      const successResponse = 'Запрос выполнен успешно, получен access_token';

      const result = (service as any).parseValidationResult(successResponse);

      expect(result).toBe(true);
    });

    it('should return false for error response', () => {
      const errorResponse =
        'HTTP request failed, status: 401, error: invalid credentials';

      const result = (service as any).parseValidationResult(errorResponse);

      expect(result).toBe(false);
    });

    it('should return false for validation failure', () => {
      const errorResponse = 'Validation failed, unauthorized access';

      const result = (service as any).parseValidationResult(errorResponse);

      expect(result).toBe(false);
    });

    it('should handle mixed success and error indicators (prioritize error)', () => {
      const mixedResponse = 'access_token found but status: 400 error occurred';

      const result = (service as any).parseValidationResult(mixedResponse);

      expect(result).toBe(false);
    });
  });

  describe('processUserMessage', () => {
    beforeEach(() => {
      // Mock agent repository to return a mock agent
      mockAgentRepository.findOne.mockResolvedValue({
        id: 'agent-123',
        name: 'Welcome Greeting Bot',
        workspaceId: 'workspace-123',
      } as AgentEntity);
    });

    it('should process valid credentials and trigger validation', async () => {
      const message =
        'CLIENT_ID: R3cTDMk9rEJ2lh5A9_QF\nCLIENT_SECRET: ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc';
      const threadId = 'thread-123';
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      // Mock successful agent execution
      mockAgentExecutionService.executeAgent.mockResolvedValue({
        result: { response: 'access_token received, validation successful' },
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      });

      await service.processUserMessage(threadId, message, workspaceId, userId);

      // Verify agent execution was called with validation prompt
      expect(mockAgentExecutionService.executeAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: {},
          userPrompt: expect.stringContaining(
            'CLIENT_ID: R3cTDMk9rEJ2lh5A9_QF',
          ),
        }),
      );

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: 'R3cTDMk9rEJ2lh5A9_QF',
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
      });
    });

    it('should send retry message for invalid credentials format', async () => {
      const message = 'Hello, I want to connect to Avito';
      const threadId = 'thread-123';
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      await service.processUserMessage(threadId, message, workspaceId, userId);

      // Verify retry message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith({
        threadId: 'thread-123',
        role: AgentChatMessageRole.ASSISTANT,
        content: expect.stringContaining(
          'Не удалось найти CLIENT_ID и CLIENT_SECRET',
        ),
        fileIds: [],
      });

      // Verify agent execution was NOT called
      expect(mockAgentExecutionService.executeAgent).not.toHaveBeenCalled();
    });

    it('should handle agent execution errors gracefully', async () => {
      const message = 'CLIENT_ID: test_id\nCLIENT_SECRET: test_secret';
      const threadId = 'thread-123';
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      // Mock agent execution failure
      mockAgentExecutionService.executeAgent.mockRejectedValue(
        new Error('Agent execution failed'),
      );

      // Should not throw
      await expect(
        service.processUserMessage(threadId, message, workspaceId, userId),
      ).resolves.not.toThrow();
    });
  });

  describe('storeAvitoCredentials', () => {
    it('should store both CLIENT_ID and CLIENT_SECRET', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';
      const credentials = {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
      };

      await (service as any).storeAvitoCredentials(
        workspaceId,
        userId,
        credentials,
      );

      expect(mockUserVarsService.set).toHaveBeenCalledTimes(2);
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: 'test_client_id',
      });
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: 'test_client_secret',
      });
    });
  });

  describe('transitionToBusinessAnalysis', () => {
    it('should update business setup step statuses correctly', async () => {
      const workspaceId = 'workspace-123';
      const userId = 'user-123';

      await (service as any).transitionToBusinessAnalysis(workspaceId, userId);

      // Verify welcome step marked as complete
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false,
      });

      // Verify business analysis step marked as pending
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true,
      });

      // Verify transition event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.step-transition',
        {
          userId: 'user-123',
          workspaceId: 'workspace-123',
          fromStep: 'WELCOME',
          toStep: 'BUSINESS_ANALYSIS',
          timestamp: expect.any(Date),
        },
      );
    });
  });

  describe('getAvitoWelcomePrompt', () => {
    it('should generate Russian welcome prompt with user and workspace info', async () => {
      const prompt = await (service as any).getAvitoWelcomePrompt(
        mockUser,
        mockWorkspace,
      );

      expect(prompt).toContain('Привет, John!');
      expect(prompt).toContain('Test Workspace');
      expect(prompt).toContain('CLIENT_ID');
      expect(prompt).toContain('CLIENT_SECRET');
      expect(prompt).toContain('https://api.avito.ru/token');
      expect(prompt).toContain('TOOL USAGE INSTRUCTIONS');
    });

    it('should handle user without firstName', async () => {
      const userWithoutName = {
        ...mockUser,
        firstName: null,
      } as unknown as User;

      const prompt = await (service as any).getAvitoWelcomePrompt(
        userWithoutName,
        mockWorkspace,
      );

      expect(prompt).toContain('Привет, пользователь!');
    });
  });

  describe('getAvitoAgent', () => {
    it('should return existing agent if found', async () => {
      const existingAgent = {
        id: 'agent-123',
        name: 'Avito Agent',
        workspaceId: 'workspace-123',
      } as AgentEntity;

      mockAgentRepository.findOne.mockResolvedValue(existingAgent);

      const result = await (service as any).getAvitoAgent('workspace-123');

      expect(result).toBe(existingAgent);
      expect(mockAgentRepository.findOne).toHaveBeenCalledWith({
        where: {
          name: 'Avito Agent',
          workspaceId: 'workspace-123',
        },
      });
    });

    it('should create new agent if not found', async () => {
      const newAgent = {
        id: 'new-agent-123',
        name: 'Avito Agent',
        description:
          'Avito API integration and credentials management agent for Russian marketplace',
        workspaceId: 'workspace-123',
      } as AgentEntity;

      mockAgentRepository.findOne.mockResolvedValue(null);
      mockAgentRepository.save.mockResolvedValue(newAgent);

      const result = await (service as any).getAvitoAgent('workspace-123');

      expect(result).toBe(newAgent);
      expect(mockAgentRepository.save).toHaveBeenCalledWith({
        name: 'Avito Agent',
        label: 'Avito Agent',
        description:
          'Avito API integration and credentials management agent for Russian marketplace',
        prompt: expect.stringContaining(
          'Привет! Добро пожаловать в интеграцию Avito!',
        ),
        modelId: 'google/gemini-2.5-flash',
        workspaceId: 'workspace-123',
        isCustom: true,
      });
    });
  });

  describe('handleValidationResponse', () => {
    it('should store credentials and transition on successful validation', async () => {
      const agentResponse = {
        result: {
          response:
            'HTTP request successful, access_token received, status: 200',
        },
      };
      const credentials: CredentialsExtractionResult = {
        clientId: 'test_id',
        clientSecret: 'test_secret',
        isValid: true,
      };

      await (service as any).handleValidationResponse(
        agentResponse,
        credentials,
        'workspace-123',
        'user-123',
        'thread-123',
      );

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: 'test_id',
      });

      // Verify transition occurred
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: 'user-123',
        workspaceId: 'workspace-123',
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false,
      });
    });

    it('should not store credentials on failed validation', async () => {
      const agentResponse = {
        result: {
          response: 'HTTP request failed, status: 401, invalid credentials',
        },
      };
      const credentials: CredentialsExtractionResult = {
        clientId: 'test_id',
        clientSecret: 'test_secret',
        isValid: true,
      };

      await (service as any).handleValidationResponse(
        agentResponse,
        credentials,
        'workspace-123',
        'user-123',
        'thread-123',
      );

      // Verify credentials were NOT stored
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        }),
      );
    });
  });
});
