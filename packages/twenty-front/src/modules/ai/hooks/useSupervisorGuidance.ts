import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { SupervisorUIAdapter, UIGuidance } from '../services/SupervisorUIAdapter';
import { useErrorRecovery } from './useErrorRecovery';

// Singleton instance of the adapter
const supervisorUIAdapter = new SupervisorUIAdapter();

/**
 * Hook for getting UI guidance from Supervisor Agent
 * Replaces direct business status checking with centralized routing
 */
export const useSupervisorGuidance = () => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspace = useRecoilValue(currentWorkspaceState);
  const [guidance, setGuidance] = useState<UIGuidance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { executeWithRetry } = useErrorRecovery();

  const userId = currentUser?.id;
  const workspaceId = currentWorkspace?.id;

  /**
   * Refresh guidance from Supervisor Agent
   * This replaces any direct status checking logic
   */
  const refreshGuidance = useCallback(async () => {
    if (!userId || !workspaceId) {
      setGuidance(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await executeWithRetry(
        () => supervisorUIAdapter.getUIGuidance(userId, workspaceId),
        3 // max retries
      );
      setGuidance(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to get UI guidance:', err);
      
      // Set fallback guidance on error
      setGuidance({
        buttonText: 'AI Assistant',
        buttonIcon: 'IconSparkles',
        buttonVariant: 'secondary',
        tooltipText: 'Ask AI (Press @)',
        requiresUserAction: false,
        actionType: 'standard',
        isVisible: true,
        loadingText: 'Loading...',
        fallbackAction: 'general_ai_chat'
      });
    } finally {
      setIsLoading(false);
    }
  }, [userId, workspaceId, executeWithRetry]);

  /**
   * Execute user action through Supervisor Agent
   */
  const executeAction = useCallback(async (actionType: string, context?: any) => {
    if (!userId || !workspaceId) {
      throw new Error('User or workspace not available');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await executeWithRetry(
        () => supervisorUIAdapter.executeUserAction(userId, workspaceId, actionType, context),
        3
      );

      if (response.success) {
        // Refresh guidance after successful action
        await refreshGuidance();
        return response;
      } else {
        throw new Error(response.error || 'Action failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [userId, workspaceId, executeWithRetry, refreshGuidance]);

  /**
   * Invalidate cache and refresh guidance
   */
  const invalidateAndRefresh = useCallback(async () => {
    if (userId && workspaceId) {
      supervisorUIAdapter.invalidateCache(userId, workspaceId);
      await refreshGuidance();
    }
  }, [userId, workspaceId, refreshGuidance]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh guidance when user/workspace changes
  useEffect(() => {
    refreshGuidance();
  }, [refreshGuidance]);

  return {
    guidance,
    isLoading,
    error,
    refreshGuidance,
    executeAction,
    invalidateAndRefresh,
    clearError,
    isVisible: guidance?.isVisible ?? false,
    // Expose cache metrics for debugging
    getCacheMetrics: () => supervisorUIAdapter.getCacheMetrics(),
  };
};

/**
 * Legacy compatibility hook that returns guidance properties
 * This helps migrate existing components gradually
 */
export const useSupervisorGuidanceCompat = () => {
  const { guidance, isLoading, error, executeAction } = useSupervisorGuidance();

  return {
    // Direct properties for backward compatibility
    buttonText: guidance?.buttonText || 'AI Assistant',
    buttonIcon: guidance?.buttonIcon || 'IconSparkles',
    buttonVariant: guidance?.buttonVariant || 'secondary',
    tooltipText: guidance?.tooltipText || 'Ask AI (Press @)',
    requiresUserAction: guidance?.requiresUserAction || false,
    
    // Provider info (replaces hard-coded Avito logic)
    providerName: guidance?.providerInfo?.name,
    providerDisplayName: guidance?.providerInfo?.displayName,
    
    // State
    isLoading,
    error,
    
    // Actions
    executeAction,
  };
};