import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';

import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../business-setup.service';
import { OnboardingStatusChangedEvent } from '../events/business-setup.events';
import { SGRStreamingResult } from '../sgr/types/sgr-thinking-stream.types';

@Injectable()
export class BusinessSetupWelcomeAgentService {
  private readonly logger = new Logger(BusinessSetupWelcomeAgentService.name);
  // Define the Gemini model ID to be used exclusively for welcome step
  private readonly GEMINI_MODEL_ID = 'google/gemini-2.5-flash';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  // Metrics for monitoring
  private metrics = {
    agentCreationAttempts: 0,
    agentCreationSuccesses: 0,
    agentCreationFailures: 0,
    foreignKeyViolations: 0,
    uuidFormatErrors: 0,
    workspaceValidationFailures: 0,
    transactionRollbacks: 0,
    averageCreationTime: 0,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly agentChatService: AgentChatService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
  ) {}

  // Handle onboarding status changes - NO LONGER AUTO-CREATE WELCOME CHAT
  @OnEvent('onboarding.status.changed')
  private async handleOnboardingStatusChange(
    payload: OnboardingStatusChangedEvent,
  ) {
    // Validate event payload
    if (!this.validateEventPayload(payload)) {
      this.logger.warn('Invalid onboarding status change payload:', payload);

      return;
    }

    if (
      payload.status === 'COMPLETED' &&
      payload.previousStatus !== 'COMPLETED'
    ) {
      try {
        this.logger.log(`Onboarding completed for user ${payload.userId}`);

        // Set business setup status to WELCOME by setting the pending flag
        await this.userVarsService.set({
          userId: payload.userId,
          workspaceId: payload.workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          value: true,
        });

        this.logger.log(
          'Business setup WELCOME status set - user will see floating button prompt',
        );

        // Emit event that onboarding is complete but no auto-chat creation
        this.eventEmitter.emit('business-setup.welcome.ready', {
          userId: payload.userId,
          workspaceId: payload.workspaceId,
          status: 'WELCOME',
          autoChat: false, // No automatic chat creation
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to handle onboarding completion:', error);
      }
    }
  }

  // Public method for testing and external access
  // NOTE: This method is deprecated and should not be used in production.
  // All message processing now goes through SupervisorSGRService routing.
  public async processUserMessage(
    threadId: string,
    message: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.logger.warn(
      'processUserMessage called but all processing now goes through SupervisorSGRService. ' +
        'This method is kept only for backward compatibility with existing tests.',
    );

    // For backward compatibility, we'll just log the call
    // In production, messages are automatically routed through the supervisor
    this.logger.log(
      `Message processing request for thread ${threadId} - now handled by supervisor`,
    );
  }

  // LEGACY EVENT HANDLER REMOVED - All message processing now goes through SupervisorSGRService
  // The supervisor automatically routes WELCOME status messages to AvitoWelcomeSGRService
  // This prevents duplicate processing and ensures consistent routing logic

  // LEGACY SGR STREAMING METHODS REMOVED
  // All SGR streaming is now handled directly by AvitoWelcomeSGRService via SupervisorSGRService

  /**
   * Handle individual SGR streaming steps and send appropriate messages to chat
   * This provides real-time visibility into AI thinking and tool execution
   *
   * NOTE: This method is kept for backward compatibility with existing tests
   * but is no longer used in production as all processing goes through supervisor
   */
  private async handleSGRStreamingStep(
    step: SGRStreamingResult,
    threadId: string,
  ): Promise<void> {
    try {
      switch (step.type) {
        case 'thinking':
          if (step.step) {
            await this.sendThinkingMessage(threadId, step.step);
          }
          break;

        case 'tool_execution':
          if (step.step) {
            await this.sendToolExecutionMessage(threadId, step.step);
          }
          break;

        case 'final_response':
          if (step.content) {
            await this.sendFinalResponse(threadId, step.content);
          }
          break;

        default:
          this.logger.warn(
            `Unknown SGR streaming step type: ${(step as any).type}`,
          );
      }
    } catch (error) {
      this.logger.error('Failed to handle SGR streaming step:', error);

      // Send error indication to user but don't break the stream
      await this.agentChatService.addMessage({
        threadId,
        role: AgentChatMessageRole.ASSISTANT,
        content: '⚠️ Обработка была прервана. Продолжаю анализ...',
        fileIds: [],
      });
    }
  }

  /**
   * Send thinking step message to show AI reasoning process
   */
  private async sendThinkingMessage(
    threadId: string,
    step: import('../sgr/types/sgr-thinking-stream.types').SGRThinkingStep,
  ): Promise<void> {
    const thinkingContent = `🤔 **Шаг ${step.stepNumber}: Анализ**

${step.currentState}

**План действий:**
${step.plannedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Выбранный инструмент:** ${step.selectedTool}`;

    await this.agentChatService.addMessage({
      threadId,
      role: AgentChatMessageRole.ASSISTANT,
      content: thinkingContent,
      fileIds: [],
    });
  }

  /**
   * Send tool execution message to show progress and results
   */
  private async sendToolExecutionMessage(
    threadId: string,
    step: import('../sgr/types/sgr-thinking-stream.types').SGRThinkingStep,
  ): Promise<void> {
    if (!step.toolExecution) {
      return;
    }

    let executionContent = '';

    switch (step.toolExecution.status) {
      case 'in_progress':
        executionContent = `🔧 **Выполняю: ${step.selectedTool}**\n\nОбрабатываю ваш запрос...`;
        break;

      case 'completed':
        executionContent = `✅ **Инструмент ${step.selectedTool} выполнен успешно**\n\nРезультат получен, перехожу к следующему шагу.`;
        break;

      case 'failed':
        executionContent = `❌ **Ошибка при выполнении ${step.selectedTool}**\n\n${step.toolExecution.error || 'Неизвестная ошибка'}\n\nПробую альтернативный подход...`;
        break;
    }

    if (executionContent) {
      await this.agentChatService.addMessage({
        threadId,
        role: AgentChatMessageRole.ASSISTANT,
        content: executionContent,
        fileIds: [],
      });
    }
  }

  /**
   * Send final response message with results
   */
  private async sendFinalResponse(
    threadId: string,
    content: string,
  ): Promise<void> {
    await this.agentChatService.addMessage({
      threadId,
      role: AgentChatMessageRole.ASSISTANT,
      content,
      fileIds: [],
    });
  }

  // Centralized validation for event payload
  private validateEventPayload(
    payload: any,
  ): payload is OnboardingStatusChangedEvent {
    return (
      payload &&
      typeof payload.userId === 'string' &&
      typeof payload.workspaceId === 'string' &&
      typeof payload.status === 'string' &&
      typeof payload.previousStatus === 'string' &&
      payload.timestamp instanceof Date
    );
  }

  // Create welcome chat with retry mechanism for reliability
  private async createWelcomeChatWithRetry(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    // First validate that the workspace exists
    const workspace = await this.workspaceService.findById(workspaceId);

    if (!workspace) {
      this.logger.error(
        `Workspace with ID ${workspaceId} not found. Cannot create welcome chat.`,
      );
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.createWelcomeChat(userId, workspaceId);
        this.logger.log(
          `Welcome chat created successfully on attempt ${attempt}`,
        );

        return; // Success
      } catch (error) {
        this.logger.warn(
          `Attempt ${attempt} failed for user ${userId}:`,
          error,
        );

        // Check if it's a foreign key constraint violation related to workspace
        if (
          error.message &&
          error.message.includes('FK_c4cb56621768a4a325dd772bbe1')
        ) {
          this.logger.error(
            `Foreign key constraint violation: workspace ${workspaceId} does not exist`,
          );
          throw new Error(
            `Invalid workspace ID: ${workspaceId}. The workspace does not exist.`,
          );
        }

        if (attempt === this.maxRetries) {
          // Final error
          this.logger.error(
            `All ${this.maxRetries} attempts failed for user ${userId}`,
          );
          throw error;
        }

        // Use exponential backoff before retry
        const delayMs = Math.pow(2, attempt) * this.retryDelayMs;

        await this.delay(delayMs);
      }
    }
  }

  // Utility method for delay with promise
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Create new welcome chat using SUPERVISOR AGENT for proper routing
  private async createWelcomeChat(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const startTime = Date.now();

    this.metrics.agentCreationAttempts++;

    try {
      // Emit event for chat creation start
      this.eventEmitter.emit('ai-agent.welcome.chat-creation-started', {
        userId,
        workspaceId,
        timestamp: new Date(),
      });

      // CRITICAL CHANGE: Use supervisor agent instead of regular welcome agent
      // This ensures all business setup messages go through proper routing
      this.logger.log(
        `Creating supervisor-based welcome chat for workspace ${workspaceId}`,
      );

      // Create thread with supervisor agent for proper routing
      const thread =
        await this.agentChatService.createThreadWithSupervisorAgent(
          workspaceId,
        );

      // Emit successful chat creation event
      this.eventEmitter.emit('ai-agent.welcome.chat-created', {
        userId,
        workspaceId,
        threadId: thread.id,
        aiResponse: 'Supervisor welcome chat created with proper routing',
        timestamp: new Date(),
      });

      this.logger.log(
        `Supervisor welcome chat created successfully for user ${userId}, thread ID: ${thread.id}`,
      );

      // Record success metrics
      const operationTime = Date.now() - startTime;

      this.metrics.agentCreationSuccesses++;
      this.updateAverageCreationTime(operationTime);
      this.logger.log(
        `Supervisor welcome chat created successfully in ${operationTime}ms`,
      );
    } catch (error) {
      this.metrics.agentCreationFailures++;

      const operationTime = Date.now() - startTime;

      this.logger.error(
        `Failed to create supervisor welcome chat in ${operationTime}ms:`,
        error,
      );

      // Emit error event
      this.eventEmitter.emit('ai-agent.welcome.chat-creation-failed', {
        userId,
        workspaceId,
        error: error.message,
        attempts: 1,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  // REMOVED: completeWelcomeChatSetup method - no longer needed
  // All setup is now handled by the SupervisorAgent through AgentChatService.createThreadWithSupervisorAgent
  // This ensures proper routing through the supervisor system

  // REMOVED: getAvitoWelcomePrompt method - no longer needed
  // Supervisor agents have their own welcome messages and routing logic
  // SGR agents provide their own specialized prompts for credential collection

  // REMOVED: validateAgentCreationData and handleDatabaseError methods
  // These are no longer needed since supervisor agents are managed by BusinessSetupAgentService
  // All validation and error handling is now done through the supervisor system

  // Update average creation time for performance monitoring
  private updateAverageCreationTime(newTime: number): void {
    const totalOperations = this.metrics.agentCreationSuccesses;

    this.metrics.averageCreationTime =
      (this.metrics.averageCreationTime * (totalOperations - 1) + newTime) /
      totalOperations;
  }

  // Get current metrics for monitoring and debugging
  public getMetrics(): any {
    const successRate =
      this.metrics.agentCreationAttempts > 0
        ? (this.metrics.agentCreationSuccesses /
            this.metrics.agentCreationAttempts) *
          100
        : 0;

    return {
      ...this.metrics,
      successRate: `${successRate.toFixed(2)}%`,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Log metrics periodically for monitoring
  public logMetrics(): void {
    const metrics = this.getMetrics();

    this.logger.log(
      'Agent Creation Metrics:',
      JSON.stringify(metrics, null, 2),
    );
  }
}
