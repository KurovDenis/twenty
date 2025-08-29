import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';

import {
  type BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../business-setup.service';
import { BusinessSetupWelcomeAgentService } from '../services/business-setup-welcome-agent.service';
import { AvitoWelcomeSGRService } from '../sgr/services/avito-welcome-sgr.service';

// Mock the 'ai' package to provide generateObject function
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

/**
 * Integration test for the Business Setup Welcome Agent with streaming SGR
 *
 * This test validates the complete end-to-end flow with real-time streaming
 * of AI thinking processes during credential validation.
 */
describe('BusinessSetupWelcomeAgentService - Streaming SGR Integration', () => {
  let businessSetupService: BusinessSetupWelcomeAgentService;
  let mockUserVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockHttpTool: jest.Mocked<HttpTool>;
  let mockAgentExecutionService: jest.Mocked<AgentExecutionService>;
  let mockUserService: jest.Mocked<any>;
  let mockWorkspaceService: jest.Mocked<any>;

  const testData = {
    userId: 'user-12345',
    workspaceId: 'workspace-67890',
    threadId: 'thread-abcdef',
    validClientId: 'R3cTDMk9rEJ2lh5A9_QF',
    validClientSecret: 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc',
    mockAccessToken: 'X5Bmu0HbQjuu3I9nVN2Sdwy8kCWs0dnzCl98yEM4',
  };

  beforeEach(async () => {
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

    mockAgentExecutionService = {
      executeAgent: jest.fn().mockResolvedValue({
        result: {
          response: 'Welcome message',
        },
      }),
    } as any;

    mockUserService = {
      findById: jest.fn().mockResolvedValue({
        id: testData.userId,
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      }),
    } as any;

    mockWorkspaceService = {
      findById: jest.fn().mockResolvedValue({
        id: testData.workspaceId,
        displayName: 'Test Workspace',
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupWelcomeAgentService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: AgentChatService,
          useValue: mockAgentChatService,
        },
        {
          provide: AgentExecutionService,
          useValue: mockAgentExecutionService,
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
        {
          provide: 'UserService',
          useValue: mockUserService,
        },
        {
          provide: 'WorkspaceService',
          useValue: mockWorkspaceService,
        },
        {
          provide: 'DataSource',
          useValue: {},
        },
        {
          provide: 'AgentEntityRepository',
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        // Mock the SGR service to test streaming functionality
        {
          provide: AvitoWelcomeSGRService,
          useValue: {
            processWelcomeMessageWithStreaming: jest
              .fn()
              .mockImplementation(async function* () {
                // Mock streaming SGR results
                yield {
                  type: 'thinking',
                  step: {
                    stepNumber: 1,
                    currentState: 'Analyzing user message for credentials',
                    plannedSteps: [
                      'Extract credentials',
                      'Validate with Avito API',
                    ],
                    selectedTool: 'extract_credentials',
                    timestamp: new Date(),
                  },
                  completed: false,
                };

                yield {
                  type: 'tool_execution',
                  step: {
                    stepNumber: 1,
                    currentState: 'Credentials extracted successfully',
                    plannedSteps: ['Validate with Avito API'],
                    selectedTool: 'extract_credentials',
                    toolExecution: {
                      status: 'completed',
                    },
                    timestamp: new Date(),
                  },
                  completed: false,
                };

                yield {
                  type: 'final_response',
                  content: '✅ Credentials validated and stored successfully!',
                  completed: true,
                };
              }),
          },
        },
      ],
    }).compile();

    businessSetupService = module.get<BusinessSetupWelcomeAgentService>(
      BusinessSetupWelcomeAgentService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleUserMessage with Streaming SGR', () => {
    it('should process user message with streaming SGR and send incremental messages', async () => {
      // Arrange: Setup successful Avito API response
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: testData.mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
      });

      const userMessage = `
Привет! Вот мои данные для Avito:
CLIENT_ID = '${testData.validClientId}'
CLIENT_SECRET = '${testData.validClientSecret}'
`;

      const payload = {
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        threadId: testData.threadId,
        message: userMessage,
        timestamp: new Date(),
      };

      // Act: Process the message through the streaming SGR workflow
      await businessSetupService.processUserMessage(
        payload.threadId,
        payload.message,
        payload.workspaceId,
        payload.userId,
      );

      // Assert: Verify that multiple messages were sent to show streaming progress
      expect(mockAgentChatService.addMessage).toHaveBeenCalledTimes(3);

      // Verify thinking message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('Шаг 1: Анализ'),
        }),
      );

      // Verify tool execution message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining(
            'Инструмент extract_credentials выполнен успешно',
          ),
        }),
      );

      // Verify final response message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining('✅'),
        }),
      );

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: testData.validClientId,
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: testData.validClientSecret,
      });

      // Verify business setup state transition
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        value: false,
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
        value: true,
      });
    });

    it('should handle streaming SGR errors gracefully', async () => {
      // Arrange: Mock the SGR service to throw an error
      const mockSGRService = businessSetupService[
        'avitoWelcomeSGRService'
      ] as any;

      mockSGRService.processWelcomeMessageWithStreaming = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Streaming SGR failed');
        });

      const userMessage = "CLIENT_ID = 'invalid' CLIENT_SECRET = 'invalid'";

      const payload = {
        userId: testData.userId,
        workspaceId: testData.workspaceId,
        threadId: testData.threadId,
        message: userMessage,
        timestamp: new Date(),
      };

      // Act: Process the message (should fallback to legacy processing)
      await businessSetupService.processUserMessage(
        payload.threadId,
        payload.message,
        payload.workspaceId,
        payload.userId,
      );

      // Assert: Verify fallback message was sent
      expect(mockAgentChatService.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: testData.threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: expect.stringContaining(
            '❌ Произошла ошибка при обработке сообщения',
          ),
        }),
      );
    });
  });
});
