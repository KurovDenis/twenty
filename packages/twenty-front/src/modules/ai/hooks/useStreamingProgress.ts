import { useCallback, useEffect, useState } from 'react';

export interface ProgressUpdate {
  operationId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  step: string;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  metadata?: {
    stepNumber?: number;
    totalSteps?: number;
    agentType?: string;
    providerName?: string;
  };
}

export interface StreamingProgressState {
  updates: ProgressUpdate[];
  currentUpdate: ProgressUpdate | null;
  isActive: boolean;
  isComplete: boolean;
  hasError: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  totalProgress: number;
}

export interface UseStreamingProgressOptions {
  autoStart?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  onComplete?: (updates: ProgressUpdate[]) => void;
  onError?: (error: Error) => void;
  onProgress?: (update: ProgressUpdate) => void;
}

/**
 * Hook for real-time progress tracking using Server-Sent Events
 * Provides streaming progress updates for long-running Supervisor operations
 */
export const useStreamingProgress = (
  operationId: string | null,
  options: UseStreamingProgressOptions = {},
) => {
  const {
    autoStart = true,
    reconnectAttempts = 3,
    reconnectDelay = 2000,
    onComplete,
    onError,
    onProgress,
  } = options;

  const [state, setState] = useState<StreamingProgressState>({
    updates: [],
    currentUpdate: null,
    isActive: false,
    isComplete: false,
    hasError: false,
    connectionState: 'disconnected',
    totalProgress: 0,
  });

  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [reconnectTimeout, setReconnectTimeout] =
    useState<NodeJS.Timeout | null>(null);

  /**
   * Calculate overall progress from updates
   */
  const calculateTotalProgress = useCallback(
    (updates: ProgressUpdate[]): number => {
      if (updates.length === 0) return 0;

      const latestUpdate = updates[updates.length - 1];
      if (latestUpdate.status === 'completed') return 100;
      if (latestUpdate.status === 'failed') return 0;

      return latestUpdate.progress;
    },
    [],
  );

  /**
   * Add new progress update to state
   */
  const addProgressUpdate = useCallback(
    (update: ProgressUpdate) => {
      setState((prev) => {
        const newUpdates = [...prev.updates, update];
        const totalProgress = calculateTotalProgress(newUpdates);
        const isComplete = update.status === 'completed';
        const hasError = update.status === 'failed';

        return {
          ...prev,
          updates: newUpdates,
          currentUpdate: update,
          isComplete,
          hasError,
          totalProgress,
          isActive: !isComplete && !hasError,
        };
      });

      // Call callbacks
      if (onProgress) {
        onProgress(update);
      }

      if (update.status === 'completed' && onComplete) {
        onComplete(state.updates);
      }

      if (update.status === 'failed' && onError) {
        onError(new Error(update.message));
      }
    },
    [calculateTotalProgress, onProgress, onComplete, onError, state.updates],
  );

  /**
   * Connect to Server-Sent Events stream
   */
  const connect = useCallback(() => {
    if (!operationId || eventSource) {
      return;
    }

    setState((prev) => ({ ...prev, connectionState: 'connecting' }));

    try {
      const newEventSource = new EventSource(
        `/api/supervisor/progress/${operationId}`,
      );
      setEventSource(newEventSource);

      newEventSource.onopen = () => {
        console.log(
          `Connected to progress stream for operation: ${operationId}`,
        );
        setState((prev) => ({
          ...prev,
          connectionState: 'connected',
          isActive: true,
        }));
        setReconnectCount(0);
      };

      newEventSource.onmessage = (event) => {
        try {
          const update: ProgressUpdate = JSON.parse(event.data);
          console.log('Received progress update:', update);
          addProgressUpdate(update);

          // Auto-close on completion or error
          if (update.status === 'completed' || update.status === 'failed') {
            setTimeout(() => {
              disconnect();
            }, 5000); // Keep open for 5 seconds to ensure final updates
          }
        } catch (error) {
          console.error('Failed to parse progress update:', error);
        }
      };

      newEventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setState((prev) => ({ ...prev, connectionState: 'error' }));

        // Attempt to reconnect
        if (reconnectCount < reconnectAttempts) {
          setReconnectCount((prev) => prev + 1);
          console.log(
            `Attempting to reconnect (${reconnectCount + 1}/${reconnectAttempts})`,
          );

          disconnect();
          const timeout = setTimeout(() => {
            connect();
          }, reconnectDelay);
          setReconnectTimeout(timeout);
        } else {
          console.error('Max reconnection attempts reached');
          if (onError) {
            onError(new Error('Connection failed after multiple attempts'));
          }
        }
      };
    } catch (error) {
      console.error('Failed to create EventSource:', error);
      setState((prev) => ({ ...prev, connectionState: 'error' }));
      if (onError) {
        onError(error as Error);
      }
    }
  }, [
    operationId,
    reconnectAttempts,
    reconnectDelay,
    addProgressUpdate,
    onError,
  ]);

  /**
   * Disconnect from Server-Sent Events stream
   */
  const disconnect = useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      setReconnectTimeout(null);
    }

    setState((prev) => ({
      ...prev,
      connectionState: 'disconnected',
      isActive: false,
    }));
  }, []);

  /**
   * Reset progress state and start fresh
   */
  const reset = useCallback(() => {
    disconnect();
    setState({
      updates: [],
      currentUpdate: null,
      isActive: false,
      isComplete: false,
      hasError: false,
      connectionState: 'disconnected',
      totalProgress: 0,
    });
    setReconnectCount(0);
  }, [disconnect]);

  /**
   * Start progress tracking (connect to stream)
   */
  const start = useCallback(() => {
    if (operationId) {
      connect();
    }
  }, [operationId, connect]);

  /**
   * Stop progress tracking (disconnect from stream)
   */
  const stop = useCallback(() => {
    disconnect();
  }, [disconnect]);

  // Auto-start when operationId changes
  useEffect(() => {
    if (operationId && autoStart) {
      start();
    }

    return () => {
      disconnect();
    };
  }, [operationId, autoStart, start, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // State
    updates: state.updates,
    currentUpdate: state.currentUpdate,
    isActive: state.isActive,
    isComplete: state.isComplete,
    hasError: state.hasError,
    connectionState: state.connectionState,
    totalProgress: state.totalProgress,

    // Computed
    lastUpdate: state.updates[state.updates.length - 1] || null,
    stepCount: state.updates.length,
    currentStep: state.currentUpdate?.step || '',
    currentMessage: state.currentUpdate?.message || '',

    // Actions
    start,
    stop,
    reset,
    connect,
    disconnect,
  };
};

/**
 * Simplified hook for basic progress tracking
 */
export const useSimpleProgress = (operationId: string | null) => {
  const { totalProgress, currentMessage, isComplete, hasError, isActive } =
    useStreamingProgress(operationId);

  return {
    progress: totalProgress,
    message: currentMessage,
    isComplete,
    hasError,
    isActive,
  };
};
