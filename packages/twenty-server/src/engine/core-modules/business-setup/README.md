# Business Setup Module

Модуль для управления процессом настройки бизнес-автоматизации в Twenty CRM с интегрированным AI агентом.

## Описание

Business Setup Module предоставляет инфраструктуру для пошаговой настройки бизнес-процессов с помощью AI агента. Модуль интегрируется с существующей системой onboarding и расширяет функциональность для автоматизации бизнес-процессов.

## Архитектура

### Компоненты

- **BusinessSetupService** - основной сервис для управления статусами Business Setup
- **BusinessSetupResolver** - GraphQL resolver для API endpoints
- **BusinessSetupWelcomeAgentService** - AI агент для автоматического создания welcome чатов
- **BusinessSetupChatContinuationService** - сервис для продолжения диалогов с AI
- **BusinessSetupTransitionService** - сервис для переходов между шагами
- **BusinessSetupChatResolver** - GraphQL resolver для chat операций
- **BusinessSetupModule** - NestJS модуль для интеграции
- **BusinessSetupStatus** - enum статусов для всех этапов настройки

### Статусы Business Setup

1. **WELCOME** - Приветственная страница AI агента
2. **BUSINESS_ANALYSIS** - Анализ бизнеса и процессов
3. **SALES_FUNNEL_DESIGN** - Дизайн воронки продаж
4. **AGENT_SETUP** - Настройка AI агентов
5. **WORKFLOW_CREATION** - Создание автоматизированных workflow
6. **TEAM_ASSIGNMENT** - Назначение ролей команде
7. **TESTING_OPTIMIZATION** - Тестирование и оптимизация
8. **COMPLETED** - Завершение настройки

## AI Agent Welcome Step

### Автоматическое создание чатов

Система автоматически создает AI чаты при завершении onboarding (статус COMPLETED):

1. **Event-driven архитектура** - использует EventEmitter2 для автоматизации
2. **Автоматическое создание** - чат создается без действий пользователя
3. **Персонализация** - AI учитывает данные пользователя и workspace
4. **Retry механизм** - надежное создание чатов с exponential backoff
5. **Валидация событий** - предотвращение runtime ошибок

### Компоненты AI Agent

#### BusinessSetupWelcomeAgentService

Основной сервис для автоматического создания welcome чатов:

```typescript
@Injectable()
export class BusinessSetupWelcomeAgentService {
  @OnEvent('onboarding.status.changed')
  private async handleOnboardingStatusChange(payload: OnboardingStatusChangedEvent) {
    if (payload.status === 'COMPLETED' && payload.previousStatus !== 'COMPLETED') {
      await this.createWelcomeChatWithRetry(payload.userId, payload.workspaceId);
    }
  }
}
```

#### Система продолжения чата

- **ChatContinuationService** - управление продолжающимися диалогами
- **TransitionService** - логика переходов между шагами
- **Event emission** - события для frontend интеграции

### События (Events)

```typescript
export const BUSINESS_SETUP_EVENTS = {
  // Onboarding события
  ONBOARDING_STATUS_CHANGED: 'onboarding.status.changed',
  
  // AI Agent события
  AI_AGENT_WELCOME_CHAT_CREATION_STARTED: 'ai-agent.welcome.chat-creation-started',
  AI_AGENT_WELCOME_CHAT_CREATED: 'ai-agent.welcome.chat-created',
  AI_AGENT_WELCOME_CHAT_CREATION_FAILED: 'ai-agent.welcome.chat-creation-failed',
  
  // Chat Continuation события
  AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED: 'ai-agent.welcome.user-message-received',
  AI_AGENT_WELCOME_AI_RESPONSE_GENERATED: 'ai-agent.welcome.ai-response-generated',
  BUSINESS_SETUP_READY_FOR_NEXT_STEP: 'business-setup.ready-for-next-step',
  BUSINESS_SETUP_STEP_TRANSITION: 'business-setup.step-transition',
};
```

## Frontend интеграция

### useWelcomeMessage Hook

Хук для подписки на события создания welcome чата:

```typescript
export const useWelcomeMessage = () => {
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Подписка на события
  useEffect(() => {
    const eventEmitter = getEventEmitter();
    eventEmitter.on('ai-agent.welcome.chat-created', handleWelcomeChatCreated);
    // ...
  }, []);

  return {
    welcomeMessage,
    showPopup,
    threadId,
    continueChat,
    // ...
  };
};
```

### FloatingAIChatButton Integration

Кнопка автоматически показывает welcome сообщения:

