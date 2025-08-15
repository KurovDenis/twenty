# Welcome Agent Architecture & Integration Guide

## 🎯 Обзор

Welcome Agent - это специализированный LangGraph агент, предназначенный для помощи новым пользователям в освоении Twenty CRM. Агент интегрирован в существующий UI через стратегию расширения, обеспечивая плавный пользовательский опыт.

## 🏗️ Архитектура

### **Core Components**

```
┌─────────────────────────────────────────────────────────────┐
│                    Welcome Agent System                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ useShouldShow   │  │ useSmartAgent   │  │ WelcomeAgent │ │
│  │ WelcomeAgent    │  │ Selection       │  │ Header       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  UI Integration Layer                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ FloatingAI      │  │ CommandMenu     │  │ AIChatTab    │ │
│  │ ChatButton      │  │ AskAIPage       │  │ (Enhanced)   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  GraphQL Layer                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ sendWelcome     │  │ createWelcome   │                  │
│  │ AgentMessage    │  │ AgentThread     │                  │
│  └─────────────────┘  └─────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│  Backend Layer (LangGraph)                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ WelcomeAgent    │  │ LangGraph       │  │ State        │ │
│  │ (LangGraph)     │  │ Execution       │  │ Management   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Компоненты и их взаимодействие

### **1. useShouldShowWelcomeAgent Hook**

**Назначение**: Умное определение, когда показывать Welcome Agent

**Логика работы**:
```typescript
const shouldShowWelcomeAgent = isAiEnabled && isNewUser && !hasActiveWelcomeSession;
```

**Критерии активации**:
- ✅ AI включен в workspace (feature flag)
- ✅ Пользователь новый (менее 24 часов с создания workspace)
- ✅ Нет активных сессий Welcome Agent

**Состояние сессии**:
```typescript
interface WelcomeAgentSession {
  hasActiveSession: boolean;
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  skipCount: number;
}
```

**Функции управления**:
- `startWelcomeAgentSession()` - начало сессии
- `endWelcomeAgentSession()` - завершение сессии

### **2. useSmartAgentSelection Hook**

**Назначение**: Умный выбор между Welcome Agent и стандартным AI

**Логика выбора**:
```typescript
const getOptimalAgentId = () => {
  if (shouldShowWelcomeAgent && welcomeAgent?.length) {
    return welcomeAgent[0].id; // Welcome Agent
  }
  return currentWorkspace?.defaultAgent?.id; // Стандартный AI
};
```

**Интеграция**:
- Использует `useFindManyAgentsQuery` для поиска Welcome Agent
- Интегрируется с `currentWorkspaceState`
- Возвращает `isWelcomeAgent` флаг для UI

### **3. WelcomeAgentHeader Component**

**Назначение**: Специальный заголовок для Welcome Agent

**Особенности**:
- Иконка Sparkles для визуального выделения
- Приветственное сообщение
- Кнопка "Пропустить" для перехода к обычному AI
- Стилизация под дизайн-систему Twenty

**Интеграция**:
```typescript
<WelcomeAgentHeader onSkip={handleSkipWelcomeAgent} />
```

### **4. Enhanced FloatingAIChatButton**

**Назначение**: Плавающая кнопка с индикатором Welcome Agent

**Новые возможности**:
- Анимированный бейдж "Новый!" для Welcome Agent
- Динамический tooltip
- Управление сессиями при клике

**Логика отображения**:
```typescript
{shouldShowWelcomeAgent && (
  <StyledWelcomeBadge>Новый!</StyledWelcomeBadge>
)}
```

### **5. Enhanced AIChatTab**

**Назначение**: Основной чат интерфейс с условной UI

**Расширения**:
- Условное отображение `WelcomeAgentHeader`
- Специальный placeholder для Welcome Agent
- Обработка кнопки "Пропустить"

**Интеграция**:
```typescript
<AIChatTab 
  agentId={agentId}
  showWelcomeAgentUI={isWelcomeAgent}
/>
```

### **6. Smart CommandMenuAskAIPage**

**Назначение**: Страница Command Menu с умным выбором агента

**Логика**:
```typescript
const { getOptimalAgentId, isWelcomeAgent } = useSmartAgentSelection();
const agentId = getOptimalAgentId();

<AIChatTab 
  agentId={agentId}
  showWelcomeAgentUI={isWelcomeAgent}
/>
```

## 🔄 Поток данных

### **Пользовательский поток**

#### **Для новых пользователей**:
```
1. Пользователь заходит в Twenty (менее 24 часов)
   ↓
2. FloatingAIChatButton показывает "Welcome Agent (Новый!)"
   ↓
3. Клик → startWelcomeAgentSession()
   ↓
4. CommandMenu открывается с Welcome Agent
   ↓
5. WelcomeAgentHeader отображается
   ↓
6. Пользователь общается с Welcome Agent
   ↓
7. Кнопка "Пропустить" → endWelcomeAgentSession()
   ↓
8. Переход к обычному AI
```

#### **Для существующих пользователей**:
```
1. Пользователь заходит в Twenty (более 24 часов)
   ↓
2. FloatingAIChatButton показывает "Ask AI (Press @)"
   ↓
3. Клик → обычный AI интерфейс
   ↓
4. Стандартный AIChatTab без Welcome Agent UI
```

### **Технический поток данных**

```
Frontend State Management:
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ currentWorkspace│    │ welcomeAgent    │    │ Feature Flags   │
│ State           │    │ Session State   │    │ (IS_AI_ENABLED) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ useShouldShow   │
                    │ WelcomeAgent    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ useSmartAgent   │
                    │ Selection       │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │ UI Components   │
                    │ (Conditional)   │
                    └─────────────────┘
