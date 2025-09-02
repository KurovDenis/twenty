# TypeScript Error Fixes for SGR Streaming Implementation

## Overview

This design document addresses the TypeScript compilation errors in the SGR (Schema-Guided Reasoning) streaming implementation. The errors are primarily related to incorrect component prop usage and missing dependencies.

## Architecture

The SGR streaming implementation is part of the Twenty.js CRM system's AI module, specifically designed to provide real-time visualization of AI reasoning processes. The system uses:

- **Frontend**: React with TypeScript, Recoil state management, Twenty-UI component library
- **Component Structure**: Modular components for JSON visualization, progress tracking, and tool execution
- **Type Safety**: Strict TypeScript interfaces and proper component prop validation

## Error Analysis and Fixes

### 1. JsonTree Component Interface Issues

**Problem**: The implementation uses incorrect prop names for the JsonTree component from Twenty-UI.

**Current Code Issues**:
```typescript
// Incorrect usage in multiple files
<JsonTree 
  data={jsonData.parsedJson}
  maxDepth={3}
/>
```

**Root Cause**: The JsonTree component expects a `value` prop, not `data`, and requires additional mandatory props.

**Fix**: Update all JsonTree usages to match the correct interface:

```typescript
<JsonTree
  value={jsonData.parsedJson as JsonValue}
  shouldExpandNodeInitially={() => true}
  emptyArrayLabel="Empty Array"
  emptyObjectLabel="Empty Object" 
  emptyStringLabel="Empty String"
  arrowButtonCollapsedLabel="Expand"
  arrowButtonExpandedLabel="Collapse"
/>
```

### 2. ProgressBar Component Interface Issues

**Problem**: The ProgressBar component from Twenty-UI doesn't accept `max` or `animated` props.

**Current Code Issues**:
```typescript
// Incorrect usage
<ProgressBar 
  value={progress}
  max={100}
  color="blue"
  animated={true}
/>
```

**Root Cause**: The ProgressBar component has a different interface than expected.

**Fix**: Update ProgressBar usage to match the correct interface:

```typescript
<ProgressBar
  value={Math.min(progress, 100)} // Normalize to 0-100
  barColor={theme.color.blue}
  backgroundColor={theme.background.secondary}
  withBorderRadius={true}
/>
```

### 3. Missing Dependencies and Import Issues

**Problem**: Several modules are missing or have incorrect import paths.

**Import Errors**:
- `@/ai/components/MarkdownRenderer` - Module not found
- `@/ai/hooks/useSGRStreaming` - Module not found

**Fix**: Create missing components and update import paths.

### 4. Type Safety Issues

**Problem**: Improper type handling for React nodes and nullable values.

**Issues**:
- `Type 'unknown' is not assignable to type 'ReactNode'`
- `Type 'boolean | null' is not assignable to type 'boolean | undefined'`

**Fix**: Add proper type guards and null checks.

## Component Implementations

### 1. Fixed JSONStreamingViewer Component

```typescript
// packages/twenty-front/src/modules/ai/components/SgrVisualizationDashboard/JSONStreamingViewer.tsx

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { JsonTree } from 'twenty-ui';
import { Card } from 'twenty-ui';
import { OverflowingTextWithTooltip } from 'twenty-ui';
import { JSONStreamingData } from '../../types/sgr-streaming.types';
import { JsonValue } from 'type-fest';

const StyledContainer = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)} 0;
`;

type ViewMode = 'raw' | 'tree';

type JSONStreamingViewerProps = {
  jsonData: JSONStreamingData;
  isActive: boolean;
};

