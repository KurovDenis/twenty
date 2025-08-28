# NestJS Module Dependency Resolution Design

## Overview

This design document addresses a critical NestJS dependency injection error in the Twenty CRM Business Setup workflow and provides a comprehensive solution for managing complex module dependencies in a microservices architecture.

**Problem Statement**: The `BusinessSetupService` requires `SupervisorSGRService` but cannot resolve its dependencies due to incomplete module registration, causing application startup failures.

**Target System**: Twenty CRM Backend (NestJS-based microservices architecture)

**Error Context**:
```
Nest can't resolve dependencies of the BusinessSetupService (UserVarsService, OnboardingService, ?). 
Please make sure that the argument SupervisorSGRService at index [2] is available in the BusinessSetupModule context.
```

## Architecture

### Current Module Structure Analysis

```mermaid
graph TB
    subgraph "BusinessSetupModule"
        BSS["BusinessSetupService"]
        BSR["BusinessSetupResolver"]
        BSSR["BusinessSetupSubscriptionsResolver"]
        BSWA["BusinessSetupWelcomeAgentService"]
        BSAS["BusinessSetupAgentService"]
        AWS["AvitoWelcomeSGRService"]
        AWTDS["AvitoWelcomeToolDispatcherService"]
    end
    
    subgraph "Missing Providers"
        SSGS["SupervisorSGRService"]
        STDS["SupervisorToolDispatcherService"]
    end
    
    subgraph "External Dependencies"
        UVS["UserVarsService"]
        OS["OnboardingService"]
        ACS["AgentChatService"]
        AMRS["AiModelRegistryService"]
        EE["EventEmitter2"]
    end
    
    BSS --> SSGS
    SSGS --> STDS
    SSGS --> UVS
    SSGS --> ACS
    SSGS --> AMRS
    SSGS --> EE
    STDS --> UVS
    STDS --> ACS
    STDS --> AWS
    
    style SSGS fill:#ff9999
    style STDS fill:#ff9999
```

### Target Architecture - Resolved Dependencies

```mermaid
graph TB
    subgraph "BusinessSetupModule - Updated"
        BSS["BusinessSetupService"]
        BSR["BusinessSetupResolver"]
        BSSR["BusinessSetupSubscriptionsResolver"]
        BSWA["BusinessSetupWelcomeAgentService"]
        BSAS["BusinessSetupAgentService"]
        AWS["AvitoWelcomeSGRService"]
        AWTDS["AvitoWelcomeToolDispatcherService"]
        SSGS["SupervisorSGRService"]
        STDS["SupervisorToolDispatcherService"]
    end
    
    subgraph "Imported Modules"
        UM["UserVarsModule"]
        OM["OnboardingModule"]
        AM["AgentModule"]
        AIM["AiModule"]
        EM["EventEmitterModule"]
    end
    
    BSS --> SSGS
    SSGS --> STDS
    SSGS -.-> UM
    SSGS -.-> AM
    SSGS -.-> AIM
    SSGS -.-> EM
    STDS -.-> UM
    STDS -.-> AM
    STDS --> AWS
    
    style SSGS fill:#99ff99
    style STDS fill:#99ff99
```

## Module Dependency Resolution Strategy

### 1. Service Registration Matrix

| Service | Dependencies | Module Location | Registration Status |
|---------|-------------|-----------------|-------------------|
| BusinessSetupService | UserVarsService, OnboardingService, SupervisorSGRService | BusinessSetupModule | ✅ Registered |
| SupervisorSGRService | UserVarsService, AgentChatService, AiModelRegistryService, SupervisorToolDispatcherService, EventEmitter2 | BusinessSetupModule | ❌ Missing |
| SupervisorToolDispatcherService | UserVarsService, AgentChatService, BusinessSetupAgentService, AvitoWelcomeSGRService, EventEmitter2 | BusinessSetupModule | ❌ Missing |

### 2. Dependency Chain Analysis

