/**
 * Frontend Event Emitter Utility
 * 
 * Provides a simple event emitter for frontend event handling,
 * bridging backend events to frontend components.
 */

import { BUSINESS_SETUP_EVENTS } from 'twenty-shared/types';

type EventHandler = (...args: any[]) => void;

class FrontendEventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(...args));
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}

// Global event emitter instance
const globalEventEmitter = new FrontendEventEmitter();

/**
 * Get the global event emitter instance
 */
export const getEventEmitter = (): FrontendEventEmitter => {
  return globalEventEmitter;
};

/**
 * Event types for AI agent welcome system
 * Using centralized constants from business-setup-events.types.ts
 */
export const AI_AGENT_EVENTS = BUSINESS_SETUP_EVENTS;

export type AIAgentEventType = typeof BUSINESS_SETUP_EVENTS[keyof typeof BUSINESS_SETUP_EVENTS];