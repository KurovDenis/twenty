# SGR Avito Agent Integration

Документация по интеграции SGR (Schema-Guided Reasoning) Avito агента с плавающей кнопкой AI чата для автоматизации настройки бизнеса.

## Описание

SGR Avito Agent Integration обеспечивает специализированное создание AI агентов для настройки интеграции с Avito при клике на плавающую кнопку AI чата во время этапа `WELCOME` бизнес-настройки.

## Архитектура

### Компоненты Frontend

- **useBusinessSetupAgentChat** - хук для создания специализированных агентов
- **useCreateNewAIChatThread** - расширенный хук с поддержкой businessSetupStep
- **AIChatTab** - компонент с поддержкой SGR streaming
- **FloatingAIChatButton** - интеграция с бизнес-настройкой

### Поток выполнения

1. **Пользователь на этапе WELCOME** → клик на FloatingAIChatButton
2. **useBusinessSetupAgentChat** → определяет текущий статус бизнес-настройки
3. **useCreateNewAIChatThread** → создает специализированный агент с businessSetupStep
4. **Backend** → создает SGR Avito агента вместо стандартного
5. **AIChatTab** → отображает SGR streaming с визуализацией прогресса

## Использование

### Автоматическая интеграция

Интеграция происходит автоматически при соблюдении условий:

```typescript
// Условия активации SGR Avito агента:
// 1. Пользователь находится в процессе бизнес-настройки
// 2. Текущий статус: 'WELCOME'
// 3. Клик на FloatingAIChatButton

const businessSetupStatus = useBusinessSetupStatus(); // 'WELCOME'
// → Автоматически создается SGR Avito агент
```

### Ручное создание агента

```typescript
import { useBusinessSetupAgentChat } from '@/business-setup/hooks/useBusinessSetupAgentChat';

const Component = () => {
  const { createBusinessSetupChat } = useBusinessSetupAgentChat();

  const handleCreateAvitoAgent = async () => {
    try {
      // Создает специализированный SGR агент для Avito интеграции
      await createBusinessSetupChat();
    } catch (error) {
      // Fallback на стандартный AI чат
      console.error('Failed to create Avito agent:', error);
    }
  };

  return <button onClick={handleCreateAvitoAgent}>Setup Avito</button>;
};
```

## Хуки

### useBusinessSetupAgentChat

Основной хук для создания специализированных агентов в контексте бизнес-настройки.

```typescript
export const useBusinessSetupAgentChat = () => {
  const businessSetupStatus = useBusinessSetupStatus();
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  
  const { createAgentChatThread } = useCreateNewAIChatThread({ 
    agentId: defaultAgentId,
    businessSetupStep: businessSetupStatus 
  });

  const createBusinessSetupChat = async () => {
    // Создает специализированный agent thread с SGR поддержкой
    await createAgentChatThread();
  };

  return { createBusinessSetupChat, getWelcomeMessageForStep };
};
```

**Возвращает:**
- `createBusinessSetupChat: () => Promise<void>` - создание специализированного агента
- `getWelcomeMessageForStep: (step: BusinessSetupStatus) => string` - получение приветственного сообщения

### useCreateNewAIChatThread (расширенный)

Расширенная версия с поддержкой businessSetupStep для создания специализированных агентов.

```typescript
export const useCreateNewAIChatThread = ({ 
  agentId,
  businessSetupStep 
}: { 
  agentId: string;
  businessSetupStep?: BusinessSetupStatus;
}) => {
  // Логика передачи businessSetupStep в GraphQL mutation
  const mutationVariables = {
    input: {
      agentId,
      ...(effectiveBusinessSetupStep && effectiveBusinessSetupStep !== 'COMPLETED' && {
        businessSetupStep: effectiveBusinessSetupStep,
      }),
    },
  };

  return { createAgentChatThread };
};
```

**Параметры:**
- `agentId: string` - ID агента (обязательный)
- `businessSetupStep?: BusinessSetupStatus` - этап бизнес-настройки (опциональный)

## SGR Streaming

### Визуализация прогресса

AIChatTab автоматически отображает прогресс SGR выполнения:

```typescript
// Автоматическое отображение SGR статусов
const statusEmoji = {
  'starting': '🚀',
  'in_progress': '⚙️', 
  'completed': '✅',
  'failed': '❌'
}[latestEvent.status] || '🔧';

setCurrentSGRStep(`${statusEmoji} ${latestEvent.toolName}: ${latestEvent.status}`);
```

### События SGR

SGR агент генерирует события в реальном времени:

```typescript
interface SGREvent {
  type: 'sgr_tool_execution';
  toolName: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed';
  data?: any;
  timestamp: string;
}
```

## Приветственные сообщения

### Для этапа WELCOME (Avito)

```typescript
const getWelcomeMessageForStep = (step: BusinessSetupStatus): string => {
  switch (step) {
    case 'WELCOME':
      return `🎯 **Настройка интеграции с Avito**
      
