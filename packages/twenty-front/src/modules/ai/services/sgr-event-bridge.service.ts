/**
 * SGR Event Bridge Service
 *
 * Bridges backend SGR events to frontend via WebSocket or polling.
 * Handles real-time updates for AI thinking process visualization.
 */

import {
  SGRMessageType,
  SGRThinkingStep,
  SGRToolExecutionStatus,
} from '@/ai/types/sgr-message.types';
import { useEffect, useState } from 'react';

/**
 * Connection state for SGR bridge pool management
 */
interface SGRConnectionState {
  agentId: string;
  threadId: string;
  isListening: boolean;
  connectionStartTime: Date;
  lastEventTime: Date | null;
  listenerCount: number;
  pollingInterval: NodeJS.Timeout | null;
}

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

export type SGREvent =
  | SGRThinkingEvent
  | SGRToolExecutionEvent
  | SGRFinalResponseEvent;

/**
 * Type guard functions for runtime type safety
 */
export function isThinkingEvent(event: SGREvent): event is SGRThinkingEvent {
  return event.type === SGRMessageType.THINKING;
}

export function isToolExecutionEvent(
  event: SGREvent,
): event is SGRToolExecutionEvent {
  return event.type === SGRMessageType.TOOL_EXECUTION;
}

export function isFinalResponseEvent(
  event: SGREvent,
): event is SGRFinalResponseEvent {
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
  step: SGRThinkingStep; // Required for thinking events
}

/**
 * SGR Tool execution streaming event - always has step data
 */
export interface SGRToolExecutionStreamingEvent extends BaseSGRStreamingEvent {
  type: SGRMessageType.TOOL_EXECUTION;
  step: SGRThinkingStep; // Required for tool execution events
}

/**
 * SGR Final response streaming event - has different structure
 */
export interface SGRFinalResponseStreamingEvent extends BaseSGRStreamingEvent {
  type: SGRMessageType.FINAL_RESPONSE;
  content: string; // Required for final response
  completed: boolean; // Required for final response
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
export function isThinkingStreamingEvent(
  event: SGRStreamingEvent,
): event is SGRThinkingStreamingEvent {
  return event.type === SGRMessageType.THINKING;
}

export function isToolExecutionStreamingEvent(
  event: SGRStreamingEvent,
): event is SGRToolExecutionStreamingEvent {
  return event.type === SGRMessageType.TOOL_EXECUTION;
}

export function isFinalResponseStreamingEvent(
  event: SGRStreamingEvent,
): event is SGRFinalResponseStreamingEvent {
  return event.type === SGRMessageType.FINAL_RESPONSE;
}

/**
 * Helper function to safely access step data
 */
export function getEventStep(event: SGRStreamingEvent): SGRThinkingStep | null {
  return isThinkingStreamingEvent(event) || isToolExecutionStreamingEvent(event)
    ? event.step
    : null;
}

/**
 * SGR Event Bridge Service
 *
 * This service handles real-time communication between backend SGR processes
 * and frontend visualization components with proper connection pooling.
 */
class SGREventBridgeService {
  private eventListeners: Array<(event: SGREvent) => void> = [];
  private connectionPool: Map<string, SGRConnectionState> = new Map();
  private readonly maxConnections = 5;
  private readonly connectionTimeout = 300000; // 5 minutes
  private lastEventTimestamp: Date = new Date();

  private createConnectionKey(agentId: string, threadId: string): string {
    return `${agentId}-${threadId}`;
  }

  /**
   * Initialize the SGR event bridge for a specific agent and thread
   */
  initialize(agentId: string, threadId: string): void {
    const connectionKey = this.createConnectionKey(agentId, threadId);

    // Clean up stale connections before creating new ones
    this.cleanupStaleConnections();

    // Check if connection already exists and is active
    const existingConnection = this.connectionPool.get(connectionKey);
    if (existingConnection && existingConnection.isListening) {
      console.log(
        `SGR Event Bridge: Reusing existing connection for ${connectionKey}`,
      );
      existingConnection.listenerCount++;
      return;
    }

    // Create new connection
    const connection: SGRConnectionState = {
      agentId,
      threadId,
      isListening: false,
      connectionStartTime: new Date(),
      lastEventTime: null,
      listenerCount: 1,
      pollingInterval: null,
    };

    this.connectionPool.set(connectionKey, connection);
    console.log(
      `SGR Event Bridge: Initialized for agent ${agentId}, thread ${threadId}`,
    );
  }

