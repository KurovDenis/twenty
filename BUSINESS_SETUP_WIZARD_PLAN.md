# Business Setup Wizard Implementation Plan

## Цель
Создать систему Business Setup Wizard - пошаговый мастер настройки бизнес-процессов через AI агентов, аналогичный onboarding процессу, но для полной автоматизации работы системы Twenty.

## Содержание
1. [Архитектура Business Setup Wizard](#1-архитектура-business-setup-wizard)
2. [Статусы Business Setup](#2-статусы-business-setup)
3. [Детальный flow процесса](#3-детальный-flow-процесса)
4. [Интеграция с существующими системами](#4-интеграция-с-существующими-системами)
5. [Система навигации и роутинга](#5-система-навигации-и-роутинга)
6. [Хранение состояния](#6-хранение-состояния)
7. [AI агенты и их роли](#7-ai-агенты-и-их-роли)
8. [Workflow автоматизация](#8-workflow-автоматизация)
9. [Интеграции](#9-интеграции)
10. [Производительность и оптимизация](#10-производительность-и-оптимизация)
11. [Безопасность и валидация](#11-безопасность-и-валидация)
12. [Тестирование и качество кода](#12-тестирование-и-качество-кода)
13. [Масштабируемость и расширяемость](#13-масштабируемость-и-расширяемость)
14. [Архитектурные паттерны и принципы](#14-архитектурные-паттерны-и-принципы)
15. [Детальный анализ кодовой базы](#15-детальный-анализ-кодовой-базы)
16. [Дополнительные технические детали](#16-дополнительные-технические-детали)
17. [Edge Cases и обработка ошибок](#17-edge-cases-и-обработка-ошибок)
18. [Производительность и мониторинг](#18-производительность-и-мониторинг)
19. [Безопасность и соответствие](#19-безопасность-и-соответствие)
20. [Развертывание и DevOps](#20-развертывание-и-devops)
21. [Анализ производительности](#21-анализ-производительности)
22. [Рекомендации по улучшению](#22-рекомендации-по-улучшению)
23. [Интеграция с Floating AI Chat Button](#23-интеграция-с-floating-ai-chat-button)
24. [Agent Supervisor System](#24-agent-supervisor-system)
25. [Интерактивный процесс Business Setup через AI чат](#25-интерактивный-процесс-business-setup-через-ai-чат)

---

## 1. Архитектура Business Setup Wizard

### Backend архитектура
- **BusinessSetupService** - центральный сервис управления статусами
- **BusinessSetupResolver** - GraphQL мутации для управления шагами
- **BusinessSetupVarsService** - хранение состояния setup шагов в базе данных
- **BusinessAnalysisAgent** - AI агент для анализа бизнеса
- **FunnelDesignerAgent** - AI агент для создания воронок продаж
- **AgentOrchestrationService** - координация и создание агентов
- **WorkflowGeneratorAgent** - генерация workflow автоматизации

### Frontend архитектура
- **useBusinessSetupStatus** - хук для получения текущего статуса
- **useSetNextBusinessSetupStatus** - хук для перехода к следующему шагу
- **useBusinessSetupPageChangeEffectNavigateLocation** - автоматическая навигация между шагами

---

## 2. Статусы Business Setup (BusinessSetupStatus)

```typescript
enum BusinessSetupStatus {
  WELCOME = 'WELCOME',                                   // Приветствие AI агента
  WORKSPACE_NOT_ACTIVE = 'WORKSPACE_NOT_ACTIVE',        // Workspace не активирован
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',               // Анализ бизнеса
  SALES_FUNNEL_DESIGN = 'SALES_FUNNEL_DESIGN',           // Дизайн воронки продаж
  AGENT_SETUP = 'AGENT_SETUP',                           // Настройка агентов
  WORKFLOW_CREATION = 'WORKFLOW_CREATION',               // Создание workflow
  TEAM_ASSIGNMENT = 'TEAM_ASSIGNMENT',                   // Назначение команды
  TESTING_OPTIMIZATION = 'TESTING_OPTIMIZATION',         // Тестирование и оптимизация
  COMPLETED = 'COMPLETED'                                // Завершено
}
```

---

## 3. Детальный flow процесса

### Шаг 0: Приветствие AI агента (WELCOME)

**Frontend:** `BusinessSetupWelcome.tsx`
- Приветственное сообщение от AI агента
- Объяснение процесса Business Setup
- Интерактивный сбор базовой информации о бизнесе
- Мотивация и установка ожиданий
- Плавный переход к анализу бизнеса

**Backend:** `BusinessSetupWelcomeAgent.execute()`
```typescript
async generateWelcomeMessage(context: BusinessSetupContext): Promise<string> {
  const { step, userResponses } = context;

  switch (step) {
    case 'WELCOME':
      return `🎉 **Welcome to Business Setup Wizard!**

Hi there! I'm your AI business assistant, and I'm here to help you create a fully automated business system tailored specifically to your company.

**What we'll accomplish together:**

🚀 **Business Analysis** - I'll analyze your industry, business model, and processes
🎯 **Sales Funnel Design** - Create the perfect conversion funnel for your business  
🤖 **AI Agent Setup** - Build a team of specialized AI agents for your processes
⚡ **Workflow Automation** - Design automated workflows that run your business
👥 **Team Assignment** - Set up roles and responsibilities for your team
🧪 **Testing & Optimization** - Ensure everything works perfectly

**Ready to transform your business?** 

Just say "Let's start!" and I'll guide you through the entire process step by step. 

*This will take about 10-15 minutes, and you'll have a fully automated business system at the end!* ✨`;
    
    case 'AFTER_GREETING':
      return `Perfect! Let's get started with your business analysis.

To create the perfect automation system for your business, I need to understand a few things about your company:

**Tell me about your business:**

1. **What industry are you in?** (e.g., technology, healthcare, e-commerce, consulting)
2. **What's your business model?** (e.g., SaaS, marketplace, agency, product)
3. **How big is your company?** (number of employees)
4. **What's your annual revenue?** (approximate range)
5. **Who is your target market?** (B2B, B2C, specific segments)

You can answer these questions one by one, or tell me everything at once. I'll analyze your responses and create a customized business setup plan! 🚀`;
    
    // ... остальные case для каждого этапа сбора информации
  }
}

async processUserResponse(
  userMessage: string, 
  context: BusinessSetupContext
): Promise<BusinessSetupResponse> {
  const { step, userResponses } = context;

  // Анализируем ответ пользователя
  const analysis = await this.analyzeUserResponse(userMessage, step);

  // Обновляем контекст
  const updatedContext = {
    ...context,
    userResponses: {
      ...userResponses,
      ...analysis.extractedData
    }
  };

  // Определяем следующий шаг
  const nextStep = this.determineNextStep(step, analysis);

  // Генерируем ответ
  const response = await this.generateWelcomeMessage({
    ...updatedContext,
    step: nextStep
  });

  return {
    message: response,
    nextStep,
    extractedData: analysis.extractedData,
    shouldProceedToAnalysis: nextStep === 'ANALYSIS_READY'
  };
}
```

**Интеграция с Floating AI Chat Button:**
```typescript
export const useBusinessSetupWelcomeChat = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const navigate = useNavigate();

  const startWelcomeChat = () => {
    openAskAIPage({
              initialMessage: "Настройка системы",
      context: {
        businessSetupMode: true,
        step: 'WELCOME',
        agentType: 'BUSINESS_SETUP_WELCOME',
        welcomeMessage: getWelcomeMessage(),
      },
    });
  };

  const handleAnalysisReady = () => {
    // Переходим к следующему шагу - анализу бизнеса
    setNextBusinessSetupStatus();
    navigate(AppPath.BusinessAnalysis);
  };

  return {
    startWelcomeChat,
    handleAnalysisReady,
  };
};
```

### Шаг 1: Проверка плана и возможностей

**Frontend:** `BusinessSetupPlanCheck.tsx`
- Проверка текущего плана (trial, PRO, ENTERPRISE)
- Отображение доступных возможностей для каждого плана
- Рекомендации по upgrade при необходимости
- Переход к анализу бизнеса

**Backend:** `BusinessSetupBillingService.checkPlanFeatures()`
```typescript
async checkBusinessSetupEligibility(workspaceId: string): Promise<BusinessSetupEligibility> {
  const subscription = await this.billingService.getSubscription(workspaceId);
  
  // Business Setup доступен для всех планов (trial, PRO, ENTERPRISE)
  const plan = subscription ? getPlanKeyFromSubscription(subscription) : 'TRIAL';
  const isTrial = subscription?.status === SubscriptionStatus.Trialing;
  
  return {
    eligible: true, // Доступно всем!
    plan,
    isTrial,
    features: this.getBusinessSetupFeatures(plan),
    upgradeRecommendations: this.getUpgradeRecommendations(plan, isTrial)
  };
}
```

### Шаг 2: Анализ бизнеса (BUSINESS_ANALYSIS)

**Frontend:** `BusinessAnalysis.tsx`
- Форма с полями: отрасль, размер компании, бизнес-модель
- Загрузка дополнительных данных о бизнесе
- Валидация через Zod schema
- Вызов `BusinessAnalysisAgent` для анализа
- Progress indicator и error handling

**Backend:** `BusinessAnalysisAgent.execute()`
```typescript
async executeBusinessAnalysis({
  industry,
  companySize,
  businessModel,
  annualRevenue,
  employeeCount,
  targetMarket,
}: BusinessAnalysisInput): Promise<BusinessAnalysisResult> {
  
  // Анализ отрасли и конкурентов
  const industryAnalysis = await this.analyzeIndustry(industry);
  
  // Определение типичных процессов
  const processMapping = await this.mapBusinessProcesses({
    industry,
    companySize,
    businessModel
  });
  
  // Рекомендации по воронке продаж
  const funnelRecommendations = await this.recommendSalesFunnel({
    industry,
    targetMarket,
    businessModel
  });
  
  return {
    industryAnalysis,
    processMapping,
    funnelRecommendations,
    recommendedAgents: this.getRecommendedAgents(industry, businessModel),
    estimatedSetupTime: this.calculateSetupTime(companySize),
  };
}
```

### Шаг 3: Дизайн воронки продаж (SALES_FUNNEL_DESIGN)

**Frontend:** `SalesFunnelDesign.tsx`
- Интерактивный конструктор воронки
- Drag & drop этапов
- Настройка переходов и условий
- Предварительный просмотр
- AI-powered suggestions

**Backend:** `FunnelDesignerAgent.execute()`
```typescript
async designSalesFunnel({
  industry,
  businessModel,
  targetMarket,
  currentProcesses,
}: FunnelDesignInput): Promise<SalesFunnelDesign> {
  
  // Создание базовой воронки на основе отрасли
  const baseFunnel = await this.createBaseFunnel(industry);
  
  // Адаптация под бизнес-модель
  const adaptedFunnel = await this.adaptFunnelToBusinessModel(
    baseFunnel, 
    businessModel
  );
  
  // Оптимизация конверсии
  const optimizedFunnel = await this.optimizeConversion(adaptedFunnel);
  
  // Создание этапов и переходов
  const funnelStages = await this.createFunnelStages(optimizedFunnel);
  
  return {
    stages: funnelStages,
    transitions: this.createTransitions(funnelStages),
    kpis: this.defineKPIs(funnelStages),
    conversionTargets: this.setConversionTargets(funnelStages),
  };
}
```

### Шаг 4: Настройка агентов (AGENT_SETUP)

**Frontend:** `AgentSetup.tsx`
- Выбор агентов для каждого этапа воронки
- Настройка промптов и поведения
- Предварительное тестирование агентов
- Настройка координации между агентами
- Performance preview

**Backend:** `AgentOrchestrationService.execute()`
```typescript
async setupAgents({
  funnelStages,
  businessContext,
  userPreferences,
}: AgentSetupInput): Promise<AgentSetupResult> {
  
  const agents = [];
  
  for (const stage of funnelStages) {
    // Создание агента для этапа
    const agent = await this.createStageAgent({
      stage,
      businessContext,
      userPreferences,
    });
    
    // Настройка промпта
    const prompt = await this.generateAgentPrompt({
      stage,
      businessContext,
      previousAgents: agents,
    });
    
    // Настройка координации
    const coordination = await this.setupCoordination({
      agent,
      previousAgents: agents,
      nextStages: this.getNextStages(stage, funnelStages),
    });
    
    agents.push({
      agent,
      prompt,
      coordination,
      stage,
    });
  }
  
  return {
    agents,
    coordinationMatrix: this.createCoordinationMatrix(agents),
    supervisorAgent: await this.createSupervisorAgent(agents),
  };
}
```

### Шаг 5: Создание workflow (WORKFLOW_CREATION)

**Frontend:** `WorkflowCreation.tsx`
- Автоматическая генерация workflow
- Настройка триггеров и условий
- Интеграция с внешними системами
- Тестирование workflow
- Visual workflow builder

**Backend:** `WorkflowGeneratorAgent.execute()`
```typescript
async generateWorkflows({
  funnelStages,
  agents,
  businessContext,
}: WorkflowGenerationInput): Promise<WorkflowGenerationResult> {
  
  const workflows = [];
  
  // Основной workflow для воронки продаж
  const mainWorkflow = await this.createMainSalesWorkflow({
    funnelStages,
    agents,
  });
  
  // Workflow для каждого этапа
  for (const stage of funnelStages) {
    const stageWorkflow = await this.createStageWorkflow({
      stage,
      agent: agents.find(a => a.stage.id === stage.id),
      businessContext,
    });
    
    workflows.push(stageWorkflow);
  }
  
  // Workflow для координации агентов
  const coordinationWorkflow = await this.createCoordinationWorkflow({
    agents,
    coordinationMatrix: this.createCoordinationMatrix(agents),
  });
  
  // Workflow для мониторинга и отчетности
  const monitoringWorkflow = await this.createMonitoringWorkflow({
    funnelStages,
    kpis: this.defineKPIs(funnelStages),
  });
  
  return {
    mainWorkflow,
    stageWorkflows: workflows,
    coordinationWorkflow,
    monitoringWorkflow,
    integrationPoints: this.defineIntegrationPoints(businessContext),
  };
}
```

### Шаг 6: Назначение команды (TEAM_ASSIGNMENT)

**Frontend:** `TeamAssignment.tsx`
- Создание ролей и ответственностей
- Назначение ответственных за этапы
- Настройка прав доступа
- Создание обучающих материалов
- Team collaboration tools

**Backend:** `TeamAssignmentService.execute()`
```typescript
async assignTeam({
  funnelStages,
  agents,
  workflows,
  teamMembers,
}: TeamAssignmentInput): Promise<TeamAssignmentResult> {
  
  // Создание ролей на основе этапов
  const roles = await this.createRoles(funnelStages);
  
  // Назначение ответственных
  const assignments = await this.assignResponsible({
    roles,
    teamMembers,
    funnelStages,
  });
  
  // Настройка прав доступа
  const permissions = await this.setupPermissions({
    roles,
    assignments,
    workflows,
  });
  
  // Создание обучающих материалов
  const trainingMaterials = await this.generateTrainingMaterials({
    funnelStages,
    agents,
    workflows,
    roles,
  });
  
  return {
    roles,
    assignments,
    permissions,
    trainingMaterials,
    escalationMatrix: this.createEscalationMatrix(assignments),
  };
}
```

### Шаг 7: Тестирование и оптимизация (TESTING_OPTIMIZATION)

**Frontend:** `TestingOptimization.tsx`
- Автоматическое тестирование workflow
- Симуляция различных сценариев
- Оптимизация производительности
- Настройка мониторинга
- Performance dashboard

**Backend:** `TestingOptimizationService.execute()`
```typescript
async testAndOptimize({
  workflows,
  agents,
  funnelStages,
  testScenarios,
}: TestingOptimizationInput): Promise<TestingOptimizationResult> {
  
  // Тестирование workflow
  const workflowTests = await this.testWorkflows({
    workflows,
    testScenarios,
  });
  
  // Тестирование агентов
  const agentTests = await this.testAgents({
    agents,
    testScenarios,
  });
  
  // Оптимизация производительности
  const optimizations = await this.optimizePerformance({
    workflows,
    agents,
    testResults: { workflowTests, agentTests },
  });
  
  // Настройка мониторинга
  const monitoring = await this.setupMonitoring({
    workflows,
    agents,
    kpis: this.defineKPIs(funnelStages),
  });
  
  return {
    testResults: { workflowTests, agentTests },
    optimizations,
    monitoring,
    recommendations: this.generateRecommendations(testResults),
  };
}
```

---

## 4. Интеграция с существующими системами

### Интеграция с Onboarding системой
```typescript
// Расширение OnboardingStatus
enum OnboardingStatus {
  // ... существующие статусы
  BUSINESS_SETUP_REQUIRED = 'BUSINESS_SETUP_REQUIRED',
  BUSINESS_SETUP_IN_PROGRESS = 'BUSINESS_SETUP_IN_PROGRESS',
  BUSINESS_SETUP_COMPLETED = 'BUSINESS_SETUP_COMPLETED',
}

// Автоматический переход после завершения onboarding
if (onboardingStatus === OnboardingStatus.COMPLETED) {
  return BusinessSetupStatus.BUSINESS_ANALYSIS;
}
```

### Интеграция с Billing системой
```typescript
// Расширение BillingService для Business Setup
@Injectable()
export class BusinessSetupBillingService {
  constructor(
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async getBusinessSetupPlanFeatures(workspaceId: string): Promise<BusinessSetupPlanFeatures> {
    const subscription = await this.billingService.getSubscription(workspaceId);
    
    // Business Setup доступен для всех планов (trial, PRO, ENTERPRISE)
    if (!subscription || subscription.status === SubscriptionStatus.Trialing) {
      return this.getTrialPlanFeatures();
    }
    
    if (subscription.status === SubscriptionStatus.Active) {
      const plan = getPlanKeyFromSubscription(subscription);
      
      switch (plan) {
        case BillingPlanKey.PRO:
          return this.getProPlanFeatures();
        case BillingPlanKey.ENTERPRISE:
          return this.getEnterprisePlanFeatures();
        default:
          return this.getTrialPlanFeatures();
      }
    }
    
    return this.getTrialPlanFeatures();
  }

  async getBusinessSetupPlanRequirements(): Promise<BusinessSetupPlanRequirements> {
    return {
      availablePlans: ['TRIAL', 'PRO', 'ENTERPRISE'],
      features: {
        trial: [
          'Basic AI-powered business analysis (1/month)',
          'Simple sales funnel design (3 stages)',
          'Basic agent setup (2 agents)',
          'Simple workflow automation (1 workflow)',
          'Basic team assignment',
          'Basic testing and optimization'
        ],
        pro: [
          'Advanced AI-powered business analysis (5/month)',
          'Advanced sales funnel design (7 stages)',
          'Advanced agent setup (5 agents)',
          'Advanced workflow automation (10 workflows)',
          'Advanced team assignment',
          'Advanced testing and optimization'
        ],
        enterprise: [
          'Unlimited AI-powered business analysis',
          'Unlimited sales funnel design',
          'Unlimited agent setup',
          'Unlimited workflow automation',
          'Advanced team assignment',
          'Advanced testing and optimization',
          'White-label solutions',
          'Custom AI training',
          'Dedicated support'
        ]
      },
      pricing: {
        trial: {
          monthly: 0,
          yearly: 0,
          businessSetupIncluded: true
        },
        pro: {
          monthly: 29,
          yearly: 290,
          businessSetupIncluded: true
        },
        enterprise: {
          monthly: 99,
          yearly: 990,
          businessSetupIncluded: true,
          prioritySupport: true
        }
      }
    };
  }

  async upgradeToBusinessSetupPlan(workspaceId: string, plan: 'PRO' | 'ENTERPRISE'): Promise<void> {
    const checkoutSession = await this.billingService.createCheckoutSession({
      workspaceId,
      plan,
      successUrl: `${this.configService.get('FRONT_BASE_URL')}/business-setup/analysis`,
      cancelUrl: `${this.configService.get('FRONT_BASE_URL')}/settings/billing`,
      metadata: {
        businessSetupUpgrade: 'true',
        originalPlan: await this.getCurrentPlan(workspaceId)
      }
    });

    return checkoutSession;
  }
}
```

### Интеграция с Workspace системой
```typescript
// Расширение WorkspaceService для Business Setup
@Injectable()
export class BusinessSetupWorkspaceService {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceManagerService: WorkspaceManagerService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async initializeBusinessSetupWorkspace(workspaceId: string, userId: string): Promise<void> {
    // Проверка workspace активации
    const workspace = await this.workspaceService.getWorkspace(workspaceId);
    
    if (workspace.activationStatus !== WorkspaceActivationStatus.ACTIVE) {
      throw new BusinessSetupException(
        'Workspace must be active to start Business Setup',
        BusinessSetupExceptionCode.WORKSPACE_NOT_ACTIVE
      );
    }

    // Включение Business Setup feature flags
    await this.featureFlagService.enableFeatureFlags([
      FeatureFlagKey.IS_BUSINESS_SETUP_ENABLED,
      FeatureFlagKey.IS_AI_ENABLED,
      FeatureFlagKey.IS_WORKFLOW_ENABLED,
      FeatureFlagKey.IS_AGENT_ENABLED
    ], workspaceId);

    // Инициализация Business Setup схемы
    await this.initializeBusinessSetupSchema(workspaceId);

    // Создание default Business Setup агентов
    await this.createDefaultBusinessSetupAgents(workspaceId, userId);
  }

  private async initializeBusinessSetupSchema(workspaceId: string): Promise<void> {
    // Создание таблиц для Business Setup
    const schema = await this.workspaceManagerService.getWorkspaceSchema(workspaceId);
    
    await schema.query(`
      CREATE TABLE IF NOT EXISTS business_setup_analysis (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        user_id UUID NOT NULL,
        industry VARCHAR(255) NOT NULL,
        business_model VARCHAR(255) NOT NULL,
        annual_revenue DECIMAL(15,2) NOT NULL,
        employee_count INTEGER NOT NULL,
        target_market TEXT NOT NULL,
        analysis_result JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS business_setup_funnel (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        user_id UUID NOT NULL,
        funnel_design JSONB NOT NULL,
        stages JSONB NOT NULL,
        transitions JSONB NOT NULL,
        kpis JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS business_setup_agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        agent_id UUID NOT NULL,
        stage_id VARCHAR(255) NOT NULL,
        configuration JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS business_setup_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        workflow_id UUID NOT NULL,
        workflow_type VARCHAR(255) NOT NULL,
        configuration JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_business_setup_analysis_workspace ON business_setup_analysis(workspace_id);
      CREATE INDEX idx_business_setup_funnel_workspace ON business_setup_funnel(workspace_id);
      CREATE INDEX idx_business_setup_agents_workspace ON business_setup_agents(workspace_id);
      CREATE INDEX idx_business_setup_workflows_workspace ON business_setup_workflows(workspace_id);
    `);
  }

  private async createDefaultBusinessSetupAgents(workspaceId: string, userId: string): Promise<void> {
    const defaultAgents = [
      {
        name: 'Business Analysis Agent',
        type: AgentType.BUSINESS_ANALYSIS,
        description: 'AI agent for analyzing business processes and providing recommendations',
        prompt: this.getDefaultBusinessAnalysisPrompt(),
        modelId: 'gpt-4o',
        isCustom: true
      },
      {
        name: 'Funnel Designer Agent',
        type: AgentType.FUNNEL_DESIGNER,
        description: 'AI agent for designing sales funnels based on business analysis',
        prompt: this.getDefaultFunnelDesignPrompt(),
        modelId: 'gpt-4o',
        isCustom: true
      },
      {
        name: 'Workflow Generator Agent',
        type: AgentType.WORKFLOW_GENERATOR,
        description: 'AI agent for generating automated workflows',
        prompt: this.getDefaultWorkflowGeneratorPrompt(),
        modelId: 'gpt-4o',
        isCustom: true
      }
    ];

    for (const agentConfig of defaultAgents) {
      await this.agentService.createAgent({
        ...agentConfig,
        workspaceId,
        createdBy: userId
      });
    }
  }
}
```

### Интеграция с Agent системой
```typescript
// Использование существующих типов агентов
enum AgentType {
  // ... существующие типы
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',
  FUNNEL_DESIGNER = 'FUNNEL_DESIGNER',
  WORKFLOW_GENERATOR = 'WORKFLOW_GENERATOR',
  TEAM_ASSIGNMENT = 'TEAM_ASSIGNMENT',
  SUPERVISOR = 'SUPERVISOR',
}

// Расширение AgentEntity
@Entity('agent')
export class AgentEntity {
  // ... существующие поля
  @Column({ nullable: true, type: 'jsonb' })
  businessSetupConfig: BusinessSetupAgentConfig;
}

// Business Setup Agent Configuration
interface BusinessSetupAgentConfig {
  stageId?: string;
  funnelStage?: string;
  workflowType?: string;
  coordinationRules?: AgentCoordinationRule[];
  fallbackStrategy?: AgentFallbackStrategy;
  performanceMetrics?: AgentPerformanceMetrics;
}

interface AgentCoordinationRule {
  triggerEvent: string;
  targetAgentId: string;
  action: 'notify' | 'delegate' | 'escalate';
  conditions?: Record<string, any>;
}

interface AgentFallbackStrategy {
  type: 'retry' | 'human_escalation' | 'alternative_agent';
  maxRetries?: number;
  escalationThreshold?: number;
  alternativeAgentId?: string;
}

interface AgentPerformanceMetrics {
  responseTime: number;
  successRate: number;
  userSatisfaction: number;
  tokensUsed: number;
}
```

### Интеграция с Workflow системой
```typescript
// Новые типы действий для Business Setup
enum WorkflowActionType {
  // ... существующие типы
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',
  FUNNEL_DESIGN = 'FUNNEL_DESIGN',
  AGENT_SETUP = 'AGENT_SETUP',
  WORKFLOW_GENERATION = 'WORKFLOW_GENERATION',
  TEAM_ASSIGNMENT = 'TEAM_ASSIGNMENT',
  TESTING_OPTIMIZATION = 'TESTING_OPTIMIZATION',
}

// Business Setup Workflow Configuration
interface BusinessSetupWorkflowConfig {
  type: WorkflowActionType;
  stage: BusinessSetupStatus;
  dependencies: WorkflowActionType[];
  timeout: number;
  retryPolicy: RetryPolicy;
  successCriteria: SuccessCriteria;
  failureHandling: FailureHandling;
}

interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
}

interface SuccessCriteria {
  requiredSteps: string[];
  optionalSteps: string[];
  validationRules: ValidationRule[];
}

interface FailureHandling {
  action: 'retry' | 'escalate' | 'skip' | 'rollback';
  escalationLevel: number;
  notificationChannels: string[];
}

// Workflow Generator для Business Setup
@Injectable()
export class BusinessSetupWorkflowGenerator {
  async generateBusinessSetupWorkflow(
    workspaceId: string,
    businessAnalysis: BusinessAnalysisResult,
    funnelDesign: SalesFunnelDesign
  ): Promise<Workflow[]> {
    const workflows: Workflow[] = [];

    // Основной workflow для Business Setup
    const mainWorkflow = await this.createMainBusinessSetupWorkflow(
      workspaceId,
      businessAnalysis,
      funnelDesign
    );
    workflows.push(mainWorkflow);

    // Workflow для каждого этапа воронки
    for (const stage of funnelDesign.stages) {
      const stageWorkflow = await this.createStageWorkflow(
        workspaceId,
        stage,
        businessAnalysis
      );
      workflows.push(stageWorkflow);
    }

    // Workflow для координации агентов
    const coordinationWorkflow = await this.createCoordinationWorkflow(
      workspaceId,
      funnelDesign
    );
    workflows.push(coordinationWorkflow);

    // Workflow для мониторинга и отчетности
    const monitoringWorkflow = await this.createMonitoringWorkflow(
      workspaceId,
      funnelDesign
    );
    workflows.push(monitoringWorkflow);

    return workflows;
  }

  private async createMainBusinessSetupWorkflow(
    workspaceId: string,
    businessAnalysis: BusinessAnalysisResult,
    funnelDesign: SalesFunnelDesign
  ): Promise<Workflow> {
    return {
      name: 'Business Setup Main Workflow',
      description: 'Main workflow for business setup automation',
      workspaceId,
      trigger: {
        type: 'MANUAL',
        event: 'BUSINESS_SETUP_STARTED'
      },
      steps: [
        {
          id: 'business-analysis',
          name: 'Business Analysis',
          type: WorkflowActionType.BUSINESS_ANALYSIS,
          settings: {
            agentId: await this.getAgentId(workspaceId, AgentType.BUSINESS_ANALYSIS),
            input: {
              businessAnalysis,
              workspaceId
            }
          }
        },
        {
          id: 'funnel-design',
          name: 'Sales Funnel Design',
          type: WorkflowActionType.FUNNEL_DESIGN,
          settings: {
            agentId: await this.getAgentId(workspaceId, AgentType.FUNNEL_DESIGNER),
            input: {
              funnelDesign,
              businessAnalysis
            }
          }
        },
        {
          id: 'agent-setup',
          name: 'Agent Setup',
          type: WorkflowActionType.AGENT_SETUP,
          settings: {
            agentId: await this.getAgentId(workspaceId, AgentType.SUPERVISOR),
            input: {
              funnelStages: funnelDesign.stages,
              businessContext: businessAnalysis
            }
          }
        }
      ],
      conditions: [
        {
          id: 'check-subscription',
          type: 'SUBSCRIPTION_ACTIVE',
          settings: {
            workspaceId
          }
        }
      ]
    };
  }
}
```

### Интеграция с Notification системой
```typescript
// Business Setup Notifications
@Injectable()
export class BusinessSetupNotificationService {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly userService: UserService
  ) {}

  async notifyBusinessSetupProgress(
    userId: string,
    workspaceId: string,
    step: BusinessSetupStatus,
    progress: number
  ): Promise<void> {
    const user = await this.userService.getUser(userId);
    const workspace = await this.workspaceService.getWorkspace(workspaceId);

    // In-app notification
    await this.notificationService.createNotification({
      userId,
      workspaceId,
      type: 'BUSINESS_SETUP_PROGRESS',
      title: `Business Setup Progress: ${this.getStepTitle(step)}`,
      message: `Your business setup is ${progress}% complete.`,
      data: {
        step,
        progress,
        nextStep: this.getNextStep(step)
      }
    });

    // Email notification for major milestones
    if (this.isMajorMilestone(step)) {
      await this.emailService.sendBusinessSetupProgressEmail({
        to: user.email,
        workspaceName: workspace.displayName,
        step,
        progress,
        nextStep: this.getNextStep(step)
      });
    }
  }

  async notifyBusinessSetupError(
    userId: string,
    workspaceId: string,
    step: BusinessSetupStatus,
    error: Error
  ): Promise<void> {
    const user = await this.userService.getUser(userId);

    // Error notification
    await this.notificationService.createNotification({
      userId,
      workspaceId,
      type: 'BUSINESS_SETUP_ERROR',
      title: 'Business Setup Error',
      message: `An error occurred during ${this.getStepTitle(step)}. Our team has been notified.`,
      data: {
        step,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });

    // Support email for critical errors
    if (this.isCriticalError(error)) {
      await this.emailService.sendBusinessSetupErrorEmail({
        to: user.email,
        step,
        error: error.message,
        supportTicketId: await this.createSupportTicket(userId, workspaceId, step, error)
      });
    }
  }

  private getStepTitle(step: BusinessSetupStatus): string {
    const titles = {
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 'Business Analysis',
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 'Sales Funnel Design',
      [BusinessSetupStatus.AGENT_SETUP]: 'Agent Setup',
      [BusinessSetupStatus.WORKFLOW_CREATION]: 'Workflow Creation',
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: 'Team Assignment',
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: 'Testing & Optimization'
    };
    return titles[step] || 'Unknown Step';
  }

  private getNextStep(currentStep: BusinessSetupStatus): BusinessSetupStatus | null {
    const nextSteps = {
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: BusinessSetupStatus.AGENT_SETUP,
      [BusinessSetupStatus.AGENT_SETUP]: BusinessSetupStatus.WORKFLOW_CREATION,
      [BusinessSetupStatus.WORKFLOW_CREATION]: BusinessSetupStatus.TEAM_ASSIGNMENT,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: BusinessSetupStatus.TESTING_OPTIMIZATION,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: BusinessSetupStatus.COMPLETED
    };
    return nextSteps[currentStep] || null;
  }

  private isMajorMilestone(step: BusinessSetupStatus): boolean {
    return [
      BusinessSetupStatus.BUSINESS_ANALYSIS,
      BusinessSetupStatus.AGENT_SETUP,
      BusinessSetupStatus.COMPLETED
    ].includes(step);
  }

  private isCriticalError(error: Error): boolean {
    return error instanceof BusinessSetupException && 
           error.code === BusinessSetupExceptionCode.AGENT_EXECUTION_FAILED;
  }
}
```

---

## 5. Система навигации и роутинга

### Автоматическая навигация
```typescript
// useBusinessSetupPageChangeEffectNavigateLocation.ts
export const useBusinessSetupPageChangeEffectNavigateLocation = () => {
  const isLoggedIn = useIsLogged();
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const businessSetupStatus = useBusinessSetupStatus();
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusEqualsTo(
    WorkspaceActivationStatus.SUSPENDED,
  );

  const businessSetupPaths = [
    AppPath.BusinessSetupWelcome,
    AppPath.BusinessSetupPlanCheck,
    AppPath.BusinessAnalysis,
    AppPath.SalesFunnelDesign,
    AppPath.AgentSetup,
    AppPath.WorkflowCreation,
    AppPath.TeamAssignment,
    AppPath.TestingOptimization,
    AppPath.BusinessSetupCompleted,
  ];

  // Логика редиректов на основе статуса
  if (businessSetupStatus === BusinessSetupStatus.WORKSPACE_NOT_ACTIVE) {
    return AppPath.CreateWorkspace;
  }

  if (businessSetupStatus === BusinessSetupStatus.WORKSPACE_NOT_ACTIVE) {
    return AppPath.CreateWorkspace;
  }

  if (businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS && 
      !someMatchingLocationOf([AppPath.BusinessAnalysis])) {
    return AppPath.BusinessAnalysis;
  }

  if (businessSetupStatus === BusinessSetupStatus.SALES_FUNNEL_DESIGN && 
      !someMatchingLocationOf([AppPath.SalesFunnelDesign])) {
    return AppPath.SalesFunnelDesign;
  }

  if (businessSetupStatus === BusinessSetupStatus.AGENT_SETUP && 
      !someMatchingLocationOf([AppPath.AgentSetup])) {
    return AppPath.AgentSetup;
  }

  if (businessSetupStatus === BusinessSetupStatus.WORKFLOW_CREATION && 
      !someMatchingLocationOf([AppPath.WorkflowCreation])) {
    return AppPath.WorkflowCreation;
  }

  if (businessSetupStatus === BusinessSetupStatus.TEAM_ASSIGNMENT && 
      !someMatchingLocationOf([AppPath.TeamAssignment])) {
    return AppPath.TeamAssignment;
  }

  if (businessSetupStatus === BusinessSetupStatus.TESTING_OPTIMIZATION && 
      !someMatchingLocationOf([AppPath.TestingOptimization])) {
    return AppPath.TestingOptimization;
  }

  if (businessSetupStatus === BusinessSetupStatus.COMPLETED && 
      !someMatchingLocationOf([AppPath.BusinessSetupCompleted])) {
    return AppPath.BusinessSetupCompleted;
  }

  return null;
};
```

### Роутинг
```typescript
// useCreateAppRouter.tsx
<Route path={AppPath.BusinessSetupWelcome} element={<BusinessSetupWelcome />} />
<Route path={AppPath.BusinessSetupPlanCheck} element={<BusinessSetupPlanCheck />} />
<Route path={AppPath.BusinessAnalysis} element={<BusinessAnalysis />} />
<Route path={AppPath.SalesFunnelDesign} element={<SalesFunnelDesign />} />
<Route path={AppPath.AgentSetup} element={<AgentSetup />} />
<Route path={AppPath.WorkflowCreation} element={<WorkflowCreation />} />
<Route path={AppPath.TeamAssignment} element={<TeamAssignment />} />
<Route path={AppPath.TestingOptimization} element={<TestingOptimization />} />
<Route path={AppPath.BusinessSetupCompleted} element={<BusinessSetupCompleted />} />
```

---

## 6. Хранение состояния

### Backend (BusinessSetupVars):
```typescript
enum BusinessSetupStepKeys {
  WELCOME_PENDING = 'WELCOME_PENDING',
  BUSINESS_ANALYSIS_PENDING = 'BUSINESS_ANALYSIS_PENDING',
  SALES_FUNNEL_DESIGN_PENDING = 'SALES_FUNNEL_DESIGN_PENDING',
  AGENT_SETUP_PENDING = 'AGENT_SETUP_PENDING',
  WORKFLOW_CREATION_PENDING = 'WORKFLOW_CREATION_PENDING',
  TEAM_ASSIGNMENT_PENDING = 'TEAM_ASSIGNMENT_PENDING',
  TESTING_OPTIMIZATION_PENDING = 'TESTING_OPTIMIZATION_PENDING',
  BUSINESS_SETUP_COMPLETED = 'BUSINESS_SETUP_COMPLETED',
}
```

### Frontend (Recoil):
```typescript
// businessSetupState
export const businessSetupState = atom<BusinessSetupState | null>({
  key: 'businessSetupState',
  default: null,
});

// businessSetupWelcomeState
export const businessSetupWelcomeState = atom<BusinessSetupWelcomeState | null>({
  key: 'businessSetupWelcomeState',
  default: null,
});

// businessAnalysisState
export const businessAnalysisState = atom<BusinessAnalysisResult | null>({
  key: 'businessAnalysisState',
  default: null,
});

// salesFunnelState
export const salesFunnelState = atom<SalesFunnelDesign | null>({
  key: 'salesFunnelState',
  default: null,
});

// agentSetupState
export const agentSetupState = atom<AgentSetupResult | null>({
  key: 'agentSetupState',
  default: null,
});

// workflowCreationState
export const workflowCreationState = atom<WorkflowGenerationResult | null>({
  key: 'workflowCreationState',
  default: null,
});

// teamAssignmentState
export const teamAssignmentState = atom<TeamAssignmentResult | null>({
  key: 'teamAssignmentState',
  default: null,
});

// testingOptimizationState
export const testingOptimizationState = atom<TestingOptimizationResult | null>({
  key: 'testingOptimizationState',
  default: null,
});

// Business Setup Hooks
export const useBusinessSetupStatus = (): BusinessSetupStatus | null | undefined => {
  const currentUser = useRecoilValue(currentUserState);
  const isLoggedIn = useIsLogged();
  return isLoggedIn ? currentUser?.businessSetupStatus : undefined;
};

export const useSetNextBusinessSetupStatus = () => {
  const setCurrentUser = useSetRecoilState(currentUserState);
  const businessSetupStatus = useBusinessSetupStatus();
  const businessAnalysisResult = useRecoilValue(businessAnalysisState);
  const salesFunnelDesign = useRecoilValue(salesFunnelState);
  const agentSetupResult = useRecoilValue(agentSetupState);
  const workflowCreationResult = useRecoilValue(workflowCreationState);
  const teamAssignmentResult = useRecoilValue(teamAssignmentState);
  const testingOptimizationResult = useRecoilValue(testingOptimizationState);

  const getNextBusinessSetupStatus = (): BusinessSetupStatus => {
    if (businessSetupStatus === BusinessSetupStatus.WELCOME) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (businessSetupStatus === BusinessSetupStatus.SUBSCRIPTION_REQUIRED) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS && businessAnalysisResult) {
      return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    }

    if (businessSetupStatus === BusinessSetupStatus.SALES_FUNNEL_DESIGN && salesFunnelDesign) {
      return BusinessSetupStatus.AGENT_SETUP;
    }

    if (businessSetupStatus === BusinessSetupStatus.AGENT_SETUP && agentSetupResult) {
      return BusinessSetupStatus.WORKFLOW_CREATION;
    }

    if (businessSetupStatus === BusinessSetupStatus.WORKFLOW_CREATION && workflowCreationResult) {
      return BusinessSetupStatus.TEAM_ASSIGNMENT;
    }

    if (businessSetupStatus === BusinessSetupStatus.TEAM_ASSIGNMENT && teamAssignmentResult) {
      return BusinessSetupStatus.TESTING_OPTIMIZATION;
    }

    if (businessSetupStatus === BusinessSetupStatus.TESTING_OPTIMIZATION && testingOptimizationResult) {
      return BusinessSetupStatus.COMPLETED;
    }

    return BusinessSetupStatus.COMPLETED;
  };

  const setNextBusinessSetupStatus = useCallback(async () => {
    const nextStatus = getNextBusinessSetupStatus();
    
    if (nextStatus !== businessSetupStatus) {
      try {
        await setBusinessSetupStatusMutation({
          variables: {
            status: nextStatus,
          },
        });

        setCurrentUser((prev) => 
          prev ? { ...prev, businessSetupStatus: nextStatus } : null
        );
      } catch (error) {
        console.error('Failed to set next business setup status:', error);
      }
    }
  }, [businessSetupStatus, getNextBusinessSetupStatus, setCurrentUser]);

  return { setNextBusinessSetupStatus, getNextBusinessSetupStatus };
};
```

---

## 12. Тестирование и качество кода

### Тестирование стратегия:
- Unit tests для сервисов
- Integration tests для API
- E2E tests для Business Setup flow
- Component tests для UI
- Performance tests для AI агентов

### Code quality:
- ESLint rules для консистентности
- Prettier для форматирования
- TypeScript strict mode
- GraphQL code generation

---

## 13. Масштабируемость и расширяемость

### Горизонтальное масштабирование:
- Stateless сервисы
- Database connection pooling
- Redis для кэширования
- Load balancing ready

### Вертикальное масштабирование:
- Модульная архитектура
- Feature flags для постепенного rollout
- A/B testing infrastructure
- Monitoring и alerting

### Расширяемость:
- Plugin architecture для новых интеграций
- Configurable Business Setup steps
- Custom workspace templates
- Multi-tenant support

---

## 14. Архитектурные паттерны и принципы

### Паттерны проектирования:
- **State Machine Pattern**: BusinessSetupStatus как конечный автомат
- **Observer Pattern**: Автоматическая навигация через useBusinessSetupPageChangeEffectNavigateLocation
- **Factory Pattern**: AgentOrchestrationService для создания агентов
- **Strategy Pattern**: Различные стратегии для разных отраслей
- **Repository Pattern**: BusinessSetupVarsService для работы с состоянием
- **Service Layer Pattern**: BusinessSetupService как центральный сервис

### Принципы SOLID:
- **Single Responsibility**: Каждый сервис отвечает за одну область
- **Open/Closed**: Система открыта для расширения, закрыта для модификации
- **Liskov Substitution**: Возможность замены реализаций агентов
- **Interface Segregation**: Тонкие интерфейсы для конкретных задач
- **Dependency Inversion**: Зависимость от абстракций, а не от конкретных классов

### Архитектурные принципы:
- **Separation of Concerns**: Четкое разделение ответственности
- **Don't Repeat Yourself (DRY)**: Переиспользование кода
- **Keep It Simple, Stupid (KISS)**: Простота решений
- **You Aren't Gonna Need It (YAGNI)**: Не добавлять функционал заранее

---

## 15. Детальный анализ кодовой базы

### Backend архитектура (NestJS):

#### BusinessSetupService - центральный сервис:
```typescript
@Injectable()
export class BusinessSetupService {
  constructor(
    private readonly businessSetupVarsService: BusinessSetupVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly businessAnalysisAgent: BusinessAnalysisAgent,
    private readonly funnelDesignerAgent: FunnelDesignerAgent,
    private readonly agentOrchestrationService: AgentOrchestrationService,
    private readonly workflowGeneratorAgent: WorkflowGeneratorAgent,
    private readonly billingService: BillingService,
    private readonly workspaceService: WorkspaceService,
    private readonly userService: UserService,
    private readonly logger: Logger,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
  ) {}

  async getBusinessSetupStatus(user: User, workspace: Workspace): Promise<BusinessSetupStatus> {
    // Проверка подписки
    if (await this.billingService.isSubscriptionIncompleteBusinessSetup(workspace.id)) {
      return BusinessSetupStatus.SUBSCRIPTION_REQUIRED;
    }

    // Проверка workspace активации
    if (workspace.activationStatus !== WorkspaceActivationStatus.ACTIVE) {
      return BusinessSetupStatus.WORKSPACE_NOT_ACTIVE;
    }

    // Получение состояния из BusinessSetupVars с кэшированием
    const cacheKey = `business_setup_status:${user.id}:${workspace.id}`;
    const cachedStatus = await this.cacheService.get<BusinessSetupStatus>(cacheKey);
    
    if (cachedStatus) {
      return cachedStatus;
    }

    const userVars = await this.businessSetupVarsService.getAll({
      userId: user.id,
      workspaceId: workspace.id,
    });

    // Логика определения следующего шага
    const isWelcomePending = userVars.get(BusinessSetupStepKeys.WELCOME_PENDING) === true;
    const isBusinessAnalysisPending = userVars.get(BusinessSetupStepKeys.BUSINESS_ANALYSIS_PENDING) === true;
    const isSalesFunnelDesignPending = userVars.get(BusinessSetupStepKeys.SALES_FUNNEL_DESIGN_PENDING) === true;
    const isAgentSetupPending = userVars.get(BusinessSetupStepKeys.AGENT_SETUP_PENDING) === true;
    const isWorkflowCreationPending = userVars.get(BusinessSetupStepKeys.WORKFLOW_CREATION_PENDING) === true;
    const isTeamAssignmentPending = userVars.get(BusinessSetupStepKeys.TEAM_ASSIGNMENT_PENDING) === true;
    const isTestingOptimizationPending = userVars.get(BusinessSetupStepKeys.TESTING_OPTIMIZATION_PENDING) === true;

    let status: BusinessSetupStatus;
    
    if (isWelcomePending) status = BusinessSetupStatus.WELCOME;
    else if (isBusinessAnalysisPending) status = BusinessSetupStatus.BUSINESS_ANALYSIS;
    else if (isSalesFunnelDesignPending) status = BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    else if (isAgentSetupPending) status = BusinessSetupStatus.AGENT_SETUP;
    else if (isWorkflowCreationPending) status = BusinessSetupStatus.WORKFLOW_CREATION;
    else if (isTeamAssignmentPending) status = BusinessSetupStatus.TEAM_ASSIGNMENT;
    else if (isTestingOptimizationPending) status = BusinessSetupStatus.TESTING_OPTIMIZATION;
    else status = BusinessSetupStatus.COMPLETED;

    // Кэширование результата на 5 минут
    await this.cacheService.set(cacheKey, status, 300);
    
    return status;
  }

  async executeBusinessAnalysis(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult> {
    const startTime = performance.now();
    
    try {
      // Валидация входных данных
      await this.validateBusinessAnalysisInput(input);
      
      // Проверка лимитов и rate limiting
      await this.checkBusinessSetupLimits(input.userId, input.workspaceId);
      
      // Проверка подписки
      await this.verifyBusinessSetupEligibility(input.workspaceId);
      
      // Выполнение анализа с retry логикой
      const result = await this.executeWithRetry(
        () => this.businessAnalysisAgent.execute(input),
        {
          maxRetries: 3,
          backoff: 'exponential',
          retryCondition: (error) => this.shouldRetryBusinessAnalysis(error)
        }
      );
      
      // Сохранение результата
      await this.saveBusinessAnalysisResult(input.userId, input.workspaceId, result);
      
      // Переход к следующему шагу
      await this.setNextBusinessSetupStatus(input.userId, input.workspaceId, BusinessSetupStatus.SALES_FUNNEL_DESIGN);
      
      // Метрики
      const executionTime = performance.now() - startTime;
      await this.metricsService.track('business_setup_analysis_completed', {
        userId: input.userId,
        workspaceId: input.workspaceId,
        executionTime,
        industry: input.industry,
        companySize: input.companySize,
      });
      
      return result;
    } catch (error) {
      await this.handleBusinessSetupError(error, {
        step: BusinessSetupStatus.BUSINESS_ANALYSIS,
        userId: input.userId,
        workspaceId: input.workspaceId,
        input
      });
      throw error;
    }
  }

  async executeFunnelDesign(input: FunnelDesignInput): Promise<SalesFunnelDesign> {
    const startTime = performance.now();
    
    try {
      // Получение результатов анализа бизнеса
      const businessAnalysis = await this.getBusinessAnalysisResult(input.userId, input.workspaceId);
      
      if (!businessAnalysis) {
        throw new BusinessSetupException(
          'Business analysis not found. Please complete business analysis first.',
          BusinessSetupExceptionCode.BUSINESS_ANALYSIS_REQUIRED
        );
      }
      
      // Выполнение дизайна воронки
      const result = await this.executeWithRetry(
        () => this.funnelDesignerAgent.execute({
          ...input,
          businessAnalysis
        }),
        {
          maxRetries: 3,
          backoff: 'exponential'
        }
      );
      
      // Сохранение результата
      await this.saveSalesFunnelDesign(input.userId, input.workspaceId, result);
      
      // Переход к следующему шагу
      await this.setNextBusinessSetupStatus(input.userId, input.workspaceId, BusinessSetupStatus.AGENT_SETUP);
      
      // Метрики
      const executionTime = performance.now() - startTime;
      await this.metricsService.track('business_setup_funnel_design_completed', {
        userId: input.userId,
        workspaceId: input.workspaceId,
        executionTime,
        stagesCount: result.stages.length,
      });
      
      return result;
    } catch (error) {
      await this.handleBusinessSetupError(error, {
        step: BusinessSetupStatus.SALES_FUNNEL_DESIGN,
        userId: input.userId,
        workspaceId: input.workspaceId,
        input
      });
      throw error;
    }
  }

  private async validateBusinessAnalysisInput(input: BusinessAnalysisInput): Promise<void> {
    const errors: string[] = [];
    
    if (!input.industry || input.industry.trim().length === 0) {
      errors.push('Industry is required');
    }
    
    if (!input.businessModel || input.businessModel.trim().length === 0) {
      errors.push('Business model is required');
    }
    
    if (!input.targetMarket || input.targetMarket.trim().length === 0) {
      errors.push('Target market is required');
    }
    
    if (input.annualRevenue <= 0) {
      errors.push('Annual revenue must be positive');
    }
    
    if (input.employeeCount <= 0) {
      errors.push('Employee count must be positive');
    }
    
    if (errors.length > 0) {
      throw new BusinessSetupException(
        `Validation failed: ${errors.join(', ')}`,
        BusinessSetupExceptionCode.VALIDATION_ERROR
      );
    }
  }

  private async checkBusinessSetupLimits(userId: string, workspaceId: string): Promise<void> {
    const key = `business_setup_limits:${userId}:${workspaceId}`;
    const currentCount = await this.cacheService.get<number>(key) || 0;
    
    if (currentCount >= 10) { // Максимум 10 попыток в час
      throw new BusinessSetupException(
        'Rate limit exceeded. Please try again later.',
        BusinessSetupExceptionCode.RATE_LIMIT_EXCEEDED
      );
    }
    
    await this.cacheService.set(key, currentCount + 1, 3600); // 1 час
  }

  private async verifyBusinessSetupEligibility(workspaceId: string): Promise<void> {
    const subscription = await this.billingService.getSubscription(workspaceId);
    
    if (!subscription || subscription.status !== 'active') {
      throw new BusinessSetupException(
        'Active subscription required for Business Setup',
        BusinessSetupExceptionCode.SUBSCRIPTION_REQUIRED
      );
    }
    
    if (subscription.plan === 'FREE') {
      throw new BusinessSetupException(
        'Business Setup requires PRO or ENTERPRISE plan',
        BusinessSetupExceptionCode.INSUFFICIENT_PLAN
      );
    }
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: { maxRetries: number; backoff: 'exponential' | 'linear'; retryCondition?: (error: Error) => boolean }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Проверяем, нужно ли повторять
        if (options.retryCondition && !options.retryCondition(lastError)) {
          throw lastError;
        }
        
        if (attempt === options.maxRetries) {
          throw new BusinessSetupException(
            `Operation failed after ${options.maxRetries} attempts: ${lastError.message}`,
            BusinessSetupExceptionCode.MAX_RETRIES_EXCEEDED
          );
        }
        
        // Exponential backoff
        const delay = options.backoff === 'exponential' 
          ? Math.pow(2, attempt) * 1000 
          : attempt * 1000;
        
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }

  private async handleBusinessSetupError(
    error: Error, 
    context: { step: BusinessSetupStatus; userId: string; workspaceId: string; input?: any }
  ): Promise<void> {
    // Логирование ошибки
    this.logger.error('Business Setup Error', {
      step: context.step,
      userId: context.userId,
      workspaceId: context.workspaceId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Метрики ошибок
    await this.metricsService.track('business_setup_error', {
      step: context.step,
      userId: context.userId,
      workspaceId: context.workspaceId,
      errorType: error.constructor.name,
      errorMessage: error.message,
    });
    
    // Fallback механизм
    if (error instanceof AIServiceUnavailableError) {
      await this.useFallbackAnalysis(context);
    }
    
    // Уведомление пользователя
    await this.notifyUserOfError(context.userId, error, context.step);
    
    // Сохранение ошибки в базу для анализа
    await this.saveBusinessSetupError(context, error);
  }

  private async setNextBusinessSetupStatus(
    userId: string, 
    workspaceId: string, 
    nextStatus: BusinessSetupStatus
  ): Promise<void> {
    // Очистка текущего статуса
    await this.businessSetupVarsService.set({
      userId,
      workspaceId,
      key: this.getCurrentStepKey(nextStatus),
      value: false,
    });
    
    // Установка следующего статуса
    await this.businessSetupVarsService.set({
      userId,
      workspaceId,
      key: this.getNextStepKey(nextStatus),
      value: true,
    });
    
    // Очистка кэша
    await this.cacheService.delete(`business_setup_status:${userId}:${workspaceId}`);
  }

  private getCurrentStepKey(status: BusinessSetupStatus): BusinessSetupStepKeys {
    const stepMap = {
      [BusinessSetupStatus.WELCOME]: BusinessSetupStepKeys.WELCOME_PENDING,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: BusinessSetupStepKeys.BUSINESS_ANALYSIS_PENDING,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: BusinessSetupStepKeys.SALES_FUNNEL_DESIGN_PENDING,
      [BusinessSetupStatus.AGENT_SETUP]: BusinessSetupStepKeys.AGENT_SETUP_PENDING,
      [BusinessSetupStatus.WORKFLOW_CREATION]: BusinessSetupStepKeys.WORKFLOW_CREATION_PENDING,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: BusinessSetupStepKeys.TEAM_ASSIGNMENT_PENDING,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: BusinessSetupStepKeys.TESTING_OPTIMIZATION_PENDING,
    };
    
    return stepMap[status];
  }

  private getNextStepKey(status: BusinessSetupStatus): BusinessSetupStepKeys {
    const nextStepMap = {
      [BusinessSetupStatus.WELCOME]: BusinessSetupStepKeys.BUSINESS_ANALYSIS_PENDING,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: BusinessSetupStepKeys.SALES_FUNNEL_DESIGN_PENDING,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: BusinessSetupStepKeys.AGENT_SETUP_PENDING,
      [BusinessSetupStatus.AGENT_SETUP]: BusinessSetupStepKeys.WORKFLOW_CREATION_PENDING,
      [BusinessSetupStatus.WORKFLOW_CREATION]: BusinessSetupStepKeys.TEAM_ASSIGNMENT_PENDING,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: BusinessSetupStepKeys.TESTING_OPTIMIZATION_PENDING,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: BusinessSetupStepKeys.COMPLETED,
    };
    
    return nextStepMap[status];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### BusinessSetupResolver - GraphQL мутации:
```typescript
@Resolver()
export class BusinessSetupResolver {
  constructor(private readonly businessSetupService: BusinessSetupService) {}

  @Mutation(() => BusinessAnalysisResult)
  async executeBusinessAnalysis(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: BusinessAnalysisInput,
  ): Promise<BusinessAnalysisResult> {
    return await this.businessSetupService.executeBusinessAnalysis({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Mutation(() => SalesFunnelDesign)
  async designSalesFunnel(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: FunnelDesignInput,
  ): Promise<SalesFunnelDesign> {
    return await this.businessSetupService.executeFunnelDesign({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Mutation(() => AgentSetupResult)
  async setupAgents(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: AgentSetupInput,
  ): Promise<AgentSetupResult> {
    return await this.businessSetupService.executeAgentSetup({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Mutation(() => WorkflowGenerationResult)
  async generateWorkflows(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: WorkflowGenerationInput,
  ): Promise<WorkflowGenerationResult> {
    return await this.businessSetupService.executeWorkflowGeneration({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Mutation(() => TeamAssignmentResult)
  async assignTeam(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: TeamAssignmentInput,
  ): Promise<TeamAssignmentResult> {
    return await this.businessSetupService.executeTeamAssignment({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Mutation(() => TestingOptimizationResult)
  async testAndOptimize(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('input') input: TestingOptimizationInput,
  ): Promise<TestingOptimizationResult> {
    return await this.businessSetupService.executeTestingOptimization({
      ...input,
      userId: user.id,
      workspaceId: workspace.id,
    });
  }

  @Query(() => BusinessSetupStatus)
  async getBusinessSetupStatus(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<BusinessSetupStatus> {
    return await this.businessSetupService.getBusinessSetupStatus(user, workspace);
  }

  @Query(() => BusinessAnalysisResult, { nullable: true })
  async getBusinessAnalysisResult(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<BusinessAnalysisResult | null> {
    return await this.businessSetupService.getBusinessAnalysisResult(user.id, workspace.id);
  }

  @Query(() => SalesFunnelDesign, { nullable: true })
  async getSalesFunnelDesign(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<SalesFunnelDesign | null> {
    return await this.businessSetupService.getSalesFunnelDesign(user.id, workspace.id);
  }
}
```

### Frontend архитектура (React + Recoil):

#### useBusinessSetupStatus - хук для получения статуса:
```typescript
export const useBusinessSetupStatus = (): BusinessSetupStatus | null | undefined => {
  const currentUser = useRecoilValue(currentUserState);
  const isLoggedIn = useIsLogged();
  return isLoggedIn ? currentUser?.businessSetupStatus : undefined;
};
```

#### useSetNextBusinessSetupStatus - логика переходов:
```typescript
  const getNextBusinessSetupStatus = (
    currentUser: CurrentUser | null,
    businessAnalysisResult: BusinessAnalysisResult | null,
    salesFunnelDesign: SalesFunnelDesign | null,
    agentSetupResult: AgentSetupResult | null,
    workflowCreationResult: WorkflowGenerationResult | null,
    teamAssignmentResult: TeamAssignmentResult | null,
    testingOptimizationResult: TestingOptimizationResult | null,
  ) => {
    if (currentUser?.businessSetupStatus === BusinessSetupStatus.WELCOME) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (currentUser?.businessSetupStatus === BusinessSetupStatus.WORKSPACE_NOT_ACTIVE) {
      return BusinessSetupStatus.BUSINESS_ANALYSIS;
    }

    if (currentUser?.businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS && businessAnalysisResult) {
      return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.SALES_FUNNEL_DESIGN && salesFunnelDesign) {
    return BusinessSetupStatus.AGENT_SETUP;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.AGENT_SETUP && agentSetupResult) {
    return BusinessSetupStatus.WORKFLOW_CREATION;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.WORKFLOW_CREATION && workflowCreationResult) {
    return BusinessSetupStatus.TEAM_ASSIGNMENT;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.TEAM_ASSIGNMENT && teamAssignmentResult) {
    return BusinessSetupStatus.TESTING_OPTIMIZATION;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.TESTING_OPTIMIZATION && testingOptimizationResult) {
    return BusinessSetupStatus.COMPLETED;
  }

  return BusinessSetupStatus.COMPLETED;
};
```

#### useBusinessSetupPageChangeEffectNavigateLocation - автоматическая навигация:
```typescript
export const useBusinessSetupPageChangeEffectNavigateLocation = () => {
  const isLoggedIn = useIsLogged();
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const businessSetupStatus = useBusinessSetupStatus();
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusEqualsTo(
    WorkspaceActivationStatus.SUSPENDED,
  );

  const businessSetupPaths = [
    AppPath.BusinessSetupSubscription,
    AppPath.BusinessAnalysis,
    AppPath.SalesFunnelDesign,
    AppPath.AgentSetup,
    AppPath.WorkflowCreation,
    AppPath.TeamAssignment,
    AppPath.TestingOptimization,
    AppPath.BusinessSetupCompleted,
  ];

  // Логика редиректов на основе статуса
  if (businessSetupStatus === BusinessSetupStatus.WELCOME && 
      !someMatchingLocationOf([AppPath.BusinessSetupWelcome])) {
    return AppPath.BusinessSetupWelcome;
  }

  if (businessSetupStatus === BusinessSetupStatus.SUBSCRIPTION_REQUIRED && 
      !someMatchingLocationOf([AppPath.BusinessSetupSubscription])) {
    return AppPath.BusinessSetupSubscription;
  }

  if (businessSetupStatus === BusinessSetupStatus.WORKSPACE_NOT_ACTIVE) {
    return AppPath.CreateWorkspace;
  }

  if (businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS && 
      !someMatchingLocationOf([AppPath.BusinessAnalysis])) {
    return AppPath.BusinessAnalysis;
  }

  if (businessSetupStatus === BusinessSetupStatus.SALES_FUNNEL_DESIGN && 
      !someMatchingLocationOf([AppPath.SalesFunnelDesign])) {
    return AppPath.SalesFunnelDesign;
  }

  if (businessSetupStatus === BusinessSetupStatus.AGENT_SETUP && 
      !someMatchingLocationOf([AppPath.AgentSetup])) {
    return AppPath.AgentSetup;
  }

  if (businessSetupStatus === BusinessSetupStatus.WORKFLOW_CREATION && 
      !someMatchingLocationOf([AppPath.WorkflowCreation])) {
    return AppPath.WorkflowCreation;
  }

  if (businessSetupStatus === BusinessSetupStatus.TEAM_ASSIGNMENT && 
      !someMatchingLocationOf([AppPath.TeamAssignment])) {
    return AppPath.TeamAssignment;
  }

  if (businessSetupStatus === BusinessSetupStatus.TESTING_OPTIMIZATION && 
      !someMatchingLocationOf([AppPath.TestingOptimization])) {
    return AppPath.TestingOptimization;
  }

  if (businessSetupStatus === BusinessSetupStatus.COMPLETED && 
      !someMatchingLocationOf([AppPath.BusinessSetupCompleted])) {
    return AppPath.BusinessSetupCompleted;
  }

  return null;
};
```

### Тестирование:

#### Unit тесты для сервисов:
```typescript
describe('BusinessSetupService', () => {
  let service: BusinessSetupService;
  let mockBusinessSetupVarsService: jest.Mocked<BusinessSetupVarsService>;
  let mockBusinessAnalysisAgent: jest.Mocked<BusinessAnalysisAgent>;
  let mockBillingService: jest.Mocked<BillingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupService,
        {
          provide: BusinessSetupVarsService,
          useValue: {
            getAll: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: BusinessAnalysisAgent,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: BillingService,
          useValue: {
            isSubscriptionIncompleteBusinessSetup: jest.fn(),
            getSubscription: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BusinessSetupService>(BusinessSetupService);
    mockBusinessSetupVarsService = module.get(BusinessSetupVarsService);
    mockBusinessAnalysisAgent = module.get(BusinessAnalysisAgent);
    mockBillingService = module.get(BillingService);
  });

  describe('getBusinessSetupStatus', () => {
    it('should return SUBSCRIPTION_REQUIRED when subscription is incomplete', async () => {
      const user = { id: 'user-1' } as User;
      const workspace = { id: 'workspace-1' } as Workspace;

      mockBillingService.isSubscriptionIncompleteBusinessSetup.mockResolvedValue(true);

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.SUBSCRIPTION_REQUIRED);
    });

    it('should return BUSINESS_ANALYSIS when business analysis is pending', async () => {
      const user = { id: 'user-1' } as User;
      const workspace = { id: 'workspace-1', activationStatus: WorkspaceActivationStatus.ACTIVE } as Workspace;

      mockBillingService.isSubscriptionIncompleteBusinessSetup.mockResolvedValue(false);
      mockBusinessSetupVarsService.getAll.mockResolvedValue(
        new Map([[BusinessSetupStepKeys.BUSINESS_ANALYSIS_PENDING, true]])
      );

      const result = await service.getBusinessSetupStatus(user, workspace);

      expect(result).toBe(BusinessSetupStatus.BUSINESS_ANALYSIS);
    });
  });

  describe('executeBusinessAnalysis', () => {
    it('should execute business analysis successfully', async () => {
      const input: BusinessAnalysisInput = {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        industry: 'technology',
        companySize: 'startup',
        businessModel: 'saas',
        annualRevenue: 100000,
        employeeCount: 10,
        targetMarket: 'small businesses',
      };

      const expectedResult: BusinessAnalysisResult = {
        industryAnalysis: { trends: ['AI adoption'] },
        processMapping: { processes: ['lead generation'] },
        funnelRecommendations: { stages: ['awareness', 'consideration'] },
        recommendedAgents: ['lead-qualification'],
        estimatedSetupTime: 30,
      };

      mockBusinessAnalysisAgent.execute.mockResolvedValue(expectedResult);

      const result = await service.executeBusinessAnalysis(input);

      expect(result).toEqual(expectedResult);
      expect(mockBusinessAnalysisAgent.execute).toHaveBeenCalledWith(input);
    });

    it('should throw validation error for invalid input', async () => {
      const input: BusinessAnalysisInput = {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        industry: '',
        companySize: 'startup',
        businessModel: '',
        annualRevenue: -1000,
        employeeCount: 0,
        targetMarket: '',
      };

      await expect(service.executeBusinessAnalysis(input)).rejects.toThrow(
        'Validation failed: Industry is required, Business model is required, Target market is required, Annual revenue must be positive, Employee count must be positive'
      );
    });
  });
});
```

#### E2E тесты для Business Setup flow:
```typescript
describe('Business Setup Wizard E2E', () => {
  beforeEach(async () => {
    await page.goto('/');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="sign-in-button"]');
  });

  it('should complete full business setup flow', async () => {
    // Начинаем с проверки подписки
    await expect(page).toHaveURL('/business-setup/subscription');
    await page.click('[data-testid="upgrade-to-pro"]');
    
    // Заполняем форму анализа бизнеса
    await expect(page).toHaveURL('/business-setup/analysis');
    await page.fill('[data-testid="industry"]', 'technology');
    await page.fill('[data-testid="company-size"]', 'startup');
    await page.fill('[data-testid="business-model"]', 'saas');
    await page.fill('[data-testid="annual-revenue"]', '100000');
    await page.fill('[data-testid="employee-count"]', '10');
    await page.fill('[data-testid="target-market"]', 'small businesses');
    await page.click('[data-testid="analyze-business"]');
    
    // Ждем завершения анализа
    await page.waitForSelector('[data-testid="analysis-complete"]');
    
    // Переходим к дизайну воронки
    await expect(page).toHaveURL('/business-setup/funnel-design');
    await page.click('[data-testid="generate-funnel"]');
    
    // Ждем генерации воронки
    await page.waitForSelector('[data-testid="funnel-generated"]');
    
    // Переходим к настройке агентов
    await expect(page).toHaveURL('/business-setup/agent-setup');
    await page.click('[data-testid="setup-agents"]');
    
    // Ждем настройки агентов
    await page.waitForSelector('[data-testid="agents-configured"]');
    
    // Переходим к созданию workflow
    await expect(page).toHaveURL('/business-setup/workflow-creation');
    await page.click('[data-testid="generate-workflows"]');
    
    // Ждем создания workflow
    await page.waitForSelector('[data-testid="workflows-created"]');
    
    // Переходим к назначению команды
    await expect(page).toHaveURL('/business-setup/team-assignment');
    await page.click('[data-testid="assign-team"]');
    
    // Ждем назначения команды
    await page.waitForSelector('[data-testid="team-assigned"]');
    
    // Переходим к тестированию и оптимизации
    await expect(page).toHaveURL('/business-setup/testing-optimization');
    await page.click('[data-testid="start-testing"]');
    
    // Ждем завершения тестирования
    await page.waitForSelector('[data-testid="testing-complete"]');
    
    // Проверяем завершение Business Setup
    await expect(page).toHaveURL('/business-setup/completed');
    await expect(page.locator('[data-testid="setup-complete-message"]')).toBeVisible();
  });

  it('should handle errors gracefully', async () => {
    await page.goto('/business-setup/analysis');
    
    // Пытаемся отправить пустую форму
    await page.click('[data-testid="analyze-business"]');
    
    // Проверяем отображение ошибок валидации
    await expect(page.locator('[data-testid="industry-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="business-model-error"]')).toBeVisible();
  });

  it('should allow skipping optional steps', async () => {
    await page.goto('/business-setup/team-assignment');
    
    // Пропускаем назначение команды
    await page.click('[data-testid="skip-team-assignment"]');
    
    // Переходим к следующему шагу
    await expect(page).toHaveURL('/business-setup/testing-optimization');
  });
});
```

#### Component тесты для UI:
```typescript
describe('BusinessAnalysis Component', () => {
  const mockExecuteBusinessAnalysis = jest.fn();
  const mockSetNextBusinessSetupStatus = jest.fn();

  beforeEach(() => {
    mockExecuteBusinessAnalysis.mockClear();
    mockSetNextBusinessSetupStatus.mockClear();
  });

  it('should render business analysis form', () => {
    render(
      <BusinessAnalysis
        executeBusinessAnalysis={mockExecuteBusinessAnalysis}
        setNextBusinessSetupStatus={mockSetNextBusinessSetupStatus}
      />
    );

    expect(screen.getByLabelText('Industry')).toBeInTheDocument();
    expect(screen.getByLabelText('Company Size')).toBeInTheDocument();
    expect(screen.getByLabelText('Business Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Annual Revenue')).toBeInTheDocument();
    expect(screen.getByLabelText('Employee Count')).toBeInTheDocument();
    expect(screen.getByLabelText('Target Market')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze Business' })).toBeInTheDocument();
  });

  it('should validate form inputs', async () => {
    render(
      <BusinessAnalysis
        executeBusinessAnalysis={mockExecuteBusinessAnalysis}
        setNextBusinessSetupStatus={mockSetNextBusinessSetupStatus}
      />
    );

    const analyzeButton = screen.getByRole('button', { name: 'Analyze Business' });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Industry is required')).toBeInTheDocument();
      expect(screen.getByText('Business model is required')).toBeInTheDocument();
      expect(screen.getByText('Target market is required')).toBeInTheDocument();
    });

    expect(mockExecuteBusinessAnalysis).not.toHaveBeenCalled();
  });

  it('should submit form with valid data', async () => {
    const mockResult: BusinessAnalysisResult = {
      industryAnalysis: { trends: ['AI adoption'] },
      processMapping: { processes: ['lead generation'] },
      funnelRecommendations: { stages: ['awareness', 'consideration'] },
      recommendedAgents: ['lead-qualification'],
      estimatedSetupTime: 30,
    };

    mockExecuteBusinessAnalysis.mockResolvedValue(mockResult);

    render(
      <BusinessAnalysis
        executeBusinessAnalysis={mockExecuteBusinessAnalysis}
        setNextBusinessSetupStatus={mockSetNextBusinessSetupStatus}
      />
    );

    // Заполняем форму
    fireEvent.change(screen.getByLabelText('Industry'), {
      target: { value: 'technology' },
    });
    fireEvent.change(screen.getByLabelText('Company Size'), {
      target: { value: 'startup' },
    });
    fireEvent.change(screen.getByLabelText('Business Model'), {
      target: { value: 'saas' },
    });
    fireEvent.change(screen.getByLabelText('Annual Revenue'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByLabelText('Employee Count'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Target Market'), {
      target: { value: 'small businesses' },
    });

    const analyzeButton = screen.getByRole('button', { name: 'Analyze Business' });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(mockExecuteBusinessAnalysis).toHaveBeenCalledWith({
        industry: 'technology',
        companySize: 'startup',
        businessModel: 'saas',
        annualRevenue: 100000,
        employeeCount: 10,
        targetMarket: 'small businesses',
      });
    });

    await waitFor(() => {
      expect(mockSetNextBusinessSetupStatus).toHaveBeenCalled();
    });
  });

  it('should show loading state during analysis', async () => {
    mockExecuteBusinessAnalysis.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <BusinessAnalysis
        executeBusinessAnalysis={mockExecuteBusinessAnalysis}
        setNextBusinessSetupStatus={mockSetNextBusinessSetupStatus}
      />
    );

    // Заполняем форму
    fireEvent.change(screen.getByLabelText('Industry'), {
      target: { value: 'technology' },
    });
    fireEvent.change(screen.getByLabelText('Company Size'), {
      target: { value: 'startup' },
    });
    fireEvent.change(screen.getByLabelText('Business Model'), {
      target: { value: 'saas' },
    });
    fireEvent.change(screen.getByLabelText('Annual Revenue'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByLabelText('Employee Count'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Target Market'), {
      target: { value: 'small businesses' },
    });

    const analyzeButton = screen.getByRole('button', { name: 'Analyze Business' });
    fireEvent.click(analyzeButton);

    // Проверяем состояние загрузки
    expect(screen.getByText('Analyzing your business...')).toBeInTheDocument();
    expect(analyzeButton).toBeDisabled();
  });

  it('should handle analysis errors', async () => {
    const error = new Error('Analysis failed');
    mockExecuteBusinessAnalysis.mockRejectedValue(error);

    render(
      <BusinessAnalysis
        executeBusinessAnalysis={mockExecuteBusinessAnalysis}
        setNextBusinessSetupStatus={mockSetNextBusinessSetupStatus}
      />
    );

    // Заполняем форму
    fireEvent.change(screen.getByLabelText('Industry'), {
      target: { value: 'technology' },
    });
    fireEvent.change(screen.getByLabelText('Company Size'), {
      target: { value: 'startup' },
    });
    fireEvent.change(screen.getByLabelText('Business Model'), {
      target: { value: 'saas' },
    });
    fireEvent.change(screen.getByLabelText('Annual Revenue'), {
      target: { value: '100000' },
    });
    fireEvent.change(screen.getByLabelText('Employee Count'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Target Market'), {
      target: { value: 'small businesses' },
    });

    const analyzeButton = screen.getByRole('button', { name: 'Analyze Business' });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });

    expect(mockSetNextBusinessSetupStatus).not.toHaveBeenCalled();
  });
});
```

### Performance тесты:
```typescript
describe('Business Setup Performance Tests', () => {
  it('should complete business analysis within 30 seconds', async () => {
    const startTime = performance.now();
    
    // Выполняем анализ бизнеса
    const result = await businessSetupService.executeBusinessAnalysis({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      industry: 'technology',
      companySize: 'startup',
      businessModel: 'saas',
      annualRevenue: 100000,
      employeeCount: 10,
      targetMarket: 'small businesses',
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(30000); // 30 секунд
    expect(result).toBeDefined();
  });

  it('should handle concurrent business setup requests', async () => {
    const concurrentRequests = 10;
    const promises = [];
    
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        businessSetupService.executeBusinessAnalysis({
          userId: `user-${i}`,
          workspaceId: `workspace-${i}`,
          industry: 'technology',
          companySize: 'startup',
          businessModel: 'saas',
          annualRevenue: 100000,
          employeeCount: 10,
          targetMarket: 'small businesses',
        })
      );
    }
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(concurrentRequests);
    results.forEach(result => {
      expect(result).toBeDefined();
    });
  });

  it('should cache business setup status efficiently', async () => {
    const user = { id: 'user-1' } as User;
    const workspace = { id: 'workspace-1', activationStatus: WorkspaceActivationStatus.ACTIVE } as Workspace;
    
    // Первый запрос
    const startTime1 = performance.now();
    const status1 = await businessSetupService.getBusinessSetupStatus(user, workspace);
    const endTime1 = performance.now();
    const time1 = endTime1 - startTime1;
    
    // Второй запрос (должен быть из кэша)
    const startTime2 = performance.now();
    const status2 = await businessSetupService.getBusinessSetupStatus(user, workspace);
    const endTime2 = performance.now();
    const time2 = endTime2 - startTime2;
    
    expect(status1).toEqual(status2);
    expect(time2).toBeLessThan(time1 * 0.1); // Кэшированный запрос должен быть в 10 раз быстрее
  });
});
```

---

## 23. Интеграция с Floating AI Chat Button

### Обзор интеграции
Интеграция Business Setup Wizard с Floating AI Chat Button создает уникальный пользовательский опыт, где AI бот становится персональным помощником на каждом этапе настройки бизнеса.

### Архитектура интеграции

#### useBusinessSetupAIChat - хук для Business Setup AI
```typescript
export const useBusinessSetupAIChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  
  const isWelcomeActive = businessSetupStatus === BusinessSetupStatus.WELCOME;
  const isBusinessAnalysisActive = businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS;

  const getWelcomeMessage = (): string => {
    return `🎉 **Welcome to Business Setup Wizard!**

Hi there! I'm your AI business assistant, and I'm here to help you create a fully automated business system tailored specifically to your company.

**What we'll accomplish together:**

🚀 **Business Analysis** - I'll analyze your industry, business model, and processes
🎯 **Sales Funnel Design** - Create the perfect conversion funnel for your business  
🤖 **AI Agent Setup** - Build a team of specialized AI agents for your processes
⚡ **Workflow Automation** - Design automated workflows that run your business
👥 **Team Assignment** - Set up roles and responsibilities for your team
🧪 **Testing & Optimization** - Ensure everything works perfectly

**Ready to transform your business?** 

Just say "Let's start!" and I'll guide you through the entire process step by step. 

*This will take about 10-15 minutes, and you'll have a fully automated business system at the end!* ✨`;
  };

  const getBusinessAnalysisWelcomeMessage = (): string => {
    return `👋 Hi! I'm your Business Analysis AI assistant. 

I'm here to help you analyze your business and set up the perfect sales funnel. 

Let me ask you a few questions about your business to get started:
• What industry are you in?
• How big is your company?
• What's your business model?
• What's your annual revenue?
• How many employees do you have?
• Who is your target market?

Ready to begin? Just click this button and I'll guide you through the analysis! 🚀`;
  };

  const openWelcomeChat = () => {
    // Открываем специальный чат для приветствия
    openAskAIPage({
              initialMessage: `Настройка системы`,
      context: {
        businessSetupMode: true,
        step: BusinessSetupStatus.WELCOME,
        welcomeMessage: getWelcomeMessage(),
      },
    });
  };

  const openBusinessAnalysisChat = () => {
    // Открываем специальный чат для Business Analysis
    openAskAIPage({
      initialMessage: `I'm starting my business analysis. Please guide me through the process.`,
      context: {
        businessSetupMode: true,
        step: BusinessSetupStatus.BUSINESS_ANALYSIS,
        welcomeMessage: getBusinessAnalysisWelcomeMessage(),
      },
    });
  };

  return {
    isWelcomeActive,
    isBusinessAnalysisActive,
    getWelcomeMessage,
    getBusinessAnalysisWelcomeMessage,
    openWelcomeChat,
    openBusinessAnalysisChat,
  };
};
```

#### Модификация FloatingAIChatButton
```typescript
export const FloatingAIChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const { isVisible, handleClick } = useFloatingAIChatButton();
  const { isBusinessAnalysisActive, getWelcomeMessage, openBusinessAnalysisChat } = useBusinessSetupAIChat();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string>('');

  // Загружаем приветственное сообщение при активации Business Analysis
  useEffect(() => {
    if (isBusinessAnalysisActive) {
      const message = getWelcomeMessage();
      setWelcomeMessage(message);
    }
  }, [isBusinessAnalysisActive, getWelcomeMessage]);

  if (!isVisible) {
    return null;
  }

  const handleButtonClick = () => {
    if (isWelcomeActive) {
      openWelcomeChat();
    } else if (isBusinessAnalysisActive) {
      openBusinessAnalysisChat();
    } else {
      handleClick();
    }
  };

  const getTooltipContent = () => {
    if (isWelcomeActive && welcomeMessage) {
      return (
        <StyledBusinessSetupTooltip>
          <div className="business-setup-header">
            <IconSparkles size={16} />
            <span>Business Setup AI</span>
          </div>
          <div className="business-setup-message">
            {welcomeMessage}
          </div>
          <div className="business-setup-hint">
            Click to start business setup
          </div>
        </StyledBusinessSetupTooltip>
      );
    }
    
    if (isBusinessAnalysisActive && welcomeMessage) {
      return (
        <StyledBusinessSetupTooltip>
          <div className="business-setup-header">
            <IconSparkles size={16} />
            <span>Business Analysis AI</span>
          </div>
          <div className="business-setup-message">
            {welcomeMessage}
          </div>
          <div className="business-setup-hint">
            Click to start business analysis
          </div>
        </StyledBusinessSetupTooltip>
      );
    }
    
    return t`Ask AI (Press @)`;
  };

  return (
    <StyledFloatingAIChatButtonContainer
      data-testid="floating-ai-chat-button"
      className={
        isWelcomeActive ? 'business-setup-welcome-active' : 
        isBusinessAnalysisActive ? 'business-analysis-active' : ''
      }
    >
      <StyledFloatingAIChatButton
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
      >
        <FloatingIconButton
          Icon={IconSparkles}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleButtonClick}
          className={isBusinessAnalysisActive ? 'business-analysis-mode' : ''}
        />
        <StyledTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          {getTooltipContent()}
        </StyledTooltip>
      </StyledFloatingAIChatButton>
    </StyledFloatingAIChatButtonContainer>
  );
};
```

#### Специальные стили для Business Setup
```typescript
export const StyledFloatingAIChatButtonContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(4)};
  z-index: 1000;
  pointer-events: auto;
  animation: fadeInScale 0.3s ease-out;

  &.business-setup-welcome-active {
    animation: businessSetupWelcomePulse 2s ease-in-out infinite;
  }

  &.business-analysis-active {
    animation: businessAnalysisPulse 2s ease-in-out infinite;
  }

  @keyframes fadeInScale {
    from {
      opacity: 0;
      transform: scale(0.8);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes businessSetupWelcomePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
  }

  @keyframes businessAnalysisPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
  }

  @media (max-width: 768px) {
    bottom: ${({ theme }) => theme.spacing(2)};
    right: ${({ theme }) => theme.spacing(2)};
  }

  @media (max-width: 480px) {
    bottom: ${({ theme }) => theme.spacing(1.5)};
    right: ${({ theme }) => theme.spacing(1.5)};
  }
`;

export const StyledBusinessSetupTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.background.primary};
  border: 2px solid ${({ theme }) => theme.color.green};
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  white-space: normal;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  transform: translateY(4px);
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);

  .business-setup-header {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing(1)};
    margin-bottom: ${({ theme }) => theme.spacing(1)};
    font-weight: 600;
    color: ${({ theme }) => theme.color.green};
  }

  .business-setup-message {
    margin-bottom: ${({ theme }) => theme.spacing(1)};
    line-height: 1.4;
    color: ${({ theme }) => theme.font.color.secondary};
  }

  .business-setup-hint {
    font-size: ${({ theme }) => theme.font.size.xs};
    color: ${({ theme }) => theme.font.color.light};
    font-style: italic;
  }
`;
```

### Интерактивный процесс Business Setup через AI чат

#### Пример диалога для анализа бизнеса
```
🤖 AI: Hi! I'm your Business Analysis AI assistant. 

I'm here to help you analyze your business and set up the perfect sales funnel. 

Let me ask you a few questions about your business to get started:
• What industry are you in?
• How big is your company?
• What's your business model?
• What's your annual revenue?
• How many employees do you have?
• Who is your target market?

Ready to begin? Just click this button and I'll guide you through the analysis! 🚀

👤 User: I'm in the technology industry, specifically SaaS.

🤖 AI: Great! SaaS is a fantastic industry with lots of opportunities. 

Let me ask about your company size. How many employees do you currently have?

👤 User: We have about 25 employees.

🤖 AI: Perfect! A growing SaaS company with 25 employees. 

Now, what's your annual revenue range?

👤 User: Around $2 million annually.

🤖 AI: Excellent! $2M ARR with 25 employees shows good growth potential.

Based on your SaaS business model, I recommend focusing on:
• Lead generation through content marketing
• Automated lead qualification
• Customer success automation
• Upselling workflows

Would you like me to create a detailed analysis and sales funnel design for your business?
```

#### Специальные AI агенты для каждого этапа

##### BusinessAnalysisAgent - Агент анализа бизнеса
```typescript
@Injectable()
export class BusinessAnalysisAgent {
  private readonly welcomeMessages = {
    [BusinessSetupStatus.BUSINESS_ANALYSIS]: `👋 Hi! I'm your Business Analysis AI assistant. 

I'm here to help you analyze your business and set up the perfect sales funnel. 

Let me ask you a few questions about your business to get started:
• What industry are you in?
• How big is your company?
• What's your business model?
• What's your annual revenue?
• How many employees do you have?
• Who is your target market?

Ready to begin? Just click this button and I'll guide you through the analysis! 🚀`,

    [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: `🎯 Great! Now let's design your sales funnel. 

Based on your business analysis, I'll help you create the perfect funnel that converts leads into customers.

Let's start by defining your funnel stages and optimizing for maximum conversion!`,

    [BusinessSetupStatus.AGENT_SETUP]: `🤖 Perfect! Now let's set up your AI agents. 

I'll create specialized agents for each stage of your sales funnel to automate your processes and boost efficiency.

Ready to meet your new AI team?`,

    [BusinessSetupStatus.WORKFLOW_CREATION]: `⚡ Excellent! Now let's create your automated workflows. 

I'll design workflows that connect all your processes and make everything run smoothly.

Let's build your automation engine!`,

    [BusinessSetupStatus.TEAM_ASSIGNMENT]: `👥 Fantastic! Now let's assign your team. 

I'll help you set up roles, permissions, and responsibilities for your team members.

Let's organize your dream team!`,

    [BusinessSetupStatus.TESTING_OPTIMIZATION]: `🧪 Almost there! Now let's test and optimize everything. 

I'll run comprehensive tests and fine-tune your setup for maximum performance.

Let's make sure everything works perfectly!`,
  };

  getWelcomeMessage(status: BusinessSetupStatus): string {
    return this.welcomeMessages[status] || this.welcomeMessages[BusinessSetupStatus.BUSINESS_ANALYSIS];
  }

  async analyzeBusiness(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult> {
    // Логика анализа бизнеса
    const industryAnalysis = await this.analyzeIndustry(input.industry);
    const processMapping = await this.mapBusinessProcesses(input);
    const funnelRecommendations = await this.recommendSalesFunnel(input);
    const recommendedAgents = await this.getRecommendedAgents(input);
    const estimatedSetupTime = this.calculateSetupTime(input);

    return {
      industryAnalysis,
      processMapping,
      funnelRecommendations,
      recommendedAgents,
      estimatedSetupTime,
    };
  }

  private async analyzeIndustry(industry: string) {
    // Анализ отрасли
    return {
      trends: ['AI adoption', 'Digital transformation', 'Remote work'],
      competitors: ['Competitor A', 'Competitor B', 'Competitor C'],
      opportunities: ['Market expansion', 'Product innovation', 'Customer retention'],
      challenges: ['Market saturation', 'Regulatory changes', 'Technology disruption'],
    };
  }

  private async mapBusinessProcesses(input: BusinessAnalysisInput) {
    // Маппинг бизнес-процессов
    return {
      leadGeneration: ['Content marketing', 'Social media', 'SEO'],
      leadQualification: ['Automated scoring', 'Manual review', 'AI assessment'],
      salesProcess: ['Discovery call', 'Proposal', 'Negotiation', 'Close'],
      customerSuccess: ['Onboarding', 'Training', 'Support', 'Upselling'],
    };
  }

  private async recommendSalesFunnel(input: BusinessAnalysisInput) {
    // Рекомендации по воронке продаж
    return {
      stages: ['Awareness', 'Interest', 'Consideration', 'Intent', 'Purchase'],
      conversionRates: [5, 15, 25, 40, 60],
      optimizationTips: ['Improve landing pages', 'Add social proof', 'Simplify checkout'],
    };
  }

  private async getRecommendedAgents(input: BusinessAnalysisInput) {
    // Рекомендуемые агенты
    return [
      'Lead Qualification Agent',
      'Sales Assistant Agent',
      'Customer Support Agent',
      'Follow-up Agent',
    ];
  }

  private calculateSetupTime(input: BusinessAnalysisInput): number {
    // Оценка времени настройки (в днях)
    const baseTime = 7;
    const companySizeMultiplier = input.employeeCount > 50 ? 1.5 : 1;
    const complexityMultiplier = input.annualRevenue > 1000000 ? 1.3 : 1;
    
    return Math.round(baseTime * companySizeMultiplier * complexityMultiplier);
  }
}
```

### Интеграция с AI чатом

#### Модификация AIChat компонента
```typescript
export const AIChat = () => {
  const { businessSetupMode, step, welcomeMessage } = useAIChatContext();

  useEffect(() => {
    if (businessSetupMode && step === BusinessSetupStatus.BUSINESS_ANALYSIS) {
      // Автоматически отправляем приветственное сообщение
      sendMessage({
        type: 'ai',
        content: welcomeMessage,
        timestamp: new Date(),
        isBusinessSetupWelcome: true,
      });
    }
  }, [businessSetupMode, step, welcomeMessage]);

  // ... остальной код компонента
};
```

### Результат интеграции

Когда пользователь находится на статусе `BUSINESS_ANALYSIS`:

1. **Кнопка меняет внешний вид:**
   - Пульсирующая анимация
   - Зеленый индикатор вместо синего
   - Специальный tooltip с приветственным сообщением

2. **При клике открывается специальный чат:**
   - AI бот автоматически приветствует пользователя
   - Начинает задавать вопросы о бизнесе
   - Ведет пользователя через весь процесс анализа

3. **Интерактивный процесс:**
   - AI задает вопросы по одному
   - Пользователь отвечает
   - AI анализирует ответы и дает рекомендации
   - По завершении переходит к следующему шагу

### Преимущества интеграции

- **Персонализированный опыт:** AI бот адаптируется под каждый этап Business Setup
- **Интуитивная навигация:** Пользователь всегда знает, что делать дальше
- **Автоматизация:** Минимум ручной работы, максимум AI помощи
- **Контекстная помощь:** AI понимает текущий этап и дает релевантные советы
- **Визуальная обратная связь:** Кнопка меняет вид в зависимости от статуса

Эта интеграция создает революционный пользовательский опыт, где AI становится настоящим персональным помощником в настройке бизнеса!

---

## 24. Agent Supervisor System

### **Обзор Agent Supervisor**

Agent Supervisor - это **центральный координатор** в Business Setup Wizard, который анализирует статус клиента и автоматически перенаправляет между специализированными AI агентами в зависимости от этапа жизненного цикла клиента.

### **Архитектура Agent Supervisor**

#### **Типы агентов для разных статусов клиентов**

```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/types/client-agent-types.ts
export enum ClientAgentType {
  // Агенты для новых клиентов
  WELCOME_AGENT = 'WELCOME_AGENT',
  ONBOARDING_AGENT = 'ONBOARDING_AGENT',
  
  // Агенты для лидов
  LEAD_QUALIFICATION_AGENT = 'LEAD_QUALIFICATION_AGENT',
  SALES_DEMO_AGENT = 'SALES_DEMO_AGENT',
  PROPOSAL_AGENT = 'PROPOSAL_AGENT',
  
  // Агенты для клиентов
  CUSTOMER_SUCCESS_AGENT = 'CUSTOMER_SUCCESS_AGENT',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  UPSELL_AGENT = 'UPSELL_AGENT',
  
  // Агенты для проблемных клиентов
  CHURN_PREVENTION_AGENT = 'CHURN_PREVENTION_AGENT',
  RECOVERY_AGENT = 'RECOVERY_AGENT',
  
  // Специализированные агенты
  ENTERPRISE_SALES_AGENT = 'ENTERPRISE_SALES_AGENT',
  STARTUP_ONBOARDING_AGENT = 'STARTUP_ONBOARDING_AGENT',
  SME_AGENT = 'SME_AGENT',
}

// Статусы клиентов
export enum ClientStatus {
  // Новые клиенты
  NEW_USER = 'NEW_USER',
  ONBOARDING_IN_PROGRESS = 'ONBOARDING_IN_PROGRESS',
  
  // Лиды
  LEAD_UNQUALIFIED = 'LEAD_UNQUALIFIED',
  LEAD_QUALIFIED = 'LEAD_QUALIFIED',
  LEAD_DEMO_SCHEDULED = 'LEAD_DEMO_SCHEDULED',
  LEAD_PROPOSAL_SENT = 'LEAD_PROPOSAL_SENT',
  
  // Клиенты
  CUSTOMER_ACTIVE = 'CUSTOMER_ACTIVE',
  CUSTOMER_AT_RISK = 'CUSTOMER_AT_RISK',
  CUSTOMER_CHURNED = 'CUSTOMER_CHURNED',
  
  // Специализированные статусы
  ENTERPRISE_LEAD = 'ENTERPRISE_LEAD',
  STARTUP_PROSPECT = 'STARTUP_PROSPECT',
  SME_CUSTOMER = 'SME_CUSTOMER',
}
```

#### **Конфигурация Agent Supervisor**

```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/types/agent-supervisor-config.types.ts
export interface AgentSupervisorConfig {
  type: 'SUPERVISOR';
  supervision: {
    // Маппинг статусов клиентов к агентам
    clientStatusMapping: {
      [clientStatus in ClientStatus]: {
        primaryAgent: ClientAgentType;
        fallbackAgents: ClientAgentType[];
        conditions?: {
          companySize?: 'startup' | 'sme' | 'enterprise';
          industry?: string[];
          annualRevenue?: { min?: number; max?: number };
          engagementLevel?: 'low' | 'medium' | 'high';
          riskLevel?: 'low' | 'medium' | 'high';
          lastActivity?: { days?: number };
        };
        nextStatuses: ClientStatus[]; // Возможные следующие статусы
        successCriteria: string[]; // Критерии успешного перехода
        maxInteractions: number; // Максимум взаимодействий в этом статусе
      };
    };
    
    // Правила перехода между статусами
    statusTransitions: {
      [fromStatus in ClientStatus]: {
        [toStatus in ClientStatus]?: {
          conditions: string[];
          requiredActions: string[];
          probability: number; // Вероятность перехода
        };
      };
    };
    
    // Мониторинг и качество
    monitoring: {
      enabled: boolean;
      qualityThreshold: number;
      performanceMetrics: string[];
      escalationRules: {
        qualityBelowThreshold: boolean;
        maxFailedInteractions: number;
        customerComplaints: boolean;
      };
    };
    
    // Эскалация
    escalation: {
      enabled: boolean;
      escalationAgentId?: string;
      escalationConditions: string[];
      humanInterventionThreshold: number;
    };
    
    // Память и контекст
    memory: {
      enabled: boolean;
      strategy: 'accumulate' | 'replace' | 'hybrid';
      maxHistoryLength: number;
      includeAgentHistory: boolean;
      includeClientHistory: boolean;
    };
  };
}
```

#### **Agent Supervisor Service**

```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/agent-supervisor.service.ts
@Injectable()
export class AgentSupervisorService {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentMemoryService: AgentMemoryService,
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly logger: Logger,
  ) {}

  async superviseClientInteraction({
    supervisorAgent,
    clientData,
    currentStatus,
    context,
  }: {
    supervisorAgent: AgentEntity;
    clientData: {
      personId: string;
      companyId?: string;
      companySize?: string;
      industry?: string;
      annualRevenue?: number;
      engagementLevel?: 'low' | 'medium' | 'high';
      riskLevel?: 'low' | 'medium' | 'high';
      lastActivity?: Date;
    };
    currentStatus: ClientStatus;
    context: Record<string, unknown>;
  }): Promise<SupervisionResult> {
    const config = supervisorAgent.responseFormat as AgentSupervisorConfig;
    
    // 1. Анализируем текущий статус клиента
    const statusAnalysis = await this.analyzeClientStatus(clientData, currentStatus);
    
    // 2. Определяем подходящего агента
    const targetAgent = await this.determineTargetAgent(
      config.supervision.clientStatusMapping,
      statusAnalysis,
      context
    );
    
    // 3. Выполняем агента
    const agentResult = await this.executeTargetAgent(targetAgent, context);
    
    // 4. Анализируем результат и определяем следующий статус
    const nextStatus = await this.determineNextStatus(
      config.supervision.statusTransitions,
      currentStatus,
      agentResult,
      statusAnalysis
    );
    
    // 5. Проверяем качество и эскалируем при необходимости
    const qualityCheck = await this.checkQuality(agentResult, config.supervision.monitoring);
    
    if (!qualityCheck.passed && config.supervision.escalation.enabled) {
      return await this.handleEscalation(config.supervision.escalation, agentResult, context);
    }
    
    // 6. Обновляем память агента
    if (config.supervision.memory.enabled) {
      await this.updateSupervisorMemory(supervisorAgent.id, {
        clientData,
        currentStatus,
        nextStatus,
        agentResult,
        qualityCheck,
      }, config.supervision.memory.strategy);
    }
    
    return {
      currentStatus,
      nextStatus,
      targetAgent: targetAgent.id,
      agentResult,
      qualityCheck,
      recommendations: this.generateRecommendations(statusAnalysis, agentResult),
    };
  }

  private async analyzeClientStatus(
    clientData: any,
    currentStatus: ClientStatus
  ): Promise<ClientStatusAnalysis> {
    // Анализируем данные клиента и определяем оптимальные действия
    const analysis = {
      currentStatus,
      recommendedStatus: currentStatus,
      confidence: 0.8,
      reasoning: '',
      riskFactors: [],
      opportunities: [],
      engagementScore: this.calculateEngagementScore(clientData),
      conversionProbability: this.calculateConversionProbability(clientData, currentStatus),
    };

    // Логика анализа на основе данных клиента
    if (clientData.companySize === 'enterprise' && clientData.annualRevenue > 1000000) {
      analysis.recommendedStatus = ClientStatus.ENTERPRISE_LEAD;
      analysis.confidence = 0.9;
      analysis.reasoning = 'Enterprise company with high revenue potential';
      analysis.opportunities.push('High-value deal opportunity');
    } else if (clientData.companySize === 'startup') {
      analysis.recommendedStatus = ClientStatus.STARTUP_PROSPECT;
      analysis.confidence = 0.7;
      analysis.reasoning = 'Startup company requiring specialized onboarding';
      analysis.riskFactors.push('Limited budget and resources');
    } else if (clientData.engagementLevel === 'low' && clientData.lastActivity) {
      const daysSinceLastActivity = this.getDaysSinceLastActivity(clientData.lastActivity);
      if (daysSinceLastActivity > 30) {
        analysis.recommendedStatus = ClientStatus.CUSTOMER_AT_RISK;
        analysis.confidence = 0.8;
        analysis.reasoning = 'Low engagement, risk of churn';
        analysis.riskFactors.push('Inactive for more than 30 days');
      }
    }

    return analysis;
  }

  private async determineTargetAgent(
    statusMapping: any,
    statusAnalysis: ClientStatusAnalysis,
    context: Record<string, unknown>
  ): Promise<AgentEntity> {
    const statusConfig = statusMapping[statusAnalysis.recommendedStatus];
    if (!statusConfig) {
      throw new Error(`No agent mapping found for status: ${statusAnalysis.recommendedStatus}`);
    }

    // Проверяем условия для выбора агента
    if (statusConfig.conditions) {
      const conditionsMet = this.evaluateConditions(statusConfig.conditions, context);
      if (!conditionsMet) {
        // Используем fallback агентов
        for (const fallbackAgentType of statusConfig.fallbackAgents) {
          const fallbackAgent = await this.findAgentByType(fallbackAgentType);
          if (fallbackAgent) {
            return fallbackAgent;
          }
        }
      }
    }

    // Находим основного агента
    const primaryAgent = await this.findAgentByType(statusConfig.primaryAgent);
    if (!primaryAgent) {
      throw new Error(`Primary agent not found: ${statusConfig.primaryAgent}`);
    }

    return primaryAgent;
  }

  private async executeTargetAgent(
    agent: AgentEntity,
    context: Record<string, unknown>
  ): Promise<AgentExecutionResult> {
    try {
      const result = await this.agentExecutionService.executeAgent({
        agent,
        context,
        schema: {},
        userPrompt: `Execute agent ${agent.name} for client interaction`,
      });

      return {
        agentId: agent.id,
        agentName: agent.name,
        result: result.result,
        usage: result.usage,
        success: true,
        executionTime: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Agent ${agent.name} execution failed`, error);
      return {
        agentId: agent.id,
        agentName: agent.name,
        error: error.message,
        success: false,
        executionTime: Date.now(),
      };
    }
  }

  private async determineNextStatus(
    statusTransitions: any,
    currentStatus: ClientStatus,
    agentResult: AgentExecutionResult,
    statusAnalysis: ClientStatusAnalysis
  ): Promise<ClientStatus> {
    const transitions = statusTransitions[currentStatus];
    if (!transitions) {
      return currentStatus; // Остаемся в текущем статусе
    }

    // Анализируем результат агента и определяем следующий статус
    const possibleTransitions = Object.entries(transitions)
      .filter(([_, config]) => this.evaluateTransitionConditions(config.conditions, agentResult))
      .sort(([_, a], [__, b]) => b.probability - a.probability);

    if (possibleTransitions.length > 0) {
      const [nextStatus] = possibleTransitions[0];
      return nextStatus as ClientStatus;
    }

    return currentStatus;
  }

  private async checkQuality(
    agentResult: AgentExecutionResult,
    monitoring: any
  ): Promise<QualityCheckResult> {
    if (!monitoring.enabled) {
      return { passed: true, qualityScore: 1.0, issues: [], recommendations: [] };
    }

    const qualityScore = agentResult.success ? 1.0 : 0.0;
    const passed = qualityScore >= monitoring.qualityThreshold;

    return {
      passed,
      qualityScore,
      issues: agentResult.success ? [] : [agentResult.error],
      recommendations: [],
    };
  }

  private async handleEscalation(
    escalation: any,
    agentResult: AgentExecutionResult,
    context: Record<string, unknown>
  ): Promise<SupervisionResult> {
    if (!escalation.escalationAgentId) {
      return { escalationHandled: false };
    }

    const escalationAgent = await this.agentRepository.findOne({
      where: { id: escalation.escalationAgentId }
    });

    if (escalationAgent) {
      const escalationResult = await this.agentExecutionService.executeAgent({
        agent: escalationAgent,
        context: { ...context, previousResult: agentResult },
        schema: {},
        userPrompt: 'Handle escalation for failed agent interaction',
      });

      return {
        escalationHandled: true,
        escalationAgent: escalationAgent.id,
        escalationResult,
      };
    }

    return { escalationHandled: false };
  }

  private async findAgentByType(agentType: ClientAgentType): Promise<AgentEntity | null> {
    return await this.agentRepository.findOne({
      where: { agentType: agentType as any }
    });
  }

  private evaluateConditions(conditions: any, context: Record<string, unknown>): boolean {
    // Логика оценки условий
    return true; // Placeholder
  }

  private evaluateTransitionConditions(conditions: string[], agentResult: AgentExecutionResult): boolean {
    // Логика оценки условий перехода
    return true; // Placeholder
  }

  private calculateEngagementScore(clientData: any): number {
    // Логика расчета уровня вовлеченности
    return 0.8; // Placeholder
  }

  private calculateConversionProbability(clientData: any, status: ClientStatus): number {
    // Логика расчета вероятности конверсии
    return 0.7; // Placeholder
  }

  private getDaysSinceLastActivity(lastActivity: Date): number {
    return Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateRecommendations(
    statusAnalysis: ClientStatusAnalysis,
    agentResult: AgentExecutionResult
  ): string[] {
    const recommendations = [];
    
    if (statusAnalysis.riskFactors.length > 0) {
      recommendations.push(`Address risk factors: ${statusAnalysis.riskFactors.join(', ')}`);
    }
    
    if (statusAnalysis.opportunities.length > 0) {
      recommendations.push(`Leverage opportunities: ${statusAnalysis.opportunities.join(', ')}`);
    }
    
    if (!agentResult.success) {
      recommendations.push('Consider human intervention for failed interaction');
    }
    
    return recommendations;
  }

  private async updateSupervisorMemory(
    agentId: string,
    memoryData: any,
    strategy: 'accumulate' | 'replace' | 'hybrid'
  ): Promise<void> {
    await this.agentMemoryService.updateMemoryWithStrategy(agentId, memoryData, strategy);
  }
}

export interface SupervisionResult {
  currentStatus: ClientStatus;
  nextStatus: ClientStatus;
  targetAgent: string;
  agentResult: AgentExecutionResult;
  qualityCheck: QualityCheckResult;
  recommendations: string[];
  escalationHandled?: boolean;
  escalationAgent?: string;
  escalationResult?: AgentExecutionResult;
}

export interface ClientStatusAnalysis {
  currentStatus: ClientStatus;
  recommendedStatus: ClientStatus;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  opportunities: string[];
  engagementScore: number;
  conversionProbability: number;
}
```

#### **Пример конфигурации Agent Supervisor**

```typescript
// Пример конфигурации агента-супервизора
const agentSupervisorConfig: AgentSupervisorConfig = {
  type: 'SUPERVISOR',
  supervision: {
    clientStatusMapping: {
      [ClientStatus.NEW_USER]: {
        primaryAgent: ClientAgentType.WELCOME_AGENT,
        fallbackAgents: [ClientAgentType.ONBOARDING_AGENT],
        nextStatuses: [ClientStatus.ONBOARDING_IN_PROGRESS, ClientStatus.LEAD_UNQUALIFIED],
        successCriteria: ['welcome_email_sent', 'initial_engagement'],
        maxInteractions: 3,
      },
      
      [ClientStatus.ENTERPRISE_LEAD]: {
        primaryAgent: ClientAgentType.ENTERPRISE_SALES_AGENT,
        fallbackAgents: [ClientAgentType.SALES_DEMO_AGENT, ClientAgentType.PROPOSAL_AGENT],
        conditions: {
          companySize: 'enterprise',
          annualRevenue: { min: 1000000 },
        },
        nextStatuses: [ClientStatus.LEAD_DEMO_SCHEDULED, ClientStatus.LEAD_PROPOSAL_SENT],
        successCriteria: ['demo_scheduled', 'proposal_sent'],
        maxInteractions: 5,
      },
      
      [ClientStatus.STARTUP_PROSPECT]: {
        primaryAgent: ClientAgentType.STARTUP_ONBOARDING_AGENT,
        fallbackAgents: [ClientAgentType.ONBOARDING_AGENT, ClientAgentType.SUPPORT_AGENT],
        conditions: {
          companySize: 'startup',
        },
        nextStatuses: [ClientStatus.CUSTOMER_ACTIVE, ClientStatus.LEAD_UNQUALIFIED],
        successCriteria: ['onboarding_completed', 'first_value_delivered'],
        maxInteractions: 10,
      },
      
      [ClientStatus.CUSTOMER_AT_RISK]: {
        primaryAgent: ClientAgentType.CHURN_PREVENTION_AGENT,
        fallbackAgents: [ClientAgentType.CUSTOMER_SUCCESS_AGENT, ClientAgentType.RECOVERY_AGENT],
        conditions: {
          engagementLevel: 'low',
          riskLevel: 'high',
        },
        nextStatuses: [ClientStatus.CUSTOMER_ACTIVE, ClientStatus.CUSTOMER_CHURNED],
        successCriteria: ['engagement_improved', 'risk_mitigated'],
        maxInteractions: 7,
      },
      
      [ClientStatus.CUSTOMER_ACTIVE]: {
        primaryAgent: ClientAgentType.CUSTOMER_SUCCESS_AGENT,
        fallbackAgents: [ClientAgentType.UPSELL_AGENT, ClientAgentType.SUPPORT_AGENT],
        nextStatuses: [ClientStatus.CUSTOMER_AT_RISK],
        successCriteria: ['value_delivered', 'satisfaction_maintained'],
        maxInteractions: 15,
      },
    },
    
    statusTransitions: {
      [ClientStatus.NEW_USER]: {
        [ClientStatus.ONBOARDING_IN_PROGRESS]: {
          conditions: ['welcome_response_positive'],
          requiredActions: ['schedule_onboarding'],
          probability: 0.8,
        },
        [ClientStatus.LEAD_UNQUALIFIED]: {
          conditions: ['no_response', 'negative_response'],
          requiredActions: ['lead_nurturing'],
          probability: 0.2,
        },
      },
      
      [ClientStatus.ENTERPRISE_LEAD]: {
        [ClientStatus.LEAD_DEMO_SCHEDULED]: {
          conditions: ['interest_confirmed', 'budget_available'],
          requiredActions: ['schedule_demo'],
          probability: 0.7,
        },
        [ClientStatus.LEAD_PROPOSAL_SENT]: {
          conditions: ['demo_completed', 'requirements_clear'],
          requiredActions: ['send_proposal'],
          probability: 0.6,
        },
      },
      
      [ClientStatus.CUSTOMER_AT_RISK]: {
        [ClientStatus.CUSTOMER_ACTIVE]: {
          conditions: ['engagement_improved', 'issues_resolved'],
          requiredActions: ['success_plan'],
          probability: 0.6,
        },
        [ClientStatus.CUSTOMER_CHURNED]: {
          conditions: ['no_improvement', 'cancellation_requested'],
          requiredActions: ['exit_interview'],
          probability: 0.4,
        },
      },
    },
    
    monitoring: {
      enabled: true,
      qualityThreshold: 0.8,
      performanceMetrics: ['response_time', 'success_rate', 'customer_satisfaction'],
      escalationRules: {
        qualityBelowThreshold: true,
        maxFailedInteractions: 3,
        customerComplaints: true,
      },
    },
    
    escalation: {
      enabled: true,
      escalationAgentId: 'agent-human-escalation',
      escalationConditions: ['quality_below_threshold', 'max_failed_interactions', 'customer_complaint'],
      humanInterventionThreshold: 0.5,
    },
    
    memory: {
      enabled: true,
      strategy: 'hybrid',
      maxHistoryLength: 100,
      includeAgentHistory: true,
      includeClientHistory: true,
    },
  },
};
```

#### **Интеграция с системой onboarding**

```typescript
// packages/twenty-server/src/modules/onboarding/triggers/onboarding-completed.trigger.ts
@Injectable()
export class OnboardingCompletedTrigger {
  constructor(
    private readonly agentSupervisorService: AgentSupervisorService,
    private readonly agentService: AgentService,
    private readonly logger: Logger,
  ) {}

  async handleOnboardingCompleted({
    workspaceId,
    userId,
    userData,
  }: {
    workspaceId: string;
    userId: string;
    userData: any;
  }): Promise<void> {
    try {
      // Находим агента-супервизора
      const supervisorAgent = await this.agentService.findSupervisorAgent(workspaceId);
      
      if (!supervisorAgent) {
        this.logger.warn(`No supervisor agent found for workspace ${workspaceId}`);
        return;
      }

      // Запускаем супервизию клиента
      const supervisionResult = await this.agentSupervisorService.superviseClientInteraction({
        supervisorAgent,
        clientData: {
          personId: userId,
          companyId: userData.companyId,
          companySize: userData.companySize,
          industry: userData.industry,
          annualRevenue: userData.annualRevenue,
          engagementLevel: 'high', // Новый пользователь
          riskLevel: 'low',
          lastActivity: new Date(),
        },
        currentStatus: ClientStatus.NEW_USER,
        context: {
          trigger: 'onboarding_completed',
          userData,
          workspaceId,
        },
      });

      // Обновляем статус клиента
      await this.updateClientStatus(userId, supervisionResult.nextStatus);

      // Создаем задачи на основе рекомендаций
      if (supervisionResult.recommendations.length > 0) {
        await this.createFollowUpTasks(userId, supervisionResult.recommendations);
      }

      this.logger.log(`Client supervision completed for user ${userId}`, {
        currentStatus: supervisionResult.currentStatus,
        nextStatus: supervisionResult.nextStatus,
        targetAgent: supervisionResult.targetAgent,
      });

    } catch (error) {
      this.logger.error(`Failed to handle onboarding completion for user ${userId}`, error);
    }
  }

  private async updateClientStatus(userId: string, status: ClientStatus): Promise<void> {
    // Обновляем статус клиента в базе данных
    // Реализация зависит от структуры данных
  }

  private async createFollowUpTasks(userId: string, recommendations: string[]): Promise<void> {
    // Создаем задачи на основе рекомендаций агента-супервизора
    // Реализация зависит от системы задач
  }
}
```

### **Преимущества Agent Supervisor**

1. **Автоматическое перенаправление** - клиент всегда попадает к нужному агенту
2. **Адаптивность** - система учитывает тип компании, размер, отрасль
3. **Мониторинг качества** - постоянный контроль эффективности агентов
4. **Эскалация** - автоматическое привлечение человека при проблемах
5. **Память** - сохранение истории взаимодействий для лучшего контекста
6. **Масштабируемость** - легко добавлять новые типы агентов и статусов

**Agent Supervisor становится центральным мозгом системы, который обеспечивает правильное перенаправление клиентов между специализированными агентами на каждом этапе их жизненного цикла!** 🧠🤖

---

## 25. Интерактивный процесс Business Setup через AI чат

### **Обзор интерактивного процесса**

Интерактивный процесс Business Setup через AI чат создает уникальный пользовательский опыт, где AI бот становится персональным помощником на каждом этапе настройки бизнеса.

### **Архитектура интерактивного процесса**

#### **1. AI Chat Integration System**

```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/business-setup-chat.service.ts
@Injectable()
export class BusinessSetupChatService {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly businessSetupService: BusinessSetupService,
    private readonly agentMemoryService: AgentMemoryService,
    private readonly logger: Logger,
  ) {}

  async processBusinessSetupChat({
    userId,
    workspaceId,
    message,
    currentStep,
    context,
  }: {
    userId: string;
    workspaceId: string;
    message: string;
    currentStep: BusinessSetupStatus;
    context: Record<string, unknown>;
  }): Promise<BusinessSetupChatResponse> {
    try {
      // Определяем подходящего агента для текущего шага
      const agent = await this.getAgentForStep(currentStep, workspaceId);
      
      if (!agent) {
        throw new Error(`No agent found for step: ${currentStep}`);
      }

      // Загружаем память агента если включена
      let enrichedContext = context;
      if (agent.agentType === AgentType.MEMORY_ENABLED) {
        const memory = await this.agentMemoryService.loadAgentMemory(agent.id);
        enrichedContext = {
          ...context,
          agentMemory: memory,
          previousInteractions: memory.agentHistory.slice(-5),
        };
      }

      // Выполняем агента
      const result = await this.agentExecutionService.executeAgent({
        agent,
        context: enrichedContext,
        schema: this.getSchemaForStep(currentStep),
        userPrompt: message,
      });

      // Анализируем результат и определяем следующий шаг
      const nextStep = await this.determineNextStep(currentStep, result.result, context);
      
      // Обновляем память агента
      if (agent.agentType === AgentType.MEMORY_ENABLED) {
        await this.agentMemoryService.updateMemoryWithStrategy(
          agent.id,
          {
            agentHistory: [{
              prompt: message,
              result: result.result,
              timestamp: new Date(),
              executionTime: Date.now(),
              tokensUsed: result.usage.totalTokens,
            }],
          },
          'accumulate'
        );
      }

      // Проверяем готовность к переходу к следующему шагу
      const shouldProceed = this.checkReadinessToProceed(currentStep, result.result);
      
      return {
        message: this.formatAgentResponse(result.result, currentStep),
        nextStep,
        shouldProceed,
        extractedData: this.extractDataFromResult(result.result, currentStep),
        agentId: agent.id,
        usage: result.usage,
      };

    } catch (error) {
      this.logger.error('Business setup chat processing failed', error);
      throw new BusinessSetupChatException(
        'Failed to process business setup chat',
        BusinessSetupChatExceptionCode.CHAT_PROCESSING_FAILED
      );
    }
  }

  private async getAgentForStep(
    step: BusinessSetupStatus,
    workspaceId: string
  ): Promise<AgentEntity | null> {
    const agentMapping = {
      [BusinessSetupStatus.WELCOME]: 'business-setup-welcome-agent',
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 'business-analysis-agent',
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 'funnel-designer-agent',
      [BusinessSetupStatus.AGENT_SETUP]: 'agent-orchestrator-agent',
      [BusinessSetupStatus.WORKFLOW_CREATION]: 'workflow-generator-agent',
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: 'team-assignment-agent',
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: 'testing-optimization-agent',
    };

    const agentId = agentMapping[step];
    if (!agentId) return null;

    return await this.agentService.findOne({
      where: { id: agentId, workspaceId }
    });
  }

  private getSchemaForStep(step: BusinessSetupStatus): OutputSchema {
    const schemas = {
      [BusinessSetupStatus.WELCOME]: {
        response: { type: 'string' },
        userIntent: { type: 'string' },
        readyToProceed: { type: 'boolean' },
      },
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: {
        industry: { type: 'string' },
        businessModel: { type: 'string' },
        companySize: { type: 'string' },
        annualRevenue: { type: 'number' },
        employeeCount: { type: 'number' },
        targetMarket: { type: 'string' },
        analysisComplete: { type: 'boolean' },
        recommendations: { type: 'array' },
      },
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: {
        funnelStages: { type: 'array' },
        conversionTargets: { type: 'object' },
        kpis: { type: 'array' },
        designComplete: { type: 'boolean' },
      },
      [BusinessSetupStatus.AGENT_SETUP]: {
        agents: { type: 'array' },
        coordinationMatrix: { type: 'object' },
        setupComplete: { type: 'boolean' },
      },
      [BusinessSetupStatus.WORKFLOW_CREATION]: {
        workflows: { type: 'array' },
        integrationPoints: { type: 'array' },
        creationComplete: { type: 'boolean' },
      },
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: {
        roles: { type: 'array' },
        assignments: { type: 'object' },
        assignmentComplete: { type: 'boolean' },
      },
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: {
        testResults: { type: 'object' },
        optimizations: { type: 'array' },
        testingComplete: { type: 'boolean' },
      },
    };

    return schemas[step] || {};
  }

  private async determineNextStep(
    currentStep: BusinessSetupStatus,
    result: any,
    context: Record<string, unknown>
  ): Promise<BusinessSetupStatus> {
    const stepTransitions = {
      [BusinessSetupStatus.WELCOME]: BusinessSetupStatus.BUSINESS_ANALYSIS,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 
        result.analysisComplete ? BusinessSetupStatus.SALES_FUNNEL_DESIGN : BusinessSetupStatus.BUSINESS_ANALYSIS,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]:
        result.designComplete ? BusinessSetupStatus.AGENT_SETUP : BusinessSetupStatus.SALES_FUNNEL_DESIGN,
      [BusinessSetupStatus.AGENT_SETUP]:
        result.setupComplete ? BusinessSetupStatus.WORKFLOW_CREATION : BusinessSetupStatus.AGENT_SETUP,
      [BusinessSetupStatus.WORKFLOW_CREATION]:
        result.creationComplete ? BusinessSetupStatus.TEAM_ASSIGNMENT : BusinessSetupStatus.WORKFLOW_CREATION,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]:
        result.assignmentComplete ? BusinessSetupStatus.TESTING_OPTIMIZATION : BusinessSetupStatus.TEAM_ASSIGNMENT,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]:
        result.testingComplete ? BusinessSetupStatus.COMPLETED : BusinessSetupStatus.TESTING_OPTIMIZATION,
    };

    return stepTransitions[currentStep] || currentStep;
  }

  private checkReadinessToProceed(currentStep: BusinessSetupStatus, result: any): boolean {
    const readinessChecks = {
      [BusinessSetupStatus.WELCOME]: result.readyToProceed,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: result.analysisComplete,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: result.designComplete,
      [BusinessSetupStatus.AGENT_SETUP]: result.setupComplete,
      [BusinessSetupStatus.WORKFLOW_CREATION]: result.creationComplete,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: result.assignmentComplete,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: result.testingComplete,
    };

    return readinessChecks[currentStep] || false;
  }

  private formatAgentResponse(result: any, step: BusinessSetupStatus): string {
    const formatters = {
      [BusinessSetupStatus.WELCOME]: () => this.formatWelcomeResponse(result),
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: () => this.formatBusinessAnalysisResponse(result),
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: () => this.formatFunnelDesignResponse(result),
      [BusinessSetupStatus.AGENT_SETUP]: () => this.formatAgentSetupResponse(result),
      [BusinessSetupStatus.WORKFLOW_CREATION]: () => this.formatWorkflowCreationResponse(result),
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: () => this.formatTeamAssignmentResponse(result),
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: () => this.formatTestingOptimizationResponse(result),
    };

    const formatter = formatters[step];
    return formatter ? formatter() : JSON.stringify(result);
  }

  private extractDataFromResult(result: any, step: BusinessSetupStatus): Record<string, unknown> {
    const extractors = {
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: {
        industry: result.industry,
        businessModel: result.businessModel,
        companySize: result.companySize,
        annualRevenue: result.annualRevenue,
        employeeCount: result.employeeCount,
        targetMarket: result.targetMarket,
      },
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: {
        funnelStages: result.funnelStages,
        conversionTargets: result.conversionTargets,
        kpis: result.kpis,
      },
      [BusinessSetupStatus.AGENT_SETUP]: {
        agents: result.agents,
        coordinationMatrix: result.coordinationMatrix,
      },
      [BusinessSetupStatus.WORKFLOW_CREATION]: {
        workflows: result.workflows,
        integrationPoints: result.integrationPoints,
      },
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: {
        roles: result.roles,
        assignments: result.assignments,
      },
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: {
        testResults: result.testResults,
        optimizations: result.optimizations,
      },
    };

    return extractors[step] || {};
  }

  private formatWelcomeResponse(result: any): string {
    return `🎉 **Welcome to Business Setup Wizard!**

${result.response}

**What we'll accomplish together:**

🚀 **Business Analysis** - I'll analyze your industry, business model, and processes
🎯 **Sales Funnel Design** - Create the perfect conversion funnel for your business  
🤖 **AI Agent Setup** - Build a team of specialized AI agents for your processes
⚡ **Workflow Automation** - Design automated workflows that run your business
👥 **Team Assignment** - Set up roles and responsibilities for your team
🧪 **Testing & Optimization** - Ensure everything works perfectly

**Ready to transform your business?** 

Just say "Let's start!" and I'll guide you through the entire process step by step. 

*This will take about 10-15 minutes, and you'll have a fully automated business system at the end!* ✨`;
  }

  private formatBusinessAnalysisResponse(result: any): string {
    if (result.analysisComplete) {
      return `✅ **Business Analysis Complete!**

Based on your business information, here's what I've analyzed:

**Industry Analysis:**
- Industry: ${result.industry}
- Business Model: ${result.businessModel}
- Company Size: ${result.companySize} (${result.employeeCount} employees)
- Annual Revenue: $${result.annualRevenue.toLocaleString()}
- Target Market: ${result.targetMarket}

**Recommendations:**
${result.recommendations.map((rec: string) => `• ${rec}`).join('\n')}

**Next Step:** Let's design your sales funnel! 🎯`;
    }

    return `👋 **Business Analysis in Progress**

${result.response}

Please provide the following information:
• What industry are you in?
• What's your business model?
• How big is your company?
• What's your annual revenue?
• Who is your target market?

You can answer these questions one by one, or tell me everything at once! 🚀`;
  }

  private formatFunnelDesignResponse(result: any): string {
    if (result.designComplete) {
      return `✅ **Sales Funnel Design Complete!**

I've created a customized sales funnel for your business:

**Funnel Stages:**
${result.funnelStages.map((stage: any) => `• ${stage.name}: ${stage.description}`).join('\n')}

**Conversion Targets:**
${Object.entries(result.conversionTargets).map(([stage, target]) => `• ${stage}: ${target}%`).join('\n')}

**Key Performance Indicators:**
${result.kpis.map((kpi: string) => `• ${kpi}`).join('\n')}

**Next Step:** Let's set up your AI agents! 🤖`;
    }

    return `🎯 **Designing Your Sales Funnel**

${result.response}

I'm analyzing your business to create the perfect sales funnel. This will include:
• Lead generation strategies
• Qualification processes
• Sales pipeline stages
• Conversion optimization
• Customer success workflows

Let me know if you have any specific preferences or requirements!`;
  }

  private formatAgentSetupResponse(result: any): string {
    if (result.setupComplete) {
      return `✅ **AI Agent Setup Complete!**

I've configured ${result.agents.length} specialized AI agents for your business:

**Your AI Team:**
${result.agents.map((agent: any) => `• ${agent.name}: ${agent.description}`).join('\n')}

**Coordination Matrix:**
The agents are configured to work together seamlessly, with automatic handoffs and escalation rules.

**Next Step:** Let's create your automated workflows! ⚡`;
    }

    return `🤖 **Setting Up Your AI Agents**

${result.response}

I'm creating specialized AI agents for each stage of your sales funnel:
• Lead Qualification Agent
• Sales Assistant Agent
• Customer Support Agent
• Follow-up Agent

Each agent will be trained on your specific business context and processes.`;
  }

  private formatWorkflowCreationResponse(result: any): string {
    if (result.creationComplete) {
      return `✅ **Workflow Creation Complete!**

I've created ${result.workflows.length} automated workflows for your business:

**Workflows Created:**
${result.workflows.map((workflow: any) => `• ${workflow.name}: ${workflow.description}`).join('\n')}

**Integration Points:**
${result.integrationPoints.map((integration: string) => `• ${integration}`).join('\n')}

**Next Step:** Let's assign your team roles! 👥`;
    }

    return `⚡ **Creating Your Automated Workflows**

${result.response}

I'm designing automated workflows that will:
• Connect all your business processes
• Automate repetitive tasks
• Ensure consistent customer experience
• Provide real-time analytics and reporting

These workflows will run your business automatically!`;
  }

  private formatTeamAssignmentResponse(result: any): string {
    if (result.assignmentComplete) {
      return `✅ **Team Assignment Complete!**

I've set up roles and responsibilities for your team:

**Team Roles:**
${result.roles.map((role: any) => `• ${role.name}: ${role.description}`).join('\n')}

**Assignments:**
${Object.entries(result.assignments).map(([role, person]) => `• ${role}: ${person}`).join('\n')}

**Next Step:** Let's test and optimize everything! 🧪`;
    }

    return `👥 **Assigning Your Team**

${result.response}

I'm setting up roles and responsibilities for your team members:
• Lead Manager
• Sales Representative
• Customer Success Manager
• Sales Operations

Each role will have specific permissions and access to relevant parts of the system.`;
  }

  private formatTestingOptimizationResponse(result: any): string {
    if (result.testingComplete) {
      return `✅ **Testing & Optimization Complete!**

Your business automation system is ready! Here's what I've accomplished:

**Test Results:**
${Object.entries(result.testResults).map(([test, result]) => `• ${test}: ${result}`).join('\n')}

**Optimizations Applied:**
${result.optimizations.map((opt: string) => `• ${opt}`).join('\n')}

**🎉 Congratulations! Your fully automated business system is now live!**

You now have:
✅ AI-powered business analysis
✅ Optimized sales funnel
✅ Coordinated AI agents
✅ Automated workflows
✅ Team roles and permissions
✅ Performance monitoring

Your business will now run automatically, with AI agents handling customer interactions and workflows managing your processes! 🚀`;
    }

    return `🧪 **Testing & Optimizing Your System**

${result.response}

I'm running comprehensive tests to ensure everything works perfectly:
• Workflow functionality tests
• Agent performance tests
• Integration tests
• Performance optimization
• Security validation

This ensures your system will run smoothly and efficiently!`;
  }
}

export interface BusinessSetupChatResponse {
  message: string;
  nextStep: BusinessSetupStatus;
  shouldProceed: boolean;
  extractedData: Record<string, unknown>;
  agentId: string;
  usage: TokenUsage;
}
```

#### **2. Frontend Chat Integration**

```typescript
// packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupChat.ts
export const useBusinessSetupChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const navigate = useNavigate();
  
  const [chatHistory, setChatHistory] = useState<BusinessSetupChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<BusinessSetupStatus>(BusinessSetupStatus.WELCOME);

  const sendMessage = useCallback(async (message: string) => {
    setIsProcessing(true);
    
    try {
      // Добавляем сообщение пользователя в историю
      const userMessage: BusinessSetupChatMessage = {
        id: generateId(),
        content: message,
        role: 'USER',
        timestamp: new Date(),
      };
      
      setChatHistory(prev => [...prev, userMessage]);

      // Отправляем сообщение в Business Setup Chat Service
      const response = await businessSetupChatMutation({
        variables: {
          input: {
            message,
            currentStep,
            context: {
              businessSetupStatus,
              chatHistory: chatHistory.slice(-10), // Последние 10 сообщений
            },
          },
        },
      });

      // Добавляем ответ агента в историю
      const agentMessage: BusinessSetupChatMessage = {
        id: generateId(),
        content: response.data.processBusinessSetupChat.message,
        role: 'ASSISTANT',
        timestamp: new Date(),
        agentId: response.data.processBusinessSetupChat.agentId,
        metadata: {
          nextStep: response.data.processBusinessSetupChat.nextStep,
          shouldProceed: response.data.processBusinessSetupChat.shouldProceed,
          extractedData: response.data.processBusinessSetupChat.extractedData,
        },
      };
      
      setChatHistory(prev => [...prev, agentMessage]);

      // Обновляем текущий шаг
      setCurrentStep(response.data.processBusinessSetupChat.nextStep);

      // Если готовы к переходу к следующему шагу
      if (response.data.processBusinessSetupChat.shouldProceed) {
        await handleStepTransition(response.data.processBusinessSetupChat.nextStep);
      }

    } catch (error) {
      console.error('Business setup chat error:', error);
      
      // Добавляем сообщение об ошибке
      const errorMessage: BusinessSetupChatMessage = {
        id: generateId(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'ASSISTANT',
        timestamp: new Date(),
        isError: true,
      };
      
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  }, [businessSetupStatus, currentStep, chatHistory]);

  const handleStepTransition = useCallback(async (nextStep: BusinessSetupStatus) => {
    try {
      // Переходим к следующему шагу в Business Setup
      await setNextBusinessSetupStatus();
      
      // Навигация к соответствующей странице
      const stepRoutes = {
        [BusinessSetupStatus.BUSINESS_ANALYSIS]: AppPath.BusinessAnalysis,
        [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: AppPath.SalesFunnelDesign,
        [BusinessSetupStatus.AGENT_SETUP]: AppPath.AgentSetup,
        [BusinessSetupStatus.WORKFLOW_CREATION]: AppPath.WorkflowCreation,
        [BusinessSetupStatus.TEAM_ASSIGNMENT]: AppPath.TeamAssignment,
        [BusinessSetupStatus.TESTING_OPTIMIZATION]: AppPath.TestingOptimization,
        [BusinessSetupStatus.COMPLETED]: AppPath.BusinessSetupCompleted,
      };
      
      const route = stepRoutes[nextStep];
      if (route) {
        navigate(route);
      }
    } catch (error) {
      console.error('Step transition error:', error);
    }
  }, [setNextBusinessSetupStatus, navigate]);

  const startWelcomeChat = useCallback(() => {
    const welcomeMessage = `Настройка системы`;
    sendMessage(welcomeMessage);
  }, [sendMessage]);

  return {
    chatHistory,
    isProcessing,
    currentStep,
    sendMessage,
    startWelcomeChat,
  };
};

export interface BusinessSetupChatMessage {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT';
  timestamp: Date;
  agentId?: string;
  metadata?: {
    nextStep?: BusinessSetupStatus;
    shouldProceed?: boolean;
    extractedData?: Record<string, unknown>;
  };
  isError?: boolean;
}
```

#### **3. Floating AI Chat Button Integration**

```typescript
// packages/twenty-front/src/modules/business-setup/components/BusinessSetupFloatingChatButton.tsx
export const BusinessSetupFloatingChatButton = () => {
  const theme = useTheme();
  const isMobile = useIsMobile();
  const businessSetupStatus = useBusinessSetupStatus();
  const { startWelcomeChat, isProcessing } = useBusinessSetupChat();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  const getButtonState = () => {
    switch (businessSetupStatus) {
      case BusinessSetupStatus.WELCOME:
        return {
          icon: IconSparkles,
          color: theme.color.green,
          tooltip: 'Start Business Setup with AI',
          animation: 'businessSetupWelcomePulse',
        };
      case BusinessSetupStatus.BUSINESS_ANALYSIS:
        return {
          icon: IconBrain,
          color: theme.color.blue,
          tooltip: 'Business Analysis AI Assistant',
          animation: 'businessAnalysisPulse',
        };
      case BusinessSetupStatus.SALES_FUNNEL_DESIGN:
        return {
          icon: IconFunnel,
          color: theme.color.orange,
          tooltip: 'Funnel Design AI Assistant',
          animation: 'funnelDesignPulse',
        };
      case BusinessSetupStatus.AGENT_SETUP:
        return {
          icon: IconRobot,
          color: theme.color.purple,
          tooltip: 'Agent Setup AI Assistant',
          animation: 'agentSetupPulse',
        };
      case BusinessSetupStatus.WORKFLOW_CREATION:
        return {
          icon: IconWorkflow,
          color: theme.color.indigo,
          tooltip: 'Workflow Creation AI Assistant',
          animation: 'workflowCreationPulse',
        };
      case BusinessSetupStatus.TEAM_ASSIGNMENT:
        return {
          icon: IconUsers,
          color: theme.color.teal,
          tooltip: 'Team Assignment AI Assistant',
          animation: 'teamAssignmentPulse',
        };
      case BusinessSetupStatus.TESTING_OPTIMIZATION:
        return {
          icon: IconTestTube,
          color: theme.color.red,
          tooltip: 'Testing & Optimization AI Assistant',
          animation: 'testingOptimizationPulse',
        };
      default:
        return {
          icon: IconSparkles,
          color: theme.color.gray,
          tooltip: 'AI Assistant',
          animation: 'defaultPulse',
        };
    }
  };

  const buttonState = getButtonState();

  const handleClick = () => {
    if (businessSetupStatus === BusinessSetupStatus.WELCOME) {
      startWelcomeChat();
    } else {
      // Открываем чат для текущего шага
      openBusinessSetupChat(businessSetupStatus);
    }
  };

  if (!businessSetupStatus || businessSetupStatus === BusinessSetupStatus.COMPLETED) {
    return null;
  }

  return (
    <StyledBusinessSetupFloatingChatButtonContainer
      data-testid="business-setup-floating-chat-button"
      className={`business-setup-${businessSetupStatus.toLowerCase()}`}
    >
      <StyledBusinessSetupFloatingChatButton
        onMouseEnter={() => setIsTooltipVisible(true)}
        onMouseLeave={() => setIsTooltipVisible(false)}
      >
        <FloatingIconButton
          Icon={buttonState.icon}
          size={isMobile ? 'small' : 'medium'}
          position="standalone"
          applyShadow={true}
          applyBlur={true}
          onClick={handleClick}
          disabled={isProcessing}
          className={`business-setup-mode ${buttonState.animation}`}
          style={{
            backgroundColor: buttonState.color,
            color: theme.font.color.inverted,
          }}
        />
        <StyledBusinessSetupTooltip
          style={{
            opacity: isTooltipVisible ? 1 : 0,
            transform: isTooltipVisible ? 'translateY(0)' : 'translateY(4px)',
          }}
        >
          <div className="business-setup-header">
            <IconSparkles size={16} />
            <span>Business Setup AI</span>
          </div>
          <div className="business-setup-message">
            {buttonState.tooltip}
          </div>
          <div className="business-setup-hint">
            Click to continue setup
          </div>
        </StyledBusinessSetupTooltip>
      </StyledBusinessSetupFloatingChatButton>
    </StyledBusinessSetupFloatingChatButtonContainer>
  );
};

export const StyledBusinessSetupFloatingChatButtonContainer = styled.div`
  position: fixed;
  bottom: ${({ theme }) => theme.spacing(4)};
  right: ${({ theme }) => theme.spacing(4)};
  z-index: 1000;
  pointer-events: auto;

  &.business-setup-welcome {
    animation: businessSetupWelcomePulse 2s ease-in-out infinite;
  }

  &.business-setup-business_analysis {
    animation: businessAnalysisPulse 2s ease-in-out infinite;
  }

  &.business-setup-sales_funnel_design {
    animation: funnelDesignPulse 2s ease-in-out infinite;
  }

  &.business-setup-agent_setup {
    animation: agentSetupPulse 2s ease-in-out infinite;
  }

  &.business-setup-workflow_creation {
    animation: workflowCreationPulse 2s ease-in-out infinite;
  }

  &.business-setup-team_assignment {
    animation: teamAssignmentPulse 2s ease-in-out infinite;
  }

  &.business-setup-testing_optimization {
    animation: testingOptimizationPulse 2s ease-in-out infinite;
  }

  @keyframes businessSetupWelcomePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
    }
  }

  @keyframes businessAnalysisPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
    }
  }

  @keyframes funnelDesignPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
    }
  }

  @keyframes agentSetupPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(147, 51, 234, 0.5);
    }
  }

  @keyframes workflowCreationPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
    }
  }

  @keyframes teamAssignmentPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(20, 184, 166, 0.5);
    }
  }

  @keyframes testingOptimizationPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 6px 20px rgba(239, 68, 68, 0.5);
    }
  }

  @media (max-width: 768px) {
    bottom: ${({ theme }) => theme.spacing(2)};
    right: ${({ theme }) => theme.spacing(2)};
  }
`;
```

### **Пример диалога Business Setup**

```
🤖 AI: 🎉 Welcome to Business Setup Wizard!

Hi there! I'm your AI business assistant, and I'm here to help you create a fully automated business system tailored specifically to your company.

What we'll accomplish together:

🚀 Business Analysis - I'll analyze your industry, business model, and processes
🎯 Sales Funnel Design - Create the perfect conversion funnel for your business  
🤖 AI Agent Setup - Build a team of specialized AI agents for your processes
⚡ Workflow Automation - Design automated workflows that run your business
👥 Team Assignment - Set up roles and responsibilities for your team
🧪 Testing & Optimization - Ensure everything works perfectly

Ready to transform your business? 

Just say "Let's start!" and I'll guide you through the entire process step by step. 

This will take about 10-15 minutes, and you'll have a fully automated business system at the end! ✨

👤 User: Let's start!

🤖 AI: Perfect! Let's get started with your business analysis.

To create the perfect automation system for your business, I need to understand a few things about your company:

Tell me about your business:

1. What industry are you in? (e.g., technology, healthcare, e-commerce, consulting)
2. What's your business model? (e.g., SaaS, marketplace, agency, product)
3. How big is your company? (number of employees)
4. What's your annual revenue? (approximate range)
5. Who is your target market? (B2B, B2C, specific segments)

You can answer these questions one by one, or tell me everything at once. I'll analyze your responses and create a customized business setup plan! 🚀

👤 User: We're a technology company, specifically SaaS. We have about 25 employees and annual revenue of around $2 million. Our target market is small to medium businesses.

🤖 AI: Excellent! I've analyzed your business information:

**Business Analysis Complete!**

Based on your business information, here's what I've analyzed:

**Industry Analysis:**
- Industry: Technology
- Business Model: SaaS
- Company Size: SME (25 employees)
- Annual Revenue: $2,000,000
- Target Market: Small to medium businesses

**Recommendations:**
• Focus on lead generation through content marketing and SEO
• Implement automated lead qualification and scoring
• Create customer success workflows for retention
• Set up upselling and expansion revenue processes
• Develop partner and referral programs

**Next Step:** Let's design your sales funnel! 🎯

I'm creating a customized sales funnel for your SaaS business targeting SMBs. This will include:

**Funnel Stages:**
• Awareness: Content marketing, SEO, social media
• Interest: Lead magnets, webinars, case studies
• Consideration: Product demos, free trials, ROI calculators
• Intent: Proposals, negotiations, contract reviews
• Purchase: Contract signing, onboarding, payment processing

**Conversion Targets:**
• Awareness to Interest: 5%
• Interest to Consideration: 15%
• Consideration to Intent: 25%
• Intent to Purchase: 40%

**Key Performance Indicators:**
• Lead conversion rate
• Time in each stage
• Customer acquisition cost
• Lifetime value
• Churn rate

**Next Step:** Let's set up your AI agents! 🤖

👤 User: That looks great! Let's continue.

🤖 AI: Perfect! I'm setting up your AI agents now.

**AI Agent Setup Complete!**

I've configured 4 specialized AI agents for your SaaS business:

**Your AI Team:**
• Lead Qualification Agent: Qualifies leads based on budget, authority, need, timeline
• Sales Assistant Agent: Helps with demos, proposals, and sales process
• Customer Success Agent: Manages onboarding, support, and retention
• Follow-up Agent: Handles nurture sequences and re-engagement

**Coordination Matrix:**
The agents are configured to work together seamlessly, with automatic handoffs and escalation rules.

**Next Step:** Let's create your automated workflows! ⚡

I'm designing automated workflows that will:

**Workflows Created:**
• Lead Generation Workflow: Automated content distribution and lead capture
• Lead Qualification Workflow: Automated scoring and routing
• Sales Process Workflow: Demo scheduling, proposal generation, contract management
• Customer Success Workflow: Onboarding, training, support ticket management
• Retention Workflow: Usage monitoring, check-ins, expansion opportunities

**Integration Points:**
• Email marketing platform (Mailchimp/SendGrid)
• CRM system (Salesforce/HubSpot)
• Communication tools (Slack/Teams)
• Analytics platform (Google Analytics/Mixpanel)

**Next Step:** Let's assign your team roles! 👥

👤 User: Continue with team setup.

🤖 AI: Great! I'm setting up your team structure now.

**Team Assignment Complete!**

I've set up roles and responsibilities for your team:

**Team Roles:**
• Lead Manager: Manages lead generation and qualification processes
• Sales Representative: Handles sales demos, proposals, and closing
• Customer Success Manager: Manages onboarding and customer retention
• Sales Operations: Handles analytics, reporting, and process optimization

**Assignments:**
• Lead Manager: [Auto-assigned based on team structure]
• Sales Representative: [Auto-assigned based on team structure]
• Customer Success Manager: [Auto-assigned based on team structure]
• Sales Operations: [Auto-assigned based on team structure]

**Next Step:** Let's test and optimize everything! 🧪

I'm running comprehensive tests to ensure everything works perfectly:

**Test Results:**
• Workflow functionality: ✅ All workflows tested successfully
• Agent performance: ✅ All agents responding within 2 seconds
• Integration tests: ✅ All integrations working properly
• Performance optimization: ✅ System optimized for 25 users
• Security validation: ✅ All security measures in place

**Optimizations Applied:**
• Reduced agent response time by 40%
• Optimized workflow triggers for better performance
• Configured automatic scaling for peak usage
• Set up monitoring and alerting systems

**🎉 Congratulations! Your fully automated business system is now live!**

You now have:
✅ AI-powered business analysis
✅ Optimized sales funnel
✅ Coordinated AI agents
✅ Automated workflows
✅ Team roles and permissions
✅ Performance monitoring

Your business will now run automatically, with AI agents handling customer interactions and workflows managing your processes! 🚀

**System Status:** ACTIVE
**Estimated ROI Improvement:** 35%
**Time to Full Automation:** 2-3 weeks
**Next Review:** Scheduled for 1 week

Your Business Setup Wizard journey is complete! 🎉
```

### **Преимущества интерактивного процесса**

1. **Персонализированный опыт** - AI адаптируется под каждый этап
2. **Естественное взаимодействие** - диалог на естественном языке
3. **Автоматические переходы** - плавное движение между этапами
4. **Контекстная память** - AI помнит всю историю взаимодействия
5. **Визуальная обратная связь** - кнопка меняет вид в зависимости от этапа
6. **Автоматическая навигация** - переход к соответствующим страницам

**Интерактивный процесс Business Setup через AI чат создает революционный пользовательский опыт, где AI становится настоящим персональным помощником в настройке бизнеса!** 🤖✨