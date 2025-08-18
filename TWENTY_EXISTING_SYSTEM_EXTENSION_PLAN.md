# Twenty Existing System Extension Plan

## Цель
Расширить существующую систему Twenty для поддержки продвинутой координации агентов, памяти и human-in-the-loop без внедрения LangGraph, используя минимальные изменения в существующей архитектуре.

## Текущая архитектура AI функционала Twenty

### **Обзор существующей AI системы**

Twenty имеет комплексную AI архитектуру, которая включает в себя несколько ключевых компонентов, работающих вместе для обеспечения AI-функциональности в CRM системе.

### **Backend AI архитектура**

#### **1. AI Module (`packages/twenty-server/src/engine/core-modules/ai/`)**

**Основные компоненты:**
- **AiService** - основной сервис для работы с AI моделями
- **AiModelRegistryService** - управление реестром AI моделей
- **AIBillingService** - биллинг и учет использования AI
- **ToolService** - сервис для работы с инструментами
- **ToolAdapterService** - адаптер для интеграции инструментов
- **McpService** - поддержка Model Context Protocol (MCP)

**Поддерживаемые AI провайдеры:**
```typescript
export enum ModelProvider {
  NONE = 'none',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENAI_COMPATIBLE = 'open_ai_compatible',
}
```

**Доступные модели:**
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo
- **Anthropic**: Claude Opus 4, Claude Sonnet 4, Claude Haiku 3.5
- **OpenAI-compatible**: кастомные модели через API

#### **2. AI Model Registry (`AiModelRegistryService`)**

**Функциональность:**
- Динамическая регистрация моделей на основе конфигурации
- Автоматическое определение доступных моделей по API ключам
- Поддержка кастомных OpenAI-совместимых моделей
- Управление стоимостью токенов для каждой модели

**Конфигурация моделей:**
```typescript
export interface AIModelConfig {
  modelId: ModelId;
  label: string;
  provider: ModelProvider;
  inputCostPer1kTokensInCents: number;
  outputCostPer1kTokensInCents: number;
}
```

#### **3. AI Billing System (`AIBillingService`)**

**Функциональность:**
- Расчет стоимости использования AI на основе токенов
- Интеграция с системой биллинга Twenty
- Учет использования через метрику `WORKFLOW_NODE_RUN`
- Конвертация стоимости в кредиты системы

**Процесс биллинга:**
1. Подсчет токенов (prompt, completion, total)
2. Расчет стоимости в центах
3. Конвертация в доллары и кредиты
4. Отправка события в систему биллинга

#### **4. AI Controllers**

**AiController (`/chat`):**
- Streaming API для чата с AI
- Поддержка параметров temperature и maxTokens
- Проверка feature flags для AI функциональности
- Обработка ошибок и валидация

**McpController (`/mcp`):**
- Поддержка Model Context Protocol
- Интеграция с внешними инструментами
- Управление доступом к инструментам через роли
- JSON-RPC API для MCP серверов

### **Agent System Architecture**

#### **1. Agent Entity (`AgentEntity`)**

**Структура агента:**
```typescript
@Entity('agent')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  label: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: false, type: 'text' })
  prompt: string;

  @Column({ nullable: false, type: 'varchar', default: 'auto' })
  modelId: ModelId;

  @Column({ nullable: true, type: 'jsonb' })
  responseFormat: object;  // Ключевое поле для расширения

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ default: false })
  isCustom: boolean;
}
```

#### **2. Agent Execution Service (`AgentExecutionService`)**

**Основные функции:**
- Выполнение агентов с поддержкой инструментов
- Обработка файлов и контекста
- Интеграция с AI моделями
- Управление токенами и биллингом

**Процесс выполнения:**
1. Подготовка конфигурации AI запроса
2. Выполнение через AI модель
3. Обработка структурированного вывода
4. Возврат результата с метриками использования

#### **3. Agent Chat System**

**Компоненты:**
- **AgentChatService** - управление чат-потоками
- **AgentStreamingService** - streaming ответы агентов
- **AgentTitleGenerationService** - генерация заголовков чатов
- **AgentHandoffService** - передача между агентами

**Функциональность:**
- Создание и управление чат-потоками
- Streaming ответы в реальном времени
- Поддержка файлов и контекста
- Автоматическая генерация заголовков

### **Tool System Architecture**

#### **1. Tool Registry (`ToolRegistryService`)**

**Поддерживаемые инструменты:**
- **HTTP_REQUEST** - HTTP запросы к внешним API
- **SEND_EMAIL** - отправка email через подключенные аккаунты

**Структура инструмента:**
```typescript
export type Tool = {
  description: string;
  parameters: JSONSchema7 | ZodType;
  execute(input: ToolInput): Promise<ToolOutput>;
  flag?: PermissionFlagType;
};
```

#### **2. Tool Integration**

**HTTP Tool:**
- Поддержка всех HTTP методов (GET, POST, PUT, PATCH, DELETE)
- Настраиваемые заголовки и тело запроса
- Обработка ошибок и валидация

**Email Tool:**
- Интеграция с подключенными email аккаунтами
- Поддержка HTML и plain text
- Валидация email адресов
- Санитизация контента

### **Workflow Integration**

#### **1. AI Agent Workflow Action (`AiAgentWorkflowAction`)**

**Интеграция с workflow системой:**
- Поддержка типа действия `AI_AGENT`
- Выполнение агентов в контексте workflow
- Автоматический биллинг через `AIBillingService`
- Обработка ошибок и возврат результатов

**Процесс выполнения:**
1. Получение агента по ID
2. Выполнение через `AgentExecutionService`
3. Биллинг использования
4. Возврат результата в workflow

#### **2. Workflow Action Factory**

**Поддерживаемые типы действий:**
- `CODE` - выполнение серверных функций
- `CREATE_RECORD` - создание записей
- `UPDATE_RECORD` - обновление записей
- `DELETE_RECORD` - удаление записей
- `FIND_RECORDS` - поиск записей
- `FORM` - формы с human-in-the-loop
- `FILTER` - фильтрация данных
- `HTTP_REQUEST` - HTTP запросы
- `SEND_EMAIL` - отправка email
- `AI_AGENT` - выполнение AI агентов

### **Frontend AI Architecture**

#### **1. AI Chat Components**

**Основные компоненты:**
- **AIChatTab** - основной интерфейс чата
- **AIChatMessage** - отображение сообщений
- **AIChatThreadsList** - список чат-потоков
- **AIChatEmptyState** - пустое состояние

**Функциональность:**
- Streaming ответы в реальном времени
- Поддержка файлов (drag & drop)
- Контекст записей и объектов
- Управление чат-потоками

#### **2. AI Hooks and State Management**

**useAgentChat Hook:**
- Управление состоянием чата
- Streaming сообщения
- Обработка файлов
- Интеграция с GraphQL

**State Management:**
- Recoil для управления состоянием
- Компонентные состояния для изоляции
- Оптимистичные обновления
- Кэширование сообщений

#### **3. Workflow AI Integration**

**WorkflowEditActionAiAgent:**
- Редактирование AI агентов в workflow
- Выбор агентов из списка
- Настройка промптов
- Конфигурация output schema

**Workflow Visualization:**
- Отображение AI агентов в диаграмме
- Статусы выполнения
- Интеграция с workflow runner

### **Database Schema**

#### **1. Agent Tables**

**agent:**
- Основная таблица агентов
- Поддержка workspace isolation
- JSONB поле responseFormat для расширения

**agent_chat_thread:**
- Чат-потоки агентов
- Связь с пользователями и агентами

**agent_chat_message:**
- Сообщения в чатах
- Поддержка ролей (USER, ASSISTANT)
- Связь с файлами

**agent_handoff:**
- Передача между агентами
- Конфигурация handoff правил

#### **2. AI Usage Tracking**

**Интеграция с биллингом:**
- События `WORKFLOW_NODE_RUN`
- Учет токенов и стоимости
- Метрики использования по workspace

### **Security and Permissions**

#### **1. Feature Flags**

**AI Feature Flags:**
- `IS_AI_ENABLED` - включение AI функциональности
- `IS_WORKFLOW_BRANCH_ENABLED` - поддержка ветвления workflow

#### **2. Permission System**

**AI Permissions:**
- Роли для доступа к AI функциям
- Разрешения для инструментов
- Workspace-level изоляция

#### **3. API Security**

**Authentication:**
- JWT токены для пользователей
- API ключи для внешних интеграций
- Workspace-level авторизация

