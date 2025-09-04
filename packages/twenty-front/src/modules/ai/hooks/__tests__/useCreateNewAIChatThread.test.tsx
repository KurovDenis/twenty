/**
 * Unit tests for useCreateNewAIChatThread hook
 *
 * Tests the enhanced functionality for passing businessSetupStep parameter
 * to create specialized business setup agents.
 */

import { renderHook, act } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { useCreateNewAIChatThread } from '../useCreateNewAIChatThread';
import { ReactNode } from 'react';

// Mock dependencies
jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu');
jest.mock('@/business-setup/hooks/useBusinessSetupStatus');
jest.mock('~/generated-metadata/graphql');

const mockOpenAskAIPage = jest.fn();
const mockUseBusinessSetupStatus = jest.fn();
const mockCreateAgentChatThreadMutation = jest.fn();

// Mock the hooks and mutations
beforeEach(() => {
  jest.clearAllMocks();

  require('@/command-menu/hooks/useOpenAskAIPageInCommandMenu').useOpenAskAIPageInCommandMenu =
    jest.fn(() => ({
      openAskAIPage: mockOpenAskAIPage,
    }));

  require('@/business-setup/hooks/useBusinessSetupStatus').useBusinessSetupStatus =
    mockUseBusinessSetupStatus;

  require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation =
    jest.fn(() => [
      mockCreateAgentChatThreadMutation,
      { loading: false, error: null },
    ]);
});

// Helper wrapper with RecoilRoot
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => (
    <RecoilRoot>{children}</RecoilRoot>
  );
};

describe('useCreateNewAIChatThread', () => {
  const testAgentId = 'test-agent-123';
  const testThreadId = 'thread-456';

  describe('basic functionality', () => {
    it('should initialize with correct mutation variables for standard usage', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue(null);
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(() => useCreateNewAIChatThread({ agentId: testAgentId }), {
        wrapper,
      });

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            // No businessSetupStep should be included
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should include businessSetupStep when provided explicitly', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(
        () =>
          useCreateNewAIChatThread({
            agentId: testAgentId,
            businessSetupStep: 'WELCOME',
          }),
        { wrapper },
      );

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            businessSetupStep: 'WELCOME',
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should use current business setup status when no explicit step provided', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(() => useCreateNewAIChatThread({ agentId: testAgentId }), {
        wrapper,
      });

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            businessSetupStep: 'BUSINESS_ANALYSIS',
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should exclude businessSetupStep when status is COMPLETED', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('COMPLETED');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(() => useCreateNewAIChatThread({ agentId: testAgentId }), {
        wrapper,
      });

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            // businessSetupStep should not be included when COMPLETED
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('mutation callbacks', () => {
    it('should handle successful thread creation', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCreateNewAIChatThread({ agentId: testAgentId }),
        { wrapper },
      );

      // Get the onCompleted callback
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;
      const onCompleted = mockMutation.mock.calls[0][0].onCompleted;

      // Act
      await act(async () => {
        onCompleted({
          createAgentChatThread: {
            id: testThreadId,
            agentId: 'specialized-agent-789',
          },
        });
      });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Created new chat thread:',
        testThreadId,
        'with agent:',
        'specialized-agent-789',
      );
      expect(mockOpenAskAIPage).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should handle thread creation errors', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('GraphQL mutation failed');

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCreateNewAIChatThread({ agentId: testAgentId }),
        { wrapper },
      );

      // Get the onError callback
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;
      const onError = mockMutation.mock.calls[0][0].onError;

      // Act
      await act(async () => {
        onError(testError);
      });

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create agent chat thread:',
        testError,
      );

      consoleSpy.mockRestore();
    });
  });

  describe('businessSetupStep precedence', () => {
    it('should prioritize explicit businessSetupStep over current status', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(
        () =>
          useCreateNewAIChatThread({
            agentId: testAgentId,
            businessSetupStep: 'WELCOME',
          }),
        { wrapper },
      );

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            businessSetupStep: 'WELCOME', // Should use explicit value, not current status
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should handle undefined explicit businessSetupStep', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(
        () =>
          useCreateNewAIChatThread({
            agentId: testAgentId,
            businessSetupStep: undefined,
          }),
        { wrapper },
      );

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            businessSetupStep: 'WELCOME', // Should fallback to current status
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null current business setup status', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue(null);
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(() => useCreateNewAIChatThread({ agentId: testAgentId }), {
        wrapper,
      });

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: testAgentId,
            // No businessSetupStep should be included
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should handle empty string agentId', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      const mockMutation =
        require('~/generated-metadata/graphql').useCreateAgentChatThreadMutation;

      const wrapper = createWrapper();

      // Act
      renderHook(() => useCreateNewAIChatThread({ agentId: '' }), { wrapper });

      // Assert
      expect(mockMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            agentId: '',
            businessSetupStep: 'WELCOME',
          },
        },
        onCompleted: expect.any(Function),
        onError: expect.any(Function),
      });
    });
  });

  describe('return value', () => {
    it('should return createAgentChatThread function', () => {
      // Arrange
      const wrapper = createWrapper();

      // Act
      const { result } = renderHook(
        () => useCreateNewAIChatThread({ agentId: testAgentId }),
        { wrapper },
      );

      // Assert
      expect(result.current).toHaveProperty('createAgentChatThread');
      expect(typeof result.current.createAgentChatThread).toBe('function');
    });

    it('should allow calling createAgentChatThread function', async () => {
      // Arrange
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCreateNewAIChatThread({ agentId: testAgentId }),
        { wrapper },
      );

      // Act & Assert (should not throw)
      await act(async () => {
        await result.current.createAgentChatThread();
      });

      expect(mockCreateAgentChatThreadMutation).toHaveBeenCalledTimes(1);
    });
  });
});
