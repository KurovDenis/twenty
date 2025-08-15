# Welcome Agent - Диаграммы и схемы

## 🏗️ Архитектурная диаграмма

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[FloatingAIChatButton] --> B[useShouldShowWelcomeAgent]
        B --> C[useSmartAgentSelection]
        C --> D[CommandMenuAskAIPage]
        D --> E[AIChatTab]
        E --> F[WelcomeAgentHeader]
    end
    
    subgraph "State Management"
        G[welcomeAgentSessionState] --> B
        H[currentWorkspaceState] --> B
        I[Feature Flags] --> B
    end
    
    subgraph "GraphQL Layer"
        J[sendWelcomeAgentMessage] --> K[Backend]
        L[createWelcomeAgentThread] --> K
        M[findManyAgents] --> K
    end
    
    subgraph "Backend Layer"
        K --> N[LangGraphExecutionService]
        N --> O[WelcomeAgent]
        O --> P[State Management]
        P --> Q[Database]
    end
    
    A --> J
    E --> J
    C --> M
```

## 🔄 Поток пользователя

```mermaid
sequenceDiagram
    participant U as User
    participant F as FloatingButton
    participant H as Hook
    participant C as CommandMenu
    participant A as AIChatTab
    participant G as GraphQL
    participant B as Backend
    
    Note over U: Новый пользователь (< 24ч)
    U->>F: Клик на кнопку
    F->>H: startWelcomeAgentSession()
    H->>C: Открыть с Welcome Agent
    C->>A: Показать с showWelcomeAgentUI=true
    A->>G: createWelcomeAgentThread()
    G->>B: Создать thread
    B-->>G: Thread ID
    G-->>A: Thread создан
    
    Note over U: Общение с Welcome Agent
    U->>A: Отправить сообщение
    A->>G: sendWelcomeAgentMessage()
    G->>B: Обработать через LangGraph
    B-->>G: Ответ агента
    G-->>A: Отобразить ответ
    
    Note over U: Завершение сессии
    U->>A: Нажать "Пропустить"
    A->>H: endWelcomeAgentSession()
    H->>C: Переключить на обычный AI
    C->>A: Показать стандартный интерфейс
```

## 🧩 Компонентная схема

```mermaid
graph LR
    subgraph "Core Hooks"
        A[useShouldShowWelcomeAgent]
        B[useSmartAgentSelection]
        C[useWelcomeAgent]
    end
    
    subgraph "UI Components"
        D[FloatingAIChatButton]
        E[WelcomeAgentHeader]
        F[AIChatTab]
        G[CommandMenuAskAIPage]
    end
    
    subgraph "State"
        H[welcomeAgentSessionState]
        I[currentWorkspaceState]
        J[Feature Flags]
    end
    
    subgraph "GraphQL"
        K[sendWelcomeAgentMessage]
        L[createWelcomeAgentThread]
        M[findManyAgents]
    end
    
    A --> D
    A --> B
    B --> G
    G --> F
    F --> E
    C --> K
    C --> L
    B --> M
    
    H --> A
    I --> A
    J --> A
```

## 📊 Состояния и переходы

```mermaid
stateDiagram-v2
    [*] --> CheckingUser
    CheckingUser --> NewUser: < 24 hours
    CheckingUser --> ExistingUser: >= 24 hours
    
    NewUser --> WelcomeAgentAvailable: AI enabled
    NewUser --> StandardAI: AI disabled
    
    WelcomeAgentAvailable --> WelcomeAgentActive: User clicks button
    WelcomeAgentActive --> WelcomeAgentChat: Session started
    WelcomeAgentChat --> StandardAI: User skips
    WelcomeAgentChat --> WelcomeAgentComplete: Natural completion
    WelcomeAgentComplete --> StandardAI: Session ended
    
    ExistingUser --> StandardAI: Direct access
    
    StandardAI --> [*]
```

## 🔧 Логика принятия решений

```mermaid
flowchart TD
    A[Пользователь заходит] --> B{AI включен?}
    B -->|Нет| C[Стандартный интерфейс]
    B -->|Да| D{Пользователь новый?}
    D -->|Нет| C
    D -->|Да| E{Есть активная сессия?}
    E -->|Да| C
    E -->|Нет| F[Показать Welcome Agent]
    
    F --> G[FloatingAIChatButton с бейджем]
    G --> H[Клик пользователя]
    H --> I[Создать сессию]
    I --> J[Открыть Command Menu]
    J --> K[Показать WelcomeAgentHeader]
    K --> L[Общение с агентом]
    L --> M{Пользователь пропускает?}
    M -->|Да| N[Завершить сессию]
    M -->|Нет| L
    N --> C
