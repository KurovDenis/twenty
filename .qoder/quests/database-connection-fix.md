# Database Connection Fix Design

## Overview

This design addresses critical database connection issues in the Twenty CRM application, specifically the "ECONNRESET" errors that prevent the NestJS TypeORM module from establishing stable connections to the PostgreSQL database. The error manifests as repeated connection failures with socket hang-up errors, ultimately leading to application startup failures.

### Immediate Issue Analysis

The error logs show:
- 9 consecutive connection retry attempts failing
- All attempts result in `ECONNRESET` at TCP level
- TypeORM Module unable to connect to 'core' database
- Process terminates after exhausting retry attempts

This indicates a fundamental connectivity issue between the NestJS application and PostgreSQL, likely caused by Docker container networking, database startup timing, or connection configuration problems.

## Immediate Troubleshooting Steps

### 1. Docker Environment Verification

```bash
# Kill all Node.js processes to prevent port conflicts
taskkill /f /im node.exe

# Verify Docker containers are running
docker ps

# Check PostgreSQL container health
docker logs twenty-db-1

# Test direct database connection
docker exec -it twenty-db-1 psql -U postgres -d default -c "SELECT 1;"
```

### 2. Database Container Reset

```bash
# Stop all containers
docker-compose -f packages/twenty-docker/docker-compose.yml down

# Remove volumes if database is corrupted
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# Restart database services
make setup-twenty

# Wait for database health check to pass
docker-compose -f packages/twenty-docker/docker-compose.yml logs -f db
```

### 3. Network Connectivity Test

```bash
# Test network connectivity from host
telnet localhost 5432

# Test from within Docker network
docker exec -it twenty-server-1 nc -zv db 5432

# Check Docker network configuration
docker network ls
docker network inspect twenty_default
```

## Architecture

### Current Database Architecture

```mermaid
graph TB
    subgraph "Twenty Application"
        A[NestJS Application]
        B[TypeORM Module]
        C[Core DataSource]
        D[Raw DataSource]
        E[PgPoolSharedService]
    end
    
    subgraph "Database Layer"
        F[PostgreSQL 16]
        G[Redis Cache]
    end
    
    A --> B
    B --> C
    B --> D
    B --> E
    C --> F
    D --> F
    E --> F
    A --> G
```

### Problem Areas Identified

1. **Connection Pool Configuration**: Insufficient connection retry mechanisms
2. **SSL/TLS Configuration**: Potential certificate validation issues
3. **Timeout Settings**: Inadequate timeout configurations
4. **Connection String Format**: Potential database URL parsing issues
5. **Docker Network Issues**: Container communication problems

## Database Connection Components

### TypeORM Configuration Analysis

| Component | Location | Purpose | Issues |
|-----------|----------|---------|---------|
| Core DataSource | `src/database/typeorm/core/core.datasource.ts` | Main application database connection | Limited retry logic |
| Raw DataSource | `src/database/typeorm/raw/raw.datasource.ts` | Direct database operations | No connection pooling |
| TypeORM Service | `src/database/typeorm/typeorm.service.ts` | Connection management service | Basic timeout (10s) |
| PgPoolSharedService | `src/engine/twenty-orm/pg-shared-pool/` | Connection pool sharing | Complex but may conflict |

### Current Connection Configuration

```typescript
// Current configuration patterns identified
const typeORMCoreModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error'],
  schema: 'core',
  ssl: process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true' ? {
    rejectUnauthorized: false,
  } : undefined,
  extra: {
    query_timeout: 10000, // Only in TypeORMService
  }
};
```

## Connection Issue Root Causes

### 1. ECONNRESET Error Analysis

**ECONNRESET** errors indicate:
- TCP connection is reset by the server
- Network interruption during connection establishment
- PostgreSQL server rejecting connections due to:
  - Maximum connection limits reached
  - SSL/TLS handshake failures
  - Authentication timeouts
  - Resource constraints

### Common Causes in Twenty Environment

1. **Docker Container Startup Race Condition**
   - Server container starts before database is fully ready
   - Health check passes but PostgreSQL not accepting connections
   - Solution: Enhanced startup dependencies and longer health check periods

2. **Connection String Format Issues**
   - Database name mismatch ('default' vs 'postgres')
   - Docker network hostname resolution problems
   - SSL configuration conflicts

3. **Resource Constraints**
   - Insufficient memory allocation for PostgreSQL
   - Docker container resource limits
   - System-level connection limits exceeded

