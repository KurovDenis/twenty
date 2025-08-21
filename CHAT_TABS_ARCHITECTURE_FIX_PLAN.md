# План исправления архитектуры чатов CommandMenuTabs

## 🎯 ЦЕЛЬ
Исправить архитектурные проблемы в системе чатов, чтобы:
- ✅ Переключение между вкладками работало корректно
- ✅ НЕ создавались новые чаты при клике на существующие вкладки
- ✅ Единое состояние для всех чатов
- ✅ Правильная синхронизация с OpenRouter

## 🔍 ДИАГНОСТИКА ПРОБЛЕМ

### Текущие архитектурные проблемы:

#### 1. **Дублирование состояний**
```typescript
// ❌ ПРОБЛЕМА: Два разных состояния для одного и того же
const [tabs, setTabs] = useState<Array<{...}>>(); // Локальное состояние
const { data: { agentChatThreads = [] } } = useGetAgentChatThreadsQuery(); // Серверное состояние
```

#### 2. **Отсутствие централизованного управления**
```typescript
// ❌ ПРОБЛЕМА: Разные хуки управляют разными частями
const { switchToExistingThread } = useAIChats(); // Локальные чаты
const { createAgentChatThread } = useCreateNewAIChatThread(); // OpenRouter
```

#### 3. **Неправильная логика переключения**
```typescript
// ❌ ПРОБЛЕМА: При клике на вкладку всегда создается новый чат
const handleTabClick = useCallback((tab) => {
  if (tab.isBusinessSetup) {
    openBusinessSetupChat(); // ❌ Создает новый чат!
  } else if (tab.threadId) {
    switchToExistingThread(tab.threadId); // ❌ Не синхронизировано
  }
}, []);
```

## 📋 ПЛАН ДЕЙСТВИЙ

### ЭТАП 1: Анализ текущего состояния ✅ (ВЫПОЛНЕНО)
- [x] Проанализировали текущий код CommandMenuTabs
- [x] Выявили архитектурные проблемы
- [x] Определили корень проблемы с созданием новых чатов

### ЭТАП 2: Рефакторинг архитектуры состояний

#### 2.1 Исправить useAIChats хук
**Файл**: `packages/twenty-front/src/modules/ai/hooks/useAIChats.ts`

**Что исправить**:
```typescript
// ❌ ТЕКУЩЕЕ: Неполная реализация
export const useAIChats = () => {
  // ... неполный код
  return {
    // ... неполные методы
  };
};

// ✅ ИСПРАВЛЕННОЕ: Полная реализация
export const useAIChats = () => {
  const [chats, setChats] = useRecoilState(aiChatsState);
  const [currentChatId, setCurrentChatId] = useRecoilState(currentChatIdState);
  
  // ✅ Получить все чаты
  const getAllChats = useCallback(() => {
    return Object.values(chats);
  }, [chats]);
  
  // ✅ Переключиться на чат
  const switchToChat = useCallback((chatId: string) => {
    if (chats[chatId]) {
      setCurrentChatId(chatId);
      // ✅ Обновляем активность вкладки
      setChats(prev => Object.keys(prev).reduce((acc, id) => ({
        ...acc,
        [id]: { ...prev[id], isActive: id === chatId }
      }), {}));
      return true;
    }
    return false;
  }, [chats, setChats, setCurrentChatId]);
  
  // ✅ Создать новый чат
  const createNewChat = useCallback((title: string, context: 'general' | 'business-setup' = 'general') => {
    const newChat = context === 'business-setup' 
      ? createAIChat.businessSetup(title)
      : createAIChat.general(title);
    
    setChats(prev => ({
      ...prev,
      [newChat.id]: newChat
    }));
    
    setCurrentChatId(newChat.id);
    return newChat;
  }, [setChats, setCurrentChatId]);
  
  return {
    chats,
    currentChatId,
    getAllChats,
    switchToChat,
    createNewChat,
  };
};
```

#### 2.2 Исправить aiChatState
**Файл**: `packages/twenty-front/src/modules/ai/states/aiChatState.ts`

