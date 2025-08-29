# SGR Module Consolidated API Documentation

## Overview

This document provides comprehensive API documentation for the consolidated Business Setup SGR (Schema-Guided Reasoning) module services. After the consolidation, all services have been enhanced with additional functionality while maintaining backward compatibility.

## Service APIs

## 1. AvitoWelcomeSGRService

### Overview
Primary service for orchestrating Avito integration workflows with enhanced state management, multi-pattern credential extraction, and comprehensive error handling.

### Public Methods

#### `processWelcomeMessage(message: string, userId: string, workspaceId: string, threadId: string): Promise<void>`

**Description**: Main entry point for processing user messages in the Avito welcome workflow.

**Parameters**:
- `message` (string): User message content
- `userId` (string): Unique user identifier
- `workspaceId` (string): Workspace identifier
- `threadId` (string): Chat thread identifier

**Enhanced Features**:
- Multi-pattern credential extraction (KEY_VALUE_EQUALS, JSON_FORMAT, etc.)
- State machine validation with strict transition control
- Comprehensive error handling with automatic recovery
- Performance monitoring and metrics collection
- Event emission for workflow milestones

**Example Usage**:
```typescript
await avitoWelcomeService.processWelcomeMessage(
  "CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF' CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'",
  'user-123',
  'workspace-456',
  'thread-789'
);
```

**Events Emitted**:
- `business-setup.welcome.started`
- `business-setup.credentials.extracted`
- `business-setup.credentials.validated`
- `business-setup.welcome.completed`
- `business-setup.welcome.failed`

**Error Handling**:
- Invalid credential format → Automatic user guidance
- API authentication failure → Retry with user notification
- Network errors → Exponential backoff retry
- Storage failures → Escalation with fallback

#### `getWelcomeStatus(userId: string, workspaceId: string): Promise<WelcomeStatus>`

**Description**: Retrieves current welcome workflow status for a user.

**Parameters**:
- `userId` (string): User identifier
- `workspaceId` (string): Workspace identifier

**Returns**:
```typescript
interface WelcomeStatus {
  welcomePending: boolean;
  credentialsStored: boolean;
  avitoClientId?: string; // Masked for security
  lastActivity?: Date;
  currentState?: AvitoWorkflowState;
  errorCount?: number;
}
```

**Example Usage**:
```typescript
const status = await avitoWelcomeService.getWelcomeStatus('user-123', 'workspace-456');
console.log(status); 
// { welcomePending: false, credentialsStored: true, avitoClientId: 'R3cTDMk9rE...' }
```

### Enhanced Private Methods (Consolidated Features)

#### `validateStateTransition(currentState: AvitoWorkflowState, newState: AvitoWorkflowState): boolean`

**Description**: Validates workflow state transitions using consolidated state machine logic.

**State Transition Matrix**:
```typescript
INIT → GREETING_SENT
GREETING_SENT → AWAITING_CREDENTIALS
AWAITING_CREDENTIALS → EXTRACTING_CREDENTIALS | ERROR_INVALID_FORMAT
EXTRACTING_CREDENTIALS → VALIDATING_CREDENTIALS | ERROR_INVALID_FORMAT
VALIDATING_CREDENTIALS → VALIDATION_SUCCESS | VALIDATION_FAILED | ERROR_API_FAILURE
// ... complete transition matrix
```

#### `extractCredentialsFromMessage(message: string): Promise<CredentialExtractionResult>`

**Description**: Enhanced credential extraction supporting multiple patterns.

**Supported Patterns**:
- **KEY_VALUE_EQUALS**: `CLIENT_ID = 'value'`
- **KEY_VALUE_COLON**: `CLIENT_ID: 'value'`
- **JSON_FORMAT**: `{"client_id": "value", "client_secret": "value"}`
- **YAML_FORMAT**: YAML-structured credentials
- **MULTILINE_TEXT**: Natural language extraction

**Returns**:
```typescript
interface CredentialExtractionResult {
  success: boolean;
  credentials?: AvitoCredentials;
  error?: string;
  pattern?: string;
  confidence?: number;
}
```

#### `validateCredentialsWithAPI(clientId: string, clientSecret: string): Promise<ValidationResult>`

**Description**: Enhanced API validation with retry logic and comprehensive error handling.

**Returns**:
```typescript
interface ValidationResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
  error?: string;
  errorType?: 'TIMEOUT' | 'AUTH' | 'NETWORK' | 'VALIDATION';
  retryAfter?: number;
  apiResponseTime?: number;
}
```

---

## 2. AvitoWelcomeToolDispatcherService