export const JSONStreamingViewer = ({
  jsonData,
  isActive,
}: JSONStreamingViewerProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const rawJsonRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleTabClick = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Auto-scroll raw JSON view
  useEffect(() => {
    if (shouldAutoScroll && rawJsonRef.current && viewMode === 'raw') {
      rawJsonRef.current.scrollTop = rawJsonRef.current.scrollHeight;
    }
  }, [jsonData.rawJson, shouldAutoScroll, viewMode]);

  const renderJsonTree = useCallback(() => {
    if (!jsonData.parsedJson || !jsonData.isValidJson) {
      return (
        <div style={{ 
          color: 'var(--theme-font-color-secondary)', 
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '16px',
        }}>
          Waiting for valid JSON...
        </div>
      );
    }

    return (
      <JsonTree
        value={jsonData.parsedJson as JsonValue}
        shouldExpandNodeInitially={() => true}
        emptyArrayLabel="Empty Array"
        emptyObjectLabel="Empty Object"
        emptyStringLabel="Empty String"
        arrowButtonCollapsedLabel="▶"
        arrowButtonExpandedLabel="▼"
      />
    );
  }, [jsonData.parsedJson, jsonData.isValidJson]);

  return (
    <StyledContainer>
      <StyledTabs>
        <button 
          onClick={() => handleTabClick('raw')}
          style={{ 
            background: viewMode === 'raw' ? 'var(--theme-color-blue)' : 'transparent',
            color: viewMode === 'raw' ? 'white' : 'var(--theme-font-color-primary)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Raw JSON
        </button>
        <button 
          onClick={() => handleTabClick('tree')}
          style={{ 
            background: viewMode === 'tree' ? 'var(--theme-color-blue)' : 'transparent',
            color: viewMode === 'tree' ? 'white' : 'var(--theme-font-color-primary)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Tree View
        </button>
      </StyledTabs>

      <div style={{ padding: '16px' }}>
        {viewMode === 'raw' ? (
          <div 
            ref={rawJsonRef}
            style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              background: 'var(--theme-background-secondary)',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '300px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {jsonData.rawJson || 'Waiting for JSON stream...'}
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {renderJsonTree()}
          </div>
        )}
      </div>
    </StyledContainer>
  );
};
```

### 2. Fixed StreamingProgressBar Component

```typescript
// packages/twenty-front/src/modules/ai/components/SgrVisualizationDashboard/StreamingProgressBar.tsx

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { ProgressBar } from 'twenty-ui';
import { SGRStreamingStatus, JSONStreamingData, ToolCallData } from '../../types/sgr-streaming.types';

const StyledProgressContainer = styled.div`
  padding: 0 ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledProgressInfo = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

type StreamingProgressBarProps = {
  status: SGRStreamingStatus;
  jsonData?: JSONStreamingData;
  toolCall?: ToolCallData;
};

export const StreamingProgressBar = ({
  status,
  jsonData,
  toolCall,
}: StreamingProgressBarProps) => {
  
  const progressData = useMemo(() => {
    switch (status) {
      case 'starting':
        return { value: 10, label: 'Initializing...', color: '#3B82F6' };
      case 'streaming_json':
        return { 
          value: Math.min(30 + (jsonData?.totalTokens || 0) * 0.5, 70), 
          label: `Streaming JSON (${jsonData?.totalTokens || 0} tokens)`, 
          color: '#8B5CF6' 
        };
      case 'parsing':
        return { value: 75, label: 'Parsing JSON...', color: '#F59E0B' };
      case 'tool_pending':
        return { value: 85, label: `Executing ${toolCall?.toolName || 'tool'}...`, color: '#10B981' };
      case 'completed':
        return { value: 100, label: 'Completed', color: '#10B981' };
      case 'error':
        return { value: 100, label: 'Error occurred', color: '#EF4444' };
      default:
        return { value: 0, label: 'Ready', color: '#6B7280' };
    }
  }, [status, jsonData?.totalTokens, toolCall?.toolName]);

  return (
    <StyledProgressContainer>
      <StyledProgressInfo>
        <span>{progressData.label}</span>
        <span>{Math.round(progressData.value)}%</span>
      </StyledProgressInfo>
      
      <ProgressBar
        value={progressData.value}
        barColor={progressData.color}
        backgroundColor="var(--theme-background-secondary)"
        withBorderRadius={true}
      />
    </StyledProgressContainer>
  );
};
```

### 3. Fixed ToolExecutionViewer Component

```typescript
// packages/twenty-front/src/modules/ai/components/SgrVisualizationDashboard/ToolExecutionViewer.tsx

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { Card } from 'twenty-ui';
import { IconBolt, IconCheck, IconX, IconLoader } from 'twenty-ui';
import { JsonTree } from 'twenty-ui';
import { ProgressBar } from 'twenty-ui';
import { ToolCallData, SGRToolExecutionStatus } from '../../types/sgr-streaming.types';
import { JsonValue } from 'type-fest';
import { ReactNode } from 'react';

const StyledContainer = styled(Card)`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledContent = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSectionTitle = styled.h4`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledParametersContainer = styled.div`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledErrorDisplay = styled(motion.div)`
  padding: ${({ theme }) => theme.spacing(3)};
  background: ${({ theme }) => theme.color.red}10;
  border: 1px solid ${({ theme }) => theme.color.red}30;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

type ToolExecutionViewerProps = {
  toolCall: ToolCallData;
  isActive: boolean;
};

export const ToolExecutionViewer = ({
  toolCall,
  isActive,
}: ToolExecutionViewerProps) => {
  const [progress, setProgress] = useState(0);

  // Simulate progress for running tools
  useEffect(() => {
    if (toolCall.status === SGRToolExecutionStatus.IN_PROGRESS) {
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 10, 95));
      }, 200);

      return () => clearInterval(interval);
    } else if (toolCall.status === SGRToolExecutionStatus.COMPLETED) {
      setProgress(100);
    }
  }, [toolCall.status]);

  const getStatusIcon = useCallback(() => {
    switch (toolCall.status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        return <IconLoader />;
      case SGRToolExecutionStatus.COMPLETED:
        return <IconCheck />;
      case SGRToolExecutionStatus.FAILED:
        return <IconX />;
      default:
        return <IconBolt />;
    }
  }, [toolCall.status]);

  const getStatusColor = useCallback(() => {
    switch (toolCall.status) {
      case SGRToolExecutionStatus.IN_PROGRESS:
        return 'var(--theme-color-blue)';
      case SGRToolExecutionStatus.COMPLETED:
        return 'var(--theme-color-green)';
      case SGRToolExecutionStatus.FAILED:
        return 'var(--theme-color-red)';
      default:
        return 'var(--theme-font-color-secondary)';
    }
  }, [toolCall.status]);

  const renderToolResult = useCallback((): ReactNode => {
    if (!toolCall.result) return null;
    
    try {
      return (
        <JsonTree
          value={toolCall.result as JsonValue}
          shouldExpandNodeInitially={() => true}
          emptyArrayLabel="Empty Array"
          emptyObjectLabel="Empty Object"
          emptyStringLabel="Empty String"
          arrowButtonCollapsedLabel="▶"
          arrowButtonExpandedLabel="▼"
        />
      );
    } catch (error) {
      return <div>Invalid result format</div>;
    }
  }, [toolCall.result]);

  const renderToolArgs = useCallback((): ReactNode => {
    if (!toolCall.toolArgs || Object.keys(toolCall.toolArgs).length === 0) {
      return (
        <div style={{ 
          color: 'var(--theme-font-color-secondary)', 
          fontStyle: 'italic',
          textAlign: 'center',
          padding: '16px',
        }}>
          No parameters
        </div>
      );
    }

    try {
      return (
        <JsonTree
          value={toolCall.toolArgs as JsonValue}
          shouldExpandNodeInitially={() => true}
          emptyArrayLabel="Empty Array"
          emptyObjectLabel="Empty Object"
          emptyStringLabel="Empty String"
          arrowButtonCollapsedLabel="▶"
          arrowButtonExpandedLabel="▼"
        />
      );
    } catch (error) {
      return <div>Invalid parameters format</div>;
    }
  }, [toolCall.toolArgs]);

  return (
    <StyledContainer>
      <StyledHeader>
        <div style={{ color: getStatusColor() }}>
          {getStatusIcon()}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{toolCall.toolName}</h3>
          <div style={{ fontSize: '14px', color: 'var(--theme-font-color-secondary)' }}>
            Status: {toolCall.status}
            {toolCall.executionTime && ` • ${toolCall.executionTime}ms`}
          </div>
        </div>
      </StyledHeader>

      <StyledContent>
        {/* Progress bar for running tools */}
        {toolCall.status === SGRToolExecutionStatus.IN_PROGRESS && (
          <ProgressBar
            value={progress}
            barColor="var(--theme-color-blue)"
            backgroundColor="var(--theme-background-secondary)"
            withBorderRadius={true}
          />
        )}

        {/* Tool parameters */}
        <StyledSection>
          <StyledSectionTitle>Parameters</StyledSectionTitle>
          <StyledParametersContainer>
            {renderToolArgs()}
          </StyledParametersContainer>
        </StyledSection>

        {/* Tool result */}
        {toolCall.status === SGRToolExecutionStatus.COMPLETED && toolCall.result && (
          <StyledSection>
            <StyledSectionTitle>Result</StyledSectionTitle>
            <StyledParametersContainer>
              {renderToolResult()}
            </StyledParametersContainer>
          </StyledSection>
        )}

        {/* Error display */}
        {toolCall.status === SGRToolExecutionStatus.FAILED && toolCall.error && (
          <StyledErrorDisplay
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <IconX />
            <div>
              <strong>Execution Error:</strong><br />
              {toolCall.error}
            </div>
          </StyledErrorDisplay>
        )}
      </StyledContent>
    </StyledContainer>
  );
};
```

### 4. Missing Component Creation - MarkdownRenderer

```typescript
// packages/twenty-front/src/modules/ai/components/MarkdownRenderer.tsx

import { ReactNode } from 'react';
import styled from 'styled-components';

const StyledMarkdownContainer = styled.div`
  line-height: 1.6;
  
  h1, h2, h3, h4, h5, h6 {
    margin: ${({ theme }) => theme.spacing(3)} 0 ${({ theme }) => theme.spacing(2)} 0;
    color: ${({ theme }) => theme.font.color.primary};
  }
  
  p {
    margin: ${({ theme }) => theme.spacing(2)} 0;
    color: ${({ theme }) => theme.font.color.primary};
  }
  
  code {
    background: ${({ theme }) => theme.background.secondary};
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
  }
  
  pre {
    background: ${({ theme }) => theme.background.secondary};
    padding: ${({ theme }) => theme.spacing(3)};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    overflow-x: auto;
    margin: ${({ theme }) => theme.spacing(2)} 0;
    
    code {
      background: none;
      padding: 0;
    }
  }
  
  ul, ol {
    margin: ${({ theme }) => theme.spacing(2)} 0;
    padding-left: ${({ theme }) => theme.spacing(4)};
  }
  
  li {
    margin: ${({ theme }) => theme.spacing(1)} 0;
    color: ${({ theme }) => theme.font.color.primary};
  }
  
  blockquote {
    border-left: 4px solid ${({ theme }) => theme.color.blue};
    padding-left: ${({ theme }) => theme.spacing(3)};
    margin: ${({ theme }) => theme.spacing(2)} 0;
    color: ${({ theme }) => theme.font.color.secondary};
    font-style: italic;
  }
  
  strong {
    font-weight: ${({ theme }) => theme.font.weight.medium};
    color: ${({ theme }) => theme.font.color.primary};
  }
  
  em {
    font-style: italic;
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

// Simple markdown renderer - replace with a more robust solution if needed
export const MarkdownRenderer = ({ content, className }: MarkdownRendererProps): ReactNode => {
  // For now, just render as plain text with line breaks
  // TODO: Implement proper markdown parsing or use a library like react-markdown
  const renderContent = (text: string): ReactNode => {
    return text.split('\n').map((line, index) => (
      <p key={index}>{line}</p>
    ));
  };

  return (
    <StyledMarkdownContainer className={className}>
      {renderContent(content)}
    </StyledMarkdownContainer>
  );
};

export { StyledMarkdownContainer };
```

### 5. Missing Hook Creation - useSGRStreaming

```typescript
// packages/twenty-front/src/modules/ai/hooks/useSGRStreaming.ts

import { useCallback, useState } from 'react';

export type SGRStreamingHookProps = {
  agentId: string;
  threadId?: string;
};

export type SGRStreamingState = {
  isStreaming: boolean;
  currentStep: string;
  progress: number;
  error: string | null;
};

export const useSGRStreaming = ({ agentId, threadId }: SGRStreamingHookProps) => {
  const [streamingState, setStreamingState] = useState<SGRStreamingState>({
    isStreaming: false,
    currentStep: '',
    progress: 0,
    error: null,
  });

  const startStreaming = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      isStreaming: true,
      error: null,
    }));
  }, []);

  const stopStreaming = useCallback(() => {
    setStreamingState(prev => ({
      ...prev,
      isStreaming: false,
    }));
  }, []);

  const updateStep = useCallback((step: string) => {
    setStreamingState(prev => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setStreamingState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setStreamingState(prev => ({
      ...prev,
      error,
      isStreaming: false,
    }));
  }, []);

  return {
    streamingState,
    startStreaming,
    stopStreaming,
    updateStep,
    updateProgress,
    setError,
  };
};
```

### 6. Fixed EnhancedAIChatMessage Component

```typescript
// packages/twenty-front/src/modules/ai/components/EnhancedAIChatMessage.tsx

import { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { MarkdownRenderer, StyledMarkdownContainer } from './MarkdownRenderer';
import { SgrVisualizationDashboard } from './SgrVisualizationDashboard/SgrVisualizationDashboard';

const StyledMessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

type EnhancedAIChatMessageProps = {
  message: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    threadId?: string;
  };
  showSGRVisualization?: boolean;
};

export const EnhancedAIChatMessage = ({
  message,
  showSGRVisualization = false,
}: EnhancedAIChatMessageProps) => {
  const [shouldShowVisualization, setShouldShowVisualization] = useState(false);

  const shouldShowSGRVisualization = useMemo(() => {
    return showSGRVisualization && 
           message.role === 'assistant' && 
           message.threadId != null;
  }, [showSGRVisualization, message.role, message.threadId]);

  return (
    <StyledMessageContainer>
      {/* Message content */}
      <StyledMarkdownContainer>
        <MarkdownRenderer content={message.content} />
      </StyledMarkdownContainer>

      {/* SGR Visualization */}
      <AnimatePresence>
        {shouldShowSGRVisualization && (
          <SgrVisualizationDashboard
            threadId={message.threadId || ''}
            showMetrics={true}
            autoHideOnComplete={true}
            autoHideDelayMs={2000}
          />
        )}
      </AnimatePresence>
    </StyledMessageContainer>
  );
};
```

### 7. Fixed useAgentChat Hook

```typescript
// packages/twenty-front/src/modules/ai/hooks/useAgentChat.ts

import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useSGRStreaming } from './useSGRStreaming';

