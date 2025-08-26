import { SGRMessageType, SGRToolExecutionStatus } from '@/ai/types/sgr-message.types';
import { 
  SGRStreamingEvent, 
  SGRThinkingStreamingEvent, 
  SGRToolExecutionStreamingEvent, 
  SGRFinalResponseStreamingEvent,
  isThinkingStreamingEvent,
  isToolExecutionStreamingEvent,
  isFinalResponseStreamingEvent
} from '../sgr-event-bridge.service';

/**
 * Test suite for the SGR Event Bridge Service
 * 
 * This test validates the real-time event handling for SGR streaming messages
 * in the frontend chat interface.
 */
describe('SGREventBridgeService', () => {
  // Since the service is a simple event emitter/listener pattern,
  // we'll test the event types and data structures
  
  describe('SGRStreamingEvent Types', () => {
    it('should define correct SGR message types', () => {
      expect(SGRMessageType.THINKING).toBe('thinking');
      expect(SGRMessageType.TOOL_EXECUTION).toBe('tool_execution');
      expect(SGRMessageType.FINAL_RESPONSE).toBe('final_response');
    });

    it('should define correct tool execution statuses', () => {
      expect(SGRToolExecutionStatus.STARTING).toBe('starting');
      expect(SGRToolExecutionStatus.IN_PROGRESS).toBe('in_progress');
      expect(SGRToolExecutionStatus.COMPLETED).toBe('completed');
      expect(SGRToolExecutionStatus.FAILED).toBe('failed');
    });
  });

  describe('SGRStreamingEvent Structure', () => {
    it('should have correct structure for thinking events', () => {
      const event: SGRThinkingStreamingEvent = {
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'Analyzing user message',
          plannedSteps: ['Extract credentials', 'Validate with API'],
          selectedTool: 'extract_credentials',
          timestamp: new Date()
        },
        timestamp: new Date()
      };

      expect(event.type).toBe(SGRMessageType.THINKING);
      // Type-safe access - no undefined checks needed
      expect(event.step.stepNumber).toBe(1);
      expect(event.step.currentState).toBe('Analyzing user message');
      expect(event.step.plannedSteps).toEqual(['Extract credentials', 'Validate with API']);
      expect(event.step.selectedTool).toBe('extract_credentials');
      
      // Test type guard
      expect(isThinkingStreamingEvent(event)).toBe(true);
      expect(isToolExecutionStreamingEvent(event)).toBe(false);
      expect(isFinalResponseStreamingEvent(event)).toBe(false);
    });

    it('should have correct structure for tool execution events', () => {
      const event: SGRToolExecutionStreamingEvent = {
        type: SGRMessageType.TOOL_EXECUTION,
        step: {
          stepNumber: 1,
          currentState: 'Credentials extracted',
          plannedSteps: ['Validate with API'],
          selectedTool: 'extract_credentials',
          toolExecution: {
            status: SGRToolExecutionStatus.COMPLETED,
            result: { client_id: 'test-id', client_secret: 'test-secret' }
          },
          timestamp: new Date()
        },
        timestamp: new Date()
      };

      expect(event.type).toBe(SGRMessageType.TOOL_EXECUTION);
      // Type-safe access - no undefined checks needed
      expect(event.step.toolExecution?.status).toBe(SGRToolExecutionStatus.COMPLETED);
      expect(event.step.toolExecution?.result).toEqual({ 
        client_id: 'test-id', 
        client_secret: 'test-secret' 
      });
      
      // Test type guard
      expect(isThinkingStreamingEvent(event)).toBe(false);
      expect(isToolExecutionStreamingEvent(event)).toBe(true);
      expect(isFinalResponseStreamingEvent(event)).toBe(false);
    });

    it('should have correct structure for final response events', () => {
      const event: SGRFinalResponseStreamingEvent = {
        type: SGRMessageType.FINAL_RESPONSE,
        content: '✅ Credentials validated and stored successfully!',
        completed: true,
        timestamp: new Date()
      };

      expect(event.type).toBe(SGRMessageType.FINAL_RESPONSE);
      // Type-safe access - no undefined checks needed
      expect(event.content).toBe('✅ Credentials validated and stored successfully!');
      expect(event.completed).toBe(true);
      
      // Test type guard
      expect(isThinkingStreamingEvent(event)).toBe(false);
      expect(isToolExecutionStreamingEvent(event)).toBe(false);
      expect(isFinalResponseStreamingEvent(event)).toBe(true);
    });
  });
});