### Overview
Enhanced tool dispatcher with state-based validation, circuit breaker functionality, and comprehensive error classification.

### Public Methods

#### `dispatch(command: ToolCommand, userId: string, workspaceId: string): Promise<ToolResult>`

**Description**: Main tool dispatch method with enhanced validation and error handling.

**Parameters**:
- `command` (ToolCommand): Tool command to execute
- `userId` (string): User identifier
- `workspaceId` (string): Workspace identifier

**Enhanced Features**:
- State-based tool validation using `ALLOWED_TOOLS_BY_STATE` matrix
- Circuit breaker pattern for fault tolerance
- Enhanced error classification with severity levels
- Performance monitoring and metrics collection
- Automatic retry with exponential backoff

**Supported Tools**:

##### `extract_credentials`
```typescript
interface ExtractCredentialsCommand {
  tool: 'extract_credentials';
  message: string;
}

interface ExtractCredentialsResult {
  success: boolean;
  data: {
    client_id?: string;
    client_secret?: string;
    extraction_successful: boolean;
    valid_format: boolean;
    patterns_matched: string;
    confidence_score?: number;
    message: string;
  };
}
```

**Example Usage**:
```typescript
const result = await toolDispatcher.dispatch({
  tool: 'extract_credentials',
  message: "CLIENT_ID = 'test' CLIENT_SECRET = 'secret'"
}, 'user-123', 'workspace-456');
```

##### `validate_avito_token`
```typescript
interface ValidateTokenCommand {
  tool: 'validate_avito_token';
  client_id: string;
  client_secret: string;
}

interface ValidateTokenResult {
  success: boolean;
  data: {
    valid: boolean;
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
    response_time_ms?: number;
  };
}
```

##### `store_credentials`
```typescript
interface StoreCredentialsCommand {
  tool: 'store_credentials';
  client_id: string;
  client_secret: string;
  access_token?: string;
}

interface StoreCredentialsResult {
  success: boolean;
  data: {
    stored: boolean;
    encrypted: boolean;
    error?: string;
    storage_location?: string;
  };
}
```

### Enhanced Private Methods (Consolidated Features)

#### `isToolAllowedInState(tool: string, state: AvitoWorkflowState): boolean`

**Description**: Validates if a tool is allowed in the current workflow state.

**Tool Access Matrix**:
```typescript
const ALLOWED_TOOLS_BY_STATE: Record<AvitoWorkflowState, string[]> = {
  AWAITING_CREDENTIALS: ['extract_credentials', 'request_credentials'],
  EXTRACTING_CREDENTIALS: ['validate_avito_token'],
  VALIDATION_SUCCESS: ['store_credentials'],
  STORAGE_COMPLETE: ['report_welcome_completion'],
  // ... complete matrix
};
```

#### `isCircuitBreakerOpen(toolKey: string): boolean`

**Description**: Circuit breaker implementation for fault tolerance.

**Circuit States**:
- **CLOSED**: Normal operation
- **OPEN**: Failures detected, blocking requests
- **HALF_OPEN**: Testing recovery

**Thresholds**:
- Failure threshold: 5 failures in 60 seconds
- Recovery timeout: 30 seconds
- Success threshold for closing: 3 consecutive successes

#### `classifyError(error: any): ErrorClassification`

**Description**: Enhanced error classification with severity levels.

**Returns**:
```typescript
interface ErrorClassification {
  errorType: string;
  retryable: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  escalationRequired: boolean;
  suggestedAction: string;
}
```

---

## 3. AvitoErrorRecoveryService

### Overview
Comprehensive error handling, recovery strategies, and escalation management service.

### Public Methods

#### `classifyError(error: any, context?: any): ErrorClassification`

**Description**: Classifies errors with detailed analysis and recovery recommendations.

**Parameters**:
- `error` (any): Error object or message
- `context` (any): Additional context information

**Error Types Handled**:
- `INVALID_CREDENTIAL_FORMAT`: User input format errors
- `API_AUTHENTICATION_FAILED`: Authentication failures
- `API_RATE_LIMITED`: Rate limiting responses
- `API_SERVER_ERROR`: Server-side errors
- `API_NETWORK_ERROR`: Network connectivity issues
- `API_TIMEOUT`: Request timeout errors
- `STORAGE_FAILURE`: Database/storage errors
- `WORKFLOW_TIMEOUT`: Workflow execution timeouts
- `MAX_ATTEMPTS_EXCEEDED`: Retry limit exceeded
- `SYSTEM_UNAVAILABLE`: System resource errors

