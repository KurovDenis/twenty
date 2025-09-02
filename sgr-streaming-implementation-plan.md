# SGR Streaming Visualization System - Implementation Plan

## Overview
This implementation plan provides a step-by-step checklist for building the SGR (Schema-Guided Reasoning) Streaming Visualization System in the Twenty CRM platform. The system will provide real-time visual feedback for AI reasoning processes, displaying thinking progress, tool execution, and results as they stream from backend to frontend.

## Implementation Phases

### Phase 1: Core Infrastructure Setup (3-4 days)

#### 1.1 Backend Core Types and Interfaces
- [ ] **Create SGR streaming types** (`packages/twenty-server/src/types/sgr-streaming.types.ts`)
  - [ ] Define `SGRStreamingStatus` enum (idle, starting, streaming_json, parsing, tool_pending, completed, error)
  - [ ] Define `SGRStreamEventType` enum (PROCESS_START, JSON_STREAM_START, JSON_TOKEN_CHUNK, JSON_STREAM_END, TOOL_CALL_PENDING, PROCESS_END, PROCESS_ERROR)
  - [ ] Create `SGRVisualizationState` interface with status, threadId, stepId, currentStep, jsonStreaming, toolCall, error, timing
  - [ ] Create `SGRStreamEvent` type union for all event types with proper payload typing
  - [ ] Create `JSONStreamingData` interface with token, totalTokens, fullJson, parsingStatus
  - [ ] Create `ToolCallData` interface with toolName, toolArgs, executionStatus, startTime, endTime
  - [ ] Create `StreamingMetrics` interface with processingTime, tokensEmitted, averageSpeed, errorCount

#### 1.2 Backend Event System
- [ ] **Create SGR streaming service** (`packages/twenty-server/src/modules/sgr/services/sgr-streaming.service.ts`)
  - [ ] Implement EventEmitter2 integration for event broadcasting
  - [ ] Create `processMessageWithStreaming()` method that yields SGRStreamEvent objects
  - [ ] Replace `generateObject()` with `streamText()` for token-level streaming from AI model
  - [ ] Add real-time JSON parsing for extracting structured data from partial responses
  - [ ] Implement tool call detection and parameter extraction from streaming JSON
  - [ ] Add comprehensive error handling for stream interruptions and parsing failures
  - [ ] Implement streaming metrics collection (tokens/sec, processing time, error rates)

- [ ] **Create SGR streaming controller** (`packages/twenty-server/src/modules/sgr/controllers/sgr-streaming.controller.ts`)
  - [ ] Implement Server-Sent Events (SSE) endpoint `/api/sgr/stream/:threadId` for real-time streaming
  - [ ] Add WebSocket support as alternative transport for low-latency requirements
  - [ ] Implement connection lifecycle management (connect, disconnect, error recovery)
  - [ ] Add JWT authentication middleware for secure access
  - [ ] Implement rate limiting (max 10 concurrent streams per user)

#### 1.3 Backend Module Integration
- [ ] **Update SGR module** (`packages/twenty-server/src/modules/sgr/sgr.module.ts`)
  - [ ] Register SGRStreamingService with proper dependency injection
  - [ ] Register SGRStreamingController with authentication guards
  - [ ] Configure EventEmitter2 module with custom settings (maxListeners: 100, wildcard: true)
  - [ ] Add Redis configuration for distributed event handling if needed

### Phase 2: Frontend Core Infrastructure (2-3 days)

#### 2.1 Frontend Types and State Management
- [ ] **Create frontend SGR types** (`packages/twenty-front/src/types/sgr-streaming.types.ts`)
  - [ ] Mirror all backend interfaces for frontend compatibility
  - [ ] Add React-specific type extensions (component props, event handlers)
  - [ ] Create animation state types (AnimationPhase, TransitionState)
  - [ ] Define UI component prop interfaces with strict typing

- [ ] **Create Recoil atoms for SGR streaming** (`packages/twenty-front/src/recoil/sgr-streaming/`)
  - [ ] Create `sgrVisualizationState` atom with default idle state
  - [ ] Create `sgrStreamingConnection` atom for connection status tracking
  - [ ] Create `sgrStreamingMetrics` atom for performance data
  - [ ] Create derived selectors for computed states (isActive, currentProgress, hasError)

