import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { generateObject } from 'ai';

// Core imports
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

// Business setup imports
import {
  BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import {
  BUSINESS_SETUP_EVENTS,
  SupervisorProcessMessageEvent,
} from '../../events/business-setup.events';

// Supervisor-specific imports
import {
  SupervisorExecutionParams,
  SupervisorStepResult,
  SupervisorStepSchema,
  SupervisorStreamingContext,
  isCompletionTool,
} from '../schemas/supervisor-sgr.schema';
import {
  ISupervisorSGRService,
  SUPERVISOR_CONFIG,
  SupervisorErrorType,
  SupervisorException,
  SupervisorSGRStreamingResult,
  SupervisorThinkingStep,
} from '../types/supervisor-types';

// Tool dispatcher (will be implemented separately)
import { SupervisorToolDispatcherService } from './supervisor-tool-dispatcher.service';

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
      // Process the message with streaming SGR
      const sgrGenerator = this.processMessageWithStreaming(
        payload.message,
        payload.userId,
        payload.workspaceId,
        payload.threadId,
      );

      // Process the SGR stream and emit events
      for await (const result of sgrGenerator) {
        // The streaming results are handled by the chat service via events
        this.logger.debug(`SGR result: ${result.type}`);
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
   * Main entry point for processing supervisor messages with streaming SGR
   * Provides real-time visibility into supervisor thinking process
   */
  async *processMessageWithStreaming(
    userMessage: string,
    userId: string,
    workspaceId: string,
    threadId: string,
  ): AsyncGenerator<SupervisorSGRStreamingResult> {
    this.logger.log(
      `Processing supervisor message with STREAMING SGR for user ${userId}`,
    );

    const context: SupervisorStreamingContext = {
      userId,
      workspaceId,
      threadId,
      userMessage,
      maxSteps: DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps,
      stepNumber: 0,
    };

    const task = `
User sent message: "${userMessage}"

Task: Analyze this request in the context of business setup workflow and route appropriately.

Instructions:
1. Check current business setup status to understand context
2. Determine if this request is stage-specific or general
3. Route to appropriate specialized agent or handle directly
4. Provide transparent reasoning for routing decisions
5. Trigger status transitions when appropriate

Be helpful, efficient, and always explain your routing decisions clearly.
`;

    try {
      // Execute SGR workflow with streaming
      yield* this.executeSGRWorkflowWithStreaming(
        {
          task,
          userId,
          workspaceId,
          threadId,
          maxSteps: context.maxSteps || DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps,
        },
        context,
      );
    } catch (error) {
      this.logger.error(
        'Streaming supervisor SGR workflow execution failed:',
        error,
      );

      // Emit error event
      this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED, {
        userId,
        workspaceId,
        threadId,
        errorType:
          error instanceof SupervisorException
            ? error.type
            : SupervisorErrorType.SGR_WORKFLOW_FAILED,
        errorMessage: error.message,
        context:
          error instanceof SupervisorException
            ? error.context
            : { originalError: error },
        recoverable: true,
        timestamp: new Date(),
      });

      // Yield error result
      yield {
        type: 'final_response',
        content:
          '❌ I encountered an error while processing your request. Let me try a different approach or please rephrase your message.',
        completed: true,
      };
    }
  }

  /**
   * Execute complete supervisor SGR workflow with streaming for real-time visibility
   */
  private async *executeSGRWorkflowWithStreaming(
    params: SupervisorExecutionParams,
    context: SupervisorStreamingContext,
  ): AsyncGenerator<SupervisorSGRStreamingResult> {
    this.logger.log(
      `Starting STREAMING supervisor SGR workflow with max ${params.maxSteps || DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps} steps`,
    );

    const conversationLog = [
      {
        role: 'system' as const,
        content: SUPERVISOR_SYSTEM_PROMPTS.MAIN_SUPERVISOR,
      },
      {
        role: 'user' as const,
        content: params.task,
      },
    ];

    const stepsExecuted: string[] = [];
    const streamingSteps: SupervisorThinkingStep[] = [];
    const maxSteps = params.maxSteps || DEFAULT_SUPERVISOR_SGR_CONFIG.maxSteps;
    const startTime = Date.now();

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      try {
        this.logger.log(
          `Executing STREAMING supervisor SGR step ${stepNumber}/${maxSteps}`,
        );

        // STREAM: Start thinking step
        const thinkingStep: SupervisorThinkingStep = {
          stepNumber,
          currentState: `Analyzing step ${stepNumber} of ${maxSteps}...`,
          plannedSteps: [
            'Get structured reasoning decision from AI',
            'Execute selected tool',
            'Analyze result',
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

        // Emit thinking step event
        this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_THINKING_STEP, {
          userId: params.userId,
          workspaceId: params.workspaceId,
          threadId: params.threadId,
          step: thinkingStep,
          completed: false,
          timestamp: new Date(),
        });

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
          this.logger.log(
            'STREAMING supervisor SGR workflow completed successfully',
          );

          const executionTimeMs = Date.now() - startTime;

          // Emit completion event
          this.eventEmitter.emit(
            BUSINESS_SETUP_EVENTS.SUPERVISOR_ROUTING_COMPLETED,
            {
              userId: params.userId,
              workspaceId: params.workspaceId,
              threadId: params.threadId,
              success: stepResult.function.success,
              finalMessage: stepResult.function.final_message,
              routedTo: stepResult.function.routed_to,
              stepsExecuted,
              executionTimeMs,
              timestamp: new Date(),
            },
          );

          // STREAM: Final response
          yield {
            type: 'final_response',
            content: stepResult.function.final_message,
            completed: true,
            routedTo: stepResult.function.routed_to,
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
          params.threadId,
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

        // Add tool execution to conversation context
        conversationLog.push(
          {
            role: 'user' as const,
            content:
              stepResult.plan_remaining_steps[0] || 'Executing next step...',
          },
          {
            role: 'user' as const,
            content: `Tool execution status: ${toolResult.success ? 'successful' : 'failed'}. ${toolResult.message}`,
          },
        );

        // Log progress
        this.logger.log(
          `STREAMING supervisor step ${stepNumber} completed: ${stepResult.function.tool} -> ${toolResult.success ? 'success' : 'failed'}`,
        );
      } catch (error) {
        this.logger.error(
          `STREAMING supervisor SGR step ${stepNumber} failed:`,
          error,
        );

        // Emit error event
        this.eventEmitter.emit(
          BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED,
          {
            userId: params.userId,
            workspaceId: params.workspaceId,
            threadId: params.threadId,
            errorType: SupervisorErrorType.TOOL_EXECUTION_FAILED,
            errorMessage: error.message,
            context: { stepNumber, error },
            recoverable: true,
            timestamp: new Date(),
          },
        );

        yield {
          type: 'final_response',
          content:
            'I encountered an error while processing your request. Let me try a simpler approach or please try again.',
          completed: true,
        };

        return;
      }
    }

    // Workflow exceeded maximum steps
    this.logger.warn(
      `STREAMING supervisor SGR workflow exceeded maximum steps (${maxSteps})`,
    );

    const executionTimeMs = Date.now() - startTime;

    // Emit completion event with failure
    this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_ROUTING_COMPLETED, {
      userId: params.userId,
      workspaceId: params.workspaceId,
      threadId: params.threadId,
      success: false,
      finalMessage: 'Maximum reasoning steps exceeded',
      stepsExecuted,
      executionTimeMs,
      timestamp: new Date(),
    });

    yield {
      type: 'final_response',
      content:
        'I need more time to analyze your request properly. Could you please rephrase it or be more specific about what you need help with?',
      completed: true,
    };
  }

  /**
   * Execute single reasoning step with streaming support for supervisor decisions
   */
  private async executeReasoningStepWithStreaming(context: {
    conversationLog: any[];
    stepNumber: number;
    userId: string;
    workspaceId: string;
    threadId: string;
  }): Promise<SupervisorStepResult> {
    this.logger.log(
      `Executing STREAMING supervisor reasoning step ${context.stepNumber}`,
    );

    try {
      // Get AI model for structured generation
      const aiModel = this.aiModelRegistryService.getEffectiveModelConfig(
        this.GEMINI_MODEL_ID,
      );

      if (!aiModel) {
        throw new SupervisorException(
          SupervisorErrorType.SGR_WORKFLOW_FAILED,
          `AI model ${this.GEMINI_MODEL_ID} not found`,
          { modelId: this.GEMINI_MODEL_ID },
        );
      }

      const model = this.aiModelRegistryService.getModel(
        this.GEMINI_MODEL_ID,
      )?.model;

      if (!model) {
        throw new SupervisorException(
          SupervisorErrorType.SGR_WORKFLOW_FAILED,
          `Model instance not found for ${this.GEMINI_MODEL_ID}`,
          { modelId: this.GEMINI_MODEL_ID },
        );
      }

      // Create enhanced task instructions with actual user and workspace IDs
      const enhancedTaskInstructions = `${SUPERVISOR_SYSTEM_PROMPTS.TASK_INSTRUCTIONS}

IMPORTANT CONTEXT:
- Current userId: ${context.userId}
- Current workspaceId: ${context.workspaceId}
- Current threadId: ${context.threadId}

When using tools that require userId and workspaceId (like check_business_setup_status), use these EXACT values above. Do not use placeholders or generate your own IDs.

TOOL USAGE EXAMPLES:
- To check status: {"tool": "check_business_setup_status", "userId": "${context.userId}", "workspaceId": "${context.workspaceId}"}
- To route user: {"tool": "route_to_specialized_agent", "status": "BUSINESS_ANALYSIS", "reason": "...", "message": "..."}
- To complete: {"tool": "complete_routing", "success": true, "final_message": "..."}

WARNING: Do NOT use tool names like "route_request_to_agent" or any other variations. Use ONLY the exact tool names from the schema.`;

      // Generate structured output using the supervisor schema with timeout
      const result = await Promise.race([
        generateObject({
          model,
          messages: [
            ...context.conversationLog,
            {
              role: 'user' as const,
              content: enhancedTaskInstructions,
            },
          ],
          schema: SupervisorStepSchema,
          temperature: 0.1, // Low temperature for consistent reasoning
          maxTokens: 1500, // Higher limit for supervisor reasoning
        }),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new SupervisorException(
                  SupervisorErrorType.STREAMING_TIMEOUT,
                  `Supervisor reasoning step ${context.stepNumber} timed out`,
                  {
                    stepNumber: context.stepNumber,
                    timeoutMs: DEFAULT_SUPERVISOR_SGR_CONFIG.stepTimeoutMs,
                  },
                ),
              ),
            DEFAULT_SUPERVISOR_SGR_CONFIG.stepTimeoutMs,
          ),
        ),
      ]);

      const stepResult = (result as any).object;

      if (!stepResult || !stepResult.function) {
        throw new SupervisorException(
          SupervisorErrorType.SGR_WORKFLOW_FAILED,
          `Invalid step result from AI model`,
          { stepResult, stepNumber: context.stepNumber },
        );
      }

      this.logger.log(
        `STREAMING supervisor reasoning step ${context.stepNumber} result:`,
        {
          current_state: stepResult.current_state
            ? stepResult.current_state.substring(0, 100) + '...'
            : 'No state provided',
          planned_steps: stepResult.plan_remaining_steps?.length || 0,
          selected_tool: stepResult.function?.tool || 'No tool selected',
          task_completed: stepResult.task_completed,
        },
      );

      return stepResult;
    } catch (error) {
      this.logger.error(
        `STREAMING supervisor reasoning step ${context.stepNumber} failed:`,
        error,
      );

      if (error instanceof SupervisorException) {
        throw error;
      }

      throw new SupervisorException(
        SupervisorErrorType.TOOL_EXECUTION_FAILED,
        `Failed to execute streaming supervisor reasoning step: ${error.message}`,
        { stepNumber: context.stepNumber, originalError: error },
      );
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
}
