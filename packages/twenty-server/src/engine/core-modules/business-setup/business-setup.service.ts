import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { BusinessSetupStatus } from './enums/business-setup-status.enum';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { BUSINESS_SETUP_EVENTS, BusinessSetupRouteMessageEvent, SupervisorThinkingStepEvent, SupervisorRoutingCompletedEvent } from './events/business-setup.events';

export enum BusinessSetupStepKeys {
  BUSINESS_SETUP_WELCOME_PENDING = 'BUSINESS_SETUP_WELCOME_PENDING',
  BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING = 'BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING',
  BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING = 'BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING',
  BUSINESS_SETUP_AGENT_SETUP_PENDING = 'BUSINESS_SETUP_AGENT_SETUP_PENDING',
  BUSINESS_SETUP_WORKFLOW_CREATION_PENDING = 'BUSINESS_SETUP_WORKFLOW_CREATION_PENDING',
  BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING = 'BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING',
  BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING = 'BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING',
  
  // Supervisor specific settings
  SUPERVISOR_ENABLED = 'SUPERVISOR_ENABLED',
  BUSINESS_SETUP_CURRENT_STATUS = 'BUSINESS_SETUP_CURRENT_STATUS',
  
  // Avito API credentials
  AVITO_CLIENT_ID = 'AVITO_CLIENT_ID',
  AVITO_CLIENT_SECRET = 'AVITO_CLIENT_SECRET',
  AVITO_ACCESS_TOKEN = 'AVITO_ACCESS_TOKEN',
  AVITO_TOKEN_EXPIRES_AT = 'AVITO_TOKEN_EXPIRES_AT',
}

export type BusinessSetupKeyValueTypeMap = {
  [BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING]: boolean;
  
  // Supervisor specific settings
  [BusinessSetupStepKeys.SUPERVISOR_ENABLED]: boolean;
  [BusinessSetupStepKeys.BUSINESS_SETUP_CURRENT_STATUS]: BusinessSetupStatus;
  
  // Avito API credentials
  [BusinessSetupStepKeys.AVITO_CLIENT_ID]: string;
  [BusinessSetupStepKeys.AVITO_CLIENT_SECRET]: string;
  [BusinessSetupStepKeys.AVITO_ACCESS_TOKEN]: string;
  [BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT]: string;
};

