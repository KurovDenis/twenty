/**
 * SGR Event Bridge Service
 * 
 * Bridges backend SGR events to frontend via WebSocket or polling.
 * Handles real-time updates for AI thinking process visualization.
 */

import {
    SGRMessageType,
    SGRThinkingStep,
    SGRToolExecutionStatus
} from '@/ai/types/sgr-message.types';
import { useEffect, useState } from 'react';

/**
 * SGR Event Types
 */
export interface SGRThinkingEvent {
  type: SGRMessageType.THINKING;
  step: SGRThinkingStep;
  threadId: string;
  timestamp: Date;
}

export interface SGRToolExecutionEvent {
  type: SGRMessageType.TOOL_EXECUTION;
  toolName: string;
  status: SGRToolExecutionStatus;
  result?: any;
  error?: string;
  threadId: string;
  timestamp: Date;
}

export interface SGRFinalResponseEvent {
  type: SGRMessageType.FINAL_RESPONSE;
  content: string;
  success: boolean;
  threadId: string;
  timestamp: Date;
}

export type SGREvent = SGRThinkingEvent | SGRToolExecutionEvent | SGRFinalResponseEvent;

/**
 * Type guard functions for runtime type safety
 */
export function isThinkingEvent(event: SGREvent): event is SGRThinkingEvent {
  return event.type === SGRMessageType.THINKING;
}

export function isToolExecutionEvent(event: SGREvent): event is SGRToolExecutionEvent {
  return event.type === SGRMessageType.TOOL_EXECUTION;
}

export function isFinalResponseEvent(event: SGREvent): event is SGRFinalResponseEvent {
  return event.type === SGRMessageType.FINAL_RESPONSE;
}

/**
 * Base interface for all SGR streaming events
 */
interface BaseSGRStreamingEvent {
  type: SGRMessageType;
  timestamp: Date;
}

/**
 * SGR Thinking streaming event - always has step data
 */
export interface SGRThinkingStreamingEvent extends BaseSGRStreamingEvent {
  type: SGRMessageType.THINKING;
  step: SGRThinkingStep;  // Required for thinking events
}

/**
 * SGR Tool execution streaming event - always has step data
 */
export interface SGRToolExecutionStreamingEvent extends BaseSGRStreamingEvent {
  type: SGRMessageType.TOOL_EXECUTION;
  step: SGRThinkingStep;  // Required for tool execution events
}

/**
 * SGR Final response streaming event - has different structure
 */
export interface SGRFinalResponseStreamingEvent extends BaseSGRStreamingEvent {
  type: SGRMessageType.FINAL_RESPONSE;
  content: string;        // Required for final response
  completed: boolean;     // Required for final response
}

/**
 * Discriminated union for type-safe SGR streaming events
 */
export type SGRStreamingEvent = 
  | SGRThinkingStreamingEvent 
  | SGRToolExecutionStreamingEvent 
  | SGRFinalResponseStreamingEvent;

/**
 * Type guard functions for runtime type checking
 */
export function isThinkingStreamingEvent(event: SGRStreamingEvent): event is SGRThinkingStreamingEvent {
  return event.type === SGRMessageType.THINKING;
}

export function isToolExecutionStreamingEvent(event: SGRStreamingEvent): event is SGRToolExecutionStreamingEvent {
  return event.type === SGRMessageType.TOOL_EXECUTION;
}

export function isFinalResponseStreamingEvent(event: SGRStreamingEvent): event is SGRFinalResponseStreamingEvent {
  return event.type === SGRMessageType.FINAL_RESPONSE;
}

/**
 * Helper function to safely access step data
 */
export function getEventStep(event: SGRStreamingEvent): SGRThinkingStep | null {
  return (isThinkingStreamingEvent(event) || isToolExecutionStreamingEvent(event)) ? event.step : null;
}

/**
 * SGR Event Bridge Service
 * 
 * This service handles real-time communication between backend SGR processes
 * and frontend visualization components.
 */
class SGREventBridgeService {
  private eventListeners: Array<(event: SGREvent) => void> = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private isListening = false;
  private lastEventTimestamp: Date = new Date();
  private agentId: string | null = null;
  private threadId: string | null = null;

  /**
   * Initialize the SGR event bridge for a specific agent and thread
   */
  initialize(agentId: string, threadId: string): void {
    this.agentId = agentId;
    this.threadId = threadId;
    console.log(`SGR Event Bridge: Initialized for agent ${agentId}, thread ${threadId}`);
  }

  /**
   * Start listening for SGR events
   */
  startListening(): void {
    if (this.isListening || !this.agentId || !this.threadId) {
      return;
    }

    this.isListening = true;
    this.lastEventTimestamp = new Date();
    
    // For now using polling, can be upgraded to WebSocket later
    this.pollingInterval = setInterval(() => {
      this.pollForEvents();
    }, 1000);

    console.log('SGR Event Bridge: Started listening for events');
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isListening = false;
    console.log('SGR Event Bridge: Stopped listening for events');
  }

