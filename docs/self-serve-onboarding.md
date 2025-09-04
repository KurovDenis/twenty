## Self‑Serve Onboarding (Sign Up → Create Workspace) — Implementation Guide

### Goal
Enable users arriving “from the street” (e.g., ads, base domain) to sign up and immediately create their own workspace without an invite, while avoiding FORBIDDEN errors before they belong to a workspace.

### High‑Level Flow
1) User opens base domain (no workspace subdomain) and clicks Continue with Email → enters email/password.
2) Backend creates a user via `signUp` and returns workspace‑agnostic tokens.
3) Frontend loads `currentUser` using the workspace‑agnostic token, sees availableWorkspacesCount = 0.
4) Frontend calls `signUpInNewWorkspace` to create a new workspace and redirects to it.

This requires:
- Proper server configuration (multi‑workspace, optional email verification behavior).
- Middleware support for workspace‑agnostic tokens so GraphQL queries (e.g., `currentUser`) succeed before joining any workspace.

---

### 1) Backend Configuration

Set these variables for self‑serve:

```env
# Core URLs
SERVER_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001

# Multi-workspace
IS_MULTIWORKSPACE_ENABLED=true
DEFAULT_SUBDOMAIN=app

# Email verification (for seamless UX in dev)
IS_EMAIL_VERIFICATION_REQUIRED=false

# Workspace limits and behavior
MAX_WORKSPACES_PER_USER=1
SINGLE_WORKSPACE_BEHAVIOR=auto-redirect  # or 'create-new' | 'show-choice'
```

Where it’s read in code:
- `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`
- Exposed to front via `ClientConfigService` in `packages/twenty-server/src/engine/core-modules/client-config/services/client-config.service.ts`

Restart the server after changing env to propagate settings to the frontend.

---

### 2) Backend Middleware: Support Workspace‑Agnostic Tokens in GraphQL

Problem: Right after `signUp`, users have only a workspace‑agnostic token. If GraphQL middleware assumes an ACCESS token and tries to attach `workspace` to the request, it can fail and surface errors like “User does not have access to this workspace.”

Solution: In GraphQL middleware, detect workspace‑agnostic tokens, validate with `WorkspaceAgnosticTokenService`, and bind only `user`/`locale` to the request (no `workspace`).

Key file:
- `packages/twenty-server/src/engine/middlewares/middleware.service.ts`

Minimal change sketch (illustrative):

```ts
// Add import
import { WorkspaceAgnosticTokenService } from 'src/engine/core-modules/auth/token/services/workspace-agnostic-token.service';
import { JwtTokenTypeEnum } from 'src/engine/core-modules/auth/types/auth-context.type';

// Inject service in constructor
constructor(
  private readonly accessTokenService: AccessTokenService,
  private readonly workspaceStorageCacheService: WorkspaceCacheStorageService,
  private readonly workspaceMetadataCacheService: WorkspaceMetadataCacheService,
  private readonly dataSourceService: DataSourceService,
  private readonly exceptionHandlerService: ExceptionHandlerService,
  private readonly jwtWrapperService: JwtWrapperService,
  private readonly workspaceAgnosticTokenService: WorkspaceAgnosticTokenService,
) {}

// Helper: bind only user & locale (no workspace)
private bindUserOnlyToRequestObject(
  data: { user: unknown },
  request: Request,
) {
  request.user = data.user as any;
  request.locale =
    (request.headers['x-locale'] as keyof typeof APP_LOCALES) ?? SOURCE_LOCALE;
}

// In hydrateGraphqlRequest:
public async hydrateGraphqlRequest(request: Request) {
  const token = this.jwtWrapperService.extractJwtFromRequest()(request);
  if (!token) {
    request.locale =
      (request.headers['x-locale'] as keyof typeof APP_LOCALES) ?? SOURCE_LOCALE;
    return;
  }

  const decoded = this.jwtWrapperService.decode<{ type?: JwtTokenTypeEnum }>(
    token,
  ) as any;

  if (decoded?.type === JwtTokenTypeEnum.WORKSPACE_AGNOSTIC) {
    const data = await this.workspaceAgnosticTokenService.validateToken(token);
    this.bindUserOnlyToRequestObject({ user: data.user }, request);
    return;
  }

  // ACCESS token path stays as is
  const data = await this.accessTokenService.validateTokenByRequest(request);
  const metadataVersion = data.workspace
    ? await this.workspaceStorageCacheService.getMetadataVersion(
        data.workspace.id,
      )
    : undefined;
  this.bindDataToRequestObject(data, request, metadataVersion);
}
```

With this, `currentUser` and other queries that do not strictly require a workspace will work right after `signUp`.

---

### 3) Frontend Flow (Already Implemented)

Files of interest:
- `packages/twenty-front/src/modules/auth/hooks/useAuth.ts`
- `packages/twenty-front/src/modules/auth/sign-in-up/hooks/useSignInUp.ts`
- `packages/twenty-front/src/modules/auth/sign-in-up/hooks/useSignUpInNewWorkspace.ts`

Behavior:
- After `signUp` (no invite, base domain), `useAuth.handleCredentialsSignUp` stores tokens, loads current user, and inspects `availableWorkspaces`.
- If count is 0 → `createWorkspace()` from `useSignUpInNewWorkspace` is called. That triggers `signUpInNewWorkspace` on the backend and redirects the user to the new workspace (with `loginToken`).
- If email verification is required, the flow first moves user to Email Verification, then (after verification) proceeds similarly.

Optional variant (only if you insist on creating a workspace before email verification):
- In `handleCredentialsSignUp`, remove the early return on Email Verification step and call `createWorkspace()` immediately if availableWorkspacesCount is 0. Use with caution in production due to security/UX considerations.

---

### 4) Testing Checklist (E2E)

- Fresh email on base domain:
  - Sign Up → tokens saved → `currentUser` loads using workspace‑agnostic token → availableWorkspaces=0 → `signUpInNewWorkspace` → redirect to Verify → redirected into the new workspace.
- Invite link flow:
  - Visit invite → `signUpInWorkspace` → `loginToken` → Verify → inside invited workspace.
- Single workspace behavior:
  - With exactly 1 workspace, confirm behavior matches `SINGLE_WORKSPACE_BEHAVIOR` (auto‑redirect, create‑new, or show‑choice).
- Limits:
  - Exceed `MAX_WORKSPACES_PER_USER` → verify SIGNUP_DISABLED error and proper UX.
- Email verification enabled:
  - With `IS_EMAIL_VERIFICATION_REQUIRED=true`, ensure verification path then leads to workspace creation if 0 workspaces.

---

### 5) Troubleshooting

- Error: “User does not have access to this workspace” right after Sign Up
  - Ensure GraphQL middleware supports workspace‑agnostic tokens (section 2).
  - Confirm you are on the base domain (not a workspace subdomain) when signing up.
  - Verify `IS_MULTIWORKSPACE_ENABLED=true` and server restarted.

- Stuck on Email Verification
  - For seamless dev UX, set `IS_EMAIL_VERIFICATION_REQUIRED=false`.
  - If enabled, complete verification first; after that, frontend creates the workspace (0 workspaces case).

---

### 6) Summary of Required Changes

- Configure server: enable multi‑workspace, set URL vars, choose verification & behavior flags.
- Update GraphQL middleware to accept workspace‑agnostic tokens (bind only user, no workspace) before workspace membership exists.
- Frontend already auto‑creates workspace at 0 workspaces; optionally tweak behavior for pre‑verification creation.


