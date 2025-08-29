// ✅ Local Event Type Definitions (to avoid runtime module resolution issues)
// These types are defined locally to ensure server startup works properly

export const BUSINESS_SETUP_EVENTS = {
  // Onboarding events
  ONBOARDING_STATUS_CHANGED: 'onboarding.status.changed',

  // AI Agent events
  AI_AGENT_WELCOME_CHAT_CREATION_STARTED:
    'ai-agent.welcome.chat-creation-started',
  AI_AGENT_WELCOME_CHAT_CREATED: 'ai-agent.welcome.chat-created',
  AI_AGENT_WELCOME_CHAT_CREATION_FAILED:
    'ai-agent.welcome.chat-creation-failed',

  // Chat Continuation events
  AI_AGENT_WELCOME_USER_MESSAGE_RECEIVED:
    'ai-agent.welcome.user-message-received',
  AI_AGENT_WELCOME_AI_RESPONSE_GENERATED:
    'ai-agent.welcome.ai-response-generated',
  BUSINESS_SETUP_READY_FOR_NEXT_STEP: 'business-setup.ready-for-next-step',
  BUSINESS_SETUP_STEP_TRANSITION: 'business-setup.step-transition',

  // Chat events
  CHAT_MESSAGE_ADDED: 'chat.message.added',
  CHAT_STATUS_UPDATED: 'chat.status.updated',

  // Supervisor Agent events
  BUSINESS_SETUP_ROUTE_MESSAGE: 'business-setup.route-message',
  SUPERVISOR_PROCESS_MESSAGE: 'supervisor.process-message', // New event for decoupled communication
  BUSINESS_SETUP_STATUS_CHANGED: 'business-setup.status-changed',
  BUSINESS_SETUP_AGENT_CREATED: 'business-setup.agent-created',
  SUPERVISOR_THINKING_STEP: 'supervisor.thinking-step',
  SUPERVISOR_ROUTING_COMPLETED: 'supervisor.routing-completed',
  SUPERVISOR_STATUS_TRANSITION: 'supervisor.status-transition',
  SUPERVISOR_ERROR_OCCURRED: 'supervisor.error-occurred',
  SUPERVISOR_AGENT_HANDOFF: 'supervisor.agent-handoff',
} as const;

export type BusinessSetupEventType =
  (typeof BUSINESS_SETUP_EVENTS)[keyof typeof BUSINESS_SETUP_EVENTS];

export interface BusinessSetupEventPayload {
  userId: string;
  workspaceId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface OnboardingStatusChangedEvent
  extends BusinessSetupEventPayload {
  status: string;
  previousStatus: string;
}

export interface WelcomeChatCreationStartedEvent
  extends BusinessSetupEventPayload {}

export interface WelcomeChatCreatedEvent extends BusinessSetupEventPayload {
  threadId: string;
  aiResponse: string;
}

export interface WelcomeChatCreationFailedEvent
  extends BusinessSetupEventPayload {
  error: string;
  attempts: number;
}

export interface UserMessageReceivedEvent extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
}

export interface AIResponseGeneratedEvent extends BusinessSetupEventPayload {
  threadId: string;
  response: string;
  context: Record<string, any>;
}

export interface BusinessSetupStepTransitionEvent
  extends BusinessSetupEventPayload {
  fromStep: string;
  toStep: string;
  reason: string;
}

export interface ChatMessageAddedEvent extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
  role: 'user' | 'assistant';
}

export interface ChatStatusUpdatedEvent extends BusinessSetupEventPayload {
  threadId: string;
  status: string;
  previousStatus: string;
}

// Supervisor event interfaces
export interface BusinessSetupRouteMessageEvent
  extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
  currentStatus?: string;
}

export interface BusinessSetupStatusChangedEvent
  extends BusinessSetupEventPayload {
  fromStatus: string;
  toStatus: string;
  reason: string;
  triggerEvent?: string;
}

export interface BusinessSetupAgentCreatedEvent
  extends BusinessSetupEventPayload {
  agentId: string;
  agentName: string;
  agentType: 'supervisor' | 'specialized';
}

