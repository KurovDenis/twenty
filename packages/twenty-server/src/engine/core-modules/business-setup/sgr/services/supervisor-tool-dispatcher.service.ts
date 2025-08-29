import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// Core imports
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';

// Business setup imports
import {
  BusinessSetupKeyValueTypeMap,
  BusinessSetupStepKeys,
} from '../../business-setup.service';
import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import { BusinessSetupAgentService } from '../../services/business-setup-agent.service';
import { BUSINESS_SETUP_EVENTS } from '../../events/business-setup.events';

// SGR imports

// Supervisor-specific imports
import {
  SupervisorStepResult,
  CheckBusinessSetupStatusTool,
  RouteToSpecializedAgentTool,
  ProcessDirectlyTool,
  StatusChangeTool,
  CompleteRoutingTool,
  BusinessSetupProgress,
} from '../schemas/supervisor-sgr.schema';
import {
  SupervisorToolExecutionResult,
  ISupervisorToolDispatcher,
  SupervisorException,
  SupervisorErrorType,
} from '../types/supervisor-types';

import { AvitoWelcomeSGRService } from './avito-welcome-sgr.service';

/**
 * SupervisorToolDispatcherService - Type-safe tool execution for supervisor decisions
 *
 * This service handles all tool executions requested by the supervisor SGR workflow,
 * providing type-safe dispatch and proper error handling.
 */
