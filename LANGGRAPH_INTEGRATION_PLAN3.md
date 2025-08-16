# LangGraph Integration Plan 3.0 - Детальный анализ и пошаговое внедрение

## Цель
Внедрить LangGraph мультиагенты в Twenty с **минимальными изменениями** в существующую инфраструктуру, используя текущую систему агентов и AI чат интерфейс.

## Анализ существующей архитектуры Twenty

### 1. Ключевые классы и их ответственности

#### AgentExecutionService
**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent-execution.service.ts`
**Ответственность**: Основной сервис для выполнения агентов
**Ключевые методы**:
- `executeAgent()` - выполнение агента с контекстом и схемой
- `streamChatResponse()` - стриминг ответов агента
- `prepareAIRequestConfig()` - подготовка конфигурации AI запроса

**Текущая логика**:
```typescript
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
```

#### ToolRegistryService
**Файл**: `packages/twenty-server/src/engine/core-modules/tool/services/tool-registry.service.ts`
**Ответственность**: Реестр доступных инструментов
**Ключевые методы**:
- `getTool(toolType)` - получение инструмента по типу
- `getAllToolTypes()` - получение всех типов инструментов

**Поддерживаемые инструменты**:
- `HTTP_REQUEST` - HTTP запросы
- `SEND_EMAIL` - отправка email

#### AgentStreamingService
**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent-streaming.service.ts`
**Ответственность**: Стриминг событий агентов
**Ключевые методы**:
- `streamAgentChat()` - стриминг чата агента
- `setupStreamingHeaders()` - настройка заголовков стриминга

#### AIBillingService
**Файл**: `packages/twenty-server/src/engine/core-modules/ai/services/ai-billing.service.ts`
**Ответственность**: Биллинг AI операций
**Ключевые методы**:
- `calculateCost()` - расчет стоимости
- `calculateAndBillUsage()` - расчет и списание использования

#### AgentToolService
**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent-tool.service.ts`
**Ответственность**: Генерация инструментов для агентов
**Ключевые методы**:
- `generateToolsForAgent()` - генерация инструментов для агента
- `generateHandoffTools()` - генерация инструментов передачи

### 2. Существующие workflow компоненты

#### WorkflowActionFactory
**Файл**: `packages/twenty-server/src/modules/workflow/workflow-executor/factories/workflow-action.factory.ts`
**Ответственность**: Фабрика workflow действий
**Поддерживаемые действия**:
- `AI_AGENT` - выполнение AI агента
- `TOOL_EXECUTOR` - выполнение инструментов
- `CODE` - выполнение кода

#### AiAgentWorkflowAction
**Файл**: `packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/ai-agent/ai-agent.workflow-action.ts`
**Ответственность**: Выполнение AI агента в workflow
**Интеграция**: Использует `AgentExecutionService.executeAgent()`

## План внедрения LangGraph

### Фаза 1: Минимальная интеграция (2-3 недели)

#### 1.1 Добавление agentType в AgentEntity

**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent.entity.ts`

```typescript
// Добавить новое поле
@Column({ nullable: false, type: 'varchar', default: 'STANDARD' })
agentType: 'STANDARD' | 'LANGGRAPH';
```

**Миграция**: `packages/twenty-server/src/database/migrations/1700000000001-AddAgentType.ts`

```typescript
export class AddAgentType1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."agent" 
      ADD COLUMN "agentType" character varying NOT NULL DEFAULT 'STANDARD'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "core"."agent" DROP COLUMN "agentType"
    `);
  }
}
```

#### 1.2 Создание типов LangGraph

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/types.ts`

```typescript
export type LangGraphNodeType = 'AGENT' | 'TOOL' | 'CONDITIONAL' | 'HUMAN_INPUT';

export interface LangGraphNodeConfig {
  id: string;
  type: LangGraphNodeType;
  agentId?: string;             // для AGENT
  prompt?: string;
  toolType?: string;            // для TOOL
  toolConfig?: Record<string, unknown>;
  conditionExpr?: string;       // для CONDITIONAL (Фаза 2)
}

export interface LangGraphEdgeConfig {
  from: string;
  to: string;
  condition?: string; // label ветви (Фаза 2)
}

export interface LangGraphWorkflowConfig {
  nodes: LangGraphNodeConfig[];
  edges: LangGraphEdgeConfig[];
  entryNodeId?: string;
  metadata?: { version: string; description?: string; tags?: string[] };
  maxIterations?: number;
  timeoutMs?: number;
}

export interface LangGraphState {
  context: Record<string, unknown>;
  prompt?: string;
  result?: unknown;
  toolResult?: unknown;
  updates?: Record<string, unknown>;
}

export interface LangGraphExecutionResult {
  result: unknown;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  events?: LangGraphEvent[];
}

export interface LangGraphEvent {
  ts: Date;
  type: string;
  data?: unknown;
  nodeId?: string;
}
```

