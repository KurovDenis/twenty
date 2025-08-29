# SGR Module Feature Extraction Documentation

## Overview
This document details the features extracted from duplicate services during the SGR module consolidation.

---

## 🎯 FEATURE EXTRACTION MAPPING

### 1. AvitoWorkflowStateMachineService → AvitoWelcomeSGRService

#### **Key Features to Extract:**

##### State Machine Validation
```typescript
// State transition validation with guards
private validateStateTransition(from: AvitoWorkflowState, to: AvitoWorkflowState): boolean {
  return AvitoWorkflowStateValidator.isValidTransition(from, to);
}

// State transition logging
interface StateTransitionLog {
  fromState: AvitoWorkflowState;
  toState: AvitoWorkflowState;
  timestamp: Date;
  trigger: string;
  duration: number;
}
```

##### Enhanced Context Management
```typescript
interface AvitoWorkflowContext {
  // Core fields
  userId: string;
  workspaceId: string;
  threadId: string;
  state: AvitoWorkflowState;
  
  // Enhanced tracking (EXTRACT)
  stateChangedAt: Date;
  workflowStartedAt: Date;
  timeoutAt?: Date;
  stateTransitionLog: StateTransitionLog[];
  userInteractions: UserInteraction[];
}
```

##### Workflow Timeout Management
```typescript
private readonly WORKFLOW_TIMEOUT_MS = 600000; // 10 minutes

private isWorkflowTimedOut(context: AvitoWorkflowContext): boolean {
  return context.timeoutAt ? new Date() > context.timeoutAt : false;
}
```

---

### 2. EnhancedAvitoWelcomeSGRService → AvitoWelcomeSGRService

#### **Key Features to Extract:**

##### Multi-Pattern Credential Extraction
```typescript
private async extractCredentialsFromMessage(message: string) {
  const patterns = [
    { clientId: /CLIENT_ID\\s*=\\s*['"]?([A-Za-z0-9_-]+)['"]?/i, clientSecret: /CLIENT_SECRET\\s*=\\s*['"]?([A-Za-z0-9_-]+)['"]?/i },
    { clientId: /CLIENT_ID\\s*:\\s*['"]?([A-Za-z0-9_-]+)['"]?/i, clientSecret: /CLIENT_SECRET\\s*:\\s*['"]?([A-Za-z0-9_-]+)['"]?/i },
    { clientId: /"client_id"\\s*:\\s*"([A-Za-z0-9_-]+)"/i, clientSecret: /"client_secret"\\s*:\\s*"([A-Za-z0-9_-]+)"/i }
  ];
  // Implementation with pattern matching
}
```

##### Enhanced API Validation
```typescript
private async validateCredentialsWithAPI(clientId: string, clientSecret: string): Promise<ValidationResult> {
  // Robust validation with detailed error handling
  // Token expiration tracking
  // Comprehensive error responses
}
```

##### Improved Streaming
```typescript
private async *streamThinkingStep(step: { step: string; message: string }): AsyncGenerator<SGRStreamingResult> {
  yield {
    type: 'thinking',
    content: step.message,
    completed: false
  };
}
```

---

### 3. EnhancedAvitoWelcomeToolDispatcherService → AvitoWelcomeToolDispatcherService

#### **Key Features to Extract:**

##### Tool Validation Matrix
```typescript
const ALLOWED_TOOLS_BY_STATE: Record<AvitoWorkflowState, string[]> = {
  [AvitoWorkflowState.INIT]: ['send_greeting'],
  [AvitoWorkflowState.AWAITING_CREDENTIALS]: ['extract_credentials', 'provide_format_examples'],
  // ... more states
};

private validateToolForState(tool: string, state: AvitoWorkflowState): ValidationResult {
  const allowedTools = ALLOWED_TOOLS_BY_STATE[state] || [];
  return { success: allowedTools.includes(tool) };
}
```

##### Enhanced Error Classification
```typescript
interface EnhancedToolExecutionResult {
  success: boolean;
  errorType?: 'VALIDATION' | 'EXECUTION' | 'NETWORK' | 'AUTH' | 'RATE_LIMIT' | 'TIMEOUT';
  executionTimeMs?: number;
  retryable?: boolean;
  metadata?: Record<string, any>;
}
```

