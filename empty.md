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
  BUSINESS_ANALYSIS = 'BUSINESS_ANALYSIS',           // Анализ бизнеса
  SALES_FUNNEL_DESIGN = 'SALES_FUNNEL_DESIGN',       // Дизайн воронки продаж
  AGENT_SETUP = 'AGENT_SETUP',                       // Настройка агентов
  WORKFLOW_CREATION = 'WORKFLOW_CREATION',           // Создание workflow
  TEAM_ASSIGNMENT = 'TEAM_ASSIGNMENT',               // Назначение команды
  TESTING_OPTIMIZATION = 'TESTING_OPTIMIZATION',     // Тестирование и оптимизация
  COMPLETED = 'COMPLETED'                            // Завершено
}
```

---

## 3. Детальный flow процесса

### Шаг 1: Анализ бизнеса (BUSINESS_ANALYSIS)

**Frontend:** `BusinessAnalysis.tsx`
- Форма с полями: отрасль, размер компании, бизнес-модель
- Загрузка дополнительных данных о бизнесе
- Валидация через Zod schema
- Вызов `BusinessAnalysisAgent` для анализа

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

### Шаг 2: Дизайн воронки продаж (SALES_FUNNEL_DESIGN)

**Frontend:** `SalesFunnelDesign.tsx`
- Интерактивный конструктор воронки
- Drag & drop этапов
- Настройка переходов и условий
- Предварительный просмотр

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

### Шаг 3: Настройка агентов (AGENT_SETUP)

**Frontend:** `AgentSetup.tsx`
- Выбор агентов для каждого этапа воронки
- Настройка промптов и поведения
- Предварительное тестирование агентов
- Настройка координации между агентами

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

### Шаг 4: Создание workflow (WORKFLOW_CREATION)

**Frontend:** `WorkflowCreation.tsx`
- Автоматическая генерация workflow
- Настройка триггеров и условий
- Интеграция с внешними системами
- Тестирование workflow

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

### Шаг 5: Назначение команды (TEAM_ASSIGNMENT)

**Frontend:** `TeamAssignment.tsx`
- Создание ролей и ответственностей
- Назначение ответственных за этапы
- Настройка прав доступа
- Создание обучающих материалов

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

### Шаг 6: Тестирование и оптимизация (TESTING_OPTIMIZATION)

**Frontend:** `TestingOptimization.tsx`
- Автоматическое тестирование workflow
- Симуляция различных сценариев
- Оптимизация производительности
- Настройка мониторинга

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
```

---

## 5. Система навигации и роутинга

### Автоматическая навигация
```typescript
// useBusinessSetupPageChangeEffectNavigateLocation.ts
const businessSetupPaths = [
  AppPath.BusinessAnalysis,
  AppPath.SalesFunnelDesign,
  AppPath.AgentSetup,
  AppPath.WorkflowCreation,
  AppPath.TeamAssignment,
  AppPath.TestingOptimization,
];

// Проверка текущего статуса и редирект
if (businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS) {
  return AppPath.BusinessAnalysis;
}
```

### Роутинг
```typescript
// useCreateAppRouter.tsx
<Route path={AppPath.BusinessAnalysis} element={<BusinessAnalysis />} />
<Route path={AppPath.SalesFunnelDesign} element={<SalesFunnelDesign />} />
<Route path={AppPath.AgentSetup} element={<AgentSetup />} />
<Route path={AppPath.WorkflowCreation} element={<WorkflowCreation />} />
<Route path={AppPath.TeamAssignment} element={<TeamAssignment />} />
<Route path={AppPath.TestingOptimization} element={<TestingOptimization />} />
```

---

## 6. Хранение состояния

### Backend (BusinessSetupVars):
```typescript
enum BusinessSetupStepKeys {
  BUSINESS_ANALYSIS_PENDING = 'BUSINESS_ANALYSIS_PENDING',
  SALES_FUNNEL_DESIGN_PENDING = 'SALES_FUNNEL_DESIGN_PENDING',
  AGENT_SETUP_PENDING = 'AGENT_SETUP_PENDING',
  WORKFLOW_CREATION_PENDING = 'WORKFLOW_CREATION_PENDING',
  TEAM_ASSIGNMENT_PENDING = 'TEAM_ASSIGNMENT_PENDING',
  TESTING_OPTIMIZATION_PENDING = 'TESTING_OPTIMIZATION_PENDING',
}
```