### 2. Docker Environment Issues

From `docker-compose.yml` analysis:
- PostgreSQL container: `postgres:16`
- Default connection string: `postgres://postgres:postgres@db:5432/default`
- Health check: `pg_isready` with 5s interval, 10 retries
- Server depends on healthy database but no connection retry logic

#### Critical Configuration Problems

1. **Insufficient Health Check Period**
   - Current: 5s interval, 10 retries (50s total)
   - PostgreSQL 16 may need 60-90s for full initialization
   - Recommendation: Increase to 20 retries with 30s start_period

2. **Missing Connection Parameters**
   - No explicit connection timeout in URL
   - No SSL mode specification
   - No connection pool configuration

3. **Docker Network Issues**
   - Container-to-container communication may have latency
   - DNS resolution delays for 'db' hostname
   - Network bridge configuration problems

### 3. Missing Connection Resilience

Current implementation lacks:
- Exponential backoff retry strategy
- Connection pool health monitoring
- Graceful degradation mechanisms
- Comprehensive error handling

## Connection Resilience Strategy

### 1. Enhanced TypeORM Configuration

```mermaid
flowchart TD
    A[Application Start] --> B{Database Available?}
    B -->|No| C[Wait & Retry]
    B -->|Yes| D[Establish Connection]
    C --> E{Max Retries?}
    E -->|No| F[Exponential Backoff]
    E -->|Yes| G[Fail Startup]
    F --> B
    D --> H{Connection Healthy?}
    H -->|No| I[Reconnect]
    H -->|Yes| J[Application Ready]
    I --> B
```

### 2. Connection Pool Enhancement

| Parameter | Current | Recommended | Justification |
|-----------|---------|-------------|---------------|
| Connection Timeout | 10s | 30s | Allow more time for Docker container startup |
| Idle Timeout | Default | 300s (5min) | Prevent idle connection drops |
| Max Connections | Default (10) | 20 | Handle higher concurrent load |
| Retry Attempts | 1 (implicit) | 10 | Robust startup process |
| Retry Delay | None | Exponential (1s-30s) | Avoid overwhelming server |

### 3. SSL/TLS Configuration

```typescript
// Enhanced SSL configuration
ssl: {
  rejectUnauthorized: process.env.NODE_ENV === 'production',
  requestCert: false,
  agent: false,
  // Additional SSL parameters for stability
  secureProtocol: 'TLSv1_2_method',
  ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA'
}
```

## Implementation Architecture

### 1. Database Connection Service

```mermaid
classDiagram
    class DatabaseConnectionService {
        -logger: Logger
        -configService: TwentyConfigService
        -connectionAttempts: number
        -maxRetries: number
        +initialize(): Promise~void~
        +createConnection(): Promise~DataSource~
        -retryConnection(): Promise~DataSource~
        -validateConnection(): Promise~boolean~
        -handleConnectionError(): void
    }
    
    class ConnectionHealthMonitor {
        -healthCheckInterval: NodeJS.Timer
        -connectionStatus: ConnectionStatus
        +startMonitoring(): void
        +stopMonitoring(): void
        +getConnectionHealth(): HealthStatus
    }
    
    class ConnectionPoolManager {
        -pools: Map~string, Pool~
        -poolConfigs: PoolConfig[]
        +getPool(): Pool
        +closeAllPools(): Promise~void~
        +monitorPoolHealth(): void
    }
    
    DatabaseConnectionService --> ConnectionHealthMonitor
    DatabaseConnectionService --> ConnectionPoolManager
```

### 2. Error Recovery Strategy

| Error Type | Recovery Action | Retry Strategy |
|------------|----------------|----------------|
| ECONNRESET | Recreate connection with backoff | Exponential: 1s, 2s, 4s, 8s, 16s, 30s |
| ENOTFOUND | Check DNS/network configuration | Linear: 5s intervals |
| ECONNREFUSED | Wait for database startup | Exponential with longer delays |
| SSL Errors | Retry with adjusted SSL settings | Immediate retry with fallback config |
| Timeout | Increase timeout and retry | Progressive timeout increase |

### 3. Configuration Management

```mermaid
graph LR
    A[Environment Variables] --> B[TwentyConfigService]
    B --> C[Database Configuration]
    C --> D[Connection Factory]
    D --> E[TypeORM DataSource]
    D --> F[Connection Pool]
    
    subgraph "Configuration Hierarchy"
        G[Default Values]
        H[Environment Override]
        I[Runtime Detection]
    end
    
    G --> H
    H --> I
    I --> B
```