### **Integration Points**

#### **1. External AI Providers**

**OpenAI Integration:**
- Поддержка GPT-4o, GPT-4o Mini, GPT-4 Turbo
- Конфигурация через API ключи
- Автоматическое определение доступных моделей

**Anthropic Integration:**
- Поддержка Claude моделей
- Интеграция через официальный SDK
- Управление токенами и стоимостью

**OpenAI-compatible:**
- Поддержка кастомных моделей
- Конфигурация base URL и API ключей
- Гибкая настройка моделей

#### **2. MCP (Model Context Protocol)**

**MCP Server:**
- JSON-RPC API для внешних инструментов
- Интеграция с Twenty объектами
- Управление доступом через роли

**Tool Integration:**
- Динамическое подключение инструментов
- Валидация параметров
- Обработка результатов

### **Current Limitations and Extension Points**

#### **1. Existing Limitations**

**Agent Coordination:**
- Нет встроенной координации между агентами
- Отсутствует система памяти агентов
- Нет поддержки сложных workflow с множественными агентами

**Memory System:**
- Отсутствует персистентная память агентов
- Нет контекста между сессиями
- Ограниченная история взаимодействий

**Human-in-the-loop:**
- Базовая поддержка через FORM действия
- Нет продвинутой интеграции с AI агентами
- Ограниченные возможности для human oversight

#### **2. Extension Opportunities**

**responseFormat Field:**
- Уже существует в AgentEntity
- Поддерживает JSONB структуры
- Готов для расширения типов агентов

**Workflow System:**
- Готовая инфраструктура для действий
- Поддержка состояний и восстановления
- Интеграция с биллингом

**Tool System:**
- Расширяемая архитектура инструментов
- Поддержка permissions и валидации
- Готовность для новых типов инструментов

## Принципы архитектуры

### **Ключевые принципы:**
1. **Минимальные изменения** - максимальное использование существующей инфраструктуры
2. **Постепенное внедрение** - возможность включения новых возможностей поэтапно
3. **Обратная совместимость** - существующие агенты продолжают работать без изменений
4. **Интеграция с существующими системами** - использование workflow, биллинга и UI
5. **Модульность** - четкое разделение ответственности между компонентами

### **Архитектурная схема:**
```
Twenty Core System (неизменный)
├── WorkflowModule (расширенный)
├── AgentModule (расширенный)
│   ├── AgentEntity (расширенный)
│   ├── AgentExecutionService (расширенный)
│   ├── AgentMemoryService (новый)
│   ├── AgentCoordinationService (новый)
│   └── AgentSupervisorService (новый)
├── AiModule (неизменный)
└── Database (расширенный)
    ├── agent_memory (новая таблица)
    └── agent (расширенная таблица)
```

## Анализ существующей архитектуры Twenty

### **Ключевые компоненты:**

#### **1. Agent Entity (`packages/twenty-server/src/engine/metadata-modules/agent/agent.entity.ts`)**
```typescript
@Entity('agent')
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  label: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: false, type: 'text' })
  prompt: string;

  @Column({ nullable: false, type: 'varchar', default: 'auto' })
  modelId: ModelId;

  @Column({ nullable: true, type: 'jsonb' })
  responseFormat: object;  // Ключевое поле для расширения

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ default: false })
  isCustom: boolean;
}
```

#### **2. Agent Execution Service (`packages/twenty-server/src/engine/metadata-modules/agent/agent-execution.service.ts`)**
```typescript
@Injectable()
export class AgentExecutionService {
  async executeAgent({
    agent,
    schema,
    userPrompt,
  }: {
    agent: AgentEntity | null;
    context: Record<string, unknown>;
    schema: OutputSchema;
    userPrompt: string;
  }): Promise<AgentExecutionResult>
}
```

#### **3. AI Agent Workflow Action (`packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action.ts`)**
```typescript
@Injectable()
export class AiAgentWorkflowAction implements WorkflowAction {
  async execute({
    currentStepId,
    steps,
    context,
  }: WorkflowActionInput): Promise<WorkflowActionOutput>
}
```

#### **4. AI Billing Service (`packages/twenty-server/src/engine/core-modules/ai/services/ai-billing.service.ts`)**
```typescript
@Injectable()
export class AIBillingService {
  async calculateAndBillUsage(
    modelId: ModelId,
    usage: TokenUsage,
    workspaceId: string,
  ): Promise<void>
}
```

### **Существующие возможности:**
- ✅ Модульная архитектура с четким разделением ответственности
- ✅ Система workflow с типами действий (CODE, FORM, AI_AGENT, HTTP_REQUEST)
- ✅ Поддержка агентов с полем `responseFormat` для расширенной конфигурации
- ✅ Готовая система биллинга с метрикой `WORKFLOW_NODE_RUN`
- ✅ Human-in-the-loop через FORM действия с `pendingEvent: true`
- ✅ Система состояний workflow с восстановлением и обработкой ошибок
- ✅ Поддержка множественных AI провайдеров (OpenAI, Anthropic, OpenAI-compatible)

## Детальный план реализации

### **Этап 1: Расширение типов агентов (1 неделя)**

#### **Шаг 1.1: Создать типы агентов**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/types/agent-type.enum.ts
export enum AgentType {
  STANDARD = 'STANDARD',
  COORDINATOR = 'COORDINATOR',  // Новый тип для координации
  SUPERVISOR = 'SUPERVISOR',    // Надзорные агенты
  MEMORY_ENABLED = 'MEMORY_ENABLED', // Агенты с памятью
}

// packages/twenty-server/src/engine/metadata-modules/agent/types/agent-config.types.ts
export interface CoordinatorAgentConfig {
  type: 'COORDINATOR';
  coordination: {
    agents: string[]; // ID агентов для координации
    strategy: 'SEQUENTIAL' | 'PARALLEL' | 'CONDITIONAL' | 'SUPERVISED';
    memory: {
      enabled: boolean;
      strategy: 'accumulate' | 'replace' | 'hybrid';
      maxHistoryLength?: number;
    };
    supervisor?: {
      enabled: boolean;
      supervisorAgentId: string;
      qualityThreshold: number;
    };
    humanInput?: {
      enabled: boolean;
      contextLevel: 'minimal' | 'detailed' | 'full';
      showAgentReasoning: boolean;
    };
    goals: {
      primaryGoal: string;
      successCriteria: string[];
      maxIterations: number;
      successThreshold: number;
    };
  };
}

export interface MemoryEnabledAgentConfig {
  type: 'MEMORY_ENABLED';
  memory: {
    strategy: 'accumulate' | 'replace' | 'hybrid';
    maxHistoryLength: number;
    maxSize: string; // '1MB', '512KB', etc.
  };
  context: {
    includePreviousDecisions: boolean;
    includeAgentHistory: boolean;
    includeWorkflowHistory: boolean;
  };
}

export type AgentResponseFormat = 
  | object // Для стандартных агентов
  | CoordinatorAgentConfig
  | MemoryEnabledAgentConfig;
```

#### **Шаг 1.2: Обновить Agent Entity**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/agent.entity.ts
@Entity('agent')
export class AgentEntity {
  // ... существующие поля

  @Column({ nullable: false, type: 'varchar', default: 'STANDARD' })
  agentType: AgentType;

  @Column({ nullable: true, type: 'jsonb' })
  responseFormat: AgentResponseFormat;

  // ... остальные поля
}
```

#### **Шаг 1.3: Обновить DTOs**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/dtos/agent.dto.ts
@ObjectType('Agent')
export class AgentDTO {
  // ... существующие поля

  @Field(() => String)
  agentType: AgentType;

  @Field(() => GraphQLJSON, { nullable: true })
  responseFormat: AgentResponseFormat;

  // ... остальные поля
}

// packages/twenty-server/src/engine/metadata-modules/agent/dtos/create-agent.input.ts
@InputType()
export class CreateAgentInput {
  // ... существующие поля

  @IsString()
  @IsOptional()
  @Field(() => String, { nullable: true })
  agentType?: AgentType;

  @IsObject()
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  responseFormat?: AgentResponseFormat;

