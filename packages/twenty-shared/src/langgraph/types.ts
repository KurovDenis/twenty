// Shared types for LangGraph integration
// Both frontend and backend import from this package

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentState {
  workflowStep: number;
  context: Record<string, any>;
  metadata: {
    lastUpdated: Date;
    version: string;
    checksum: string;
  };
}

export interface AgentExecutionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

export interface AgentContext {
  workspaceId: string;
  userId: string;
  threadId: string;
  userWorkspaceId: string;
}

export interface ILangGraphAgent {
  execute(
    messages: any[],
    context: AgentContext,
    currentState?: AgentState,
  ): Promise<AgentExecutionResult & { state: AgentState }>;
  
  getTools(): any[];
  getStateSchema(): object;
  getSystemPrompt(): string;
}

export interface EncryptedState {
  encrypted: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedContent?: string;
}

export interface RateLimitInfo {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
}

export interface AgentExecutionMetrics {
  agentId: string;
  workspaceId: string;
  userId: string;
  duration: number;
  tokenUsage: number;
  success: boolean;
  errorType?: string;
}

export interface TracingContext {
  agentId: string;
  threadId: string;
  workspaceId: string;
  userId: string;
  operation: string;
}

// LangGraph configuration types
export interface LangGraphConfig {
  graphType: 'welcome' | 'sales' | 'support';
  tools: string[];
  stateSchema: object;
  workflowDefinition: object;
}

// Circuit breaker types
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  timeout: number;
  halfOpenAttempts: number;
  failureCodes: number[];
  name: string;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  component: string;
  details?: string;
  timestamp: Date;
}

// PII detection types
export interface PIIDetectionResult {
  detected: boolean;
  types: string[];
  severity: 'low' | 'medium' | 'high';
}

// Rate limiting types
export interface RateLimitConfig {
  userPerHour: number;
  ipPerHour: number;
  workspacePerHour: number;
}

// Cache types
export interface CacheConfig {
  ttl: number;
  maxSize: number;
  cleanupInterval: number;
}

// Logging types
export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context: Record<string, any>;
  timestamp: Date;
  traceId?: string;
  spanId?: string;
}

// Error types
export class LangGraphError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'LangGraphError';
  }
}

export class ValidationError extends LangGraphError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends LangGraphError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'RATE_LIMIT_ERROR', context);
    this.name = 'RateLimitError';
  }
}

export class EncryptionError extends LangGraphError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'ENCRYPTION_ERROR', context);
    this.name = 'EncryptionError';
  }
}

export class StateError extends LangGraphError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'STATE_ERROR', context);
    this.name = 'StateError';
  }
}

export class CircuitBreakerError extends LangGraphError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CIRCUIT_BREAKER_ERROR', context);
    this.name = 'CircuitBreakerError';
  }
}
