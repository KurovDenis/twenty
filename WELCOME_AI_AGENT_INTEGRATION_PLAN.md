# 🎯 Welcome AI Agent Integration Plan

## 📋 Обзор

Этот документ содержит детальный план интеграции **Welcome AI агента** с системой чатов Twenty, чтобы пользователь на стадии **WELCOME** общался **ТОЛЬКО** с Welcome AI агентом, а не с универсальным Default AI агентом.

## 🏗️ Текущая архитектура

### Что у нас есть:
1. **BusinessSetupWelcomeAgentService** - создает Welcome AI агента автоматически
2. **AgentChatService** - управляет чатами и threads
3. **useCreateNewAIChatThread** - создает новые чаты
4. **CommandMenuAskAIPage** - определяет какой агент использовать
5. **currentWorkspace.defaultAgent** - основной агент workspace

### Проблема:
- Welcome AI агент создается, но не интегрируется с системой чатов
- При создании нового чата всегда используется `defaultAgent`
- Нет связи между статусом Business Setup и выбором агента

## 🎯 Цель решения

Создать систему, где:
- На стадии **WELCOME** пользователь общается **ТОЛЬКО** с Welcome AI агентом
- На других стадиях используется соответствующий специализированный агент
- Система автоматически определяет правильного агента для каждого статуса

## 🏗️ Архитектурное решение

### Вариант 1: Модификация существующей системы (РЕКОМЕНДУЕМЫЙ)

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Setup Status                    │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   WELCOME   │  │ BUSINESS_ANALYSIS│  │ SALES_FUNNEL    │ │
│  └─────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Agent Selection Service                      │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Welcome Agent│  │Analysis Agent   │  │Funnel Agent     │ │
│  │(Gemini)     │  │(GPT-4)         │  │(GPT-4)         │ │
│  └─────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Agent Chat System                           │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │Welcome Chat │  │Analysis Chat    │  │Funnel Chat      │ │
│  │Thread       │  │Thread           │  │Thread           │ │
│  └─────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Детальный план реализации

### Этап 1: Backend - Создание Agent Selection Service

#### 1.1. Создать BusinessSetupAgentService

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/services/business-setup-agent.service.ts`

```typescript
@Injectable()
export class BusinessSetupAgentService {
  constructor(
    private readonly agentService: AgentService,
    private readonly businessSetupService: BusinessSetupService,
  ) {}

  async getAgentForStep(step: BusinessSetupStatus, workspaceId: string): Promise<AgentEntity> {
    const agentMapping = {
      [BusinessSetupStatus.WELCOME]: 'welcome-agent',
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 'business-analysis-agent',
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 'funnel-designer-agent',
      [BusinessSetupStatus.AGENT_SETUP]: 'agent-orchestrator-agent',
      [BusinessSetupStatus.WORKFLOW_CREATION]: 'workflow-generator-agent',
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: 'team-assignment-agent',
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: 'testing-optimization-agent',
    };

    const agentName = agentMapping[step];
    if (!agentName) {
      throw new Error(`No agent mapping for step: ${step}`);
    }

    // Ищем агента по имени в workspace
    const agent = await this.agentService.findOne({
      where: { name: agentName, workspaceId }
    });

    if (!agent) {
      // Если агент не найден, создаем его
      return await this.createAgentForStep(step, workspaceId);
    }

    return agent;
  }