export type UseAgentChatProps = {
  agentId: string;
};

export const useAgentChat = ({ agentId }: UseAgentChatProps) => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const { streamingState, startStreaming, stopStreaming, updateStep, updateProgress, setError } = 
    useSGRStreaming({ agentId, threadId: activeThreadId || undefined });

  const sendMessage = useCallback(async (content: string) => {
    if (!currentUser || !currentWorkspace) {
      setError('User or workspace not available');
      return;
    }

    try {
      startStreaming();
      updateStep('Sending message...');
      updateProgress(10);

      // TODO: Implement actual message sending logic
      // This is a placeholder implementation
      
      updateStep('Processing response...');
      updateProgress(50);

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateProgress(100);
      stopStreaming();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    }
  }, [currentUser, currentWorkspace, startStreaming, stopStreaming, updateStep, updateProgress, setError]);

  const createThread = useCallback(async () => {
    if (!currentUser || !currentWorkspace) {
      setError('User or workspace not available');
      return null;
    }

    try {
      // TODO: Implement actual thread creation logic
      const newThreadId = `thread-${Date.now()}`;
      setActiveThreadId(newThreadId);
      return newThreadId;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create thread');
      return null;
    }
  }, [currentUser, currentWorkspace, setError]);

  return {
    sendMessage,
    createThread,
    streamingState,
    activeThreadId,
  };
};
```

## Type Definitions

### Enhanced SGR Streaming Types

```typescript
// packages/twenty-front/src/modules/ai/types/sgr-streaming.types.ts