#### 1.3 Создание LangGraphExecutionAdapter

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/langgraph-execution.adapter.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { StateGraph } from '@langchain/langgraph';
import { AgentExecutionService } from '../../metadata-modules/agent/agent-execution.service';
import { ToolRegistryService } from '../../tool/services/tool-registry.service';
import { WorkflowValidator } from './workflow-validator';
import { LangGraphNodeFactory } from './node-factory';
import { LangGraphWorkflowConfig, LangGraphState, LangGraphExecutionResult } from './types';
import { AgentEntity } from '../../metadata-modules/agent/agent.entity';

@Injectable()
export class LangGraphExecutionAdapter {
  private readonly logger = new Logger(LangGraphExecutionAdapter.name);

  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly validator: WorkflowValidator,
    private readonly nodeFactory: LangGraphNodeFactory,
  ) {}

  async execute(
    agent: AgentEntity, 
    context: Record<string, unknown>, 
    userPrompt: string
  ): Promise<LangGraphExecutionResult> {
    const cfg = (agent.responseFormat as any)?.workflow as LangGraphWorkflowConfig;
    
    if (!cfg) {
      throw new Error('LangGraph workflow configuration not found in agent responseFormat');
    }

    this.validator.ensureValid(cfg);

    const app = this.buildGraph(cfg);
    const initial: LangGraphState = { 
      context, 
      prompt: userPrompt,
      updates: {}
    };

    this.logger.log(`Executing LangGraph workflow for agent ${agent.id} with ${cfg.nodes.length} nodes`);

    try {
      const result = await app.invoke(initial);
      
      return {
        result: result?.result ?? result,
        usage: result?.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        events: result?.events ?? []
      };
    } catch (error) {
      this.logger.error(`LangGraph execution failed for agent ${agent.id}:`, error);
      throw error;
    }
  }

  private buildGraph(cfg: LangGraphWorkflowConfig) {
    const graph = new StateGraph<LangGraphState>({
      channels: { 
        result: 'replace', 
        toolResult: 'replace', 
        updates: 'update', 
        context: 'update' 
      },
    });

    // Добавляем ноды (Фаза 1: только AGENT и TOOL)
    for (const node of cfg.nodes) {
      if (node.type === 'AGENT') {
        graph.addNode(node.id, this.nodeFactory.createAgentNode(node));
      } else if (node.type === 'TOOL') {
        graph.addNode(node.id, this.nodeFactory.createToolNode(node));
      }
    }

    // Рёбра — линейные (без условных переходов на Фазе 1)
    for (const edge of cfg.edges) {
      graph.addEdge(edge.from, edge.to);
    }

    const entryNodeId = cfg.entryNodeId ?? cfg.nodes[0]?.id;
    if (!entryNodeId) {
      throw new Error('No entry node specified and no nodes available');
    }

    graph.setEntry(entryNodeId);
    
    return graph.compile({
      name: `langgraph:${entryNodeId}`,
      timeout_ms: cfg.timeoutMs ?? 5 * 60 * 1000, // 5 минут по умолчанию
    });
  }
}
```

#### 1.4 Создание LangGraphNodeFactory

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/node-factory.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AgentExecutionService } from '../../metadata-modules/agent/agent-execution.service';
import { ToolRegistryService } from '../../tool/services/tool-registry.service';
import { LangGraphNodeConfig, LangGraphState } from './types';
import { AgentEntity } from '../../metadata-modules/agent/agent.entity';

@Injectable()
export class LangGraphNodeFactory {
  private readonly logger = new Logger(LangGraphNodeFactory.name);

  constructor(
    private readonly agentExecutionService: AgentExecutionService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  createAgentNode(node: LangGraphNodeConfig) {
    return async (state: LangGraphState) => {
      this.logger.log(`Executing agent node ${node.id} with agent ${node.agentId}`);

      if (!node.agentId) {
        throw new Error(`Agent node ${node.id} must have agentId`);
      }

      // В реальной реализации нужно загрузить агента по ID
      // Пока используем заглушку
      const agent = { id: node.agentId } as AgentEntity;

      const exec = await this.agentExecutionService.executeAgent({
        agent,
        context: { ...state.context, nodeId: node.id },
        userPrompt: node.prompt ?? state.prompt ?? '',
        schema: {}, // Пустая схема для LangGraph нод
      });

      return { 
        ...state, 
        result: exec.result,
        updates: { 
          ...state.updates, 
          [`node:${node.id}:result`]: exec.result 
        }
      };
    };
  }

  createToolNode(node: LangGraphNodeConfig) {
    return async (state: LangGraphState) => {
      this.logger.log(`Executing tool node ${node.id} with tool ${node.toolType}`);

      if (!node.toolType) {
        throw new Error(`Tool node ${node.id} must have toolType`);
      }

      try {
        const tool = this.toolRegistry.getTool(node.toolType as any);
        const res = await tool.execute({ 
          input: state.result ?? state.context, 
          config: node.toolConfig 
        });

        return { 
          ...state, 
          toolResult: res,
          result: res,
          updates: { 
            ...state.updates, 
            [`node:${node.id}:toolResult`]: res 
          }
        };
      } catch (error) {
        this.logger.error(`Tool execution failed for node ${node.id}:`, error);
        return {
          ...state,
          toolResult: { error: error.message },
          result: { error: error.message },
          updates: { 
            ...state.updates, 
            [`node:${node.id}:error`]: error.message 
          }
        };
      }
    };
  }
}
```

