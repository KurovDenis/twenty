# Система аутентификации и создания workspace в Twenty

## Обзор архитектуры

Twenty использует современную архитектуру с разделением на фронтенд и бэкенд:

### Фронтенд (React + TypeScript + Recoil)
- **Основной хук**: `useAuth` в `packages/twenty-front/src/modules/auth/hooks/useAuth.ts`
- **Управление состоянием**: Recoil atoms (tokenPairState, loginTokenState, signInUpStepState)
- **Компоненты**: Модульная структура с разделением на sign-in-up компоненты

### Бэкенд (NestJS + TypeORM + GraphQL)
- **Основной сервис**: `AuthService` и `SignInUpService`
- **Resolver**: `AuthResolver` для GraphQL мутаций
- **База данных**: PostgreSQL с отдельными схемами для каждого workspace

## Этапы аутентификации

### SignInUpStep Enum
```typescript
enum SignInUpStep {
  Init = 'init',
  Email = 'email', 
  Password = 'password',
  EmailVerification = 'emailVerification',
  WelcomeDialog = 'welcomeDialog', // Новый шаг для диалога приветствия
  WorkspaceSelection = 'workspaceSelection',
  SSOIdentityProviderSelection = 'SSOIdentityProviderSelection',
  TwoFactorAuthenticationVerification = 'TwoFactorAuthenticationVerification',
  TwoFactorAuthenticationProvision = 'TwoFactorAuthenticationProvision',
}
```

### Режимы аутентификации
```typescript
enum SignInUpMode {
  SignIn = 'sign-in',
  SignUp = 'sign-up',
}
```

## Состояния workspace

### WorkspaceActivationStatus Enum
```typescript
enum WorkspaceActivationStatus {
  ONGOING_CREATION = 'ONGOING_CREATION',
  PENDING_CREATION = 'PENDING_CREATION', 
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}
```

## Процесс создания workspace

### 1. Создание workspace (`signUpOnNewWorkspace`)
```typescript
// В SignInUpService.signUpOnNewWorkspace
const workspaceToCreate = this.workspaceRepository.create({
  subdomain: await this.domainManagerService.generateSubdomain(
    isWorkEmailFound ? { email } : {},
  ),
  displayName: '',
  inviteHash: v4(),
  activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
  logo,
});
```

**Шаги:**
- Генерируется уникальный subdomain
- Создается workspace со статусом `PENDING_CREATION`
- Создается связь пользователь-workspace
- Активируется onboarding

### 2. Активация workspace (`activateWorkspace`)
```typescript
// В WorkspaceService.activateWorkspace
await this.workspaceRepository.update(workspace.id, {
  activationStatus: WorkspaceActivationStatus.ONGOING_CREATION,
});

await this.featureFlagService.enableFeatureFlags(
  DEFAULT_FEATURE_FLAGS,
  workspace.id,
);

await this.workspaceManagerService.init({
  workspaceId: workspace.id,
  userId: user.id,
});

await this.workspaceRepository.update(workspace.id, {
  displayName: data.displayName,
  activationStatus: WorkspaceActivationStatus.ACTIVE,
  version: extractVersionMajorMinorPatch(appVersion),
});
```

**Шаги:**
- Проверяется статус `PENDING_CREATION`
- Устанавливается статус `ONGOING_CREATION`
- Включаются feature flags
- Инициализируется workspace manager
- Создается схема базы данных
- Создается workspace member
- Устанавливается статус `ACTIVE`

## Что происходит при вводе email

### 1. Проверка существования пользователя

Когда пользователь вводит email и нажимает "Continue":

```typescript
// В useSignInUp.ts - continueWithCredentials
checkUserExistsQuery({
  variables: {
    email: form.getValues('email').toLowerCase().trim(),
    captchaToken: token,
  },
  onCompleted: (data) => {
    setSignInUpMode(
      data?.checkUserExists.exists
        ? SignInUpMode.SignIn
        : SignInUpMode.SignUp,
    );
    setSignInUpStep(SignInUpStep.Password);
  },
});
```

### 2. Серверная проверка (checkUserExists)

```typescript
// В AuthService.checkUserExists
{
  exists: boolean,           // Существует ли пользователь
  availableWorkspacesCount: number,  // Количество доступных workspace
  isEmailVerified: boolean   // Подтвержден ли email
}
```