  // ... остальные поля
}
```

### **Этап 2: Создание системы памяти агентов (1 неделя)**

#### **Шаг 2.1: Создать AgentMemoryEntity**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/entities/agent-memory.entity.ts
@Entity('agent_memory')
export class AgentMemoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  agentId: string;

  @Column({ type: 'jsonb' })
  data: AgentMemory;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => AgentEntity, agent => agent.memories)
  @JoinColumn({ name: 'agentId' })
  agent: AgentEntity;
}

// packages/twenty-server/src/engine/metadata-modules/agent/types/agent-memory.types.ts
export interface AgentMemory {
  previousDecisions: Decision[];
  agentHistory: AgentInteraction[];
  workflowHistory: WorkflowStep[];
  learningPatterns: Pattern[];
}

export interface Decision {
  decision: any;
  timestamp: Date;
  context?: Record<string, unknown>;
  confidence?: number;
}

export interface AgentInteraction {
  prompt: string;
  result: any;
  timestamp: Date;
  executionTime?: number;
  tokensUsed?: number;
}

export interface WorkflowStep {
  stepId: string;
  workflowRunId: string;
  action: string;
  result: any;
  timestamp: Date;
}

export interface Pattern {
  type: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
}
```

#### **Шаг 2.2: Создать AgentMemoryService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/agent-memory.service.ts
@Injectable()
export class AgentMemoryService {
  private readonly MAX_MEMORY_SIZE = 1024 * 1024; // 1MB per agent
  private readonly MAX_HISTORY_LENGTH = 1000;

  constructor(
    @InjectRepository(AgentMemoryEntity, 'core')
    private readonly memoryRepository: Repository<AgentMemoryEntity>,
    private readonly logger: Logger,
  ) {}

  async loadAgentMemory(agentId: string): Promise<AgentMemory> {
    const memory = await this.memoryRepository.findOne({
      where: { agentId }
    });
    
    if (!memory) {
      return this.createEmptyMemory();
    }

    // Проверяем размер памяти
    const memorySize = JSON.stringify(memory.data).length;
    if (memorySize > this.MAX_MEMORY_SIZE) {
      // Очищаем старые записи
      await this.cleanupMemory(agentId);
    }

    return memory.data;
  }

  async updateAgentMemory(agentId: string, memory: AgentMemory): Promise<void> {
    // Проверяем размер перед сохранением
    const memorySize = JSON.stringify(memory).length;
    if (memorySize > this.MAX_MEMORY_SIZE) {
      await this.cleanupMemory(agentId);
      memory = await this.loadAgentMemory(agentId);
    }

    await this.memoryRepository.upsert({
      agentId,
      data: memory,
      updatedAt: new Date()
    }, { conflictPaths: ['agentId'] });
  }

  async updateMemoryWithStrategy(
    agentId: string,
    newMemory: Partial<AgentMemory>,
    strategy: 'accumulate' | 'replace' | 'hybrid'
  ): Promise<void> {
    const currentMemory = await this.loadAgentMemory(agentId);
    
    let updatedMemory: AgentMemory;
    
    switch (strategy) {
      case 'accumulate':
        updatedMemory = {
          previousDecisions: [...currentMemory.previousDecisions, ...(newMemory.previousDecisions || [])],
          agentHistory: [...currentMemory.agentHistory, ...(newMemory.agentHistory || [])],
          workflowHistory: [...currentMemory.workflowHistory, ...(newMemory.workflowHistory || [])],
          learningPatterns: [...currentMemory.learningPatterns, ...(newMemory.learningPatterns || [])],
        };
        break;
      case 'replace':
        updatedMemory = {
          ...currentMemory,
          ...newMemory,
        };
        break;
      case 'hybrid':
        updatedMemory = {
          previousDecisions: [...currentMemory.previousDecisions.slice(-10), ...(newMemory.previousDecisions || [])],
          agentHistory: [...currentMemory.agentHistory.slice(-20), ...(newMemory.agentHistory || [])],
          workflowHistory: [...currentMemory.workflowHistory.slice(-10), ...(newMemory.workflowHistory || [])],
          learningPatterns: [...currentMemory.learningPatterns, ...(newMemory.learningPatterns || [])],
        };
        break;
      default:
        updatedMemory = currentMemory;
    }

    await this.updateAgentMemory(agentId, updatedMemory);
  }

  private async cleanupMemory(agentId: string): Promise<void> {
    const memory = await this.loadAgentMemory(agentId);
    
    // Оставляем только последние записи
    const cleanedMemory = {
      ...memory,
      previousDecisions: memory.previousDecisions.slice(-this.MAX_HISTORY_LENGTH),
      agentHistory: memory.agentHistory.slice(-this.MAX_HISTORY_LENGTH),
      workflowHistory: memory.workflowHistory.slice(-this.MAX_HISTORY_LENGTH),
    };

    await this.updateAgentMemory(agentId, cleanedMemory);
  }

  private createEmptyMemory(): AgentMemory {
    return {
      previousDecisions: [],
      agentHistory: [],
      workflowHistory: [],
      learningPatterns: [],
    };
  }
}
```

### **Этап 3: Создание сервиса координации агентов (1 неделя)**

#### **Шаг 3.1: Создать AgentCoordinationService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/agent-coordination.service.ts
@Injectable()
export class AgentCoordinationService {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentMemoryService: AgentMemoryService,
    private readonly agentSupervisorService: AgentSupervisorService,
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
    private readonly logger: Logger,
  ) {}

  async executeCoordination({
    coordinatorAgent,
    config,
    context,
    userPrompt,
    schema,
  }: {
    coordinatorAgent: AgentEntity;
    config: CoordinatorAgentConfig['coordination'];
    context: Record<string, unknown>;
    userPrompt: string;
    schema: OutputSchema;
  }): Promise<AgentExecutionResult> {
    const agents = await this.loadAgents(config.agents);
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let results: any[] = [];
    let iterationCount = 0;

    while (iterationCount < config.goals.maxIterations) {
      switch (config.strategy) {
        case 'SEQUENTIAL':
          results = await this.executeSequential(agents, context, userPrompt, schema);
          break;
        case 'PARALLEL':
          results = await this.executeParallel(agents, context, userPrompt, schema);
          break;
        case 'SUPERVISED':
          results = await this.executeSupervised(agents, config.supervisor!, context, userPrompt, schema);
          break;
        case 'CONDITIONAL':
          results = await this.executeConditional(agents, context, userPrompt, schema);
          break;
      }

      // Обновляем память если включена
      if (config.memory.enabled) {
        await this.updateCoordinationMemory(coordinatorAgent.id, results, config.memory.strategy);
      }

      // Проверяем достижение цели
      const goalProgress = this.calculateGoalProgress(results, config.goals);
      if (goalProgress >= config.goals.successThreshold) {
        break;
      }

      // Проверяем необходимость human input
      if (config.humanInput?.enabled && this.needsHumanInput(results)) {
        throw new HumanInputRequiredException('coordination', {
          currentResults: results,
          goalProgress,
          agentReasoning: config.humanInput.showAgentReasoning ? this.extractAgentReasoning(results) : null,
        });
      }

      iterationCount++;
    }

    // Объединяем результаты
    const finalResult = this.combineResults(results, config.strategy);
    
    return {
      result: finalResult,
      usage: totalUsage,
    };
  }

  private async loadAgents(agentIds: string[]): Promise<AgentEntity[]> {
    const agents = await this.agentRepository.find({
      where: { id: In(agentIds) }
    });

    if (agents.length !== agentIds.length) {
      const foundIds = agents.map(a => a.id);
      const missingIds = agentIds.filter(id => !foundIds.includes(id));
      throw new Error(`Agents not found: ${missingIds.join(', ')}`);
    }

    return agents;
  }

  private async executeSequential(
    agents: AgentEntity[],
    context: Record<string, unknown>,
    userPrompt: string,
    schema: OutputSchema,
  ): Promise<any[]> {
    const results = [];
    let currentContext = context;

    for (const agent of agents) {
      const result = await this.agentExecutionService.executeAgent({
        agent,
        context: currentContext,
        schema,
        userPrompt,
      });
      
      results.push(result.result);
      currentContext = { ...currentContext, ...result.result };
    }

    return results;
  }

  private async executeParallel(
    agents: AgentEntity[],
    context: Record<string, unknown>,
    userPrompt: string,
    schema: OutputSchema,
  ): Promise<any[]> {
    const promises = agents.map(agent =>
      this.agentExecutionService.executeAgent({
        agent,
        context,
        schema,
        userPrompt,
      })
    );

    const results = await Promise.all(promises);
    return results.map(r => r.result);
  }

  private async executeSupervised(
    agents: AgentEntity[],
    supervisorConfig: any,
    context: Record<string, unknown>,
    userPrompt: string,
    schema: OutputSchema,
  ): Promise<any[]> {
    // Выполняем агентов
    const results = await this.executeParallel(agents, context, userPrompt, schema);
    
    // Проверяем качество через супервизора
    const supervisorAgent = await this.agentRepository.findOne({
      where: { id: supervisorConfig.supervisorAgentId }
    });

    if (supervisorAgent) {
      const qualityCheck = await this.agentSupervisorService.checkQuality(
        supervisorAgent,
        results,
        supervisorConfig.qualityThreshold
      );

      if (!qualityCheck.passed) {
        // Повторяем выполнение с улучшениями
        return await this.executeSupervised(agents, supervisorConfig, context, userPrompt, schema);
      }
    }

    return results;
  }

  private async executeConditional(
    agents: AgentEntity[],
    context: Record<string, unknown>,
    userPrompt: string,
    schema: OutputSchema,
  ): Promise<any[]> {
    // Логика условного выполнения
    const results = [];
    
    for (const agent of agents) {
      const shouldExecute = this.evaluateCondition(agent, context);
      if (shouldExecute) {
        const result = await this.agentExecutionService.executeAgent({
          agent,
          context,
          schema,
          userPrompt,
        });
        results.push(result.result);
      }
    }

    return results;
  }

  private calculateGoalProgress(results: any[], goals: any): number {
    // Логика расчета прогресса цели
    return Math.min(results.length / goals.maxIterations, 1);
  }

  private needsHumanInput(results: any[]): boolean {
    // Логика определения необходимости human input
    return false; // Placeholder
  }

  private extractAgentReasoning(results: any[]): any[] {
    // Извлечение рассуждений агентов
    return results.map(result => ({ reasoning: result.reasoning || 'No reasoning provided' }));
  }

  private combineResults(results: any[], strategy: string): any {
    switch (strategy) {
      case 'SEQUENTIAL':
        return results[results.length - 1]; // Последний результат
      case 'PARALLEL':
        return { combinedResults: results };
      case 'SUPERVISED':
        return { supervisedResults: results };
      default:
        return results;
    }
  }

  private evaluateCondition(agent: AgentEntity, context: Record<string, unknown>): boolean {
    // Логика оценки условий для выполнения агента
    return true; // Placeholder
  }

  private async updateCoordinationMemory(
    agentId: string,
    results: any[],
    strategy: 'accumulate' | 'replace' | 'hybrid'
  ): Promise<void> {
    const newMemory: Partial<AgentMemory> = {
      previousDecisions: results.map(result => ({
        decision: result,
        timestamp: new Date(),
        confidence: 0.8, // Placeholder
      })),
    };

    await this.agentMemoryService.updateMemoryWithStrategy(agentId, newMemory, strategy);
  }
}
```

