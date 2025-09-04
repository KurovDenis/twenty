/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import {
  BUSINESS_SETUP_EVENTS,
  WelcomeChatCreatedEventFrontend,
  WelcomeChatCreationFailedEventFrontend,
} from 'twenty-shared/types';
import { getEventEmitter } from '~/utils/event-emitter';
import { useWelcomeMessage } from './useWelcomeMessage';

// Mock dependencies
jest.mock('~/auth/utils/get-current-user-id', () => ({
  getCurrentUserId: jest.fn(() => 'test-user-id'),
}));

jest.mock('~/utils/event-emitter', () => ({
  getEventEmitter: jest.fn(),
}));

describe('useWelcomeMessage', () => {
  let mockEventEmitter: {
    on: jest.Mock;
    off: jest.Mock;
    emit: jest.Mock;
  };

  beforeEach(() => {
    mockEventEmitter = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };
    (getEventEmitter as jest.Mock).mockReturnValue(mockEventEmitter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useWelcomeMessage());

    expect(result.current.welcomeMessage).toBeNull();
    expect(result.current.showPopup).toBe(false);
    expect(result.current.threadId).toBeNull();
  });

  it('should register event listeners on mount', () => {
    renderHook(() => useWelcomeMessage());

    expect(mockEventEmitter.on).toHaveBeenCalledWith(
      BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
      expect.any(Function),
    );
    expect(mockEventEmitter.on).toHaveBeenCalledWith(
      BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED,
      expect.any(Function),
    );
  });

  it('should handle welcome chat created event for current user', () => {
    const { result } = renderHook(() => useWelcomeMessage());

    const mockEvent: WelcomeChatCreatedEventFrontend = {
      userId: 'test-user-id',
      workspaceId: 'test-workspace',
      threadId: 'test-thread',
      aiResponse: 'Welcome message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    // Get the registered handler
    const onCalls = mockEventEmitter.on.mock.calls;
    const chatCreatedHandler = onCalls.find(
      (call) => call[0] === BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
    )?.[1];

    act(() => {
      chatCreatedHandler(mockEvent);
    });

    expect(result.current.welcomeMessage).toBe('Welcome message');
    expect(result.current.threadId).toBe('test-thread');
    expect(result.current.showPopup).toBe(true);
  });

  it('should ignore welcome chat created event for different user', () => {
    const { result } = renderHook(() => useWelcomeMessage());

    const mockEvent: WelcomeChatCreatedEventFrontend = {
      userId: 'different-user-id',
      workspaceId: 'test-workspace',
      threadId: 'test-thread',
      aiResponse: 'Welcome message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    const onCalls = mockEventEmitter.on.mock.calls;
    const chatCreatedHandler = onCalls.find(
      (call) => call[0] === BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
    )?.[1];

    act(() => {
      chatCreatedHandler(mockEvent);
    });

    expect(result.current.welcomeMessage).toBeNull();
    expect(result.current.showPopup).toBe(false);
  });

  it('should handle welcome chat creation failed event', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    renderHook(() => useWelcomeMessage());

    const mockEvent: WelcomeChatCreationFailedEventFrontend = {
      userId: 'test-user-id',
      workspaceId: 'test-workspace',
      error: 'Test error',
      attempts: 3,
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    const onCalls = mockEventEmitter.on.mock.calls;
    const chatFailedHandler = onCalls.find(
      (call) =>
        call[0] === BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED,
    )?.[1];

    act(() => {
      chatFailedHandler(mockEvent);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Welcome chat creation failed:',
      'Test error',
    );
    consoleSpy.mockRestore();
  });

  it('should provide callback functions', () => {
    const { result } = renderHook(() => useWelcomeMessage());

    expect(typeof result.current.showWelcomePopup).toBe('function');
    expect(typeof result.current.hideWelcomePopup).toBe('function');
    expect(typeof result.current.continueChat).toBe('function');
  });

  it('should update popup visibility with callback functions', () => {
    const { result } = renderHook(() => useWelcomeMessage());

    act(() => {
      result.current.showWelcomePopup();
    });
    expect(result.current.showPopup).toBe(true);

    act(() => {
      result.current.hideWelcomePopup();
    });
    expect(result.current.showPopup).toBe(false);
  });

  it('should handle continue chat action', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { result } = renderHook(() => useWelcomeMessage());

    // Set a thread ID first
    const mockEvent: WelcomeChatCreatedEventFrontend = {
      userId: 'test-user-id',
      workspaceId: 'test-workspace',
      threadId: 'test-thread',
      aiResponse: 'Welcome message',
      timestamp: '2023-01-01T00:00:00.000Z',
    };

    const onCalls = mockEventEmitter.on.mock.calls;
    const chatCreatedHandler = onCalls.find(
      (call) => call[0] === BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
    )?.[1];

    act(() => {
      chatCreatedHandler(mockEvent);
    });

    act(() => {
      result.current.continueChat();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Continue chat with thread:',
      'test-thread',
    );
    expect(result.current.showPopup).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useWelcomeMessage());

    unmount();

    expect(mockEventEmitter.off).toHaveBeenCalledWith(
      BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
      expect.any(Function),
    );
    expect(mockEventEmitter.off).toHaveBeenCalledWith(
      BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED,
      expect.any(Function),
    );
  });
});