```typescript
export const FloatingAIChatButton = () => {
  const { welcomeMessage, showPopup, continueChat } = useWelcomeMessage();

  return (
    <>
      <StyledFloatingButton>
        <IconSparkles />
      </StyledFloatingButton>

      {showPopup && welcomeMessage && (
        <StyledWelcomePopup>
          <div dangerouslySetInnerHTML={{ __html: welcomeMessage }} />
          <button onClick={continueChat}>Continue Chat</button>
        </StyledWelcomePopup>
      )}
    </>
  );
};
```

## Использование

### Backend

```typescript
import { BusinessSetupWelcomeAgentService } from '@/engine/core-modules/business-setup/services/business-setup-welcome-agent.service';

@Injectable()
export class YourService {
  constructor(private readonly welcomeAgentService: BusinessSetupWelcomeAgentService) {}

  async triggerWelcomeChat(userId: string, workspaceId: string) {
    // Сервис автоматически обрабатывает события onboarding
  }
}
```

### Frontend

```typescript
import { useWelcomeMessage } from '@/modules/ai/hooks/useWelcomeMessage';

const YourComponent = () => {
  const { welcomeMessage, showPopup, continueChat } = useWelcomeMessage();

  if (showPopup && welcomeMessage) {
    return (
      <div>
        <p>{welcomeMessage}</p>
        <button onClick={continueChat}>Continue</button>
      </div>
    );
  }

  return null;
};
```

## Тестирование

### Backend тесты

```bash
# Запуск тестов для AI Agent
npx nx test twenty-server --testNamePattern="business-setup-welcome-agent"

# Запуск всех тестов Business Setup
npx nx test twenty-server --testNamePattern="business-setup"
```

### Frontend тесты

```bash
# Запуск тестов для AI хуков
npx nx test twenty-front --testNamePattern="useWelcomeMessage"

# Запуск всех тестов AI модуля
npx nx test twenty-front --testNamePattern="ai"
```

## Конфигурация

### EventEmitter2

EventEmitter2 уже настроен в CoreEngineModule:

```typescript
EventEmitterModule.forRoot({
  wildcard: true,
}),
```

### Интеграция с существующими сервисами

- **AgentChatService** - управление чатами
- **AgentExecutionService** - выполнение AI агентов
- **OnboardingService** - статусы onboarding
- **BusinessSetupService** - статусы Business Setup

## Мониторинг и логирование

### Логирование

Все операции логируются с помощью NestJS Logger:

```typescript
private readonly logger = new Logger(BusinessSetupWelcomeAgentService.name);

this.logger.log(`Welcome chat created successfully for user ${userId}`);
this.logger.error('Failed to create welcome chat:', error);
```

### Метрики

- **Chat Creation Time** - время создания чата
- **Success Rate** - процент успешных созданий
- **Error Rate** - процент ошибок
- **Retry Success Rate** - процент успешных retry

## Безопасность

### Валидация событий

Все события проходят строгую валидацию:

```typescript
private validateEventPayload(payload: any): payload is OnboardingStatusChangedEvent {
  return payload && 
         typeof payload.userId === 'string' && 
         typeof payload.workspaceId === 'string' &&
         typeof payload.status === 'string' &&
         typeof payload.previousStatus === 'string' &&
         payload.timestamp instanceof Date;
}
```

### Обработка ошибок

- **Graceful degradation** при сбоях AI сервисов
- **Retry механизм** с exponential backoff
- **Error boundaries** на frontend
- **Fallback ответы** при недоступности AI

## Развертывание

### Требования

- NestJS 9+
- EventEmitter2
- TypeORM
- GraphQL

### Переменные окружения

```bash
# AI настройки
AI_MODEL_PROVIDER=openai
AI_MODEL_API_KEY=your-api-key

# Event настройки
EVENT_EMITTER_WILDCARD=true
```

## Дальнейшее развитие

### Планируемые улучшения

1. **Расширение AI агентов** для других шагов Business Setup
2. **Machine Learning** для анализа готовности к переходам
3. **A/B тестирование** различных AI подходов
4. **Интеграция с внешними AI сервисами**
5. **Многоязычная поддержка** для AI агентов

### Архитектурные улучшения

1. **Event persistence** для восстановления после перезапусков
2. **Distributed locking** для race condition prevention
3. **Event batching** для оптимизации производительности
4. **Circuit breaker** для AI сервисов
5. **Metrics collection** для мониторинга

## Поддержка

Для вопросов и проблем с AI Agent функциональностью:

1. Проверьте логи сервера
2. Убедитесь, что EventEmitter2 настроен
3. Проверьте доступность AI сервисов
4. Проверьте права доступа пользователя

## Лицензия

AGPL-3.0
