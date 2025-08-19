# Business Setup Module

Модуль для управления процессом настройки бизнес-автоматизации в Twenty CRM.

## Описание

Business Setup Module предоставляет инфраструктуру для пошаговой настройки бизнес-процессов с помощью AI агента. Модуль интегрируется с существующей системой onboarding и расширяет функциональность для автоматизации бизнес-процессов.

## Архитектура

### Компоненты

- **BusinessSetupService** - основной сервис для управления статусами Business Setup
- **BusinessSetupResolver** - GraphQL resolver для API endpoints
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

## Использование

### Backend

```typescript
import { BusinessSetupService } from '@/engine/core-modules/business-setup/business-setup.service';

@Injectable()
export class YourService {
  constructor(private readonly businessSetupService: BusinessSetupService) {}

  async getStatus(user: User, workspace: Workspace) {
    return await this.businessSetupService.getBusinessSetupStatus(user, workspace);
  }

  async setStatus(userId: string, workspaceId: string, status: BusinessSetupStatus) {
    await this.businessSetupService.setBusinessSetupStatus(userId, workspaceId, status);
  }
}
```

### GraphQL API

#### Queries

```graphql
query GetBusinessSetupStatus {
  getBusinessSetupStatus
}
```

#### Mutations

```graphql
mutation SetBusinessSetupStatus($status: BusinessSetupStatus!) {
  setBusinessSetupStatus(status: $status)
}
```

## Интеграция

### С OnboardingService

Модуль интегрируется с существующим OnboardingService для обеспечения последовательности:
1. Onboarding → 2. Business Setup → 3. Полная функциональность

### С User Entity

Добавлено поле `businessSetupStatus` в User entity для отслеживания прогресса пользователя.

### С UserVars

Использует систему UserVars для хранения состояния каждого этапа Business Setup.

## Тестирование

```bash
# Запуск unit тестов
npm run test business-setup.service.spec.ts
npm run test business-setup.resolver.spec.ts

# Запуск всех тестов модуля
npm run test business-setup
```

## Разработка

### Добавление нового статуса

1. Добавить новый статус в `BusinessSetupStatus` enum
2. Добавить соответствующий ключ в `BusinessSetupStepKeys`
3. Обновить `BusinessSetupKeyValueTypeMap`
4. Добавить логику в `getBusinessSetupStatus()` и `setBusinessSetupStatus()`
5. Обновить тесты

### Расширение функциональности

Модуль спроектирован для легкого расширения. Можно добавить:
- Дополнительные метаданные для каждого этапа
- Валидацию переходов между статусами
- Интеграцию с другими модулями системы

## Зависимости

- `UserVarsModule` - для хранения состояния
- `OnboardingModule` - для интеграции с onboarding процессом
- `JwtAuthGuard` - для аутентификации
- `@nestjs/graphql` - для GraphQL API
