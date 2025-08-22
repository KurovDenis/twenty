import { BUSINESS_SETUP_STATUS, BusinessSetupStatus } from '~/modules/business-setup/hooks/useSetNextBusinessSetupStatus';

export interface TransitionRule {
  fromStep: BusinessSetupStatus;
  toStep: BusinessSetupStatus;
  conditions: string[];
  description: string;
}

export interface TransitionAnalysis {
  canTransition: boolean;
  nextStep: BusinessSetupStatus | null;
  reason: string;
  requirements: string[];
}

export class BusinessSetupTransition {
  private static readonly TRANSITION_RULES: TransitionRule[] = [
    {
      fromStep: BUSINESS_SETUP_STATUS.WELCOME,
      toStep: BUSINESS_SETUP_STATUS.BUSINESS_ANALYSIS,
      conditions: ['welcome_chat_completed', 'user_engaged'],
      description: 'User has completed welcome chat and is engaged'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.BUSINESS_ANALYSIS,
      toStep: BUSINESS_SETUP_STATUS.SALES_FUNNEL_DESIGN,
      conditions: ['business_analysis_completed', 'business_type_identified'],
      description: 'Business analysis completed and business type identified'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.SALES_FUNNEL_DESIGN,
      toStep: BUSINESS_SETUP_STATUS.AGENT_SETUP,
      conditions: ['sales_funnel_designed', 'conversion_paths_defined'],
      description: 'Sales funnel designed with defined conversion paths'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.AGENT_SETUP,
      toStep: BUSINESS_SETUP_STATUS.WORKFLOW_CREATION,
      conditions: ['agents_configured', 'automation_rules_set'],
      description: 'AI agents configured with automation rules'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.WORKFLOW_CREATION,
      toStep: BUSINESS_SETUP_STATUS.TEAM_ASSIGNMENT,
      conditions: ['workflows_created', 'automation_tested'],
      description: 'Workflows created and automation tested'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.TEAM_ASSIGNMENT,
      toStep: BUSINESS_SETUP_STATUS.TESTING_OPTIMIZATION,
      conditions: ['team_assigned', 'roles_defined'],
      description: 'Team roles assigned and responsibilities defined'
    },
    {
      fromStep: BUSINESS_SETUP_STATUS.TESTING_OPTIMIZATION,
      toStep: BUSINESS_SETUP_STATUS.COMPLETED,
      conditions: ['testing_completed', 'optimization_done'],
      description: 'Testing completed and optimization finished'
    }
  ];

  /**
   * Анализирует возможность перехода к следующему шагу
   */
  static analyzeTransition(
    currentStep: BusinessSetupStatus,
    context: Record<string, any>
  ): TransitionAnalysis {
    const rule = this.TRANSITION_RULES.find(r => r.fromStep === currentStep);
    
    if (!rule) {
      return {
        canTransition: false,
        nextStep: null,
        reason: 'No transition rule found for current step',
        requirements: []
      };
    }

    // Проверяем условия перехода
    const unmetConditions = rule.conditions.filter(condition => !context[condition]);
    const canTransition = unmetConditions.length === 0;

    return {
      canTransition,
      nextStep: canTransition ? rule.toStep : null,
      reason: canTransition 
        ? rule.description 
        : `Missing conditions: ${unmetConditions.join(', ')}`,
      requirements: unmetConditions
    };
  }

  /**
   * Получает следующий шаг для текущего статуса
   */
  static getNextStep(currentStep: BusinessSetupStatus): BusinessSetupStatus | null {
    const rule = this.TRANSITION_RULES.find(r => r.fromStep === currentStep);
    return rule ? rule.toStep : null;
  }

  /**
   * Получает предыдущий шаг для текущего статуса
   */
  static getPreviousStep(currentStep: BusinessSetupStatus): BusinessSetupStatus | null {
    const rule = this.TRANSITION_RULES.find(r => r.toStep === currentStep);
    return rule ? rule.fromStep : null;
  }

  /**
   * Проверяет, является ли шаг финальным
   */
  static isFinalStep(step: BusinessSetupStatus): boolean {
    return step === BUSINESS_SETUP_STATUS.COMPLETED;
  }

  /**
   * Получает все возможные шаги
   */
  static getAllSteps(): BusinessSetupStatus[] {
    return Object.values(BUSINESS_SETUP_STATUS);
  }

  /**
   * Получает прогресс в процентах
   */
  static getProgress(currentStep: BusinessSetupStatus): number {
    const allSteps = Object.values(BUSINESS_SETUP_STATUS);
    const currentIndex = allSteps.indexOf(currentStep);
    return currentIndex >= 0 ? Math.round((currentIndex / (allSteps.length - 1)) * 100) : 0;
  }
}
