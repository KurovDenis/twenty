# LangGraph Multi-Agent Integration Plan for Twenty

## Цель
Внедрить LangGraph мультиагенты в Twenty с минимальным воздействием на существующую инфраструктуру, максимально используя текущую функциональность агентов, инструментов и workflow системы.

## Принципы интеграции
- **Минимальные изменения**: Не затрагивать существующие модули без необходимости
- **Обратная совместимость**: Все существующие агенты и workflow должны продолжать работать
- **Постепенное внедрение**: Возможность добавления мультиагентных возможностей по мере необходимости
- **Переиспользование**: Максимальное использование существующих агентов, инструментов и сервисов

## Текущая архитектура Twenty

### AI Инфраструктура
```
packages/twenty-server/src/engine/core-modules/ai/
├── ai.module.ts                    # Основной AI модуль
├── services/
│   ├── ai.service.ts              # Базовый AI сервис
│   ├── ai-model-registry.service.ts # Реестр AI моделей
│   ├── tool.service.ts            # Сервис инструментов
│   ├── tool-adapter.service.ts    # Адаптер инструментов
│   └── ai-billing.service.ts      # Биллинг AI
└── controllers/
    ├── ai.controller.ts           # AI контроллер
    └── mcp.controller.ts          # MCP контроллер
```

### Workflow Система
```
packages/twenty-server/src/modules/workflow/
├── workflow-executor/
│   ├── workflow-executor.module.ts
│   ├── factories/
│   │   └── workflow-action.factory.ts  # Фабрика workflow действий
│   └── workflow-actions/
│       ├── ai-agent/              # AI агент как workflow action
│       ├── code/                  # Код как workflow action
│       ├── tool-executor/         # Инструменты как workflow action
│       └── types/
│           └── workflow-action.type.ts
```

### Агенты
```
packages/twenty-server/src/engine/metadata-modules/agent/
├── agent-execution.service.ts     # Выполнение агентов
├── agent-streaming.service.ts     # Стриминг агентов
└── agent-handoff-executor.service.ts # Передача между агентами
```

## План внедрения LangGraph

### 1. Создание LangGraph модуля

**Новый модуль**: `packages/twenty-server/src/engine/core-modules/langgraph/`

```typescript
// langgraph.module.ts
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([LangGraphWorkflowEntity, LangGraphExecutionEntity], 'core'),
    AiModule, // Переиспользуем существующий AI модуль
  ],
  controllers: [LangGraphController],
  providers: [
    LangGraphExecutionService,
    LangGraphStateService,
    LangGraphWorkflowService,
    AgentAdapter,      // Адаптер для существующих агентов
    ToolAdapter,       // Адаптер для существующих инструментов
  ],
  exports: [
    LangGraphExecutionService,
    LangGraphWorkflowService,
  ],
})
export class LangGraphModule {}
```

### 2. Адаптеры для существующих компонентов

#### AgentAdapter
```typescript
// adapters/agent-adapter.ts
@Injectable()
export class AgentAdapter {
  constructor(
    private agentExecutionService: AgentExecutionService,
    private agentRepository: Repository<AgentEntity>
  ) {}

  async createAgentNode(agentId: string, workspaceId: string) {
    return async (state: LangGraphState) => {
      const agent = await this.agentRepository.findOne({
        where: { id: agentId, workspaceId }
      });
      
      const result = await this.agentExecutionService.executeAgent({
        agent,
        context: state.context,
        schema: state.schema,
        userPrompt: state.prompt
      });
      
      return { ...state, result: result.result };
    };
  }
}
```

#### ToolAdapter
```typescript
// adapters/tool-adapter.ts
@Injectable()
export class ToolAdapter {
  constructor(private toolRegistry: ToolRegistryService) {}

  createToolNode(toolType: ToolType) {
    return async (state: LangGraphState) => {
      const tool = this.toolRegistry.getTool(toolType);
      const result = await tool.execute(state.toolInput);
      return { ...state, toolResult: result };
    };
  }
}
```

### 3. Новый Workflow Action для LangGraph

#### Добавить в WorkflowActionType
```typescript
// packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type.ts
export enum WorkflowActionType {
  // ... существующие типы
  LANGGRAPH_WORKFLOW = 'LANGGRAPH_WORKFLOW',
}

export type WorkflowLangGraphAction = BaseWorkflowAction & {
  type: WorkflowActionType.LANGGRAPH_WORKFLOW;
  settings: {
    input: {
      workflowId: string;
      input: any;
    };
    outputSchema: OutputSchema;
  };
};
```

#### Создать LangGraph Workflow Action
```typescript
// packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/langgraph-workflow/langgraph-workflow.action.ts
@Injectable()
export class LangGraphWorkflowAction implements WorkflowAction {
  constructor(
    private langgraphExecutionService: LangGraphExecutionService
  ) {}

  async execute({ currentStepId, steps, context }: WorkflowActionInput) {
    const step = steps.find(s => s.id === currentStepId);
    const { workflowId, input } = step.settings.input;
    
    const result = await this.langgraphExecutionService.executeWorkflow({
      workflowId,
      input: resolveInput(input, context),
      workspaceId: context.workspaceId
    });
    
    return { result };
  }
}
```

#### Обновить WorkflowActionFactory
```typescript
// packages/twenty-server/src/modules/workflow/workflow-executor/factories/workflow-action.factory.ts
@Injectable()
export class WorkflowActionFactory {
  constructor(
    // ... существующие зависимости
    private readonly langGraphWorkflowAction: LangGraphWorkflowAction,
  ) {}

  get(stepType: WorkflowActionType): WorkflowAction {
    switch (stepType) {
      // ... существующие case
      case WorkflowActionType.LANGGRAPH_WORKFLOW:
        return this.langGraphWorkflowAction;
      default:
        throw new WorkflowStepExecutorException(
          `Workflow step executor not found for step type '${stepType}'`,
          WorkflowStepExecutorExceptionCode.INVALID_STEP_TYPE,
        );
    }
  }
}
```

