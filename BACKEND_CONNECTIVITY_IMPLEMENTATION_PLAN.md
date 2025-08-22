# Twenty Backend Server Connectivity Issue - Implementation Plan

## Overview
This document provides an actionable implementation plan with detailed coding tasks to resolve the backend server connectivity issues where the frontend cannot reach the backend server on `localhost:3000`.

## Critical Issue
- **Problem**: Frontend requests to `/client-config` and `/metadata` endpoints fail with `ERR_CONNECTION_REFUSED`
- **Root Cause**: Backend server not running or not accessible on port 3000
- **Impact**: Complete application failure - frontend cannot initialize

---

## 📋 PHASE 1: Environment Setup and Validation

### 1.1 Infrastructure Dependencies Check
```bash
# Task: Check PostgreSQL status
□ Verify PostgreSQL is running: `netstat -an | findstr :5432`
□ Test connection: `psql -h localhost -p 5432 -U postgres`
□ Create twenty database if missing

# Task: Check Redis status  
□ Verify Redis is running: `netstat -an | findstr :6379`
□ Test connection: `redis-cli ping`
□ Start Redis if not running: `redis-server`

# Task: Port availability check
□ Check if port 3000 is available: `netstat -an | findstr :3000`
□ Kill any processes using port 3000 if needed
□ Verify no conflicts with other services
```

### 1.2 Environment Configuration
```bash
# Task: Backend environment setup
□ Navigate to: `cd packages/twenty-server`
□ Copy environment template: `cp .env.example .env`
□ Configure database connection in .env:
  - PG_DATABASE_URL=postgresql://postgres:password@localhost:5432/twenty
  - REDIS_URL=redis://localhost:6379
□ Set server port: `SERVER_PORT=3000`
□ Configure required secrets and API keys
```

---

## 📋 PHASE 2: Backend Server Implementation

### 2.1 Dependencies and Build Setup
```bash
# Task: Install backend dependencies
□ Run: `cd packages/twenty-server && yarn install`
□ Verify package.json dependencies are current
□ Check for any yarn/npm conflicts
□ Build the application: `yarn build`
```

### 2.2 Core Controllers Implementation

#### ClientConfigController
```typescript
// File: packages/twenty-server/src/modules/client-config/client-config.controller.ts

// Task: Verify/implement ClientConfigController
□ Check controller exists and is properly decorated with @Controller()
□ Implement GET /client-config endpoint:
  - Route: @Get('client-config')
  - Method: getClientConfig()
  - Returns: ClientConfigResponse with auth providers, support URL, etc.
□ Ensure no authentication required (public endpoint)
□ Add proper error handling and logging
□ Test endpoint returns valid JSON response

// Expected response structure:
interface ClientConfigResponse {
  authProviders: {
    google: boolean;
    password: boolean;
    // other providers
  };
  supportUrl?: string;
  signInPrefilled: boolean;
  signUpDisabled: boolean;
  debugMode: boolean;
  analyticsEnabled: boolean;
  captcha: {
    provider?: string;
    siteKey?: string;
  };
}
```

#### GraphQL Metadata Endpoint
```typescript
// File: packages/twenty-server/src/modules/core-graphql/core-graphql.module.ts

// Task: Verify GraphQL metadata endpoint
□ Check GraphQL module is properly configured
□ Verify /metadata endpoint is accessible
□ Implement proper CORS headers for GraphQL
□ Test introspection queries work
□ Ensure authentication middleware is correctly applied
```

### 2.3 Server Bootstrap Configuration
```typescript
// File: packages/twenty-server/src/main.ts

// Task: Configure NestJS application bootstrap
□ Verify server listens on correct port (3000)
□ Configure CORS middleware:
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });
□ Add body parser middleware
□ Configure session middleware
□ Add GraphQL upload middleware
□ Set global prefix if needed: app.setGlobalPrefix('api')
```

### 2.4 Health Check Implementation
```typescript
// File: packages/twenty-server/src/modules/health/health.controller.ts

// Task: Implement health check endpoint
□ Create HealthController with @Get('healthz') endpoint
□ Return simple OK response: { status: 'ok', timestamp: new Date() }
□ Add database connectivity check
□ Add Redis connectivity check
□ Implement graceful shutdown handling
```