#### 2.2 Streaming Connection Layer
- [ ] **Create SGR streaming client** (`packages/twenty-front/src/services/sgr-streaming.service.ts`)
  - [ ] Implement SSE connection management with EventSource API
  - [ ] Add WebSocket fallback support with automatic protocol detection
  - [ ] Implement exponential backoff reconnection logic (1s, 2s, 4s, 8s, max 30s)
  - [ ] Add connection state monitoring with heartbeat mechanism
  - [ ] Implement event parsing and validation using Zod schemas

### Phase 3: React Hooks Implementation (2 days)

#### 3.1 Primary Streaming Hook
- [ ] **Create useSGRStreaming hook** (`packages/twenty-front/src/hooks/useSGRStreaming.ts`)
  - [ ] Implement connection lifecycle management (connect on mount, cleanup on unmount)
  - [ ] Add event subscription with proper type safety
  - [ ] Implement state updates from stream events using Recoil state
  - [ ] Add comprehensive error handling with user-friendly error messages
  - [ ] Implement streaming metrics calculation (real-time speed, total processing time)
  - [ ] Add `resetStreaming()` function to clear state and restart
  - [ ] Add `getStreamingMetrics()` function for performance data access

#### 3.2 Simplified Streaming Hook
- [ ] **Create useSGRStreamingBasic hook** (`packages/twenty-front/src/hooks/useSGRStreamingBasic.ts`)
  - [ ] Implement basic streaming state exposure (isStreaming, currentStep, progress)
  - [ ] Add simple progress calculation based on streaming phases
  - [ ] Implement basic error handling with boolean error state
  - [ ] Add current step tracking for simple UI updates

### Phase 4: Core Visualization Components (4-5 days)

#### 4.1 Main Dashboard Component
- [ ] **Create SGRStreamingDashboard** (`packages/twenty-front/src/components/sgr-streaming/SGRStreamingDashboard.tsx`)
  - [ ] Implement responsive container layout with CSS Grid
  - [ ] Add Framer Motion entrance animations (scale from 0.8 to 1.0, opacity 0 to 1)
  - [ ] Implement status-based content switching with smooth transitions
  - [ ] Add responsive design for mobile, tablet, desktop breakpoints
  - [ ] Implement React Error Boundary for graceful error handling
  - [ ] Add comprehensive accessibility features (ARIA labels, keyboard navigation, screen reader support)

#### 4.2 Progress Visualization
- [ ] **Create StreamingProgressBar** (`packages/twenty-front/src/components/sgr-streaming/StreamingProgressBar.tsx`)
  - [ ] Implement animated progress bar with CSS gradients and transitions
  - [ ] Add status-based color transitions (blue→yellow→orange→purple→green)
  - [ ] Implement smooth width animations using CSS transforms
  - [ ] Add progress percentage display with animated counter
  - [ ] Implement pulse effects for active states using CSS animations

#### 4.3 JSON Streaming Viewer
- [ ] **Create JSONStreamingViewer** (`packages/twenty-front/src/components/sgr-streaming/JSONStreamingViewer.tsx`)
  - [ ] Implement token-by-token streaming display with typewriter effect
  - [ ] Add syntax highlighting using react-syntax-highlighter with JSON theme
  - [ ] Implement parsing validation indicators (valid/invalid/partial states)
  - [ ] Add streaming speed metrics display (tokens per second)
  - [ ] Implement copy-to-clipboard functionality with success feedback
  - [ ] Add JSON tree view for completed responses using react-json-tree

#### 4.4 Tool Execution Viewer
- [ ] **Create ToolExecutionViewer** (`packages/twenty-front/src/components/sgr-streaming/ToolExecutionViewer.tsx`)
  - [ ] Implement expandable parameter tree display using react-json-tree
  - [ ] Add execution progress simulation with animated spinner
  - [ ] Implement execution timer with real-time updates
  - [ ] Add result/error display sections with syntax highlighting
  - [ ] Implement collapsible sections for tool parameters and results
  - [ ] Add tool-specific icons and color coding

### Phase 5: Styling and Animation System (2-3 days)