**Что исправить**:
```typescript
// ✅ ДОБАВИТЬ: Функции для управления состоянием
export const aiChatActions = {
  // ✅ Создать чат
  createChat: (chat: AIChat) => (prev: Record<string, AIChat>) => ({
    ...prev,
    [chat.id]: chat
  }),
  
  // ✅ Обновить чат
  updateChat: (chatId: string, updates: Partial<AIChat>) => (prev: Record<string, AIChat>) => ({
    ...prev,
    [chatId]: { ...prev[chatId], ...updates }
  }),
  
  // ✅ Удалить чат
  removeChat: (chatId: string) => (prev: Record<string, AIChat>) => {
    const { [chatId]: removed, ...rest } = prev;
    return rest;
  },
  
  // ✅ Переключить активность
  setActiveChat: (chatId: string) => (prev: Record<string, AIChat>) => 
    Object.keys(prev).reduce((acc, id) => ({
      ...acc,
      [id]: { ...prev[id], isActive: id === chatId }
    }), {}),
};
```

### ЭТАП 3: Рефакторинг CommandMenuTabs

#### 3.1 Убрать дублирование состояний
**Файл**: `packages/twenty-front/src/modules/command-menu/components/CommandMenuTabs.tsx`

**Что исправить**:
```typescript
// ❌ УБРАТЬ: Локальное состояние tabs
const [tabs, setTabs] = useState<Array<{...}>>();

// ✅ ЗАМЕНИТЬ: Использовать единое состояние из useAIChats
const { chats, currentChatId, switchToChat, createNewChat } = useAIChats();

// ✅ ВЫЧИСЛЯТЬ: Вкладки из состояния чатов
const tabs = useMemo(() => {
  const chatTabs = Object.values(chats).map(chat => ({
    id: chat.id,
    title: chat.title,
    isActive: chat.isActive,
    isBusinessSetup: chat.isBusinessSetup,
    threadId: chat.graphqlThreadId,
  }));
  
  // ✅ Сортируем: Business Setup всегда первый
  return chatTabs.sort((a, b) => {
    if (a.isBusinessSetup) return -1;
    if (b.isBusinessSetup) return 1;
    return 0;
  });
}, [chats]);
```

#### 3.2 Исправить логику переключения
**Что исправить**:
```typescript
// ❌ ТЕКУЩЕЕ: Неправильная логика
const handleTabClick = useCallback((tab) => {
  if (tab.isBusinessSetup) {
    openBusinessSetupChat(); // ❌ Создает новый чат!
  } else if (tab.threadId) {
    switchToExistingThread(tab.threadId); // ❌ Не синхронизировано
  }
}, []);

// ✅ ИСПРАВЛЕННОЕ: Правильная логика
const handleTabClick = useCallback((chatId: string) => {
  console.log('🔧 Переключаемся на чат:', chatId);
  
  // ✅ Переключаемся на существующий чат
  if (switchToChat(chatId)) {
    // ✅ Открываем AI страницу
    openAskAIPage();
  } else {
    console.error('❌ Не удалось переключиться на чат:', chatId);
  }
}, [switchToChat, openAskAIPage]);
```

#### 3.3 Исправить создание нового чата
**Что исправить**:
```typescript
// ❌ ТЕКУЩЕЕ: Создание через OpenRouter
const handleAddNewChat = useCallback(() => {
  if (agentId && createAgentChatThread) {
    createAgentChatThread(); // ❌ Создает только серверный поток
  }
}, []);

// ✅ ИСПРАВЛЕННОЕ: Создание локального чата + синхронизация
const handleAddNewChat = useCallback(async () => {
  console.log('🔧 Создаем новый чат');
  
  // ✅ 1. Создаем локальный чат
  const newChat = createNewChat('Новый чат', 'general');
  
  // ✅ 2. Создаем OpenRouter поток
  if (agentId && createAgentChatThread) {
    try {
      const result = await createAgentChatThread();
      // ✅ 3. Синхронизируем ID
      if (result?.chatId) {
        // TODO: Обновить graphqlThreadId в чате
        console.log('✅ Синхронизирован с OpenRouter:', result.chatId);
      }
    } catch (error) {
      console.error('❌ Ошибка создания OpenRouter потока:', error);
    }
  }
  
  // ✅ 4. Открываем AI страницу
  openAskAIPage();
}, [agentId, createAgentChatThread, createNewChat, openAskAIPage]);
```

### ЭТАП 4: Синхронизация с OpenRouter

#### 4.1 Обновить useCreateNewAIChatThread
**Файл**: `packages/twenty-front/src/modules/ai/hooks/useCreateNewAIChatThread.ts`

