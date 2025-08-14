# 🤖 AI включен по умолчанию для всех workspace

## Что было изменено

### 1. **DEFAULT_FEATURE_FLAGS**
- **Файл:** `packages/twenty-server/src/engine/workspace-manager/workspace-sync-metadata/constants/default-feature-flags.ts`
- **Изменение:** Добавлен `FeatureFlagKey.IS_AI_ENABLED` в список по умолчанию
- **Результат:** Все новые workspace будут создаваться с включенным AI функционалом

### 2. **Улучшенный AI Agent**
- **Файл:** `packages/twenty-server/src/engine/workspace-manager/workspace-manager.service.ts`
- **Изменение:** Улучшен prompt для AI агента
- **Результат:** AI агент стал более полезным и информативным

### 3. **Миграция для существующих workspace**
- **Файл:** `packages/twenty-server/src/database/typeorm/core/migrations/common/1752070094778-enable-ai-for-all-workspaces.ts`
- **Изменение:** Создана миграция для включения AI в существующих workspace
- **Результат:** Все существующие workspace получат AI функционал

## Как это работает

### Для новых workspace:
1. При создании workspace автоматически включается `IS_AI_ENABLED` feature flag
2. Создается AI Agent с улучшенным prompt
3. AI Agent устанавливается как default для workspace
4. Пользователи сразу получают доступ к AI чату

### Для существующих workspace:
1. При запуске миграции включается `IS_AI_ENABLED` feature flag
2. Создается AI Agent (если его нет)
3. AI Agent устанавливается как default (если не установлен)

## Проверка работоспособности

После применения изменений:

1. **Перезапустите приложение:**
   ```bash
   yarn dev
   ```

2. **Проверьте AI чат:**
   - Нажмите `Ctrl+K` (или `Cmd+K`) - должно появиться "Ask AI"
   - Нажмите `@` - должно сразу открыться AI чат

3. **Проверьте новые workspace:**
   - Создайте новый workspace
   - AI должен быть доступен сразу

## Откат изменений

Если нужно отключить AI по умолчанию:

1. **Удалите AI из DEFAULT_FEATURE_FLAGS:**
   ```typescript
   export const DEFAULT_FEATURE_FLAGS = [];
   ```

2. **Запустите миграцию в обратном направлении:**
   ```bash
   yarn migration:revert
   ```

## Логи для отладки

### Проверка Feature Flags:
```sql
SELECT w."displayName", ff.key, ff.value 
FROM "core"."workspace" w 
LEFT JOIN "core"."featureFlag" ff ON w.id = ff."workspaceId" 
WHERE ff.key = 'IS_AI_ENABLED';
```

### Проверка AI Agents:
```sql
SELECT w."displayName", w."defaultAgentId", a.name, a.label 
FROM "core"."workspace" w 
LEFT JOIN "core"."agent" a ON w."defaultAgentId" = a.id;
```

## Преимущества

✅ **Все пользователи получают AI по умолчанию**  
✅ **Не нужно вручную включать AI для каждого workspace**  
✅ **Улучшенный AI Agent с полезным prompt**  
✅ **Обратная совместимость с существующими workspace**  
✅ **Простой откат изменений при необходимости**
