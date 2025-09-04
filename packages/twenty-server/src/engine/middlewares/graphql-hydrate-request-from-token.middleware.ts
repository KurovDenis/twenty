import { Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';

import { MiddlewareService } from 'src/engine/middlewares/middleware.service';

@Injectable()
export class GraphQLHydrateRequestFromTokenMiddleware
  implements NestMiddleware
{
  constructor(private readonly middlewareService: MiddlewareService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    console.log('=== MIDDLEWARE START ===');
    console.log('[MIDDLEWARE] GraphQLHydrateRequestFromTokenMiddleware called');
    console.log('[MIDDLEWARE] Request URL:', req.url);
    console.log('[MIDDLEWARE] Request method:', req.method);
    console.log('[MIDDLEWARE] Request path:', req.path);
    console.log('[MIDDLEWARE] Request originalUrl:', req.originalUrl);
    console.log('=== MIDDLEWARE END ===');
    
    try {
      console.log('[MIDDLEWARE] Calling hydrateGraphqlRequest...');
      await this.middlewareService.hydrateGraphqlRequest(req);
      console.log('[MIDDLEWARE] hydrateGraphqlRequest completed successfully');
    } catch (error) {
      console.log('[MIDDLEWARE] Error in hydrateGraphqlRequest:', error);
      this.middlewareService.writeGraphqlResponseOnExceptionCaught(res, error);

      return;
    }

    console.log('[MIDDLEWARE] Calling next()...');
    next();
  }
}
