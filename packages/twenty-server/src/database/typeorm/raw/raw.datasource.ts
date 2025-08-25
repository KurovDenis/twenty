import { config } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

const typeORMRawModuleOptions: DataSourceOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error', 'warn'],
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? {
          rejectUnauthorized: false,
        }
      : false,
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    idleTimeoutMillis: 300000,
    max: 10,
    min: 1,
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

export const rawDataSource = new DataSource(typeORMRawModuleOptions);
