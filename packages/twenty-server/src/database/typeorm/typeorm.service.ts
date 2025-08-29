import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { DataSource } from 'typeorm';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class TypeORMService implements OnModuleInit, OnModuleDestroy {
  private mainDataSource: DataSource;
  private readonly logger = new Logger(TypeORMService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {
    const isJest = process.argv.some((arg) => arg.includes('jest'));

    this.mainDataSource = new DataSource({
      url: twentyConfigService.get('PG_DATABASE_URL'),
      type: 'postgres',
      logging: twentyConfigService.getLoggingConfig(),
      schema: 'core',
      entities: [
        `${isJest ? '' : 'dist/'}src/engine/core-modules/**/*.entity{.ts,.js}`,
        `${isJest ? '' : 'dist/'}src/engine/metadata-modules/**/*.entity{.ts,.js}`,
      ],
      metadataTableName: '_typeorm_generated_columns_and_materialized_views',
      ssl: twentyConfigService.get('PG_SSL_ALLOW_SELF_SIGNED')
        ? {
            rejectUnauthorized: false,
          }
        : false,
      extra: {
        connectionLimit: 20,
        acquireTimeout: 60000,
        timeout: 60000,
        idleTimeoutMillis: 300000,
        max: 20,
        min: 2,
        connectTimeoutMS: 60000,
        socketTimeoutMS: 60000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
        reconnect: true,
        reconnectTries: 10,
        reconnectInterval: 2000,
        pingInterval: 30000,
        query_timeout: 60000,
        statement_timeout: 60000,
        idle_in_transaction_session_timeout: 300000,
      },
    });
  }

  public getMainDataSource(): DataSource {
    return this.mainDataSource;
  }

  public async createSchema(schemaName: string): Promise<string> {
    const queryRunner = this.mainDataSource.createQueryRunner();

    await queryRunner.createSchema(schemaName, true);

    await queryRunner.release();

    return schemaName;
  }

  public async deleteSchema(schemaName: string) {
    const queryRunner = this.mainDataSource.createQueryRunner();

    await queryRunner.dropSchema(schemaName, true, true);

    await queryRunner.release();
  }

  async onModuleInit() {
    // Init main data source "default" schema with retry logic
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        this.logger.log(
          `Attempting to initialize database connection (attempt ${attempt + 1}/${maxRetries})`,
        );
        await this.mainDataSource.initialize();
        this.logger.log('Database connection established successfully');

        return;
      } catch (error) {
        attempt++;
        this.logger.error(
          `Database connection attempt ${attempt} failed:`,
          error.message,
        );

        if (attempt >= maxRetries) {
          this.logger.error('Max database connection retries exceeded');
          throw error;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);

        this.logger.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    // Destroy main data source "default" schema
    this.logger.log('Destroying main data source');
    await this.mainDataSource.destroy();
  }
}