```mermaid
graph LR
    BSS["BusinessSetupService"] --> SSGS["SupervisorSGRService"]
    SSGS --> STDS["SupervisorToolDispatcherService"]
    SSGS --> UVS["UserVarsService"]
    SSGS --> ACS["AgentChatService"]
    SSGS --> AMRS["AiModelRegistryService"]
    SSGS --> EE2["EventEmitter2"]
    STDS --> UVS2["UserVarsService"]
    STDS --> ACS2["AgentChatService"]
    STDS --> BSAS["BusinessSetupAgentService"]
    STDS --> AWS["AvitoWelcomeSGRService"]
    STDS --> EE3["EventEmitter2"]
    
    style BSS fill:#e1f5fe
    style SSGS fill:#fff3e0
    style STDS fill:#f3e5f5
```

### 3. Module Import Requirements

```mermaid
graph TB
    subgraph "BusinessSetupModule Imports"
        TOM["TypeOrmModule"]
        UVM["UserVarsModule"]
        ONM["OnboardingModule"]
        TM["TokenModule"]
        WCSM["WorkspaceCacheStorageModule"]
        SM["SubscriptionsModule"]
        AIM["AiModule"]
        AGM["AgentModule"]
        UM["UserModule"]
        WM["WorkspaceModule"]
    end
    
    subgraph "Required Services"
        UVS["UserVarsService"]
        ACS["AgentChatService"]
        AMRS["AiModelRegistryService"]
        EE["EventEmitter2"]
    end
    
    UVM --> UVS
    AGM --> ACS
    AIM --> AMRS
    SM --> EE
    
    style UVS fill:#c8e6c9
    style ACS fill:#c8e6c9
    style AMRS fill:#c8e6c9
    style EE fill:#c8e6c9
```

## Supervisor SGR Service Architecture

### 1. Service Responsibilities

```mermaid
graph TB
    subgraph "SupervisorSGRService"
        PMW["processMessageWithStreaming()"]
        ESW["executeSGRWorkflowWithStreaming()"]
        ERS["executeReasoningStep()"]
    end
    
    subgraph "SupervisorToolDispatcherService"
        DIS["dispatch()"]
        CBS["checkBusinessSetupStatus()"]
        RTSA["routeToSpecializedAgent()"]
        PD["processDirectly()"]
        SC["statusChange()"]
        CR["completeRouting()"]
    end
    
    subgraph "External Services"
        UVS["UserVarsService"]
        ACS["AgentChatService"]
        AMRS["AiModelRegistryService"]
        EE["EventEmitter2"]
        BSAS["BusinessSetupAgentService"]
        AWS["AvitoWelcomeSGRService"]
    end
    
    PMW --> ESW
    ESW --> ERS
    ERS --> DIS
    DIS --> CBS
    DIS --> RTSA
    DIS --> PD
    DIS --> SC
    DIS --> CR
    
    CBS --> UVS
    RTSA --> ACS
    RTSA --> BSAS
    RTSA --> AWS
    SC --> UVS
    ERS --> AMRS
    PMW --> EE
```

### 2. Schema-Guided Reasoning Workflow

```mermaid
sequenceDiagram
    participant BS as BusinessSetupService
    participant SS as SupervisorSGRService
    participant TD as ToolDispatcherService
    participant AI as AiModelRegistryService
    participant UV as UserVarsService
    participant EE as EventEmitter2
    
    BS->>SS: processMessageWithStreaming()
    SS->>AI: getModel()
    SS->>SS: executeSGRWorkflowWithStreaming()
    loop SGR Steps
        SS->>AI: generateObject(schema)
        AI-->>SS: SupervisorStepResult
        SS->>TD: dispatch(tool)
        TD->>UV: get/set userVars
        TD-->>SS: ToolExecutionResult
        SS->>EE: emit events
    end
    SS-->>BS: AsyncGenerator<SGRResult>
```

## Module Configuration Solution

### 1. BusinessSetupModule Provider Registration

```typescript
// Updated BusinessSetupModule Configuration
@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity], 'core'),
    UserVarsModule, 
    OnboardingModule, 
    TokenModule, 
    WorkspaceCacheStorageModule,
    SubscriptionsModule,
    AiModule,
    AgentModule,
    forwardRef(() => UserModule),
    WorkspaceModule,
  ],
  providers: [
    // Core services
    BusinessSetupService, 
    BusinessSetupResolver,
    BusinessSetupSubscriptionsResolver,
    BusinessSetupWelcomeAgentService,
    BusinessSetupAgentService,
    BusinessSetupChatContinuationService,
    BusinessSetupTransitionService,
    BusinessSetupChatResolver,
    EventEmitterBridgeService,
    
    // SGR services - EXISTING
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
    
    // SGR services - NEW ADDITIONS
    SupervisorSGRService,
    SupervisorToolDispatcherService,
    
    // Tools
    HttpTool,
  ],
  exports: [
    BusinessSetupService,
    BusinessSetupWelcomeAgentService,
    BusinessSetupAgentService,
    BusinessSetupChatContinuationService,
    BusinessSetupTransitionService,
    EventEmitterBridgeService,
    
    // SGR services for external use
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
    SupervisorSGRService,
    SupervisorToolDispatcherService,
  ],
})
```

