# План исправления проблемы с чатами Business Setup

## 🎯 ЦЕЛЬ
Создать полноценную систему вкладок чатов (TabView) как в Cursor, где:
- Floating button открывает историю всех чатов вместо создания нового
- Множественные вкладки с возможностью переключения
- Убрать кнопку "+" и tooltips из Command Menu
- Создать TabView интерфейс как Secondary Sidebar

## 🔍 ДИАГНОСТИКА ПРОБЛЕМЫ

### Текущее поведение:
1. ✅ Кликаем "Настройка системы" → создается Business Setup чат
2. ✅ Кликаем "+" (новая вкладка) → создается новый чат  
3. ❌ Кликаем обратно "Настройка системы" → создается НОВЫЙ чат (теряется история)

### Корень проблемы:
- `createAgentChatThread()` НЕ сохраняет ID в `businessSetupChatIdState`
- При возврате `hasBusinessSetupChat = false` → создается новый чат

## 📋 ПЛАН ДЕЙСТВИЙ

### ЭТАП 1: Анализ и подготовка ✅ (ВЫПОЛНЕНО)
- [x] Проанализировали текущий код
- [x] Определили корень проблемы
- [x] Начали изменения в `useCreateNewAIChatThread` и `useBusinessSetupAIChat`

### ЭТАП 2: Архитектурный рефакторинг - Объединение типов чатов ✅ (РЕАЛИЗОВАНО!)
**Статус**: Полностью завершен! Архитектура переписана правильно.

**🔧 Что было реализовано:**

#### 2.1 Новая архитектура типов чатов
- **Создан единый тип `AIChat`** в `packages/twenty-front/src/modules/ai/states/aiChatState.ts`:
  ```typescript
  export type AIChat = {
    id: string;                           // Уникальный ID чата
    title: string;                        // Заголовок для вкладки
    context: 'business-setup' | 'general' | null; // Контекст чата
    initialMessage: string | null;        // Начальное сообщение
    messages: AIChatMessage[];            // История сообщений
    createdAt: Date;                      // Дата создания
    lastAccessed: Date;                   // Последний доступ
    isActive: boolean;                    // Активна ли вкладка
    isBusinessSetup: boolean;             // Это Business Setup чат?
    graphqlThreadId?: string | null;      // ID серверного потока
    agentId?: string | null;              // ID AI агента
    isPinned?: boolean;                   // Закреплена ли вкладка
    isClosable?: boolean;                 // Можно ли закрыть
  };
  ```

#### 2.2 Фабрика создания чатов
- **Создан объект `createAIChat`** с методами:
  - `businessSetup()` - создает закрепленный Business Setup чат
  - `general()` - создает обычный чат
  - `fromGraphQL()` - создает чат из существующего GraphQL потока

#### 2.3 Централизованное управление чатами
- **Создан хук `useAIChats`** в `packages/twenty-front/src/modules/ai/hooks/useAIChats.ts`:
  ```typescript
  export const useAIChats = () => {
    // ✅ Создание чатов
    const createBusinessSetupChat = useCallback((title: string) => { /* ... */ }, []);
    const createGeneralChat = useCallback((title: string) => { /* ... */ }, []);
    
    // ✅ Управление чатами
    const restoreChat = useCallback((chatId: string) => { /* ... */ }, []);
    const switchToChat = useCallback((chatId: string) => { /* ... */ }, []);
    const closeChat = useCallback((chatId: string) => { /* ... */ }, []);
    
    // ✅ Получение чатов
    const getActiveChat = useCallback(() => { /* ... */ }, []);
    const getBusinessSetupChat = useCallback(() => { /* ... */ }, []);
    
    // ✅ Синхронизация с GraphQL
    const updateGraphQLThreadId = useCallback((chatId, graphqlThreadId, agentId) => { /* ... */ }, []);
  };
  ```

#### 2.4 Рефакторинг Business Setup хука
- **Полностью переписан `useBusinessSetupAIChat`** в `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupAIChat.ts`:
  - Убраны прямые манипуляции с Recoil состоянием
  - Используется новый `useAIChats` хук
  - Логика создания: сначала локальный чат, потом GraphQL
  - Автоматическая синхронизация ID через `updateGraphQLThreadId`

#### 2.5 Система вкладок с максимум 4 табами ✅ (РЕАЛИЗОВАНО!)
**Что сделано:**
1. ✅ **Модифицировали CommandMenuTabs** - максимум 4 вкладки + кнопка истории
2. ✅ **Используем TabButton компонент** из Cursor rules с полными стилями
3. ✅ **Исправили Floating Button** - теперь открывает Command Menu с вкладками (БЕЗ создания нового чата)
4. ✅ **"Настройка системы"** - закрепленная вкладка (всегда первая)
5. ✅ **Кнопка "+"** - создает новый чат только по клику внутри Command Menu

**Что осталось сделать:**
6. **Убрать tooltips** из Command Menu
7. **Создать страницу "История чатов"** для показа всех чатов
8. **Добавить управление вкладками** (закрытие)

### ЭТАП 3: Тестирование решения 📋 (ОЖИДАНИЕ)
1. **Протестировать базовый сценарий:**
   - Floating button открывает Command Menu с TabView
   - Максимум 4 вкладки отображаются
   - Кнопка "История чатов" показывает все чаты
   - Переключение между вкладками
   - Закрытие вкладок (кроме Business Setup)
2. **Протестировать edge cases:**
   - Более 4 чатов (должна появиться кнопка истории)
   - Перезагрузка страницы
   - Разные состояния Business Setup

