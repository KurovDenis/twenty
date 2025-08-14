# 🔍 Диагностика проблемы с AI чатом

## Проблема
Не удается открыть AI чат в приложении Twenty.

## Возможные причины и решения

### 1. **Feature Flag отключен**
AI функция контролируется feature flag `IS_AI_ENABLED`.

**Проверка:**
```sql
-- Проверьте, включен ли AI feature flag
SELECT * FROM "core"."featureFlag" 
WHERE "key" = 'IS_AI_ENABLED' 
AND "workspaceId" = 'YOUR_WORKSPACE_ID';
```

**Решение:**
```sql
-- Включите AI feature flag
INSERT INTO "core"."featureFlag" ("key", "workspaceId", "value") 
VALUES ('IS_AI_ENABLED', 'YOUR_WORKSPACE_ID', true)
ON CONFLICT ("key", "workspaceId") 
DO UPDATE SET "value" = true;
```

### 2. **Отсутствует AI Agent**
В workspace должен быть создан default agent.

**Проверка:**
```sql
-- Проверьте, есть ли default agent
SELECT "defaultAgentId" FROM "core"."workspace" 
WHERE "id" = 'YOUR_WORKSPACE_ID';

-- Проверьте, существует ли agent
SELECT * FROM "core"."agent" 
WHERE "id" = 'AGENT_ID_FROM_ABOVE' 
AND "workspaceId" = 'YOUR_WORKSPACE_ID';
```

**Решение:**
Если agent отсутствует, он должен создаться автоматически при инициализации workspace с включенным AI feature flag.

### 3. **Проблемы с командным меню**
Командное меню может не открываться.

**Проверка:**
- Нажмите `Ctrl+K` (или `Cmd+K`) - должно открыться командное меню
- Нажмите `@` - должно сразу открыться AI чат (если AI включен)

**Решение:**
Проверьте консоль браузера на наличие ошибок JavaScript.

### 4. **Проблемы с правами доступа**
У пользователя может не быть прав на использование AI.

**Проверка:**
Убедитесь, что пользователь имеет роль с правами на использование AI функций.

## Пошаговая диагностика

### Шаг 1: Проверьте Feature Flag
```bash
# В базе данных
psql -d your_database -c "
SELECT w.id, w.\"displayName\", ff.key, ff.value 
FROM \"core\".\"workspace\" w 
LEFT JOIN \"core\".\"featureFlag\" ff ON w.id = ff.\"workspaceId\" 
WHERE ff.key = 'IS_AI_ENABLED';
"
```

### Шаг 2: Проверьте AI Agent
```bash
# В базе данных
psql -d your_database -c "
SELECT w.id, w.\"displayName\", w.\"defaultAgentId\", a.name, a.label 
FROM \"core\".\"workspace\" w 
LEFT JOIN \"core\".\"agent\" a ON w.\"defaultAgentId\" = a.id 
WHERE w.id = 'YOUR_WORKSPACE_ID';
"
```

### Шаг 3: Проверьте консоль браузера
1. Откройте Developer Tools (F12)
2. Перейдите на вкладку Console
3. Попробуйте открыть AI чат
4. Проверьте наличие ошибок

### Шаг 4: Проверьте Network запросы
1. В Developer Tools перейдите на вкладку Network
2. Попробуйте открыть AI чат
3. Проверьте, какие запросы отправляются и их статус

## Решения

### Решение 1: Включить AI Feature Flag
```sql
-- Включите AI для workspace
UPDATE "core"."featureFlag" 
SET "value" = true 
WHERE "key" = 'IS_AI_ENABLED' 
AND "workspaceId" = 'YOUR_WORKSPACE_ID';

-- Если записи нет, создайте её
INSERT INTO "core"."featureFlag" ("key", "workspaceId", "value") 
VALUES ('IS_AI_ENABLED', 'YOUR_WORKSPACE_ID', true)
ON CONFLICT ("key", "workspaceId") DO NOTHING;
```

### Решение 2: Создать AI Agent вручную
```sql
-- Создайте AI agent
INSERT INTO "core"."agent" (
  "id", "name", "label", "description", "prompt", 
  "modelId", "workspaceId", "isCustom"
) VALUES (
  gen_random_uuid(), 
  'default-ai-assistant', 
  'AI Assistant', 
  'Default AI assistant for this workspace',
  'You are a helpful AI assistant for this workspace. Help users with their tasks, provide insights about their data, and guide them through workflows.',
  'auto',
  'YOUR_WORKSPACE_ID',
  false
);

-- Установите его как default agent
UPDATE "core"."workspace" 
SET "defaultAgentId" = (
  SELECT "id" FROM "core"."agent" 
  WHERE "workspaceId" = 'YOUR_WORKSPACE_ID' 
  AND "name" = 'default-ai-assistant'
)
WHERE "id" = 'YOUR_WORKSPACE_ID';
```

### Решение 3: Перезапустить приложение
```bash
# Остановите сервер
# Удалите кэш
rm -rf packages/twenty-front/.next
rm -rf packages/twenty-server/dist

# Перезапустите
yarn dev
```

## Проверка работоспособности

После применения решений:

1. **Откройте командное меню:** `Ctrl+K` (или `Cmd+K`)
2. **Найдите AI опции:** Должны появиться "Ask AI" и "View Previous AI Chats"
3. **Быстрый доступ:** Нажмите `@` для прямого доступа к AI чату
4. **Проверьте интерфейс:** AI чат должен открыться с полным функционалом

## Логи для отладки

### Frontend логи
```javascript
// В консоли браузера
console.log('Current workspace:', currentWorkspace);
console.log('AI enabled:', isAiEnabled);
console.log('Default agent:', currentWorkspace?.defaultAgent);
```

### Backend логи
```bash
# В логах сервера ищите
grep -i "ai" packages/twenty-server/logs/*.log
grep -i "agent" packages/twenty-server/logs/*.log
```

## Контакты для поддержки

Если проблема не решается:
1. Проверьте GitHub Issues проекта
2. Создайте новый Issue с подробным описанием проблемы
3. Приложите логи и скриншоты ошибок
