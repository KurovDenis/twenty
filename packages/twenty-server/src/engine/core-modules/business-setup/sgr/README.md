# Business Setup SGR (Schema-Guided Reasoning) Module

## Quick Start

The SGR module provides intelligent business setup assistance through supervisor agents and specialized reasoning workflows.

### Key Services

- **SupervisorSGRService**: Main orchestrator for business setup reasoning
- **SupervisorToolDispatcherService**: Routes requests to appropriate specialized agents
- **AvitoWelcomeSGRService**: Handles welcome workflow for Avito integration

### Usage Example

```typescript
// Inject the supervisor service
constructor(
  private supervisorService: SupervisorSGRService,
  private toolDispatcher: SupervisorToolDispatcherService
) {}

// Process user message with detailed SGR streaming (event-based)
const streamingResponse = this.supervisorService.processMessageWithDetailedStreaming(
  "Help me set up my business",
  userId,
  workspaceId,
  threadId
);

for await (const result of streamingResponse) {
  console.log(result);
}

// Check business setup status
const status = await this.toolDispatcher.checkBusinessSetupStatus(userId, workspaceId);
console.log(`Current status: ${status.status}`);
```

## Module Architecture

### Event-Driven Design
The module uses an event-driven architecture to prevent circular dependencies:

```typescript
// Events emitted by the supervisor system
BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE
BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF
BUSINESS_SETUP_EVENTS.SUPERVISOR_STATUS_CHANGE
```

### Service Dependencies
```
SupervisorSGRService
├── UserVarsService
├── AgentChatService
├── AiModelRegistryService
├── SupervisorToolDispatcherService (via events)
└── EventEmitter2

SupervisorToolDispatcherService
├── UserVarsService
├── AgentChatService
├── BusinessSetupAgentService
├── AvitoWelcomeSGRService
└── EventEmitter2
```

## Development

### Adding New Tools
1. Define tool interface in `supervisor-types.ts`
2. Implement tool logic in `SupervisorToolDispatcherService`
3. Add error handling for the new tool
4. Write comprehensive tests

### Adding New SGR Services
1. Create service extending base SGR patterns
2. Register in `BusinessSetupModule` providers
3. Update tool dispatcher routing logic
4. Add integration tests

### Running Tests

```bash
# Unit tests
npm test -- --testPathPattern="supervisor.*\.spec\.ts"

# Integration tests
npm test -- --testPathPattern="supervisor-integration\.spec\.ts"

# Error scenario tests
npm test -- --testPathPattern="supervisor-error-scenarios\.spec\.ts"
```

## API Reference

### SupervisorToolDispatcherService

#### `dispatch(tool, userId, workspaceId)`
Executes a tool based on supervisor reasoning output.

**Parameters:**
- `tool`: SupervisorStepResult['function'] - Tool definition from reasoning
- `userId`: string - User identifier
- `workspaceId`: string - Workspace identifier

**Returns:** `Promise<SupervisorToolExecutionResult>`

#### `checkBusinessSetupStatus(userId, workspaceId)`
Checks current business setup progress.

**Returns:** `Promise<BusinessSetupStatusResult>`

#### `routeToSpecializedAgent(status, message, userId, workspaceId, threadId, reason)`
Routes user to appropriate specialized agent.

**Returns:** `Promise<RoutingResult>`

### SupervisorSGRService

#### `processMessageWithDetailedStreaming(message, userId, workspaceId, threadId)`
Processes user message with detailed SGR streaming events.

**Returns:** `AsyncGenerator<SGRStreamEvent>`

## Error Handling

### SupervisorException
Custom exception type for supervisor-specific errors:

```typescript
try {
  await toolDispatcher.dispatch(tool, userId, workspaceId);
} catch (error) {
  if (error instanceof SupervisorException) {
    console.log(`Supervisor error: ${error.errorType}`);
    console.log(`Context:`, error.context);
  }
}
```

### Error Types
- `INVALID_TOOL`: Unknown tool type
- `ROUTING_FAILED`: Agent routing failure
- `STATUS_TRANSITION_ERROR`: Invalid status change
- `DEPENDENCY_ERROR`: Service dependency failure

## Configuration

### Environment Variables
- `AI_MODEL_PROVIDER`: AI service provider (default: openai)
- `BUSINESS_SETUP_DEFAULT_STATUS`: Default status for new users
- `EVENT_EMITTER_MAX_LISTENERS`: Max event listeners (default: 100)

### Service Configuration
Services are configured through the NestJS dependency injection system. See `business-setup.module.ts` for provider registration.

## Monitoring

### Health Checks
The module includes health check endpoints:

```typescript
GET /healthz/business-setup-sgr
```

### Metrics
- Tool dispatch success/failure rates
- Event emission/handling performance
- Service dependency health
- User workflow completion rates

## Troubleshooting

### Common Issues

1. **Circular Dependency Error**
   - Check service registration order in module
   - Ensure event-driven patterns are used correctly

2. **Tool Dispatch Failures**
   - Verify tool definition matches expected interface
   - Check service dependencies are available

3. **Event Handler Not Triggered**
   - Confirm event listeners are registered after service init
   - Check event name constants match emission calls

### Debug Mode
Enable detailed logging:

```typescript
process.env.LOG_LEVEL = 'debug';
```

### Testing in Development
Use the test endpoints for simulating workflows:

```bash
curl -X GET "http://localhost:3000/ai-agent/test/simulate-welcome?userId=test&workspaceId=test"
```

## Contributing

### Code Style
- Follow NestJS conventions
- Use TypeScript strict mode
- Add JSDoc comments for public methods
- Include comprehensive error handling

### Testing Requirements
- Unit tests for all public methods
- Integration tests for service interactions
- Error scenario tests for failure modes
- Minimum 90% code coverage

### Pull Request Process
1. Add/update tests for changes
2. Update documentation as needed
3. Ensure all tests pass
4. Verify no new circular dependencies introduced

## Related Documentation

- [Architecture Documentation](./ARCHITECTURE.md) - Detailed technical architecture
- [NestJS Documentation](https://docs.nestjs.com/) - Framework documentation
- [Business Setup Module](../README.md) - Parent module documentation

## Support

For issues and questions:
1. Check troubleshooting section above
2. Review test files for usage examples
3. Consult architecture documentation for complex scenarios