import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { BusinessSetupStepKeys } from 'src/engine/core-modules/business-setup/business-setup.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { BUSINESS_SETUP_EVENTS, type SupervisorProcessMessageEvent } from '../../events/business-setup.events';
import { SGRStreamEvent, SGRStreamEventType } from '../types/sgr-stream.types';
import { SUPERVISOR_CONFIG } from '../types/supervisor-types';
import { SupervisorToolDispatcherService } from './supervisor-tool-dispatcher.service';

// Core imports
import {
  BusinessSetupKeyValueTypeMap
} from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';

// Supervisor-specific imports
import { streamText } from 'ai';
import {
  SupervisorStepResult,
  isCompletionTool
} from '../schemas/supervisor-sgr.schema';
import {
  DetailedStreamingResult,
  ExtendedSupervisorStreamingContext
} from '../types/sgr-stream.types';
import {
  ISupervisorSGRService,
  SupervisorErrorType,
  SupervisorException
} from '../types/supervisor-types';

/**
 * Default configuration for supervisor SGR thinking process
 */
const DEFAULT_SUPERVISOR_SGR_CONFIG = {
  maxSteps: SUPERVISOR_CONFIG.MAX_STEPS,
  timeoutMs: SUPERVISOR_CONFIG.TIMEOUT_MS,
  stepTimeoutMs: SUPERVISOR_CONFIG.STEP_TIMEOUT_MS,
  retryAttempts: SUPERVISOR_CONFIG.RETRY_ATTEMPTS,
};

/**
 * Supervisor system prompts for different reasoning contexts
 */
const SUPERVISOR_SYSTEM_PROMPTS = {
  MAIN_SUPERVISOR: `You are a Supervisor Agent for the Business Setup workflow in Twenty CRM.

Your responsibilities:
1. Analyze user requests in the context of business setup progress
2. Route requests to appropriate specialized agents based on current status
3. Manage progression through business setup stages
4. Provide transparent reasoning for all routing decisions
5. Handle automatic status checks with intelligent routing and personalized responses

Available Business Setup Stages:
- WELCOME: Initial setup and Avito API credential collection
- BUSINESS_ANALYSIS: Business requirements analysis
- SALES_FUNNEL_DESIGN: Sales funnel creation and optimization
- AGENT_SETUP: AI agent team configuration
- WORKFLOW_CREATION: Automated workflow creation
- TEAM_ASSIGNMENT: Team role and responsibility assignment
- TESTING_OPTIMIZATION: System testing and optimization
- COMPLETED: Business setup complete

AVAILABLE TOOLS (use EXACT names only):
1. "check_business_setup_status" - Check user's current business setup status
   Required: userId, workspaceId
2. "route_to_specialized_agent" - Route user to appropriate specialized agent
   Required: status, reason, message
3. "process_directly" - Handle simple queries directly without routing
   Required: response, reason
4. "status_change" - Trigger progression to next business setup stage
   Required: from_status, to_status, reason
5. "complete_routing" - Signal completion of routing decision
   Required: success, final_message

CRITICAL ROUTING RULES:
- WELCOME status: ALWAYS route to SGR Avito Agent (sgr-avito-agent)
- Never process WELCOME requests yourself - always delegate to SGR agent
- For status check requests: ALWAYS check status first, then route appropriately with personalized guidance
- Monitor for stage completion signals and trigger status transitions
- Provide clear reasoning for every routing decision
- When routing, include context about current status and next steps

AUTOMATIC STATUS CHECK HANDLING:
When user asks about status or needs routing guidance:
1. Use check_business_setup_status tool to get current status
2. Analyze the status and determine appropriate next action
3. Route to specialized agent with personalized message based on current status
4. Provide clear explanation of why you're routing to specific agent

IMPORTANT: Use ONLY the exact tool names listed above. Do not invent or modify tool names.
Always maintain a helpful and informative tone while making routing decisions.`,

  TASK_INSTRUCTIONS: `Analyze the current request and business setup context.

Your task:
1. Check current business setup status if needed
2. Determine the most appropriate action:
   - Route to specialized agent if request is stage-specific
   - Process directly if request is general/informational
   - Trigger status change if progression is needed
3. Provide clear reasoning for your decision
4. Complete routing when action is determined

AVAILABLE TOOLS (use EXACT names):
- "check_business_setup_status" - Check user's current business setup status
- "route_to_specialized_agent" - Route user to appropriate specialized agent
- "process_directly" - Handle simple queries directly without routing
- "status_change" - Trigger progression to next business setup stage
- "complete_routing" - Signal completion of routing decision

IMPORTANT: Use ONLY these exact tool names. Do not invent or modify tool names.

Be methodical and transparent in your reasoning process.`,
};