  /**
   * Start listening for SGR events
   */
  startListening(agentId: string, threadId: string): void {
    const connectionKey = this.createConnectionKey(agentId, threadId);
    const connection = this.connectionPool.get(connectionKey);

    if (!connection) {
      console.warn(
        `SGR Event Bridge: No connection found for ${connectionKey}`,
      );
      return;
    }

    if (connection.isListening) {
      console.log(`SGR Event Bridge: Already listening for ${connectionKey}`);
      return;
    }

    connection.isListening = true;
    connection.lastEventTime = new Date();

    // For now using polling, can be upgraded to WebSocket later
    connection.pollingInterval = setInterval(() => {
      this.pollForEvents(agentId, threadId);
    }, 1000);

    console.log(
      `SGR Event Bridge: Started listening for events (${connectionKey})`,
    );
  }

  /**
   * Stop listening for events
   */
  stopListening(agentId: string, threadId: string): void {
    const connectionKey = this.createConnectionKey(agentId, threadId);
    const connection = this.connectionPool.get(connectionKey);

    if (!connection) {
      return;
    }

    // Decrease listener count
    connection.listenerCount = Math.max(0, connection.listenerCount - 1);

    // Only stop if no more listeners
    if (connection.listenerCount === 0) {
      if (connection.pollingInterval) {
        clearInterval(connection.pollingInterval);
        connection.pollingInterval = null;
      }
      connection.isListening = false;
      console.log(
        `SGR Event Bridge: Stopped listening for events (${connectionKey})`,
      );

      // Remove connection after a delay to allow for reuse
      setTimeout(() => {
        this.connectionPool.delete(connectionKey);
      }, 5000);
    }
  }

  /**
   * Clean up stale connections
   */
  private cleanupStaleConnections(): void {
    const now = new Date();
    const connectionsToRemove: string[] = [];

    for (const [key, connection] of this.connectionPool.entries()) {
      const age = now.getTime() - connection.connectionStartTime.getTime();
      const isStale = age > this.connectionTimeout;
      const isInactive =
        connection.listenerCount === 0 && !connection.isListening;

      if (isStale || isInactive) {
        // Clean up polling interval if exists
        if (connection.pollingInterval) {
          clearInterval(connection.pollingInterval);
        }
        connectionsToRemove.push(key);
      }
    }

    connectionsToRemove.forEach((key) => {
      this.connectionPool.delete(key);
      console.log(`SGR Bridge: Cleaned up stale connection ${key}`);
    });

    // Enforce max connections limit
    if (this.connectionPool.size > this.maxConnections) {
      const oldestConnections = Array.from(this.connectionPool.entries())
        .sort(
          ([, a], [, b]) =>
            a.connectionStartTime.getTime() - b.connectionStartTime.getTime(),
        )
        .slice(0, this.connectionPool.size - this.maxConnections);

      oldestConnections.forEach(([key, connection]) => {
        if (connection.pollingInterval) {
          clearInterval(connection.pollingInterval);
        }
        this.connectionPool.delete(key);
        console.log(`SGR Bridge: Removed old connection ${key} due to limit`);
      });
    }
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
    this.eventListeners = this.eventListeners.filter(
      (listener) => listener !== callback,
    );
  }