### Frontend (Recoil):
```typescript
// businessSetupState
export const businessSetupState = atom<BusinessSetupState | null>({
  key: 'businessSetupState',
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
```

---

## 7. AI агенты и их роли

### BusinessAnalysisAgent
```typescript
@Injectable()
export class BusinessAnalysisAgent {
  async execute(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(input);
    
    const result = await this.aiService.generateText({
      model: 'gpt-4o',
      prompt,
      temperature: 0.3,
      maxTokens: 2000,
    });
    
    return this.parseAnalysisResult(result.text);
  }
  
  private buildAnalysisPrompt(input: BusinessAnalysisInput): string {
    return `Analyze the following business and provide recommendations:
    
    Industry: ${input.industry}
    Company Size: ${input.companySize}
    Business Model: ${input.businessModel}
    Annual Revenue: ${input.annualRevenue}
    Employee Count: ${input.employeeCount}
    Target Market: ${input.targetMarket}
    
    Please provide:
    1. Industry analysis and trends
    2. Typical business processes for this type of business
    3. Recommended sales funnel structure
    4. Recommended AI agents for automation
    5. Estimated setup time and complexity
    `;
  }
}
```

### FunnelDesignerAgent
```typescript
@Injectable()
export class FunnelDesignerAgent {
  async execute(input: FunnelDesignInput): Promise<SalesFunnelDesign> {
    const prompt = this.buildFunnelDesignPrompt(input);
    
    const result = await this.aiService.generateObject({
      model: 'gpt-4o',
      prompt,
      schema: this.getFunnelDesignSchema(),
    });
    
    return result.object;
  }
  
  private getFunnelDesignSchema(): ZodSchema {
    return z.object({
      stages: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        conversionRate: z.number(),
        duration: z.number(),
        requiredActions: z.array(z.string()),
      })),
      transitions: z.array(z.object({
        fromStage: z.string(),
        toStage: z.string(),
        conditions: z.array(z.string()),
        probability: z.number(),
      })),
      kpis: z.array(z.object({
        name: z.string(),
        target: z.number(),
        unit: z.string(),
      })),
    });
  }
}
```

### AgentOrchestrationService
```typescript
@Injectable()
export class AgentOrchestrationService {
  async createStageAgent(input: CreateStageAgentInput): Promise<AgentEntity> {
    const agentPrompt = await this.generateAgentPrompt(input);
    
    const agent = await this.agentService.createAgent({
      name: `agent-${input.stage.name.toLowerCase()}`,
      label: `${input.stage.name} Agent`,
      description: `AI agent for ${input.stage.name} stage`,
      prompt: agentPrompt,
      modelId: 'gpt-4o',
      agentType: AgentType.STANDARD,
      responseFormat: this.createAgentResponseFormat(input),
      workspaceId: input.workspaceId,
      isCustom: true,
    });
    
    return agent;
  }
  
  private async generateAgentPrompt(input: CreateStageAgentInput): Promise<string> {
    return `You are an AI agent responsible for the ${input.stage.name} stage of the sales funnel.
    
    Stage Description: ${input.stage.description}
    Required Actions: ${input.stage.requiredActions.join(', ')}
    Business Context: ${JSON.stringify(input.businessContext)}
    
    Your role is to:
    1. Process leads at this stage
    2. Execute required actions
    3. Determine next steps
    4. Provide insights and recommendations
    
    Please respond in a structured format with clear actions and next steps.`;
  }
}
```

---

## 8. Workflow автоматизация

