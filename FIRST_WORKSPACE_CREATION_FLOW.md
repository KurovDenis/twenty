## Поток первого создания рабочего пространства (Workspace) — руководство по реализации

### Цель
Обеспечить корректный и предсказуемый UX для новых пользователей: после успешной аутентификации, если у пользователя 0 доступных воркспейсов, автоматически создать новый воркспейс и перенаправить пользователя на его домен. При >1 воркспейсах — показать выбор. При 1 воркспейсе — либо сразу редиректить в него, либо (по флагу) предложить «Создать новый».

### Ключевая идея
На этапе «первого входа» используем user-only (workspace-agnostic) аутентификацию. Любые запросы, требующие `workspaceId`/`userWorkspaceId`, выполняем только после того, как воркспейс создан и выданы workspace-скоупанные токены. Иначе прилетит FORBIDDEN «User does not have access to this workspace».

---

## Текущая реализация (обзор кода)

### Frontend: хук аутентификации `useAuth`
После логина (credentials) — логика ветвления по количеству доступных воркспейсов:

```368:401:packages/twenty-front/src/modules/auth/hooks/useAuth.ts
  const handleCredentialsSignIn = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      signIn({
        variables: { email, password, captchaToken },
        onCompleted: async (data) => {
          handleSetAuthTokens(data.signIn.tokens);
          const { user } = await loadCurrentUser();

          const availableWorkspacesCount = countAvailableWorkspaces(
            user.availableWorkspaces,
          );

          if (availableWorkspacesCount === 0) {
            return createWorkspace();
          }

          if (availableWorkspacesCount === 1) {
            const targetWorkspace = getFirstAvailableWorkspaces(
              user.availableWorkspaces,
            );
            return await redirectToWorkspaceDomain(
              getWorkspaceUrl(targetWorkspace.workspaceUrls),
              targetWorkspace.loginToken ? AppPath.Verify : AppPath.SignInUp,
              {
                ...(targetWorkspace.loginToken && {
                  loginToken: targetWorkspace.loginToken,
                }),
                email: user.email,
              },
            );
          }

          setSignInUpStep(SignInUpStep.WorkspaceSelection);
        },
        onError: (error) => {
          if (
            error instanceof ApolloError &&
            error.graphQLErrors[0]?.extensions?.subCode === 'EMAIL_NOT_VERIFIED'
          ) {
            setSearchParams({ email });
            setSignInUpStep(SignInUpStep.EmailVerification);
            throw error;
          }
          throw error;
        },
      });
    },
    [
      handleSetAuthTokens,
      redirectToWorkspaceDomain,
      signIn,
      loadCurrentUser,
      setSearchParams,
      setSignInUpStep,
      createWorkspace,
    ],
  );
```

После регистрации, если проверка e‑mail включена, создание переносится на этап верификации; если нет — сразу оценивается количество воркспейсов и при 0 вызывается `createWorkspace`:

```441:459:packages/twenty-front/src/modules/auth/hooks/useAuth.ts
      if (isEmailVerificationRequired) {
        setSearchParams({ email });
        setSignInUpStep(SignInUpStep.EmailVerification);
        return null;
      }

      if (!signUpResult.data?.signUp) {
        throw new Error('No signUp result');
      }

      handleSetAuthTokens(signUpResult.data.signUp.tokens);

      const { user } = await loadCurrentUser();

      if (countAvailableWorkspaces(user.availableWorkspaces) === 0) {
        return await createWorkspace({ newTab: false });
      }

      setSignInUpStep(SignInUpStep.WorkspaceSelection);
```

После верификации e‑mail фронт получает workspace-agnostic токены, грузит пользователя и при 0 воркспейсах создаёт новый:

```270:285:packages/twenty-front/src/modules/auth/hooks/useAuth.ts
      handleSetAuthTokens(
        data.getWorkspaceAgnosticTokenFromEmailVerificationToken.tokens,
      );

      const { user } = await loadCurrentUser();

      if (countAvailableWorkspaces(user.availableWorkspaces) === 0) {
        return await createWorkspace({ newTab: false });
      }

      setSignInUpStep(SignInUpStep.WorkspaceSelection);
```

Создание воркспейса на фронте — через `useSignUpInNewWorkspace`:

```1:35:packages/twenty-front/src/modules/auth/sign-in-up/hooks/useSignUpInNewWorkspace.ts
import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { AppPath } from '@/types/AppPath';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ApolloError } from '@apollo/client';
import { useSignUpInNewWorkspaceMutation } from '~/generated-metadata/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';

export const useSignUpInNewWorkspace = () => {
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();
  const { enqueueErrorSnackBar } = useSnackBar();

  const [signUpInNewWorkspaceMutation] = useSignUpInNewWorkspaceMutation();

  const createWorkspace = async ({ newTab } = { newTab: true }) => {
    await signUpInNewWorkspaceMutation({
      onCompleted: async (data) => {
        return await redirectToWorkspaceDomain(
          getWorkspaceUrl(data.signUpInNewWorkspace.workspace.workspaceUrls),
          AppPath.Verify,
          {
            loginToken: data.signUpInNewWorkspace.loginToken.token,
          },
          newTab ? '_blank' : '_self',
        );
      },
      onError: (error: ApolloError) => {
        enqueueErrorSnackBar({ apolloError: error });
      },
    });
  };

  return {
    createWorkspace,
  };
};
```

### Backend: мутация создания воркспейса

Мутация `signUpInNewWorkspace` (guard: только `UserAuthGuard`, без требования workspace-контекста):