  private async createAgentForStep(step: BusinessSetupStatus, workspaceId: string): Promise<AgentEntity> {
    const agentConfigs = {
      [BusinessSetupStatus.WELCOME]: {
        name: 'welcome-agent',
        label: 'Welcome AI Assistant',
        description: 'AI assistant for welcome step in business setup',
        prompt: `You are a Welcome AI assistant for Business Setup Wizard. Your role is to:

1. Greet users warmly and welcome them to the business setup process
2. Explain what Business Setup Wizard will accomplish
3. Guide users through the initial steps
4. Answer questions about the setup process
5. Motivate users to continue with business setup

Be friendly, encouraging, and explain what will happen next. Focus on building excitement and confidence.`,
        modelId: 'google/gemini-2.5-flash', // Принудительно Gemini для Welcome
        isCustom: true,
      },
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: {
        name: 'business-analysis-agent',
        label: 'Business Analysis AI',
        description: 'AI assistant for business analysis step',
        prompt: `You are a Business Analysis AI specialist. Your role is to:

1. Help users understand their business better
2. Ask relevant questions about industry, size, model
3. Provide industry insights and trends
4. Suggest optimization opportunities
5. Prepare users for funnel design

Focus on gathering actionable business intelligence.`,
        modelId: 'auto',
        isCustom: true,
      },
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: {
        name: 'funnel-designer-agent',
        label: 'Sales Funnel Designer AI',
        description: 'AI assistant for sales funnel design',
        prompt: `You are a Sales Funnel Design AI expert. Your role is to:

1. Explain funnel stages and conversion optimization
2. Help users understand their customer journey
3. Suggest funnel improvements based on business type
4. Explain KPIs and measurement strategies
5. Prepare users for agent setup

Focus on conversion optimization and customer experience.`,
        modelId: 'auto',
        isCustom: true,
      },
      // ... конфигурации для других шагов
    };

    const config = agentConfigs[step];
    if (!config) {
      throw new Error(`No configuration for step: ${step}`);
    }

    return await this.agentService.createOneAgent({
      ...config,
      workspaceId,
    });
  }
}
```

#### 1.2. Модифицировать AgentChatService

**Файл:** `packages/twenty-server/src/engine/metadata-modules/agent/agent-chat.service.ts`

```typescript
@Injectable()
export class AgentChatService {
  constructor(
    @InjectRepository(AgentChatThreadEntity, 'core')
    private readonly threadRepository: Repository<AgentChatThreadEntity>,
    @InjectRepository(AgentChatMessageEntity, 'core')
    private readonly messageRepository: Repository<AgentChatMessageEntity>,
    @InjectRepository(FileEntity, 'core')
    private readonly fileRepository: Repository<FileEntity>,
    private readonly titleGenerationService: AgentTitleGenerationService,
    private readonly businessSetupAgentService: BusinessSetupAgentService, // Добавляем
  ) {}

  // Новый метод для создания чатов с контекстом Business Setup
  async createThreadWithBusinessSetupContext(
    agentId: string, 
    userWorkspaceId: string,
    businessSetupStep?: BusinessSetupStatus
  ) {
    let effectiveAgentId = agentId;

    // Если указан статус Business Setup, используем соответствующий агент
    if (businessSetupStep) {
      try {
        const businessSetupAgent = await this.businessSetupAgentService.getAgentForStep(
          businessSetupStep, 
          userWorkspaceId
        );
        effectiveAgentId = businessSetupAgent.id;
      } catch (error) {
        // Логируем ошибку, но продолжаем с оригинальным agentId
        console.warn(`Failed to get business setup agent for step ${businessSetupStep}:`, error);
      }
    }

    const thread = this.threadRepository.create({
      agentId: effectiveAgentId,
      userWorkspaceId,
    });

    return this.threadRepository.save(thread);
  }

  // Оставляем существующий метод для обратной совместимости
  async createThread(agentId: string, userWorkspaceId: string) {
    const thread = this.threadRepository.create({
      agentId,
      userWorkspaceId,
    });

    return this.threadRepository.save(thread);
  }

  // ... остальные методы остаются без изменений
}
```

### Этап 2: Backend - Модификация GraphQL схемы

#### 2.1. Обновить CreateAgentChatThreadInput

**Файл:** `packages/twenty-server/src/engine/metadata-modules/agent/dtos/create-agent-chat-thread.input.ts`

```typescript
import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UUIDScalarType } from 'src/engine/api/graphql/workspace-schema-builder/graphql-types/scalars';

@InputType()
export class CreateAgentChatThreadInput {
  @Field(() => UUIDScalarType)
  @IsNotEmpty()
  agentId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  businessSetupStep?: string; // Добавляем опциональный параметр
}
```

#### 2.2. Обновить AgentChatResolver

**Файл:** `packages/twenty-server/src/engine/metadata-modules/agent/agent-chat.resolver.ts`

```typescript
@Resolver()
export class AgentChatResolver {
  constructor(private readonly agentChatService: AgentChatService) {}