#### 1.5 Создание WorkflowValidator

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/workflow-validator.ts`

```typescript
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { LangGraphWorkflowConfig } from './types';

@Injectable()
export class WorkflowValidator {
  private readonly logger = new Logger(WorkflowValidator.name);
  private readonly maxNodes = 20;
  private readonly maxIterations = 100;

  ensureValid(cfg: LangGraphWorkflowConfig) {
    if (!cfg?.nodes?.length) {
      throw new BadRequestException('Workflow nodes required');
    }

    if (cfg.nodes.length > this.maxNodes) {
      throw new BadRequestException(`Too many nodes: ${cfg.nodes.length} > ${this.maxNodes}`);
    }

    // Проверка уникальности ID нод
    const nodeIds = new Set<string>();
    for (const node of cfg.nodes) {
      if (nodeIds.has(node.id)) {
        throw new BadRequestException(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);
    }

    // Проверка корректности рёбер
    if (cfg.edges) {
      for (const edge of cfg.edges) {
        if (!nodeIds.has(edge.from)) {
          throw new BadRequestException(`Edge references unknown node: ${edge.from}`);
        }
        if (!nodeIds.has(edge.to)) {
          throw new BadRequestException(`Edge references unknown node: ${edge.to}`);
        }
      }
    }

    // Проверка на циклы
    if (this.detectCycles(cfg.nodes, cfg.edges || [])) {
      throw new BadRequestException('Workflow contains cycles');
    }

    // Валидация нод
    for (const node of cfg.nodes) {
      this.validateNode(node);
    }

    this.logger.log(`Workflow validation passed: ${cfg.nodes.length} nodes, ${cfg.edges?.length || 0} edges`);
  }

  private validateNode(node: any) {
    if (node.type === 'AGENT' && !node.agentId) {
      throw new BadRequestException(`AGENT node ${node.id} must have agentId`);
    }

    if (node.type === 'TOOL' && !node.toolType) {
      throw new BadRequestException(`TOOL node ${node.id} must have toolType`);
    }

    if (node.type === 'CONDITIONAL' && !node.conditionExpr) {
      throw new BadRequestException(`CONDITIONAL node ${node.id} must have conditionExpr`);
    }
  }

  private detectCycles(nodes: any[], edges: any[]): boolean {
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

#### 1.6 Интеграция в AgentExecutionService

**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent-execution.service.ts`

```typescript
// Добавить импорт
import { LangGraphExecutionAdapter } from '../../core-modules/ai/langgraph/langgraph-execution.adapter';

// Добавить в конструктор
constructor(
  // ... существующие зависимости
  private readonly langGraphExecutionAdapter: LangGraphExecutionAdapter,
) {}

// Модифицировать метод executeAgent
async executeAgent({
  agent,
  schema,
  userPrompt,
}: {
  agent: AgentEntity | null;
  context: Record<string, unknown>;
  schema: OutputSchema;
  userPrompt: string;
}): Promise<AgentExecutionResult> {
  try {
    // Проверяем тип агента
    if (agent?.agentType === 'LANGGRAPH') {
      this.logger.log(`Executing LangGraph agent ${agent.id}`);
      
      const result = await this.langGraphExecutionAdapter.execute(
        agent, 
        { schema, ...context }, 
        userPrompt
      );
      
      return {
        result: result.result as object,
        usage: result.usage,
      };
    }

    // Существующая логика для STANDARD агентов
    const aiRequestConfig = await this.prepareAIRequestConfig({
      system: `You are executing as part of a workflow automation. ${agent ? agent.prompt : ''}`,
      agent,
      prompt: userPrompt,
    });
    
    // ... остальная существующая логика
  } catch (error) {
    if (error instanceof AgentException) {
      throw error;
    }
    throw new AgentException(
      error instanceof Error ? error.message : 'Agent execution failed',
      AgentExceptionCode.AGENT_EXECUTION_FAILED,
    );
  }
}
```

#### 1.7 Создание фичефлага

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/feature-flags.ts`

```typescript
export interface LangGraphFeatureFlags {
  enabled: boolean;
  enabledWorkspaces: string[];
  maxWorkflowsPerWorkspace: number;
}

export const LANGGRAPH_FEATURE_FLAGS: LangGraphFeatureFlags = {
  enabled: process.env.FEATURE_LANGGRAPH_ENABLED === 'true',
  enabledWorkspaces: process.env.LANGGRAPH_ENABLED_WORKSPACES?.split(',') || [],
  maxWorkflowsPerWorkspace: parseInt(process.env.LANGGRAPH_MAX_WORKFLOWS_PER_WORKSPACE || '10'),
};
```

#### 1.8 Обновление AgentModule

**Файл**: `packages/twenty-server/src/engine/metadata-modules/agent/agent.module.ts`

```typescript
// Добавить импорты
import { LangGraphExecutionAdapter } from '../../core-modules/ai/langgraph/langgraph-execution.adapter';
import { LangGraphNodeFactory } from '../../core-modules/ai/langgraph/node-factory';
import { WorkflowValidator } from '../../core-modules/ai/langgraph/workflow-validator';

@Module({
  // ... существующие imports
  providers: [
    // ... существующие providers
    LangGraphExecutionAdapter,
    LangGraphNodeFactory,
    WorkflowValidator,
  ],
  exports: [
    // ... существующие exports
    LangGraphExecutionAdapter,
  ],
})
export class AgentModule {}
```

### Фаза 2: Расширенная функциональность (6-8 недель)

#### 2.1 Условные переходы

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/condition-evaluator.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { evaluate } from 'jexl';
import { LangGraphState } from './types';

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
      const sanitizedState = this.sanitizeState(state);
      
      const context = {
        ...sanitizedState,
        ...this.allowedFunctions,
      };

      const result = evaluate(expr, context);
      return String(result);
    } catch (error) {
      console.error('Condition evaluation failed:', error);
      return 'default';
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

#### 2.2 Checkpointer для устойчивого состояния

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/checkpointer.ts`

```typescript
export interface ILangGraphCheckpointer {
  get(threadId: string): Promise<LangGraphState | null>;
  put(threadId: string, state: LangGraphState, event?: any): Promise<void>;
}

@Injectable()
export class InMemoryCheckpointer implements ILangGraphCheckpointer {
  private storage = new Map<string, { state: LangGraphState; events: any[] }>();

  async get(threadId: string): Promise<LangGraphState | null> {
    const data = this.storage.get(threadId);
    return data?.state ?? null;
  }

  async put(threadId: string, state: LangGraphState, event?: any): Promise<void> {
    const existing = this.storage.get(threadId) || { state: {}, events: [] };
    this.storage.set(threadId, {
      state,
      events: event ? [...existing.events, event] : existing.events,
    });
  }
}
```

#### 2.3 Human-in-the-loop поддержка

**Расширение LangGraphNodeFactory**:

```typescript
createHumanInputNode(node: LangGraphNodeConfig) {
  return async (state: LangGraphState) => {
    // Сохраняем состояние
    await this.checkpointer.put(`human-input:${node.id}`, state);
    
    // Прерываем выполнение
    throw new HumanInputRequiredException(node.id, state);
  };
}

createConditionalRouter(node: LangGraphNodeConfig) {
  return async (state: LangGraphState) => {
    if (!node.conditionExpr) {
      return state;
    }
    
    const result = this.conditionEvaluator.evalCondition(node.conditionExpr, state);
    return { ...state, conditionalResult: result };
  };
}
```

### Фаза 3: Выделенный модуль (по необходимости)

#### 3.1 LangGraphModule

**Файл**: `packages/twenty-server/src/engine/core-modules/langgraph/langgraph.module.ts`

```typescript
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([LangGraphWorkflowEntity, LangGraphExecutionEntity], 'core'),
    AgentModule,
  ],
  controllers: [LangGraphController],
  providers: [
    LangGraphExecutionService,
    LangGraphStateService,
    LangGraphWorkflowService,
    LangGraphResolver,
  ],
  exports: [
    LangGraphExecutionService,
    LangGraphWorkflowService,
  ],
})
export class LangGraphModule {}
```

#### 3.2 Сущности для LangGraph

**Файл**: `packages/twenty-server/src/engine/core-modules/langgraph/entities/langgraph-workflow.entity.ts`

```typescript
@Entity({ name: 'langgraph_workflows' })
export class LangGraphWorkflowEntity {
  @PrimaryGeneratedColumn('uuid') 
  id: string;

