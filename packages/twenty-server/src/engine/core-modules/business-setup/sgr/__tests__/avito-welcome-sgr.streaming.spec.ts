import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import {
  type BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from '../services/avito-welcome-tool-dispatcher.service';

// Mock the 'ai' package to provide generateObject function
jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

/**
 * Test suite for the streaming SGR functionality in Avito Welcome Agent
 *
 * This test validates the real-time streaming of AI thinking processes
 * during credential validation and business setup.
 */
describe('Avito Welcome Agent SGR Streaming', () => {
  let service: AvitoWelcomeSGRService;
  let mockUserVarsService: jest.Mocked<
    UserVarsService<BusinessSetupKeyValueTypeMap>
  >;
  let mockAgentChatService: jest.Mocked<AgentChatService>;
  let mockAiModelRegistryService: jest.Mocked<AiModelRegistryService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockHttpTool: jest.Mocked<HttpTool>;
  let mockGenerateObject: jest.MockedFunction<
    typeof import('ai').generateObject
  >;

  const mockUserId = 'user-123';
  const mockWorkspaceId = 'workspace-123';
  const mockThreadId = 'thread-123';
  const mockClientId = 'R3cTDMk9rEJ2lh5A9_QF';
  const mockClientSecret = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc';
  const mockAccessToken = 'mock_access_token';

  beforeEach(async () => {
    // Get the mocked generateObject function
    mockGenerateObject = require('ai').generateObject as jest.MockedFunction<
      typeof import('ai').generateObject
    >;

    // Configure generateObject mock implementation for streaming SGR
    mockGenerateObject.mockResolvedValue({
      object: {
        current_state: 'Found valid credentials in user message',
        plan_remaining_steps: [
          'Validate credentials with Avito API',
          'Store validated credentials',
          'Transition to business analysis',
        ],
        task_completed: false,
        function: {
          tool: 'validate_avito_token',
          client_id: mockClientId,
          client_secret: mockClientSecret,
          api_url: 'https://api.avito.ru/token',
        },
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
      toJsonResponse: () => ({ type: 'object', object: {} }),
    } as any);

    // Create mocks
    mockUserVarsService = {
      set: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockImplementation((params) => {
        // Return appropriate typed values based on key
        switch (params.key) {
          case BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING:
            return Promise.resolve(false); // boolean
          case BusinessSetupStepKeys.AVITO_CLIENT_ID:
            return Promise.resolve(mockClientId); // string
          case BusinessSetupStepKeys.AVITO_CLIENT_SECRET:
            return Promise.resolve(mockClientSecret); // string
          case BusinessSetupStepKeys.AVITO_ACCESS_TOKEN:
            return Promise.resolve(mockAccessToken); // string
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processWelcomeMessageWithStreaming', () => {
    it('should stream SGR thinking steps during successful credential processing', async () => {
      // Arrange: Setup successful Avito API response
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
      });

      const userMessage = `CLIENT_ID = '${mockClientId}' CLIENT_SECRET = '${mockClientSecret}'`;
      const streamedResults: any[] = [];

      // Act: Process the message with streaming
      const stream = service.processWelcomeMessageWithStreaming(
        userMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      for await (const result of stream) {
        streamedResults.push(result);
      }

      // Assert: Verify streaming results
      expect(streamedResults.length).toBeGreaterThan(0);

      // Check that we have thinking steps
      const thinkingSteps = streamedResults.filter(
        (r) => r.type === 'thinking',
      );

      expect(thinkingSteps.length).toBeGreaterThan(0);

      // Check that we have tool execution steps
      const toolExecutionSteps = streamedResults.filter(
        (r) => r.type === 'tool_execution',
      );

      expect(toolExecutionSteps.length).toBeGreaterThan(0);

      // Check that we have a final response
      const finalResponses = streamedResults.filter(
        (r) => r.type === 'final_response',
      );

      expect(finalResponses.length).toBe(1);

      // Verify the final response contains success message
      expect(finalResponses[0].content).toContain('✅');

      // Verify credentials were stored
      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: mockClientId,
      });

      expect(mockUserVarsService.set).toHaveBeenCalledWith({
        userId: mockUserId,
        workspaceId: mockWorkspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: mockClientSecret,
      });
    });

    it('should stream error messages when credential validation fails', async () => {
      // Arrange: Setup failed Avito API response
      mockHttpTool.execute.mockResolvedValue({
        error: 'HTTP 401: Unauthorized - Invalid credentials',
      });

      const userMessage = `CLIENT_ID = '${mockClientId}' CLIENT_SECRET = 'invalid_secret'`;
      const streamedResults: any[] = [];

      // Act: Process the message with streaming
      const stream = service.processWelcomeMessageWithStreaming(
        userMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      for await (const result of stream) {
        streamedResults.push(result);
      }

      // Assert: Verify error is streamed
      const finalResponses = streamedResults.filter(
        (r) => r.type === 'final_response',
      );

      expect(finalResponses.length).toBe(1);
      expect(finalResponses[0].content).toContain('❌');

      // Verify credentials were NOT stored
      expect(mockUserVarsService.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        }),
      );
    });

    it('should stream thinking steps with proper structure', async () => {
      // Arrange
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
      });

      const userMessage = `CLIENT_ID = '${mockClientId}' CLIENT_SECRET = '${mockClientSecret}'`;
      const streamedResults: any[] = [];

      // Act
      const stream = service.processWelcomeMessageWithStreaming(
        userMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      for await (const result of stream) {
        streamedResults.push(result);
      }

      // Assert: Verify thinking step structure
      const thinkingSteps = streamedResults.filter(
        (r) => r.type === 'thinking',
      );

      expect(thinkingSteps.length).toBeGreaterThan(0);

      const firstThinkingStep = thinkingSteps[0];

      expect(firstThinkingStep.step).toBeDefined();
      expect(firstThinkingStep.step.stepNumber).toBeGreaterThanOrEqual(1);
      expect(firstThinkingStep.step.currentState).toBeDefined();
      expect(firstThinkingStep.step.plannedSteps).toBeDefined();
      expect(Array.isArray(firstThinkingStep.step.plannedSteps)).toBe(true);
      expect(firstThinkingStep.step.selectedTool).toBeDefined();
      expect(firstThinkingStep.step.timestamp).toBeInstanceOf(Date);
    });

    it('should stream tool execution steps with proper structure', async () => {
      // Arrange
      mockHttpTool.execute.mockResolvedValue({
        result: {
          access_token: mockAccessToken,
          expires_in: 86400,
          token_type: 'Bearer',
        },
      });

      const userMessage = `CLIENT_ID = '${mockClientId}' CLIENT_SECRET = '${mockClientSecret}'`;
      const streamedResults: any[] = [];

      // Act
      const stream = service.processWelcomeMessageWithStreaming(
        userMessage,
        mockUserId,
        mockWorkspaceId,
        mockThreadId,
      );

      for await (const result of stream) {
        streamedResults.push(result);
      }

      // Assert: Verify tool execution step structure
      const toolExecutionSteps = streamedResults.filter(
        (r) => r.type === 'tool_execution',
      );

      expect(toolExecutionSteps.length).toBeGreaterThan(0);

      const firstToolExecutionStep = toolExecutionSteps[0];

      expect(firstToolExecutionStep.step).toBeDefined();
      expect(firstToolExecutionStep.step.toolExecution).toBeDefined();
      expect(firstToolExecutionStep.step.toolExecution.status).toBeDefined();
    });
  });
});