### WorkflowGeneratorAgent
```typescript
@Injectable()
export class WorkflowGeneratorAgent {
  async generateWorkflows(input: WorkflowGenerationInput): Promise<WorkflowGenerationResult> {
    const workflows = [];
    
    // Основной workflow для воронки продаж
    const mainWorkflow = await this.createMainSalesWorkflow(input);
    workflows.push(mainWorkflow);
    
    // Workflow для каждого этапа
    for (const stage of input.funnelStages) {
      const stageWorkflow = await this.createStageWorkflow(stage, input);
      workflows.push(stageWorkflow);
    }
    
    // Workflow для координации
    const coordinationWorkflow = await this.createCoordinationWorkflow(input);
    workflows.push(coordinationWorkflow);
    
    return { workflows };
  }
  
  private async createMainSalesWorkflow(input: WorkflowGenerationInput): Promise<Workflow> {
    return {
      name: 'Main Sales Funnel Workflow',
      description: 'Automated sales funnel workflow',
      trigger: {
        type: 'RECORD_CREATED',
        objectNameSingular: 'person',
      },
      steps: input.funnelStages.map(stage => ({
        id: `stage-${stage.id}`,
        name: stage.name,
        type: 'AI_AGENT',
        settings: {
          agentId: `agent-${stage.id}`,
          input: {
            stage: stage,
            person: '{{record}}',
          },
        },
      })),
    };
  }
}
```

---

## 9. Интеграции

### Интеграция с CRM системами
- Salesforce
- HubSpot
- Pipedrive
- Zoho CRM

### Интеграция с маркетинговыми инструментами
- Mailchimp
- ActiveCampaign
- ConvertKit
- Klaviyo

### Интеграция с аналитическими платформами
- Google Analytics
- Mixpanel
- Amplitude
- Hotjar

---

## 10. Производительность и оптимизация

### Lazy loading компонентов
```typescript
// React.lazy для Business Setup компонентов
const BusinessAnalysis = lazy(() => import('./pages/business-setup/BusinessAnalysis'));
const SalesFunnelDesign = lazy(() => import('./pages/business-setup/SalesFunnelDesign'));
const AgentSetup = lazy(() => import('./pages/business-setup/AgentSetup'));
```

### Кэширование результатов анализа
```typescript
// Redis caching для результатов анализа
@Injectable()
export class BusinessAnalysisCacheService {
  async getCachedAnalysis(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult | null> {
    const cacheKey = this.generateCacheKey(input);
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }
  
  async cacheAnalysis(input: BusinessAnalysisInput, result: BusinessAnalysisResult): Promise<void> {
    const cacheKey = this.generateCacheKey(input);
    await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 3600); // 1 hour
  }
}
```

---

## 11. Безопасность и валидация

### Валидация бизнес-данных
```typescript
// Zod схемы для валидации
const businessAnalysisSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  companySize: z.enum(['startup', 'sme', 'enterprise']),
  businessModel: z.string().min(1, 'Business model is required'),
  annualRevenue: z.number().positive('Annual revenue must be positive'),
  employeeCount: z.number().positive('Employee count must be positive'),
  targetMarket: z.string().min(1, 'Target market is required'),
});
```

### Безопасность AI агентов
```typescript
// Sanitization входных данных
@Injectable()
export class BusinessSetupSecurityService {
  sanitizeInput(input: any): any {
    return {
      ...input,
      industry: this.sanitizeString(input.industry),
      businessModel: this.sanitizeString(input.businessModel),
      targetMarket: this.sanitizeString(input.targetMarket),
    };
  }
  
  private sanitizeString(str: string): string {
    return str.replace(/[<>]/g, '').trim();
  }
}
```

---

## 12. Тестирование и качество кода

### Unit тесты для агентов
```typescript
describe('BusinessAnalysisAgent', () => {
  it('should analyze startup business correctly', async () => {
    const input = {
      industry: 'technology',
      companySize: 'startup',
      businessModel: 'saas',
      annualRevenue: 100000,
      employeeCount: 10,
      targetMarket: 'small businesses',
    };
    
    const result = await agent.execute(input);
    
    expect(result.industryAnalysis).toBeDefined();
    expect(result.funnelRecommendations).toHaveLength.greaterThan(0);
    expect(result.recommendedAgents).toContain('lead-qualification-agent');
  });
});
```

