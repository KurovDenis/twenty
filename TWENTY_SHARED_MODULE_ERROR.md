# Ошибка разрешения модуля @twenty/shared

## Описание проблемы

### Ошибка
```
Error: Cannot find module '../../../../../../../../../twenty-shared/dist'
Require stack:
- C:\twenty\twenty\packages\twenty-server\dist\src\engine\metadata-modules\agent\langgraph\entities\langgraph-state.entity.js
```

### Причина
TypeScript компилятор генерирует некорректные относительные пути в скомпилированных JavaScript файлах при использовании path mapping для модуля `@twenty/shared`.

### Анализ проблемы

#### 1. Текущая конфигурация
- **tsconfig.json** (разработка): `"@twenty/shared": ["../twenty-shared/src"]`
- **tsconfig.build.json** (продакшн): `"@twenty/shared": ["../twenty-shared/dist"]`
- **Скомпилированный JS**: `require("../../../../../../../../../twenty-shared/dist")` ❌

#### 2. Структура twenty-shared
```json
{
  "name": "twenty-shared",
  "main": "dist/twenty-shared.cjs.js",
  "module": "dist/twenty-shared.esm.js"
}
```

#### 3. Проблема
- TypeScript не правильно разрешает относительные пути при компиляции
- Генерируется путь с избыточными `../` уровнями
- Отсутствует правильная настройка `moduleResolution` для продакшн сборки

## План решения

### Шаг 1: Исправить конфигурацию tsconfig.build.json

**Проблема**: Неправильные path mappings и отсутствие правильной moduleResolution

**Решение**: Обновить конфигурацию:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "moduleResolution": "node",
    "baseUrl": ".",
    "outDir": "./dist",
    "paths": {
      "src/*": ["./src/*"],
      "@twenty/shared": ["../twenty-shared/dist/twenty-shared.cjs.js"],
      "@twenty/shared/*": ["../twenty-shared/dist/declarations/src/*"]
    },
    "types": ["node"]
  },
  "exclude": ["node_modules", "dist", "test", "**/*spec.ts"]
}
```

**Изменения**:
- Добавлен `moduleResolution: "node"`
- Исправлен путь `src/*` на `./src/*`
- Указан точный путь к main файлу: `../twenty-shared/dist/twenty-shared.cjs.js`

### Шаг 2: Альтернативное решение - использовать относительные импорты

Если path mapping продолжает вызывать проблемы, можно временно заменить импорты:

**Было**:
```typescript
import { AgentState } from '@twenty/shared';
```

**Стало**:
```typescript
import { AgentState } from '../../../twenty-shared/dist/twenty-shared.cjs.js';
```

### Шаг 3: Проверить сборку twenty-shared

Убедиться, что twenty-shared правильно собирается:

```bash
cd packages/twenty-shared
yarn build
```

### Шаг 4: Очистить и пересобрать twenty-server

```bash
cd packages/twenty-server
rm -rf dist
yarn build
```

### Шаг 5: Проверить сгенерированные пути

После сборки проверить, что в скомпилированных JS файлах правильные пути:

```javascript
// Должно быть:
const _shared = require("../../../twenty-shared/dist/twenty-shared.cjs.js");

// А не:
const _shared = require("../../../../../../../../../twenty-shared/dist");
```

## Альтернативные решения

### Вариант 1: Использовать module-alias
Установить и настроить `module-alias` для runtime path resolution:

```bash
yarn add module-alias
```

В `package.json`:
```json
{
  "_moduleAliases": {
    "@twenty/shared": "../twenty-shared/dist/twenty-shared.cjs.js"
  }
}
```

### Вариант 2: Настроить webpack/rollup
Если используется bundler, настроить alias в конфигурации.

### Вариант 3: Использовать TypeScript project references
Настроить project references для лучшего управления зависимостями между пакетами.

## Проверка решения

1. **Компиляция**: `yarn build` проходит без ошибок
2. **Runtime**: Приложение запускается без ошибок модулей
3. **Импорты**: Все импорты из `@twenty/shared` работают корректно

## Файлы для изменения

- `packages/twenty-server/tsconfig.build.json` - основная конфигурация
- `packages/twenty-server/package.json` - если потребуется module-alias
- Импорты в TypeScript файлах (если выбран вариант с относительными путями)

## Команды для выполнения

```bash
# 1. Собрать twenty-shared
cd packages/twenty-shared && yarn build

# 2. Очистить twenty-server
cd ../twenty-server && rm -rf dist

# 3. Собрать twenty-server
yarn build

# 4. Запустить сервер
yarn start
```