#### **Шаг 3.2: Создать AgentSupervisorService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/agent-supervisor.service.ts
@Injectable()
export class AgentSupervisorService {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly logger: Logger,
  ) {}

  async checkQuality(
    supervisorAgent: AgentEntity,
    results: any[],
    qualityThreshold: number
  ): Promise<QualityCheckResult> {
    try {
      const qualityPrompt = this.buildQualityCheckPrompt(results);
      
      const qualityCheck = await this.agentExecutionService.executeAgent({
        agent: supervisorAgent,
        context: { results },
        schema: {
          qualityScore: { type: 'number' },
          issues: { type: 'array' },
          recommendations: { type: 'array' },
        },
        userPrompt: qualityPrompt,
      });

      const qualityScore = qualityCheck.result.qualityScore || 0;
      const passed = qualityScore >= qualityThreshold;

      return {
        passed,
        qualityScore,
        issues: qualityCheck.result.issues || [],
        recommendations: qualityCheck.result.recommendations || [],
      };
    } catch (error) {
      this.logger.error('Quality check failed', error);
      return {
        passed: true, // По умолчанию пропускаем при ошибке
        qualityScore: 1.0,
        issues: [],
        recommendations: [],
      };
    }
  }

  private buildQualityCheckPrompt(results: any[]): string {
    return `Analyze the following agent results and provide a quality assessment:

Results to analyze:
${JSON.stringify(results, null, 2)}

Please evaluate:
1. Accuracy and relevance of the results
2. Completeness of the information
3. Logical consistency
4. Adherence to the original request

Provide a quality score from 0 to 1, where 1 is perfect quality.`;
  }
}

export interface QualityCheckResult {
  passed: boolean;
  qualityScore: number;
  issues: string[];
  recommendations: string[];
}
```

### **Этап 4: Расширение AgentExecutionService (1 неделя)**

#### **Шаг 4.1: Обновить AgentExecutionService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/agent-execution.service.ts
@Injectable()
export class AgentExecutionService {
  constructor(
    // ... существующие зависимости
    private readonly agentMemoryService: AgentMemoryService,
    private readonly agentCoordinationService: AgentCoordinationService,
    private readonly agentSupervisorService: AgentSupervisorService,
  ) {}

  async executeAgent({
    agent,
    schema,
    userPrompt,
    context,
  }: {
    agent: AgentEntity | null;
    context: Record<string, unknown>;
    schema: OutputSchema;
    userPrompt: string;
  }): Promise<AgentExecutionResult> {
    try {
      // Проверяем тип агента
      if (agent?.agentType === AgentType.COORDINATOR) {
        return await this.executeCoordinatorAgent(agent, context, schema, userPrompt);
      }

      if (agent?.agentType === AgentType.MEMORY_ENABLED) {
        return await this.executeMemoryEnabledAgent(agent, context, schema, userPrompt);
      }

      if (agent?.agentType === AgentType.SUPERVISOR) {
        return await this.executeSupervisorAgent(agent, context, schema, userPrompt);
      }

      // Существующая логика для STANDARD агентов
      return await this.executeStandardAgent(agent, context, schema, userPrompt);

    } catch (error) {
      if (error instanceof HumanInputRequiredException) {
        throw error;
      }
      
      throw new AgentException(
        error instanceof Error ? error.message : 'Agent execution failed',
        AgentExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }
  }

  private async executeCoordinatorAgent(
    agent: AgentEntity,
    context: Record<string, unknown>,
    schema: OutputSchema,
    userPrompt: string,
  ): Promise<AgentExecutionResult> {
    const config = agent.responseFormat as CoordinatorAgentConfig;
    
    return await this.agentCoordinationService.executeCoordination({
      coordinatorAgent: agent,
      config: config.coordination,
      context,
      userPrompt,
      schema,
    });
  }

  private async executeMemoryEnabledAgent(
    agent: AgentEntity,
    context: Record<string, unknown>,
    schema: OutputSchema,
    userPrompt: string,
  ): Promise<AgentExecutionResult> {
    const config = agent.responseFormat as MemoryEnabledAgentConfig;
    
    // Загружаем память агента
    const memory = await this.agentMemoryService.loadAgentMemory(agent.id);
    
    // Обогащаем контекст памятью
    const enrichedContext = {
      ...context,
      agentMemory: memory,
      previousDecisions: config.context.includePreviousDecisions ? memory.previousDecisions : [],
      agentHistory: config.context.includeAgentHistory ? memory.agentHistory : [],
      workflowHistory: config.context.includeWorkflowHistory ? memory.workflowHistory : [],
    };

    // Выполняем стандартного агента с обогащенным контекстом
    const result = await this.executeStandardAgent(agent, enrichedContext, schema, userPrompt);
    
    // Сохраняем обновленную память
    await this.agentMemoryService.updateMemoryWithStrategy(agent.id, {
      previousDecisions: [{
        decision: result.result,
        timestamp: new Date(),
        context: enrichedContext,
        confidence: 0.8, // Placeholder
      }],
      agentHistory: [{
        prompt: userPrompt,
        result: result.result,
        timestamp: new Date(),
        executionTime: Date.now(), // Placeholder
        tokensUsed: result.usage.totalTokens,
      }],
    }, config.memory.strategy);

    return result;
  }

  private async executeSupervisorAgent(
    agent: AgentEntity,
    context: Record<string, unknown>,
    schema: OutputSchema,
    userPrompt: string,
  ): Promise<AgentExecutionResult> {
    // Супервизорные агенты выполняются как стандартные, но с дополнительной логикой
    return await this.executeStandardAgent(agent, context, schema, userPrompt);
  }

  private async executeStandardAgent(
    agent: AgentEntity | null,
    context: Record<string, unknown>,
    schema: OutputSchema,
    userPrompt: string,
  ): Promise<AgentExecutionResult> {
    // Существующая логика выполнения стандартных агентов
    const aiRequestConfig = await this.prepareAIRequestConfig({
      system: `You are executing as part of a workflow automation. ${agent ? agent.prompt : ''}`,
      agent,
      prompt: userPrompt,
    });
    
    const textResponse = await generateText(aiRequestConfig);

    if (Object.keys(schema).length === 0) {
      return {
        result: { response: textResponse.text },
        usage: textResponse.usage,
      };
    }
    
    const output = await generateObject({
      system: AGENT_SYSTEM_PROMPTS.OUTPUT_GENERATOR,
      model: aiRequestConfig.model,
      prompt: `Based on the following execution results, generate the structured output according to the schema:

               Execution Results: ${textResponse.text}

               Please generate the structured output based on the execution results and context above.`,
      schema: convertOutputSchemaToZod(schema),
    });

    return {
      result: output.object,
      usage: {
        promptTokens:
          (textResponse.usage?.promptTokens ?? 0) +
          (output.usage?.promptTokens ?? 0),
        completionTokens:
          (textResponse.usage?.completionTokens ?? 0) +
          (output.usage?.completionTokens ?? 0),
        totalTokens:
          (textResponse.usage?.totalTokens ?? 0) +
          (output.usage?.totalTokens ?? 0),
      },
    };
  }
}
```