/**
 * SupervisorSGRService - Orchestrates supervisor reasoning workflow with streaming
 *
 * This service implements the Schema-Guided Reasoning pattern for supervisor agent
 * routing decisions, providing real-time visibility into the AI thinking process.
 */
@Injectable()
export class SupervisorSGRService implements ISupervisorSGRService {
  private readonly logger = new Logger(SupervisorSGRService.name);
  private readonly GEMINI_MODEL_ID = SUPERVISOR_CONFIG.MODEL_ID;

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly agentChatService: AgentChatService,
    private readonly aiModelRegistryService: AiModelRegistryService,
    @Inject(forwardRef(() => SupervisorToolDispatcherService))
    private readonly toolDispatcher: SupervisorToolDispatcherService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Event handler for supervisor message processing
   * This method is triggered by events from BusinessSetupService for decoupled communication
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE)
  async handleProcessMessageEvent(
    payload: SupervisorProcessMessageEvent,
  ): Promise<void> {
    this.logger.log(
      `Handling supervisor process message event for user ${payload.userId}`,
    );

    try {
      // Используем НОВЫЙ детализированный стриминг
      const sgrGenerator = this.processMessageWithDetailedStreaming(
        payload.message,
        payload.userId,
        payload.workspaceId,
        payload.threadId,
      );

      // Обрабатываем поток SGR событий и отправляем их через EventEmitter
      for await (const event of sgrGenerator) {
        this.eventEmitter.emit('sgr.streaming.event', event);
        this.logger.debug(`Emitted SGR event: ${event.type}`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to handle supervisor process message event:',
        error,
      );

      // Emit error event
      this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED, {
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        errorType: 'EVENT_PROCESSING_FAILED',
        errorMessage: error.message,
        context: { originalPayload: payload },
        recoverable: true,
        timestamp: new Date(),
      });
    }
  }

  /**
   * НОВЫЙ: Детальный стриминг с токенами JSON
   * Заменяет существующий processMessageWithStreaming для SGR событий
   */
  async *processMessageWithDetailedStreaming(
    userMessage: string,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): AsyncGenerator<SGRStreamEvent> {
    const stepId = this.generateUniqueStepId();
    
    // Событие начала процесса
    yield {
      type: SGRStreamEventType.PROCESS_START,
      payload: {
        threadId,
        stepId,
        timestamp: new Date(),
      },
    };

    try {
      // Инициализация контекста
      const context = this.createStreamingContext(userId, workspaceId, threadId, userMessage);
      
      // Выполнение детального стриминга
      yield* this.executeDetailedSGRWorkflow(context, stepId);
      
      // Событие завершения
      yield {
        type: SGRStreamEventType.PROCESS_END,
        payload: {
          threadId,
          stepId,
          timestamp: new Date(),
        },
      };
      
    } catch (error) {
      this.logger.error('Detailed SGR streaming failed:', error);
      
      yield {
        type: SGRStreamEventType.PROCESS_ERROR,
        payload: {
          threadId,
          stepId,
          error: error.message,
          timestamp: new Date(),
        },
      };
    }
  }

  /**
   * Основной метод детального стриминга SGR
   */
  private async *executeDetailedSGRWorkflow(
    context: ExtendedSupervisorStreamingContext,
    stepId: string,
  ): AsyncGenerator<SGRStreamEvent> {
    
    const maxSteps = context.maxSteps || DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps;
    
    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      
      // Событие начала JSON стриминга
      yield {
        type: SGRStreamEventType.JSON_STREAM_START,
        payload: {
          threadId: context.threadId,
          stepId,
          timestamp: new Date(),
          metadata: {
            stepNumber,
            totalSteps: maxSteps,
          },
        },
      };
      
      // Детальный стриминг JSON от LLM
      const stepResult = yield* this.streamJSONFromLLM(context, stepNumber, stepId);
      
      // Событие завершения JSON стриминга
      yield {
        type: SGRStreamEventType.JSON_STREAM_END,
        payload: {
          threadId: context.threadId,
          stepId,
          fullJson: stepResult.fullJson,
          timestamp: new Date(),
          metadata: {
            stepNumber,
            totalSteps: maxSteps,
            tokensEmitted: stepResult.tokenCount,
          },
        },
      };
      
      // Парсинг и валидация JSON
      const parsedResult = this.parseAndValidateJSON(stepResult.fullJson);
      
      // Событие вызова инструмента
      yield {
        type: SGRStreamEventType.TOOL_CALL_PENDING,
        payload: {
          threadId: context.threadId,
          stepId,
          toolName: parsedResult.function.tool,
          toolArgs: JSON.stringify(parsedResult.function),
          timestamp: new Date(),
          metadata: {
            stepNumber,
            totalSteps: maxSteps,
          },
        },
      };
      
      // Выполнение инструмента
      const toolResult = await this.executeTool(parsedResult.function, context);
      
      // Проверка завершения
      if (isCompletionTool(parsedResult.function)) {
        return; // Завершаем процесс
      }
      
      // Обновление контекста для следующего шага
      this.updateConversationContext(context, parsedResult, toolResult);
    }
  }

  /**
   * Детальный стриминг JSON от LLM с токенами
   */
  private async *streamJSONFromLLM(
    context: ExtendedSupervisorStreamingContext,
    stepNumber: number,
    stepId: string,
  ): AsyncGenerator<SGRStreamEvent, DetailedStreamingResult> {
    
    const aiModel = this.aiModelRegistryService.getModel(this.GEMINI_MODEL_ID)?.model;
    if (!aiModel) {
      throw new SupervisorException(
        SupervisorErrorType.SGR_WORKFLOW_FAILED,
        `AI model ${this.GEMINI_MODEL_ID} not found`
      );
    }

    // Создание промпта для структурированного вывода
    const systemPrompt = this.createStructuredOutputPrompt(context, stepNumber);
    
    // Использование streamText вместо generateObject
    const stream = streamText({
      model: aiModel,
      messages: [
        ...context.conversationLog,
        { role: 'user' as const, content: systemPrompt }
      ],
      temperature: 0.1,
      maxTokens: 1500,
    });

    let fullJson = '';
    const tokens: string[] = [];
    const startTime = Date.now();
    
    // Обработка потока токенов
    for await (const chunk of stream.textStream) {
      const token = chunk;
      fullJson += token;
      tokens.push(token);
      
      // Yield каждого токена для детального стриминга
      yield {
        type: SGRStreamEventType.JSON_TOKEN_CHUNK,
        payload: {
          threadId: context.threadId,
          stepId,
          token,
          timestamp: new Date(),
          metadata: {
            stepNumber,
            tokensEmitted: tokens.length,
          },
        },
      };
    }
    
    const streamingDuration = Date.now() - startTime;
    
    return {
      fullJson,
      tokens,
      isValidJson: this.isValidJson(fullJson),
      parsedData: this.safeParseJson(fullJson),
      streamingDuration,
      tokenCount: tokens.length,
    };
  }

  /**
   * Парсинг и валидация JSON с обработкой ошибок
   */
  private parseAndValidateJSON(jsonString: string): SupervisorStepResult {
    try {
      // Попытка парсинга полного JSON
      const parsed = JSON.parse(jsonString);
      
      // Валидация структуры
      if (!parsed.function || !parsed.function.tool) {
        throw new Error('Invalid JSON structure: missing function.tool');
      }
      
      return parsed as SupervisorStepResult;
      
    } catch (parseError) {
      // Попытка парсинга частичного JSON
      const partialResult = this.parsePartialJSON(jsonString);
      
      if (!partialResult) {
        throw new SupervisorException(
          SupervisorErrorType.SGR_WORKFLOW_FAILED,
          `Failed to parse JSON: ${parseError.message}`
        );
      }
      
      return partialResult;
    }
  }

  /**
   * Парсинг частичного JSON (для незавершенных ответов)
   */
  private parsePartialJSON(jsonString: string): SupervisorStepResult | null {
    try {
      // Поиск последнего валидного JSON объекта
      const jsonMatch = jsonString.match(/\{[^{}]*\}/g);
      
      if (!jsonMatch) {
        return null;
      }
      
      // Берем последний найденный объект
      const lastJson = jsonMatch[jsonMatch.length - 1];
      const parsed = JSON.parse(lastJson);
      
      // Проверяем минимальную валидность
      if (parsed.function?.tool) {
        return parsed as SupervisorStepResult;
      }
      
      return null;
      
    } catch {
      return null;
    }
  }

  /**
   * Выполнение инструмента с обработкой ошибок
   */
  private async executeTool(
    functionCall: any,
    context: ExtendedSupervisorStreamingContext,
  ): Promise<any> {
    try {
      return await this.toolDispatcher.dispatch(
        functionCall,
        context.userId,
        context.workspaceId,
        context.threadId,
      );
    } catch (error) {
      this.logger.error('Tool execution failed:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Tool execution failed'
      };
    }
  }

  /**
   * Обновление контекста разговора
   */
  private updateConversationContext(
    context: ExtendedSupervisorStreamingContext,
    stepResult: SupervisorStepResult,
    toolResult: any,
  ): void {
    context.conversationLog.push(
      {
        role: 'user' as const,
        content: stepResult.current_state || 'Processing step...',
      },
      {
        role: 'assistant' as const,
        content: JSON.stringify(stepResult.function),
      },
      {
        role: 'user' as const,
        content: `Tool result: ${toolResult.success ? 'success' : 'failed'} - ${toolResult.message}`,
      },
    );
  }

  /**
   * Генерация уникального ID для шага
   */
  private generateUniqueStepId(): string {
    return `sgr-step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Создание контекста стриминга
   */
  private createStreamingContext(
    userId: string,
    workspaceId: string,
    threadId: string,
    userMessage: string,
  ): ExtendedSupervisorStreamingContext {
    return {
      userId,
      workspaceId,
      threadId,
      userMessage,
      maxSteps: DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps,
      stepNumber: 0,
      conversationLog: [
        {
          role: 'system' as const,
          content: SUPERVISOR_SYSTEM_PROMPTS.MAIN_SUPERVISOR,
        },
        {
          role: 'user' as const,
          content: userMessage,
        },
      ],
    };
  }

  /**
   * Создание промпта для структурированного вывода
   */
  private createStructuredOutputPrompt(
    context: ExtendedSupervisorStreamingContext,
    stepNumber: number,
  ): string {
    return `${SUPERVISOR_SYSTEM_PROMPTS.TASK_INSTRUCTIONS}

STEP ${stepNumber} INSTRUCTIONS:
- Analyze the current conversation context
- Generate a structured JSON response with the following format:
{
  "current_state": "Description of current analysis",
  "plan_remaining_steps": ["Step 1", "Step 2", "Step 3"],
  "task_completed": false,
  "function": {
    "tool": "exact_tool_name",
    "parameters": {...}
  }
}

IMPORTANT: Generate valid JSON only. Do not include any explanatory text outside the JSON structure.`;
  }

  /**
   * Проверка валидности JSON
   */
  private isValidJson(jsonString: string): boolean {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Безопасный парсинг JSON
   */
  private safeParseJson(jsonString: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(jsonString);
    } catch {
      return undefined;
    }
  }

  /**
   * Type-safe helper for boolean values from UserVarsService
   */
  private async getBooleanValue(
    userId: string,
    workspaceId: string,
    key: keyof BusinessSetupKeyValueTypeMap,
  ): Promise<boolean> {
    const value = await this.userVarsService.get({
      userId,
      workspaceId,
      key: key as string,
    });

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return false; // Default fallback
  }

  /**
   * Get supervisor processing status for debugging
   */
  async getSupervisorStatus(
    userId: string,
    workspaceId: string,
  ): Promise<{
    supervisorEnabled: boolean;
    currentBusinessSetupStatus?: BusinessSetupStatus;
    lastProcessedAt?: Date;
    activeThreads?: number;
  }> {
    try {
      const supervisorEnabled = await this.getBooleanValue(
        userId,
        workspaceId,
        BusinessSetupStepKeys.SUPERVISOR_ENABLED,
      );

      const currentStatus = (await this.userVarsService.get({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_CURRENT_STATUS,
      })) as BusinessSetupStatus;

      return {
        supervisorEnabled,
        currentBusinessSetupStatus: currentStatus,
        lastProcessedAt: new Date(),
        activeThreads: 1, // Simplified for now
      };
    } catch (error) {
      this.logger.error('Failed to get supervisor status:', error);

      return {
        supervisorEnabled: true,
        currentBusinessSetupStatus: BusinessSetupStatus.WELCOME,
      };
    }
  }

  // Legacy streaming methods removed. Use processMessageWithDetailedStreaming and GraphQL subscriptions instead.

  // Детальный стриминг управляется через событийную шину и не влияет на legacy API
}
