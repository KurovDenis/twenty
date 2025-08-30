import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { generateObject } from 'ai';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import {
  BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import {
  AvitoWelcomeStepSchema,
  type SGRExecutionParams,
  type SGRStepResult,
  SGR_SYSTEM_PROMPTS,
  type WelcomeExecutionContext,
  WelcomeToolUnion,
  isCompletionTool,
} from '../schemas/avito-welcome-sgr.schema';
import {
  type AvitoCredentials,
  AvitoWorkflowContext,
  AvitoWorkflowContextFactory,
  AvitoWorkflowState,
  AvitoWorkflowStateValidator,
  CREDENTIAL_VALIDATION_RULES,
  type StateTransitionLog,
  type ValidationResult,
} from '../types/avito-workflow-context';
import {
  DEFAULT_SGR_THINKING_CONFIG,
  type SGRExecutionResult,
  type SGRStreamingContext,
  SGRStreamingError,
  SGRStreamingException,
  type SGRStreamingResult,
  type SGRThinkingStep,
} from '../types/sgr-thinking-stream.types';

import { AvitoWelcomeToolDispatcherService } from './avito-welcome-tool-dispatcher.service';

/**
 * Enhanced SGR (Schema-Guided Reasoning) execution service for Avito Welcome Agent
 *
 * Orchestrates the structured reasoning workflow that guides the AI agent
 * through credential collection, validation, and storage with step-by-step
 * transparent reasoning.
 *
 * ENHANCED FEATURES (Consolidated from duplicate services):
 * - Advanced state machine validation with transition guards
 * - Multi-pattern credential extraction with format validation
 * - Enhanced error handling with detailed classification
 * - Improved streaming response formatting with progress indicators
 * - Comprehensive workflow context management with state history
 * - Timeout handling mechanisms with recovery strategies
 * - User interaction tracking and audit trail
 */
@Injectable()
export class AvitoWelcomeSGRService {
  private readonly logger = new Logger(AvitoWelcomeSGRService.name);
  private readonly GEMINI_MODEL_ID = 'google/gemini-2.5-flash';

  // Enhanced configuration (extracted from duplicate services)
  private readonly WORKFLOW_TIMEOUT_MS = 600000; // 10 minutes
  private readonly MAX_CREDENTIAL_ATTEMPTS = 3;
  private readonly CREDENTIAL_EXTRACTION_PATTERNS = [
    {
      clientId: /CLIENT_ID\s*=\s*['"]*([A-Za-z0-9_-]+)['"]*$/gim,
      clientSecret: /CLIENT_SECRET\s*=\s*['"]*([A-Za-z0-9_-]+)['"]*$/gim,
    },
    {
      clientId: /CLIENT_ID\s*:\s*['"]*([A-Za-z0-9_-]+)['"]*$/gim,
      clientSecret: /CLIENT_SECRET\s*:\s*['"]*([A-Za-z0-9_-]+)['"]*$/gim,
    },
    {
      clientId: /"client_id"\s*:\s*"([A-Za-z0-9_-]+)"/gim,
      clientSecret: /"client_secret"\s*:\s*"([A-Za-z0-9_-]+)"/gim,
    },
  ];

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly agentChatService: AgentChatService,
    private readonly aiModelRegistryService: AiModelRegistryService,
    private readonly toolDispatcher: AvitoWelcomeToolDispatcherService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Main entry point for processing welcome messages with SGR
   */
  async processWelcomeMessage(
    message: string,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): Promise<void> {
    this.logger.log(`Processing welcome message with SGR for user ${userId}`);

    const task = `
Пользователь отправил сообщение: "${message}"

Задача: Получить CLIENT_ID и CLIENT_SECRET для Avito API, проверить их валидность 
через https://api.avito.ru/token и сохранить для дальнейшего использования.

Если credentials найдены - проверь их. Если не найдены - запроси у пользователя.
Используй дружелюбный тон на русском языке.
`;

    try {
      const result = await this.executeSGRWorkflow({
        task,
        userId,
        workspaceId,
        threadId,
        maxSteps: 10, // Ограничиваем для welcome stage
      });

      await this.handleWelcomeResult(result, userId, workspaceId, threadId);
    } catch (error) {
      this.logger.error('SGR workflow execution failed:', error);

      await this.agentChatService.addMessage({
        threadId,
        role: AgentChatMessageRole.ASSISTANT,
        content:
          '❌ Произошла ошибка при обработке запроса. Попробуйте еще раз или обратитесь в поддержку.',
        fileIds: [],
      });
    }
  }

  /**
   * NEW: Main entry point for processing welcome messages with STREAMING SGR
   * Provides real-time visibility into AI thinking process
   */
  async *processWelcomeMessageWithStreaming(
    userMessage: string,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): AsyncGenerator<SGRStreamingResult> {
    this.logger.log(
      `Processing welcome message with STREAMING SGR for user ${userId}`,
    );

    const context: SGRStreamingContext = {
      userId,
      workspaceId,
      threadId,
      userMessage,
      maxSteps: 10,
    };

    const task = `
Пользователь отправил сообщение: "${userMessage}"

Задача: Получить CLIENT_ID и CLIENT_SECRET для Avito API, проверить их валидность 
через https://api.avito.ru/token и сохранить для дальнейшего использования.

Если credentials найдены - проверь их. Если не найдены - запроси у пользователя.
Используй дружелюбный тон на русском языке.
`;

    try {
      // Execute SGR workflow with streaming
      yield* this.executeSGRWorkflowWithStreaming(
        {
          task,
          userId,
          workspaceId,
          threadId,
          maxSteps: context.maxSteps || 10,
        },
        context,
      );
    } catch (error) {
      this.logger.error('Streaming SGR workflow execution failed:', error);

      // Yield error result
      yield {
        type: 'final_response',
        content:
          '❌ Произошла ошибка при обработке запроса. Попробуйте еще раз или обратитесь в поддержку.',
        completed: true,
      };
    }
  }

  /**
   * Execute complete SGR workflow with structured reasoning
   */
  private async executeSGRWorkflow(
    params: SGRExecutionParams,
  ): Promise<SGRExecutionResult> {
    this.logger.log(
      `Starting SGR workflow with max ${params.maxSteps || 20} steps`,
    );

    const conversationLog = [
      {
        role: 'system' as const,
        content: SGR_SYSTEM_PROMPTS.WELCOME_AGENT,
      },
      {
        role: 'user' as const,
        content: params.task,
      },
    ];

    const stepsExecuted: string[] = [];
    const maxSteps = params.maxSteps || 20;

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      try {
        this.logger.log(`Executing SGR step ${stepNumber}/${maxSteps}`);

        // Get structured decision from AI model
        const stepResult = await this.executeReasoningStep({
          conversationLog,
          stepNumber,
          userId: params.userId,
          workspaceId: params.workspaceId,
          threadId: params.threadId,
        });

        stepsExecuted.push(`Step ${stepNumber}: ${stepResult.function.tool}`);

        // Check for completion
        if (isCompletionTool(stepResult.function)) {
          this.logger.log('SGR workflow completed successfully');

          return {
            success: stepResult.function.success,
            credentials_stored: stepResult.function.credentials_stored,
            next_stage: stepResult.function.next_stage,
            summary: stepResult.function.summary_message,
            steps_executed: stepsExecuted,
          };
        }

        // Execute selected tool
        const toolResult = await this.toolDispatcher.dispatch(
          stepResult.function,
          params.userId,
          params.workspaceId,
        );

        // Add tool execution to conversation context
        conversationLog.push(
          {
            role: 'user' as const,
            content:
              stepResult.plan_remaining_steps[0] || 'Выполняю следующий шаг...',
          },
          {
            role: 'user' as const,
            content: `Статус выполнения: ${toolResult.success ? 'успешно' : 'ошибка'}`,
          },
        );

        // Log progress
        this.logger.log(
          `Step ${stepNumber} completed: ${stepResult.function.tool} -> ${toolResult.success ? 'success' : 'failed'}`,
        );
      } catch (error) {
        this.logger.error(`SGR step ${stepNumber} failed:`, error);

        return {
          success: false,
          credentials_stored: false,
          next_stage: 'error_retry',
          summary:
            'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
          steps_executed: stepsExecuted,
          error: error.message,
        };
      }
    }

    // Workflow exceeded maximum steps
    this.logger.warn(`SGR workflow exceeded maximum steps (${maxSteps})`);

    return {
      success: false,
      credentials_stored: false,
      next_stage: 'error_retry',
      summary:
        'Превышено максимальное количество шагов обработки. Попробуйте еще раз.',
      steps_executed: stepsExecuted,
      error: 'Maximum steps exceeded',
    };
  }

  /**
   * NEW: Execute complete SGR workflow with STREAMING for real-time visibility
   */
  private async *executeSGRWorkflowWithStreaming(
    params: SGRExecutionParams,
    context: SGRStreamingContext,
  ): AsyncGenerator<SGRStreamingResult> {
    this.logger.log(
      `Starting STREAMING SGR workflow with max ${params.maxSteps || 20} steps`,
    );

    const conversationLog = [
      {
        role: 'system' as const,
        content: SGR_SYSTEM_PROMPTS.WELCOME_AGENT,
      },
      {
        role: 'user' as const,
        content: params.task,
      },
    ];

    const stepsExecuted: string[] = [];
    const streamingSteps: SGRThinkingStep[] = [];
    const maxSteps = params.maxSteps || 20;

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      try {
        this.logger.log(
          `Executing STREAMING SGR step ${stepNumber}/${maxSteps}`,
        );

        // STREAM: Start thinking step
        const thinkingStep: SGRThinkingStep = {
          stepNumber,
          currentState: `Анализирую шаг ${stepNumber} из ${maxSteps}...`,
          plannedSteps: [
            'Получение структурированного решения от AI',
            'Выполнение выбранного инструмента',
            'Анализ результата',
          ],
          selectedTool: 'thinking',
          timestamp: new Date(),
        };

        // Yield thinking step to user
        yield {
          type: 'thinking',
          step: thinkingStep,
          completed: false,
        };

        // Get structured decision from AI model
        const stepResult = await this.executeReasoningStepWithStreaming({
          conversationLog,
          stepNumber,
          userId: params.userId,
          workspaceId: params.workspaceId,
          threadId: params.threadId,
        });

        // Update thinking step with AI decision
        thinkingStep.currentState = stepResult.current_state;
        thinkingStep.plannedSteps = stepResult.plan_remaining_steps;
        thinkingStep.selectedTool = stepResult.function.tool;
        streamingSteps.push(thinkingStep);

        stepsExecuted.push(`Step ${stepNumber}: ${stepResult.function.tool}`);

        // STREAM: Tool selection result
        yield {
          type: 'thinking',
          step: thinkingStep,
          completed: false,
        };

        // Check for completion
        if (isCompletionTool(stepResult.function)) {
          this.logger.log('STREAMING SGR workflow completed successfully');

          // Handle final result
          await this.handleWelcomeResultStreaming(
            {
              success: stepResult.function.success,
              credentials_stored: stepResult.function.credentials_stored,
              next_stage: stepResult.function.next_stage,
              summary: stepResult.function.summary_message,
              steps_executed: stepsExecuted,
              streamingSteps,
            },
            context.userId,
            context.workspaceId,
            context.threadId,
          );

          // STREAM: Final response
          yield {
            type: 'final_response',
            content: stepResult.function.summary_message,
            completed: true,
          };

          return;
        }

        // STREAM: Tool execution start
        thinkingStep.toolExecution = {
          status: 'in_progress',
        };

        yield {
          type: 'tool_execution',
          step: thinkingStep,
          completed: false,
        };

        // Execute selected tool
        const toolResult = await this.toolDispatcher.dispatch(
          stepResult.function,
          params.userId,
          params.workspaceId,
        );

        // STREAM: Tool execution result
        thinkingStep.toolExecution = {
          status: toolResult.success ? 'completed' : 'failed',
          result: toolResult.success ? toolResult.data : undefined,
          error: toolResult.success ? undefined : toolResult.error,
        };

        yield {
          type: 'tool_execution',
          step: thinkingStep,
          completed: false,
        };

        // Add tool execution to conversation context with detailed results
        const toolExecutionContext = this.buildToolExecutionContext(
          stepResult.function,
          toolResult,
          stepNumber,
        );

        conversationLog.push(
          {
            role: 'user' as const,
            content: toolExecutionContext,
          },
        );

        // Log progress
        this.logger.log(
          `STREAMING Step ${stepNumber} completed: ${stepResult.function.tool} -> ${toolResult.success ? 'success' : 'failed'}`,
        );
      } catch (error) {
        this.logger.error(`STREAMING SGR step ${stepNumber} failed:`, error);

        yield {
          type: 'final_response',
          content:
            'Произошла ошибка при обработке запроса. Попробуйте еще раз.',
          completed: true,
        };

        return;
      }
    }

    // Workflow exceeded maximum steps
    this.logger.warn(
      `STREAMING SGR workflow exceeded maximum steps (${maxSteps})`,
    );
    yield {
      type: 'final_response',
      content:
        'Превышено максимальное количество шагов обработки. Попробуйте еще раз.',
      completed: true,
    };
  }

  /**
   * Execute single reasoning step with structured schema validation
   */
  private async executeReasoningStep(
    context: WelcomeExecutionContext & {
      conversationLog: any[];
    },
  ): Promise<SGRStepResult> {
    this.logger.log(`Executing reasoning step ${context.stepNumber}`);

    try {
      // Get AI model for structured generation
      const aiModel = this.aiModelRegistryService.getEffectiveModelConfig(
        this.GEMINI_MODEL_ID,
      );

      if (!aiModel) {
        throw new Error(`AI model ${this.GEMINI_MODEL_ID} not found`);
      }

      const model = this.aiModelRegistryService.getModel(
        this.GEMINI_MODEL_ID,
      )?.model;

      if (!model) {
        throw new Error(`Model instance not found for ${this.GEMINI_MODEL_ID}`);
      }

      // Generate structured output using the schema
      const result = await generateObject({
        model,
        messages: [
          ...context.conversationLog,
          {
            role: 'user' as const,
            content: SGR_SYSTEM_PROMPTS.TASK_INSTRUCTIONS,
          },
        ],
        schema: AvitoWelcomeStepSchema,
        temperature: 0.1, // Low temperature for consistent reasoning
        maxTokens: 1000,
      });

      const stepResult = result.object;

      this.logger.log(`Reasoning step ${context.stepNumber} result:`, {
        current_state: stepResult.current_state.substring(0, 100) + '...',
        planned_steps: stepResult.plan_remaining_steps.length,
        selected_tool: stepResult.function.tool,
        task_completed: stepResult.task_completed,
      });

      return stepResult;
    } catch (error) {
      this.logger.error(`Reasoning step ${context.stepNumber} failed:`, error);
      throw new Error(`Failed to execute reasoning step: ${error.message}`);
    }
  }

  /**
   * NEW: Execute single reasoning step with streaming support
   */
  private async executeReasoningStepWithStreaming(
    context: WelcomeExecutionContext & {
      conversationLog: any[];
    },
  ): Promise<SGRStepResult> {
    this.logger.log(`Executing STREAMING reasoning step ${context.stepNumber}`);

    try {
      // Get AI model for structured generation
      const aiModel = this.aiModelRegistryService.getEffectiveModelConfig(
        this.GEMINI_MODEL_ID,
      );

      if (!aiModel) {
        throw new SGRStreamingException(
          SGRStreamingError.CONTEXT_MISSING,
          `AI model ${this.GEMINI_MODEL_ID} not found`,
          { modelId: this.GEMINI_MODEL_ID },
        );
      }

      const model = this.aiModelRegistryService.getModel(
        this.GEMINI_MODEL_ID,
      )?.model;

      if (!model) {
        throw new SGRStreamingException(
          SGRStreamingError.CONTEXT_MISSING,
          `Model instance not found for ${this.GEMINI_MODEL_ID}`,
          { modelId: this.GEMINI_MODEL_ID },
        );
      }

      // Generate structured output using the schema with timeout
      const result = await Promise.race([
        generateObject({
          model,
          messages: [
            ...context.conversationLog,
            {
              role: 'user' as const,
              content: SGR_SYSTEM_PROMPTS.TASK_INSTRUCTIONS,
            },
          ],
          schema: AvitoWelcomeStepSchema,
          temperature: 0.1, // Low temperature for consistent reasoning
          maxTokens: 1000,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new SGRStreamingException(
                  SGRStreamingError.STREAMING_TIMEOUT,
                  `Reasoning step ${context.stepNumber} timed out`,
                  {
                    stepNumber: context.stepNumber,
                    timeoutMs: DEFAULT_SGR_THINKING_CONFIG.stepTimeoutMs,
                  },
                ),
              ),
            DEFAULT_SGR_THINKING_CONFIG.stepTimeoutMs,
          ),
        ),
      ]);

      const stepResult = (result as any).object;

      if (!stepResult || !stepResult.function) {
        throw new SGRStreamingException(
          SGRStreamingError.INVALID_STEP_RESULT,
          `Invalid step result from AI model`,
          { stepResult, stepNumber: context.stepNumber },
        );
      }

      this.logger.log(
        `STREAMING reasoning step ${context.stepNumber} result:`,
        {
          current_state: stepResult.current_state.substring(0, 100) + '...',
          planned_steps: stepResult.plan_remaining_steps.length,
          selected_tool: stepResult.function.tool,
          task_completed: stepResult.task_completed,
        },
      );

      return stepResult;
    } catch (error) {
      this.logger.error(
        `STREAMING reasoning step ${context.stepNumber} failed:`,
        error,
      );

      if (error instanceof SGRStreamingException) {
        throw error;
      }

      throw new SGRStreamingException(
        SGRStreamingError.TOOL_EXECUTION_FAILED,
        `Failed to execute streaming reasoning step: ${error.message}`,
        { stepNumber: context.stepNumber, originalError: error },
      );
    }
  }

  /**
   * Handle SGR workflow result and update business setup state
   */
  private async handleWelcomeResult(
    result: SGRExecutionResult,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): Promise<void> {
    this.logger.log('Handling SGR workflow result:', {
      success: result.success,
      credentials_stored: result.credentials_stored,
      next_stage: result.next_stage,
    });

    // Send result message to user
    await this.agentChatService.addMessage({
      threadId,
      role: AgentChatMessageRole.ASSISTANT,
      content: result.summary,
      fileIds: [],
    });

    if (result.success && result.credentials_stored) {
      // Update business setup state to move to next stage
      await this.transitionToNextStage(userId, workspaceId, result.next_stage);

      // Emit success event
      this.eventEmitter.emit('business-setup.welcome.completed', {
        userId,
        workspaceId,
        threadId,
        success: true,
        next_stage: result.next_stage,
        timestamp: new Date(),
      });
    } else {
      // Emit failure event for retry or debugging
      this.eventEmitter.emit('business-setup.welcome.failed', {
        userId,
        workspaceId,
        threadId,
        error: result.error,
        steps_executed: result.steps_executed,
        timestamp: new Date(),
      });
    }
  }

  /**
   * NEW: Handle streaming SGR workflow result and update business setup state
   */
  private async handleWelcomeResultStreaming(
    result: SGRExecutionResult,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): Promise<void> {
    this.logger.log('Handling STREAMING SGR workflow result:', {
      success: result.success,
      credentials_stored: result.credentials_stored,
      next_stage: result.next_stage,
      streaming_steps: result.streamingSteps?.length,
    });

    // NOTE: Do not send message here - it will be streamed as final_response
    // The streaming workflow handles message sending through yields

    if (result.success && result.credentials_stored) {
      // Update business setup state to move to next stage
      await this.transitionToNextStage(userId, workspaceId, result.next_stage);

      // Emit success event with streaming context
      this.eventEmitter.emit('business-setup.welcome.completed', {
        userId,
        workspaceId,
        threadId,
        success: true,
        next_stage: result.next_stage,
        streaming_steps: result.streamingSteps,
        timestamp: new Date(),
      });
    } else {
      // Emit failure event for retry or debugging
      this.eventEmitter.emit('business-setup.welcome.failed', {
        userId,
        workspaceId,
        threadId,
        error: result.error,
        steps_executed: result.steps_executed,
        streaming_steps: result.streamingSteps,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Transition to next business setup stage
   */
  private async transitionToNextStage(
    userId: string,
    workspaceId: string,
    nextStage: 'business_analysis' | 'error_retry',
  ): Promise<void> {
    try {
      if (nextStage === 'business_analysis') {
        // Mark welcome step as completed
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          value: false,
        });

        // Set business analysis as next step
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
          value: true,
        });

        // Emit transition event
        this.eventEmitter.emit('business-setup.step-transition', {
          userId,
          workspaceId,
          fromStep: 'WELCOME',
          toStep: 'BUSINESS_ANALYSIS',
          timestamp: new Date(),
        });

        this.logger.log(
          `Successfully transitioned user ${userId} from WELCOME to BUSINESS_ANALYSIS`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to transition to next stage:', error);
      throw error;
    }
  }

  /**
   * Get current welcome status for debugging
   */
  async getWelcomeStatus(
    userId: string,
    workspaceId: string,
  ): Promise<{
    welcomePending: boolean;
    credentialsStored: boolean;
    avitoClientId?: string;
  }> {
    try {
      const [welcomePending, clientId] = await Promise.all([
        this.userVarsService.get({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
        }),
        this.userVarsService.get({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        }),
      ]);

      return {
        welcomePending: welcomePending ?? true,
        credentialsStored: !!clientId,
        avitoClientId: clientId ? clientId.substring(0, 10) + '...' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get welcome status:', error);

      return {
        welcomePending: true,
        credentialsStored: false,
      };
    }
  }

  // ===============================================================
  // ENHANCED METHODS (Extracted from duplicate services)
  // ===============================================================

  /**
   * ENHANCED: Get or initialize workflow context with state history tracking
   * Extracted from: AvitoWorkflowStateMachineService
   */
  private async getOrInitializeWorkflowContext(
    userId: string,
    workspaceId: string,
    threadId: string,
  ): Promise<AvitoWorkflowContext> {
    const contextKey = `avito_workflow_context_${userId}_${workspaceId}_${threadId}`;

    try {
      const savedContext = await this.userVarsService.get({
        userId,
        workspaceId,
        key: contextKey,
      });

      if (savedContext) {
        const context = JSON.parse(
          savedContext as string,
        ) as AvitoWorkflowContext;

        // Restore Date objects
        context.stateChangedAt = new Date(context.stateChangedAt);
        context.workflowStartedAt = new Date(context.workflowStartedAt);
        if (context.timeoutAt) context.timeoutAt = new Date(context.timeoutAt);
        if (context.completedAt)
          context.completedAt = new Date(context.completedAt);

        // Restore date objects in state transition log
        context.stateTransitionLog = context.stateTransitionLog.map((log) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));

        return context;
      }
    } catch (error) {
      this.logger.warn('Failed to load workflow context:', error);
    }

    return AvitoWorkflowContextFactory.create(userId, workspaceId, threadId);
  }

  /**
   * ENHANCED: Save workflow context with enhanced error handling
   * Extracted from: AvitoWorkflowStateMachineService
   */
  private async saveWorkflowContext(
    context: AvitoWorkflowContext,
  ): Promise<void> {
    const contextKey = `avito_workflow_context_${context.userId}_${context.workspaceId}_${context.threadId}`;

    try {
      await this.userVarsService.set({
        userId: context.userId,
        workspaceId: context.workspaceId,
        key: contextKey,
        value: JSON.stringify(context),
      });

      this.logger.log(
        `Workflow context saved for user ${context.userId} in state ${context.state}`,
      );
    } catch (error) {
      this.logger.error('Failed to save workflow context:', error);
      throw new Error(`Context persistence failed: ${error.message}`);
    }
  }

  /**
   * ENHANCED: Validate state transition with guards
   * Extracted from: AvitoWorkflowStateMachineService
   */
  private validateStateTransition(
    currentContext: AvitoWorkflowContext,
    newState: AvitoWorkflowState,
  ): { valid: boolean; error?: string } {
    // Check if transition is valid according to state machine rules
    if (
      !AvitoWorkflowStateValidator.isValidTransition(
        currentContext.state,
        newState,
      )
    ) {
      return {
        valid: false,
        error: `Invalid state transition from ${currentContext.state} to ${newState}`,
      };
    }

    // Check workflow timeout
    if (this.isWorkflowTimedOut(currentContext)) {
      return {
        valid: false,
        error: 'Workflow has timed out, cannot proceed with state transition',
      };
    }

    // Check terminal state constraints
    if (
      AvitoWorkflowStateValidator.isTerminalState(currentContext.state) &&
      currentContext.state !== AvitoWorkflowState.ERROR_API_FAILURE
    ) {
      return {
        valid: false,
        error: `Cannot transition from terminal state ${currentContext.state}`,
      };
    }

    return { valid: true };
  }

  /**
   * ENHANCED: Transition to new state with logging and validation
   * Extracted from: AvitoWorkflowStateMachineService
   */
  private async transitionToState(
    context: AvitoWorkflowContext,
    newState: AvitoWorkflowState,
    trigger:
      | 'MANUAL'
      | 'API_RESPONSE'
      | 'USER_INPUT'
      | 'TIMEOUT'
      | 'ERROR' = 'API_RESPONSE',
  ): Promise<AvitoWorkflowContext> {
    // Validate transition
    const validation = this.validateStateTransition(context, newState);

    if (!validation.valid) {
      throw new Error(`State transition failed: ${validation.error}`);
    }

    const now = new Date();
    const duration = now.getTime() - context.stateChangedAt.getTime();

    // Create transition log entry
    const transition: StateTransitionLog = {
      fromState: context.state,
      toState: newState,
      timestamp: now,
      trigger,
      duration,
    };

    // Update context
    context.previousState = context.state;
    context.state = newState;
    context.stateChangedAt = now;
    context.stateTransitionLog.push(transition);

    // Log transition
    this.logger.log(
      `State transition: ${transition.fromState} → ${transition.toState} (${trigger})`,
    );

    // Emit state transition event
    this.eventEmitter.emit('workflow.state.transition', {
      userId: context.userId,
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      transition,
      timestamp: now,
    });

    return context;
  }

  /**
   * ENHANCED: Check if workflow has timed out
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private isWorkflowTimedOut(context: AvitoWorkflowContext): boolean {
    if (!context.timeoutAt) {
      // Set timeout if not already set
      context.timeoutAt = new Date(
        context.workflowStartedAt.getTime() + this.WORKFLOW_TIMEOUT_MS,
      );
    }

    return new Date() > context.timeoutAt;
  }

  /**
   * ENHANCED: Handle workflow timeout with recovery options
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private async *handleWorkflowTimeout(
    context: AvitoWorkflowContext,
  ): AsyncGenerator<SGRStreamingResult> {
    this.logger.warn(
      `Workflow timeout for user ${context.userId} after ${this.WORKFLOW_TIMEOUT_MS}ms`,
    );

    // Update context to timeout state
    await this.transitionToState(
      context,
      AvitoWorkflowState.ERROR_API_FAILURE,
      'TIMEOUT',
    );
    await this.saveWorkflowContext(context);

    // Emit timeout event
    this.eventEmitter.emit('workflow.timeout', {
      userId: context.userId,
      workspaceId: context.workspaceId,
      threadId: context.threadId,
      timeoutDuration: this.WORKFLOW_TIMEOUT_MS,
      timestamp: new Date(),
    });

    yield {
      type: 'final_response',
      content: '⏰ Время ожидания истекло. Пожалуйста, начните процесс заново.',
      completed: true,
    };
  }

  /**
   * ENHANCED: Extract credentials from message with multiple patterns
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private async extractCredentialsFromMessage(message: string): Promise<{
    success: boolean;
    credentials?: AvitoCredentials;
    error?: string;
  }> {
    this.logger.log('Attempting credential extraction with multiple patterns');

    for (const [
      index,
      pattern,
    ] of this.CREDENTIAL_EXTRACTION_PATTERNS.entries()) {
      try {
        const clientIdMatch = message.match(pattern.clientId);
        const clientSecretMatch = message.match(pattern.clientSecret);

        if (clientIdMatch && clientSecretMatch) {
          const clientId = clientIdMatch[1]?.trim();
          const clientSecret = clientSecretMatch[1]?.trim();

          if (
            clientId &&
            clientSecret &&
            this.validateCredentialFormat(clientId, clientSecret)
          ) {
            this.logger.log(
              `Credentials extracted successfully using pattern ${index + 1}`,
            );

            return {
              success: true,
              credentials: { clientId, clientSecret },
            };
          }
        }
      } catch (error) {
        this.logger.warn(`Pattern ${index + 1} failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'Could not extract valid CLIENT_ID and CLIENT_SECRET from message',
    };
  }

  /**
   * ENHANCED: Validate credential format with comprehensive rules
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private validateCredentialFormat(
    clientId: string,
    clientSecret: string,
  ): boolean {
    try {
      const clientIdRule = CREDENTIAL_VALIDATION_RULES.clientId;
      const clientSecretRule = CREDENTIAL_VALIDATION_RULES.clientSecret;

      const clientIdValid =
        clientId.length >= clientIdRule.minLength &&
        clientId.length <= clientIdRule.maxLength &&
        clientIdRule.pattern.test(clientId);

      const clientSecretValid =
        clientSecret.length >= clientSecretRule.minLength &&
        clientSecret.length <= clientSecretRule.maxLength &&
        clientSecretRule.pattern.test(clientSecret);

      const isValid = clientIdValid && clientSecretValid;

      this.logger.log(
        `Credential format validation: ${isValid ? 'PASS' : 'FAIL'}`,
        {
          clientIdValid,
          clientSecretValid,
          clientIdLength: clientId.length,
          clientSecretLength: clientSecret.length,
        },
      );

      return isValid;
    } catch (error) {
      this.logger.error('Credential format validation failed:', error);

      return false;
    }
  }

  /**
   * ENHANCED: Validate credentials with Avito API (robust implementation)
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private async validateCredentialsWithAPI(
    clientId: string,
    clientSecret: string,
  ): Promise<ValidationResult> {
    const validatedAt = new Date();

    try {
      this.logger.log('Starting API validation for credentials');

      const response = await fetch('https://api.avito.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'Twenty CRM Avito Integration v1.0',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();

        this.logger.warn(
          `API validation failed with status ${response.status}`,
        );

        return {
          success: false,
          error: `API Error ${response.status}: ${errorData}`,
          validatedAt,
        };
      }

      const data = await response.json();

      if (data.access_token) {
        this.logger.log('API validation successful');

        return {
          success: true,
          accessToken: data.access_token,
          expiresIn: data.expires_in || 86400,
          tokenType: data.token_type || 'Bearer',
          validatedAt,
        };
      }

      return {
        success: false,
        error: 'No access token in API response',
        validatedAt,
      };
    } catch (error) {
      this.logger.error('API validation error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        validatedAt,
      };
    }
  }

  /**
   * ENHANCED: Record user interaction for audit trail
   * Extracted from: AvitoWorkflowStateMachineService
   */
  private recordUserInteraction(
    context: AvitoWorkflowContext,
    type: 'MESSAGE_SENT' | 'CREDENTIALS_PROVIDED' | 'RETRY_REQUESTED',
    content: string,
    metadata?: Record<string, any>,
  ): AvitoWorkflowContext {
    const interaction = {
      type,
      timestamp: new Date(),
      content: content.substring(0, 1000), // Limit content length
      metadata,
    };

    context.userInteractions.push(interaction);

    // Keep only last 10 interactions to prevent context bloat
    if (context.userInteractions.length > 10) {
      context.userInteractions = context.userInteractions.slice(-10);
    }

    return context;
  }

  /**
   * ENHANCED: Enhanced streaming step with progress indicators
   * Extracted from: EnhancedAvitoWelcomeSGRService
   */
  private async *streamThinkingStep(step: {
    step: string;
    message: string;
    progress?: number;
  }): AsyncGenerator<SGRStreamingResult> {
    yield {
      type: 'thinking',
      content: step.message,
      completed: false,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build detailed context about tool execution results for AI reasoning
   */
  private buildToolExecutionContext(
    tool: WelcomeToolUnion,
    result: any,
    stepNumber: number,
  ): string {
    const timestamp = new Date().toISOString();
    
    switch (tool.tool) {
      case 'extract_credentials':
        return `Шаг ${stepNumber} (${timestamp}): ИЗВЛЕЧЕНИЕ УЧЕТНЫХ ДАННЫХ - ${result.success ? 'ВЫПОЛНЕНО' : 'ОШИБКА'}
${result.success ? '✅ CLIENT_ID и CLIENT_SECRET успешно извлечены из сообщения пользователя' : '❌ Не удалось извлечь учетные данные'}
Следующий шаг: ${result.success ? 'validate_avito_token' : 'request_credentials'}`;
        
      case 'validate_avito_token':
        return `Шаг ${stepNumber} (${timestamp}): ПРОВЕРКА УЧЕТНЫХ ДАННЫХ - ${result.success ? 'ВЫПОЛНЕНО' : 'ОШИБКА'}
${result.success ? '✅ Учетные данные проверены через Avito API, токен доступа получен' : '❌ Проверка не прошла, учетные данные неверны'}
Следующий шаг: ${result.success ? 'store_credentials' : 'request_credentials'}`;
        
      case 'store_credentials':
        return `Шаг ${stepNumber} (${timestamp}): СОХРАНЕНИЕ УЧЕТНЫХ ДАННЫХ - ${result.success ? 'ВЫПОЛНЕНО' : 'ОШИБКА'}
${result.success ? '✅ Учетные данные сохранены в системе' : '❌ Ошибка при сохранении'}
Следующий шаг: ${result.success ? 'report_welcome_completion' : 'validate_avito_token'}`;
        
      case 'request_credentials':
        return `Шаг ${stepNumber} (${timestamp}): ЗАПРОС УЧЕТНЫХ ДАННЫХ - ВЫПОЛНЕНО
✅ Пользователю отправлены инструкции по предоставлению учетных данных
Следующий шаг: Ожидание ответа пользователя`;
        
      default:
        return `Шаг ${stepNumber} (${timestamp}): ${tool.tool} - ${result.success ? 'ВЫПОЛНЕНО' : 'ОШИБКА'}`;
    }
  }
}