### 2. Dependency Injection Validation

```mermaid
graph TD
    subgraph "Validation Checklist"
        A["✅ SupervisorSGRService added to providers"]
        B["✅ SupervisorToolDispatcherService added to providers"]
        C["✅ All required modules imported"]
        D["✅ Circular dependencies resolved with forwardRef"]
        E["✅ Services exported for external use"]
    end
    
    subgraph "Import Validation"
        F["✅ UserVarsModule → UserVarsService"]
        G["✅ AgentModule → AgentChatService"]
        H["✅ AiModule → AiModelRegistryService"]
        I["✅ SubscriptionsModule → EventEmitter2"]
    end
    
    A --> F
    B --> G
    B --> H
    A --> I
```

## Business Logic Layer Integration

### 1. Supervisor Routing Decision Flow

```mermaid
flowchart TD
    START([User Message Received])
    
    CHECK_STATUS{Check Business Setup Status}
    CHECK_STATUS -->|WELCOME| ROUTE_AVITO[Route to SGR Avito Agent]
    CHECK_STATUS -->|BUSINESS_ANALYSIS| ROUTE_ANALYSIS[Route to Business Analysis Agent]
    CHECK_STATUS -->|SALES_FUNNEL| ROUTE_FUNNEL[Route to Sales Funnel Agent]
    CHECK_STATUS -->|AGENT_SETUP| ROUTE_AGENT[Route to Agent Setup Service]
    CHECK_STATUS -->|OTHER| ROUTE_DEFAULT[Route to Default Handler]
    
    ROUTE_AVITO --> EMIT_HANDOFF[Emit Agent Handoff Event]
    ROUTE_ANALYSIS --> EMIT_HANDOFF
    ROUTE_FUNNEL --> EMIT_HANDOFF
    ROUTE_AGENT --> EMIT_HANDOFF
    ROUTE_DEFAULT --> PROCESS_DIRECT[Process Directly]
    
    EMIT_HANDOFF --> UPDATE_STATUS{Status Change Needed?}
    UPDATE_STATUS -->|Yes| TRIGGER_TRANSITION[Trigger Status Transition]
    UPDATE_STATUS -->|No| COMPLETE[Complete Routing]
    
    TRIGGER_TRANSITION --> COMPLETE
    PROCESS_DIRECT --> COMPLETE
    
    COMPLETE --> END([End])
    
    style START fill:#e3f2fd
    style CHECK_STATUS fill:#fff3e0
    style COMPLETE fill:#e8f5e8
    style END fill:#e3f2fd
```

### 2. Event-Driven Architecture Integration

```mermaid
graph LR
    subgraph "Event Sources"
        SS["SupervisorSGRService"]
        TD["ToolDispatcherService"]
        BS["BusinessSetupService"]
    end
    
    subgraph "Event Types"
        TSE["Thinking Step Events"]
        RCE["Routing Completed Events"]
        AHE["Agent Handoff Events"]
        STE["Status Transition Events"]
        ERE["Error Events"]
    end
    
    subgraph "Event Handlers"
        CSR["Chat Service Resolver"]
        SSR["Subscriptions Resolver"]
        FEH["Frontend Event Handler"]
    end
    
    SS --> TSE
    SS --> RCE
    SS --> ERE
    TD --> AHE
    TD --> STE
    BS --> RCE
    
    TSE --> CSR
    RCE --> SSR
    AHE --> CSR
    STE --> FEH
    ERE --> SSR
```

## Testing Strategy

### 1. Unit Testing Architecture

