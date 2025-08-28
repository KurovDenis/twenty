# Business Setup Module - Supervisor SGR Architecture Documentation

## Overview

The Business Setup Module implements a sophisticated Schema-Guided Reasoning (SGR) architecture with supervisor agents to handle complex business setup workflows. This document details the module dependencies, service registration patterns, and event-driven architecture implemented to resolve circular dependencies.

## Architecture Components

### Core Services

#### 1. SupervisorSGRService
- **Purpose**: Central orchestrator for business setup reasoning workflows
- **Dependencies**: 
  - UserVarsService (for state management)
  - AgentChatService (for conversation handling)
  - AiModelRegistryService (for AI model access)
  - SupervisorToolDispatcherService (for tool execution)
  - EventEmitter2 (for event-driven communication)

#### 2. SupervisorToolDispatcherService
- **Purpose**: Routes and executes specialized tools based on business setup status
- **Dependencies**:
  - UserVarsService (for status tracking)
  - AgentChatService (for message routing)
  - BusinessSetupAgentService (for agent management)
  - AvitoWelcomeSGRService (for welcome flow)
  - EventEmitter2 (for status events)

#### 3. AvitoWelcomeSGRService
- **Purpose**: Handles welcome workflow with streaming responses
- **Dependencies**:
  - UserVarsService (for user state)
  - AgentChatService (for conversations)
  - AiModelRegistryService (for AI models)

## Module Registration Pattern

### Service Registration Order
The services are registered in a specific order to prevent circular dependencies:

```typescript
@Module({
  providers: [
    // 1. Tool dispatcher first (no circular dependencies)
    SupervisorToolDispatcherService,
    
    // 2. Supervisor service second (depends on dispatcher)
    SupervisorSGRService,
    
    // 3. Specialized SGR services
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
  ],
})
export class BusinessSetupModule {}
```

### Key Registration Principles

1. **Dependency-First Registration**: Services with fewer dependencies are registered first
2. **Event-Driven Decoupling**: Complex dependencies use event emission instead of direct injection
3. **Forward References**: Use `forwardRef()` for essential but circular dependencies
4. **Service Isolation**: Each service has a single, well-defined responsibility

## Event-Driven Architecture

### Core Events

#### SUPERVISOR_PROCESS_MESSAGE
```typescript
interface SupervisorProcessMessageEvent {
  userId: string;
  workspaceId: string;
  threadId: string;
  message: string;
  timestamp: Date;
}
```

#### SUPERVISOR_AGENT_HANDOFF
```typescript
interface SupervisorAgentHandoffEvent {
  userId: string;
  workspaceId: string;
  threadId: string;
  fromAgent: string;
  toAgent: string;
  context: any;
  timestamp: Date;
}
```

### Event Flow Patterns

1. **Request Processing**: Messages trigger events instead of direct method calls
2. **Status Changes**: State transitions emit events for loose coupling
3. **Agent Routing**: Handoffs between agents use event-driven communication
4. **Error Propagation**: Errors are handled locally and emit status events

## Dependency Resolution Strategy

### Problem Identification
The original circular dependency occurred because:
- SupervisorSGRService needed SupervisorToolDispatcherService for tool execution
- SupervisorToolDispatcherService needed various SGR services for routing
- This created a circular dependency chain that prevented module initialization

### Solution Implementation

#### 1. Event-Driven Decoupling
```typescript
// Instead of direct injection:
// constructor(private supervisorService: SupervisorSGRService) // CIRCULAR!

// Use event emission:
this.eventEmitter.emit(BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE, {
  userId,
  workspaceId,
  threadId,
  message,
  timestamp: new Date()
});
```

#### 2. Dependency Inversion
```typescript
// Tool dispatcher handles the complex routing logic
// Supervisor service focuses on reasoning and coordination
// Each service has a clear, single responsibility
```

#### 3. Lazy Resolution
Services that might have circular dependencies use event listeners that are registered after all services are initialized.

## Service Interfaces and Contracts

### SupervisorToolDispatcherService Interface
```typescript
interface ToolDispatchMethods {
  dispatch(tool: SupervisorStepResult['function'], userId: string, workspaceId: string): Promise<SupervisorToolExecutionResult>;
  checkBusinessSetupStatus(userId: string, workspaceId: string): Promise<BusinessSetupStatusResult>;
  routeToSpecializedAgent(status: BusinessSetupStatus, message: string, userId: string, workspaceId: string, threadId: string, reason: string): Promise<RoutingResult>;
  statusChange(fromStatus: BusinessSetupStatus, toStatus: BusinessSetupStatus, userId: string, workspaceId: string, reason: string, triggerEvent: string): Promise<void>;
}
```