  @Mutation(() => AgentChatThreadDTO)
  @RequireFeatureFlag(FeatureFlagKey.IS_AI_ENABLED)
  async createAgentChatThread(
    @Args('input') input: CreateAgentChatThreadInput,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ) {
    // Если указан businessSetupStep, используем специальную логику
    if (input.businessSetupStep) {
      return this.agentChatService.createThreadWithBusinessSetupContext(
        input.agentId,
        userWorkspaceId,
        input.businessSetupStep as BusinessSetupStatus
      );
    }

    // Иначе используем стандартную логику
    return this.agentChatService.createThread(input.agentId, userWorkspaceId);
  }

  // ... остальные методы остаются без изменений
}
```

### Этап 3: Frontend - Модификация хуков

#### 3.1. Обновить useCreateNewAIChatThread

**Файл:** `packages/twenty-front/src/modules/ai/hooks/useCreateNewAIChatThread.ts`

```typescript
import { currentAIChatThreadComponentState } from '@/ai/states/currentAIChatThreadComponentState';
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useRecoilComponentState } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentState';
import { useCreateAgentChatThreadMutation } from '~/generated-metadata/graphql';
import { useBusinessSetupStatus } from '@/business-setup/hooks/useBusinessSetupStatus';

export const useCreateNewAIChatThread = ({ agentId }: { agentId: string }) => {
  const [, setCurrentThreadId] = useRecoilComponentState(
    currentAIChatThreadComponentState,
    agentId,
  );

  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const businessSetupStatus = useBusinessSetupStatus();
  
  const [createAgentChatThread] = useCreateAgentChatThreadMutation({
    variables: { 
      input: { 
        agentId,
        businessSetupStep: businessSetupStatus === 'WELCOME' ? 'WELCOME' : undefined
      } 
    },
    onCompleted: (data) => {
      setCurrentThreadId(data.createAgentChatThread.id);
      openAskAIPage();
    },
  });

  return { createAgentChatThread };
};
```

#### 3.2. Создать useBusinessSetupAgentChat

**Файл:** `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupAgentChat.ts`

```typescript
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';

export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();

  const createBusinessSetupChat = () => {
    openAskAIPage({
      initialMessage: getWelcomeMessageForStep(businessSetupStatus),
      context: {
        businessSetupMode: true,
        step: businessSetupStatus,
        agentType: `BUSINESS_SETUP_${businessSetupStatus}`,
      },
    });
  };

  const getWelcomeMessageForStep = (step: BusinessSetupStatus): string => {
    const messages = {
      WELCOME: "🎉 Welcome to Business Setup! I'm here to guide you through creating your automated business system.",
      BUSINESS_ANALYSIS: "🚀 Let's analyze your business! I'll help you understand your processes and opportunities.",
      SALES_FUNNEL_DESIGN: "🎯 Time to design your sales funnel! I'll help you create the perfect conversion path.",
      AGENT_SETUP: "🤖 Let's set up your AI agents! I'll help you build your automated team.",
      WORKFLOW_CREATION: "⚡ Time to create workflows! I'll help you automate your processes.",
      TEAM_ASSIGNMENT: "👥 Let's assign your team! I'll help you organize roles and responsibilities.",
      TESTING_OPTIMIZATION: "🧪 Let's test and optimize! I'll help you ensure everything works perfectly.",
    };
    return messages[step] || messages.WELCOME;
  };

  return { createBusinessSetupChat, getWelcomeMessageForStep };
};
```

### Этап 4: Frontend - Модификация компонентов

#### 4.1. Обновить BusinessSetupWelcome

**Файл:** `packages/twenty-front/src/pages/business-setup/BusinessSetupWelcome.tsx`

```typescript
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';

export const BusinessSetupWelcome = () => {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { setNextBusinessSetupStatus } = useSetNextBusinessSetupStatus();
  const { createBusinessSetupChat } = useBusinessSetupAgentChat(); // Используем новый хук

  const handleStartWithAI = () => {
    createBusinessSetupChat(); // Использует специальный хук для Business Setup
  };

  const handleSkipWelcome = async () => {
    await setNextBusinessSetupStatus();
    navigate(AppPath.BusinessAnalysis);
  };

  // ... остальной код остается без изменений
};
```

#### 4.2. Обновить FloatingAIChatButton

**Файл:** `packages/twenty-front/src/modules/ai/hooks/useFloatingAIChatButton.ts`

```typescript
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';