```

## 🎨 UI/UX Flow

```mermaid
graph TD
    subgraph "Визуальные состояния"
        A[Обычная кнопка<br/>"Ask AI (Press @)"] --> B[Кнопка с бейджем<br/>"Welcome Agent (Новый!)"]
        B --> C[Command Menu<br/>С Welcome Agent]
        C --> D[Стандартный чат<br/>"Enter a question..."]
    end
    
    subgraph "Welcome Agent UI"
        E[WelcomeAgentHeader<br/>"Добро пожаловать в Twenty!"] --> F[Специальный placeholder<br/>"Задайте вопрос о Twenty..."]
        F --> G[Кнопка "Пропустить"]
    end
    
    A --> B
    B --> C
    C --> E
    E --> F
    G --> D
```

## 🔌 GraphQL Schema

```mermaid
graph TB
    subgraph "Mutations"
        A[sendWelcomeAgentMessage]
        B[createWelcomeAgentThread]
    end
    
    subgraph "Queries"
        C[findManyAgents]
    end
    
    subgraph "Types"
        D[SendWelcomeAgentMessageInput]
        E[CreateWelcomeAgentThreadInput]
        F[AgentFilterInput]
        G[AgentMessage]
        H[AgentChatThread]
    end
    
    A --> D
    B --> E
    C --> F
    A --> G
    B --> H
```

## 🧪 Тестирование

```mermaid
graph LR
    subgraph "Unit Tests"
        A[useShouldShowWelcomeAgent.test]
        B[useSmartAgentSelection.test]
        C[WelcomeAgentHeader.test]
    end
    
    subgraph "Integration Tests"
        D[FloatingAIChatButton.test]
        E[AIChatTab.test]
        F[CommandMenuAskAIPage.test]
    end
    
    subgraph "E2E Tests"
        G[New user flow]
        H[Existing user flow]
        I[Skip functionality]
    end
    
    A --> D
    B --> E
    C --> F
    D --> G
    E --> H
    F --> I
```

## 📈 Метрики и мониторинг

```mermaid
graph TB
    subgraph "Frontend Metrics"
        A[Welcome Agent показан]
        B[Клик на кнопку]
        C[Сессия начата]
        D[Сессия завершена]
        E[Пропуск]
    end
    
    subgraph "Backend Metrics"
        F[Thread создан]
        G[Сообщение отправлено]
        H[Ошибки выполнения]
        I[Время ответа]
    end
    
    subgraph "Business Metrics"
        J[Конверсия новых пользователей]
        K[Время в сессии]
        L[Успешность онбординга]
    end
    
    A --> F
    B --> G
    C --> H
    D --> I
    E --> J
    F --> K
    G --> L
```

## 🔄 Жизненный цикл компонента

```mermaid
graph TD
    A[Компонент монтируется] --> B[useShouldShowWelcomeAgent]
    B --> C{Показать Welcome Agent?}
    C -->|Да| D[useSmartAgentSelection]
    C -->|Нет| E[Стандартный AI]
    
    D --> F[Найти Welcome Agent]
    F --> G{Агент найден?}
    G -->|Да| H[Показать UI с бейджем]
    G -->|Нет| E
    
    H --> I[Пользователь кликает]
    I --> J[Создать сессию]
    J --> K[Открыть Command Menu]
    K --> L[Показать WelcomeAgentHeader]
    
    L --> M[Общение]
    M --> N{Пропустить?}
    N -->|Да| O[Завершить сессию]
    N -->|Нет| M
    O --> E
```

## 🛡️ Безопасность

```mermaid
graph TB
    subgraph "Frontend Security"
        A[Feature Flags]
        B[Input Validation]
        C[XSS Protection]
    end
    
    subgraph "Backend Security"
        D[Authentication]
        E[Authorization]
        F[Rate Limiting]
        G[Data Encryption]
    end
    
    subgraph "Data Security"
        H[PII Detection]
        I[Secure Storage]
        J[Audit Logs]
    end
    
    A --> D
    B --> E
    C --> F
    D --> G
    E --> H
    F --> I
    G --> J
```

## 🚀 Производительность

```mermaid
graph LR
    subgraph "Frontend Optimization"
        A[React.memo]
        B[useMemo]
        C[useCallback]
        D[Lazy Loading]
    end
    
    subgraph "GraphQL Optimization"
        E[Query Caching]
        F[Fragment Optimization]
        G[Pagination]
    end
    
    subgraph "Backend Optimization"
        H[Database Indexing]
        I[Connection Pooling]
        J[Response Caching]
    end
    
    A --> E
    B --> F
    C --> G
    D --> H
    E --> I
    F --> J
```

Эти диаграммы предоставляют полное визуальное представление архитектуры Welcome Agent и помогают понять взаимодействие между компонентами на всех уровнях системы.