export interface SupervisorThinkingStepEvent extends BusinessSetupEventPayload {
  threadId: string;
  stepNumber: number;
  currentState: string;
  plannedSteps: string[];
  selectedTool: string;
  completed: boolean;
}

export interface SupervisorRoutingCompletedEvent
  extends BusinessSetupEventPayload {
  threadId: string;
  success: boolean;
  finalMessage: string;
  routedTo?: string;
  stepsExecuted: string[];
  executionTimeMs: number;
}

export interface SupervisorStatusTransitionEvent
  extends BusinessSetupEventPayload {
  threadId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  automatic: boolean;
}

export interface SupervisorErrorOccurredEvent
  extends BusinessSetupEventPayload {
  threadId: string;
  errorType: string;
  errorMessage: string;
  context?: Record<string, any>;
  recoverable: boolean;
}

export interface SupervisorProcessMessageEvent
  extends BusinessSetupEventPayload {
  threadId: string;
  message: string;
}

export interface SupervisorAgentHandoffEvent extends BusinessSetupEventPayload {
  threadId: string;
  fromAgent: string;
  toAgent: string;
  handoffReason: string;
  contextPreserved: boolean;
  userMessage: string;
}

export type BusinessSetupEvent =
  | OnboardingStatusChangedEvent
  | WelcomeChatCreationStartedEvent
  | WelcomeChatCreatedEvent
  | WelcomeChatCreationFailedEvent
  | UserMessageReceivedEvent
  | AIResponseGeneratedEvent
  | BusinessSetupStepTransitionEvent
  | ChatMessageAddedEvent
  | ChatStatusUpdatedEvent
  | BusinessSetupRouteMessageEvent
  | SupervisorProcessMessageEvent
  | BusinessSetupStatusChangedEvent
  | BusinessSetupAgentCreatedEvent
  | SupervisorThinkingStepEvent
  | SupervisorRoutingCompletedEvent
  | SupervisorStatusTransitionEvent
  | SupervisorErrorOccurredEvent
  | SupervisorAgentHandoffEvent;

export function isValidBusinessSetupEvent(
  event: any,
): event is BusinessSetupEvent {
  return (
    event &&
    typeof event.userId === 'string' &&
    typeof event.workspaceId === 'string' &&
    event.timestamp instanceof Date
  );
}

export function isOnboardingStatusChangedEvent(
  event: BusinessSetupEvent,
): event is OnboardingStatusChangedEvent {
  return (
    'status' in event && 'previousStatus' in event && !('threadId' in event)
  );
}

export function isWelcomeChatCreatedEvent(
  event: BusinessSetupEvent,
): event is WelcomeChatCreatedEvent {
  return 'threadId' in event && 'aiResponse' in event && !('error' in event);
}

export function isWelcomeChatCreationFailedEvent(
  event: BusinessSetupEvent,
): event is WelcomeChatCreationFailedEvent {
  return 'error' in event && 'attempts' in event;
}

// ===============================================================
// CONSOLIDATED BUSINESS SETUP EVENTS (Enhanced Event System)
// ===============================================================

/**
 * Enhanced event system consolidating all events from duplicate services
 * Includes events from AvitoWorkflowStateMachineService, AvitoWorkflowErrorRecoveryService,
 * AvitoWorkflowMonitoringService, and enhanced tool dispatcher services
 */