| Test Category | Focus Area | Mock Dependencies |
|---------------|------------|-------------------|
| Service Registration | Module instantiation | All external services |
| Dependency Injection | Constructor parameters | Provider tokens |
| SGR Workflow | Streaming results | AI model responses |
| Tool Dispatch | Tool execution logic | External service calls |
| Event Emission | Event payload validation | EventEmitter2 |

### 2. Integration Testing Flow

```mermaid
graph TB
    subgraph "Integration Test Scenarios"
        INIT["Module Initialization Test"]
        DEP["Dependency Resolution Test"]
        MSG["Message Processing Test"]
        ROUTE["Routing Logic Test"]
        EVENT["Event Flow Test"]
    end
    
    subgraph "Test Dependencies"
        MOCK["Mock Services"]
        STUB["Service Stubs"]
        SPY["Method Spies"]
    end
    
    INIT --> DEP
    DEP --> MSG
    MSG --> ROUTE
    ROUTE --> EVENT
    
    INIT -.-> MOCK
    DEP -.-> STUB
    MSG -.-> SPY
    ROUTE -.-> SPY
    EVENT -.-> SPY
```

### 3. Error Handling Validation

```mermaid
graph TD
    subgraph "Error Scenarios"
        MISSING_DEP["Missing Dependency"]
        CIRCULAR_DEP["Circular Dependency"]
        SERVICE_FAIL["Service Instantiation Failure"]
        RUNTIME_ERROR["Runtime Injection Error"]
    end
    
    subgraph "Error Responses"
        STARTUP_FAIL["Application Startup Failure"]
        INJECTION_ERROR["Dependency Injection Error"]
        RECOVERY["Graceful Error Recovery"]
    end
    
    MISSING_DEP --> STARTUP_FAIL
    CIRCULAR_DEP --> INJECTION_ERROR
    SERVICE_FAIL --> STARTUP_FAIL
    RUNTIME_ERROR --> RECOVERY
    
    style MISSING_DEP fill:#ffebee
    style CIRCULAR_DEP fill:#ffebee
    style SERVICE_FAIL fill:#ffebee
    style RUNTIME_ERROR fill:#fff3e0
```

## Implementation Roadmap

### Phase 1: Immediate Fixes
1. **Add Missing Providers**: Register `SupervisorSGRService` and `SupervisorToolDispatcherService` in `BusinessSetupModule`
2. **Validate Imports**: Ensure all required modules are imported
3. **Test Module Registration**: Verify successful application startup

### Phase 2: Architecture Validation
1. **Dependency Chain Testing**: Validate complete dependency resolution
2. **Circular Dependency Analysis**: Identify and resolve any circular references
3. **Event Flow Testing**: Validate event emission and handling

### Phase 3: Integration Testing
1. **End-to-End Workflow Testing**: Test complete supervisor routing workflow
2. **Error Scenario Testing**: Validate error handling and recovery
3. **Performance Optimization**: Optimize module loading and service instantiation

### Phase 4: Documentation and Monitoring
1. **Module Documentation**: Document module dependencies and architecture
2. **Monitoring Integration**: Add module health checks and metrics
3. **Best Practices**: Establish guidelines for future module development

## Risk Mitigation

### 1. Dependency Management Risks

| Risk | Impact | Mitigation Strategy |
|------|--------|-------------------|
| Circular Dependencies | High | Use forwardRef() and careful module design |
| Missing Dependencies | High | Automated dependency validation tests |
| Version Conflicts | Medium | Strict version pinning and compatibility testing |
| Runtime Failures | High | Comprehensive error handling and fallback mechanisms |

### 2. Performance Considerations

```mermaid
graph LR
    subgraph "Performance Factors"
        MOD_SIZE["Module Size"]
        DEP_DEPTH["Dependency Depth"]
        INIT_TIME["Initialization Time"]
        MEM_USAGE["Memory Usage"]
    end
    
    subgraph "Optimization Strategies"
        LAZY_LOAD["Lazy Loading"]
        DEP_OPT["Dependency Optimization"]
        CACHE["Service Caching"]
        SPLIT["Module Splitting"]
    end
    
    MOD_SIZE --> SPLIT
    DEP_DEPTH --> DEP_OPT
    INIT_TIME --> LAZY_LOAD
    MEM_USAGE --> CACHE
```

This design provides a comprehensive solution for resolving the NestJS dependency injection error while establishing robust patterns for managing complex module dependencies in the Twenty CRM system.