#### **Шаг 4.2: Создать HumanInputRequiredException**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/exceptions/human-input-required.exception.ts
export class HumanInputRequiredException extends Error {
  constructor(
    public readonly context: string,
    public readonly humanContext: any,
    message: string = 'Human input required'
  ) {
    super(message);
    this.name = 'HumanInputRequiredException';
  }
}
```

## Дополнительные компоненты для агента-супервизора после онбординга

### **Этап 5: Создание системы статусов клиентов (1 неделя)**

#### **Шаг 5.1: Создать ClientStatusEntity**
```typescript
// packages/twenty-server/src/engine/metadata-modules/client-status/client-status.entity.ts
@Entity('client_status')
export class ClientStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  label: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: object; // Дополнительные данные статуса

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// packages/twenty-server/src/engine/metadata-modules/client-status/types/client-status.types.ts
export interface ClientStatusMetadata {
  category: 'prospect' | 'lead' | 'customer' | 'churned';
  lifecycleStage: 'awareness' | 'consideration' | 'decision' | 'retention';
  engagementLevel: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  nextActions: string[];
  recommendedAgents: string[];
}
```

#### **Шаг 5.2: Создать ClientStatusService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/client-status/client-status.service.ts
@Injectable()
export class ClientStatusService {
  constructor(
    @InjectRepository(ClientStatusEntity, 'core')
    private readonly clientStatusRepository: Repository<ClientStatusEntity>,
    private readonly logger: Logger,
  ) {}

  async createClientStatus({
    name,
    label,
    description,
    workspaceId,
    priority,
    metadata,
  }: {
    name: string;
    label: string;
    description?: string;
    workspaceId: string;
    priority?: number;
    metadata?: ClientStatusMetadata;
  }): Promise<ClientStatusEntity> {
    const clientStatus = this.clientStatusRepository.create({
      name,
      label,
      description,
      workspaceId,
      priority: priority || 0,
      metadata,
    });

    return await this.clientStatusRepository.save(clientStatus);
  }

  async getClientStatusesByWorkspace(workspaceId: string): Promise<ClientStatusEntity[]> {
    return await this.clientStatusRepository.find({
      where: { workspaceId, isActive: true },
      order: { priority: 'ASC' },
    });
  }

  async updateClientStatus(
    id: string,
    updates: Partial<ClientStatusEntity>
  ): Promise<ClientStatusEntity> {
    await this.clientStatusRepository.update(id, updates);
    return await this.clientStatusRepository.findOneOrFail({ where: { id } });
  }
}
```

### **Этап 6: Создание ClientSupervisorService (1 неделя)**

#### **Шаг 6.1: Создать ClientSupervisorService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/client-supervisor.service.ts
@Injectable()
export class ClientSupervisorService {
  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentMemoryService: AgentMemoryService,
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
    @InjectRepository(ClientStatusEntity, 'core')
    private readonly clientStatusRepository: Repository<ClientStatusEntity>,
    private readonly logger: Logger,
  ) {}

  async executeClientSupervision({
    supervisorAgent,
    clientData,
    context,
  }: {
    supervisorAgent: AgentEntity;
    clientData: {
      personId: string;
      companyId?: string;
      currentStatus: string;
      companySize?: string;
      industry?: string;
      annualRevenue?: number;
    };
    context: Record<string, unknown>;
  }): Promise<SupervisionResult> {
    const config = supervisorAgent.responseFormat as SupervisorAgentConfig;
    
    // Анализируем статус клиента
    const clientStatus = await this.analyzeClientStatus(clientData);
    
    // Определяем подходящих агентов
    const recommendedAgents = await this.getRecommendedAgents(
      config.supervision.clientStatusMapping,
      clientStatus
    );

    // Выполняем агентов в порядке приоритета
    const results = await this.executeAgentsByPriority(recommendedAgents, context);

    // Мониторим качество выполнения
    if (config.supervision.monitoring.enabled) {
      const qualityCheck = await this.monitorQuality(results, config.supervision.monitoring);
      
      if (!qualityCheck.passed && config.supervision.escalation.enabled) {
        return await this.handleEscalation(config.supervision.escalation, results, context);
      }
    }

    return {
      clientStatus,
      executedAgents: results.map(r => r.agentId),
      results,
      qualityScore: qualityCheck?.qualityScore || 1.0,
    };
  }

  private async analyzeClientStatus(clientData: any): Promise<ClientStatusAnalysis> {
    // Анализируем данные клиента и определяем оптимальный статус
    const analysis = {
      currentStatus: clientData.currentStatus,
      recommendedStatus: clientData.currentStatus, // По умолчанию
      confidence: 0.8,
      reasoning: '',
      riskFactors: [],
      opportunities: [],
    };

    // Логика анализа на основе данных клиента
    if (clientData.companySize === 'enterprise' && clientData.annualRevenue > 1000000) {
      analysis.recommendedStatus = 'enterprise_lead';
      analysis.confidence = 0.9;
      analysis.reasoning = 'Enterprise company with high revenue potential';
    } else if (clientData.companySize === 'startup') {
      analysis.recommendedStatus = 'startup_prospect';
      analysis.confidence = 0.7;
      analysis.reasoning = 'Startup company requiring specialized onboarding';
    } else if (clientData.companySize === 'sme') {
      analysis.recommendedStatus = 'sme_customer';
      analysis.confidence = 0.8;
      analysis.reasoning = 'SME company with growth potential';
    }

    return analysis;
  }

  private async getRecommendedAgents(
    statusMapping: any,
    clientStatus: ClientStatusAnalysis
  ): Promise<AgentEntity[]> {
    const statusConfig = statusMapping[clientStatus.recommendedStatus];
    if (!statusConfig) {
      return [];
    }

    const agents = await this.agentRepository.find({
      where: { id: In(statusConfig.agents) }
    });

    // Сортируем по приоритету
    return agents.sort((a, b) => {
      const aPriority = statusConfig.agents.indexOf(a.id);
      const bPriority = statusConfig.agents.indexOf(b.id);
      return aPriority - bPriority;
    });
  }

  private async executeAgentsByPriority(
    agents: AgentEntity[],
    context: Record<string, unknown>
  ): Promise<AgentExecutionResult[]> {
    const results = [];

    for (const agent of agents) {
      try {
        const result = await this.agentExecutionService.executeAgent({
          agent,
          context,
          schema: {},
          userPrompt: `Execute agent ${agent.name} for client supervision`,
        });
        
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          result: result.result,
          usage: result.usage,
          success: true,
        });
      } catch (error) {
        this.logger.error(`Agent ${agent.name} execution failed`, error);
        results.push({
          agentId: agent.id,
          agentName: agent.name,
          error: error.message,
          success: false,
        });
      }
    }

    return results;
  }

  private async monitorQuality(
    results: AgentExecutionResult[],
    monitoring: any
  ): Promise<QualityCheckResult> {
    // Проверяем качество выполнения агентов
    const successfulResults = results.filter(r => r.success);
    const qualityScore = successfulResults.length / results.length;

    return {
      passed: qualityScore >= monitoring.qualityThreshold,
      qualityScore,
      issues: results.filter(r => !r.success).map(r => r.error),
      recommendations: [],
    };
  }

  private async handleEscalation(
    escalation: any,
    results: AgentExecutionResult[],
    context: Record<string, unknown>
  ): Promise<SupervisionResult> {
    if (!escalation.escalationAgentId) {
      return { results, escalationHandled: false };
    }

    const escalationAgent = await this.agentRepository.findOne({
      where: { id: escalation.escalationAgentId }
    });

    if (escalationAgent) {
      const escalationResult = await this.agentExecutionService.executeAgent({
        agent: escalationAgent,
        context: { ...context, previousResults: results },
        schema: {},
        userPrompt: 'Handle escalation for failed agent supervision',
      });

      return {
        results: [...results, {
          agentId: escalationAgent.id,
          agentName: escalationAgent.name,
          result: escalationResult.result,
          usage: escalationResult.usage,
          success: true,
          isEscalation: true,
        }],
        escalationHandled: true,
      };
    }

    return { results, escalationHandled: false };
  }
}