**Returns**:
```typescript
interface ErrorClassification {
  errorType: AvitoErrorType;
  recoverable: boolean;
  requiresUserAction: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  escalationRequired: boolean;
  priority: number;
}
```

#### `recoverFromError(errorDetails: AvitoErrorDetails, context: AvitoWorkflowContext): Promise<RecoveryResult>`

**Description**: Executes error recovery strategies based on error type and context.

**Parameters**:
- `errorDetails` (AvitoErrorDetails): Detailed error information
- `context` (AvitoWorkflowContext): Current workflow context

**Returns**:
```typescript
interface RecoveryResult {
  success: boolean;
  newState?: AvitoWorkflowState;
  message?: string;
  requiresUserInput?: boolean;
  retryAfterMs?: number;
  fallbackExecuted?: boolean;
}
```

**Example Usage**:
```typescript
const errorDetails = {
  errorType: AvitoErrorType.API_RATE_LIMITED,
  originalError: new Error('429 Too Many Requests'),
  context: {
    userId: 'user-123',
    workspaceId: 'workspace-456',
    threadId: 'thread-789',
    workflowState: AvitoWorkflowState.VALIDATING_CREDENTIALS,
    attemptCount: 2,
    timestamp: new Date(),
  },
  recoveryStrategy: service.getRecoveryStrategy(AvitoErrorType.API_RATE_LIMITED)
};

const result = await errorRecoveryService.recoverFromError(errorDetails, context);
```

#### `getRecoveryStrategy(errorType: AvitoErrorType): ErrorRecoveryStrategy`

**Description**: Retrieves the recovery strategy for a specific error type.

**Returns**:
```typescript
interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  requiresUserAction: boolean;
  fallbackAction?: () => Promise<void>;
}
```

#### `analyzeErrorPatterns(userId: string, workspaceId: string): ErrorPatternAnalysis`

**Description**: Analyzes error patterns for predictive recovery and optimization.

**Returns**:
```typescript
interface ErrorPatternAnalysis {
  frequentErrors: Array<{ errorType: AvitoErrorType; count: number }>;
  recoverySuccess: number;
  escalationRate: number;
  recommendations: string[];
  totalErrors: number;
  errorFrequency: Record<AvitoErrorType, number>;
}
```

#### `handleEscalation(userId: string, workspaceId: string, escalationData: EscalationData): Promise<EscalationResult>`

**Description**: Manages error escalation based on severity and frequency.

**Parameters**:
- `escalationData` (EscalationData): Escalation context and criteria

**Returns**:
```typescript
interface EscalationResult {
  escalated: boolean;
  escalationLevel: 'NONE' | 'WARNING' | 'CRITICAL';
  notificationsSent: string[];
  automaticActions: string[];
  escalationId?: string;
}
```

---

## 4. AvitoWorkflowHealthService

### Overview
Comprehensive workflow monitoring, health checks, and performance tracking service.

### Public Methods

#### `performHealthCheck(): Promise<HealthCheckResult>`

**Description**: Performs comprehensive system health check across all components.

**Health Check Components**:
- Database connectivity and performance
- Avito API availability and response times
- Workflow performance metrics
- Error rates and patterns
- System resource utilization

**Returns**:
```typescript
interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details: Array<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
    responseTimeMs?: number;
  }>;
  metrics: WorkflowMetrics;
  timestamp: Date;
}

enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}
```

**Example Usage**:
```typescript
const healthResult = await healthService.performHealthCheck();
console.log(`System status: ${healthResult.status}`);
healthResult.details.forEach(component => {
  console.log(`${component.component}: ${component.status} - ${component.message}`);
});
```

#### `getWorkflowMetrics(): WorkflowMetrics`

**Description**: Retrieves comprehensive workflow performance metrics.

**Returns**:
```typescript
interface WorkflowMetrics {
  totalWorkflows: number;
  successfulWorkflows: number;
  failedWorkflows: number;
  averageExecutionTimeMs: number;
  stateDistribution: Record<AvitoWorkflowState, number>;
  averageStepsPerWorkflow: number;
  errorFrequency: Record<AvitoErrorType, number>;
  recoverySuccessRate: number;
  apiCallsTotal: number;
  apiCallsSuccessful: number;
  apiAverageResponseTimeMs: number;
  credentialsProcessed: number;
  credentialsValidated: number;
  credentialsStored: number;
  lastUpdated: Date;
  metricsCollectionPeriod: string;
}
```

#### `getWorkflowExecutionRecord(userId: string, workspaceId: string, threadId: string): WorkflowExecutionRecord | undefined`