export const CONSOLIDATED_BUSINESS_SETUP_EVENTS = {
  // Core workflow events
  ...BUSINESS_SETUP_EVENTS,

  // Enhanced Avito workflow state events
  AVITO_WORKFLOW_STARTED: 'avito.workflow.started',
  AVITO_WORKFLOW_COMPLETED: 'avito.workflow.completed',
  AVITO_WORKFLOW_FAILED: 'avito.workflow.failed',
  AVITO_WORKFLOW_TIMEOUT: 'avito.workflow.timeout',
  AVITO_WORKFLOW_STATE_CHANGED: 'avito.workflow.state.changed',
  AVITO_WORKFLOW_STATE_VALIDATION_FAILED:
    'avito.workflow.state.validation.failed',

  // Enhanced error recovery events
  AVITO_ERROR_DETECTED: 'avito.error.detected',
  AVITO_ERROR_RECOVERY_STARTED: 'avito.error.recovery.started',
  AVITO_ERROR_RECOVERY_SUCCEEDED: 'avito.error.recovery.succeeded',
  AVITO_ERROR_RECOVERY_FAILED: 'avito.error.recovery.failed',
  AVITO_ERROR_ESCALATED: 'avito.error.escalated',
  AVITO_ERROR_PATTERN_DETECTED: 'avito.error.pattern.detected',

  // Enhanced performance monitoring events
  AVITO_PERFORMANCE_THRESHOLD_EXCEEDED: 'avito.performance.threshold.exceeded',
  AVITO_PERFORMANCE_OPTIMIZED: 'avito.performance.optimized',
  AVITO_PERFORMANCE_DEGRADED: 'avito.performance.degraded',
  AVITO_CIRCUIT_BREAKER_OPENED: 'avito.circuit.breaker.opened',
  AVITO_CIRCUIT_BREAKER_CLOSED: 'avito.circuit.breaker.closed',

  // Enhanced tool validation events
  AVITO_TOOL_VALIDATION_STARTED: 'avito.tool.validation.started',
  AVITO_TOOL_VALIDATION_COMPLETED: 'avito.tool.validation.completed',
  AVITO_TOOL_VALIDATION_FAILED: 'avito.tool.validation.failed',
  AVITO_TOOL_EXECUTION_STARTED: 'avito.tool.execution.started',
  AVITO_TOOL_EXECUTION_COMPLETED: 'avito.tool.execution.completed',
  AVITO_TOOL_EXECUTION_FAILED: 'avito.tool.execution.failed',

  // Enhanced health monitoring events
  AVITO_HEALTH_CHECK_COMPLETED: 'avito.health.check.completed',
  AVITO_HEALTH_STATUS_CHANGED: 'avito.health.status.changed',
  AVITO_HEALTH_ALERT_TRIGGERED: 'avito.health.alert.triggered',
  AVITO_HEALTH_ALERT_RESOLVED: 'avito.health.alert.resolved',

  // Enhanced credential management events
  AVITO_CREDENTIALS_EXTRACTED: 'avito.credentials.extracted',
  AVITO_CREDENTIALS_VALIDATED: 'avito.credentials.validated',
  AVITO_CREDENTIALS_STORED: 'avito.credentials.stored',
  AVITO_CREDENTIALS_EXPIRED: 'avito.credentials.expired',
  AVITO_CREDENTIALS_REFRESHED: 'avito.credentials.refreshed',

  // Enhanced API integration events
  AVITO_API_CALL_STARTED: 'avito.api.call.started',
  AVITO_API_CALL_COMPLETED: 'avito.api.call.completed',
  AVITO_API_CALL_FAILED: 'avito.api.call.failed',
  AVITO_API_RATE_LIMITED: 'avito.api.rate.limited',
  AVITO_API_AUTHENTICATION_FAILED: 'avito.api.authentication.failed',

  // Enhanced analytics and insights events
  AVITO_ANALYTICS_UPDATED: 'avito.analytics.updated',
  AVITO_PREDICTION_GENERATED: 'avito.prediction.generated',
  AVITO_RISK_ASSESSMENT_COMPLETED: 'avito.risk.assessment.completed',
  AVITO_TREND_ANALYSIS_COMPLETED: 'avito.trend.analysis.completed',

  // Enhanced monitoring and alerting events
  AVITO_MONITORING_ALERT: 'avito.monitoring.alert',
  AVITO_MONITORING_ALERT_RESOLVED: 'avito.monitoring.alert.resolved',
  AVITO_PERFORMANCE_METRICS_UPDATED: 'avito.performance.metrics.updated',
  AVITO_DASHBOARD_DATA_UPDATED: 'avito.dashboard.data.updated',
} as const;

export type ConsolidatedBusinessSetupEventType =
  (typeof CONSOLIDATED_BUSINESS_SETUP_EVENTS)[keyof typeof CONSOLIDATED_BUSINESS_SETUP_EVENTS];

// ===============================================================
// CONSOLIDATED EVENT INTERFACES
// ===============================================================

/**
 * Base interface for all consolidated events
 */