### SupervisorSGRService Interface
```typescript
interface SupervisorSGRMethods {
  processMessageWithStreaming(userId: string, workspaceId: string, threadId: string, message: string): AsyncGenerator<SupervisorSGRStreamingResult>;
  handleProcessMessageEvent(event: SupervisorProcessMessageEvent): Promise<void>;
}
```

## Error Handling Patterns

### SupervisorException
```typescript
class SupervisorException extends Error {
  constructor(
    message: string,
    public errorType: SupervisorErrorType,
    public context?: any
  ) {
    super(message);
    this.name = 'SupervisorException';
  }
}
```

### Error Types
- `INVALID_TOOL`: Unknown or malformed tool requests
- `ROUTING_FAILED`: Agent routing failures
- `STATUS_TRANSITION_ERROR`: Invalid status changes
- `DEPENDENCY_ERROR`: Service dependency failures

### Recovery Strategies
1. **Graceful Degradation**: Default to safe states when services fail
2. **Retry Logic**: Automatic retry for transient failures
3. **Fallback Responses**: Default responses when AI services are unavailable
4. **Event-Based Recovery**: Use events to coordinate recovery across services

## Testing Strategy

### Unit Tests
- Individual service functionality
- Mocked dependencies
- Error scenario coverage
- Edge case validation

### Integration Tests
- End-to-end workflow testing
- Dependency injection validation
- Event flow verification
- Cross-service communication

### Error Scenario Tests
- Dependency failure recovery
- Network error handling
- Partial transaction failures
- Resource cleanup validation

## Performance Considerations

### Memory Management
- Services properly clean up resources on destruction
- Event listeners are removed when services are destroyed
- No memory leaks in long-running operations

### Concurrency
- Services handle concurrent requests safely
- No resource conflicts between parallel operations
- Proper async/await usage throughout

### Scalability
- Event-driven architecture supports horizontal scaling
- Services can be deployed independently
- State is externalized to UserVarsService

## Deployment and Monitoring

### Health Checks
```typescript
// Service health validation
async function validateServiceHealth(): Promise<boolean> {
  try {
    // Check critical dependencies
    await userVarsService.get('health-check', 'health-check', 'health-check');
    await agentChatService.getMessages('health-check');
    return true;
  } catch (error) {
    return false;
  }
}
```

### Metrics and Monitoring
- Service initialization timing
- Event emission/handling rates
- Error rates by service and error type
- Tool dispatch success/failure rates

## Migration Guide

### From Direct Dependencies to Event-Driven
1. Identify circular dependency chains
2. Replace direct injections with event emissions
3. Add event listeners for service communication
4. Update service registration order
5. Add comprehensive error handling
6. Validate with integration tests

### Best Practices
1. **Single Responsibility**: Each service should have one clear purpose
2. **Event-First**: Use events for complex inter-service communication
3. **Error Isolation**: Handle errors locally and emit status events
4. **Test Coverage**: Comprehensive testing including error scenarios
5. **Documentation**: Clear service contracts and dependency documentation

## Troubleshooting

### Common Issues

#### Circular Dependency Errors
- **Symptom**: Module fails to initialize with circular dependency error
- **Solution**: Check service registration order and use event-driven patterns

#### Event Handler Failures
- **Symptom**: Events are emitted but not handled
- **Solution**: Verify event listener registration after service initialization

#### Service Timeout Errors
- **Symptom**: Operations hang or timeout
- **Solution**: Check for missing error handling and ensure async operations complete

### Debug Techniques
1. Enable verbose logging for service initialization
2. Monitor event emission and handling
3. Use dependency injection debugging tools
4. Validate service health endpoints

## Future Enhancements

### Planned Improvements
1. **Service Mesh Integration**: For better inter-service communication
2. **Circuit Breaker Pattern**: For improved resilience
3. **Distributed Tracing**: For better observability
4. **Auto-Recovery Mechanisms**: For handling service failures

### Extension Points
- Additional SGR services can be added following the same patterns
- New business setup statuses can be registered
- Custom error handling strategies can be implemented
- Additional monitoring and metrics can be integrated