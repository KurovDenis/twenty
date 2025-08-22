import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessSetupService } from '../business-setup.service';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';
import { BusinessSetupTransitionInput } from './dtos/chat-continuation.input';

@Injectable()
export class BusinessSetupTransitionService {
  private readonly logger = new Logger(BusinessSetupTransitionService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly businessSetupService: BusinessSetupService,
  ) {}

  async transitionToNextStep(
    userId: string,
    workspaceId: string,
    input: BusinessSetupTransitionInput,
  ): Promise<{ success: boolean; fromStep: string; toStep: string }> {
    try {
      this.logger.log(`Transitioning from ${input.fromStep} to ${input.toStep} for user ${userId}`);

      // Валидируем переход
      if (!this.isValidTransition(input.fromStep, input.toStep)) {
        throw new Error(`Invalid transition from ${input.fromStep} to ${input.toStep}`);
      }

      // Обновляем статус Business Setup
      await this.businessSetupService.setBusinessSetupStatus(
        userId,
        workspaceId,
        input.toStep as BusinessSetupStatus
      );

      // Эмитим событие перехода
      this.eventEmitter.emit('business-setup.step-transition', {
        userId,
        workspaceId,
        fromStep: input.fromStep,
        toStep: input.toStep,
        reason: input.reason,
        context: input.context,
        timestamp: new Date()
      });

      this.logger.log(`Successfully transitioned to ${input.toStep} for user ${userId}`);

      return {
        success: true,
        fromStep: input.fromStep,
        toStep: input.toStep
      };

    } catch (error) {
      this.logger.error('Failed to transition to next step:', error);
      throw error;
    }
  }

  async getNextStep(
    currentStep: BusinessSetupStatus,
    userId: string,
    workspaceId: string
  ): Promise<BusinessSetupStatus | null> {
    try {
      // Логика определения следующего шага
      switch (currentStep) {
        case BusinessSetupStatus.WELCOME:
          return BusinessSetupStatus.BUSINESS_ANALYSIS;
        
        case BusinessSetupStatus.BUSINESS_ANALYSIS:
          return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
        
        case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
          return BusinessSetupStatus.AGENT_SETUP;
        
        case BusinessSetupStatus.AGENT_SETUP:
          return BusinessSetupStatus.WORKFLOW_CREATION;
        
        case BusinessSetupStatus.WORKFLOW_CREATION:
          return BusinessSetupStatus.TEAM_ASSIGNMENT;
        
        case BusinessSetupStatus.TEAM_ASSIGNMENT:
          return BusinessSetupStatus.TESTING_OPTIMIZATION;
        
        case BusinessSetupStatus.TESTING_OPTIMIZATION:
          return BusinessSetupStatus.COMPLETED;
        
        case BusinessSetupStatus.COMPLETED:
          return null; // Достигнут финальный шаг
        
        default:
          this.logger.warn(`Unknown current step: ${currentStep}`);
          return null;
      }
    } catch (error) {
      this.logger.error('Failed to get next step:', error);
      return null;
    }
  }

  async isReadyForNextStep(
    currentStep: BusinessSetupStatus,
    userId: string,
    workspaceId: string
  ): Promise<{ ready: boolean; reason?: string; requirements?: string[] }> {
    try {
      // Проверяем готовность к следующему шагу на основе текущего
      switch (currentStep) {
        case BusinessSetupStatus.WELCOME:
          // Пользователь готов к следующему шагу после welcome чата
          return { ready: true, reason: 'Welcome chat completed' };
        
        case BusinessSetupStatus.BUSINESS_ANALYSIS:
          // Проверяем, что анализ бизнеса завершен
          // TODO: Реализовать проверку завершения анализа
          return { ready: true, reason: 'Business analysis completed' };
        
        case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
          // Проверяем, что воронка продаж спроектирована
          // TODO: Реализовать проверку завершения дизайна воронки
          return { ready: true, reason: 'Sales funnel design completed' };
        
        case BusinessSetupStatus.AGENT_SETUP:
          // Проверяем, что агенты настроены
          // TODO: Реализовать проверку настройки агентов
          return { ready: true, reason: 'Agent setup completed' };
        
        case BusinessSetupStatus.WORKFLOW_CREATION:
          // Проверяем, что workflow созданы
          // TODO: Реализовать проверку создания workflow
          return { ready: true, reason: 'Workflow creation completed' };
        
        case BusinessSetupStatus.TEAM_ASSIGNMENT:
          // Проверяем, что команда назначена
          // TODO: Реализовать проверку назначения команды
          return { ready: true, reason: 'Team assignment completed' };
        
        case BusinessSetupStatus.TESTING_OPTIMIZATION:
          // Проверяем, что тестирование завершено
          // TODO: Реализовать проверку завершения тестирования
          return { ready: true, reason: 'Testing and optimization completed' };
        
        case BusinessSetupStatus.COMPLETED:
          return { ready: false, reason: 'Already completed' };
        
        default:
          return { ready: false, reason: 'Unknown step' };
      }
    } catch (error) {
      this.logger.error('Failed to check readiness for next step:', error);
      return { ready: false, reason: 'Error checking readiness' };
    }
  }

  private isValidTransition(fromStep: string, toStep: string): boolean {
    // Валидация допустимых переходов
    const validTransitions: Record<string, string[]> = {
      [BusinessSetupStatus.WELCOME]: [BusinessSetupStatus.BUSINESS_ANALYSIS],
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: [BusinessSetupStatus.SALES_FUNNEL_DESIGN],
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: [BusinessSetupStatus.AGENT_SETUP],
      [BusinessSetupStatus.AGENT_SETUP]: [BusinessSetupStatus.WORKFLOW_CREATION],
      [BusinessSetupStatus.WORKFLOW_CREATION]: [BusinessSetupStatus.TEAM_ASSIGNMENT],
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: [BusinessSetupStatus.TESTING_OPTIMIZATION],
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: [BusinessSetupStatus.COMPLETED],
    };

    const allowedSteps = validTransitions[fromStep];
    return allowedSteps ? allowedSteps.includes(toStep) : false;
  }

  async getBusinessSetupProgress(
    userId: string,
    workspaceId: string
  ): Promise<{
    currentStep: BusinessSetupStatus;
    completedSteps: BusinessSetupStatus[];
    totalSteps: number;
    progressPercentage: number;
  }> {
    try {
      const currentStep = await this.businessSetupService.getBusinessSetupStatus(
        { id: userId } as any,
        { id: workspaceId } as any
      );

      const allSteps = Object.values(BusinessSetupStatus);
      const currentStepIndex = allSteps.indexOf(currentStep);
      
      const completedSteps = allSteps.slice(0, currentStepIndex);
      const totalSteps = allSteps.length;
      const progressPercentage = Math.round((currentStepIndex / (totalSteps - 1)) * 100);

      return {
        currentStep,
        completedSteps,
        totalSteps,
        progressPercentage
      };

    } catch (error) {
      this.logger.error('Failed to get business setup progress:', error);
      throw error;
    }
  }
}