### E2E тесты для Business Setup flow
```typescript
describe('Business Setup Wizard E2E', () => {
  it('should complete full business setup flow', async () => {
    // Начинаем с анализа бизнеса
    await page.goto('/business-setup/analysis');
    await page.fill('[data-testid="industry"]', 'technology');
    await page.fill('[data-testid="company-size"]', 'startup');
    await page.click('[data-testid="next-step"]');
    
    // Проверяем переход к дизайну воронки
    await expect(page).toHaveURL('/business-setup/funnel-design');
    
    // Продолжаем flow...
  });
});
```

---

## 13. Масштабируемость и расширяемость

### Поддержка новых отраслей
```typescript
// Конфигурация отраслей
export const INDUSTRY_CONFIGS = {
  technology: {
    typicalFunnel: ['awareness', 'consideration', 'evaluation', 'purchase'],
    recommendedAgents: ['lead-qualification', 'demo-scheduler', 'technical-sales'],
    conversionRates: { awareness: 0.05, consideration: 0.15, evaluation: 0.30, purchase: 0.60 },
  },
  healthcare: {
    typicalFunnel: ['awareness', 'consultation', 'evaluation', 'treatment'],
    recommendedAgents: ['patient-intake', 'appointment-scheduler', 'care-coordinator'],
    conversionRates: { awareness: 0.03, consultation: 0.20, evaluation: 0.40, treatment: 0.70 },
  },
  // ... другие отрасли
};
```

### Расширение типов агентов
```typescript
// Новые типы агентов для специфических задач
enum SpecializedAgentType {
  LEAD_QUALIFICATION = 'LEAD_QUALIFICATION',
  DEMO_SCHEDULER = 'DEMO_SCHEDULER',
  TECHNICAL_SALES = 'TECHNICAL_SALES',
  CUSTOMER_SUCCESS = 'CUSTOMER_SUCCESS',
  ACCOUNT_MANAGEMENT = 'ACCOUNT_MANAGEMENT',
}
```

---

## 14. Архитектурные паттерны и принципы

### Паттерны проектирования
- **State Machine Pattern**: BusinessSetupStatus как конечный автомат
- **Observer Pattern**: Автоматическая навигация через useBusinessSetupPageChangeEffectNavigateLocation
- **Factory Pattern**: AgentOrchestrationService для создания агентов
- **Strategy Pattern**: Различные стратегии для разных отраслей
- **Repository Pattern**: BusinessSetupVarsService для работы с состоянием
- **Service Layer Pattern**: BusinessSetupService как центральный сервис

### Принципы SOLID
- **Single Responsibility**: Каждый агент отвечает за одну область
- **Open/Closed**: Система открыта для расширения, закрыта для модификации
- **Liskov Substitution**: Возможность замены реализаций агентов
- **Interface Segregation**: Тонкие интерфейсы для конкретных задач
- **Dependency Inversion**: Зависимость от абстракций, а не от конкретных классов

---

## 15. Детальный анализ кодовой базы