### 2.5 Middleware Stack Configuration
```typescript
// Task: Configure essential middleware
□ Session middleware for authentication
□ CORS middleware for cross-origin requests
□ Body parser for JSON/form data
□ Request logging middleware
□ Error handling middleware
□ Security headers middleware
```

---

## 📋 PHASE 3: Frontend Configuration

### 3.1 Environment Variable Setup
```bash
# File: packages/twenty-front/.env

# Task: Configure frontend environment
□ Create/update .env file:
  REACT_APP_SERVER_BASE_URL=http://localhost:3000
□ Verify environment variable loading in build process
□ Check if variables are available at runtime
```

### 3.2 Server URL Resolution Logic
```typescript
// File: packages/twenty-front/src/utils/getServerUrl.ts

// Task: Implement/verify server URL resolution
□ Check getDefaultUrl() function implementation:
  - Development: return 'http://localhost:3000'
  - Production: return window.location.origin
□ Verify environment variable precedence:
  1. window._env_.REACT_APP_SERVER_BASE_URL
  2. process.env.REACT_APP_SERVER_BASE_URL  
  3. getDefaultUrl()
□ Add validation for malformed URLs
□ Log resolved server URL for debugging
```

### 3.3 Client Configuration Service
```typescript
// File: packages/twenty-front/src/modules/client-config/

// Task: Implement robust client config fetching
□ Create/verify useClientConfig hook
□ Implement error handling for network failures
□ Add retry logic with exponential backoff
□ Cache configuration data in localStorage
□ Handle server unavailability gracefully
□ Display appropriate error messages to users
```

### 3.4 Apollo GraphQL Client Configuration
```typescript
// File: packages/twenty-front/src/modules/apollo/

// Task: Configure GraphQL client for backend connectivity
□ Set correct GraphQL endpoint: http://localhost:3000/graphql
□ Set metadata endpoint: http://localhost:3000/metadata
□ Configure error handling for connection failures
□ Add authentication headers when available
□ Implement retry policies for failed requests
```

---

## 📋 PHASE 4: Service Integration Testing

### 4.1 Backend Server Startup
```bash
# Task: Start and verify backend server
□ Navigate to: `cd packages/twenty-server`
□ Start development server: `yarn start:dev`
□ Verify server starts without errors
□ Check server logs for successful database connection
□ Confirm server is listening on port 3000
```

### 4.2 API Endpoint Testing
```bash
# Task: Test critical endpoints
□ Health check: `curl http://localhost:3000/healthz`
  Expected: 200 OK with JSON response
  
□ Client config: `curl http://localhost:3000/client-config`
  Expected: 200 OK with client configuration JSON
  
□ GraphQL metadata: `curl -X POST http://localhost:3000/metadata -H "Content-Type: application/json" -d "{}"`
  Expected: 200 OK or proper GraphQL response
  
□ GraphQL endpoint: `curl -X POST http://localhost:3000/graphql -H "Content-Type: application/json" -d '{"query":"{__schema{types{name}}}"}'`
  Expected: 200 OK with schema information