**Description**: Retrieves detailed execution record for a specific workflow.

**Returns**:
```typescript
interface WorkflowExecutionRecord {
  id: string;
  userId: string;
  workspaceId: string;
  threadId: string;
  startTime: Date;
  endTime?: Date;
  currentState: AvitoWorkflowState;
  stepsExecuted: Array<{
    state: AvitoWorkflowState;
    timestamp: Date;
    executionTimeMs: number;
    success: boolean;
  }>;
  finalStatus: 'in_progress' | 'success' | 'failed' | 'cancelled';
  credentialsValidated: boolean;
  credentialsStored: boolean;
  errorCount: number;
  totalExecutionTimeMs?: number;
  lastError?: {
    type: AvitoErrorType;
    message: string;
    timestamp: Date;
  };
}
```

### Event Handlers

#### `onWorkflowStarted(payload: WorkflowStartedEvent): void`
#### `onWorkflowCompleted(payload: WorkflowCompletedEvent): void`
#### `onWorkflowStateChanged(payload: StateChangedEvent): void`
#### `onErrorRecoveryStarted(payload: ErrorRecoveryEvent): void`
#### `onAPICallCompleted(payload: APICallEvent): void`

**Description**: Event handlers for real-time workflow monitoring and metrics collection.

---

## Common Interfaces and Types

### AvitoWorkflowState
```typescript
enum AvitoWorkflowState {
  INIT = 'INIT',
  GREETING_SENT = 'GREETING_SENT',
  AWAITING_CREDENTIALS = 'AWAITING_CREDENTIALS',
  EXTRACTING_CREDENTIALS = 'EXTRACTING_CREDENTIALS',
  VALIDATING_CREDENTIALS = 'VALIDATING_CREDENTIALS',
  VALIDATION_SUCCESS = 'VALIDATION_SUCCESS',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  STORING_CREDENTIALS = 'STORING_CREDENTIALS',
  STORAGE_COMPLETE = 'STORAGE_COMPLETE',
  COMPLETING_WELCOME = 'COMPLETING_WELCOME',
  WELCOME_COMPLETED = 'WELCOME_COMPLETED',
  ERROR_INVALID_FORMAT = 'ERROR_INVALID_FORMAT',
  ERROR_API_FAILURE = 'ERROR_API_FAILURE',
  ERROR_STORAGE_FAILURE = 'ERROR_STORAGE_FAILURE',
  REQUEST_RETRY = 'REQUEST_RETRY',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED'
}
```

### AvitoWorkflowContext
```typescript
interface AvitoWorkflowContext {
  userId: string;
  workspaceId: string;
  threadId: string;
  workflowId: string;
  state: AvitoWorkflowState;
  previousState?: AvitoWorkflowState;
  stateChangedAt: Date;
  stateTransitionLog: StateTransitionLog[];
  attemptMetrics: AttemptMetrics;
  credentials?: AvitoCredentials;
  validationResult?: ValidationResult;
  storageResult?: StorageResult;
  lastError?: string;
  errorHistory: ErrorEntry[];
  workflowStartedAt: Date;
  completedAt?: Date;
  timeoutAt?: Date;
  workflowVersion: string;
  metrics: AvitoWorkflowMetrics;
  userInteractions: UserInteraction[];
  integrations: IntegrationSettings;
  config: WorkflowConfiguration;
}
```

### AvitoErrorType
```typescript
enum AvitoErrorType {
  INVALID_CREDENTIAL_FORMAT = 'INVALID_CREDENTIAL_FORMAT',
  CREDENTIALS_NOT_FOUND = 'CREDENTIALS_NOT_FOUND',
  DUPLICATE_CREDENTIALS = 'DUPLICATE_CREDENTIALS',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_TIMEOUT = 'API_TIMEOUT',
  API = 'API',
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  WORKFLOW_TIMEOUT = 'WORKFLOW_TIMEOUT',
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  SYSTEM_UNAVAILABLE = 'SYSTEM_UNAVAILABLE'
}
```

## Events

### Business Setup Events
```typescript
const BUSINESS_SETUP_EVENTS = {
  AI_AGENT_WELCOME_CHAT_CREATION_STARTED: 'ai-agent.welcome.chat-creation-started',
  AI_AGENT_WELCOME_CHAT_CREATED: 'ai-agent.welcome.chat-created',
  AI_AGENT_WELCOME_CHAT_CREATION_FAILED: 'ai-agent.welcome.chat-creation-failed',
  AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED: 'ai-agent.welcome.user-message-received',
  AI_AGENT_WELCOME_AI_RESPONSE_GENERATED: 'ai-agent.welcome.ai-response-generated',
  BUSINESS_SETUP_READY_FOR_NEXT_STEP: 'business-setup.ready-for-next-step',
  BUSINESS_SETUP_STEP_TRANSITION: 'business-setup.step-transition',
  // ... complete event list
} as const;
```

