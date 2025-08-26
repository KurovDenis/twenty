import { renderHook, act } from '@testing-library/react';
import { useSGRStreaming } from '../useSGRStreaming';
import { SGRMessageType, SGRToolExecutionStatus } from '@/ai/types/sgr-message.types';

// Mock the SGR event bridge service
jest.mock('@/ai/services/sgr-event-bridge.service', () => ({
  useSGREvents: jest.fn().mockReturnValue({
    events: [],
    isConnected: true
  })
}));

/**
 * Test suite for the useSGRStreaming hook
 * 
 * This test validates the frontend hook that handles SGR streaming messages
 * and updates the UI in real-time.
 */
describe('useSGRStreaming', () => {
  const mockAgentId = 'agent-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useSGRStreaming(mockAgentId));
    
    expect(result.current.isStreamingSGR).toBe(false);
    expect(result.current.currentSGRStep).toBeNull();
    expect(result.current.sgrEvents).toEqual([]);
  });

  it('should handle thinking messages', () => {
    // Mock the useSGREvents hook to return a thinking event
    const mockUseSGREvents = require('@/ai/services/sgr-event-bridge.service').useSGREvents;
    mockUseSGREvents.mockReturnValue({
      events: [{
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'Analyzing user message',
          plannedSteps: ['Extract credentials'],
          selectedTool: 'extract_credentials',
          timestamp: new Date()
        },
        timestamp: new Date()
      }],
      isConnected: true
    });
    
    const { result } = renderHook(() => useSGRStreaming(mockAgentId));
    
    expect(result.current.isStreamingSGR).toBe(true);
    expect(result.current.currentSGRStep).toBe('Анализирую шаг 1...');
  });

  it('should handle tool execution messages', () => {
    // Mock the useSGREvents hook to return a tool execution event
    const mockUseSGREvents = require('@/ai/services/sgr-event-bridge.service').useSGREvents;
    mockUseSGREvents.mockReturnValue({
      events: [{
        type: SGRMessageType.TOOL_EXECUTION,
        step: {
          stepNumber: 1,
          currentState: 'Credentials extracted',
          plannedSteps: ['Validate with API'],
          selectedTool: 'extract_credentials',
          toolExecution: {
            status: SGRToolExecutionStatus.IN_PROGRESS
          },
          timestamp: new Date()
        },
        timestamp: new Date()
      }],
      isConnected: true
    });
    
    const { result } = renderHook(() => useSGRStreaming(mockAgentId));
    
    expect(result.current.isStreamingSGR).toBe(true);
    expect(result.current.currentSGRStep).toBe('extract_credentials: in_progress');
  });

  it('should handle final response messages', () => {
    // Mock the useSGREvents hook to return a final response event
    const mockUseSGREvents = require('@/ai/services/sgr-event-bridge.service').useSGREvents;
    mockUseSGREvents.mockReturnValue({
      events: [{
        type: SGRMessageType.FINAL_RESPONSE,
        content: '✅ Success!',
        completed: true,
        timestamp: new Date()
      }],
      isConnected: true
    });
    
    const { result } = renderHook(() => useSGRStreaming(mockAgentId));
    
    expect(result.current.isStreamingSGR).toBe(false);
    expect(result.current.currentSGRStep).toBeNull();
  });

  it('should clear SGR messages', () => {
    // Mock the useSGREvents hook to return events
    const mockUseSGREvents = require('@/ai/services/sgr-event-bridge.service').useSGREvents;
    mockUseSGREvents.mockReturnValue({
      events: [{
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'Analyzing',
          plannedSteps: [],
          selectedTool: 'test_tool',
          timestamp: new Date()
        },
        timestamp: new Date()
      }],
      isConnected: true
    });
    
    const { result } = renderHook(() => useSGRStreaming(mockAgentId));
    
    // Initially should have events
    expect(result.current.sgrEvents.length).toBe(1);
    
    // Clear events
    act(() => {
      result.current.clearSGRMessages();
    });
    
    // Should be cleared
    expect(result.current.sgrEvents.length).toBe(0);
  });
});