@Injectable()
export class BusinessSetupService {
  private readonly logger = new Logger(BusinessSetupService.name);

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly onboardingService: OnboardingService,
    private readonly eventEmitter: EventEmitter2, // Use EventEmitter2 for decoupled communication
  ) {}

  async getBusinessSetupStatus(user: User, workspace: Workspace): Promise<BusinessSetupStatus> {
    // Проверяем завершен ли onboarding
    const onboardingStatus = await this.onboardingService.getOnboardingStatus(user, workspace);
    
    if (onboardingStatus !== OnboardingStatus.COMPLETED) {
      return BusinessSetupStatus.WELCOME;
    }

    // Получаем статус из UserVars
    const userVars = await this.userVarsService.getAll({
      userId: user.id,
      workspaceId: workspace.id,
    });

    const isWelcomePending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING) === true;
    const isBusinessAnalysisPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING) === true;
    const isSalesFunnelDesignPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING) === true;
    const isAgentSetupPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING) === true;
    const isWorkflowCreationPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING) === true;
    const isTeamAssignmentPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING) === true;
    const isTestingOptimizationPending = userVars.get(BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING) === true;

    if (isWelcomePending) {
      return BusinessSetupStatus.WELCOME;
    }

    if (isBusinessAnalysisPending) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (isSalesFunnelDesignPending) {
      return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    }

    if (isAgentSetupPending) {
      return BusinessSetupStatus.AGENT_SETUP;
    }

    if (isWorkflowCreationPending) {
      return BusinessSetupStatus.WORKFLOW_CREATION;
    }

    if (isTeamAssignmentPending) {
      return BusinessSetupStatus.TEAM_ASSIGNMENT;
    }

    if (isTestingOptimizationPending) {
      return BusinessSetupStatus.TESTING_OPTIMIZATION;
    }

    return BusinessSetupStatus.COMPLETED;
  }

  async setBusinessSetupStatus(
    userId: string,
    workspaceId: string,
    status: BusinessSetupStatus,
  ): Promise<void> {
    // Очищаем все текущие статусы
    await this.clearAllBusinessSetupStatuses(userId, workspaceId);

    // Устанавливаем новый статус
    switch (status) {
      case BusinessSetupStatus.WELCOME:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.BUSINESS_ANALYSIS:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.AGENT_SETUP:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_AGENT_SETUP_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.WORKFLOW_CREATION:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_WORKFLOW_CREATION_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.TEAM_ASSIGNMENT:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.TESTING_OPTIMIZATION:
        await this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING,
          value: true,
        });
        break;
      case BusinessSetupStatus.COMPLETED:
        // Не устанавливаем никаких статусов - все завершено
        break;
    }
  }

  private async clearAllBusinessSetupStatuses(userId: string, workspaceId: string): Promise<void> {
    const keys = Object.values(BusinessSetupStepKeys);
    
    for (const key of keys) {
      await this.userVarsService.set({
        userId,
        workspaceId,
        key,
        value: false,
      });
    }
  }

  /**
   * Handle supervisor route message events
   * This is the main entry point for supervisor routing using event-driven architecture
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.BUSINESS_SETUP_ROUTE_MESSAGE)
  async handleRouteMessage(payload: BusinessSetupRouteMessageEvent): Promise<void> {
    this.logger.log(`Handling supervisor route message for user ${payload.userId}`);

    try {
      // Use event-driven approach to decouple dependencies
      // Emit event for SupervisorSGRService to handle
      this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE, {
        message: payload.message,
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        threadId: payload.threadId,
        timestamp: new Date()
      });
      
      this.logger.debug(`Emitted supervisor process message event for user ${payload.userId}`);
    } catch (error) {
      this.logger.error('Failed to handle supervisor route message:', error);
    }
  }

  /**
   * Handle supervisor thinking step events for monitoring and debugging
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_THINKING_STEP)
  async handleSupervisorThinkingStep(payload: SupervisorThinkingStepEvent): Promise<void> {
    this.logger.debug(`Supervisor thinking step ${payload.stepNumber}: ${payload.selectedTool}`);
    
    // Here you could add logic to:
    // - Store thinking steps for debugging
    // - Monitor supervisor performance
    // - Log decision patterns
    
    // For now, just log the thinking step
    this.logger.debug(`Step ${payload.stepNumber} state: ${payload.currentState.substring(0, 100)}...`);
  }

  /**
   * Handle supervisor routing completion events
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_ROUTING_COMPLETED)
  async handleSupervisorRoutingCompleted(payload: SupervisorRoutingCompletedEvent): Promise<void> {
    this.logger.log(`Supervisor routing completed for user ${payload.userId}:`, {
      success: payload.success,
      routedTo: payload.routedTo,
      executionTime: payload.executionTimeMs,
      stepsExecuted: payload.stepsExecuted.length
    });

    // Here you could add logic to:
    // - Update user statistics
    // - Track routing success rates
    // - Monitor performance metrics
    // - Trigger follow-up actions
  }

  /**
   * Handle supervisor status transition events
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_STATUS_TRANSITION)
  async handleSupervisorStatusTransition(payload: any): Promise<void> {
    this.logger.log(`Supervisor triggered status transition: ${payload.fromStatus} -> ${payload.toStatus}`);

    try {
      // Extract user info from the thread or payload
      const { userId, workspaceId, fromStatus, toStatus, reason } = payload;
      
      // Update the business setup status
      await this.setBusinessSetupStatus(userId, workspaceId, toStatus);
      
      this.logger.log(`Successfully updated business setup status to ${toStatus} for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to handle supervisor status transition:', error);
    }
  }

  /**
   * Handle supervisor error events for monitoring and alerting
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_ERROR_OCCURRED)
  async handleSupervisorError(payload: any): Promise<void> {
    this.logger.error(`Supervisor error occurred for user ${payload.userId}:`, {
      errorType: payload.errorType,
      errorMessage: payload.errorMessage,
      recoverable: payload.recoverable,
      context: payload.context
    });

    // Here you could add logic to:
    // - Send alerts to administrators
    // - Trigger fallback mechanisms
    // - Update error statistics
    // - Implement recovery strategies
  }

  /**
   * Handle supervisor agent handoff events
   */
  @OnEvent(BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF)
  async handleSupervisorAgentHandoff(payload: any): Promise<void> {
    this.logger.log(`Supervisor agent handoff: ${payload.fromAgent} -> ${payload.toAgent}`, {
      reason: payload.handoffReason,
      contextPreserved: payload.contextPreserved,
      userMessage: payload.userMessage.substring(0, 100) + '...'
    });

    // Here you could add logic to:
    // - Track agent performance metrics
    // - Monitor handoff success rates
    // - Update agent utilization statistics
    // - Log conversation flows
  }
}