  @Column() 
  workspaceId: string;
  
  @Column() 
  name: string;

  @Column({ type: 'jsonb' }) 
  nodes: LangGraphNodeConfig[];
  
  @Column({ type: 'jsonb' }) 
  edges: LangGraphEdgeConfig[];

  @Column({ nullable: true }) 
  description?: string;

  @Column({ default: 1 }) 
  version: number;
  
  @CreateDateColumn() 
  createdAt: Date;
  
  @UpdateDateColumn() 
  updatedAt: Date;
}
```

## Примеры использования

### Создание LangGraph агента

```typescript
// Пользователь создает агента через существующий UI
const langGraphAgent = {
  name: "Research Assistant",
  agentType: "LANGGRAPH",
  responseFormat: {
    workflow: {
      nodes: [
        { 
          id: "researcher", 
          type: "AGENT", 
          agentId: "research-agent-id",
          prompt: "Research the topic thoroughly"
        },
        { 
          id: "analyzer", 
          type: "AGENT", 
          agentId: "analysis-agent-id",
          prompt: "Analyze the research data"
        },
        {
          id: "writer",
          type: "AGENT",
          agentId: "writing-agent-id", 
          prompt: "Write a comprehensive report"
        }
      ],
      edges: [
        { from: "researcher", to: "analyzer" },
        { from: "analyzer", to: "writer" }
      ]
    }
  }
}
```

### Workflow с условной логикой

```typescript
const conditionalWorkflow = {
  name: "Smart Analyzer",
  agentType: "LANGGRAPH",
  responseFormat: {
    workflow: {
      nodes: [
        { id: "initial", type: "AGENT", agentId: "analysis-agent-id" },
        { id: "decision", type: "CONDITIONAL", conditionExpr: "result.complexity > 0.7" },
        { id: "deep", type: "AGENT", agentId: "deep-analysis-agent-id" },
        { id: "simple", type: "AGENT", agentId: "simple-analysis-agent-id" }
      ],
      edges: [
        { from: "initial", to: "decision" },
        { from: "decision", to: "deep", condition: "needs_deep_analysis" },
        { from: "decision", to: "simple", condition: "basic_analysis_sufficient" }
      ]
    }
  }
}
```

## План тестирования

### Unit тесты

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/__tests__/langgraph-execution.adapter.spec.ts`

