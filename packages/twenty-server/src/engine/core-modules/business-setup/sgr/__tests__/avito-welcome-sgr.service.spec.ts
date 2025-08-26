import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../../business-setup.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';

// Mock the 'ai' package to provide generateObject function
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

describe('AvitoWelcomeSGRService', () => {
  let service: AvitoWelcomeSGRService;
  let toolDispatcher: AvitoWelcomeToolDispatcherService;
  let mockUserVarsService: jest.Mocked<UserVarsService<BusinessSetupKeyValueTypeMap>>;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockHttpTool: jest.Mocked<HttpTool>;

  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-123';
  const mockThreadId = 'thread-123';

  beforeEach(async () => {
    // Create mocks
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockImplementation((params) => {
        // Return appropriate typed values based on key
        switch (params.key) {
          case BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING:
            return Promise.resolve(false); // boolean
          case BusinessSetupStepKeys.AVITO_CLIENT_ID:
            return Promise.resolve('mock-client-id'); // string
          case BusinessSetupStepKeys.AVITO_CLIENT_SECRET:
            return Promise.resolve('mock-client-secret'); // string
          case BusinessSetupStepKeys.AVITO_ACCESS_TOKEN:
            return Promise.resolve('mock-access-token'); // string
          default:
            return Promise.resolve(undefined); // undefined for optional values
        }
      }),
    } as any;

    mockAgentChatService = {
      addMessage: jest.fn().mockResolvedValue({ id: 'test-message-id' }),
    } as any;

    mockAiModelRegistryService = {
      getEffectiveModelConfig: jest.fn().mockReturnValue({
        modelId: 'google/gemini-2.5-flash',
        provider: 'google',
        inputCostPer1kTokensInCents: 0.25,
        outputCostPer1kTokensInCents: 1.0,
      }),
      getModel: jest.fn().mockReturnValue({
        modelId: 'google/gemini-2.5-flash',
        provider: 'google',
        model: {
          // LanguageModel instance without generateObject method
        },
      }),
      getDefaultModel: jest.fn().mockReturnValue({
        modelId: 'google/gemini-2.5-flash',
        model: {
          // LanguageModel instance without generateObject method
        },
      }),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    mockHttpTool = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvitoWelcomeSGRService,
        AvitoWelcomeToolDispatcherService,
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

    service = module.get<AvitoWelcomeSGRService>(AvitoWelcomeSGRService);
    toolDispatcher = module.get<AvitoWelcomeToolDispatcherService>(AvitoWelcomeToolDispatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWelcomeMessage', () => {
    it('should handle successful credential processing', async () => {
      const message = "CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF', CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'";

      // Mock successful HTTP response from Avito API
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: 'mock_access_token',
          expires_in: 86400,
          token_type: 'Bearer'
        }
      });

      await service.processWelcomeMessage(message, mockUserId, mockWorkspaceId, mockThreadId);

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: 'R3cTDMk9rEJ2lh5A9_QF'
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'
      });

      // Verify success message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: mockThreadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('✅'),
        })
      );

      // Verify transition event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.welcome.completed',
        expect.objectContaining({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          success: true,
        })
      );
    });

    it('should handle invalid credentials gracefully', async () => {
      const message = "Hello, I want to connect to Avito";

      await service.processWelcomeMessage(message, mockUserId, mockWorkspaceId, mockThreadId);

      // Verify retry message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: mockThreadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('CLIENT_ID'),
        })
      );

      // Verify no credentials were stored
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID
        })
      );
    });

    it('should handle Avito API validation failure', async () => {
      const message = "CLIENT_ID = 'invalid_id', CLIENT_SECRET = 'invalid_secret'";

      // Mock failed HTTP response from Avito API
      mockHttpTool.execute.mockResolvedValue({
        error: 'Unauthorized',
      });

      await service.processWelcomeMessage(message, mockUserId, mockWorkspaceId, mockThreadId);

      // Verify error message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: mockThreadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('❌'),
        })
      );

      // Verify failure event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.welcome.failed',
        expect.objectContaining({
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          error: expect.any(String),
        })
      );
    });
  });

  describe('getWelcomeStatus', () => {
    it('should return correct welcome status', async () => {
      mockUserVarsService.get
        .mockResolvedValueOnce(false) // welcomePending
        .mockResolvedValueOnce('R3cTDMk9rEJ2lh5A9_QF'); // clientId

      const status = await service.getWelcomeStatus(mockUserId, mockWorkspaceId);

      expect(status).toEqual({
        welcomePending: false,
        credentialsStored: true,
        avitoClientId: 'R3cTDMk9rE...',
      });
    });

    it('should handle missing credentials', async () => {
      // Override the default mock to return false for missing credentials (pending state)
      mockUserVarsService.get.mockResolvedValue(false);

      const status = await service.getWelcomeStatus(mockUserId, mockWorkspaceId);

      expect(status).toEqual({
        welcomePending: true,
        credentialsStored: false,
      });
    });
  });
});