Я помогу вам настроить автоматизацию для Avito! Для начала мне понадобятся:

📋 **Необходимые данные:**
• CLIENT_ID от Avito API
• CLIENT_SECRET от Avito API  
• Категории товаров для автоматизации
• Настройки цен и описаний

🚀 **Что я настрою:**
• Автоматическую загрузку товаров
• Синхронизацию цен и остатков
• Управление объявлениями
• Аналитику продаж

Готовы начать? Поделитесь вашими API данными!`;

    case 'BUSINESS_ANALYSIS':
      return `📊 **Анализ бизнес-процессов**
      
Давайте проанализируем ваш бизнес для оптимальной настройки автоматизации...`;

    default:
      return getWelcomeMessageForStep('WELCOME');
  }
};
```

## Настройка Backend

### GraphQL Mutation

Backend автоматически определяет тип агента по businessSetupStep:

```typescript
// В createAgentChatThread mutation
if (input.businessSetupStep === 'WELCOME') {
  // Создать SGR Avito агента
  agent = await this.createSGRAvitoAgent(input);
} else {
  // Создать стандартного агента
  agent = await this.createStandardAgent(input);
}
```

### SGR Agent Configuration

```typescript
interface SGRAvitoAgentConfig {
  type: 'sgr_avito';
  capabilities: [
    'avito_api_integration',
    'product_management', 
    'price_optimization',
    'inventory_sync'
  ];
  sgrSettings: {
    reasoning_depth: 'deep';
    context_preservation: true;
    tool_chaining: true;
  };
}
```

## Тестирование

### Unit Tests

```bash
# Тесты для business setup хуков
npx nx test twenty-front --testNamePattern="useBusinessSetupAgentChat"

# Тесты для расширенного создания threads
npx nx test twenty-front --testNamePattern="useCreateNewAIChatThread"
```

### Тестовые сценарии

1. **Успешное создание SGR агента**
2. **Fallback на стандартный агент при ошибке**
3. **Корректная передача businessSetupStep**
4. **SGR streaming визуализация**
5. **Обработка различных businessSetupStatus**

## Troubleshooting

### Проблемы с созданием агента

```typescript
// Проверка в консоли браузера:
console.log('Business setup status:', businessSetupStatus);
console.log('Default agent ID:', defaultAgentId);

// Ожидаемые значения:
// businessSetupStatus: 'WELCOME'
// defaultAgentId: workspace?.defaultAgent?.id
```

### SGR события не отображаются

1. Проверьте WebSocket соединение
2. Убедитесь, что agent thread создан успешно
3. Проверьте, что SGR агент активирован в backend

### Fallback на стандартный агент

Если создание SGR агента не удается, система автоматически переключается на стандартный AI чат:

```typescript
try {
  await createAgentChatThread();
} catch (error) {
  console.error('Failed to create business setup chat thread:', error);
  // Автоматический fallback
  openAskAIPage();
}
```

## Мониторинг

### Метрики

- Частота создания SGR агентов
- Время отклика SGR операций  
- Процент успешных fallback
- Пользовательское взаимодействие с SGR streaming

### Логирование

```typescript
// Frontend логи
console.log('Creating business setup chat with SGR agent for step:', currentStep);
console.log('Business setup chat thread created successfully');

// Backend логи  
logger.info('SGR Avito agent created for business setup');
logger.error('SGR agent creation failed, using fallback');
```

## Безопасность

### Валидация данных

- Проверка businessSetupStep перед созданием агента
- Валидация agent ID и workspace permissions
- Ограничение доступа к SGR функциям по ролям

### Обработка ошибок

- Graceful degradation при недоступности SGR
- Автоматический fallback на стандартные агенты
- Защита от race conditions при создании threads

## Дальнейшее развитие

### Планируемые улучшения

1. **Дополнительные SGR агенты** для других этапов бизнес-настройки
2. **Персонализация SGR** на основе типа бизнеса
3. **Интеграция с другими платформами** (Wildberries, Ozon)
4. **Расширенная аналитика** SGR операций
5. **Machine Learning** для оптимизации SGR reasoning

### Архитектурные улучшения

1. **Кэширование SGR результатов**
2. **Распределенная обработка** SGR задач
3. **Real-time collaboration** в SGR агентах
4. **Advanced streaming** с chunk processing
5. **Error recovery mechanisms** для SGR операций

## Связанные компоненты

- [`FloatingAIChatButton`](../ai/components/FloatingAIChatButton/README.md) - плавающая кнопка AI чата
- [`BusinessSetupModule`](../../../twenty-server/src/engine/core-modules/business-setup/README.md) - backend модуль бизнес-настройки
- [`AIChatTab`](../ai/components/AIChatTab.tsx) - компонент AI чата с SGR поддержкой

## Лицензия

AGPL-3.0