## Error Handling

### Standard Error Response Format
```typescript
interface APIErrorResponse {
  success: false;
  error: {
    type: AvitoErrorType;
    message: string;
    code?: string;
    details?: Record<string, any>;
    recoverable: boolean;
    userAction?: string;
    retryAfter?: number;
  };
  timestamp: Date;
  requestId?: string;
}
```

### Recovery Strategies
Each error type has an associated recovery strategy:

```typescript
interface ErrorRecoveryStrategy {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  userMessage: string;
  technicalMessage: string;
  recoverable: boolean;
  requiresUserAction: boolean;
  fallbackAction?: () => Promise<void>;
}
```

## Performance Considerations

### Response Time Targets
- **processWelcomeMessage**: < 2000ms for complete workflow
- **Tool dispatch**: < 200ms average execution time
- **Error recovery**: < 100ms for classification and strategy selection
- **Health checks**: < 500ms for complete system check
- **State transitions**: < 50ms per validation

### Rate Limiting
- **API calls**: Maximum 10 calls per minute per user
- **Workflow initiation**: Maximum 5 workflows per minute per user
- **Error recovery**: Maximum 3 recovery attempts per minute per error type

### Memory Usage
- **Base service memory**: ~3MB per service
- **Per workflow**: ~2MB additional memory
- **Error history**: ~1KB per error entry
- **Metrics storage**: ~500KB for 1000 workflow records

## Security

### Authentication
All API methods require valid user and workspace authentication through the existing Twenty.com authentication system.

### Data Protection
- Credentials encrypted using AES-256 encryption
- API keys masked in responses and logs
- Audit trails for all credential operations
- Secure transmission using TLS 1.3

### Access Control
- User-scoped data access only
- Workspace-level isolation
- Admin-only access to system health metrics
- Audit logging for sensitive operations

## Migration Guide

### Breaking Changes
None. The consolidation maintains full backward compatibility.

### New Features
- Enhanced error handling with automatic recovery
- Multi-pattern credential extraction
- Comprehensive health monitoring
- Circuit breaker fault tolerance
- Advanced state machine validation

### Deprecated Methods
None. All existing methods remain available with enhanced functionality.

---

## Examples

### Complete Workflow Example
```typescript
// Initialize services
const avitoService = new AvitoWelcomeSGRService(/* dependencies */);
const healthService = new AvitoWorkflowHealthService(/* dependencies */);

// Start workflow
await avitoService.processWelcomeMessage(
  "Привет! Хочу настроить интеграцию с Avito",
  'user-123',
  'workspace-456',
  'thread-789'
);

// Process credentials
await avitoService.processWelcomeMessage(
  "CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF' CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'",
  'user-123',
  'workspace-456',
  'thread-789'
);

// Check health
const health = await healthService.performHealthCheck();
console.log(`System health: ${health.status}`);

// Get metrics
const metrics = healthService.getWorkflowMetrics();
console.log(`Success rate: ${(metrics.successfulWorkflows / metrics.totalWorkflows * 100).toFixed(1)}%`);
```

### Error Handling Example
```typescript
try {
  await avitoService.processWelcomeMessage(
    "invalid credentials format",
    'user-123',
    'workspace-456',
    'thread-789'
  );
} catch (error) {
  // Error is automatically handled by the service
  // User receives guidance message
  // Error is logged and tracked
  // Recovery strategy is applied
}
```

### Health Monitoring Example
```typescript
// Set up periodic health monitoring
setInterval(async () => {
  const health = await healthService.performHealthCheck();
  
  if (health.status === HealthStatus.CRITICAL) {
    // Alert operations team
    console.error('Critical system health issue:', health.message);
  }
  
  // Log metrics
  const metrics = healthService.getWorkflowMetrics();
  console.log('Workflow metrics:', {
    totalWorkflows: metrics.totalWorkflows,
    successRate: metrics.successfulWorkflows / metrics.totalWorkflows,
    avgExecutionTime: metrics.averageExecutionTimeMs,
    errorRate: Object.values(metrics.errorFrequency).reduce((sum, count) => sum + count, 0) / metrics.totalWorkflows
  });
}, 300000); // Every 5 minutes
```