```typescript
describe('LangGraphExecutionAdapter', () => {
  let adapter: LangGraphExecutionAdapter;
  let mockAgentExecutionService: jest.Mocked<AgentExecutionService>;
  let mockToolRegistry: jest.Mocked<ToolRegistryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LangGraphExecutionAdapter,
        {
          provide: AgentExecutionService,
          useValue: {
            executeAgent: jest.fn(),
          },
        },
        {
          provide: ToolRegistryService,
          useValue: {
            getTool: jest.fn(),
          },
        },
        WorkflowValidator,
        LangGraphNodeFactory,
      ],
    }).compile();

    adapter = module.get<LangGraphExecutionAdapter>(LangGraphExecutionAdapter);
    mockAgentExecutionService = module.get(AgentExecutionService);
    mockToolRegistry = module.get(ToolRegistryService);
  });

  it('should execute simple workflow with agent and tool', async () => {
    const agent = {
      id: 'test-agent',
      agentType: 'LANGGRAPH',
      responseFormat: {
        workflow: {
          nodes: [
            { id: 'agent-1', type: 'AGENT', agentId: 'test-agent-id' },
            { id: 'tool-1', type: 'TOOL', toolType: 'HTTP_REQUEST' }
          ],
          edges: [{ from: 'agent-1', to: 'tool-1' }]
        }
      }
    } as AgentEntity;

    mockAgentExecutionService.executeAgent.mockResolvedValue({
      result: { output: 'test result' },
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    });

    const result = await adapter.execute(agent, { data: 'test' }, 'test prompt');

    expect(result.result).toBeDefined();
    expect(mockAgentExecutionService.executeAgent).toHaveBeenCalled();
  });
});
```