#### 5.1 Styled Components
- [ ] **Create SGR streaming styled components** (`packages/twenty-front/src/components/sgr-streaming/styles/`)
  - [ ] Implement `StyledSGRDashboard` with responsive CSS Grid layout
  - [ ] Create `StyledProgressBar` with gradient animations and smooth transitions
  - [ ] Implement `StyledJSONViewer` with custom syntax highlighting theme
  - [ ] Create `StyledToolViewer` with collapsible tree styling
  - [ ] Add `StyledMetricsPanel` with chart containers and data visualization

#### 5.2 Animation Configurations
- [ ] **Create animation presets** (`packages/twenty-front/src/components/sgr-streaming/animations/`)
  - [ ] Define entrance/exit animations with Framer Motion variants
  - [ ] Create smooth status transition animations between phases
  - [ ] Implement typewriter effect with configurable speed
  - [ ] Add error state animations (shake effect, red highlighting)
  - [ ] Create loading spinner animations with proper timing

#### 5.3 Theme Integration
- [ ] **Integrate with Twenty UI theme**
  - [ ] Map SGR status colors to existing theme palette
  - [ ] Implement seamless dark/light mode compatibility
  - [ ] Apply consistent spacing scale and typography system
  - [ ] Use responsive breakpoints from theme configuration

### Phase 6: Business Logic Integration (2-3 days)

#### 6.1 Business Setup Integration
- [ ] **Integrate with business setup workflow** (`packages/twenty-front/src/pages/settings/business-setup/`)
  - [ ] Add SGR streaming visualization to Avito agent workflow
  - [ ] Implement credential extraction progress display
  - [ ] Add API validation status visualization with real-time feedback
  - [ ] Update welcome stage component to show streaming feedback during setup

#### 6.2 Supervisor Agent Integration
- [ ] **Connect with supervisor agent** (`packages/twenty-server/src/modules/sgr/services/supervisor-agent.service.ts`)
  - [ ] Add streaming events for routing decision visualization
  - [ ] Implement multi-agent coordination display
  - [ ] Add status change notifications between agents
  - [ ] Implement agent switching visualizations with smooth transitions

### Phase 7: Error Handling and Resilience (2 days)

#### 7.1 Frontend Error Recovery
- [ ] **Implement connection resilience**
  - [ ] Add automatic reconnection with exponential backoff (max 5 attempts)
  - [ ] Implement user notifications for persistent connection failures
  - [ ] Add session storage state persistence for recovery after page refresh
  - [ ] Implement graceful degradation when streaming features are unsupported

#### 7.2 Backend Error Management
- [ ] **Implement robust error handling**
  - [ ] Add stream interruption recovery with proper cleanup
  - [ ] Implement tool execution error handling with retry logic
  - [ ] Add timeout mechanisms for long-running operations (max 60s)
  - [ ] Implement fallback options for critical tool failures

### Phase 8: Performance Optimization (1-2 days)

#### 8.1 Frontend Performance
- [ ] **Optimize rendering performance**
  - [ ] Implement token batching (max 10 tokens per update) for smooth display
  - [ ] Add debouncing for rapid state updates (100ms delay)
  - [ ] Use React.memo for expensive visualization components
  - [ ] Implement virtual scrolling for long JSON responses
  - [ ] Optimize animations using CSS transforms and will-change properties

#### 8.2 Backend Performance
- [ ] **Optimize streaming efficiency**
  - [ ] Implement backpressure handling for slow clients
  - [ ] Add connection pooling for WebSocket connections
  - [ ] Optimize event emission frequency (max 50 events/second)
  - [ ] Implement automatic memory cleanup for completed streams

### Phase 9: Testing Implementation (3-4 days)

#### 9.1 Unit Tests
- [ ] **Component testing with Jest and React Testing Library**
  - [ ] Test SGRStreamingDashboard rendering and state changes
  - [ ] Test StreamingProgressBar animations and color transitions
  - [ ] Test JSONStreamingViewer token streaming and syntax highlighting
  - [ ] Test ToolExecutionViewer parameter display and interaction
  - [ ] Test StreamingMetrics calculations and data accuracy

