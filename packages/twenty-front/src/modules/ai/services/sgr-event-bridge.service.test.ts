/**
 * Unit tests for SGR Event Bridge Service
 * Tests type guards and event processing functionality
 */

import {
  SGREvent,
  SGRThinkingEvent,
  SGRToolExecutionEvent,
  SGRFinalResponseEvent,
  isThinkingEvent,
  isToolExecutionEvent,
  isFinalResponseEvent,
} from './sgr-event-bridge.service';
import { SGRMessageType, SGRToolExecutionStatus } from '@/ai/types/sgr-message.types';

describe('SGR Event Type Guards', () => {
  // Mock data for testing
  const mockThinkingEvent: SGRThinkingEvent = {
    type: SGRMessageType.THINKING,
    step: {
      stepNumber: 1,
      currentState: 'Analyzing request',
      plannedSteps: ['Step 1', 'Step 2'],
      selectedTool: 'test_tool',
      timestamp: new Date(),
    },
    threadId: 'test-thread-123',
    timestamp: new Date(),
  };

  const mockToolExecutionEvent: SGRToolExecutionEvent = {
    type: SGRMessageType.TOOL_EXECUTION,
    toolName: 'credential_extractor',
    status: SGRToolExecutionStatus.IN_PROGRESS,
    threadId: 'test-thread-123',
    timestamp: new Date(),
  };

  const mockFinalResponseEvent: SGRFinalResponseEvent = {
    type: SGRMessageType.FINAL_RESPONSE,
    content: 'Task completed successfully',
    success: true,
    threadId: 'test-thread-123',
    timestamp: new Date(),
  };

  describe('isThinkingEvent', () => {
    it('should return true for thinking events', () => {
      expect(isThinkingEvent(mockThinkingEvent)).toBe(true);
    });

    it('should return false for tool execution events', () => {
      expect(isThinkingEvent(mockToolExecutionEvent)).toBe(false);
    });

    it('should return false for final response events', () => {
      expect(isThinkingEvent(mockFinalResponseEvent)).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const event: SGREvent = mockThinkingEvent;
      if (isThinkingEvent(event)) {
        // TypeScript should know event.step exists
        expect(event.step.stepNumber).toBe(1);
        expect(event.step.currentState).toBe('Analyzing request');
      }
    });
  });

  describe('isToolExecutionEvent', () => {
    it('should return true for tool execution events', () => {
      expect(isToolExecutionEvent(mockToolExecutionEvent)).toBe(true);
    });

    it('should return false for thinking events', () => {
      expect(isToolExecutionEvent(mockThinkingEvent)).toBe(false);
    });

    it('should return false for final response events', () => {
      expect(isToolExecutionEvent(mockFinalResponseEvent)).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const event: SGREvent = mockToolExecutionEvent;
      if (isToolExecutionEvent(event)) {
        // TypeScript should know event.toolName exists
        expect(event.toolName).toBe('credential_extractor');
        expect(event.status).toBe(SGRToolExecutionStatus.IN_PROGRESS);
      }
    });
  });

  describe('isFinalResponseEvent', () => {
    it('should return true for final response events', () => {
      expect(isFinalResponseEvent(mockFinalResponseEvent)).toBe(true);
    });

    it('should return false for thinking events', () => {
      expect(isFinalResponseEvent(mockThinkingEvent)).toBe(false);
    });

    it('should return false for tool execution events', () => {
      expect(isFinalResponseEvent(mockToolExecutionEvent)).toBe(false);
    });

    it('should provide proper type narrowing', () => {
      const event: SGREvent = mockFinalResponseEvent;
      if (isFinalResponseEvent(event)) {
        // TypeScript should know event.content exists
        expect(event.content).toBe('Task completed successfully');
        expect(event.success).toBe(true);
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle events with missing properties gracefully', () => {
      const malformedEvent = {
        type: SGRMessageType.THINKING,
        // Missing step property
      } as SGRThinkingEvent;

      expect(isThinkingEvent(malformedEvent)).toBe(true);
      // Type guard should work even with missing properties
    });

    it('should handle unknown event types', () => {
      const unknownEvent = {
        type: 'unknown_type' as any,
        threadId: 'test-thread',
        timestamp: new Date(),
      } as SGREvent;

      expect(isThinkingEvent(unknownEvent)).toBe(false);
      expect(isToolExecutionEvent(unknownEvent)).toBe(false);
      expect(isFinalResponseEvent(unknownEvent)).toBe(false);
    });
  });
});

describe('SGR Event Processing Integration', () => {
  it('should process different event types correctly', () => {
    const events: SGREvent[] = [
      {
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'Initial analysis',
          plannedSteps: ['Extract credentials', 'Validate format'],
          selectedTool: 'credential_extractor',
          timestamp: new Date(),
        },
        threadId: 'test-thread',
        timestamp: new Date(),
      },
      {
        type: SGRMessageType.TOOL_EXECUTION,
        toolName: 'credential_extractor',
        status: SGRToolExecutionStatus.COMPLETED,
        result: { client_id: 'test_id', client_secret: 'test_secret' },
        threadId: 'test-thread',
        timestamp: new Date(),
      },
      {
        type: SGRMessageType.FINAL_RESPONSE,
        content: 'Credentials extracted and validated successfully',
        success: true,
        threadId: 'test-thread',
        timestamp: new Date(),
      },
    ];

    let processedSteps = 0;
    let processedTools = 0;
    let processedResponses = 0;

    events.forEach((event) => {
      if (isThinkingEvent(event)) {
        expect(event.step).toBeDefined();
        expect(event.step.stepNumber).toBe(1);
        processedSteps++;
      } else if (isToolExecutionEvent(event)) {
        expect(event.toolName).toBe('credential_extractor');
        expect(event.status).toBe(SGRToolExecutionStatus.COMPLETED);
        processedTools++;
      } else if (isFinalResponseEvent(event)) {
        expect(event.content).toContain('successfully');
        expect(event.success).toBe(true);
        processedResponses++;
      }
    });

    expect(processedSteps).toBe(1);
    expect(processedTools).toBe(1);
    expect(processedResponses).toBe(1);
  });
});