### Интеграционные тесты

**Файл**: `packages/twenty-server/src/engine/core-modules/ai/langgraph/__tests__/langgraph-integration.spec.ts`

```typescript
describe('LangGraph Integration', () => {
  let module: TestingModule;
  let agentExecutionService: AgentExecutionService;
  let langGraphAdapter: LangGraphExecutionAdapter;

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
          entities: [AgentEntity],
          synchronize: true,
        }),
        AgentModule,
      ],
    }).compile();

    agentExecutionService = module.get<AgentExecutionService>(AgentExecutionService);
    langGraphAdapter = module.get<LangGraphExecutionAdapter>(LangGraphExecutionAdapter);
  });

  it('should execute LangGraph agent through AgentExecutionService', async () => {
    const agent = await createTestAgent({
      agentType: 'LANGGRAPH',
      responseFormat: {
        workflow: {
          nodes: [
            { id: 'agent-1', type: 'AGENT', agentId: 'test-agent-id' }
          ],
          edges: []
        }
      }
    });

    const result = await agentExecutionService.executeAgent({
      agent,
      context: { test: 'data' },
      schema: {},
      userPrompt: 'test prompt'
    });

    expect(result.result).toBeDefined();
  });
});
```

## Критерии готовности

### Фаза 1
- [ ] Добавлен `agentType` в `AgentEntity`
- [ ] Создан `LangGraphExecutionAdapter`
- [ ] Создан `LangGraphNodeFactory`
- [ ] Создан `WorkflowValidator`
- [ ] Интегрирован в `AgentExecutionService`
- [ ] Протестирован простой workflow с 2-3 нодами
- [ ] Работает фичефлаг
- [ ] Валидация и лимиты работают

### Фаза 2
- [ ] Условные переходы работают
- [ ] Checkpointer сохраняет состояние
- [ ] Human-in-the-loop поддерживается
- [ ] Биллинг по нодам работает
- [ ] Стриминг событий работает
- [ ] Параллелизм поддерживается

### Фаза 3
- [ ] Выделенный `LangGraphModule` создан
- [ ] Сущности для workflow созданы
- [ ] GraphQL резолверы работают
- [ ] UI для создания workflow создан
- [ ] Миграция данных выполнена

## Риски и митигация

### Риски
1. **Циклические зависимости** - используем forwardRef и интерфейсы
2. **Производительность** - добавляем таймауты и лимиты
3. **Безопасность** - валидация и whitelist для условий
4. **Совместимость** - фичефлаг и постепенное внедрение

### Митигация
1. **Тестирование** - comprehensive тесты на каждом этапе
2. **Мониторинг** - логирование и метрики
3. **Rollback план** - возможность отключить фичу
4. **Документация** - подробная документация для пользователей

## Заключение

Этот план обеспечивает:
- **Минимальные изменения** в существующую архитектуру
- **Обратную совместимость** со всеми существующими агентами
- **Постепенное внедрение** через фичефлаги
- **Масштабируемость** для будущих расширений
- **Безопасность** через валидацию и ограничения

Реализация начинается с Фазы 1, которая дает базовую функциональность LangGraph с минимальными рисками, а затем постепенно расширяется до полноценной мультиагентной системы.

---

**Дата**: $(date)
**Версия**: 3.0
**Статус**: Детальный план готов к реализации