export interface ConsolidatedEventPayload {
  userId: string;
  workspaceId: string;
  threadId?: string;
  timestamp: Date;
  eventId: string;
  version: string;
  metadata?: Record<string, any>;
}

/**
 * Enhanced workflow state events
 */
export interface AvitoWorkflowStartedEvent extends ConsolidatedEventPayload {
  workflowId: string;
  initialState: string;
  configuration: Record<string, any>;
  estimatedDuration?: number;
}

export interface AvitoWorkflowCompletedEvent extends ConsolidatedEventPayload {
  workflowId: string;
  finalState: string;
  duration: number;
  stepsCompleted: number;
  credentialsValidated: boolean;
  credentialsStored: boolean;
  performanceMetrics: {
    executionTime: number;
    apiCalls: number;
    errorCount: number;
    retryCount: number;
  };
}

export interface AvitoWorkflowStateChangedEvent
  extends ConsolidatedEventPayload {
  workflowId: string;
  fromState: string;
  toState: string;
  trigger: 'USER_INPUT' | 'API_RESPONSE' | 'TIMEOUT' | 'ERROR' | 'SYSTEM';
  transitionDuration: number;
  context?: Record<string, any>;
}

/**
 * Enhanced error recovery events
 */
export interface AvitoErrorDetectedEvent extends ConsolidatedEventPayload {
  errorId: string;
  errorType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  errorMessage: string;
  context: {
    workflowState: string;
    attemptCount: number;
    lastSuccessfulState?: string;
  };
  recoverable: boolean;
  stackTrace?: string;
}

export interface AvitoErrorRecoveryStartedEvent
  extends ConsolidatedEventPayload {
  errorId: string;
  errorType: string;
  recoveryStrategy: string;
  attemptCount: number;
  estimatedRecoveryTime?: number;
}

export interface AvitoErrorRecoveryCompletedEvent
  extends ConsolidatedEventPayload {
  errorId: string;
  success: boolean;
  recoveryMethod: string;
  recoveryDuration: number;
  newState?: string;
  requiresUserAction: boolean;
}

export interface AvitoErrorEscalatedEvent extends ConsolidatedEventPayload {
  errorId: string;
  escalationId: string;
  escalationLevel: 'SUPPORT' | 'ENGINEERING' | 'CRITICAL';
  automaticEscalation: boolean;
  escalationReason: string;
  supportNotified: boolean;
}

/**
 * Enhanced performance monitoring events
 */
export interface AvitoPerformanceThresholdExceededEvent
  extends ConsolidatedEventPayload {
  metric: string;
  currentValue: number;
  threshold: number;
  thresholdType: 'UPPER' | 'LOWER';
  severity: 'WARNING' | 'CRITICAL';
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  recommendation?: string;
}

export interface AvitoCircuitBreakerEvent extends ConsolidatedEventPayload {
  serviceName: string;
  isOpen: boolean;
  failureCount: number;
  lastFailure?: Date;
  recoveryAttempts: number;
  estimatedRecoveryTime?: number;
}

/**
 * Enhanced tool validation events
 */
export interface AvitoToolValidationEvent extends ConsolidatedEventPayload {
  toolName: string;
  validationType: 'PRE_EXECUTION' | 'POST_EXECUTION' | 'PERIODIC';
  validationResult: {
    success: boolean;
    errors?: string[];
    warnings?: string[];
    executionTime: number;
  };
  context: {
    workflowState: string;
    previousValidation?: Date;
    validationRules: string[];
  };
}

export interface AvitoToolExecutionEvent extends ConsolidatedEventPayload {
  toolName: string;
  executionId: string;
  parameters: Record<string, any>;
  result: {
    success: boolean;
    output?: any;
    error?: string;
    executionTime: number;
    retryCount: number;
  };
  performance: {
    memoryUsed: number;
    cpuTime: number;
    networkCalls: number;
  };
}

/**
 * Enhanced health monitoring events
 */
export interface AvitoHealthCheckCompletedEvent
  extends ConsolidatedEventPayload {
  healthCheckId: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
  checkDuration: number;
  componentResults: Array<{
    component: string;
    status: string;
    responseTime: number;
    error?: string;
  }>;
  previousStatus?: string;
  statusChanged: boolean;
}

