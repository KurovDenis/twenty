import { type TypeOrmModuleOptions } from '@nestjs/typeorm';

import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

const isJest = process.argv.some((arg) => arg.includes('jest'));

export const typeORMCoreModuleOptions: TypeOrmModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error', 'warn'],
  schema: 'core',
  entities:
    process.env.IS_BILLING_ENABLED === 'true'
      ? [
          `${isJest ? '' : 'dist/'}src/engine/core-modules/**/*.entity{.ts,.js}`,
          `${isJest ? '' : 'dist/'}src/engine/metadata-modules/**/*.entity{.ts,.js}`,
        ]
      : [
          `${isJest ? '' : 'dist/'}src/engine/core-modules/**/!(billing-*).entity.{ts,js}`,
          `${isJest ? '' : 'dist/'}src/engine/metadata-modules/**/*.entity{.ts,.js}`,
        ],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  metadataTableName: '_typeorm_generated_columns_and_materialized_views',
  migrations:
    process.env.IS_BILLING_ENABLED === 'true'
      ? [
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/common/*{.ts,.js}`,
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/billing/*{.ts,.js}`,
        ]
      : [
          `${isJest ? '' : 'dist/'}src/database/typeorm/core/migrations/common/*{.ts,.js}`,
        ],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
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
};

export const connectionSource = new DataSource(
  typeORMCoreModuleOptions as DataSourceOptions,
);
