import { type CanActivate, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { type Observable } from 'rxjs';

export class UserAuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    console.log('[USER_AUTH_GUARD] Checking authentication');
    console.log('[USER_AUTH_GUARD] request.user:', request.user);
    console.log('[USER_AUTH_GUARD] request.user exists:', request.user !== undefined);

    return request.user !== undefined;
  }
}