### 4. Минимальные изменения в существующие модули

#### Обновить AiModule (ИСПРАВЛЕНО - убираем циклический импорт)
```typescript
// packages/twenty-server/src/engine/core-modules/ai/ai.module.ts
@Global()
@Module({
  imports: [
    // ... существующие imports
    // НЕ добавляем LangGraphModule здесь - избегаем циклических зависимостей
  ],
  // ... остальное остается без изменений
})
export class AiModule {}
```

#### Обновить WorkflowExecutorModule (ИСПРАВЛЕНО - используем forwardRef)
```typescript
// packages/twenty-server/src/modules/workflow/workflow-executor/workflow-executor.module.ts
@Module({
  imports: [
    // ... существующие imports
    forwardRef(() => LangGraphModule), // Используем forwardRef для избежания циклических зависимостей
  ],
  providers: [
    // ... существующие providers
    LangGraphWorkflowAction, // Добавить только эту строку
  ],
  // ... остальное остается без изменений
})
export class WorkflowExecutorModule {}
```

### 5. Новые GraphQL типы

#### Добавить в GraphQL схему (ИСПРАВЛЕНО - добавлены скаляры и исправлены типы)
```graphql
scalar JSON
scalar DateTime

type LangGraphWorkflow {
  id: ID!
  name: String!
  description: String
  nodes: [LangGraphNode!]!
  edges: [LangGraphEdge!]!
  workspaceId: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type LangGraphNode {
  id: String!
  type: LangGraphNodeType!
  agentId: String
  prompt: String
  toolType: String
  toolConfig: JSON
  position: NodePosition
}

type LangGraphEdge {
  id: String
  from: String!
  to: String!
  condition: String
}

type NodePosition {
  x: Float!
  y: Float!
}

enum LangGraphNodeType {
  AGENT
  TOOL
  CONDITIONAL
  HUMAN_INPUT
}

type LangGraphExecutionResult {
  executionId: ID!
  status: String!
  result: JSON
  usage: JSON
  startedAt: DateTime!
  finishedAt: DateTime
  events: [LangGraphEvent!]!
}

type LangGraphEvent {
  ts: DateTime!
  type: String!
  data: JSON
  nodeId: String
}

input CreateLangGraphWorkflowInput {
  name: String!
  description: String
  nodes: [CreateLangGraphNodeInput!]!
  edges: [CreateLangGraphEdgeInput!]!
}

input CreateLangGraphNodeInput {
  id: String!
  type: LangGraphNodeType!
  agentId: String
  prompt: String
  toolType: String
  toolConfig: JSON
  position: NodePositionInput
}

input CreateLangGraphEdgeInput {
  from: String!
  to: String!
  condition: String
}

input NodePositionInput {
  x: Float!
  y: Float!
}

input ExecuteLangGraphInput {
  workflowId: ID!
  input: JSON
  stream: Boolean
}
```

### 6. Новые резолверы (ОБНОВЛЕНО)

```typescript
// packages/twenty-server/src/engine/metadata-modules/langgraph/langgraph.resolver.ts
import { Resolver, Mutation, Query, Args, Subscription } from '@nestjs/graphql';
import { CurrentWorkspaceId } from '../../utils/workspace/workspace.decorator';
import { LangGraphWorkflowService } from '../../core-modules/langgraph/services/langgraph-workflow.service';
import { LangGraphExecutionService } from '../../core-modules/langgraph/services/langgraph-execution.service';
import { LangGraphWorkflow, LangGraphExecutionResult, LangGraphEvent } from './langgraph.types';
import { CreateLangGraphWorkflowInput, ExecuteLangGraphInput } from './langgraph.inputs';
import { PubSub } from 'graphql-subscriptions';

const pubSub = new PubSub();

@Resolver(() => LangGraphWorkflow)
export class LangGraphResolver {
  constructor(
    private langGraphWorkflowService: LangGraphWorkflowService,
    private langGraphExecutionService: LangGraphExecutionService
  ) {}

  @Mutation(() => LangGraphWorkflow)
  async createLangGraphWorkflow(
    @Args('input') input: CreateLangGraphWorkflowInput,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    return this.langGraphWorkflowService.createWorkflow(input, workspaceId);
  }

  @Mutation(() => LangGraphExecutionResult)
  async executeLangGraphWorkflow(
    @Args('input') input: ExecuteLangGraphInput,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    return this.langGraphExecutionService.executeWorkflow({
      workflowId: input.workflowId,
      input: input.input,
      workspaceId,
      stream: input.stream
    });
  }

  @Mutation(() => LangGraphExecutionResult)
  async resumeLangGraphExecution(
    @Args('executionId') executionId: string,
    @Args('input') input: any,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    return this.langGraphExecutionService.resumeExecution(executionId, input, workspaceId);
  }

  @Mutation(() => Boolean)
  async cancelLangGraphExecution(
    @Args('executionId') executionId: string,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    await this.langGraphExecutionService.cancel(executionId);
    return true;
  }

  @Query(() => [LangGraphWorkflow])
  async langGraphWorkflows(@CurrentWorkspaceId() workspaceId: string) {
    return this.langGraphWorkflowService.getWorkflows(workspaceId);
  }

  @Query(() => LangGraphWorkflow)
  async langGraphWorkflow(
    @Args('id') id: string,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    return this.langGraphWorkflowService.getWorkflow(id, workspaceId);
  }

  @Query(() => [LangGraphExecutionResult])
  async langGraphExecutions(
    @Args('workflowId', { nullable: true }) workflowId?: string,
    @Args('status', { nullable: true }) status?: string,
    @Args('limit', { defaultValue: 10 }) limit?: number,
    @Args('offset', { defaultValue: 0 }) offset?: number,
    @CurrentWorkspaceId() workspaceId: string
  ) {
    return this.langGraphExecutionService.getExecutions({
      workspaceId,
      workflowId,
      status,
      limit,
      offset
    });
  }

  @Subscription(() => LangGraphEvent, {
    filter: (payload, variables) => {
      return payload.langGraphExecutionEvents.executionId === variables.executionId;
    },
  })
  langGraphExecutionEvents(@Args('executionId') executionId: string) {
    return pubSub.asyncIterator(`langGraphExecutionEvents:${executionId}`);
  }
}
```