```

## 🎨 UI/UX Strategy

### **Принципы дизайна**

1. **Консистентность**: Один интерфейс для всех агентов
2. **Простота**: Минимальные изменения существующего кода
3. **Плавность**: Бесшовный переход между агентами
4. **Адаптивность**: Работает на всех устройствах
5. **Производительность**: Переиспользование компонентов

### **Визуальные индикаторы**

- **Анимированный бейдж**: "Новый!" с пульсацией
- **Специальный tooltip**: "Welcome Agent (Новый!)"
- **Уникальный заголовок**: С иконкой Sparkles
- **Кастомный placeholder**: "Задайте вопрос о Twenty..."

## 🔌 GraphQL Integration

### **Мутации**

#### **sendWelcomeAgentMessage**
```graphql
mutation SendWelcomeAgentMessage($input: SendWelcomeAgentMessageInput!) {
  sendWelcomeAgentMessage(input: $input) {
    id
    threadId
    role
    content
    createdAt
    metadata
  }
}
```

#### **createWelcomeAgentThread**
```graphql
mutation CreateWelcomeAgentThread($input: CreateWelcomeAgentThreadInput!) {
  createWelcomeAgentThread(input: $input) {
    id
    agentId
    userWorkspaceId
    createdAt
    updatedAt
  }
}
```

### **Queries**

#### **findManyAgents (для поиска Welcome Agent)**
```graphql
query FindManyAgents($filter: AgentFilterInput) {
  agents(filter: $filter) {
    id
    name
    agentType
    langgraphConfig
  }
}
```

## 🧪 State Management

### **Recoil Atoms**

#### **welcomeAgentSessionState**
```typescript
export const welcomeAgentSessionState = atom<{
  hasActiveSession: boolean;
  sessionStartTime?: Date;
  sessionEndTime?: Date;
  skipCount: number;
}>({
  key: 'welcomeAgentSessionState',
  default: {
    hasActiveSession: false,
    skipCount: 0,
  },
});
```

### **Локальное состояние компонентов**

- `useShouldShowWelcomeAgent` - управление логикой отображения
- `useSmartAgentSelection` - выбор оптимального агента
- `useWelcomeAgent` - управление сессией Welcome Agent

## 🔒 Безопасность и производительность

### **Безопасность**
- Feature flags для контроля доступа
- Валидация входных данных
- Безопасные GraphQL мутации
- Защита от XSS в сообщениях

### **Производительность**
- Кэширование GraphQL запросов
- Ленивая загрузка компонентов
- Оптимизированные re-renders
- Мемоизация хуков

## 🚀 Backend Integration

### **LangGraph Agent**

Welcome Agent реализован как LangGraph агент с:
- Специализированными инструментами
- Состоянием сессии
- Системным промптом для Twenty CRM
- Интеграцией с метриками и трейсингом

### **Сервисы**

- `LangGraphExecutionService` - выполнение агента
- `LangGraphStateService` - управление состоянием
- `LangGraphEncryptionService` - шифрование данных
- `LangGraphTracingService` - трейсинг и мониторинг

## 📊 Мониторинг и аналитика

### **Метрики**
- Количество активаций Welcome Agent
- Время сессии
- Количество пропусков
- Успешность переходов к обычному AI

### **Трейсинг**
- OpenTelemetry интеграция
- Отслеживание производительности
- Логирование ошибок

## 🔄 Жизненный цикл

### **Инициализация**
1. Проверка feature flags
2. Определение нового пользователя
3. Инициализация Recoil состояния

### **Активация**
1. Клик на FloatingAIChatButton
2. Создание сессии Welcome Agent
3. Открытие Command Menu
4. Отображение WelcomeAgentHeader

### **Взаимодействие**
1. Общение через AIChatTab
2. Отправка сообщений через GraphQL
3. Обработка ответов от LangGraph агента

### **Завершение**
1. Кнопка "Пропустить" или естественное завершение
2. Завершение сессии
3. Переход к обычному AI
4. Обновление состояния

## 🛠️ Разработка и тестирование

### **Команды для разработки**
```bash
# Запуск frontend
yarn nx serve twenty-front

# Запуск backend
yarn nx serve twenty-server

# Тестирование
yarn nx test twenty-front
yarn nx test twenty-server
```

### **Тестирование компонентов**
- Unit тесты для хуков
- Integration тесты для UI
- E2E тесты для пользовательских сценариев

## 📈 Будущие улучшения

### **Планируемые функции**
- Аналитика использования Welcome Agent
- Персонализация на основе поведения
- Интеграция с другими LangGraph агентами
- Многоязычная поддержка

### **Оптимизации**
- Улучшение производительности
- Расширение метрик
- Улучшение UX на мобильных устройствах

## 📚 Заключение

Welcome Agent представляет собой элегантное решение для онбординга новых пользователей Twenty CRM. Архитектура обеспечивает:

- **Масштабируемость**: Легко добавлять новые агенты
- **Поддерживаемость**: Четкое разделение ответственности
- **Производительность**: Оптимизированная работа
- **UX**: Плавный и интуитивный интерфейс

Интеграция с существующей архитектурой Twenty обеспечивает стабильность и совместимость, а модульная структура позволяет легко расширять функциональность в будущем.