### Backend архитектура (NestJS)

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
  ) {}

  async getBusinessSetupStatus(user: User, workspace: Workspace) {
    // Получение состояния из BusinessSetupVars
    const userVars = await this.businessSetupVarsService.getAll({
      userId: user.id,
      workspaceId: workspace.id,
    });

    // Логика определения следующего шага
    const isBusinessAnalysisPending = userVars.get(BusinessSetupStepKeys.BUSINESS_ANALYSIS_PENDING) === true;
    const isSalesFunnelDesignPending = userVars.get(BusinessSetupStepKeys.SALES_FUNNEL_DESIGN_PENDING) === true;
    const isAgentSetupPending = userVars.get(BusinessSetupStepKeys.AGENT_SETUP_PENDING) === true;
    const isWorkflowCreationPending = userVars.get(BusinessSetupStepKeys.WORKFLOW_CREATION_PENDING) === true;
    const isTeamAssignmentPending = userVars.get(BusinessSetupStepKeys.TEAM_ASSIGNMENT_PENDING) === true;
    const isTestingOptimizationPending = userVars.get(BusinessSetupStepKeys.TESTING_OPTIMIZATION_PENDING) === true;

    if (isBusinessAnalysisPending) return BusinessSetupStatus.BUSINESS_ANALYSIS;
    if (isSalesFunnelDesignPending) return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
    if (isAgentSetupPending) return BusinessSetupStatus.AGENT_SETUP;
    if (isWorkflowCreationPending) return BusinessSetupStatus.WORKFLOW_CREATION;
    if (isTeamAssignmentPending) return BusinessSetupStatus.TEAM_ASSIGNMENT;
    if (isTestingOptimizationPending) return BusinessSetupStatus.TESTING_OPTIMIZATION;

    return BusinessSetupStatus.COMPLETED;
  }

  async executeBusinessAnalysis(input: BusinessAnalysisInput): Promise<BusinessAnalysisResult> {
    const result = await this.businessAnalysisAgent.execute(input);
    
    // Сохраняем результат
    await this.businessSetupVarsService.set({
      userId: input.userId,
      workspaceId: input.workspaceId,
      key: 'BUSINESS_ANALYSIS_RESULT',
      value: result,
    });
    
    // Переходим к следующему шагу
    await this.businessSetupVarsService.set({
      userId: input.userId,
      workspaceId: input.workspaceId,
      key: BusinessSetupStepKeys.SALES_FUNNEL_DESIGN_PENDING,
      value: true,
    });
    
    return result;
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
}
```

### Frontend архитектура (React + Recoil)

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
) => {
  if (currentUser?.businessSetupStatus === BusinessSetupStatus.BUSINESS_ANALYSIS) {
    return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.SALES_FUNNEL_DESIGN) {
    return BusinessSetupStatus.AGENT_SETUP;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.AGENT_SETUP) {
    return BusinessSetupStatus.WORKFLOW_CREATION;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.WORKFLOW_CREATION) {
    return BusinessSetupStatus.TEAM_ASSIGNMENT;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.TEAM_ASSIGNMENT) {
    return BusinessSetupStatus.TESTING_OPTIMIZATION;
  }

  if (currentUser?.businessSetupStatus === BusinessSetupStatus.TESTING_OPTIMIZATION) {
    return BusinessSetupStatus.COMPLETED;
  }

  return BusinessSetupStatus.COMPLETED;
};
```

---

## 16. Дополнительные технические детали

### GraphQL Schema и типизация

#### BusinessSetupStatus enum в GraphQL:
```graphql
enum BusinessSetupStatus {
  BUSINESS_ANALYSIS
  SALES_FUNNEL_DESIGN
  AGENT_SETUP
  WORKFLOW_CREATION
  TEAM_ASSIGNMENT
  TESTING_OPTIMIZATION
  COMPLETED
}
```

#### User entity с business setup статусом:
```typescript
@ObjectType()
export class User {
  @Field(() => BusinessSetupStatus, { nullable: true })
  businessSetupStatus: BusinessSetupStatus | null;
  
  @Field(() => [BusinessSetupVar], { nullable: true })
  businessSetupVars: BusinessSetupVar[];
}
```

### Валидация данных

#### Zod схемы для форм:
```typescript
// BusinessAnalysis validation
const businessAnalysisSchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  companySize: z.enum(['startup', 'sme', 'enterprise']),
  businessModel: z.string().min(1, 'Business model is required'),
  annualRevenue: z.number().positive('Annual revenue must be positive'),
  employeeCount: z.number().positive('Employee count must be positive'),
  targetMarket: z.string().min(1, 'Target market is required'),
});

// SalesFunnelDesign validation
const salesFunnelDesignSchema = z.object({
  stages: z.array(z.object({
    name: z.string().min(1, 'Stage name is required'),
    description: z.string().min(1, 'Stage description is required'),
    conversionRate: z.number().min(0).max(1),
    duration: z.number().positive(),
  })).min(2, 'At least 2 stages are required'),
});
```

---

## 17. Edge Cases и обработка ошибок

### Обработка неполных данных
```typescript
// Валидация входных данных
@Injectable()
export class BusinessSetupValidationService {
  async validateBusinessAnalysisInput(input: BusinessAnalysisInput): Promise<ValidationResult> {
    const errors = [];
    
    if (!input.industry) {
      errors.push('Industry is required');
    }
    
    if (!input.businessModel) {
      errors.push('Business model is required');
    }
    
    if (input.annualRevenue <= 0) {
      errors.push('Annual revenue must be positive');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
```