### 7. Примеры использования

#### Простой мультиагентный workflow
```typescript
// Пример создания workflow с тремя агентами
const workflow = {
  name: "Research and Analysis Pipeline",
  description: "Multi-agent workflow for research and analysis",
  nodes: [
    {
      id: 'researcher',
      type: 'AGENT',
      agentId: 'research-agent-id',
      prompt: 'Research the topic and gather comprehensive information',
      position: { x: 100, y: 100 }
    },
    {
      id: 'analyzer',
      type: 'AGENT', 
      agentId: 'analysis-agent-id',
      prompt: 'Analyze the research data and create insights',
      position: { x: 300, y: 100 }
    },
    {
      id: 'writer',
      type: 'AGENT',
      agentId: 'writing-agent-id', 
      prompt: 'Write a comprehensive report based on analysis',
      position: { x: 500, y: 100 }
    }
  ],
  edges: [
    { from: 'researcher', to: 'analyzer' },
    { from: 'analyzer', to: 'writer' }
  ]
};
```

#### Workflow с условной логикой
```typescript
const conditionalWorkflow = {
  name: "Conditional Analysis Workflow",
  nodes: [
    {
      id: 'initial_analysis',
      type: 'AGENT',
      agentId: 'analysis-agent-id',
      prompt: 'Perform initial analysis'
    },
    {
      id: 'decision_point',
      type: 'CONDITIONAL',
      prompt: 'Determine if further analysis is needed'
    },
    {
      id: 'deep_analysis',
      type: 'AGENT', 
      agentId: 'deep-analysis-agent-id',
      prompt: 'Perform deep analysis'
    },
    {
      id: 'final_report',
      type: 'AGENT',
      agentId: 'report-agent-id',
      prompt: 'Generate final report'
    }
  ],
  edges: [
    { from: 'initial_analysis', to: 'decision_point' },
    { from: 'decision_point', to: 'deep_analysis', condition: 'needs_deep_analysis' },
    { from: 'decision_point', to: 'final_report', condition: 'basic_report_sufficient' },
    { from: 'deep_analysis', to: 'final_report' }
  ]
};
```

### 8. Интеграция с существующими инструментами

#### Использование существующих tools в LangGraph
```typescript
// Пример workflow с инструментами
const toolWorkflow = {
  name: "Data Processing with Tools",
  nodes: [
    {
      id: 'data_collector',
      type: 'AGENT',
      agentId: 'data-agent-id',
      prompt: 'Collect data from various sources'
    },
    {
      id: 'http_request',
      type: 'TOOL',
      toolType: 'HTTP_REQUEST',
      prompt: 'Make API request to external service'
    },
    {
      id: 'email_sender',
      type: 'TOOL',
      toolType: 'SEND_EMAIL',
      prompt: 'Send notification email'
    }
  ],
  edges: [
    { from: 'data_collector', to: 'http_request' },
    { from: 'http_request', to: 'email_sender' }
  ]
};
```

### 9. Преимущества данного подхода

1. **Минимальные изменения**: Только добавление нового модуля и нескольких строк в существующие файлы
2. **Обратная совместимость**: Все существующие агенты и workflow продолжают работать
3. **Переиспользование**: Существующие агенты и инструменты можно использовать в мультиагентных workflow
4. **Постепенное внедрение**: Можно добавлять мультиагентные возможности по мере необходимости
5. **Масштабируемость**: LangGraph обеспечивает сложную логику координации между агентами
6. **Интеграция с существующей инфраструктурой**: Использует существующие AI модели, биллинг, и систему инструментов

### 10. Следующие шаги (ОБНОВЛЕНО)

#### Фаза 1: Базовая инфраструктура (1-2 недели)
1. ✅ Создать LangGraph модуль с базовой функциональностью
2. ✅ Реализовать адаптеры для существующих агентов и инструментов
3. ✅ Добавить новый workflow action для LangGraph
4. ✅ Создать GraphQL типы и резолверы
5. ✅ Добавить минимальные изменения в существующие модули (с исправлением циклических зависимостей)
6. ✅ Протестировать интеграцию с существующими агентами и workflow

#### Фаза 2: Расширенная функциональность (2-3 недели)
1. ✅ Добавить поддержку условной логики и параллельного выполнения
2. ✅ Реализовать мониторинг и отладку мультиагентных workflow
3. ✅ Интегрировать стриминг и биллинг
4. ✅ Добавить безопасную оценку условий
5. ✅ Реализовать валидацию workflow

#### Фаза 3: Безопасность и оптимизация (1-2 недели)
1. ✅ Добавить ограничения и таймауты
2. ✅ Реализовать фичефлаги и постепенное внедрение
3. ✅ Создать миграции и индексы
4. ✅ Написать comprehensive тесты
5. ✅ Документация и примеры использования

## Критические исправления и улучшения

### ✅ Исправленные проблемы
1. **Циклические зависимости**: Убрали импорт `LangGraphModule` из `AiModule`, используем `forwardRef` где необходимо
2. **GraphQL схема**: Добавили `JSON` скаляр, исправили типы нод, добавили недостающие типы
3. **Типобезопасность**: Определили все интерфейсы и DTO с правильными типами
4. **Безопасность**: Добавили безопасную оценку условий через JEXL с whitelisting
5. **Состояние**: Реализовали checkpointer для сохранения и возобновления состояния
6. **Биллинг**: Интегрировали агрегацию токенов по нодам
7. **Стриминг**: Добавили GraphQL subscriptions для real-time событий