import { SGRThinkingStep } from './sgr-message.types';

export type SGRStreamEventType = 
  | 'SGR_PROCESS_START'
  | 'SGR_JSON_STREAM_START' 
  | 'SGR_JSON_TOKEN_CHUNK'
  | 'SGR_JSON_STREAM_END'
  | 'SGR_TOOL_CALL_PENDING'
  | 'SGR_PROCESS_END'
  | 'SGR_PROCESS_ERROR';

export type SGRStreamEventPayload = {
  threadId: string;
  stepId: string;
  token?: string;
  fullJson?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
  metadata?: {
    stepNumber?: number;
    totalSteps?: number;
    processingTime?: number;
    tokensEmitted?: number;
  };
};

export type SGRStreamEvent = {
  type: SGRStreamEventType;
  payload: SGRStreamEventPayload;
};

export type SGRStreamingStatus = 
  | 'idle'
  | 'starting'
  | 'streaming_json'
  | 'parsing'
  | 'tool_pending'
  | 'completed'
  | 'error';

export type JSONStreamingData = {
  rawJson: string;
  parsedJson?: Record<string, unknown>;
  isValidJson: boolean;
  currentToken: string;
  totalTokens: number;
  streamingSpeed: number;
};

export enum SGRToolExecutionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type ToolCallData = {
  toolName: string;
  toolArgs: Record<string, unknown>;
  status: SGRToolExecutionStatus;
  executionTime?: number;
  result?: unknown;
  error?: string;
};