- [ ] **Hook testing with react-hooks-testing-library**
  - [ ] Test useSGRStreaming state transitions and event handling
  - [ ] Test useSGRStreamingBasic basic functionality and error states
  - [ ] Test connection lifecycle management and cleanup
  - [ ] Test error recovery and reconnection logic

#### 9.2 Integration Tests
- [ ] **End-to-end testing with Playwright**
  - [ ] Create full workflow tests for streaming process
  - [ ] Test business setup integration with streaming visualization
  - [ ] Test supervisor agent coordination and display
  - [ ] Implement visual regression testing for animations

#### 9.3 Performance Testing
- [ ] **Performance validation**
  - [ ] Measure streaming latency under various network conditions
  - [ ] Monitor memory usage during extended streaming sessions
  - [ ] Test connection stability with high concurrency
  - [ ] Validate animation performance on low-end devices

### Phase 10: Documentation and Deployment (1-2 days)

#### 10.1 Code Documentation
- [ ] **Add comprehensive JSDoc comments**
  - [ ] Document all public APIs with examples
  - [ ] Add detailed usage examples for custom hooks
  - [ ] Document component props and interfaces thoroughly
  - [ ] Create integration guides for other developers

#### 10.2 Deployment Preparation
- [ ] **Prepare for production deployment**
  - [ ] Add feature flags for gradual rollout (SGR_STREAMING_ENABLED)
  - [ ] Configure environment variables for streaming endpoints
  - [ ] Add comprehensive monitoring and logging for production
  - [ ] Prepare rollback procedures and emergency stop mechanisms

## File Structure

```
packages/twenty-server/src/
├── modules/sgr/
│   ├── controllers/
│   │   └── sgr-streaming.controller.ts
│   ├── services/
│   │   ├── sgr-streaming.service.ts
│   │   └── supervisor-agent.service.ts
│   └── types/
│       └── sgr-streaming.types.ts

packages/twenty-front/src/
├── components/sgr-streaming/
│   ├── SGRStreamingDashboard.tsx
│   ├── StreamingProgressBar.tsx
│   ├── JSONStreamingViewer.tsx
│   ├── ToolExecutionViewer.tsx
│   ├── StreamingMetrics.tsx
│   ├── styles/
│   │   ├── SGRStreamingStyles.ts
│   │   └── AnimationPresets.ts
│   └── animations/
│       └── SGRAnimations.ts
├── hooks/
│   ├── useSGRStreaming.ts
│   └── useSGRStreamingBasic.ts
├── services/
│   └── sgr-streaming.service.ts
├── recoil/sgr-streaming/
│   ├── sgrVisualizationState.ts
│   ├── sgrStreamingConnection.ts
│   └── sgrStreamingMetrics.ts
└── types/
    └── sgr-streaming.types.ts
```

## Success Criteria

### Functional Requirements
- [ ] Real-time streaming of AI reasoning process with <100ms latency
- [ ] Visual display of JSON token generation with syntax highlighting
- [ ] Tool execution progress visualization with timing information
- [ ] Comprehensive error handling and recovery mechanisms
- [ ] Performance metrics display with real-time updates

### Non-Functional Requirements
- [ ] Smooth 60fps animations on all supported devices
- [ ] Graceful handling of connection loss with automatic recovery
- [ ] Mobile-responsive design supporting 320px+ screen widths
- [ ] Accessibility compliance (WCAG 2.1 AA level)
- [ ] Memory usage <50MB for extended streaming sessions

### User Experience Goals
- [ ] Clear visual understanding of AI processing status at all times
- [ ] Engaging visual feedback during wait times to maintain user attention
- [ ] Transparent tool execution process with detailed parameter display
- [ ] Intuitive error messages with actionable recovery options

## Timeline Estimate

**Total Implementation Time: 20-25 days**

- **Phase 1-2**: 5-7 days (Core Infrastructure)
- **Phase 3-4**: 6-7 days (Hooks and Components)
- **Phase 5-6**: 4-6 days (Styling and Integration)
- **Phase 7-8**: 3-4 days (Error Handling and Optimization)
- **Phase 9-10**: 4-6 days (Testing and Documentation)

This implementation plan provides a comprehensive roadmap for building the SGR Streaming Visualization System with clear deliverables and success criteria for each phase.