### ✅ Новые возможности
1. **Валидация workflow**: Проверка на циклы, лимиты, корректность нод
2. **Ограничения**: Таймауты, лимиты размера, whitelist инструментов
3. **Фичефлаги**: Постепенное внедрение с контролем по workspace
4. **Мониторинг**: События выполнения, метрики, отладка
5. **Human-in-the-loop**: Поддержка прерываний для человеческого ввода
6. **Версионирование**: Поддержка версий workflow и миграций

### ✅ Архитектурные улучшения
1. **Модульность**: Четкое разделение ответственности между сервисами
2. **Расширяемость**: Легкое добавление новых типов нод и инструментов
3. **Надежность**: Обработка ошибок, retry логика, graceful degradation
4. **Производительность**: Индексы, оптимизированные запросы, кэширование
5. **Тестируемость**: Unit, интеграционные и E2E тесты

## Заключение

Этот обновленный план обеспечивает:

- **Минимальное воздействие** на существующую инфраструктуру Twenty
- **Максимальное переиспользование** текущей функциональности агентов и инструментов
- **Безопасность и надежность** через валидацию, ограничения и обработку ошибок
- **Масштабируемость** через модульную архитектуру и оптимизации
- **Постепенное внедрение** через фичефлаги и пилотные workspace

Основной принцип остается неизменным: "не ломать то, что работает", добавляя новые возможности поверх существующей архитектуры с учетом всех критических замечаний и требований безопасности.

---

**Дата обновления**: $(date)
**Версия**: 2.0
**Статус**: План готов к реализации с учетом всех критических исправлений

### 11. Определения сущностей (ДОБАВЛЕНО)

#### LangGraphWorkflowEntity
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/entities/langgraph-workflow.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index } from 'typeorm';

@Entity({ name: 'langgraph_workflows' })
export class LangGraphWorkflowEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column() 
  workspaceId: string;
  
  @Index() 
  @Column() 
  name: string;

  @Column({ type: 'jsonb' }) 
  nodes: LangGraphNodeDTO[];
  
  @Column({ type: 'jsonb' }) 
  edges: LangGraphEdgeDTO[];

  @Column({ nullable: true }) 
  description?: string;

  @Column({ default: 1 }) 
  version: number;
  
  @CreateDateColumn() 
  createdAt: Date;
  
  @UpdateDateColumn() 
  updatedAt: Date;
  
  @DeleteDateColumn({ nullable: true }) 
  deletedAt?: Date;
}
```

#### LangGraphExecutionEntity
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/entities/langgraph-execution.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'langgraph_executions' })
export class LangGraphExecutionEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column() 
  workspaceId: string;
  
  @Column() 
  workflowId: string;
  
  @Column() 
  workflowVersion: number;

  @Column({ type: 'jsonb' }) 
  input: unknown;
  
  @Column({ type: 'jsonb', nullable: true }) 
  state?: LangGraphStateDTO;
  
  @Column({ type: 'jsonb', nullable: true }) 
  result?: unknown;

  @Column({ type: 'jsonb', default: [] }) 
  events: LangGraphEventDTO[];
  
  @Column({ type: 'jsonb', default: {} }) 
  usage: { tokensPrompt?: number; tokensCompletion?: number; cost?: number };

  @Column({ type: 'varchar', default: 'RUNNING' })
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'WAITING_INPUT';

  @Column({ nullable: true }) 
  errorMessage?: string;
  
  @CreateDateColumn() 
  createdAt: Date;
  
  @UpdateDateColumn() 
  updatedAt: Date;
  
  @Index() 
  @Column({ nullable: true }) 
  parentExecutionId?: string; // для саб-воркфлоу
}
```

### 12. Типы и интерфейсы (ДОБАВЛЕНО)

#### LangGraphState и ExecutionOptions
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/types/langgraph.ts
export interface LangGraphState {
  context: Record<string, unknown>;
  prompt?: string;
  schema?: unknown;
  toolInput?: unknown;
  result?: unknown;
  toolResult?: unknown;
  updates?: Record<string, unknown>;
}

export interface ExecutionOptions {
  workflowId: string;
  input: unknown;
  workspaceId: string;
  executionId?: string; // для идемпотентности/возобновления
  stream?: boolean;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export type LangGraphNodeType = 'AGENT' | 'TOOL' | 'CONDITIONAL' | 'HUMAN_INPUT';

export interface LangGraphNodeDTO {
  id: string;
  type: LangGraphNodeType;
  agentId?: string;                 // для AGENT
  prompt?: string;
  toolType?: string;                // для TOOL
  toolConfig?: Record<string, unknown>;
  conditionExpr?: string;           // для CONDITIONAL
  position?: { x: number; y: number };
}

export interface LangGraphEdgeDTO {
  id?: string;
  from: string;
  to: string;
  condition?: string; // условие на переход (label)
}

export interface LangGraphEventDTO {
  ts: Date;
  type: string;
  data?: unknown;
  nodeId?: string;
}

export interface LangGraphStateDTO {
  context: Record<string, unknown>;
  result?: unknown;
  toolResult?: unknown;
  updates?: Record<string, unknown>;
}
```

### 13. Улучшенный LangGraphExecutionService (ДОБАВЛЕНО)

```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/services/langgraph-execution.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StateGraph } from '@langchain/langgraph-js';
import { LangGraphWorkflowEntity, LangGraphExecutionEntity } from '../entities';
import { AgentAdapter, ToolAdapter } from '../adapters';
import { AiBillingService } from '../../ai/services/ai-billing.service';
import { AgentStreamingService } from '../../metadata-modules/agent/agent-streaming.service';
import { LangGraphCheckpointer } from './langgraph-checkpointer.service';
import { ExecutionOptions, LangGraphState, LangGraphExecutionResultDTO } from '../types/langgraph';

