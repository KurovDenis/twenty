# Fix for "Forbidden resource" Error During Workspace Creation

## Problem Description

When creating a new user in Twenty CRM, the workspace creation process was failing with a "Forbidden resource" error. The issue was that the `signUpInNewWorkspace` mutation requires authentication (`@UseGuards(UserAuthGuard)`), but the middleware responsible for token processing was not being called.

## Root Cause

The problem was in the middleware configuration:

1. **Wrong paths**: Requests were going to `/metadata`, but middleware was only configured for `/graphql`
2. **Wrong middleware order**: Middleware in `app.module.ts` was applied after other middleware
3. **Incorrect service injection**: Attempting to get `MiddlewareService` by string key instead of class

## Solution

### 1. Fixed Middleware Service Injection

**File**: `packages/twenty-server/src/main.ts`

```typescript
// Added import
import { MiddlewareService } from 'src/engine/middlewares/middleware.service';

// Fixed service injection
const middlewareService = app.get(MiddlewareService); // Instead of app.get('MiddlewareService')
```

### 2. Added Global Token Processing Middleware

**File**: `packages/twenty-server/src/main.ts`

```typescript
// Manual token hydration middleware
app.use(async (req, res, next) => {
  console.log('=== MANUAL MIDDLEWARE ===');
  console.log('[MANUAL] Processing request for:', req.url);
  
  const token = req.headers.authorization?.replace('Bearer ', '');
  console.log('[MANUAL] Token extracted:', token ? 'YES' : 'NO');
  
  if (token) {
    try {
      const middlewareService = app.get(MiddlewareService);
      console.log('[MANUAL] MiddlewareService obtained');
      await middlewareService.hydrateGraphqlRequest(req);
      console.log('[MANUAL] Token hydration completed');
    } catch (error) {
      console.log('[MANUAL] Token hydration error:', error.message);
      console.log('[MANUAL] Error stack:', error.stack);
    }
  }
  
  console.log('[MANUAL] request.user after hydration:', req.user ? 'SET' : 'UNDEFINED');
  console.log('=== MANUAL MIDDLEWARE END ===');
  next();
});
```

### 3. Added Debug Logging

**Files Modified**:
- `packages/twenty-server/src/engine/middlewares/middleware.service.ts`
- `packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts`
- `packages/twenty-server/src/engine/guards/user-auth.guard.ts`
- `packages/twenty-server/src/engine/core-modules/auth/auth.resolver.ts`

## How It Works Now

1. **Token Extraction**: Global middleware extracts JWT tokens from `Authorization` header
2. **Token Validation**: `WorkspaceAgnosticTokenService` validates the token
3. **User Hydration**: `request.user` is set with the authenticated user object
4. **Guard Check**: `UserAuthGuard` passes authentication check
5. **Workspace Creation**: `signUpInNewWorkspace` can execute successfully

## Testing

To test the fix:

1. Start the server: `npx nx run twenty-server:start`
2. Create a new user through the frontend
3. Verify that workspace is created automatically
4. Check server logs for middleware processing

## Files Modified

- `packages/twenty-server/src/main.ts` - Added global middleware and fixed service injection
- `packages/twenty-server/src/engine/middlewares/middleware.service.ts` - Added debug logging
- `packages/twenty-server/src/engine/core-modules/jwt/services/jwt-wrapper.service.ts` - Added debug logging
- `packages/twenty-server/src/engine/guards/user-auth.guard.ts` - Added debug logging
- `packages/twenty-server/src/engine/core-modules/auth/auth.resolver.ts` - Added debug logging

## Notes

- The debug logging can be removed in production
- The global middleware ensures all requests are processed for token hydration
- This fix ensures that new user registration and workspace creation work automatically