export type SGRVisualizationState = {
  status: SGRStreamingStatus;
  threadId: string | null;
  stepId: string | null;
  currentStep?: SGRThinkingStep;
  jsonStreaming?: JSONStreamingData;
  toolCall?: ToolCallData;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  totalProcessingTime?: number;
};
```

## Testing Strategy

### Unit Testing Requirements

1. **Component Props Validation**: Test all components with correct and incorrect props
2. **Type Safety**: Ensure all TypeScript interfaces are properly implemented
3. **Error Handling**: Test error scenarios and fallback behaviors
4. **Integration**: Test component interactions and data flow

### Test Implementation Example

```typescript
// packages/twenty-front/src/modules/ai/components/__tests__/JSONStreamingViewer.test.tsx

import { render, screen } from '@testing-library/react';
import { JSONStreamingViewer } from '../SgrVisualizationDashboard/JSONStreamingViewer';
import { JSONStreamingData } from '../../types/sgr-streaming.types';

const mockJsonData: JSONStreamingData = {
  rawJson: '{"test": "value"}',
  parsedJson: { test: 'value' },
  isValidJson: true,
  currentToken: 'value',
  totalTokens: 10,
  streamingSpeed: 5,
};

describe('JSONStreamingViewer', () => {
  it('renders without crashing', () => {
    render(
      <JSONStreamingViewer 
        jsonData={mockJsonData} 
        isActive={true} 
      />
    );
    
    expect(screen.getByText('Raw JSON')).toBeInTheDocument();
    expect(screen.getByText('Tree View')).toBeInTheDocument();
  });

  it('displays valid JSON in tree view', () => {
    render(
      <JSONStreamingViewer 
        jsonData={mockJsonData} 
        isActive={true} 
      />
    );
    
    // Click tree view tab
    const treeViewTab = screen.getByText('Tree View');
    treeViewTab.click();
    
    // Should display the JSON tree
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('handles invalid JSON gracefully', () => {
    const invalidJsonData: JSONStreamingData = {
      ...mockJsonData,
      isValidJson: false,
      parsedJson: undefined,
    };
    
    render(
      <JSONStreamingViewer 
        jsonData={invalidJsonData} 
        isActive={true} 
      />
    );
    
    expect(screen.getByText('Waiting for valid JSON...')).toBeInTheDocument();
  });
});
```