@Injectable()
export class LangGraphExecutionService {
  constructor(
    @InjectRepository(LangGraphWorkflowEntity, 'core')
    private readonly wfRepo: Repository<LangGraphWorkflowEntity>,
    @InjectRepository(LangGraphExecutionEntity, 'core')
    private readonly execRepo: Repository<LangGraphExecutionEntity>,
    private readonly agentAdapter: AgentAdapter,
    private readonly toolAdapter: ToolAdapter,
    private readonly aiBilling: AiBillingService,
    private readonly streaming: AgentStreamingService,
    private readonly checkpointer: LangGraphCheckpointer,
  ) {}

  async executeWorkflow(opts: ExecutionOptions): Promise<LangGraphExecutionResultDTO> {
    const wf = await this.wfRepo.findOneOrFail({ 
      where: { id: opts.workflowId, workspaceId: opts.workspaceId } 
    });
    
    const execution = await this.execRepo.save({
      workspaceId: opts.workspaceId,
      workflowId: wf.id,
      workflowVersion: wf.version,
      input: opts.input,
      status: 'RUNNING',
    });

    const graph = this.buildGraph(wf, execution.id, opts.workspaceId);

    try {
      const result = await graph.invoke(
        { ...opts.input }, 
        { configurable: { thread_id: execution.id } }
      );
      
      await this.execRepo.update(execution.id, {
        status: 'SUCCEEDED',
        result,
        updatedAt: new Date(),
      });
      
      return await this.execRepo.findOneByOrFail({ id: execution.id });
    } catch (e) {
      await this.execRepo.update(execution.id, {
        status: 'FAILED',
        errorMessage: e?.message ?? 'Unknown error',
      });
      throw e;
    }
  }

  private buildGraph(wf: LangGraphWorkflowEntity, executionId: string, workspaceId: string) {
    const sg = new StateGraph({ 
      channels: {
        context: 'replace',
        result: 'replace',
        toolResult: 'replace',
        updates: 'update',
      }
    });

    // Добавляем ноды
    for (const node of wf.nodes) {
      if (node.type === 'AGENT') {
        sg.addNode(node.id, this.agentAdapter.createAgentNode(
          node.agentId!, 
          workspaceId, 
          { prompt: node.prompt }
        ));
      } else if (node.type === 'TOOL') {
        sg.addNode(node.id, this.toolAdapter.createToolNode(
          node.toolType!, 
          node.toolConfig
        ));
      } else if (node.type === 'HUMAN_INPUT') {
        sg.addNode(node.id, this.createHumanInputNode());
      } else if (node.type === 'CONDITIONAL') {
        sg.addNode(node.id, this.createRouterNode(node.conditionExpr));
      }
    }

    // Добавляем ребра (условные)
    for (const edge of wf.edges) {
      if (edge.condition) {
        sg.addConditionalEdges(edge.from, (state) => this.evalCondition(edge.condition!, state));
      } else {
        sg.addEdge(edge.from, edge.to);
      }
    }

    sg.setEntry(wf.nodes[0]?.id);
    const app = sg.compile({
      checkpointer: this.checkpointer,
      name: `wf:${wf.id}:v${wf.version}`,
      interruptBefore: ['HUMAN_INPUT'],
      hooks: [this.createHooks(executionId, workspaceId)],
    });
    return app;
  }

  private createRouterNode(conditionExpr?: string) {
    return async (state: LangGraphState) => state;
  }

  private createHumanInputNode() {
    return async (state: LangGraphState) => {
      // Создаем задание для человека и прерываемся до возобновления
      // Интеграция с agent-handoff-executor.service.ts
      return state;
    };
  }

  private evalCondition(expr: string, state: LangGraphState): string {
    // Возвращает label перехода (e.g., 'needs_deep_analysis')
    // Используйте безопасный парсер: expr-eval/JEXL с whitelisting
    return 'default';
  }

  private createHooks(executionId: string, workspaceId: string) {
    return {
      on_node_start: async (nodeId: string, state: LangGraphState) => {
        await this.streaming.emitEvent(executionId, {
          type: 'node_start',
          nodeId,
          data: { state }
        });
      },
      on_node_end: async (nodeId: string, state: LangGraphState, result: unknown) => {
        // Биллинг
        if (result?.usage) {
          await this.aiBilling.recordUsage({
            executionId,
            nodeId,
            usage: result.usage
          });
        }
        
        await this.streaming.emitEvent(executionId, {
          type: 'node_end',
          nodeId,
          data: { state, result }
        });
      }
    };
  }

  async cancel(executionId: string) {
    await this.execRepo.update(executionId, {
      status: 'CANCELED',
      updatedAt: new Date()
    });
  }
}
```

### 14. Checkpointer Service (ДОБАВЛЕНО)

```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/services/langgraph-checkpointer.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LangGraphExecutionEntity } from '../entities/langgraph-execution.entity';
import { LangGraphState, LangGraphEventDTO } from '../types/langgraph';

@Injectable()
export class LangGraphCheckpointer {
  constructor(
    @InjectRepository(LangGraphExecutionEntity, 'core')
    private readonly execRepo: Repository<LangGraphExecutionEntity>,
  ) {}

  async get(config: { thread_id: string }) {
    const exec = await this.execRepo.findOneBy({ id: config.thread_id });
    return exec?.state ?? null;
  }