  /**
   * Poll for SGR events (placeholder implementation)
   * In a real implementation, this would call backend API or WebSocket
   */
  private async pollForEvents(
    agentId: string,
    threadId: string,
  ): Promise<void> {
    if (!agentId || !threadId) {
      return;
    }

    try {
      // In a real implementation, this would fetch events from backend
      // For now, we'll simulate no new events
      // const response = await fetch(`/api/agents/${agentId}/threads/${threadId}/sgr-events`);
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
    this.eventListeners.forEach((listener) => {
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
      timestamp: new Date(),
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
    error?: string,
  ): void {
    const event: SGRToolExecutionEvent = {
      type: SGRMessageType.TOOL_EXECUTION,
      toolName,
      status,
      result,
      error,
      threadId,
      timestamp: new Date(),
    };

    this.dispatchEvent(event);
  }

  /**
   * Emit a final response event
   */
  emitFinalResponseEvent(
    content: string,
    success: boolean,
    threadId: string,
  ): void {
    const event: SGRFinalResponseEvent = {
      type: SGRMessageType.FINAL_RESPONSE,
      content,
      success,
      threadId,
      timestamp: new Date(),
    };

    this.dispatchEvent(event);
  }

  /**
   * Get service status
   */
  getStatus(): {
    connectionCount: number;
    activeConnections: string[];
    lastEventTimestamp: Date;
    listenerCount: number;
  } {
    const activeConnections = Array.from(this.connectionPool.entries())
      .filter(([, conn]) => conn.isListening)
      .map(([key]) => key);

    return {
      connectionCount: this.connectionPool.size,
      activeConnections,
      lastEventTimestamp: this.lastEventTimestamp,
      listenerCount: this.eventListeners.length,
    };
  }

  /**
   * Force cleanup all connections (for debugging/testing)
   */
  forceCleanup(): void {
    this.connectionPool.forEach((connection, key) => {
      if (connection.pollingInterval) {
        clearInterval(connection.pollingInterval);
      }
    });
    this.connectionPool.clear();
    console.log('SGR Event Bridge: Force cleanup completed');
  }
}

// Singleton instance
export const sgrEventBridge = new SGREventBridgeService();

/**
 * React hook for using SGR event bridge with proper connection management
 */
export const useSGREvents = (agentId: string, threadId: string | null) => {
  const [events, setEvents] = useState<SGREvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionKey, setConnectionKey] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!threadId || !agentId) {
      setIsConnected(false);
      return;
    }

    const connectionKey = `${agentId}-${threadId}`;

    // Prevent duplicate connections for the same agent/thread
    if (connectionKey === connectionKey) {
      return;
    }

    // Cleanup previous connection if exists
    if (connectionKey && isInitialized) {
      const [prevAgentId, prevThreadId] = connectionKey.split('-');
      sgrEventBridge.stopListening(prevAgentId, prevThreadId);
    }

    setConnectionKey(connectionKey);
    setIsInitialized(true);

    // Initialize the event bridge
    sgrEventBridge.initialize(agentId, threadId);

    // Start listening for events
    sgrEventBridge.startListening(agentId, threadId);
    setIsConnected(true);

    // Add event listener
    const handleEvent = (event: SGREvent) => {
      setEvents((prevEvents) => [...prevEvents, event]);
    };

    sgrEventBridge.addEventListener(handleEvent);

    // Cleanup function
    return () => {
      sgrEventBridge.removeEventListener(handleEvent);
      sgrEventBridge.stopListening(agentId, threadId);
      setIsConnected(false);
    };
  }, [agentId, threadId]);

  // Clear events when thread changes
  useEffect(() => {
    setEvents([]);
  }, [threadId]);

  return {
    events,
    isConnected,
    emitThinkingEvent: sgrEventBridge.emitThinkingEvent.bind(sgrEventBridge),
    emitToolExecutionEvent:
      sgrEventBridge.emitToolExecutionEvent.bind(sgrEventBridge),
    emitFinalResponseEvent:
      sgrEventBridge.emitFinalResponseEvent.bind(sgrEventBridge),
    getStatus: sgrEventBridge.getStatus.bind(sgrEventBridge),
  };
};

/**
 * Hook for connecting to backend SGR streaming
 * This would handle the actual WebSocket or HTTP streaming connection
 */
export const useSGRBackendStreaming = (
  agentId: string,
  threadId: string | null,
  onEvent: (event: SGREvent) => void,
) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!threadId) {
      return;
    }

    // In a real implementation, this would establish WebSocket connection
    // or set up HTTP streaming connection to backend

    const connection: WebSocket | EventSource | null = null;

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
    error,
  };
};
