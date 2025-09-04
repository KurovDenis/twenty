import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';

import fs from 'fs';

import bytes from 'bytes';
import { useContainer } from 'class-validator';
import session from 'express-session';
import { graphqlUploadExpress } from 'graphql-upload';

import { NodeEnvironment } from 'src/engine/core-modules/twenty-config/interfaces/node-environment.interface';

import { LoggerService } from 'src/engine/core-modules/logger/logger.service';
import { getSessionStorageOptions } from 'src/engine/core-modules/session-storage/session-storage.module-factory';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { UnhandledExceptionFilter } from 'src/filters/unhandled-exception.filter';
import { MiddlewareService } from 'src/engine/middlewares/middleware.service';

import { AppModule } from './app.module';
import './instrument';

import { settings } from './engine/constants/settings';
import { generateFrontConfig } from './utils/generate-front-config';

const bootstrap = async () => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: process.env.LOGGER_IS_BUFFER_ENABLED === 'true',
    rawBody: true,
    snapshot: process.env.NODE_ENV === NodeEnvironment.DEVELOPMENT,
    ...(process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH
      ? {
          httpsOptions: {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH),
          },
        }
      : {}),
  });
  const logger = app.get(LoggerService);
  const twentyConfigService = app.get(TwentyConfigService);

  app.use(session(getSessionStorageOptions(twentyConfigService)));

  // Apply class-validator container so that we can use injection in validators
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Use our logger
  app.useLogger(logger);

  app.useGlobalFilters(new UnhandledExceptionFilter());

  // Global request logging middleware
  app.use((req: any, res: any, next: any) => {
    console.log('=== GLOBAL REQUEST ===');
    console.log('[GLOBAL] URL:', req.url);
    console.log('[GLOBAL] Method:', req.method);
    console.log('[GLOBAL] Path:', req.path);
    console.log('[GLOBAL] Original URL:', req.originalUrl);
    console.log('[GLOBAL] Headers:', Object.keys(req.headers));
    console.log('[GLOBAL] Authorization:', req.headers.authorization);
    console.log('=== GLOBAL REQUEST END ===');
    next();
  });

  // Manual token hydration middleware
  app.use(async (req: any, res: any, next: any) => {
    console.log('=== MANUAL MIDDLEWARE ===');
    console.log('[MANUAL] Processing request for:', req.url);
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    console.log('[MANUAL] Token extracted:', token ? 'YES' : 'NO');
    
    if (token) {
      try {
        // Get the middleware service using the correct token
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

  app.useBodyParser('json', { limit: settings.storage.maxFileSize });
  app.useBodyParser('urlencoded', {
    limit: settings.storage.maxFileSize,
    extended: true,
  });

  // Graphql file upload
  app.use(
    '/graphql',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize),
      maxFiles: 10,
    }),
  );

  app.setGlobalPrefix('api');

  app.use(
    '/metadata',
    graphqlUploadExpress({
      maxFieldSize: bytes(settings.storage.maxFileSize),
      maxFiles: 10,
    }),
  );

  // Inject the server url in the frontend page
  generateFrontConfig();

  await app.listen(twentyConfigService.get('NODE_PORT'));
};

bootstrap();
