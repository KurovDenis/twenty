# 🧪 Руководство по тестированию изменений в Twenty CRM

Полное руководство по тестированию кода в монорепозитории Twenty с использованием Nx инструментов.

## 📋 Оглавление

- [Быстрая проверка](#-быстрая-проверка)
- [Frontend тестирование](#-frontend-тестирование)
- [Backend тестирование](#-backend-тестирование)
- [Полная проверка](#-полная-проверка)
- [Исправление ошибок](#-исправление-ошибок)
- [Автоматизация](#-автоматизация)
- [Troubleshooting](#-troubleshooting)

## ⚡ Быстрая проверка

Для быстрой проверки основных ошибок:

```bash
# Проверка типов во всем проекте
npx nx run-many -t typecheck

# Проверка линтера во всем проекте
npx nx run-many -t lint --fix

# Форматирование кода
npx nx format:check
npx nx format:write  # автоисправление
```

## 🎨 Frontend тестирование

### Линтер и форматирование

```bash
# Основная проверка линтера с автоисправлением
npx nx lint twenty-front --fix

# Только проверка без исправлений
npx nx lint twenty-front

# Проверка конкретных файлов
npx nx lint twenty-front --files="src/components/**/*.tsx"
```

### TypeScript проверки

```bash
# Проверка типов
npx nx typecheck twenty-front

# Детальная проверка с verbose
npx nx typecheck twenty-front --verbose
```

### Unit тесты

```bash
# Запуск всех unit тестов
npx nx test twenty-front

# Запуск тестов в watch режиме
npx nx test twenty-front --watch

# Запуск тестов с coverage
npx nx test twenty-front --coverage

# Запуск конкретного теста
npx nx test twenty-front --testNamePattern="BusinessSetup"
```

### Storybook тестирование

```bash
# Сборка Storybook
npx nx storybook:build twenty-front

# Запуск Storybook тестов
npx nx storybook:serve-and-test:static

# Локальный запуск Storybook
npx nx storybook:serve twenty-front
```

### Сборка проекта

```bash
# Сборка frontend
npx nx build twenty-front

# Сборка с детальным выводом
npx nx build twenty-front --verbose

# Production сборка
NODE_ENV=production npx nx build twenty-front
```

## 🔧 Backend тестирование

### Линтер и типы

```bash
# Проверка линтера с автоисправлением
npx nx lint twenty-server --fix

# TypeScript проверка
npx nx typecheck twenty-server

# Форматирование backend кода
npx nx format:check --projects=twenty-server
npx nx format:write --projects=twenty-server
```

### Unit тесты

```bash
# Unit тесты
npx nx test twenty-server

# Unit тесты с coverage
npx nx test twenty-server --coverage

# Запуск конкретного теста
npx nx test twenty-server --testNamePattern="AuthService"
```

### Integration тесты

```bash
# Integration тесты
npx nx test:integration twenty-server

# Integration тесты с сбросом БД
npx nx test:integration:with-db-reset twenty-server

# E2E тесты
npx nx test twenty-e2e-testing
```

### База данных

```bash
# Сброс и миграции
npx nx database:reset twenty-server
npx nx database:migrate twenty-server

# Проверка миграций
npx nx run twenty-server:database:init:prod
```

### Сборка backend

```bash
# Сборка server
npx nx build twenty-server

# Запуск server
npx nx start twenty-server

# Запуск worker
npx nx worker twenty-server
```

## 🔍 Полная проверка

### Проверка всего проекта

```bash
# Полная проверка всех пакетов
npx nx run-many -t lint,typecheck,test --parallel=3

# Проверка только измененных файлов
npx nx affected -t lint,typecheck,test

# Сборка всех пакетов
npx nx run-many -t build --parallel=3
```

### Проверка зависимостей

```bash
# Анализ зависимостей
npx nx graph

# Проверка неиспользуемых зависимостей  
npx nx run-many -t lint --uncommitted

# Анализ пакетов
npx nx list
```

## 🛠️ Исправление ошибок

### Автоматическое исправление

```bash
# Автоисправление линтера
npx nx lint twenty-front --fix
npx nx lint twenty-server --fix

# Автоформатирование
npx nx format:write

# Исправление import/export
npx nx lint twenty-front --fix --rule="@typescript-eslint/no-unused-vars"
```

### Распространенные ошибки

#### TypeScript ошибки

```bash
# Проверка типов с детализацией
npx nx typecheck twenty-front --verbose

# Генерация типов GraphQL
npx nx run twenty-front:graphql:generate
npx nx run twenty-server:graphql:generate
```

#### Ошибки линтера

```bash
# Проверка конкретных правил
npx nx lint twenty-front --rule="@nx/workspace-no-hardcoded-colors"

# Отключение правил (в файле)
// eslint-disable-next-line no-console
console.log('debug message');
```

#### Ошибки импортов

```bash
# Проверка неиспользуемых импортов
npx nx lint twenty-front --fix --rule="unused-imports/no-unused-imports"

# Очистка barrel exports
npx nx run twenty-shared:generate-barrels
```

## 🤖 Автоматизация

### Скрипты для разработки

Создайте `scripts/test-changes.sh`:

```bash
#!/bin/bash
echo "🧪 Запуск полной проверки изменений..."

# 1. Проверка TypeScript
echo "📝 Проверка типов..."
npx nx run-many -t typecheck

# 2. Проверка линтера  
echo "🔍 Проверка линтера..."
npx nx run-many -t lint --fix

# 3. Запуск тестов
echo "🧪 Запуск тестов..."
npx nx run-many -t test

# 4. Сборка проектов
echo "🔨 Сборка проектов..."
npx nx run-many -t build

echo "✅ Проверка завершена!"
```

### Pre-commit хуки

Добавьте в `package.json`:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npx nx affected -t lint,typecheck,test --uncommitted"
    }
  }
}
```

### CI/CD пайплайн

```yaml
# .github/workflows/test.yml
name: Test Changes
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: yarn install
      
      - name: Lint check
        run: npx nx run-many -t lint
      
      - name: Type check  
        run: npx nx run-many -t typecheck
        
      - name: Run tests
        run: npx nx run-many -t test
        
      - name: Build projects
        run: npx nx run-many -t build
```

## 🚨 Troubleshooting

### Частые проблемы

#### "Cannot find module" ошибки

```bash
# Очистка node_modules
rm -rf node_modules
yarn install

# Очистка Nx кэша
npx nx reset

# Перегенерация типов
npx nx run twenty-front:graphql:generate
```

#### Ошибки TypeScript "Type not found"

```bash
# Проверка путей в tsconfig.json
npx nx typecheck twenty-front --verbose

# Перезапуск TypeScript сервера (в IDE)
# VS Code: Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

#### Ошибки линтера с кэшем

```bash
# Очистка ESLint кэша
npx nx lint twenty-front --cache=false

# Полная очистка
npx nx reset
rm -rf .nx/cache
```

#### Проблемы с базой данных

```bash
# Полный сброс БД
docker-compose -f packages/twenty-docker/docker-compose.yml down -v
npx nx database:reset twenty-server

# Проверка подключения
npx nx database:init twenty-server
```

### Отладка производительности

```bash
# Анализ времени выполнения
npx nx run-many -t lint --verbose

# Профилирование тестов
npx nx test twenty-front --detectSlowTests

# Анализ размера bundle
npx nx build twenty-front --analyze
```

## 📊 Метрики качества

### Coverage отчеты

```bash
# Генерация coverage отчетов
npx nx test twenty-front --coverage
npx nx test twenty-server --coverage

# Просмотр coverage
open coverage/twenty-front/lcov-report/index.html
```

### Анализ кода

```bash
# Сложность кода
npx nx lint twenty-front --rule="complexity"

# Анализ дублирования
npx nx run-many -t lint --rule="no-duplicate-string"

# Безопасность
npx audit-ci --config .audit-ci.json
```

## 🎯 Best Practices

### Перед коммитом

1. **Обязательно запустите:**
   ```bash
   npx nx lint twenty-front --fix
   npx nx lint twenty-server --fix  
   npx nx typecheck twenty-front
   npx nx typecheck twenty-server
   ```

2. **Рекомендуется запустить:**
   ```bash
   npx nx test twenty-front
   npx nx test twenty-server
   ```

3. **При больших изменениях:**
   ```bash
   npx nx run-many -t build
   npx nx test:integration twenty-server
   ```

### Работа с зависимостями

```bash
# Проверка устаревших пакетов
yarn outdated

# Анализ bundle size
npx nx build twenty-front --analyze

# Проверка дублирования зависимостей
npx yarn-deduplicate
```

### Мониторинг изменений

```bash
# Отслеживание affected проектов
npx nx show projects --affected

# Визуализация зависимостей
npx nx graph --affected
```

---

## 💡 Полезные алиасы

Добавьте в `.bashrc` или `.zshrc`:

```bash
# Быстрые команды для тестирования
alias nxlf="npx nx lint twenty-front --fix"
alias nxls="npx nx lint twenty-server --fix"
alias nxtf="npx nx typecheck twenty-front"
alias nxts="npx nx typecheck twenty-server"
alias nxtest="npx nx run-many -t lint,typecheck,test"
alias nxbuild="npx nx run-many -t build"
alias nxreset="npx nx reset && yarn install"
```

## 🔗 Дополнительные ресурсы

- [Nx Documentation](https://nx.dev/getting-started/intro)
- [Twenty Contributing Guide](./CONTRIBUTING.md)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Помните:** Регулярное тестирование изменений помогает поддерживать высокое качество кода и предотвращает накопление технического долга! 🚀
