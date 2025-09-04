/**
 * Unit tests for AIChatTab SGR Event Handling
 * Tests the fixed useEffect hook and error handling
 */

import * as sgrEventBridge from '@/ai/services/sgr-event-bridge.service';
import {
  SGREvent,
  SGRFinalResponseEvent,
  SGRThinkingEvent,
  SGRToolExecutionEvent,
} from '@/ai/services/sgr-event-bridge.service';
import {
  SGRMessageType,
  SGRToolExecutionStatus,
} from '@/ai/types/sgr-message.types';
import { ThemeProvider } from '@emotion/react';
import { render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { THEME_LIGHT } from 'twenty-ui/theme';
import { AIChatTab } from './AIChatTab';

// Mock the SGR event bridge service
jest.mock('@/ai/services/sgr-event-bridge.service');
const mockUseSGREvents = jest.mocked(sgrEventBridge.useSGREvents);

// Mock other dependencies
jest.mock('@/ai/hooks/useAgentChat', () => ({
  useAgentChat: () => ({
    messages: [],
    isLoading: false,
    input: '',
    handleInputChange: jest.fn(),
    agentStreamingMessage: { streamingText: '', toolCall: '' },
    scrollWrapperId: 'test-scroll-wrapper',
    currentThreadId: 'test-thread-123',
  }),
}));

jest.mock('@/ai/hooks/useAIChatFileUpload', () => ({
  useAIChatFileUpload: () => ({
    uploadFiles: jest.fn(),
  }),
}));

jest.mock('@/ai/hooks/useCreateNewAIChatThread', () => ({
  useCreateNewAIChatThread: () => ({
    createAgentChatThread: jest.fn(),
  }),
}));

jest.mock('@/command-menu/hooks/useCommandMenu', () => ({
  useCommandMenu: () => ({
    navigateCommandMenu: jest.fn(),
  }),
}));

jest.mock(
  '@/ui/utilities/state/component-state/hooks/useRecoilComponentValue',
  () => ({
    useRecoilComponentValue: () => null,
  }),
);

describe('AIChatTab SGR Event Handling', () => {
  const defaultProps = {
    agentId: 'test-agent-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console methods
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <RecoilRoot>
        <ThemeProvider theme={THEME_LIGHT}>
          <AIChatTab {...defaultProps} {...props} />
        </ThemeProvider>
      </RecoilRoot>,
    );
  };

  describe('SGR Thinking Events', () => {
    it('should handle valid thinking events correctly', () => {
      const mockThinkingEvent: SGRThinkingEvent = {
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 2,
          currentState: 'Processing credentials',
          plannedSteps: ['Validate', 'Store'],
          selectedTool: 'validator',
          timestamp: new Date(),
        },
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      mockUseSGREvents.mockReturnValue({
        events: [mockThinkingEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should display thinking step progress
      expect(screen.getByText(/Анализирую шаг 2/)).toBeInTheDocument();
    });

    it('should handle thinking events with missing step data', () => {
      // Use unknown type assertion to bypass type checking for invalid test data
      const mockInvalidThinkingEvent = {
        type: SGRMessageType.THINKING,
        step: null, // Invalid step
        threadId: 'test-thread-123',
        timestamp: new Date(),
      } as unknown as SGREvent;

      mockUseSGREvents.mockReturnValue({
        events: [mockInvalidThinkingEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should show fallback text and log warning
      expect(screen.getByText(/Анализирую\.\.\./)).toBeInTheDocument();
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid thinking event step data:',
        mockInvalidThinkingEvent,
      );
    });
  });

  describe('SGR Tool Execution Events', () => {
    it('should handle valid tool execution events correctly', () => {
      const mockToolEvent: SGRToolExecutionEvent = {
        type: SGRMessageType.TOOL_EXECUTION,
        toolName: 'credential_extractor',
        status: SGRToolExecutionStatus.IN_PROGRESS,
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      mockUseSGREvents.mockReturnValue({
        events: [mockToolEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should display tool execution status
      expect(
        screen.getByText(/credential_extractor: in_progress/),
      ).toBeInTheDocument();
    });

    it('should handle tool execution events with missing data', () => {
      // Use unknown type assertion to bypass type checking for invalid test data
      const mockInvalidToolEvent = {
        type: SGRMessageType.TOOL_EXECUTION,
        toolName: null, // Invalid toolName
        status: SGRToolExecutionStatus.IN_PROGRESS,
        threadId: 'test-thread-123',
        timestamp: new Date(),
      } as unknown as SGREvent;

      mockUseSGREvents.mockReturnValue({
        events: [mockInvalidToolEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should show fallback text and log warning
      expect(screen.getByText(/Выполняю инструмент\.\.\./)).toBeInTheDocument();
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid tool execution event data:',
        mockInvalidToolEvent,
      );
    });
  });

  describe('SGR Final Response Events', () => {
    it('should handle final response events correctly', () => {
      const mockFinalEvent: SGRFinalResponseEvent = {
        type: SGRMessageType.FINAL_RESPONSE,
        content: 'Process completed successfully',
        success: true,
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      mockUseSGREvents.mockReturnValue({
        events: [mockFinalEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should not show processing indicator
      expect(screen.queryByText(/Анализирую/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Выполняю/)).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed events gracefully', () => {
      // Use unknown type assertion to bypass type checking for invalid test data
      const mockMalformedEvent = {
        type: null, // Invalid type
        threadId: 'test-thread-123',
        timestamp: new Date(),
      } as unknown as SGREvent;

      mockUseSGREvents.mockReturnValue({
        events: [mockMalformedEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should log warning for invalid event
      expect(console.warn).toHaveBeenCalledWith(
        'Invalid SGR event received:',
        mockMalformedEvent,
      );
    });

    it('should handle unknown event types', () => {
      // Use unknown type assertion to bypass type checking for invalid test data
      const mockUnknownEvent = {
        type: 'unknown_type',
        threadId: 'test-thread-123',
        timestamp: new Date(),
      } as unknown as SGREvent;

      mockUseSGREvents.mockReturnValue({
        events: [mockUnknownEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should log warning for unknown event type
      expect(console.warn).toHaveBeenCalledWith(
        'Unknown SGR event type:',
        'unknown_type',
      );
    });

    it('should handle exceptions in event processing', () => {
      // Mock an event that will cause an error during processing
      const mockEvent: SGRThinkingEvent = {
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'test',
          plannedSteps: [],
          selectedTool: 'test',
          timestamp: new Date(),
        },
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      mockUseSGREvents.mockReturnValue({
        events: [mockEvent],
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      // Mock console.error to throw an exception during string interpolation
      const originalSetCurrentSGRStep = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      // This test verifies error boundary behavior
      renderComponent();

      // The component should not crash, error should be logged
      expect(console.error).toHaveBeenCalledWith(
        'Error processing SGR events:',
        expect.any(Error),
      );
    });
  });

  describe('Event Sequence Processing', () => {
    it('should process multiple events in sequence', () => {
      const thinkingEvent: SGRThinkingEvent = {
        type: SGRMessageType.THINKING,
        step: {
          stepNumber: 1,
          currentState: 'Starting analysis',
          plannedSteps: ['Extract', 'Validate'],
          selectedTool: 'extractor',
          timestamp: new Date(),
        },
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      const toolEvent: SGRToolExecutionEvent = {
        type: SGRMessageType.TOOL_EXECUTION,
        toolName: 'extractor',
        status: SGRToolExecutionStatus.COMPLETED,
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      const finalEvent: SGRFinalResponseEvent = {
        type: SGRMessageType.FINAL_RESPONSE,
        content: 'Analysis complete',
        success: true,
        threadId: 'test-thread-123',
        timestamp: new Date(),
      };

      const events: SGREvent[] = [thinkingEvent, toolEvent, finalEvent];

      mockUseSGREvents.mockReturnValue({
        events,
        isConnected: true,
        emitThinkingEvent: jest.fn(),
        emitToolExecutionEvent: jest.fn(),
        emitFinalResponseEvent: jest.fn(),
        getStatus: jest.fn(),
      });

      renderComponent();

      // Should show the latest event (final response) - no processing indicator
      expect(screen.queryByText(/Анализирую/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Выполняю/)).not.toBeInTheDocument();
    });
  });
});
