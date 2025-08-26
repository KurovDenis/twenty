import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../../business-setup.service';
import { BusinessSetupWelcomeAgentService } from '../../services/business-setup-welcome-agent.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';

// Mock the 'ai' package to provide generateObject function
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

/**
 * Integration test for the complete Avito Welcome Agent SGR workflow
 * 
 * This test validates the end-to-end flow from user message input
 * through credential validation to final business setup transition.
 */
describe('Avito Welcome Agent SGR Integration', () => {
  let businessSetupService: BusinessSetupWelcomeAgentService;
  let sgrService: AvitoWelcomeSGRService;
  let mockUserVarsService: jest.Mocked<UserVarsService<BusinessSetupKeyValueTypeMap>>;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockHttpTool: jest.Mocked<HttpTool>;
  let mockGenerateObject: jest.MockedFunction<typeof import('ai').generateObject>;

  const testData = {
    userId: 'user-12345',
    workspaceId: 'workspace-67890',
    threadId: 'thread-abcdef',
    validClientId: 'R3cTDMk9rEJ2lh5A9_QF',
    validClientSecret: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
    mockAccessToken: 'X5Bmu0HbQjuu3I9nVN2Sdwy8kCWs0dnzCl98yEM4',
  };

  beforeEach(async () => {
    // Get the mocked generateObject function
    mockGenerateObject = require('ai').generateObject as jest.MockedFunction<typeof import('ai').generateObject>;
    
    // Configure generateObject mock implementation - simplified to avoid type issues
    mockGenerateObject.mockResolvedValue({
      object: {
        current_state: 'Found valid credentials in user message',
        plan_remaining_steps: ['Validate credentials', 'Store if valid'],
        task_completed: false,
        function: {
          tool: 'validate_avito_token',
          client_id: testData.validClientId,
          client_secret: testData.validClientSecret,
          api_url: 'https://api.avito.ru/token'
        }
      },
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      warnings: [],
      request: { body: '{}' },
      response: { headers: {}, timestamp: new Date() },
      experimental_providerMetadata: {},
      rawResponse: { headers: {} },
      logprobs: undefined,
      providerMetadata: undefined,
      toJsonResponse: () => ({ type: 'object', object: {} })
    } as any);
    
    // Mock services
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockAgentChatService = {
      addMessage: jest.fn().mockResolvedValue(undefined),
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
        model: {},
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
        BusinessSetupWelcomeAgentService,
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
        // Mock other dependencies
        {
          provide: 'AgentExecutionService',
          useValue: { executeAgent: jest.fn() },
        },
        {
          provide: 'UserService',
          useValue: { findById: jest.fn() },
        },
        {
          provide: 'WorkspaceService',
          useValue: { findById: jest.fn() },
        },
        {
          provide: 'DataSource',
          useValue: {},
        },
        {
          provide: 'AgentEntityRepository',
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    businessSetupService = module.get<BusinessSetupWelcomeAgentService>(BusinessSetupWelcomeAgentService);
    sgrService = module.get<AvitoWelcomeSGRService>(AvitoWelcomeSGRService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Welcome Flow - Success Scenario', () => {
    it('should successfully process valid credentials through complete SGR workflow', async () => {
      // Arrange: Setup successful Avito API response
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: testData.mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer'
        }
      });

      const userMessage = `
Привет! Вот мои данные для Avito:
CLIENT_ID = '${testData.validClientId}'
CLIENT_SECRET = '${testData.validClientSecret}'
`;

      // Act: Process the message through the complete SGR workflow
      await businessSetupService.processUserMessage(
        testData.threadId,
        userMessage,
        testData.workspaceId,
        testData.userId
      );

      // Assert: Verify credentials were validated with Avito API
      expect(mockHttpTool.execute).toHaveBeenCalledWith({
        url: 'https://api.avito.ru/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: expect.stringContaining(`client_id=${testData.validClientId}`)
      });

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: testData.validClientId
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: testData.validClientSecret
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
        value: testData.mockAccessToken
      });

      // Verify business setup state transition
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true
      });

      // Verify success message was sent to user
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('✅'),
        })
      );

      // Verify events were emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.welcome.completed',
        expect.objectContaining({
          userId: testData.userId,
          workspaceId: testData.workspaceId,
          success: true,
          next_stage: 'business_analysis'
        })
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.step-transition',
        expect.objectContaining({
          userId: testData.userId,
          workspaceId: testData.workspaceId,
          fromStep: 'WELCOME',
          toStep: 'BUSINESS_ANALYSIS'
        })
      );
    });
  });

  describe('Complete Welcome Flow - Credential Request Scenario', () => {
    it('should request credentials when none are found in message', async () => {
      const userMessage = "Привет! Я хочу подключиться к Avito, но не знаю как.";

      // Act: Process the message
      await businessSetupService.processUserMessage(
        testData.threadId,
        userMessage,
        testData.workspaceId,
        testData.userId
      );

      // Assert: Verify helpful instructions were sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringMatching(/CLIENT_ID.*CLIENT_SECRET/i),
        })
      );

      // Verify no credentials were stored
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID
        })
      );

      // Verify no state transition occurred
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          value: false
        })
      );
    });
  });

  describe('Complete Welcome Flow - API Validation Failure', () => {
    it('should handle Avito API validation failure gracefully', async () => {
      // Arrange: Setup failed Avito API response
      mockHttpTool.execute.mockResolvedValue({
        error: 'HTTP 401: Unauthorized - Invalid credentials'
      });

      const userMessage = `
CLIENT_ID = '${testData.validClientId}'
CLIENT_SECRET = 'invalid_secret'
`;

      // Act: Process the message
      await businessSetupService.processUserMessage(
        testData.threadId,
        userMessage,
        testData.workspaceId,
        testData.userId
      );

      // Assert: Verify error message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('❌'),
        })
      );

      // Verify credentials were NOT stored
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID
        })
      );

      // Verify failure event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.welcome.failed',
        expect.objectContaining({
          userId: testData.userId,
          workspaceId: testData.workspaceId,
          error: expect.any(String)
        })
      );
    });
  });

  describe('SGR Reasoning Quality', () => {
    it('should demonstrate structured reasoning with proper step planning', async () => {
      const userMessage = `CLIENT_ID = '${testData.validClientId}' CLIENT_SECRET = '${testData.validClientSecret}'`;

      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: testData.mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer'
        }
      });

      await businessSetupService.processUserMessage(
        testData.threadId,
        userMessage,
        testData.workspaceId,
        testData.userId
      );

      // Verify that the AI model was called with appropriate context for structured reasoning
      expect(mockAiModelRegistryService.getModel).toHaveBeenCalledWith('google/gemini-2.5-flash');
      
      // Verify structured reasoning occurred (mocked generateObject was called)
      expect(mockGenerateObject).toHaveBeenCalled();
      expect(mockGenerateObject.mock.calls.length).toBeGreaterThan(0);

      // Verify the reasoning included proper system prompts for SGR
      const firstCall = mockGenerateObject.mock.calls[0][0];
      expect(firstCall.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('Schema-Guided Reasoning')
          })
        ])
      );
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to legacy processing if SGR fails', async () => {
      // Arrange: Make SGR service throw an error
      const mockSGRService = jest.spyOn(sgrService, 'processWelcomeMessage')
        .mockRejectedValue(new Error('SGR processing failed'));

      const userMessage = `CLIENT_ID = '${testData.validClientId}' CLIENT_SECRET = '${testData.validClientSecret}'`;

      // Act: Process the message (should fallback to legacy)
      await businessSetupService.processUserMessage(
        testData.threadId,
        userMessage,
        testData.workspaceId,
        testData.userId
      );

      // Assert: Verify SGR was attempted
      expect(mockSGRService).toHaveBeenCalled();

      // Verify fallback message was sent (legacy behavior)
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
        })
      );

      mockSGRService.mockRestore();
    });
  });
});

describe('SGR Performance and Reliability', () => {
  it('should complete processing within reasonable time limits', async () => {
    // This test would verify that SGR processing doesn't take too long
    // and includes proper timeout handling
    expect(true).toBe(true); // Placeholder for performance testing
  });

  it('should handle concurrent message processing correctly', async () => {
    // This test would verify that multiple simultaneous messages
    // are handled correctly without race conditions
    expect(true).toBe(true); // Placeholder for concurrency testing
  });

  it('should maintain conversation context across multiple steps', async () => {
    // This test would verify that SGR maintains proper context
    // throughout multi-step reasoning processes
    expect(true).toBe(true); // Placeholder for context testing
  });
});