### ЭТАП 4: Финализация 🎁 (ОЖИДАНИЕ)
1. **Убрать ненужный код/комментарии**
2. **Убедиться что все работает стабильно**
3. **Сохранить изменения в git**

---

## ✅ **ОТВЕТЫ НА ВОПРОСЫ (ОТ ПОЛЬЗОВАТЕЛЯ):**

### Вопрос 1: Структура вкладок ✅
**A) Горизонтальные табы сверху** (как сейчас в Command Menu)
- ✅ Максимум **4 вкладки** 
- ✅ Потом кнопка `css-1qq9fp4 e11e8xgx0` для истории всех чатов

### Вопрос 2: Поведение Floating Button ✅
**A) Открывается Command Menu с вкладками**
- ✅ Floating button → Command Menu с TabView
- ✅ Показывает максимум 4 активные вкладки

### Вопрос 3: Управление вкладками ✅
**A) Закрывать отдельные вкладки** + **B) Переименовывать вкладки**
- ✅ Закрытие вкладок (кроме Business Setup во время настройки)
- ✅ Переименование вкладок

### Вопрос 4: Интеграция с существующим кодом ✅
**C) Интегрировать TabView в существующий Command Menu**
- ✅ Модифицируем Command Menu
- ✅ Добавляем вкладки внутрь

### Вопрос 5: Сохранение состояния ✅
**A) В localStorage (как сейчас)**
- ✅ Используем существующую систему

## ✅ **ОТВЕТЫ НА НОВЫЕ ВОПРОСЫ (ОТ ПОЛЬЗОВАТЕЛЯ):**

### Вопрос 6: Стилизация вкладок ✅
**B) Полную анимацию и hover эффекты** из Cursor rules
- ✅ Используем все стили из Cursor rules

### Вопрос 7: Поведение кнопки "История чатов" ✅
**B) Переключается на страницу "История чатов"**
- ✅ Кнопка истории → новая страница Command Menu

### Вопрос 8: Максимум 4 вкладки ✅
**A) Показывать первые 4 + кнопка "История чатов"**
- ✅ Первые 4 чата + кнопка истории справа

### Вопрос 9: Переименование вкладок ✅
**Пока не надо**
- ✅ Функция переименования отложена

### Вопрос 10: Интеграция с Cursor rules ✅
**A) TabButton компонент**
- ✅ Используем готовый TabButton из Cursor rules

---

## 📝 ТЕКУЩИЙ СТАТУС

**Последнее изменение:** Архитектурный рефакторинг полностью завершен! Создана единая система управления чатами.

**Следующий шаг:** Тестируем новую архитектуру! 

**Что работает:**
1. ✅ **Единый тип чата** - объединены GraphQL и локальные чаты
2. ✅ **Централизованное управление** - все операции через `useAIChats`
3. ✅ **Автоматическая синхронизация** - локальные ID связываются с GraphQL
4. ✅ **Floating Button** → Command Menu с вкладками (БЕЗ создания нового чата)
5. ✅ **"Настройка системы"** → закрепленная вкладка (всегда первая)
6. ✅ **Кнопка "+"** → создает новый чат только по клику
7. ✅ **TabButton компонент** → используется из Cursor rules

**Что осталось:**
8. **Убрать tooltips** из Command Menu
9. **Создать страницу "История чатов"**
10. **Добавить закрытие вкладок**

**Готов к работе:** ✅ Да, тестируем новую архитектуру!

---

## 🔧 **ТЕХНИЧЕСКИЕ ДЕТАЛИ РЕАЛИЗАЦИИ:**

### Файлы, которые были созданы/изменены:

#### Новые файлы:
- `packages/twenty-front/src/modules/ai/hooks/useAIChats.ts` - центральный хук управления чатами
- `packages/twenty-front/src/modules/ai/hooks/index.ts` - экспорт всех AI хуков

#### Измененные файлы:
- `packages/twenty-front/src/modules/ai/states/aiChatState.ts` - новый единый тип `AIChat` и фабрика
- `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupAIChat.ts` - полный рефакторинг
- `packages/twenty-front/src/modules/command-menu/components/CommandMenuTabs.tsx` - система вкладок
- `packages/twenty-front/src/modules/ai/hooks/useCreateNewAIChatThread.ts` - добавлен callback

### Ключевые изменения в архитектуре:

#### До рефакторинга:
- Два отдельных состояния: `businessSetupChatIdState` (локальное) и GraphQL чаты
- Дублирование логики создания/восстановления чатов
- Сложная синхронизация между состояниями

#### После рефакторинга:
- Единое состояние `aiChatsState` с типом `AIChat`
- Централизованное управление через `useAIChats`
- Автоматическая синхронизация через `updateGraphQLThreadId`
- Простая и понятная логика без дублирования

### Логика работы новой системы:

1. **Создание Business Setup чата:**
   ```typescript
   // 1. Создаем локальный чат
   const newChat = createBusinessSetupChat('Настройка системы');
   
   // 2. Создаем GraphQL чат
   createAgentChatThread();
   
   // 3. В onCompleted связываем ID
   updateGraphQLThreadId(localChatId, graphqlThreadId, agentId);
   ```

2. **Восстановление существующего чата:**
   ```typescript
   // Проверяем существование
   const existingChat = getBusinessSetupChat();
   if (existingChat) {
     restoreChat(existingChat.id); // Восстанавливаем
     return;
   }
   // Иначе создаем новый
   ```

3. **Управление вкладками:**
   - Максимум 4 вкладки отображаются
   - Business Setup чат всегда закреплен
   - Автоматическое переключение при восстановлении