export interface SupervisionResult {
  clientStatus: ClientStatusAnalysis;
  executedAgents: string[];
  results: AgentExecutionResult[];
  qualityScore: number;
  escalationHandled?: boolean;
}

export interface ClientStatusAnalysis {
  currentStatus: string;
  recommendedStatus: string;
  confidence: number;
  reasoning: string;
  riskFactors: string[];
  opportunities: string[];
}
```

### **Этап 7: Интеграция с системой onboarding (1 неделя)**

#### **Шаг 7.1: Создать OnboardingCompletedTrigger**
```typescript
// packages/twenty-server/src/modules/onboarding/triggers/onboarding-completed.trigger.ts
@Injectable()
export class OnboardingCompletedTrigger {
  constructor(
    private readonly workflowTriggerService: WorkflowTriggerWorkspaceService,
    private readonly clientSupervisorService: ClientSupervisorService,
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
      // Находим агента-супервизора для данного workspace
      const supervisorAgent = await this.agentService.findSupervisorAgent(workspaceId);
      
      if (!supervisorAgent) {
        this.logger.warn(`No supervisor agent found for workspace ${workspaceId}`);
        return;
      }

      // Анализируем данные пользователя
      const clientData = {
        personId: userId,
        companyId: userData.companyId,
        currentStatus: 'new_user',
        companySize: userData.companySize,
        industry: userData.industry,
        annualRevenue: userData.annualRevenue,
      };

      // Запускаем супервизию
      const supervisionResult = await this.clientSupervisorService.executeClientSupervision({
        supervisorAgent,
        clientData,
        context: {
          trigger: 'onboarding_completed',
          userData,
          workspaceId,
        },
      });

      // Запускаем workflow если есть результаты
      if (supervisionResult.executedAgents.length > 0) {
        await this.workflowTriggerService.triggerWorkflow({
          workspaceId,
          workflowId: 'post-onboarding-supervision',
          payload: {
            supervisionResult,
            clientData,
            triggerType: 'onboarding_completed',
          },
        });
      }

      this.logger.log(`Onboarding supervision completed for user ${userId} in workspace ${workspaceId}`);
    } catch (error) {
      this.logger.error(`Failed to handle onboarding completion for user ${userId}`, error);
    }
  }
}
```

#### **Шаг 7.2: Обновить OnboardingService**
```typescript
// packages/twenty-server/src/engine/core-modules/onboarding/onboarding.service.ts
@Injectable()
export class OnboardingService {
  constructor(
    // ... существующие зависимости
    private readonly onboardingCompletedTrigger: OnboardingCompletedTrigger,
  ) {}

  async setOnboardingStatus({
    userId,
    workspaceId,
    status,
  }: {
    userId: string;
    workspaceId: string;
    status: OnboardingStatus;
  }): Promise<void> {
    // ... существующая логика обновления статуса

    // Если онбординг завершен, запускаем агента-супервизора
    if (status === OnboardingStatus.COMPLETED) {
      const user = await this.userService.findOne({ where: { id: userId } });
      const workspace = await this.workspaceService.findOne({ where: { id: workspaceId } });
      
      await this.onboardingCompletedTrigger.handleOnboardingCompleted({
        workspaceId,
        userId,
        userData: {
          email: user.email,
          companySize: workspace.companySize,
          industry: workspace.industry,
          annualRevenue: workspace.annualRevenue,
          companyId: workspace.id,
        },
      });
    }
  }
}
```

### **Этап 8: Конфигурация агента-супервизора для клиентов**

#### **Шаг 8.1: Расширить типы конфигурации агентов**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/types/supervisor-agent-config.types.ts
export interface SupervisorAgentConfig {
  type: 'SUPERVISOR';
  supervision: {
    targetAgents: string[]; // ID агентов для надзора
    clientStatusMapping: {
      [clientStatus: string]: {
        agents: string[]; // Какие агенты запускать для данного статуса
        priority: number; // Приоритет выполнения
        conditions?: {
          companySize?: 'startup' | 'sme' | 'enterprise';
          industry?: string[];
          annualRevenue?: {
            min?: number;
            max?: number;
          };
        };
      };
    };
    monitoring: {
      enabled: boolean;
      qualityThreshold: number;
      performanceMetrics: string[];
    };
    escalation: {
      enabled: boolean;
      escalationAgentId?: string;
      escalationConditions: string[];
    };
  };
}
```

#### **Шаг 8.2: Пример конфигурации агента-супервизора**
```json
{
  "type": "SUPERVISOR",
  "supervision": {
    "targetAgents": [
      "agent-welcome-email",
      "agent-product-demo",
      "agent-customer-success",
      "agent-sales-followup",
      "agent-enterprise-sales",
      "agent-startup-onboarding"
    ],
    "clientStatusMapping": {
      "enterprise_lead": {
        "agents": ["agent-enterprise-sales", "agent-product-demo"],
        "priority": 1,
        "conditions": {
          "companySize": "enterprise",
          "annualRevenue": { "min": 1000000 }
        }
      },
      "startup_prospect": {
        "agents": ["agent-startup-onboarding", "agent-product-demo"],
        "priority": 2,
        "conditions": {
          "companySize": "startup"
        }
      },
      "sme_customer": {
        "agents": ["agent-customer-success", "agent-upsell"],
        "priority": 3,
        "conditions": {
          "companySize": "sme"
        }
      },
      "new_user": {
        "agents": ["agent-welcome-email", "agent-product-demo"],
        "priority": 4,
        "conditions": {}
      }
    },
    "monitoring": {
      "enabled": true,
      "qualityThreshold": 0.8,
      "performanceMetrics": ["response_time", "success_rate", "customer_satisfaction"]
    },
    "escalation": {
      "enabled": true,
      "escalationAgentId": "agent-human-escalation",
      "escalationConditions": ["quality_below_threshold", "agent_failure", "customer_complaint"]
    }
  }
}
```

### **Этап 9: Создание workflow шаблонов для пост-онбординга**

#### **Шаг 9.1: Workflow шаблон для пост-онбординга**
```typescript
// packages/twenty-server/src/modules/workflow/workflow-templates/post-onboarding-supervision.workflow.ts
export const POST_ONBOARDING_SUPERVISION_WORKFLOW = {
  name: 'Post-Onboarding Client Supervision',
  description: 'Automated client supervision after onboarding completion',
  trigger: {
    type: 'MANUAL',
    settings: {
      availability: 'WHEN_RECORD_SELECTED',
    },
  },
  steps: [
    {
      id: 'supervisor-agent',
      name: 'Client Supervisor Agent',
      type: 'AI_AGENT',
      settings: {
        agentId: '{{supervisorAgentId}}',
        input: {
          clientData: '{{clientData}}',
          triggerType: '{{triggerType}}',
        },
      },
    },
    {
      id: 'status-update',
      name: 'Update Client Status',
      type: 'UPDATE_RECORD',
      settings: {
        objectNameSingular: 'person',
        recordId: '{{personId}}',
        data: {
          status: '{{supervisionResult.clientStatus.recommendedStatus}}',
        },
      },
    },
    {
      id: 'follow-up-tasks',
      name: 'Create Follow-up Tasks',
      type: 'CREATE_RECORD',
      settings: {
        objectNameSingular: 'task',
        data: {
          title: 'Follow-up with {{personName}}',
          description: 'Based on supervision results: {{supervisionResult.reasoning}}',
          assigneeId: '{{accountOwnerId}}',
        },
      },
    },
    {
      id: 'email-notification',
      name: 'Send Welcome Email',
      type: 'SEND_EMAIL',
      settings: {
        to: '{{personEmail}}',
        subject: 'Welcome to {{companyName}}!',
        body: '{{welcomeEmailTemplate}}',
      },
    },
  ],
};
```

