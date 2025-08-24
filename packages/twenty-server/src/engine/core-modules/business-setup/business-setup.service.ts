import { Injectable } from '@nestjs/common';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { BusinessSetupStatus } from './enums/business-setup-status.enum';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

export enum BusinessSetupStepKeys {
  BUSINESS_SETUP_WELCOME_PENDING = 'BUSINESS_SETUP_WELCOME_PENDING',
  BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING = 'BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING',
  BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING = 'BUSINESS_SETUP_SALES_FUNNEL_DESIGN_PENDING',
  BUSINESS_SETUP_AGENT_SETUP_PENDING = 'BUSINESS_SETUP_AGENT_SETUP_PENDING',
  BUSINESS_SETUP_WORKFLOW_CREATION_PENDING = 'BUSINESS_SETUP_WORKFLOW_CREATION_PENDING',
  BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING = 'BUSINESS_SETUP_TEAM_ASSIGNMENT_PENDING',
  BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING = 'BUSINESS_SETUP_TESTING_OPTIMIZATION_PENDING',
  
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
  
  // Avito API credentials
  [BusinessSetupStepKeys.AVITO_CLIENT_ID]: string;
  [BusinessSetupStepKeys.AVITO_CLIENT_SECRET]: string;
  [BusinessSetupStepKeys.AVITO_ACCESS_TOKEN]: string;
  [BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT]: string;
};

@Injectable()
export class BusinessSetupService {
  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly onboardingService: OnboardingService,
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
}