## Immediate Fix Implementation

### 1. Emergency Docker Configuration

```yaml
# Enhanced docker-compose.yml for packages/twenty-docker/docker-compose.yml
services:
  db:
    image: postgres:16
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${PG_DATABASE_USER:-postgres}
      POSTGRES_PASSWORD: ${PG_DATABASE_PASSWORD:-postgres}
      POSTGRES_DB: default
      POSTGRES_INITDB_ARGS: "--auth-host=md5"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PG_DATABASE_USER:-postgres} -d default -h localhost"]
      interval: 5s
      timeout: 10s
      retries: 20
      start_period: 60s
    restart: always
    command: [
      "postgres",
      "-c", "max_connections=200",
      "-c", "shared_buffers=256MB",
      "-c", "log_connections=on",
      "-c", "log_disconnections=on"
    ]

  server:
    # ... existing configuration ...
    environment:
      # Enhanced connection string with explicit parameters
      PG_DATABASE_URL: postgres://${PG_DATABASE_USER:-postgres}:${PG_DATABASE_PASSWORD:-postgres}@${PG_DATABASE_HOST:-db}:${PG_DATABASE_PORT:-5432}/default?connect_timeout=30&application_name=twenty_server
      # ... other environment variables ...
    depends_on:
      db:
        condition: service_healthy
        restart: true
    restart: on-failure:3
```

### 2. TypeORM Configuration Patches

```typescript
// Enhanced core.datasource.ts configuration
export const typeORMCoreModuleOptions: TypeOrmModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres',
  logging: ['error', 'warn'],
  schema: 'core',
  entities: [
    // ... existing entities ...
  ],
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  metadataTableName: '_typeorm_generated_columns_and_materialized_views',
  migrations: [
    // ... existing migrations ...
  ],
  ssl: process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true' ? {
    rejectUnauthorized: false,
  } : false,
  extra: {
    connectionLimit: 20,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    reconnectTries: 10,
    reconnectInterval: 2000,
    idleTimeoutMillis: 300000,
    max: 20,
    min: 2,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000,
  },
};
```

### 3. Startup Script Enhancement

```bash
#!/bin/bash
# Enhanced startup script for packages/twenty-docker/twenty/entrypoint.sh

set -e

echo "Starting Twenty server..."

# Wait for database with explicit connection test
echo "Waiting for database connection..."
for i in {1..30}; do
  if pg_isready -h ${PG_DATABASE_HOST:-db} -p ${PG_DATABASE_PORT:-5432} -U ${PG_DATABASE_USER:-postgres} -d default; then
    echo "Database is ready!"
    break
  fi
  echo "Database not ready, waiting... ($i/30)"
  sleep 3
done

# Additional connection test
echo "Testing database connection with psql..."
if ! PGPASSWORD=${PG_DATABASE_PASSWORD:-postgres} psql -h ${PG_DATABASE_HOST:-db} -p ${PG_DATABASE_PORT:-5432} -U ${PG_DATABASE_USER:-postgres} -d default -c "SELECT 1;" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to database after 90 seconds"
  exit 1
fi

echo "Database connection verified, starting application..."
exec "$@"
```

## Enhanced Connection Configuration

### 1. Comprehensive TypeORM Options

```typescript
interface EnhancedDataSourceOptions {
  // Basic connection
  url: string;
  type: 'postgres';
  
  // Connection pooling
  extra: {
    connectionLimit: number;
    acquireTimeout: number;
    timeout: number;
    pingInterval: number;
    reconnect: boolean;
    reconnectDelay: number;
    maxReconnectTries: number;
  };
  
  // SSL configuration
  ssl: SSLConfig | boolean;
  
  // Logging and monitoring
  logging: LogLevel[];
  logger: 'advanced-console' | 'simple-console';
  
  // Connection lifecycle
  synchronize: boolean;
  dropSchema: boolean;
  migrationsRun: boolean;
}
```

### 2. Docker Environment Enhancements

```yaml
# Enhanced healthcheck for PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} -h localhost"]
  interval: 5s
  timeout: 10s
  retries: 20
  start_period: 30s

# Enhanced server startup dependencies
depends_on:
  db:
    condition: service_healthy
    restart: true
```

### 3. Environment Configuration