@Injectable()
export class SupervisorToolDispatcherService
  implements ISupervisorToolDispatcher
{
  private readonly logger = new Logger(SupervisorToolDispatcherService.name);

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly agentChatService: AgentChatService,
    @Inject(forwardRef(() => BusinessSetupAgentService))
    private readonly businessSetupAgentService: BusinessSetupAgentService,
    private readonly avitoWelcomeSGRService: AvitoWelcomeSGRService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Main dispatch method - routes tool execution based on tool type
   */
  async dispatch(
    tool: SupervisorStepResult['function'],
    userId: string,
    workspaceId: string,
  ): Promise<SupervisorToolExecutionResult> {
    this.logger.log(`Dispatching supervisor tool: ${tool.tool}`);

    try {
      switch (tool.tool) {
        case 'check_business_setup_status':
          return await this.executeCheckBusinessSetupStatus(
            tool,
            userId,
            workspaceId,
          );

        case 'route_to_specialized_agent':
          return await this.executeRouteToSpecializedAgent(
            tool,
            userId,
            workspaceId,
          );

        case 'process_directly':
          return await this.executeProcessDirectly(tool);

        case 'status_change':
          return await this.executeStatusChange(tool, userId, workspaceId);

        case 'complete_routing':
          return await this.executeCompleteRouting(tool);

        default:
          throw new SupervisorException(
            SupervisorErrorType.TOOL_EXECUTION_FAILED,
            `Unknown tool type: ${(tool as any).tool}`,
            { tool },
          );
      }
    } catch (error) {
      this.logger.error(`Tool dispatch failed for ${tool.tool}:`, error);

      if (error instanceof SupervisorException) {
        throw error;
      }

      throw new SupervisorException(
        SupervisorErrorType.TOOL_EXECUTION_FAILED,
        `Tool execution failed: ${error.message}`,
        { tool, originalError: error },
      );
    }
  }

  /**
   * Check current business setup status
   */
  async checkBusinessSetupStatus(
    userId: string,
    workspaceId: string,
  ): Promise<BusinessSetupProgress> {
    this.logger.log(`Checking business setup status for user ${userId}`);

    try {
      // Get current status from user vars
      const currentStatus = await this.userVarsService.get({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
      });

      // Determine current business setup status based on pending flags
      let status = BusinessSetupStatus.COMPLETED;
      const stepsCompleted: BusinessSetupStatus[] = [];

      // Check each step in order
      const stepChecks = [
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          status: BusinessSetupStatus.WELCOME,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
          status: BusinessSetupStatus.BUSINESS_ANALYSIS,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING,
          status: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING,
          status: BusinessSetupStatus.AGENT_SETUP,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING,
          status: BusinessSetupStatus.WORKFLOW_CREATION,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING,
          status: BusinessSetupStatus.TEAM_ASSIGNMENT,
        },
        {
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING,
          status: BusinessSetupStatus.TESTING_OPTIMIZATION,
        },
      ];

      for (const step of stepChecks) {
        const isPending = await this.userVarsService.get({
          userId,
          workspaceId,
          key: step.key,
        });

        if (isPending) {
          status = step.status;
          break;
        } else {
          stepsCompleted.push(step.status);
        }
      }

      // If no pending steps found, check if we have any setup at all
      if (
        status === BusinessSetupStatus.COMPLETED &&
        stepsCompleted.length === 0
      ) {
        // No setup started yet, default to WELCOME
        status = BusinessSetupStatus.WELCOME;
      }

      return {
        status,
        lastUpdated: new Date(),
        isComplete: status === BusinessSetupStatus.COMPLETED,
        stepsCompleted,
        currentStepProgress: this.calculateStepProgress(status, stepsCompleted),
      };
    } catch (error) {
      this.logger.error('Failed to check business setup status:', error);

      // Return default status on error
      return {
        status: BusinessSetupStatus.WELCOME,
        lastUpdated: new Date(),
        isComplete: false,
        stepsCompleted: [],
      };
    }
  }

  /**
   * Route message to specialized agent based on business setup status
   */
  async routeToSpecializedAgent(
    status: BusinessSetupStatus,
    message: string,
    userId: string,
    workspaceId: string,
    threadId: string,
    reason: string,
  ): Promise<SupervisorToolExecutionResult> {
    this.logger.log(`Routing to specialized agent for status: ${status}`);

    try {
      // Get the appropriate agent for this status
      const agent = await this.businessSetupAgentService.getAgentForStep(
        status,
        workspaceId,
      );

      // Special handling for WELCOME status - route to SGR Avito Agent
      if (status === BusinessSetupStatus.WELCOME) {
        this.logger.log('Routing WELCOME request to SGR Avito Agent');

        // Use the SGR Avito service for processing
        const sgrGenerator =
          this.avitoWelcomeSGRService.processWelcomeMessageWithStreaming(
            message,
            userId,
            workspaceId,
            threadId,
          );

        // Process the SGR stream (in a real implementation, this would be handled by the chat service)
        let lastResult = null;

        for await (const result of sgrGenerator) {
          lastResult = result;
          // The streaming results are handled by the chat service
        }

        // Emit agent handoff event
        this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF, {
          userId,
          workspaceId,
          threadId,
          fromAgent: 'business-setup-supervisor',
          toAgent: 'sgr-avito-agent',
          handoffReason: reason,
          contextPreserved: true,
          userMessage: message,
          timestamp: new Date(),
        });

        return {
          success: true,
          data: { agentId: agent.id, agentName: agent.name },
          message: `Successfully routed to SGR Avito Agent for credentials setup`,
          timestamp: new Date(),
        };
      }

      // For other statuses, add message to the agent's thread
      await this.agentChatService.addMessage({
        threadId,
        role: AgentChatMessageRole.USER,
        content: message,
        fileIds: [],
      });

      // Emit agent handoff event
      this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF, {
        userId,
        workspaceId,
        threadId,
        fromAgent: 'business-setup-supervisor',
        toAgent: agent.name,
        handoffReason: reason,
        contextPreserved: true,
        userMessage: message,
        timestamp: new Date(),
      });

      return {
        success: true,
        data: { agentId: agent.id, agentName: agent.name, status },
        message: `Successfully routed to ${agent.label} for ${status} assistance`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to route to specialized agent for status ${status}:`,
        error,
      );

      return {
        success: false,
        error: `Failed to route to specialized agent: ${error.message}`,
        message: `Unable to route to ${status} agent`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process request directly without routing to specialized agent
   */
  async processDirectly(
    response: string,
    reason: string,
  ): Promise<SupervisorToolExecutionResult> {
    this.logger.log(`Processing request directly: ${reason}`);

    // This is a simple acknowledgment tool
    return {
      success: true,
      data: { response, reason },
      message: `Processed directly: ${response}`,
      timestamp: new Date(),
    };
  }

  /**
   * Trigger status change for business setup progression
   */
  async statusChange(
    fromStatus: BusinessSetupStatus,
    toStatus: BusinessSetupStatus,
    userId: string,
    workspaceId: string,
    reason: string,
    triggerEvent?: string,
  ): Promise<SupervisorToolExecutionResult> {
    this.logger.log(`Status change: ${fromStatus} -> ${toStatus}`);

    try {
      // Validate the status transition
      if (!this.isValidStatusTransition(fromStatus, toStatus)) {
        throw new SupervisorException(
          SupervisorErrorType.STATUS_TRANSITION_FAILED,
          `Invalid status transition: ${fromStatus} -> ${toStatus}`,
          { fromStatus, toStatus, reason },
        );
      }

      // Update status in user vars
      await this.updateBusinessSetupStatus(
        fromStatus,
        toStatus,
        userId,
        workspaceId,
      );

      // Emit status transition event
      this.eventEmitter.emit(
        BUSINESS_SETUP_EVENTS.SUPERVISOR_STATUS_TRANSITION,
        {
          userId,
          workspaceId,
          threadId: '', // Will be filled by caller
          fromStatus,
          toStatus,
          reason,
          automatic: true,
          timestamp: new Date(),
        },
      );

      return {
        success: true,
        data: { fromStatus, toStatus, reason, triggerEvent },
        message: `Successfully transitioned from ${fromStatus} to ${toStatus}`,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Status change failed: ${fromStatus} -> ${toStatus}:`,
        error,
      );

      return {
        success: false,
        error: error.message,
        message: `Failed to transition from ${fromStatus} to ${toStatus}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Complete routing process
   */
  async completeRouting(
    success: boolean,
    finalMessage: string,
    routedTo?: string,
  ): Promise<SupervisorToolExecutionResult> {
    this.logger.log(
      `Completing routing: success=${success}, routedTo=${routedTo}`,
    );

    return {
      success,
      data: { routedTo, finalMessage },
      message: finalMessage,
      timestamp: new Date(),
    };
  }

  // Private helper methods

  private async executeCheckBusinessSetupStatus(
    tool: CheckBusinessSetupStatusTool,
    userId: string,
    workspaceId: string,
  ): Promise<SupervisorToolExecutionResult> {
    const progress = await this.checkBusinessSetupStatus(userId, workspaceId);

    return {
      success: true,
      data: progress,
      message: `Current business setup status: ${progress.status}`,
      timestamp: new Date(),
    };
  }

  private async executeRouteToSpecializedAgent(
    tool: RouteToSpecializedAgentTool,
    userId: string,
    workspaceId: string,
  ): Promise<SupervisorToolExecutionResult> {
    // Note: threadId is not available in tool params, would need to be passed from context
    // For now, we'll create a placeholder implementation
    return await this.routeToSpecializedAgent(
      tool.status,
      tool.message,
      userId,
      workspaceId,
      '', // threadId would need to be passed from context
      tool.reason,
    );
  }

  private async executeProcessDirectly(
    tool: ProcessDirectlyTool,
  ): Promise<SupervisorToolExecutionResult> {
    return await this.processDirectly(tool.response, tool.reason);
  }

  private async executeStatusChange(
    tool: StatusChangeTool,
    userId: string,
    workspaceId: string,
  ): Promise<SupervisorToolExecutionResult> {
    return await this.statusChange(
      tool.from_status,
      tool.to_status,
      userId,
      workspaceId,
      tool.reason,
      tool.trigger_event,
    );
  }

  private async executeCompleteRouting(
    tool: CompleteRoutingTool,
  ): Promise<SupervisorToolExecutionResult> {
    return await this.completeRouting(
      tool.success,
      tool.final_message,
      tool.routed_to,
    );
  }

  private calculateStepProgress(
    currentStatus: BusinessSetupStatus,
    completedSteps: BusinessSetupStatus[],
  ): number {
    const totalSteps = Object.keys(BusinessSetupStatus).length - 1; // Exclude COMPLETED
    const completedCount = completedSteps.length;

    return Math.floor((completedCount / totalSteps) * 100);
  }

  private isValidStatusTransition(
    fromStatus: BusinessSetupStatus,
    toStatus: BusinessSetupStatus,
  ): boolean {
    // Define valid transitions based on business setup flow
    const validTransitions: Record<BusinessSetupStatus, BusinessSetupStatus[]> =
      {
        [BusinessSetupStatus.WELCOME]: [BusinessSetupStatus.BUSINESS_ANALYSIS],
        [BusinessSetupStatus.BUSINESS_ANALYSIS]: [
          BusinessSetupStatus.SALES_FUNNEL_DESIGN,
        ],
        [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: [
          BusinessSetupStatus.AGENT_SETUP,
        ],
        [BusinessSetupStatus.AGENT_SETUP]: [
          BusinessSetupStatus.WORKFLOW_CREATION,
        ],
        [BusinessSetupStatus.WORKFLOW_CREATION]: [
          BusinessSetupStatus.TEAM_ASSIGNMENT,
        ],
        [BusinessSetupStatus.TEAM_ASSIGNMENT]: [
          BusinessSetupStatus.TESTING_OPTIMIZATION,
        ],
        [BusinessSetupStatus.TESTING_OPTIMIZATION]: [
          BusinessSetupStatus.COMPLETED,
        ],
        [BusinessSetupStatus.COMPLETED]: [], // No transitions from completed
      };

    return validTransitions[fromStatus]?.includes(toStatus) || false;
  }

  private async updateBusinessSetupStatus(
    fromStatus: BusinessSetupStatus,
    toStatus: BusinessSetupStatus,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    // Map status to corresponding step keys
    const statusToStepKey: Record<BusinessSetupStatus, string | null> = {
      [BusinessSetupStatus.WELCOME]:
        BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]:
        BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]:
        BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING,
      [BusinessSetupStatus.AGENT_SETUP]:
        BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING,
      [BusinessSetupStatus.WORKFLOW_CREATION]:
        BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]:
        BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]:
        BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING,
      [BusinessSetupStatus.COMPLETED]: null,
    };

    // Mark current step as completed
    const fromStepKey = statusToStepKey[fromStatus];

    if (fromStepKey) {
      await this.userVarsService.set({
        userId,
        workspaceId,
        key: fromStepKey as any,
        value: false,
      });
    }

    // Mark next step as pending (unless completed)
    const toStepKey = statusToStepKey[toStatus];

    if (toStepKey) {
      await this.userVarsService.set({
        userId,
        workspaceId,
        key: toStepKey as any,
        value: true,
      });
    }

    // Update current status tracking
    await this.userVarsService.set({
      userId,
      workspaceId,
      key: BusinessSetupStepKeys.BUSINESS_SETUP_CURRENT_STATUS,
      value: toStatus,
    });
  }
}
