/**
 * AI Agent Event Bridge Service
 *
 * Bridges backend AI agent events to frontend via WebSocket or polling.
 * For now using polling, can be upgraded to WebSocket later.
 */

import { useEffect } from 'react';
import { WelcomeChatCreatedEventFrontend } from 'twenty-shared/types';
import { getCurrentUserId } from '~/auth/utils/get-current-user-id';
import { AI_AGENT_EVENTS, getEventEmitter } from '~/utils/event-emitter';

class AIAgentEventBridge {
  private eventEmitter = getEventEmitter();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isListening = false;
  private lastEventTimestamp: Date = new Date();

  /**
   * Start listening for AI agent events
   */
  startListening(): void {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.lastEventTimestamp = new Date();

    // Poll for events every 2 seconds
    this.pollingInterval = setInterval(() => {
      this.pollForEvents();
    }, 2000);

    console.log('AI Agent Event Bridge: Started listening for events');
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
    console.log('AI Agent Event Bridge: Stopped listening for events');
  }

  /**
   * Poll for new AI agent events from backend
   */
  private async pollForEvents(): Promise<void> {
    try {
      const userId = getCurrentUserId();
      // Get workspace ID from localStorage or session storage
      const workspaceId = this.getCurrentWorkspaceId();

      if (!userId || !workspaceId) {
        return;
      }

      // TODO: Replace with actual API call to fetch events
      // For now, simulate event polling
      const response = await fetch(
        `/rest/ai-agent/events?since=${this.lastEventTimestamp.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.ok) {
        return;
      }

      const events = await response.json();

      events.forEach((event: any) => {
        this.handleBackendEvent(event);
      });

      this.lastEventTimestamp = new Date();
    } catch (error) {
      console.warn('AI Agent Event Bridge: Failed to poll for events:', error);
    }
  }

  /**
   * Handle backend event and emit to frontend
   */
  private handleBackendEvent(event: any): void {
    switch (event.type) {
      case 'ai-agent.welcome.chat-created':
        this.eventEmitter.emit(
          AI_AGENT_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
          event.payload,
        );
        break;
      case 'ai-agent.welcome.chat-creation-failed':
        this.eventEmitter.emit(
          AI_AGENT_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED,
          event.payload,
        );
        break;
      case 'ai-agent.welcome.chat-creation-started':
        this.eventEmitter.emit(
          AI_AGENT_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED,
          event.payload,
        );
        break;
      default:
        console.warn('AI Agent Event Bridge: Unknown event type:', event.type);
    }
  }

  /**
   * Manually trigger a welcome chat created event (for testing)
   */
  simulateWelcomeChatCreated(threadId: string, aiResponse: string): void {
    const userId = getCurrentUserId();
    const workspaceId = this.getCurrentWorkspaceId();

    if (!userId || !workspaceId) {
      return;
    }

    const event: WelcomeChatCreatedEventFrontend = {
      userId,
      workspaceId,
      threadId,
      aiResponse,
      timestamp: new Date().toISOString(),
    };

    this.eventEmitter.emit(
      AI_AGENT_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
      event,
    );
  }

  /**
   * Get current workspace ID from local storage or URL
   */
  private getCurrentWorkspaceId(): string | null {
    // Try to get from URL first
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length > 1 && pathParts[1] !== '') {
      return pathParts[1]; // Assuming workspace subdomain is in URL
    }

    // Fallback to localStorage/sessionStorage if available
    const storedWorkspace = localStorage.getItem('currentWorkspace');
    if (storedWorkspace) {
      try {
        const workspace = JSON.parse(storedWorkspace);
        return workspace.id;
      } catch (e) {
        console.warn('Failed to parse stored workspace:', e);
      }
    }

    return null;
  }
}

// Global instance
const aiAgentEventBridge = new AIAgentEventBridge();

export { aiAgentEventBridge };

/**
 * Hook to automatically start/stop event listening
 */
export const useAIAgentEventBridge = () => {
  useEffect(() => {
    aiAgentEventBridge.startListening();

    return () => {
      aiAgentEventBridge.stopListening();
    };
  }, []);

  return aiAgentEventBridge;
};

// Auto-start when module loads in browser
if (typeof window !== 'undefined') {
  aiAgentEventBridge.startListening();
}