| Variable | Purpose | Default | Enhanced |
|----------|---------|---------|----------|
| `PG_DATABASE_URL` | Connection string | Required | Add timeout parameters |
| `PG_CONNECTION_TIMEOUT` | Connection timeout | 10000ms | 30000ms |
| `PG_RETRY_ATTEMPTS` | Max connection retries | 9 | 20 |
| `PG_RETRY_DELAY` | Base retry delay | 1000ms | 1000ms |
| `PG_POOL_MAX` | Max pool connections | 10 | 20 |
| `PG_POOL_IDLE_TIMEOUT` | Idle timeout | 30000ms | 300000ms |
| `PG_SSL_MODE` | SSL mode | 'prefer' | 'require' (production) |

## Connection Monitoring & Diagnostics

### 1. Health Check Implementation

```mermaid
sequenceDiagram
    participant App as Application
    participant Monitor as Health Monitor
    participant DB as PostgreSQL
    
    App->>Monitor: Start Health Monitoring
    loop Every 30 seconds
        Monitor->>DB: SELECT 1
        DB-->>Monitor: Response/Timeout
        Monitor->>Monitor: Update Health Status
        alt Connection Unhealthy
            Monitor->>App: Trigger Reconnection
            App->>DB: Establish New Connection
        end
    end
```

### 2. Connection Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Connection Failures | Failed connection attempts | > 5 in 5 minutes |
| Connection Time | Time to establish connection | > 5 seconds |
| Active Connections | Current active connections | > 80% of max |
| Connection Retries | Number of retry attempts | > 10 consecutive |
| Query Timeout Rate | Percentage of timed-out queries | > 5% |

### 3. Logging Strategy

```typescript
interface ConnectionLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  component: string;
  event: 'connection_attempt' | 'connection_success' | 'connection_failure' | 'retry_attempt';
  details: {
    attempt: number;
    duration: number;
    error?: string;
    configuration?: Partial<DataSourceOptions>;
  };
}
```

## Development Environment Setup

### 1. Local Development Quick Fix

```bash
# Kill all Node.js processes (as per memory guidelines)
taskkill /f /im node.exe

# Reset Docker environment
docker-compose -f packages/twenty-docker/docker-compose.yml down -v

# Start database with enhanced configuration
make setup-twenty

# Wait for full database initialization (2-3 minutes)
sleep 180

# Verify database is accessible
docker exec -it twenty-db-1 psql -U postgres -d default -c "\l"

# Start application using standard command
yarn start
```

### 2. Environment Variables Setup

```bash
# Create or update .env file with enhanced database configuration
cat > .env << EOF
PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default?connect_timeout=30&application_name=twenty_dev
PG_DATABASE_HOST=localhost
PG_DATABASE_PORT=5432
PG_DATABASE_USER=postgres
PG_DATABASE_PASSWORD=postgres
PG_SSL_ALLOW_SELF_SIGNED=true
REDIS_URL=redis://localhost:6379
SERVER_URL=http://localhost:3000
APP_SECRET=replace_me_with_a_random_string
EOF
```

### 3. Alternative Local PostgreSQL Setup

If Docker continues to fail, use local PostgreSQL:

```bash
# Install PostgreSQL 16 locally
# Create database
createdb -U postgres default

# Update connection string to use local instance
PG_DATABASE_URL=postgres://postgres:password@localhost:5432/default

# Run migrations
npx nx database:migrate twenty-server

# Start application
yarn start
```

## Testing Strategy

### 1. Connection Resilience Tests

```mermaid
graph TD
    A[Unit Tests] --> B[Connection Factory Tests]
    A --> C[Retry Logic Tests]
    A --> D[Error Handling Tests]
    
    E[Integration Tests] --> F[Docker Environment Tests]
    E --> G[Network Failure Simulation]
    E --> H[Database Restart Tests]
    
    I[E2E Tests] --> J[Application Startup Tests]
    I --> K[Health Check Tests]
    I --> L[Performance Tests]
```

### 2. Test Scenarios

| Test Case | Description | Expected Outcome |
|-----------|-------------|------------------|
| Cold Start | Database not available at startup | Application waits and retries successfully |
| Network Interruption | Temporary network failure | Automatic reconnection without data loss |
| Database Restart | PostgreSQL container restart | Graceful reconnection and recovery |
| SSL Configuration | Various SSL/TLS settings | Secure connection establishment |
| High Load | Multiple concurrent connections | Proper connection pooling behavior |
| Timeout Handling | Query timeout scenarios | Graceful timeout handling and retry |


































































































































































































































































































