  /**
   * Add event listener
   */
  addEventListener(callback: (event: SGREvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(callback: (event: SGREvent) => void): void {
    this.eventListeners = this.eventListeners.filter(listener => listener !== callback);
  }

  /**
   * Poll for SGR events (placeholder implementation)
   * In a real implementation, this would call backend API or WebSocket
   */
  private async pollForEvents(): Promise<void> {
    if (!this.agentId || !this.threadId) {
      return;
    }

    try {
      // In a real implementation, this would fetch events from backend
      // For now, we'll simulate no new events
      // const response = await fetch(`/api/agents/${this.agentId}/threads/${this.threadId}/sgr-events`);
      // const events: SGREvent[] = await response.json();
      // 
      // events.forEach(event => {
      //   this.dispatchEvent(event);
      // });
      
      // Simulate checking for events
      // In real implementation, backend would push events via WebSocket
    } catch (error) {
      console.error('SGR Event Bridge: Failed to poll for events', error);
    }
  }

  /**
   * Dispatch event to all listeners
   */
  private dispatchEvent(event: SGREvent): void {
    this.lastEventTimestamp = new Date();
    
    // Notify all listeners
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('SGR Event Bridge: Error in event listener', error);
      }
    });
  }

  /**
   * Emit a thinking event
   */
  emitThinkingEvent(step: SGRThinkingStep, threadId: string): void {
    const event: SGRThinkingEvent = {
      type: SGRMessageType.THINKING,
      step,
      threadId,
      timestamp: new Date()
    };
    
    this.dispatchEvent(event);
  }

  /**
   * Emit a tool execution event
   */
  emitToolExecutionEvent(
    toolName: string, 
    status: SGRToolExecutionStatus, 
    threadId: string,
    result?: any,
    error?: string
  ): void {
    const event: SGRToolExecutionEvent = {
      type: SGRMessageType.TOOL_EXECUTION,
      toolName,
      status,
      result,
      error,
      threadId,
      timestamp: new Date()
    };
    
    this.dispatchEvent(event);
  }

  /**
   * Emit a final response event
   */
  emitFinalResponseEvent(
    content: string, 
    success: boolean, 
    threadId: string
  ): void {
    const event: SGRFinalResponseEvent = {
      type: SGRMessageType.FINAL_RESPONSE,
      content,
      success,
      threadId,
      timestamp: new Date()
    };
    
    this.dispatchEvent(event);
  }

  /**
   * Get service status
   */
  getStatus(): {
    isListening: boolean;
    agentId: string | null;
    threadId: string | null;
    lastEventTimestamp: Date;
    listenerCount: number;
  } {
    return {
      isListening: this.isListening,
      agentId: this.agentId,
      threadId: this.threadId,
      lastEventTimestamp: this.lastEventTimestamp,
      listenerCount: this.eventListeners.length
    };
  }
}

// Singleton instance
export const sgrEventBridge = new SGREventBridgeService();

/**
 * React hook for using SGR event bridge
 */
export const useSGREvents = (agentId: string, threadId: string | null) => {
  const [events, setEvents] = useState<SGREvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    // Initialize the event bridge
    sgrEventBridge.initialize(agentId, threadId);
    
    // Start listening for events
    sgrEventBridge.startListening();
    setIsConnected(true);

    // Add event listener
    const handleEvent = (event: SGREvent) => {
      setEvents(prevEvents => [...prevEvents, event]);
    };

    sgrEventBridge.addEventListener(handleEvent);

    // Cleanup
    return () => {
      sgrEventBridge.removeEventListener(handleEvent);
      sgrEventBridge.stopListening();
      setIsConnected(false);
    };
  }, [agentId, threadId]);

  return {
    events,
    isConnected,
    emitThinkingEvent: sgrEventBridge.emitThinkingEvent.bind(sgrEventBridge),
    emitToolExecutionEvent: sgrEventBridge.emitToolExecutionEvent.bind(sgrEventBridge),
    emitFinalResponseEvent: sgrEventBridge.emitFinalResponseEvent.bind(sgrEventBridge),
    getStatus: sgrEventBridge.getStatus.bind(sgrEventBridge)
  };
};

/**
 * Hook for connecting to backend SGR streaming
 * This would handle the actual WebSocket or HTTP streaming connection
 */
export const useSGRBackendStreaming = (
  agentId: string, 
  threadId: string | null,
  onEvent: (event: SGREvent) => void
) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    // In a real implementation, this would establish WebSocket connection
    // or set up HTTP streaming connection to backend
    
    let connection: WebSocket | EventSource | null = null;
    
    try {
      // Example WebSocket implementation:
      // const ws = new WebSocket(`ws://localhost:3000/api/agents/${agentId}/threads/${threadId}/sgr-stream`);
      // 
      // ws.onopen = () => {
      //   setIsStreaming(true);
      //   setError(null);
      // };
      // 
      // ws.onmessage = (event) => {
      //   const sgrEvent: SGREvent = JSON.parse(event.data);
      //   onEvent(sgrEvent);
      // };
      // 
      // ws.onerror = (err) => {
      //   setError('WebSocket connection error');
      //   console.error('SGR Streaming Error:', err);
      // };
      // 
      // ws.onclose = () => {
      //   setIsStreaming(false);
      // };
      // 
      // connection = ws;
      
      // For now, simulate connection
      setIsStreaming(true);
      setError(null);
      
    } catch (err) {
      setError('Failed to establish SGR streaming connection');
      console.error('SGR Streaming Connection Error:', err);
      setIsStreaming(false);
    }

    // Cleanup
    return () => {
      if (connection) {
        (connection as WebSocket | EventSource).close();
        setIsStreaming(false);
      }
    };
  }, [agentId, threadId, onEvent]);

  return {
    isStreaming,
    error
  };
};