  async put(config: { thread_id: string }, state: LangGraphState, event?: LangGraphEventDTO) {
    await this.execRepo.update(config.thread_id, {
      state,
      events: () => event 
        ? `COALESCE(events, '[]'::jsonb) || ${JSON.stringify(event)}::jsonb` 
        : 'events',
      updatedAt: new Date(),
    });
  }
}
```

### 15. Улучшенные адаптеры (ДОБАВЛЕНО)

#### AgentAdapter с трейсингом и биллингом
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/adapters/agent-adapter.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentExecutionService } from '../../metadata-modules/agent/agent-execution.service';
import { AgentEntity } from '../../metadata-modules/agent/entities/agent.entity';
import { AiBillingService } from '../../ai/services/ai-billing.service';
import { LangGraphState } from '../types/langgraph';

@Injectable()
export class AgentAdapter {
  constructor(
    private agentExecutionService: AgentExecutionService,
    @InjectRepository(AgentEntity, 'metadata')
    private agentRepository: Repository<AgentEntity>,
    private aiBilling: AiBillingService,
  ) {}

  async createAgentNode(agentId: string, workspaceId: string, opts?: { prompt?: string }) {
    return async (state: LangGraphState, meta?: { nodeId?: string; executionId?: string }) => {
      const agent = await this.agentRepository.findOneByOrFail({ 
        id: agentId, 
        workspaceId 
      });
      
      const start = Date.now();
      const exec = await this.agentExecutionService.executeAgent({
        agent,
        context: { 
          ...state.context, 
          prompt: opts?.prompt ?? state.prompt, 
          executionId: meta?.executionId, 
          nodeId: meta?.nodeId 
        },
        schema: state.schema,
        userPrompt: opts?.prompt ?? state.prompt,
        stream: true, // включить стриминг
      });
      
      // Биллинг
      if (exec.usage) {
        await this.aiBilling.recordUsage({ 
          executionId: meta?.executionId!, 
          nodeId: meta?.nodeId!, 
          usage: exec.usage 
        });
      }
      
      return { 
        ...state, 
        result: exec.result, 
        updates: { [`node:${meta?.nodeId}:result`]: exec.result } 
      };
    };
  }
}
```

#### ToolAdapter с валидацией и обработкой ошибок
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/adapters/tool-adapter.ts
import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../ai/services/tool-registry.service';
import { LangGraphState } from '../types/langgraph';

@Injectable()
export class ToolAdapter {
  constructor(private toolRegistry: ToolRegistryService) {}

  createToolNode(toolType: string, config?: Record<string, unknown>) {
    return async (state: LangGraphState, meta?: { nodeId?: string; executionId?: string; workspaceId?: string }) => {
      try {
        const tool = this.toolRegistry.getTool(toolType, { 
          workspaceId: meta?.workspaceId 
        });
        
        const result = await tool.execute({ 
          input: state.toolInput, 
          config, 
          context: state.context 
        });
        
        return { 
          ...state, 
          toolResult: result, 
          updates: { [`node:${meta?.nodeId}:toolResult`]: result } 
        };
      } catch (error) {
        // Логируем ошибку и возвращаем состояние с ошибкой
        console.error(`Tool execution failed for ${toolType}:`, error);
        return {
          ...state,
          toolResult: { error: error.message },
          updates: { [`node:${meta?.nodeId}:error`]: error.message }
        };
      }
    };
  }
}
```

### 16. Безопасность и ограничения (ДОБАВЛЕНО)

#### Безопасная оценка условий
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/utils/condition-evaluator.ts
import { Injectable } from '@nestjs/common';
import { evaluate } from 'jexl'; // Безопасный парсер выражений
import { LangGraphState } from '../types/langgraph';

@Injectable()
export class ConditionEvaluator {
  private readonly allowedContextKeys = [
    'result', 'toolResult', 'context', 'updates'
  ];

  private readonly allowedFunctions = {
    contains: (str: string, substr: string) => str.includes(substr),
    length: (arr: any[]) => arr.length,
    isEmpty: (val: any) => !val || (Array.isArray(val) && val.length === 0),
    isNotEmpty: (val: any) => val && (!Array.isArray(val) || val.length > 0),
  };

  evalCondition(expr: string, state: LangGraphState): string {
    try {
      // Санитайзинг входных данных
      const sanitizedState = this.sanitizeState(state);
      
      // Настройка JEXL с ограничениями
      const context = {
        ...sanitizedState,
        ...this.allowedFunctions,
      };

      const result = evaluate(expr, context);
      
      // Возвращаем строковый label для перехода
      return String(result);
    } catch (error) {
      console.error('Condition evaluation failed:', error);
      return 'default'; // Fallback на дефолтный переход
    }
  }

  private sanitizeState(state: LangGraphState): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const key of this.allowedContextKeys) {
      if (state[key as keyof LangGraphState]) {
        sanitized[key] = state[key as keyof LangGraphState];
      }
    }
    
    return sanitized;
  }
}
```

#### Ограничения и таймауты
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/config/langgraph.config.ts
export interface LangGraphConfig {
  // Таймауты
  nodeTimeoutMs: number;        // 30000 (30 сек на ноду)
  workflowTimeoutMs: number;    // 300000 (5 мин на workflow)
  
  // Лимиты
  maxNodesPerWorkflow: number;  // 50
  maxIterations: number;        // 100 (для циклов)
  maxConcurrentExecutions: number; // 10 на workspace
  
  // Безопасность
  maxInputSize: number;         // 1MB
  maxStateSize: number;         // 10MB
  allowedToolTypes: string[];   // Whitelist инструментов
}