export const useFloatingAIChatButton = () => {
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const isVisible = useRecoilValue(isFloatingAIChatButtonVisibleState);
  const isCommandMenuOpened = useRecoilValue(isCommandMenuOpenedState);
  const commandMenuPage = useRecoilValue(commandMenuPageState);
  const businessSetupStatus = useBusinessSetupStatus();
  
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const { createBusinessSetupChat } = useBusinessSetupAgentChat(); // Добавляем

  const isAIChatOpen =
    isCommandMenuOpened &&
    (commandMenuPage === CommandMenuPages.AskAI ||
      commandMenuPage === CommandMenuPages.ViewPreviousAIChats);

  const handleClick = () => {
    // Если мы в Business Setup режиме, используем специальный чат
    if (businessSetupStatus === 'WELCOME') {
      createBusinessSetupChat(); // Использует специальный хук
    } else {
      openAskAIPage(); // Стандартный AI чат
    }
  };

  return {
    isVisible: isVisible && isAiEnabled && !isAIChatOpen,
    handleClick,
    businessSetupStatus,
  };
};
```

## 🔄 Альтернативные варианты реализации

### Вариант 2: Полная замена системы агентов
- Создать новую систему выбора агентов
- Переписать логику создания чатов
- Более сложно, но более гибко

### Вариант 3: Middleware подход
- Создать middleware для перехвата создания чатов
- Автоматически определять правильного агента
- Меньше изменений в существующем коде

## 📋 План реализации по этапам

### Неделя 1: Backend инфраструктура
- [ ] Создать BusinessSetupAgentService
- [ ] Модифицировать AgentChatService
- [ ] Обновить GraphQL схему
- [ ] Протестировать backend логику

### Неделя 2: Frontend интеграция
- [ ] Создать useBusinessSetupAgentChat
- [ ] Модифицировать useCreateNewAIChatThread
- [ ] Обновить компоненты
- [ ] Протестировать UI

### Неделя 3: Тестирование и отладка
- [ ] Интеграционные тесты
- [ ] E2E тесты
- [ ] Исправление багов
- [ ] Документация

## ⚠️ Критические моменты и риски

### Риски:
1. **Нарушение существующей функциональности** - нужно тщательно тестировать
2. **Сложность интеграции** - много компонентов затронуто
3. **Производительность** - дополнительные запросы к базе данных

### Меры предосторожности:
1. **Поэтапная реализация** - не все сразу
2. **Feature flags** - возможность отключить новую функциональность
3. **Fallback логика** - если что-то сломается, использовать старую систему

## 🎯 Преимущества предложенного решения

1. **Минимальные изменения** в существующей архитектуре
2. **Обратная совместимость** - старые чаты продолжают работать
3. **Гибкость** - легко добавить новые статусы и агентов
4. **Производительность** - агенты создаются по требованию
5. **Тестируемость** - каждый компонент можно тестировать отдельно

## 📝 Следующие шаги

1. **Подтвердить план** - убедиться, что решение подходит
2. **Создать детальные спецификации** для каждого компонента
3. **Начать с Backend** - создать BusinessSetupAgentService
4. **Постепенно интегрировать** с существующей системой

## 🔍 Технические детали

### Модели AI агентов:
- **Welcome Agent**: Gemini 2.5 Flash (принудительно)
- **Business Analysis Agent**: Auto (автоматический выбор)
- **Funnel Designer Agent**: Auto (автоматический выбор)
- **Другие агенты**: Auto (автоматический выбор)

### База данных:
- Новые агенты создаются в таблице `agent`
- Связь через `agentId` в `agentChatThread`
- Поддержка soft delete для агентов

### GraphQL:
- Новое поле `businessSetupStep` в `CreateAgentChatThreadInput`
- Обратная совместимость с существующими запросами
- Валидация на уровне GraphQL schema

## 🧪 Тестирование

### Unit тесты:
- BusinessSetupAgentService
- Модифицированные методы AgentChatService
- GraphQL resolvers

### Integration тесты:
- Создание чатов с разными статусами
- Переключение между агентами
- Обработка ошибок

### E2E тесты:
- Полный flow Business Setup
- Создание новых чатов
- Переключение между шагами

## 📚 Документация

### Для разработчиков:
- API документация
- Примеры использования
- Troubleshooting guide

### Для пользователей:
- Как использовать Business Setup Wizard
- Различия между AI агентами
- FAQ по AI чату

---

**Автор:** AI Assistant  
**Дата создания:** 2024  
**Версия:** 1.0  
**Статус:** План