export interface AvitoHealthAlertEvent extends ConsolidatedEventPayload {
  alertId: string;
  alertType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  component?: string;
  currentValue?: number;
  threshold?: number;
  trend?: string;
  resolved: boolean;
  resolutionTime?: number;
  actionRequired: boolean;
}

/**
 * Enhanced credential management events
 */
export interface AvitoCredentialsEvent extends ConsolidatedEventPayload {
  credentialType:
    | 'CLIENT_ID'
    | 'CLIENT_SECRET'
    | 'ACCESS_TOKEN'
    | 'REFRESH_TOKEN';
  action:
    | 'EXTRACTED'
    | 'VALIDATED'
    | 'STORED'
    | 'EXPIRED'
    | 'REFRESHED'
    | 'DELETED';
  result: {
    success: boolean;
    error?: string;
    validationMethod?: string;
    storageLocation?: string;
    expirationTime?: Date;
  };
  securityContext: {
    encrypted: boolean;
    auditLogged: boolean;
    integrityVerified: boolean;
  };
}

/**
 * Enhanced API integration events
 */
export interface AvitoApiCallEvent extends ConsolidatedEventPayload {
  callId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  parameters?: Record<string, any>;
  result: {
    success: boolean;
    statusCode: number;
    responseTime: number;
    responseSize?: number;
    error?: string;
    retryCount: number;
  };
  rateLimitInfo?: {
    remaining: number;
    resetTime: Date;
    limit: number;
  };
}

/**
 * Enhanced analytics and insights events
 */
export interface AvitoAnalyticsEvent extends ConsolidatedEventPayload {
  analysisType:
    | 'PERFORMANCE'
    | 'ERROR_PATTERNS'
    | 'USER_BEHAVIOR'
    | 'PREDICTIVE'
    | 'RISK_ASSESSMENT';
  analysisResult: {
    insights: Array<{
      type: string;
      description: string;
      confidence: number;
      actionable: boolean;
      recommendation?: string;
    }>;
    metrics: Record<string, number>;
    trends: Record<string, 'IMPROVING' | 'DEGRADING' | 'STABLE'>;
    predictions?: Array<{
      metric: string;
      predictedValue: number;
      confidence: number;
      timeframe: string;
    }>;
  };
  dataWindow: {
    startTime: Date;
    endTime: Date;
    sampleSize: number;
  };
}

/**
 * Enhanced monitoring and alerting events
 */
export interface AvitoMonitoringAlertEvent extends ConsolidatedEventPayload {
  alertId: string;
  alertType: 'THRESHOLD' | 'ANOMALY' | 'PATTERN' | 'TREND' | 'SYSTEM';
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  title: string;
  description: string;
  affectedComponents: string[];
  metrics: Record<string, number>;
  triggers: Array<{
    condition: string;
    currentValue: number;
    threshold: number;
    operator: string;
  }>;
  resolution: {
    automatic: boolean;
    steps: string[];
    estimatedTime?: number;
  };
  escalation?: {
    level: number;
    notificationsSent: string[];
    nextEscalationAt?: Date;
  };
}