### **Этап 10: Дополнительные миграции базы данных**

#### **Шаг 10.1: Миграция для client_status таблицы**
```typescript
// packages/twenty-server/src/database/typeorm/core/migrations/1747401483138-createClientStatusTable.ts
export class CreateClientStatusTable1747401483138 implements MigrationInterface {
  name = 'CreateClientStatusTable1747401483138';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаем таблицу client_status
    await queryRunner.query(
      `CREATE TABLE "core"."client_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "label" character varying NOT NULL,
        "description" character varying,
        "workspaceId" uuid NOT NULL,
        "priority" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_client_status" PRIMARY KEY ("id")
      )`
    );

    // Создаем индексы
    await queryRunner.query(
      `CREATE INDEX "IDX_CLIENT_STATUS_WORKSPACE_ID" ON "core"."client_status" ("workspaceId")`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_CLIENT_STATUS_NAME_WORKSPACE" ON "core"."client_status" ("name", "workspaceId")`
    );

    // Добавляем внешний ключ
    await queryRunner.query(
      `ALTER TABLE "core"."client_status" ADD CONSTRAINT "FK_client_status_workspace" 
       FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE`
    );

    // Добавляем поле agentType в таблицу agent если его еще нет
    const hasAgentTypeColumn = await queryRunner.hasColumn('core', 'agent', 'agentType');
    if (!hasAgentTypeColumn) {
      await queryRunner.query(
        `ALTER TABLE "core"."agent" ADD COLUMN "agentType" character varying NOT NULL DEFAULT 'STANDARD'`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "core"."client_status"`);
    
    const hasAgentTypeColumn = await queryRunner.hasColumn('core', 'agent', 'agentType');
    if (hasAgentTypeColumn) {
      await queryRunner.query(`ALTER TABLE "core"."agent" DROP COLUMN "agentType"`);
    }
  }
}
```

### **Этап 11: Обновление модулей и зависимостей**

#### **Шаг 11.1: Обновить AgentModule**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/agent.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        AgentEntity,
        AgentHandoffEntity,
        RoleEntity,
        RoleTargetsEntity,
        AgentChatMessageEntity,
        AgentChatThreadEntity,
        FileEntity,
        UserWorkspace,
        ClientStatusEntity, // Добавляем новую сущность
      ],
      'core',
    ),
    // ... остальные импорты
  ],
  providers: [
    AgentResolver,
    AgentChatResolver,
    AgentService,
    AgentExecutionService,
    AgentToolService,
    AgentChatService,
    AgentStreamingService,
    AgentTitleGenerationService,
    AgentHandoffExecutorService,
    AgentHandoffService,
    AgentMemoryService, // Добавляем новые сервисы
    AgentCoordinationService,
    AgentSupervisorService,
    ClientSupervisorService,
    ClientStatusService,
  ],
  exports: [
    AgentService,
    AgentExecutionService,
    AgentToolService,
    AgentChatService,
    AgentStreamingService,
    AgentTitleGenerationService,
    AgentMemoryService,
    AgentCoordinationService,
    AgentSupervisorService,
    ClientSupervisorService,
    ClientStatusService,
    TypeOrmModule.forFeature(
      [AgentEntity, AgentChatMessageEntity, AgentChatThreadEntity, ClientStatusEntity],
      'core',
    ),
  ],
})
export class AgentModule {}
```

### **Этап 12: Тестирование и валидация**

#### **Шаг 12.1: Создать тесты для ClientSupervisorService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/__tests__/client-supervisor.service.spec.ts
describe('ClientSupervisorService', () => {
  let service: ClientSupervisorService;
  let mockAgentExecutionService: jest.Mocked<AgentExecutionService>;
  let mockAgentRepository: jest.Mocked<Repository<AgentEntity>>;
  let mockClientStatusRepository: jest.Mocked<Repository<ClientStatusEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientSupervisorService,
        {
          provide: AgentExecutionService,
          useValue: {
            executeAgent: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AgentEntity, 'core'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ClientStatusEntity, 'core'),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ClientSupervisorService>(ClientSupervisorService);
    mockAgentExecutionService = module.get(AgentExecutionService);
    mockAgentRepository = module.get(getRepositoryToken(AgentEntity, 'core'));
    mockClientStatusRepository = module.get(getRepositoryToken(ClientStatusEntity, 'core'));
  });

  it('should analyze enterprise client status correctly', async () => {
    const clientData = {
      personId: 'test-person-id',
      companySize: 'enterprise',
      annualRevenue: 2000000,
      currentStatus: 'new_user',
    };

    const result = await service['analyzeClientStatus'](clientData);

    expect(result.recommendedStatus).toBe('enterprise_lead');
    expect(result.confidence).toBe(0.9);
    expect(result.reasoning).toContain('Enterprise company');
  });

  it('should execute agents by priority', async () => {
    const mockAgents = [
      { id: 'agent-1', name: 'Agent 1' },
      { id: 'agent-2', name: 'Agent 2' },
    ] as AgentEntity[];

    mockAgentRepository.find.mockResolvedValue(mockAgents);
    mockAgentExecutionService.executeAgent.mockResolvedValue({
      result: { success: true },
      usage: { totalTokens: 100 },
    });

    const results = await service['executeAgentsByPriority'](mockAgents, {});

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(mockAgentExecutionService.executeAgent).toHaveBeenCalledTimes(2);
  });
});
```

### **Этап 13: Документация и примеры использования**

#### **Шаг 13.1: Создать документацию по настройке агента-супервизора**
```markdown
# Настройка агента-супервизора для клиентов

## Обзор

Агент-супервизор автоматически анализирует статус клиента после завершения онбординга и запускает соответствующих агентов для дальнейшего взаимодействия.

## Конфигурация

### 1. Создание агента-супервизора

```typescript
const supervisorAgent = await agentService.createAgent({
  name: 'client-supervisor',
  label: 'Client Supervisor',
  description: 'Supervises client interactions after onboarding',
  prompt: 'You are a client supervisor agent responsible for coordinating other agents based on client status.',
  modelId: 'gpt-4o',
  agentType: 'SUPERVISOR',
  responseFormat: {
    type: 'SUPERVISOR',
    supervision: {
      targetAgents: ['agent-welcome', 'agent-demo', 'agent-sales'],
      clientStatusMapping: {
        'enterprise_lead': {
          agents: ['agent-enterprise-sales', 'agent-demo'],
          priority: 1,
          conditions: {
            companySize: 'enterprise',
            annualRevenue: { min: 1000000 }
          }
        }
      },
      monitoring: {
        enabled: true,
        qualityThreshold: 0.8
      },
      escalation: {
        enabled: true,
        escalationAgentId: 'agent-human-escalation'
      }
    }
  },
  workspaceId: 'workspace-id',
  isCustom: true,
});
```

### 2. Создание статусов клиентов

```typescript
const clientStatuses = [
  {
    name: 'enterprise_lead',
    label: 'Enterprise Lead',
    description: 'Enterprise companies with high revenue potential',
    priority: 1,
    metadata: {
      category: 'lead',
      lifecycleStage: 'consideration',
      engagementLevel: 'high',
      riskLevel: 'low',
      nextActions: ['schedule_demo', 'assign_sales_rep'],
      recommendedAgents: ['agent-enterprise-sales', 'agent-demo']
    }
  },
  {
    name: 'startup_prospect',
    label: 'Startup Prospect',
    description: 'Startup companies requiring specialized onboarding',
    priority: 2,
    metadata: {
      category: 'prospect',
      lifecycleStage: 'awareness',
      engagementLevel: 'medium',
      riskLevel: 'medium',
      nextActions: ['send_welcome_email', 'schedule_onboarding'],
      recommendedAgents: ['agent-startup-onboarding', 'agent-demo']
    }
  }
];
```

### 3. Интеграция с onboarding

Агент-супервизор автоматически запускается после завершения онбординга пользователя. Система анализирует данные пользователя и компании, определяет оптимальный статус клиента и запускает соответствующих агентов.

## Мониторинг и эскалация

### Качество выполнения

Система автоматически мониторит качество выполнения агентов и может эскалировать сложные случаи к человеку.

### Метрики

- Response time агентов
- Success rate выполнения
- Customer satisfaction
- Escalation rate

## Расширение функциональности

### Добавление новых типов клиентов

1. Создать новый статус клиента
2. Добавить конфигурацию в агента-супервизора
3. Создать специализированных агентов
4. Обновить логику анализа статуса

### Кастомные условия

Можно добавлять кастомные условия для определения статуса клиента:

```typescript
conditions: {
  companySize: 'enterprise',
  industry: ['technology', 'finance'],
  annualRevenue: { min: 1000000, max: 10000000 },
  employeeCount: { min: 100, max: 1000 },
  location: ['US', 'EU'],
  customField: 'customValue'
}
```
```