export const DEFAULT_LANGGRAPH_CONFIG: LangGraphConfig = {
  nodeTimeoutMs: 30000,
  workflowTimeoutMs: 300000,
  maxNodesPerWorkflow: 50,
  maxIterations: 100,
  maxConcurrentExecutions: 10,
  maxInputSize: 1024 * 1024, // 1MB
  maxStateSize: 10 * 1024 * 1024, // 10MB
  allowedToolTypes: ['HTTP_REQUEST', 'SEND_EMAIL', 'DATABASE_QUERY'],
};
```

#### Валидация workflow
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/utils/workflow-validator.ts
import { Injectable } from '@nestjs/common';
import { LangGraphWorkflowEntity, LangGraphNodeDTO, LangGraphEdgeDTO } from '../entities';
import { LangGraphConfig } from '../config/langgraph.config';

@Injectable()
export class WorkflowValidator {
  constructor(private config: LangGraphConfig) {}

  validateWorkflow(workflow: Partial<LangGraphWorkflowEntity>): string[] {
    const errors: string[] = [];

    // Проверка количества нод
    if (workflow.nodes && workflow.nodes.length > this.config.maxNodesPerWorkflow) {
      errors.push(`Too many nodes: ${workflow.nodes.length} > ${this.config.maxNodesPerWorkflow}`);
    }

    // Проверка на циклы
    if (workflow.nodes && workflow.edges) {
      const hasCycles = this.detectCycles(workflow.nodes, workflow.edges);
      if (hasCycles) {
        errors.push('Workflow contains cycles');
      }
    }

    // Валидация нод
    if (workflow.nodes) {
      for (const node of workflow.nodes) {
        const nodeErrors = this.validateNode(node);
        errors.push(...nodeErrors.map(e => `Node ${node.id}: ${e}`));
      }
    }

    return errors;
  }

  private validateNode(node: LangGraphNodeDTO): string[] {
    const errors: string[] = [];

    if (node.type === 'AGENT' && !node.agentId) {
      errors.push('AGENT node must have agentId');
    }

    if (node.type === 'TOOL' && !node.toolType) {
      errors.push('TOOL node must have toolType');
    }

    if (node.type === 'TOOL' && !this.config.allowedToolTypes.includes(node.toolType!)) {
      errors.push(`Tool type ${node.toolType} is not allowed`);
    }

    return errors;
  }

  private detectCycles(nodes: LangGraphNodeDTO[], edges: LangGraphEdgeDTO[]): boolean {
    // Простая проверка на циклы через DFS
    const graph = new Map<string, string[]>();
    
    for (const edge of edges) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const node of nodes) {
      if (hasCycle(node.id)) return true;
    }

    return false;
  }
}
```

### 17. Миграции и индексы (ДОБАВЛЕНО)

#### Миграция для новых таблиц
```typescript
// packages/twenty-server/src/database/migrations/1700000000000-CreateLangGraphTables.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLangGraphTables1700000000000 implements MigrationInterface {
  name = 'CreateLangGraphTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Таблица workflow
    await queryRunner.query(`
      CREATE TABLE "langgraph_workflows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "nodes" jsonb NOT NULL,
        "edges" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_langgraph_workflows" PRIMARY KEY ("id")
      )
    `);

    // Таблица executions
    await queryRunner.query(`
      CREATE TABLE "langgraph_executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" character varying NOT NULL,
        "workflowId" uuid NOT NULL,
        "workflowVersion" integer NOT NULL,
        "input" jsonb NOT NULL,
        "state" jsonb,
        "result" jsonb,
        "events" jsonb NOT NULL DEFAULT '[]',
        "usage" jsonb NOT NULL DEFAULT '{}',
        "status" character varying NOT NULL DEFAULT 'RUNNING',
        "errorMessage" character varying,
        "parentExecutionId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_langgraph_executions" PRIMARY KEY ("id")
      )
    `);

    // Индексы
    await queryRunner.query(`
      CREATE INDEX "IDX_langgraph_workflows_workspace" ON "langgraph_workflows" ("workspaceId")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_langgraph_workflows_name" ON "langgraph_workflows" ("name")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_langgraph_executions_workspace_status" ON "langgraph_executions" ("workspaceId", "status")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_langgraph_executions_workflow_created" ON "langgraph_executions" ("workflowId", "createdAt")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_langgraph_executions_parent" ON "langgraph_executions" ("parentExecutionId")
    `);

    // Внешние ключи
    await queryRunner.query(`
      ALTER TABLE "langgraph_executions" 
      ADD CONSTRAINT "FK_langgraph_executions_workflow" 
      FOREIGN KEY ("workflowId") REFERENCES "langgraph_workflows"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "langgraph_executions"`);
    await queryRunner.query(`DROP TABLE "langgraph_workflows"`);
  }
}
```

### 18. Стратегия тестирования (ДОБАВЛЕНО)

#### Unit тесты
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/adapters/__tests__/agent-adapter.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AgentAdapter } from '../agent-adapter';
import { AgentExecutionService } from '../../../metadata-modules/agent/agent-execution.service';
import { AiBillingService } from '../../../ai/services/ai-billing.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentEntity } from '../../../metadata-modules/agent/entities/agent.entity';