**Что исправить**:
```typescript
// ✅ ДОБАВИТЬ: Callback для синхронизации
export const useCreateNewAIChatThread = ({
  agentId,
  onCompleted,
  onError,
}: {
  agentId: string;
  onCompleted?: (chatId: string, graphqlThreadId: string) => void;
  onError?: (error: Error) => void;
}) => {
  // ... существующий код
  
  const createAgentChatThread = useCallback(async () => {
    try {
      const result = await createAgentChatThreadMutation({
        variables: { agentId }
      });
      
      if (result.data?.createAgentChatThread?.id) {
        const graphqlThreadId = result.data.createAgentChatThread.id;
        // ✅ Вызываем callback с обоими ID
        onCompleted?.(chatId, graphqlThreadId);
        return { chatId, graphqlThreadId };
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [agentId, onCompleted, onError]);
  
  return { createAgentChatThread };
};
```

#### 4.2 Добавить синхронизацию в useAIChats
**Что добавить**:
```typescript
// ✅ ДОБАВИТЬ: Синхронизация с GraphQL
const syncWithGraphQL = useCallback((chatId: string, graphqlThreadId: string, agentId: string) => {
  setChats(prev => aiChatActions.updateChat(chatId, {
    graphqlThreadId,
    agentId,
  })(prev));
}, [setChats]);

return {
  // ... существующие методы
  syncWithGraphQL, // ✅ Новый метод
};
```

### ЭТАП 5: Тестирование и валидация

#### 5.1 Тестирование переключения между вкладками
**Сценарии для тестирования**:
1. ✅ Создать новый чат → должна появиться новая вкладка
2. ✅ Кликнуть на существующую вкладку → должен открыться существующий чат
3. ✅ НЕ должен создаваться новый чат при переключении
4. ✅ Business Setup вкладка должна быть всегда первой

#### 5.2 Тестирование синхронизации
**Сценарии для тестирования**:
1. ✅ Создать чат → должен появиться в OpenRouter
2. ✅ GraphQL ID должен сохраниться в локальном чате
3. ✅ При перезагрузке чат должен восстановиться

## 🚀 ПОРЯДОК РЕАЛИЗАЦИИ

### Шаг 1: Исправить useAIChats
1. Дополнить методы в `useAIChats.ts`
2. Добавить правильную логику переключения
3. Добавить синхронизацию с GraphQL

### Шаг 2: Исправить CommandMenuTabs
1. Убрать локальное состояние `tabs`
2. Использовать `useAIChats` для управления
3. Исправить логику `handleTabClick`
4. Исправить логику `handleAddNewChat`

### Шаг 3: Синхронизация с OpenRouter
1. Обновить `useCreateNewAIChatThread`
2. Добавить callback для синхронизации
3. Обновить `useAIChats` для синхронизации

### Шаг 4: Тестирование
1. Протестировать переключение между вкладками
2. Протестировать создание новых чатов
3. Протестировать синхронизацию

## 📁 ФАЙЛЫ ДЛЯ ИЗМЕНЕНИЯ

### Основные файлы:
1. `packages/twenty-front/src/modules/ai/hooks/useAIChats.ts`
2. `packages/twenty-front/src/modules/ai/states/aiChatState.ts`
3. `packages/twenty-front/src/modules/command-menu/components/CommandMenuTabs.tsx`
4. `packages/twenty-front/src/modules/ai/hooks/useCreateNewAIChatThread.ts`

### Вспомогательные файлы:
1. `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupAIChat.ts`
2. `packages/twenty-front/src/modules/command-menu/hooks/useOpenAskAIPageInCommandMenu.ts`

## 🎯 ОЖИДАЕМЫЙ РЕЗУЛЬТАТ

После реализации:
- ✅ Переключение между вкладками работает корректно
- ✅ НЕ создаются новые чаты при клике на существующие вкладки
- ✅ Единое состояние для всех чатов
- ✅ Правильная синхронизация с OpenRouter
- ✅ Business Setup вкладка всегда первая
- ✅ Максимум 4 вкладки + кнопка истории

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Не нарушать существующую функциональность** Business Setup
2. **Сохранить совместимость** с OpenRouter
3. **Использовать существующие** Recoil состояния
4. **Тестировать** каждый шаг реализации
5. **Документировать** изменения в коде

## 🔄 СЛЕДУЮЩИЕ ШАГИ

1. Начать с исправления `useAIChats.ts`
2. Затем исправить `CommandMenuTabs.tsx`
3. Добавить синхронизацию с OpenRouter
4. Протестировать функциональность
5. При необходимости внести корректировки