### Обработка ошибок AI агентов
```typescript
// Retry механизм для AI агентов
@Injectable()
export class BusinessSetupErrorHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw new BusinessSetupException(
            `Operation failed after ${maxRetries} attempts: ${error.message}`,
            BusinessSetupExceptionCode.AGENT_EXECUTION_FAILED,
          );
        }
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    
    throw lastError!;
  }
}
```

---

## 18. Производительность и мониторинг

### Performance Metrics

#### Business Setup timing:
```typescript
// Performance tracking
const measureBusinessSetupStep = (step: BusinessSetupStatus) => {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    analytics.track('business_setup_step_completed', {
      step,
      duration: endTime - startTime,
      timestamp: Date.now(),
    });
  };
};
```

#### AI Agent performance:
```typescript
// Agent performance monitoring
@Injectable()
export class BusinessSetupMetricsService {
  async trackAgentPerformance({
    agentId,
    step,
    executionTime,
    tokensUsed,
    success,
  }: AgentPerformanceMetrics): Promise<void> {
    await this.metricsService.track('business_setup_agent_performance', {
      agentId,
      step,
      executionTime,
      tokensUsed,
      success,
      timestamp: Date.now(),
    });
  }
}
```

---

## 19. Безопасность и соответствие

### Data Protection

#### GDPR compliance:
```typescript
// Data anonymization for business data
const anonymizeBusinessData = (data: BusinessAnalysisInput) => {
  return {
    ...data,
    companyName: `Company_${data.companyName?.substring(0, 3)}***`,
    annualRevenue: Math.floor(data.annualRevenue / 10000) * 10000, // Round to nearest 10k
  };
};
```

#### Data encryption:
```typescript
// Encrypt sensitive business data
@Column({ 
  type: 'varchar',
  transformer: {
    to: (value: string) => encrypt(value),
    from: (value: string) => decrypt(value)
  }
})
sensitiveBusinessData: string;
```

---

## 20. Развертывание и DevOps

### Docker Configuration

#### Multi-stage builds для Business Setup:
```dockerfile
# Dockerfile для Business Setup компонентов
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build:business-setup

FROM nginx:alpine
COPY --from=builder /app/dist/business-setup /usr/share/nginx/html
COPY nginx-business-setup.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### CI/CD Pipeline

#### GitHub Actions workflow:
```yaml
# .github/workflows/business-setup-tests.yml
name: Business Setup Tests

on:
  push:
    paths:
      - 'packages/twenty-front/src/pages/business-setup/**'
      - 'packages/twenty-server/src/engine/core-modules/business-setup/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run business setup tests
        run: npm run test:business-setup
      
      - name: Run E2E tests
        run: npm run test:e2e:business-setup
```

---

## 21. Анализ производительности

### Backend Performance Metrics

#### Database query optimization:
```typescript
// Оптимизированные queries для Business Setup
const getBusinessSetupStatusOptimized = async (userId: string, workspaceId: string) => {
  const result = await this.userRepository
    .createQueryBuilder('user')
    .leftJoinAndSelect('user.businessSetupVars', 'businessSetupVars')
    .where('user.id = :userId', { userId })
    .andWhere('businessSetupVars.workspaceId = :workspaceId', { workspaceId })
    .getOne();
    
  return result;
};
```

#### Caching strategies:
```typescript
// Redis caching для Business Setup результатов
@Injectable()
export class BusinessSetupCacheService {
  async getCachedAnalysis(input: BusinessAnalysisInput) {
    const cacheKey = `business_analysis:${this.hashInput(input)}`;
    const cached = await this.redisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const result = await this.businessAnalysisAgent.execute(input);
    await this.redisService.set(cacheKey, JSON.stringify(result), 'EX', 3600);
    
    return result;
  }
}
```

---

## 22. Рекомендации по улучшению

### Архитектурные улучшения

#### 1. Микросервисная архитектура
```typescript
// Разделение Business Setup на отдельные сервисы
@Injectable()
export class BusinessSetupMicroservi