```

### 4.3 Frontend Integration Testing
```bash
# Task: Start frontend and test connectivity
□ Navigate to: `cd packages/twenty-front`
□ Install dependencies: `yarn install`
□ Start development server: `yarn start`
□ Verify frontend starts on port 3001
□ Check browser console for connection errors
□ Verify client config loads successfully
□ Test GraphQL queries work
```

### 4.4 Cross-Service Communication
```bash
# Task: Verify end-to-end connectivity
□ Frontend successfully fetches /client-config
□ GraphQL introspection queries work
□ Authentication flow completes
□ No CORS errors in browser console
□ All API requests return expected responses
```

---

## 📋 PHASE 5: Error Handling & Monitoring

### 5.1 Frontend Error Handling
```typescript
// Task: Implement robust error handling
□ Add try-catch blocks around all API calls
□ Implement exponential backoff retry logic
□ Display user-friendly error messages
□ Log errors for debugging
□ Provide fallback UI when server is unavailable
□ Cache client config to survive temporary outages
```

### 5.2 Backend Error Handling
```typescript
// Task: Add comprehensive error handling
□ Global exception filter for unhandled errors
□ Proper HTTP status codes for different error types
□ Structured error responses with correlation IDs
□ Request/response logging middleware
□ Health check failure notifications
□ Graceful shutdown handling
```

### 5.3 Monitoring and Logging
```typescript
// Task: Implement monitoring
□ Add request/response logging
□ Monitor database connection health
□ Track API endpoint response times
□ Log connection failures with context
□ Implement health check monitoring
□ Add performance metrics collection
```

---

## 📋 PHASE 6: Docker Environment Support

### 6.1 Docker Compose Configuration
```yaml
# File: packages/twenty-docker/docker-compose.yml

# Task: Verify Docker environment
□ Check service definitions for server and frontend
□ Verify port mappings: server:3000, frontend:3001
□ Confirm environment variable configuration
□ Check service dependencies and startup order
□ Verify network configuration between services
```

### 6.2 Docker Environment Testing
```bash
# Task: Test Docker deployment
□ Build images: `docker-compose build`
□ Start services: `docker-compose up -d`
□ Check service health: `docker-compose ps`
□ View logs: `docker-compose logs server`
□ Test connectivity between containers
□ Verify port mapping from host to containers
```

---

## 📋 PHASE 7: Documentation & Validation

### 7.1 Troubleshooting Documentation
```markdown
# Task: Create troubleshooting guide
□ Document common connectivity issues
□ Provide step-by-step resolution steps
□ Include diagnostic commands
□ Add environment-specific solutions
□ Create troubleshooting flowchart
□ Document Docker-specific issues
```

### 7.2 Final Validation
```bash
# Task: Comprehensive testing
□ Test local development environment
□ Test Docker environment
□ Verify all API endpoints respond correctly
□ Test frontend-backend integration
□ Validate error handling scenarios
□ Perform load testing for basic scenarios
□ Document any remaining known issues
```

---

## Implementation Priority Matrix

| Priority | Phase | Estimated Time | Dependencies |
|----------|-------|----------------|--------------|
| 🔴 Critical | Phase 1 | 30 min | None |
| 🔴 Critical | Phase 2 | 2-3 hours | Phase 1 |
| 🟡 High | Phase 3 | 1-2 hours | Phase 2 |
| 🟡 High | Phase 4 | 1 hour | Phase 2,3 |
| 🟢 Medium | Phase 5 | 2-3 hours | Phase 4 |
| 🟢 Medium | Phase 6 | 1-2 hours | Phase 4 |
| 🔵 Low | Phase 7 | 1-2 hours | All phases |

## Success Criteria

### ✅ Primary Goals
- [ ] Backend server starts successfully on port 3000
- [ ] Frontend can access `/client-config` endpoint
- [ ] GraphQL `/metadata` endpoint responds correctly
- [ ] No `ERR_CONNECTION_REFUSED` errors
- [ ] Complete application initialization works

### ✅ Secondary Goals  
- [ ] Robust error handling for connectivity issues
- [ ] Docker environment works correctly
- [ ] Comprehensive monitoring and logging
- [ ] Troubleshooting documentation complete
- [ ] Performance meets baseline requirements

## Emergency Rollback Plan

If implementation fails:
1. Revert to last known working configuration
2. Use Docker environment as fallback
3. Check service dependencies are running
4. Verify environment configuration
5. Review server startup logs for errors

---

## Next Steps

1. **Start with Phase 1** - Environment validation is critical
2. **Focus on Phase 2** - Backend server must be running first  
3. **Test incrementally** - Validate each phase before proceeding
4. **Document issues** - Record any problems encountered
5. **Verify end-to-end** - Complete integration testing

**Note**: This implementation plan provides the foundation for resolving the backend connectivity issues. Each task should be completed and verified before proceeding to the next phase.