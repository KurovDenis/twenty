# Environment Variable Configuration Design

## Overview

This design addresses the critical issue where environment variables, specifically `IS_MULTIWORKSPACE_ENABLED`, are not being properly applied to the running Twenty server. The root problem is that Node.js processes retain their initial environment configuration and don't automatically reload environment variables when they're changed during runtime.

## Problem Analysis

### Core Issue
The Twenty server's `IS_MULTIWORKSPACE_ENABLED` configuration remains `false` despite attempts to set it to `true` through PowerShell environment variables. This causes cascading effects throughout the application:

- **Frontend Behavior**: Operates in single-workspace mode
- **Authentication Flow**: Skips workspace creation logic
- **API Middleware**: Expects users to have existing workspaces
- **User Experience**: Incorrect routing to welcome page

### Root Causes

1. **Runtime Environment Persistence**: Node.js processes capture environment variables at startup and don't reload them
2. **Missing Environment Configuration**: No `.env` file exists in `packages/twenty-server/`
3. **Configuration Loading Order**: Environment variables must be set before server startup
4. **Cache Invalidation**: Server may be using cached configuration values

## Architecture

### Environment Variable Loading Flow

```mermaid
flowchart TD
    A[Process Start] --> B{.env file exists?}
    B -->|Yes| C[Load .env variables]
    B -->|No| D[Use system environment]
    C --> E[Parse config-variables.ts]
    D --> E
    E --> F[Initialize TwentyConfigService]
    F --> G[Cache configuration values]
    G --> H[Start server with config]
    
    I[Runtime env change] --> J[Server already running]
    J --> K[No effect - requires restart]
```

### Configuration Architecture

```mermaid
classDiagram
    class ConfigVariables {
        +IS_MULTIWORKSPACE_ENABLED: boolean
        +SINGLE_WORKSPACE_BEHAVIOR: string
        +MAX_WORKSPACES_PER_USER: number
    }
    
    class TwentyConfigService {
        +get(key: string): any
        -configValues: ConfigVariables
    }
    
    class ClientConfigService {
        +getClientConfig(): ClientConfig
        -twentyConfigService: TwentyConfigService
    }
    
    class DomainManagerService {
        +validateDomain(): boolean
        -twentyConfigService: TwentyConfigService
    }
    
    ConfigVariables --> TwentyConfigService
    TwentyConfigService --> ClientConfigService
    TwentyConfigService --> DomainManagerService
```

## Configuration Management Strategy

### Environment File Structure

The server uses a hierarchical configuration loading system:

1. **System Environment Variables** (highest priority)
2. **`.env` file in packages/twenty-server/**
3. **Default values from config-variables.ts**

### Multi-Workspace Configuration Schema

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IS_MULTIWORKSPACE_ENABLED` | boolean | false | Enable multi-workspace support |
| `MAX_WORKSPACES_PER_USER` | number | 5 | Maximum workspaces per user |
| `SINGLE_WORKSPACE_BEHAVIOR` | enum | 'auto-redirect' | Behavior for single workspace users |

### Configuration Validation

```mermaid
sequenceDiagram
    participant App as Application Startup
    participant Validator as Config Validator
    participant Service as TwentyConfigService
    participant Client as ClientConfigService
    
    App->>Validator: Load environment variables
    Validator->>Validator: Validate IS_MULTIWORKSPACE_ENABLED
    Validator->>Validator: Check dependencies
    Validator->>Service: Initialize with validated config
    Service->>Client: Provide configuration values
    Client->>App: Return client configuration
```

## Implementation Requirements

### Environment File Management

#### Required .env File Structure
```bash
# Core Configuration
NODE_ENV=development
IS_MULTIWORKSPACE_ENABLED=true
SINGLE_WORKSPACE_BEHAVIOR=auto-redirect
MAX_WORKSPACES_PER_USER=5

# Database Configuration
PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default
REDIS_URL=redis://localhost:6379

# Security
APP_SECRET=replace_me_with_a_random_string

# Frontend Integration
FRONTEND_URL=http://localhost:3001
SIGN_IN_PREFILLED=true
```

#### Environment Variable Precedence
1. **Runtime System Variables** (via PowerShell/bash export)
2. **`.env` file variables**
3. **Default configuration values**

### Server Restart Protocol

#### Process Management Flow
```mermaid
flowchart TD
    A[Stop Current Processes] --> B[Verify .env Configuration]
    B --> C[Clear Node.js Cache]
    C --> D[Restart Server]
    D --> E[Validate Configuration]
    E --> F{Config Correct?}
    F -->|Yes| G[Continue Operation]
    F -->|No| H[Debug Configuration]
    H --> A
```

#### Restart Commands Sequence
1. **Stop all Node.js processes**
2. **Verify environment configuration**
3. **Clear any cached configurations**
4. **Restart with proper environment**

### Configuration Validation System

#### Runtime Configuration Check
The client configuration service exposes the current state via `/clientConfig` endpoint:

```typescript
interface ClientConfig {
  isMultiWorkspaceEnabled: boolean;
  singleWorkspaceBehavior: 'auto-redirect' | 'create-new' | 'show-choice';
  // ... other configuration
}
```

#### Validation Points
1. **Server Startup**: Validate configuration loading
2. **Client Initialization**: Verify configuration consistency
3. **Runtime Checks**: Monitor configuration state
4. **Development Tools**: Browser console validation

## Configuration Dependencies

### Dependent Services Architecture

```mermaid
graph TD
    A[IS_MULTIWORKSPACE_ENABLED] --> B[AuthSSOService]
    A --> C[SignInUpService]
    A --> D[DomainManagerService]
    A --> E[ClientConfigService]
    
    B --> F[SSO Authentication Flow]
    C --> G[Workspace Creation Logic]
    D --> H[Domain Validation]
    E --> I[Frontend Configuration]
    
    J[Frontend State] --> K[useAuth Hook]
    K --> L[Workspace Selection]
    K --> M[User Routing]
```

### Impact Analysis

#### When IS_MULTIWORKSPACE_ENABLED = true
- **Auth Flow**: Enables workspace-agnostic tokens
- **User Registration**: Allows users without initial workspace
- **Domain Management**: Supports subdomain-based workspaces
- **Frontend Logic**: Activates workspace creation/selection UI

#### When IS_MULTIWORKSPACE_ENABLED = false
- **Auth Flow**: Requires immediate workspace assignment
- **User Registration**: Must create workspace during signup
- **Domain Management**: Single-tenant mode
- **Frontend Logic**: Direct workspace access

## Testing Strategy

### Configuration Testing Matrix

| Test Case | Environment Setup | Expected Behavior |
|-----------|------------------|-------------------|
| Multi-workspace enabled | `IS_MULTIWORKSPACE_ENABLED=true` | Workspace selection UI |
| Single-workspace mode | `IS_MULTIWORKSPACE_ENABLED=false` | Direct workspace access |
| Missing configuration | No .env file | Default to false |
| Invalid configuration | Invalid boolean value | Validation error |

### Validation Testing

#### Server Configuration Test
```typescript
// Test configuration loading
describe('Environment Configuration', () => {
  it('should load IS_MULTIWORKSPACE_ENABLED correctly', () => {
    expect(configService.get('IS_MULTIWORKSPACE_ENABLED')).toBe(true);
  });
  
  it('should reflect in client configuration', () => {
    const clientConfig = clientConfigService.getClientConfig();
    expect(clientConfig.isMultiWorkspaceEnabled).toBe(true);
  });
});
```

#### Browser Validation
```javascript
// Console validation command
console.log('Multi-workspace enabled:', 
  window.__client_config?.isMultiWorkspaceEnabled);
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Environment Variable Not Applied
**Symptoms**: `isMultiWorkspaceEnabled: false` in browser console
**Solution**: 
1. Verify .env file exists and contains correct values
2. Restart all Node.js processes
3. Check browser console for updated configuration

#### Issue: Server Caching Old Configuration
**Symptoms**: Configuration changes don't take effect
**Solution**:
1. Stop all Node.js processes completely
2. Clear any pm2 or nodemon cached processes
3. Restart server with fresh environment

#### Issue: PowerShell Environment Variables Not Persisting
**Symptoms**: Variables reset after session
**Solution**:
1. Use .env file instead of session variables
2. Set system-level environment variables
3. Verify variable persistence across sessions

### Diagnostic Commands

#### Environment Verification
```bash
# Check current environment variables
echo $IS_MULTIWORKSPACE_ENABLED  # Linux/Mac
echo %IS_MULTIWORKSPACE_ENABLED%  # Windows CMD
$env:IS_MULTIWORKSPACE_ENABLED    # PowerShell

# Verify .env file
cat packages/twenty-server/.env

# Check running processes
ps aux | grep node  # Linux/Mac
tasklist | findstr node  # Windows
```

#### Configuration Debugging
```bash
# Server startup with environment debug
NODE_ENV=development DEBUG=* npx nx serve twenty-server

# Validate client configuration
curl http://localhost:3000/clientConfig | jq '.isMultiWorkspaceEnabled'
```

## Development Workflow

### Local Development Setup

#### Initial Configuration
1. **Copy environment template**
   ```bash
   cp packages/twenty-server/.env.example packages/twenty-server/.env
   ```

2. **Enable multi-workspace mode**
   ```bash
   echo "IS_MULTIWORKSPACE_ENABLED=true" >> packages/twenty-server/.env
   ```

3. **Restart development server**
   ```bash
   npx nx serve twenty-server
   ```

#### Configuration Validation Workflow
```mermaid
sequenceDiagram
    participant Dev as Developer
    participant File as .env File
    participant Server as Twenty Server
    participant Browser as Browser Console
    
    Dev->>File: Update IS_MULTIWORKSPACE_ENABLED=true
    Dev->>Server: Restart server
    Server->>Server: Load configuration
    Server->>Browser: Serve client config
    Browser->>Dev: Display isMultiWorkspaceEnabled: true
```

### Production Deployment

#### Environment Configuration
1. **Set system environment variables**
2. **Verify configuration persistence**
3. **Test server restart behavior**
4. **Monitor configuration state**

#### Configuration Management
- **Infrastructure as Code**: Environment variables in deployment scripts
- **Configuration Validation**: Automated checks during deployment
- **Rollback Strategy**: Quick configuration reversion capability

## Performance Considerations

### Configuration Loading Performance
- **Startup Time**: Environment variable parsing adds minimal overhead
- **Runtime Access**: Configuration values are cached for performance
- **Memory Usage**: Configuration objects are lightweight

### Caching Strategy
- **Configuration Cache**: Values cached at service initialization
- **Cache Invalidation**: Requires server restart for changes
- **Memory Efficiency**: Single configuration instance per service

## Security Implications

### Environment Variable Security
- **Sensitive Data**: Keep database URLs and secrets secure
- **Access Control**: Limit environment variable access
- **Audit Trail**: Log configuration changes

### Multi-Workspace Security
- **Workspace Isolation**: Ensure proper tenant separation
- **Authentication**: Workspace-specific token validation
- **Authorization**: Role-based access within workspaces
## Overview

This design addresses the critical issue where environment variables, specifically `IS_MULTIWORKSPACE_ENABLED`, are not being properly applied to the running Twenty server. The root problem is that Node.js processes retain their initial environment configuration and don't automatically reload environment variables when they're changed during runtime.

## Problem Analysis

### Core Issue
The Twenty server's `IS_MULTIWORKSPACE_ENABLED` configuration remains `false` despite attempts to set it to `true` through PowerShell environment variables. This causes cascading effects throughout the application:

- **Frontend Behavior**: Operates in single-workspace mode
- **Authentication Flow**: Skips workspace creation logic
- **API Middleware**: Expects users to have existing workspaces
- **User Experience**: Incorrect routing to welcome page

### Root Causes

1. **Runtime Environment Persistence**: Node.js processes capture environment variables at startup and don't reload them
2. **Missing Environment Configuration**: No `.env` file exists in `packages/twenty-server/`
3. **Configuration Loading Order**: Environment variables must be set before server startup
4. **Cache Invalidation**: Server may be using cached configuration values

## Architecture

### Environment Variable Loading Flow

```mermaid
flowchart TD
    A[Process Start] --> B{.env file exists?}
    B -->|Yes| C[Load .env variables]
    B -->|No| D[Use system environment]
    C --> E[Parse config-variables.ts]
    D --> E
    E --> F[Initialize TwentyConfigService]
    F --> G[Cache configuration values]
    G --> H[Start server with config]
    
    I[Runtime env change] --> J[Server already running]
    J --> K[No effect - requires restart]
```

### Configuration Architecture

```mermaid
classDiagram
    class ConfigVariables {
        +IS_MULTIWORKSPACE_ENABLED: boolean
        +SINGLE_WORKSPACE_BEHAVIOR: string
        +MAX_WORKSPACES_PER_USER: number
    }
    
    class TwentyConfigService {
        +get(key: string): any
        -configValues: ConfigVariables
    }
    
    class ClientConfigService {
        +getClientConfig(): ClientConfig
        -twentyConfigService: TwentyConfigService
    }
    
    class DomainManagerService {
        +validateDomain(): boolean
        -twentyConfigService: TwentyConfigService
    }
    
    ConfigVariables --> TwentyConfigService
    TwentyConfigService --> ClientConfigService
    TwentyConfigService --> DomainManagerService
```

## Configuration Management Strategy

### Environment File Structure

The server uses a hierarchical configuration loading system:

1. **System Environment Variables** (highest priority)
2. **`.env` file in packages/twenty-server/**
3. **Default values from config-variables.ts**

### Multi-Workspace Configuration Schema

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IS_MULTIWORKSPACE_ENABLED` | boolean | false | Enable multi-workspace support |
| `MAX_WORKSPACES_PER_USER` | number | 5 | Maximum workspaces per user |
| `SINGLE_WORKSPACE_BEHAVIOR` | enum | 'auto-redirect' | Behavior for single workspace users |

### Configuration Validation

```mermaid
sequenceDiagram
    participant App as Application Startup
    participant Validator as Config Validator
    participant Service as TwentyConfigService
    participant Client as ClientConfigService
    
    App->>Validator: Load environment variables
    Validator->>Validator: Validate IS_MULTIWORKSPACE_ENABLED
    Validator->>Validator: Check dependencies
    Validator->>Service: Initialize with validated config
    Service->>Client: Provide configuration values
    Client->>App: Return client configuration
```

## Implementation Requirements

### Environment File Management

#### Required .env File Structure
```bash
# Core Configuration
NODE_ENV=development
IS_MULTIWORKSPACE_ENABLED=true
SINGLE_WORKSPACE_BEHAVIOR=auto-redirect
MAX_WORKSPACES_PER_USER=5

# Database Configuration
PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default
REDIS_URL=redis://localhost:6379

# Security
APP_SECRET=replace_me_with_a_random_string

# Frontend Integration
FRONTEND_URL=http://localhost:3001
SIGN_IN_PREFILLED=true
```

#### Environment Variable Precedence
1. **Runtime System Variables** (via PowerShell/bash export)
2. **`.env` file variables**
3. **Default configuration values**

### Server Restart Protocol

#### Process Management Flow
```mermaid
flowchart TD
    A[Stop Current Processes] --> B[Verify .env Configuration]
    B --> C[Clear Node.js Cache]
    C --> D[Restart Server]
    D --> E[Validate Configuration]
    E --> F{Config Correct?}
    F -->|Yes| G[Continue Operation]
    F -->|No| H[Debug Configuration]
    H --> A
```

#### Restart Commands Sequence
1. **Stop all Node.js processes**
2. **Verify environment configuration**
3. **Clear any cached configurations**
4. **Restart with proper environment**

### Configuration Validation System

#### Runtime Configuration Check
The client configuration service exposes the current state via `/clientConfig` endpoint:

```typescript
interface ClientConfig {
  isMultiWorkspaceEnabled: boolean;
  singleWorkspaceBehavior: 'auto-redirect' | 'create-new' | 'show-choice';
  // ... other configuration
}
```

#### Validation Points
1. **Server Startup**: Validate configuration loading
2. **Client Initialization**: Verify configuration consistency
3. **Runtime Checks**: Monitor configuration state
4. **Development Tools**: Browser console validation

## Configuration Dependencies

### Dependent Services Architecture

```mermaid
graph TD
    A[IS_MULTIWORKSPACE_ENABLED] --> B[AuthSSOService]
    A --> C[SignInUpService]
    A --> D[DomainManagerService]
    A --> E[ClientConfigService]
    
    B --> F[SSO Authentication Flow]
    C --> G[Workspace Creation Logic]
    D --> H[Domain Validation]
    E --> I[Frontend Configuration]
    
    J[Frontend State] --> K[useAuth Hook]
    K --> L[Workspace Selection]
    K --> M[User Routing]
```

### Impact Analysis

#### When IS_MULTIWORKSPACE_ENABLED = true
- **Auth Flow**: Enables workspace-agnostic tokens
- **User Registration**: Allows users without initial workspace
- **Domain Management**: Supports subdomain-based workspaces
- **Frontend Logic**: Activates workspace creation/selection UI

#### When IS_MULTIWORKSPACE_ENABLED = false
- **Auth Flow**: Requires immediate workspace assignment
- **User Registration**: Must create workspace during signup
- **Domain Management**: Single-tenant mode
- **Frontend Logic**: Direct workspace access

## Testing Strategy

### Configuration Testing Matrix

| Test Case | Environment Setup | Expected Behavior |
|-----------|------------------|-------------------|
| Multi-workspace enabled | `IS_MULTIWORKSPACE_ENABLED=true` | Workspace selection UI |
| Single-workspace mode | `IS_MULTIWORKSPACE_ENABLED=false` | Direct workspace access |
| Missing configuration | No .env file | Default to false |
| Invalid configuration | Invalid boolean value | Validation error |

### Validation Testing

#### Server Configuration Test
```typescript
// Test configuration loading
describe('Environment Configuration', () => {
  it('should load IS_MULTIWORKSPACE_ENABLED correctly', () => {
    expect(configService.get('IS_MULTIWORKSPACE_ENABLED')).toBe(true);
  });
  
  it('should reflect in client configuration', () => {
    const clientConfig = clientConfigService.getClientConfig();
    expect(clientConfig.isMultiWorkspaceEnabled).toBe(true);
  });
});
```

#### Browser Validation
```javascript
// Console validation command
console.log('Multi-workspace enabled:', 
  window.__client_config?.isMultiWorkspaceEnabled);
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Environment Variable Not Applied
**Symptoms**: `isMultiWorkspaceEnabled: false` in browser console
**Solution**: 
1. Verify .env file exists and contains correct values
2. Restart all Node.js processes
3. Check browser console for updated configuration

#### Issue: Server Caching Old Configuration
**Symptoms**: Configuration changes don't take effect
**Solution**:
1. Stop all Node.js processes completely
2. Clear any pm2 or nodemon cached processes
3. Restart server with fresh environment

#### Issue: PowerShell Environment Variables Not Persisting
**Symptoms**: Variables reset after session
**Solution**:
1. Use .env file instead of session variables
2. Set system-level environment variables
3. Verify variable persistence across sessions

### Diagnostic Commands

#### Environment Verification
```bash
# Check current environment variables
echo $IS_MULTIWORKSPACE_ENABLED  # Linux/Mac
echo %IS_MULTIWORKSPACE_ENABLED%  # Windows CMD
$env:IS_MULTIWORKSPACE_ENABLED    # PowerShell

# Verify .env file
cat packages/twenty-server/.env

# Check running processes
ps aux | grep node  # Linux/Mac
tasklist | findstr node  # Windows
```

#### Configuration Debugging
```bash
# Server startup with environment debug
NODE_ENV=development DEBUG=* npx nx serve twenty-server

# Validate client configuration
curl http://localhost:3000/clientConfig | jq '.isMultiWorkspaceEnabled'
```

## Development Workflow

### Local Development Setup

#### Initial Configuration
1. **Copy environment template**
   ```bash
   cp packages/twenty-server/.env.example packages/twenty-server/.env
   ```

2. **Enable multi-workspace mode**
   ```bash
   echo "IS_MULTIWORKSPACE_ENABLED=true" >> packages/twenty-server/.env
   ```

3. **Restart development server**
   ```bash
   npx nx serve twenty-server
   ```

#### Configuration Validation Workflow
```mermaid
sequenceDiagram
    participant Dev as Developer
    participant File as .env File
    participant Server as Twenty Server
    participant Browser as Browser Console
    
    Dev->>File: Update IS_MULTIWORKSPACE_ENABLED=true
    Dev->>Server: Restart server
    Server->>Server: Load configuration
    Server->>Browser: Serve client config
    Browser->>Dev: Display isMultiWorkspaceEnabled: true
```

### Production Deployment

#### Environment Configuration
1. **Set system environment variables**
2. **Verify configuration persistence**
3. **Test server restart behavior**
4. **Monitor configuration state**

#### Configuration Management
- **Infrastructure as Code**: Environment variables in deployment scripts
- **Configuration Validation**: Automated checks during deployment
- **Rollback Strategy**: Quick configuration reversion capability

## Performance Considerations

### Configuration Loading Performance
- **Startup Time**: Environment variable parsing adds minimal overhead
- **Runtime Access**: Configuration values are cached for performance
- **Memory Usage**: Configuration objects are lightweight

### Caching Strategy
- **Configuration Cache**: Values cached at service initialization
- **Cache Invalidation**: Requires server restart for changes
- **Memory Efficiency**: Single configuration instance per service

## Security Implications

### Environment Variable Security
- **Sensitive Data**: Keep database URLs and secrets secure
- **Access Control**: Limit environment variable access
- **Audit Trail**: Log configuration changes

### Multi-Workspace Security
- **Workspace Isolation**: Ensure proper tenant separation
- **Authentication**: Workspace-specific token validation
- **Authorization**: Role-based access within workspaces














































































































































































































































































































































































# Environment Variable Configuration Design

## Overview

This design addresses the critical issue where environment variables, specifically `IS_MULTIWORKSPACE_ENABLED`, are not being properly applied to the running Twenty server. The root problem is that Node.js processes retain their initial environment configuration and don't automatically reload environment variables when they're changed during runtime.

## Problem Analysis

### Core Issue
The Twenty server's `IS_MULTIWORKSPACE_ENABLED` configuration remains `false` despite attempts to set it to `true` through PowerShell environment variables. This causes cascading effects throughout the application:

- **Frontend Behavior**: Operates in single-workspace mode
- **Authentication Flow**: Skips workspace creation logic
- **API Middleware**: Expects users to have existing workspaces
- **User Experience**: Incorrect routing to welcome page

### Root Causes

1. **Runtime Environment Persistence**: Node.js processes capture environment variables at startup and don't reload them
2. **Missing Environment Configuration**: No `.env` file exists in `packages/twenty-server/`
3. **Configuration Loading Order**: Environment variables must be set before server startup
4. **Cache Invalidation**: Server may be using cached configuration values

## Architecture

### Environment Variable Loading Flow

```mermaid
flowchart TD
    A[Process Start] --> B{.env file exists?}
    B -->|Yes| C[Load .env variables]
    B -->|No| D[Use system environment]
    C --> E[Parse config-variables.ts]
    D --> E
    E --> F[Initialize TwentyConfigService]
    F --> G[Cache configuration values]
    G --> H[Start server with config]
    
    I[Runtime env change] --> J[Server already running]
    J --> K[No effect - requires restart]
```

### Configuration Architecture

```mermaid
classDiagram
    class ConfigVariables {
        +IS_MULTIWORKSPACE_ENABLED: boolean
        +SINGLE_WORKSPACE_BEHAVIOR: string
        +MAX_WORKSPACES_PER_USER: number
    }
    
    class TwentyConfigService {
        +get(key: string): any
        -configValues: ConfigVariables
    }
    
    class ClientConfigService {
        +getClientConfig(): ClientConfig
        -twentyConfigService: TwentyConfigService
    }
    
    class DomainManagerService {
        +validateDomain(): boolean
        -twentyConfigService: TwentyConfigService
    }
    
    ConfigVariables --> TwentyConfigService
    TwentyConfigService --> ClientConfigService
    TwentyConfigService --> DomainManagerService
```

## Configuration Management Strategy

### Environment File Structure

The server uses a hierarchical configuration loading system:

1. **System Environment Variables** (highest priority)
2. **`.env` file in packages/twenty-server/**
3. **Default values from config-variables.ts**

### Multi-Workspace Configuration Schema

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IS_MULTIWORKSPACE_ENABLED` | boolean | false | Enable multi-workspace support |
| `MAX_WORKSPACES_PER_USER` | number | 5 | Maximum workspaces per user |
| `SINGLE_WORKSPACE_BEHAVIOR` | enum | 'auto-redirect' | Behavior for single workspace users |

### Configuration Validation

```mermaid
sequenceDiagram
    participant App as Application Startup
    participant Validator as Config Validator
    participant Service as TwentyConfigService
    participant Client as ClientConfigService
    
    App->>Validator: Load environment variables
    Validator->>Validator: Validate IS_MULTIWORKSPACE_ENABLED
    Validator->>Validator: Check dependencies
    Validator->>Service: Initialize with validated config
    Service->>Client: Provide configuration values
    Client->>App: Return client configuration
```

## Implementation Requirements

### Environment File Management

#### Required .env File Structure
```bash
# Core Configuration
NODE_ENV=development
IS_MULTIWORKSPACE_ENABLED=true
SINGLE_WORKSPACE_BEHAVIOR=auto-redirect
MAX_WORKSPACES_PER_USER=5

# Database Configuration
PG_DATABASE_URL=postgres://postgres:postgres@localhost:5432/default
REDIS_URL=redis://localhost:6379

# Security
APP_SECRET=replace_me_with_a_random_string

# Frontend Integration
FRONTEND_URL=http://localhost:3001
SIGN_IN_PREFILLED=true
```

#### Environment Variable Precedence
1. **Runtime System Variables** (via PowerShell/bash export)
2. **`.env` file variables**
3. **Default configuration values**

### Server Restart Protocol

#### Process Management Flow
```mermaid
flowchart TD
    A[Stop Current Processes] --> B[Verify .env Configuration]
    B --> C[Clear Node.js Cache]
    C --> D[Restart Server]
    D --> E[Validate Configuration]
    E --> F{Config Correct?}
    F -->|Yes| G[Continue Operation]
    F -->|No| H[Debug Configuration]
    H --> A
```

#### Restart Commands Sequence
1. **Stop all Node.js processes**
2. **Verify environment configuration**
3. **Clear any cached configurations**
4. **Restart with proper environment**

### Configuration Validation System

#### Runtime Configuration Check
The client configuration service exposes the current state via `/clientConfig` endpoint:

```typescript
interface ClientConfig {
  isMultiWorkspaceEnabled: boolean;
  singleWorkspaceBehavior: 'auto-redirect' | 'create-new' | 'show-choice';
  // ... other configuration
}
```

#### Validation Points
1. **Server Startup**: Validate configuration loading
2. **Client Initialization**: Verify configuration consistency
3. **Runtime Checks**: Monitor configuration state
4. **Development Tools**: Browser console validation

## Configuration Dependencies

### Dependent Services Architecture

```mermaid
graph TD
    A[IS_MULTIWORKSPACE_ENABLED] --> B[AuthSSOService]
    A --> C[SignInUpService]
    A --> D[DomainManagerService]
    A --> E[ClientConfigService]
    
    B --> F[SSO Authentication Flow]
    C --> G[Workspace Creation Logic]
    D --> H[Domain Validation]
    E --> I[Frontend Configuration]
    
    J[Frontend State] --> K[useAuth Hook]
    K --> L[Workspace Selection]
    K --> M[User Routing]
```

### Impact Analysis

#### When IS_MULTIWORKSPACE_ENABLED = true
- **Auth Flow**: Enables workspace-agnostic tokens
- **User Registration**: Allows users without initial workspace
- **Domain Management**: Supports subdomain-based workspaces
- **Frontend Logic**: Activates workspace creation/selection UI

#### When IS_MULTIWORKSPACE_ENABLED = false
- **Auth Flow**: Requires immediate workspace assignment
- **User Registration**: Must create workspace during signup
- **Domain Management**: Single-tenant mode
- **Frontend Logic**: Direct workspace access

## Testing Strategy

### Configuration Testing Matrix

| Test Case | Environment Setup | Expected Behavior |
|-----------|------------------|-------------------|
| Multi-workspace enabled | `IS_MULTIWORKSPACE_ENABLED=true` | Workspace selection UI |
| Single-workspace mode | `IS_MULTIWORKSPACE_ENABLED=false` | Direct workspace access |
| Missing configuration | No .env file | Default to false |
| Invalid configuration | Invalid boolean value | Validation error |

### Validation Testing

#### Server Configuration Test
```typescript
// Test configuration loading
describe('Environment Configuration', () => {
  it('should load IS_MULTIWORKSPACE_ENABLED correctly', () => {
    expect(configService.get('IS_MULTIWORKSPACE_ENABLED')).toBe(true);
  });
  
  it('should reflect in client configuration', () => {
    const clientConfig = clientConfigService.getClientConfig();
    expect(clientConfig.isMultiWorkspaceEnabled).toBe(true);
  });
});
```

#### Browser Validation
```javascript
// Console validation command
console.log('Multi-workspace enabled:', 
  window.__client_config?.isMultiWorkspaceEnabled);
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Environment Variable Not Applied
**Symptoms**: `isMultiWorkspaceEnabled: false` in browser console
**Solution**: 
1. Verify .env file exists and contains correct values
2. Restart all Node.js processes
3. Check browser console for updated configuration

#### Issue: Server Caching Old Configuration
**Symptoms**: Configuration changes don't take effect
**Solution**:
1. Stop all Node.js processes completely
2. Clear any pm2 or nodemon cached processes
3. Restart server with fresh environment

#### Issue: PowerShell Environment Variables Not Persisting
**Symptoms**: Variables reset after session
**Solution**:
1. Use .env file instead of session variables
2. Set system-level environment variables
3. Verify variable persistence across sessions

### Diagnostic Commands

#### Environment Verification
```bash
# Check current environment variables
echo $IS_MULTIWORKSPACE_ENABLED  # Linux/Mac
echo %IS_MULTIWORKSPACE_ENABLED%  # Windows CMD
$env:IS_MULTIWORKSPACE_ENABLED    # PowerShell

# Verify .env file
cat packages/twenty-server/.env

# Check running processes
ps aux | grep node  # Linux/Mac
tasklist | findstr node  # Windows
```

#### Configuration Debugging
```bash
# Server startup with environment debug
NODE_ENV=development DEBUG=* npx nx serve twenty-server

# Validate client configuration
curl http://localhost:3000/clientConfig | jq '.isMultiWorkspaceEnabled'
```

## Development Workflow

### Local Development Setup

#### Initial Configuration
1. **Copy environment template**
   ```bash
   cp packages/twenty-server/.env.example packages/twenty-server/.env
   ```

2. **Enable multi-workspace mode**
   ```bash
   echo "IS_MULTIWORKSPACE_ENABLED=true" >> packages/twenty-server/.env
   ```

3. **Restart development server**
   ```bash
   npx nx serve twenty-server
   ```

#### Configuration Validation Workflow
```mermaid
sequenceDiagram
    participant Dev as Developer
    participant File as .env File
    participant Server as Twenty Server
    participant Browser as Browser Console
    
    Dev->>File: Update IS_MULTIWORKSPACE_ENABLED=true
    Dev->>Server: Restart server
    Server->>Server: Load configuration
    Server->>Browser: Serve client config
    Browser->>Dev: Display isMultiWorkspaceEnabled: true
```

### Production Deployment

#### Environment Configuration
1. **Set system environment variables**
2. **Verify configuration persistence**
3. **Test server restart behavior**
4. **Monitor configuration state**

#### Configuration Management
- **Infrastructure as Code**: Environment variables in deployment scripts
- **Configuration Validation**: Automated checks during deployment
- **Rollback Strategy**: Quick configuration reversion capability

## Performance Considerations

### Configuration Loading Performance
- **Startup Time**: Environment variable parsing adds minimal overhead
- **Runtime Access**: Configuration values are cached for performance
- **Memory Usage**: Configuration objects are lightweight

### Caching Strategy
- **Configuration Cache**: Values cached at service initialization
- **Cache Invalidation**: Requires server restart for changes
- **Memory Efficiency**: Single configuration instance per service

## Security Implications

### Environment Variable Security
- **Sensitive Data**: Keep database URLs and secrets secure
- **Access Control**: Limit environment variable access
- **Audit Trail**: Log configuration changes

### Multi-Workspace Security
- **Workspace Isolation**: Ensure proper tenant separation
- **Authentication**: Workspace-specific token validation
- **Authorization**: Role-based access within workspaces