export interface AvitoPerformanceMetricsUpdatedEvent
  extends ConsolidatedEventPayload {
  metricsSnapshot: {
    executionTime: {
      average: number;
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    throughput: {
      requestsPerMinute: number;
      successRate: number;
      errorRate: number;
    };
    resources: {
      memoryUsage: number;
      cpuUsage: number;
      networkLatency: number;
      connectionCount: number;
    };
    health: {
      overallScore: number;
      componentScores: Record<string, number>;
      trend: 'IMPROVING' | 'DEGRADING' | 'STABLE';
    };
  };
  comparisonWithPrevious: {
    timeframe: string;
    significantChanges: Array<{
      metric: string;
      change: number;
      changePercent: number;
      significance: 'LOW' | 'MEDIUM' | 'HIGH';
    }>;
  };
}

// ===============================================================
// CONSOLIDATED EVENT UNION TYPES
// ===============================================================

export type ConsolidatedBusinessSetupEvent =
  | BusinessSetupEvent // Include all existing events
  | AvitoWorkflowStartedEvent
  | AvitoWorkflowCompletedEvent
  | AvitoWorkflowStateChangedEvent
  | AvitoErrorDetectedEvent
  | AvitoErrorRecoveryStartedEvent
  | AvitoErrorRecoveryCompletedEvent
  | AvitoErrorEscalatedEvent
  | AvitoPerformanceThresholdExceededEvent
  | AvitoCircuitBreakerEvent
  | AvitoToolValidationEvent
  | AvitoToolExecutionEvent
  | AvitoHealthCheckCompletedEvent
  | AvitoHealthAlertEvent
  | AvitoCredentialsEvent
  | AvitoApiCallEvent
  | AvitoAnalyticsEvent
  | AvitoMonitoringAlertEvent
  | AvitoPerformanceMetricsUpdatedEvent;

// ===============================================================
// CONSOLIDATED EVENT UTILITIES
// ===============================================================

/**
 * Enhanced event validation
 */
export function isValidConsolidatedEvent(
  event: any,
): event is ConsolidatedBusinessSetupEvent {
  return (
    event &&
    typeof event.userId === 'string' &&
    typeof event.workspaceId === 'string' &&
    event.timestamp instanceof Date &&
    typeof event.eventId === 'string' &&
    typeof event.version === 'string'
  );
}

/**
 * Event type guards for consolidated events
 */
export function isAvitoWorkflowEvent(
  event: ConsolidatedBusinessSetupEvent,
): event is
  | AvitoWorkflowStartedEvent
  | AvitoWorkflowCompletedEvent
  | AvitoWorkflowStateChangedEvent {
  return 'workflowId' in event;
}

export function isAvitoErrorEvent(
  event: ConsolidatedBusinessSetupEvent,
): event is
  | AvitoErrorDetectedEvent
  | AvitoErrorRecoveryStartedEvent
  | AvitoErrorRecoveryCompletedEvent
  | AvitoErrorEscalatedEvent {
  return 'errorId' in event;
}

export function isAvitoPerformanceEvent(
  event: ConsolidatedBusinessSetupEvent,
): event is
  | AvitoPerformanceThresholdExceededEvent
  | AvitoPerformanceMetricsUpdatedEvent {
  return 'metric' in event || 'metricsSnapshot' in event;
}

export function isAvitoHealthEvent(
  event: ConsolidatedBusinessSetupEvent,
): event is AvitoHealthCheckCompletedEvent | AvitoHealthAlertEvent {
  return (
    'healthCheckId' in event || ('alertId' in event && 'component' in event)
  );
}

export function isAvitoToolEvent(
  event: ConsolidatedBusinessSetupEvent,
): event is AvitoToolValidationEvent | AvitoToolExecutionEvent {
  return 'toolName' in event;
}

/**
 * Event routing and subscription utilities
 */
export class ConsolidatedEventRouter {
  /**
   * Route event to appropriate channels based on event type and content
   */
  static routeEvent(eventType: ConsolidatedBusinessSetupEventType): string[] {
    const channels: string[] = [];

    // Add to main consolidated channel
    channels.push('consolidated.business.setup.events');

    // Add to category-specific channels
    if (eventType.startsWith('avito.workflow.')) {
      channels.push('avito.workflow.events');
    }

    if (eventType.startsWith('avito.error.')) {
      channels.push('avito.error.events');
    }

    if (eventType.startsWith('avito.performance.')) {
      channels.push('avito.performance.events');
    }

    if (eventType.startsWith('avito.health.')) {
      channels.push('avito.health.events');
    }

    if (eventType.startsWith('avito.tool.')) {
      channels.push('avito.tool.events');
    }

    if (eventType.startsWith('avito.api.')) {
      channels.push('avito.api.events');
    }

    if (eventType.startsWith('avito.credentials.')) {
      channels.push('avito.credentials.events');
    }

    if (eventType.startsWith('avito.analytics.')) {
      channels.push('avito.analytics.events');
    }

    if (eventType.startsWith('avito.monitoring.')) {
      channels.push('avito.monitoring.events');
    }

    return channels;
  }

  /**
   * Get priority-based channels for critical events
   */
  static getPriorityChannels(event: ConsolidatedBusinessSetupEvent): string[] {
    const channels: string[] = [];

    // Critical error events
    if (
      isAvitoErrorEvent(event) &&
      'severity' in event &&
      event.severity === 'CRITICAL'
    ) {
      channels.push('critical.alerts');
    }

    // Critical health events
    if (
      isAvitoHealthEvent(event) &&
      'severity' in event &&
      event.severity === 'CRITICAL'
    ) {
      channels.push('critical.health.alerts');
    }

    // Circuit breaker events
    if ('serviceName' in event && 'isOpen' in event) {
      channels.push('circuit.breaker.alerts');
    }

    return channels;
  }

  /**
   * Get user and workspace specific channels
   */
  static getUserSpecificChannels(
    userId: string,
    workspaceId: string,
  ): string[] {
    return [
      `user:${userId}:consolidated.events`,
      `workspace:${workspaceId}:consolidated.events`,
      `user:${userId}:workspace:${workspaceId}:events`,
    ];
  }
}

/**
 * Event factory for creating standardized consolidated events
 */
export class ConsolidatedEventFactory {
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getEventVersion(): string {
    return '3.0.0-consolidated';
  }

  /**
   * Create base event payload
   */
  static createBasePayload(
    userId: string,
    workspaceId: string,
    threadId?: string,
    metadata?: Record<string, any>,
  ): ConsolidatedEventPayload {
    return {
      userId,
      workspaceId,
      threadId,
      timestamp: new Date(),
      eventId: this.generateEventId(),
      version: this.getEventVersion(),
      metadata,
    };
  }

  /**
   * Create workflow state changed event
   */
  static createWorkflowStateChangedEvent(
    userId: string,
    workspaceId: string,
    workflowId: string,
    fromState: string,
    toState: string,
    trigger: AvitoWorkflowStateChangedEvent['trigger'],
    transitionDuration: number,
    threadId?: string,
    context?: Record<string, any>,
  ): AvitoWorkflowStateChangedEvent {
    return {
      ...this.createBasePayload(userId, workspaceId, threadId),
      workflowId,
      fromState,
      toState,
      trigger,
      transitionDuration,
      context,
    };
  }

  /**
   * Create error detected event
   */
  static createErrorDetectedEvent(
    userId: string,
    workspaceId: string,
    errorType: string,
    severity: AvitoErrorDetectedEvent['severity'],
    errorMessage: string,
    workflowState: string,
    attemptCount: number,
    recoverable: boolean,
    threadId?: string,
    stackTrace?: string,
  ): AvitoErrorDetectedEvent {
    return {
      ...this.createBasePayload(userId, workspaceId, threadId),
      errorId: `err_${this.generateEventId()}`,
      errorType,
      severity,
      errorMessage,
      context: {
        workflowState,
        attemptCount,
      },
      recoverable,
      stackTrace,
    };
  }

  /**
   * Create performance threshold exceeded event
   */
  static createPerformanceThresholdExceededEvent(
    userId: string,
    workspaceId: string,
    metric: string,
    currentValue: number,
    threshold: number,
    thresholdType: AvitoPerformanceThresholdExceededEvent['thresholdType'],
    severity: AvitoPerformanceThresholdExceededEvent['severity'],
    trend: AvitoPerformanceThresholdExceededEvent['trend'],
    threadId?: string,
    recommendation?: string,
  ): AvitoPerformanceThresholdExceededEvent {
    return {
      ...this.createBasePayload(userId, workspaceId, threadId),
      metric,
      currentValue,
      threshold,
      thresholdType,
      severity,
      trend,
      recommendation,
    };
  }

  /**
   * Create health alert event
   */
  static createHealthAlertEvent(
    userId: string,
    workspaceId: string,
    alertType: string,
    severity: AvitoHealthAlertEvent['severity'],
    message: string,
    resolved: boolean,
    threadId?: string,
    component?: string,
    currentValue?: number,
    threshold?: number,
  ): AvitoHealthAlertEvent {
    return {
      ...this.createBasePayload(userId, workspaceId, threadId),
      alertId: `alert_${this.generateEventId()}`,
      alertType,
      severity,
      message,
      component,
      currentValue,
      threshold,
      resolved,
      actionRequired: severity === 'ERROR' || severity === 'CRITICAL',
    };
  }
}