```475:498:packages/twenty-server/src/engine/core-modules/auth/auth.resolver.ts
  @Mutation(() => SignUpOutput)
  @UseGuards(UserAuthGuard)
  async signUpInNewWorkspace(
    @AuthUser() currentUser: User,
    @AuthProvider() authProvider: AuthProviderEnum,
  ): Promise<SignUpOutput> {
    const { user, workspace } = await this.signInUpService.signUpOnNewWorkspace(
      { type: 'existingUser', existingUser: currentUser },
    );

    const loginToken = await this.loginTokenService.generateLoginToken(
      user.email,
      workspace.id,
      authProvider,
    );

    return {
      loginToken,
      workspace: {
        id: workspace.id,
        workspaceUrls: this.domainManagerService.getWorkspaceUrls(workspace),
      },
    };
  }
```

### Почему возникает FORBIDDEN «User does not have access to this workspace»
Ошибка выбрасывается, если до создания воркспейса/членства выполняются workspace-скоупанные запросы (JWT без `userWorkspaceId`):

```171:189:packages/twenty-server/src/engine/core-modules/user/services/user.service.ts
  async hasUserAccessToWorkspaceOrThrow(userId: string, workspaceId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        userWorkspaces: {
          workspaceId,
        },
      },
      relations: { userWorkspaces: true },
    });

    userValidator.assertIsDefinedOrThrow(
      user,
      new AuthException(
        'User does not have access to this workspace',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      ),
    );
  }
```

```148:156:packages/twenty-server/src/engine/core-modules/auth/strategies/jwt.auth.strategy.ts
    userWorkspaceValidator.assertIsDefinedOrThrow(
      userWorkspace,
      new AuthException(
        'UserWorkspace not found',
        AuthExceptionCode.USER_WORKSPACE_NOT_FOUND,
        {
          userFriendlyMessage: t`User does not have access to this workspace`,
        },
      ),
    );
```

---

## Пошаговая реализация (рекомендуемый поток)

1) После успешной регистрации/логина получить user-only токены
   - При включённой проверке e‑mail: сначала через `getWorkspaceAgnosticTokenFromEmailVerificationToken`.
   - При отключённой проверке e‑mail: токены выдаются сразу после `signIn`/`signUp`.

2) Загрузить пользователя и посчитать доступные воркспейсы
   - Используется уже реализованная логика `loadCurrentUser()` и `countAvailableWorkspaces(...)`.

3) Если воркспейсов 0 — вызвать `createWorkspace()`
   - Это дергает мутацию `signUpInNewWorkspace` (без workspace-контекста) и редиректит на домен нового воркспейса с `loginToken` → экран Verify.

4) Если воркспейсов >1 — показать экран выбора
   - Текущее поведение оставляем без изменений, когда `isMultiWorkspaceEnabled` включён.

5) Если воркспейс ровно 1 — выбрать поведение
   - Вариант по умолчанию: авто‑редирект в единственный воркспейс (текущее поведение).
   - Вариант «создавать новый»: заменить ветку `availableWorkspacesCount === 1` на вызов `createWorkspace({ newTab: false })`.
   - Вариант «предложить выбор»: показывать экран с кнопкой «Создать новый рабочий пространство» (кнопка дергает `createWorkspace()`).

6) Исключить ранние workspace-запросы до создания
   - Не монтировать провайдеры/префетчеры, требующие workspace-контекст, до получения workspace-токенов.
   - Проверить, что никакие GraphQL запросы с `WorkspaceAuthGuard` не срабатывают до шага 3.

7) Проверить лимиты/конфигурацию
   - На бэкенде действует лимит количества воркспейсов на пользователя (см. `checkUserWorkspaceLimit`). При превышении будет ошибка.
   - На фронте поведение зависит от `isEmailVerificationRequired` и `isMultiWorkspaceEnabled` из client-config.

---

## Варианты конфигурации поведения при 1 воркспейсе

- Глобально создавать новый при `availableWorkspacesCount <= 1`:
  - В `useAuth.ts` в ветке `availableWorkspacesCount === 1` заменить редирект на `createWorkspace({ newTab: false })`.

- Мягкий сценарий с флагом/параметром:
  - Поддержать query‑параметр (например, `?action=create-new`) и при его наличии выполнять `createWorkspace()` даже при одном воркспейсе.

- Явная кнопка на «Добро пожаловать…»:
  - Добавить кнопку «Создать новый рабочий пространство», которая вызывает `createWorkspace()`.

---

## Чек‑лист тестирования

- Регистрация → (при необходимости) верификация e‑mail → автоматическое создание нового воркспейса при 0, редирект на домен воркспейса и обмен `loginToken` на полноценные токены.
- Логин пользователя с 0 воркспейсов → вызов `createWorkspace()` и корректный редирект.
- Логин пользователя с 1 воркспейсом → проверить выбранный вариант поведения (редирект/создание нового/кнопка).
- Логин с >1 воркспейсами → экран выбора.
- DevTools → Network: мутация `signUpInNewWorkspace` отправляется до любых workspace-скоупанных запросов; отсутствие ранних FORBIDDEN.

---

## Типичные проблемы и их решение

- Получаю FORBIDDEN «User does not have access to this workspace» при первом заходе
  - Причина: ранний workspace‑запрос до создания воркспейса. Убедитесь, что сначала вызывается `signUpInNewWorkspace` и нет префетча workspace‑данных.

- Создание не срабатывает при включённой верификации e‑mail
  - Ожидаемо: создание выполняется после верификации (через workspace‑agnostic токены). Проверьте корректность шага `getWorkspaceAgnosticTokenFromEmailVerificationToken` и последующей ветки `countAvailableWorkspaces(...) === 0`.

- Пользователь всегда улетает в единственный воркспейс, а хочется «Создать новый»
  - Измените ветку `availableWorkspacesCount === 1` в `useAuth.ts` на вызов `createWorkspace()` или добавьте флаг/кнопку.


