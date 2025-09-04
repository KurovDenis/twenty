/**
 * Unit tests for useBusinessSetupAgentChat hook
 *
 * Tests the enhanced functionality for creating SGR Avito agent threads
 * when floating AI chat button is clicked during business setup.
 */

import { renderHook, act } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import { useBusinessSetupAgentChat } from '../useBusinessSetupAgentChat';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { ReactNode } from 'react';

// Mock dependencies
jest.mock('@/ai/hooks/useCreateNewAIChatThread');
jest.mock('@/command-menu/hooks/useOpenAskAIPageInCommandMenu');
jest.mock('./useBusinessSetupStatus');

const mockCreateAgentChatThread = jest.fn();
const mockOpenAskAIPage = jest.fn();
const mockUseBusinessSetupStatus = jest.fn();

// Mock the hooks
beforeEach(() => {
  jest.clearAllMocks();

  require('@/ai/hooks/useCreateNewAIChatThread').useCreateNewAIChatThread =
    jest.fn(() => ({
      createAgentChatThread: mockCreateAgentChatThread,
    }));

  require('@/command-menu/hooks/useOpenAskAIPageInCommandMenu').useOpenAskAIPageInCommandMenu =
    jest.fn(() => ({
      openAskAIPage: mockOpenAskAIPage,
    }));

  require('./useBusinessSetupStatus').useBusinessSetupStatus =
    mockUseBusinessSetupStatus;
});

// Helper wrapper with RecoilRoot and workspace state
const createWrapper = (workspaceState: any = null) => {
  return ({ children }: { children: ReactNode }) => (
    <RecoilRoot
      initializeState={(snapshot) => {
        snapshot.set(currentWorkspaceState, workspaceState);
      }}
    >
      {children}
    </RecoilRoot>
  );
};

describe('useBusinessSetupAgentChat', () => {
  const mockWorkspace = {
    id: 'workspace-123',
    displayName: 'Test Workspace',
    defaultAgent: {
      id: 'agent-456',
    },
  };

  describe('createBusinessSetupChat', () => {
    it('should create specialized agent thread for WELCOME status', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      mockCreateAgentChatThread.mockResolvedValue(undefined);

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
      expect(mockOpenAskAIPage).not.toHaveBeenCalled();
    });

    it('should create specialized agent thread for BUSINESS_ANALYSIS status', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');
      mockCreateAgentChatThread.mockResolvedValue(undefined);

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
      expect(mockOpenAskAIPage).not.toHaveBeenCalled();
    });

    it('should fallback to standard AI page if agent thread creation fails', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      const createError = new Error('Failed to create agent thread');
      mockCreateAgentChatThread.mockRejectedValue(createError);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
      expect(mockOpenAskAIPage).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create business setup chat thread:',
        createError,
      );

      consoleSpy.mockRestore();
    });

    it('should handle null business setup status', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue(null);
      mockCreateAgentChatThread.mockResolvedValue(undefined);

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
    });

    it('should handle workspace without default agent', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      mockCreateAgentChatThread.mockResolvedValue(undefined);

      const workspaceWithoutAgent = {
        id: 'workspace-123',
        displayName: 'Test Workspace',
        defaultAgent: null,
      };

      const wrapper = createWrapper(workspaceWithoutAgent);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
      // Should use fallback agent ID
    });

    it('should handle null workspace', async () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');
      mockCreateAgentChatThread.mockResolvedValue(undefined);

      const wrapper = createWrapper(null);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      await act(async () => {
        await result.current.createBusinessSetupChat();
      });

      // Assert
      expect(mockCreateAgentChatThread).toHaveBeenCalledTimes(1);
      // Should use fallback agent ID
    });
  });

  describe('getWelcomeMessageForStep', () => {
    it('should return correct message for WELCOME step', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      const message = result.current.getWelcomeMessageForStep('WELCOME');

      // Assert
      expect(message).toContain('Avito');
      expect(message).toContain('CLIENT_ID');
      expect(message).toContain('CLIENT_SECRET');
    });

    it('should return correct message for BUSINESS_ANALYSIS step', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('BUSINESS_ANALYSIS');

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      const message =
        result.current.getWelcomeMessageForStep('BUSINESS_ANALYSIS');

      // Assert
      expect(message).toContain('analyze your business');
    });

    it('should return default message for unknown step', () => {
      // Arrange
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');

      const wrapper = createWrapper(mockWorkspace);
      const { result } = renderHook(() => useBusinessSetupAgentChat(), {
        wrapper,
      });

      // Act
      const message = result.current.getWelcomeMessageForStep(
        'UNKNOWN_STEP' as any,
      );

      // Assert
      expect(message).toContain('Avito'); // Should return WELCOME message as default
    });
  });

  describe('integration with useCreateNewAIChatThread', () => {
    it('should pass correct parameters to useCreateNewAIChatThread', () => {
      // Arrange
      const mockUseCreateNewAIChatThread =
        require('@/ai/hooks/useCreateNewAIChatThread').useCreateNewAIChatThread;
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');

      const wrapper = createWrapper(mockWorkspace);
      renderHook(() => useBusinessSetupAgentChat(), { wrapper });

      // Assert
      expect(mockUseCreateNewAIChatThread).toHaveBeenCalledWith({
        agentId: 'agent-456',
        businessSetupStep: 'WELCOME',
      });
    });

    it('should pass fallback agent ID when workspace has no default agent', () => {
      // Arrange
      const mockUseCreateNewAIChatThread =
        require('@/ai/hooks/useCreateNewAIChatThread').useCreateNewAIChatThread;
      mockUseBusinessSetupStatus.mockReturnValue('WELCOME');

      const workspaceWithoutAgent = {
        id: 'workspace-123',
        defaultAgent: null,
      };

      const wrapper = createWrapper(workspaceWithoutAgent);
      renderHook(() => useBusinessSetupAgentChat(), { wrapper });

      // Assert
      expect(mockUseCreateNewAIChatThread).toHaveBeenCalledWith({
        agentId: 'fallback-agent',
        businessSetupStep: 'WELCOME',
      });
    });
  });
});