describe('AvitoWelcomeToolDispatcherService', () => {
  let dispatcher: AvitoWelcomeToolDispatcherService;
  let mockUserVarsService: jest.Mocked<UserVarsService<BusinessSetupKeyValueTypeMap>>;
  let mockHttpTool: jest.Mocked<HttpTool>;

  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-123';

  beforeEach(async () => {
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(true),
    } as any;

    mockHttpTool = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvitoWelcomeToolDispatcherService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: HttpTool,
          useValue: mockHttpTool,
        },
      ],
    }).compile();

    dispatcher = module.get<AvitoWelcomeToolDispatcherService>(AvitoWelcomeToolDispatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extract_credentials tool', () => {
    it('should extract credentials from standard format', async () => {
      const command = {
        tool: 'extract_credentials' as const,
        message: "CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF' CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'",
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        client_id: 'R3cTDMk9rEJ2lh5A9_QF',
        client_secret: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
        extraction_successful: true,
        valid_format: true,
        patterns_matched: 'both',
        message: expect.any(String),
      });
    });

    it('should extract credentials from JSON format', async () => {
      const command = {
        tool: 'extract_credentials' as const,
        message: '{"client_id": "test_id", "client_secret": "test_secret_with_enough_length"}',
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data.client_id).toBe('test_id');
      expect(result.data.client_secret).toBe('test_secret_with_enough_length');
    });

    it('should handle missing credentials', async () => {
      const command = {
        tool: 'extract_credentials' as const,
        message: "Hello, I want to connect to Avito",
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(false);
      expect(result.data.extraction_successful).toBe(false);
    });
  });

  describe('validate_avito_token tool', () => {
    it('should successfully validate credentials', async () => {
      const command = {
        tool: 'validate_avito_token' as const,
        client_id: 'R3cTDMk9rEJ2lh5A9_QF',
        client_secret: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
        api_url: 'https://api.avito.ru/token',
      };

      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: 'mock_token',
          expires_in: 86400,
          token_type: 'Bearer',
        }
      });

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data.validation_successful).toBe(true);
      expect(result.data.access_token).toBe('mock_token');

      // Verify HTTP tool was called correctly
      expect(mockHttpTool.execute).toHaveBeenCalledWith({
        url: 'https://api.avito.ru/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.stringContaining('grant_type=client_credentials'),
      });
    });

    it('should handle API validation failure', async () => {
      const command = {
        tool: 'validate_avito_token' as const,
        client_id: 'invalid_id',
        client_secret: 'invalid_secret',
        api_url: 'https://api.avito.ru/token',
      };

      mockHttpTool.execute.mockResolvedValue({
        error: 'Unauthorized'
      });

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌');
    });
  });

  describe('store_credentials tool', () => {
    it('should store credentials successfully', async () => {
      const command = {
        tool: 'store_credentials' as const,
        client_id: 'R3cTDMk9rEJ2lh5A9_QF',
        client_secret: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
        access_token: 'mock_token',
        expires_in: 86400,
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data.storage_successful).toBe(true);

      // Verify all credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: 'R3cTDMk9rEJ2lh5A9_QF'
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
        value: 'mock_token'
      });
    });
  });

  describe('request_credentials tool', () => {
    it('should generate appropriate request message', async () => {
      const command = {
        tool: 'request_credentials' as const,
        reason: 'no_credentials_found' as const,
        user_friendly_message: 'Custom message',
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data.message_sent).toBe(true);
      expect(result.message).toBe('Custom message');
    });
  });

  describe('report_welcome_completion tool', () => {
    it('should handle successful completion', async () => {
      const command = {
        tool: 'report_welcome_completion' as const,
        success: true,
        credentials_stored: true,
        next_stage: 'business_analysis' as const,
        summary_message: 'Успешно завершено!',
      };

      const result = await dispatcher.dispatch(command, mockUserId, mockWorkspaceId);

      expect(result.success).toBe(true);
      expect(result.data.task_completed).toBe(true);
      expect(result.data.next_stage).toBe('business_analysis');
    });
  });
});

describe('SGR Schema Validation', () => {
  it('should validate AvitoWelcomeStepSchema correctly', async () => {
    const { AvitoWelcomeStepSchema } = await import('../schemas/avito-welcome-sgr.schema');

    const validStep = {
      current_state: 'Analyzing user message for credentials',
      plan_remaining_steps: ['Extract credentials', 'Validate with API'],
      task_completed: false,
      function: {
        tool: 'extract_credentials',
        message: 'CLIENT_ID = test',
      }
    };

    const result = AvitoWelcomeStepSchema.safeParse(validStep);
    expect(result.success).toBe(true);
  });

  it('should reject invalid schema with too many planned steps', async () => {
    const { AvitoWelcomeStepSchema } = await import('../schemas/avito-welcome-sgr.schema');

    const invalidStep = {
      current_state: 'Test',
      plan_remaining_steps: ['Step 1', 'Step 2', 'Step 3', 'Step 4'], // Too many steps
      task_completed: false,
      function: {
        tool: 'extract_credentials',
        message: 'test',
      }
    };

    const result = AvitoWelcomeStepSchema.safeParse(invalidStep);
    expect(result.success).toBe(false);
  });
});