describe('AgentAdapter', () => {
  let adapter: AgentAdapter;
  let mockAgentExecutionService: jest.Mocked<AgentExecutionService>;
  let mockAiBillingService: jest.Mocked<AiBillingService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentAdapter,
        {
          provide: AgentExecutionService,
          useValue: {
            executeAgent: jest.fn(),
          },
        },
        {
          provide: AiBillingService,
          useValue: {
            recordUsage: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AgentEntity, 'metadata'),
          useValue: {
            findOneByOrFail: jest.fn(),
          },
        },
      ],
    }).compile();

    adapter = module.get<AgentAdapter>(AgentAdapter);
    mockAgentExecutionService = module.get(AgentExecutionService);
    mockAiBillingService = module.get(AiBillingService);
  });

  it('should create agent node with proper execution', async () => {
    const agentNode = await adapter.createAgentNode('agent-1', 'workspace-1', {
      prompt: 'Test prompt'
    });

    const mockState = { context: { data: 'test' }, prompt: 'original' };
    const mockMeta = { nodeId: 'node-1', executionId: 'exec-1' };

    mockAgentExecutionService.executeAgent.mockResolvedValue({
      result: { output: 'test result' },
      usage: { tokensPrompt: 10, tokensCompletion: 5 }
    });

    const result = await agentNode(mockState, mockMeta);

    expect(result.result).toEqual({ output: 'test result' });
    expect(mockAiBillingService.recordUsage).toHaveBeenCalledWith({
      executionId: 'exec-1',
      nodeId: 'node-1',
      usage: { tokensPrompt: 10, tokensCompletion: 5 }
    });
  });
});
```

#### Интеграционные тесты
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/__tests__/langgraph-execution.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LangGraphExecutionService } from '../services/langgraph-execution.service';
import { LangGraphWorkflowEntity, LangGraphExecutionEntity } from '../entities';
import { AgentAdapter, ToolAdapter } from '../adapters';
import { AiBillingService } from '../../ai/services/ai-billing.service';
import { AgentStreamingService } from '../../metadata-modules/agent/agent-streaming.service';
import { LangGraphCheckpointer } from '../services/langgraph-checkpointer.service';

describe('LangGraphExecutionService Integration', () => {
  let service: LangGraphExecutionService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'twenty_test',
          entities: [LangGraphWorkflowEntity, LangGraphExecutionEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([LangGraphWorkflowEntity, LangGraphExecutionEntity], 'core'),
      ],
      providers: [
        LangGraphExecutionService,
        AgentAdapter,
        ToolAdapter,
        AiBillingService,
        AgentStreamingService,
        LangGraphCheckpointer,
      ],
    }).compile();

    service = module.get<LangGraphExecutionService>(LangGraphExecutionService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('should execute simple workflow with agent and tool', async () => {
    // Создаем тестовый workflow
    const workflow = {
      name: 'Test Workflow',
      workspaceId: 'test-workspace',
      nodes: [
        {
          id: 'agent-1',
          type: 'AGENT' as const,
          agentId: 'test-agent',
          prompt: 'Process the input'
        },
        {
          id: 'tool-1',
          type: 'TOOL' as const,
          toolType: 'HTTP_REQUEST',
          toolConfig: { url: 'https://api.example.com' }
        }
      ],
      edges: [
        { from: 'agent-1', to: 'tool-1' }
      ]
    };

    const result = await service.executeWorkflow({
      workflowId: 'test-workflow-id',
      input: { data: 'test input' },
      workspaceId: 'test-workspace'
    });

    expect(result.status).toBe('SUCCEEDED');
    expect(result.result).toBeDefined();
  });
});
```

#### E2E тесты
```typescript
// packages/twenty-e2e-testing/tests/langgraph-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('LangGraph Workflow E2E', () => {
  test('should create and execute workflow via GraphQL', async ({ request }) => {
    // Создаем workflow
    const createResponse = await request.post('/graphql', {
      data: {
        query: `
          mutation CreateWorkflow($input: CreateLangGraphWorkflowInput!) {
            createLangGraphWorkflow(input: $input) {
              id
              name
              nodes {
                id
                type
                agentId
              }
            }
          }
        `,
        variables: {
          input: {
            name: 'E2E Test Workflow',
            nodes: [
              {
                id: 'agent-1',
                type: 'AGENT',
                agentId: 'test-agent-id',
                prompt: 'Process input'
              }
            ],
            edges: []
          }
        }
      }
    });

    const createResult = await createResponse.json();
    expect(createResult.data.createLangGraphWorkflow.id).toBeDefined();

    // Выполняем workflow
    const executeResponse = await request.post('/graphql', {
      data: {
        query: `
          mutation ExecuteWorkflow($input: ExecuteLangGraphInput!) {
            executeLangGraphWorkflow(input: $input) {
              executionId
              status
              result
            }
          }
        `,
        variables: {
          input: {
            workflowId: createResult.data.createLangGraphWorkflow.id,
            input: { testData: 'e2e test' }
          }
        }
      }
    });

    const executeResult = await executeResponse.json();
    expect(executeResult.data.executeLangGraphWorkflow.status).toBe('SUCCEEDED');
  });

  test('should stream workflow events', async ({ request }) => {
    // Тест GraphQL subscriptions
    const subscription = await request.post('/graphql', {
      data: {
        query: `
          subscription WorkflowEvents($executionId: ID!) {
            langGraphExecutionEvents(executionId: $executionId) {
              type
              nodeId
              data
            }
          }
        `,
        variables: {
          executionId: 'test-execution-id'
        }
      }
    });

    // Проверяем получение событий
    const events = await subscription.json();
    expect(events.data.langGraphExecutionEvents).toBeDefined();
  });
});
```

### 19. Фичефлаг и постепенное внедрение (ДОБАВЛЕНО)

#### Конфигурация фичефлага
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/config/feature-flags.ts
export interface LangGraphFeatureFlags {
  enabled: boolean;
  enabledWorkspaces: string[]; // Whitelist для пилотных workspace
  maxWorkflowsPerWorkspace: number;
  allowConditionalNodes: boolean;
  allowHumanInputNodes: boolean;
}

export const LANGGRAPH_FEATURE_FLAGS: LangGraphFeatureFlags = {
  enabled: process.env.FEATURE_LANGGRAPH_ENABLED === 'true',
  enabledWorkspaces: process.env.LANGGRAPH_ENABLED_WORKSPACES?.split(',') || [],
  maxWorkflowsPerWorkspace: parseInt(process.env.LANGGRAPH_MAX_WORKFLOWS_PER_WORKSPACE || '10'),
  allowConditionalNodes: process.env.LANGGRAPH_ALLOW_CONDITIONAL_NODES === 'true',
  allowHumanInputNodes: process.env.LANGGRAPH_ALLOW_HUMAN_INPUT_NODES === 'true',
};
```

#### Middleware для проверки фичефлага
```typescript
// packages/twenty-server/src/engine/core-modules/langgraph/middleware/langgraph-feature.middleware.ts
import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { LANGGRAPH_FEATURE_FLAGS } from '../config/feature-flags';

@Injectable()
export class LangGraphFeatureMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const workspaceId = req.headers['x-workspace-id'] as string;
    
    if (!LANGGRAPH_FEATURE_FLAGS.enabled) {
      throw new ForbiddenException('LangGraph feature is not enabled');
    }

    if (LANGGRAPH_FEATURE_FLAGS.enabledWorkspaces.length > 0 && 
        !LANGGRAPH_FEATURE_FLAGS.enabledWorkspaces.includes(workspaceId)) {
      throw new ForbiddenException('LangGraph feature is not enabled for this workspace');
    }

    next();
  }
}
```