### **Этап 14: Развертывание и мониторинг**

#### **Шаг 14.1: Feature flags для постепенного развертывания**
```typescript
// packages/twenty-server/src/engine/core-modules/feature-flag/feature-flag.constants.ts
export enum FeatureFlagKey {
  // ... существующие флаги
  IS_CLIENT_SUPERVISOR_ENABLED = 'IS_CLIENT_SUPERVISOR_ENABLED',
  IS_CLIENT_STATUS_SYSTEM_ENABLED = 'IS_CLIENT_STATUS_SYSTEM_ENABLED',
}
```

#### **Шаг 14.2: Мониторинг и метрики**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/client-supervisor-metrics.service.ts
@Injectable()
export class ClientSupervisorMetricsService {
  constructor(
    private readonly logger: Logger,
  ) {}

  async trackSupervisionExecution({
    workspaceId,
    clientId,
    supervisionResult,
    executionTime,
  }: {
    workspaceId: string;
    clientId: string;
    supervisionResult: SupervisionResult;
    executionTime: number;
  }): Promise<void> {
    // Отправляем метрики в систему мониторинга
    this.logger.log('Client supervision metrics', {
      workspaceId,
      clientId,
      executedAgents: supervisionResult.executedAgents.length,
      qualityScore: supervisionResult.qualityScore,
      executionTime,
      escalationHandled: supervisionResult.escalationHandled,
    });
  }
}
```

## Заключение

Данное расширение системы Twenty позволяет создать мощную систему координации агентов для автоматизации взаимодействия с клиентами после онбординга. Система:

- **Автоматически анализирует** статус клиента на основе данных компании
- **Координирует выполнение** специализированных агентов
- **Мониторит качество** выполнения и эскалирует сложные случаи
- **Интегрируется** с существующей системой workflow и биллинга
- **Масштабируется** для добавления новых типов клиентов и агентов

Все изменения минимальны и используют существующую архитектуру Twenty, что обеспечивает стабильность и совместимость системы.

## Дополнительные компоненты для агента-супервизора после онбординга

### **Этап 5: Создание системы статусов клиентов (1 неделя)**

#### **Шаг 5.1: Создать ClientStatusEntity**
```typescript
// packages/twenty-server/src/engine/metadata-modules/client-status/client-status.entity.ts
@Entity('client_status')
export class ClientStatusEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: false })
  label: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: 'jsonb' })
  metadata: object; // Дополнительные данные статуса

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### **Шаг 5.2: Создать ClientSupervisorService**
```typescript
// packages/twenty-server/src/engine/metadata-modules/agent/services/client-supervisor.service.ts
@Injectable()
export class ClientSupervisorService {
  async executeClientSupervision({
    supervisorAgent,
    clientData,
    context,
  }: {
    supervisorAgent: AgentEntity;
    clientData: {
      personId: string;
      companyId?: string;
      currentStatus: string;
      companySize?: string;
      industry?: string;
      annualRevenue?: number;
    };
    context: Record<string, unknown>;
  }): Promise<SupervisionResult> {
    const config = supervisorAgent.responseFormat as SupervisorAgentConfig;
    
    // Анализируем статус клиента
    const clientStatus = await this.analyzeClientStatus(clientData);
    
    // Определяем подходящих агентов
    const recommendedAgents = await this.getRecommendedAgents(
      config.supervision.clientStatusMapping,
      clientStatus
    );

    // Выполняем агентов в порядке приоритета
    const results = await this.executeAgentsByPriority(recommendedAgents, context);

    return {
      clientStatus,
      executedAgents: results.map(r => r.agentId),
      results,
      qualityScore: 1.0,
    };
  }
}
```

### **Этап 6: Интеграция с системой onboarding (1 неделя)**

#### **Шаг 6.1: Создать OnboardingCompletedTrigger**
```typescript
// packages/twenty-server/src/modules/onboarding/triggers/onboarding-completed.trigger.ts
@Injectable()
export class OnboardingCompletedTrigger {
  async handleOnboardingCompleted({
    workspaceId,
    userId,
    userData,
  }: {
    workspaceId: string;
    userId: string;
    userData: any;
  }): Promise<void> {
    // Находим агента-супервизора для данного workspace
    const supervisorAgent = await this.agentService.findSupervisorAgent(workspaceId);
    
    if (!supervisorAgent) {
      this.logger.warn(`No supervisor agent found for workspace ${workspaceId}`);
      return;
    }

    // Запускаем супервизию
    const supervisionResult = await this.clientSupervisorService.executeClientSupervision({
      supervisorAgent,
      clientData: {
        personId: userId,
        currentStatus: 'new_user',
        companySize: userData.companySize,
        industry: userData.industry,
        annualRevenue: userData.annualRevenue,
      },
      context: { trigger: 'onboarding_completed', userData },
    });
  }
}
```

### **Этап 7: Конфигурация агента-супервизора**

#### **Пример конфигурации:**
```json
{
  "type": "SUPERVISOR",
  "supervision": {
    "targetAgents": [
      "agent-welcome-email",
      "agent-product-demo",
      "agent-customer-success",
      "agent-sales-followup"
    ],
    "clientStatusMapping": {
      "enterprise_lead": {
        "agents": ["agent-enterprise-sales", "agent-product-demo"],
        "priority": 1,
        "conditions": {
          "companySize": "enterprise",
          "annualRevenue": { "min": 1000000 }
        }
      },
      "startup_prospect": {
        "agents": ["agent-startup-onboarding", "agent-product-demo"],
        "priority": 2,
        "conditions": {
          "companySize": "startup"
        }
      }
    },
    "monitoring": {
      "enabled": true,
      "qualityThreshold": 0.8
    },
    "escalation": {
      "enabled": true,
      "escalationAgentId": "agent-human-escalation"
    }
  }
}
```

### **Этап 8: Workflow шаблон для пост-онбординга**

```typescript
// packages/twenty-server/src/modules/workflow/workflow-templates/post-onboarding-supervision.workflow.ts
export const POST_ONBOARDING_SUPERVISION_WORKFLOW = {
  name: 'Post-Onboarding Client Supervision',
  description: 'Automated client supervision after onboarding completion',
  trigger: {
    type: 'MANUAL',
    settings: {
      availability: 'WHEN_RECORD_SELECTED',
    },
  },
  steps: [
    {
      id: 'supervisor-agent',
      name: 'Client Supervisor Agent',
      type: 'AI_AGENT',
      settings: {
        agentId: '{{supervisorAgentId}}',
        input: {
          clientData: '{{clientData}}',
          triggerType: '{{triggerType}}',
        },
      },
    },
    {
      id: 'status-update',
      name: 'Update Client Status',
      type: 'UPDATE_RECORD',
      settings: {
        objectNameSingular: 'person',
        recordId: '{{personId}}',
        data: {
          status: '{{supervisionResult.clientStatus.recommendedStatus}}',
        },
      },
    },
    {
      id: 'follow-up-tasks',
      name: 'Create Follow-up Tasks',
      type: 'CREATE_RECORD',
      settings: {
        objectNameSingular: 'task',
        data: {
          title: 'Follow-up with {{personName}}',
          description: 'Based on supervision results: {{supervisionResult.reasoning}}',
          assigneeId: '{{accountOwnerId}}',
        },
      },
    },
  ],
};
```

## Итоговое заключение

Теперь ваш MD файл содержит полный план реализации агента-супервизора для координации после онбординга, включая:

✅ **Систему статусов клиентов** - для управления статусами и их метаданными
✅ **ClientSupervisorService** - специализированный сервис для супервизии клиентов
✅ **Интеграцию с onboarding** - автоматический запуск после завершения онбординга
✅ **Конфигурацию агента-супервизора** - гибкие правила для разных типов клиентов
✅ **Workflow шаблоны** - автоматизация пост-онбординга
✅ **Миграции базы данных** - для новых таблиц и полей

Система готова к реализации и обеспечивает полную автоматизацию координации агентов на основе статуса клиента после онбординга.