##### Performance Monitoring
```typescript
async dispatch(command: ToolUnion, context: WorkflowContext): Promise<EnhancedToolExecutionResult> {
  const startTime = Date.now();
  // Tool execution with performance tracking
  return {
    ...result,
    executionTimeMs: Date.now() - startTime,
    metadata: { performanceMetrics: { startTime, endTime: new Date() } }
  };
}
```

---

### 4. AvitoWorkflowErrorRecoveryService → AvitoErrorRecoveryService

#### **Key Features to Extract:**

##### Error Classification System
```typescript
enum AvitoErrorType {
  INVALID_CREDENTIAL_FORMAT = 'INVALID_CREDENTIAL_FORMAT',
  API_AUTHENTICATION_FAILED = 'API_AUTHENTICATION_FAILED',
  API_RATE_LIMITED = 'API_RATE_LIMITED',
  WORKFLOW_TIMEOUT = 'WORKFLOW_TIMEOUT',
  SYSTEM_FAILURE = 'SYSTEM_FAILURE'
}

enum RecoveryStrategy {
  RETRY_AUTOMATIC = 'RETRY_AUTOMATIC',
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',
  ESCALATE_TO_SUPPORT = 'ESCALATE_TO_SUPPORT'
}
```

##### Error Tracking
```typescript
interface AvitoWorkflowError {
  id: string;
  type: AvitoErrorType;
  severity: ErrorSeverity;
  recoveryStrategy: RecoveryStrategy;
  retryable: boolean;
  resolved: boolean;
  escalated: boolean;
}
```

---

### 5. AvitoWorkflowMonitoringService → AvitoWorkflowHealthService

#### **Key Features to Extract:**

##### Workflow Metrics
```typescript
interface AvitoWorkflowMetrics {
  totalWorkflows: number;
  completedWorkflows: number;
  completionRate: number;
  averageCompletionTime: number;
  errorRate: number;
  workflowsByState: Record<AvitoWorkflowState, number>;
}
```

##### Health Monitoring
```typescript
interface ComponentHealth {
  component: string;
  status: HealthStatus;
  responseTime: number;
  errorRate: number;
}

async isHealthy(key: string): Promise<HealthIndicatorResult> {
  // Health check implementation for Terminus
}
```

---

## 🔄 CONSOLIDATED INTERFACES

### ConsolidatedWorkflowContext
```typescript
interface ConsolidatedWorkflowContext {
  // Core context
  userId: string;
  workspaceId: string;
  threadId: string;
  currentState: WorkflowState;
  
  // Enhanced features
  stateHistory: StateTransitionLog[];
  errorHistory: WorkflowError[];
  performanceMetrics: PerformanceData;
  validationResults: ValidationResult[];
  healthMetrics: ComponentHealth[];
}
```

### ConsolidatedErrorType
```typescript
enum ConsolidatedErrorType {
  // Core errors
  INVALID_CREDENTIALS = 'invalid_credentials',
  API_TIMEOUT = 'api_timeout',
  
  // State machine errors
  INVALID_STATE_TRANSITION = 'invalid_state_transition',
  WORKFLOW_TIMEOUT = 'workflow_timeout',
  
  // Tool errors
  TOOL_VALIDATION_FAILED = 'tool_validation_failed',
  TOOL_EXECUTION_TIMEOUT = 'tool_execution_timeout'
}
```

---

## ✅ EXTRACTION COMPLETION STATUS

- [x] **AvitoWorkflowStateMachineService**: State machine patterns extracted
- [x] **EnhancedAvitoWelcomeSGRService**: Enhanced features documented
- [x] **EnhancedAvitoWelcomeToolDispatcherService**: Tool validation matrix mapped
- [x] **AvitoWorkflowErrorRecoveryService**: Error recovery patterns identified
- [x] **AvitoWorkflowMonitoringService**: Monitoring features catalogued

**Next Phase**: Begin service enhancement with extracted features.