### 3. Сценарии для нового пользователя

#### Сценарий A: Полная регистрация
1. Система переключается в режим `SignInUpMode.SignUp`
2. Показывается поле для ввода пароля
3. После ввода пароля выполняется `signUp` мутация
4. Создается новый пользователь
5. **Новый шаг**: Показывается диалог приветствия (`WelcomeDialog`)
6. **Ключевой момент**: После ответа пользователя проверяется количество доступных workspace

```typescript
// В handleCredentialsSignUp
const { user } = await loadCurrentUser();

// Показываем диалог приветствия для новых пользователей
setSignInUpStep(SignInUpStep.WelcomeDialog);

// В handleWelcomeDialogResponse
const handleWelcomeDialogResponse = useCallback(
  async (response: string) => {
    // Сохраняем ответ пользователя
    setWelcomeDialogResponse(response);
    
    const { user } = await loadCurrentUser();

    if (countAvailableWorkspaces(user.availableWorkspaces) === 0) {
      return await createWorkspace({ newTab: false });
    }

    setSignInUpStep(SignInUpStep.WorkspaceSelection);
  },
  [setWelcomeDialogResponse, loadCurrentUser, setSignInUpStep, createWorkspace],
);
```

#### Сценарий B: Автоматическое создание workspace
- Если `availableWorkspacesCount === 0`, система **автоматически создает новый workspace**
- Пользователь перенаправляется на страницу активации workspace
- Workspace создается со статусом `PENDING_CREATION`

#### Сценарий C: Выбор workspace
- Если есть доступные workspace, показывается экран выбора workspace (`WorkspaceSelection`)
- Пользователь может выбрать существующий workspace или создать новый

### 4. Сценарии для существующего пользователя

#### Сценарий A: Вход в систему
1. Система переключается в режим `SignInUpMode.SignIn`
2. Показывается поле для ввода пароля
3. После ввода пароля выполняется `signIn` мутация

#### Сценарий B: Проверка доступных workspace
```typescript
// В handleCredentialsSignIn
const availableWorkspacesCount = countAvailableWorkspaces(
  user.availableWorkspaces,
);

if (availableWorkspacesCount === 0) {
  return createWorkspace(); // Автоматическое создание
}

if (availableWorkspacesCount === 1) {
  // Автоматический переход в единственный workspace
}

if (availableWorkspacesCount > 1) {
  setSignInUpStep(SignInUpStep.WorkspaceSelection); // Выбор workspace
}
```

## Доступные workspace

### Что такое "доступные workspace"

Система ищет workspace по трем критериям:

```typescript
// В UserWorkspaceService.findAvailableWorkspacesByEmail
{
  availableWorkspacesForSignIn: [
    // Workspace, где пользователь уже является участником
  ],
  availableWorkspacesForSignUp: [
    // Workspace с одобренным доменом для email
    // Workspace с приглашениями для email
  ]
}
```

### Логика поиска workspace
1. **Уже участник**: Workspace, где пользователь уже является членом
2. **Одобренный домен**: Workspace с настроенным approved access domain для домена email
3. **Приглашения**: Workspace, куда пользователь приглашен

## Токены и безопасность

### Типы токенов
- **Login Token**: Временный токен для получения auth tokens
- **Auth Token Pair**: Access и refresh токены
- **Email Verification Token**: Для подтверждения email
- **Workspace Agnostic Token**: Токен без привязки к workspace

### Безопасность
- CAPTCHA защита
- Email верификация
- Two-factor authentication
- Workspace-специфичные разрешения

## Мульти-workspace архитектура

### Особенности
- Каждый workspace имеет свою схему в базе данных
- Пользователи могут принадлежать к нескольким workspace
- Поддержка приглашений через invite hash
- Изоляция данных между workspace

### Инициализация workspace
```typescript
// В WorkspaceManagerService.init
await this.workspaceDataSourceService.createWorkspaceDBSchema(workspaceId);
await this.dataSourceService.createDataSourceMetadata(workspaceId, schemaName);
await this.workspaceSyncMetadataService.synchronize({
  workspaceId,
  dataSourceId: dataSourceMetadata.id,
  featureFlags,
});
await this.initPermissions({ workspaceId, userId });
```

## Интеграции

### Поддерживаемые провайдеры
- **Google OAuth**: Поддержка входа через Google
- **Microsoft OAuth**: Поддержка входа через Microsoft
- **SSO**: Поддержка SAML и OIDC
- **API Keys**: Для программного доступа

## Диалог приветствия

### Компонент WelcomeDialog
Новый компонент `WelcomeDialog` отображается для новых пользователей после успешной регистрации и перед проверкой доступных workspace.

#### Особенности:
- **Приветственное сообщение** с эмодзи
- **Поле для ввода** ответа пользователя
- **Кнопки "Skip" и "Continue"** для навигации
- **Сохранение ответа** в состоянии приложения
- **Уведомление** с благодарностью за ответ

#### Логика работы:
```typescript
// В SignInUpGlobalScopeForm
<WelcomeDialog
  isOpen={signInUpStep === SignInUpStep.WelcomeDialog}
  onClose={() => handleWelcomeDialogResponse('')}
  onContinue={handleWelcomeDialogResponse}
  userEmail={form.getValues('email') || ''}
/>
```

#### Состояние ответа:
```typescript
// Новое состояние для хранения ответа
export const welcomeDialogResponseState = createState<string>({
  key: 'welcomeDialogResponseState',
  defaultValue: '',
});
```

## Пользовательский опыт

### Для нового пользователя без workspace
1. Ввод email → "Continue"
2. Ввод пароля → "Sign Up" 
3. **Диалог приветствия** → Пользователь может ответить или пропустить
4. **Автоматическое создание workspace**
5. Перенаправление на активацию workspace
6. Ввод названия workspace → Активация

### Для существующего пользователя без workspace
1. Ввод email → "Continue"
2. Ввод пароля → "Sign In"
3. **Автоматическое создание workspace**
4. Перенаправление на активацию workspace

## Ключевые компоненты

### Фронтенд
- **useAuth**: Основной хук для управления аутентификацией
- **useSignInUp**: Хук для форм входа/регистрации
- **useSignUpInNewWorkspace**: Хук для создания нового workspace
- **SignInUpGlobalScopeForm**: Компонент для глобальной аутентификации
- **WelcomeDialog**: Компонент диалога приветствия для новых пользователей
- **CreateWorkspace**: Компонент для создания workspace

### Бэкенд
- **AuthResolver**: GraphQL resolver для аутентификации
- **SignInUpService**: Сервис для регистрации и входа
- **WorkspaceService**: Сервис для управления workspace
- **WorkspaceManagerService**: Сервис для инициализации workspace

## GraphQL мутации

### Основные мутации
```graphql
# Проверка существования пользователя
query CheckUserExists($email: String!, $captchaToken: String) {
  checkUserExists(email: $email, captchaToken: $captchaToken) {
    exists
    availableWorkspacesCount
    isEmailVerified
  }
}

# Регистрация
mutation SignUp($email: String!, $password: String!, $captchaToken: String) {
  signUp(email: $email, password: $password, captchaToken: $captchaToken) {
    availableWorkspaces {
      ...AvailableWorkspacesFragment
    }
    tokens {
      ...AuthTokenPairFragment
    }
  }
}

# Создание нового workspace
mutation SignUpInNewWorkspace {
  signUpInNewWorkspace {
    loginToken {
      ...AuthTokenFragment
    }
    workspace {
      id
      workspaceUrls {
        ...WorkspaceUrlsFragment
      }
    }
  }
}

# Активация workspace
mutation ActivateWorkspace($input: ActivateWorkspaceInput!) {
  activateWorkspace(data: $input) {
    id
  }
}
```

## Заключение

Система аутентификации и создания workspace в Twenty обеспечивает:

1. **Бесшовный пользовательский опыт** - автоматическое создание workspace для новых пользователей
2. **Гибкость** - поддержка множественных workspace и различных провайдеров аутентификации
3. **Безопасность** - многоуровневая защита с CAPTCHA, email верификацией и 2FA
4. **Масштабируемость** - изолированные workspace с отдельными схемами БД
5. **Интеграцию** - поддержка SSO, OAuth и API ключей

Архитектура построена с учетом современных best practices и обеспечивает надежную основу для корпоративного CRM решения.
