import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { BusinessSetupStatus } from '@/business-setup/hooks/useSetNextBusinessSetupStatus';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export interface UIGuidance {
  buttonText: string;
  buttonIcon: string;
  buttonVariant: 'primary' | 'secondary' | 'tertiary';
  tooltipText: string;
  requiresUserAction: boolean;
  actionType: 'setup' | 'continue' | 'complete' | 'standard';
  isVisible: boolean;
  loadingText?: string;
  fallbackAction?: string;
  providerInfo?: {
    name: string;
    displayName: string;
    status: string;
  };
}

export interface CachedGuidance {
  guidance: UIGuidance;
  timestamp: number;
}

export interface SupervisorRequest {
  userId: string;
  workspaceId: string;
  requestType: 'ui_guidance' | 'action_execution';
  context?: any;
}

export interface SupervisorResponse {
  guidance: UIGuidance;
  success: boolean;
  message?: string;
  error?: string;
  redirectTo?: string;
}

/**
 * Service that adapts Supervisor Agent decisions for UI consumption
 * Implements caching and error recovery for UI guidance requests
 */
export class SupervisorUIAdapter {
  private cache = new Map<string, CachedGuidance>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_RETRIES = 3;

  /**
   * Get UI guidance by delegating to Supervisor Agent
   * Implements caching to reduce backend requests
   */
  async getUIGuidance(
    userId: string,
    workspaceId: string,
  ): Promise<UIGuidance> {
    const cacheKey = `${userId}:${workspaceId}`;
    const cached = this.cache.get(cacheKey);

    // Return cached guidance if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.guidance;
    }

    try {
      // Always delegate to Supervisor Agent - no direct status checking
      const response = await this.requestSupervisorGuidance({
        userId,
        workspaceId,
        requestType: 'ui_guidance',
      });

      if (response.success && response.guidance) {
        // Cache the guidance
        this.cache.set(cacheKey, {
          guidance: response.guidance,
          timestamp: Date.now(),
        });

        return response.guidance;
      }

      // Fallback to default guidance if supervisor fails
      return this.getDefaultGuidance();
    } catch (error) {
      console.error('Failed to get UI guidance from Supervisor:', error);
      return this.getDefaultGuidance();
    }
  }

  /**
   * Execute user action through Supervisor Agent
   */
  async executeUserAction(
    userId: string,
    workspaceId: string,
    actionType: string,
    context?: any,
  ): Promise<SupervisorResponse> {
    try {
      const response = await this.requestSupervisorAction({
        userId,
        workspaceId,
        actionType,
        context,
      });

      // Invalidate cache after successful action
      if (response.success) {
        const cacheKey = `${userId}:${workspaceId}`;
        this.cache.delete(cacheKey);
      }

      return response;
    } catch (error) {
      console.error('Failed to execute action through Supervisor:', error);
      return {
        guidance: this.getDefaultGuidance(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Invalidate cache for specific user/workspace
   */
  invalidateCache(userId: string, workspaceId: string): void {
    const cacheKey = `${userId}:${workspaceId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached guidance
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache metrics for monitoring
   */
  getCacheMetrics(): {
    size: number;
    hitRate: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, cached]) => ({
      key,
      age: now - cached.timestamp,
    }));

    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses to calculate
      entries,
    };
  }

  /**
   * Request guidance from Supervisor Agent backend
   * This is where UI delegates all business logic decisions
   */
  private async requestSupervisorGuidance(
    request: SupervisorRequest,
  ): Promise<SupervisorResponse> {
    const tokenPair = getTokenPair();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token is available
    if (tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      headers['Authorization'] = `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`;
    }

    const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/api/supervisor/ui-guidance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        `Supervisor request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data;
  }

  /**
   * Request action execution from Supervisor Agent backend
   * This is where UI delegates action execution decisions
   */
  private async requestSupervisorAction(
    request: {
      userId: string;
      workspaceId: string;
      actionType: string;
      context?: any;
    },
  ): Promise<SupervisorResponse> {
    console.log('SupervisorUIAdapter: Executing action:', request);
    
    const tokenPair = getTokenPair();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authorization header if token is available
    if (tokenPair?.accessOrWorkspaceAgnosticToken?.token) {
      headers['Authorization'] = `Bearer ${tokenPair.accessOrWorkspaceAgnosticToken.token}`;
    }

    const url = `${REACT_APP_SERVER_BASE_URL}/api/supervisor/execute-action`;
    console.log('SupervisorUIAdapter: Making request to:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    console.log('SupervisorUIAdapter: Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SupervisorUIAdapter: Response error:', errorText);
      throw new Error(
        `Supervisor action execution failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log('SupervisorUIAdapter: Response data:', data);
    return data;
  }

  /**
   * Fallback guidance when Supervisor is unavailable
   * This should be minimal and safe
   */
  private getDefaultGuidance(): UIGuidance {
    return {
      buttonText: 'AI Assistant',
      buttonIcon: 'IconSparkles',
      buttonVariant: 'secondary',
      tooltipText: 'Ask AI (Press @)',
      requiresUserAction: false,
      actionType: 'standard',
      isVisible: true,
      loadingText: 'Loading...',
      fallbackAction: 'general_ai_chat',
    };
  }

  /**
   * Get provider-agnostic guidance based on Supervisor decision
   * This replaces hard-coded Avito logic
   */
  private adaptProviderGuidance(
    status: BusinessSetupStatus,
    providerInfo: any,
  ): UIGuidance {
    // Supervisor determines the provider and status, UI just displays it
    switch (status) {
      case 'WELCOME':
        return {
          buttonText: 'Setup Required',
          buttonIcon: 'IconSettings',
          buttonVariant: 'primary',
          tooltipText: `Business setup required - ${providerInfo?.displayName || 'Provider'} integration`,
          requiresUserAction: true,
          actionType: 'setup',
          isVisible: true,
          loadingText: 'Setting up integration...',
          fallbackAction: 'business_setup',
          providerInfo,
        };

      case 'BUSINESS_ANALYSIS':
        return {
          buttonText: 'Analyze Business',
          buttonIcon: 'IconChart',
          buttonVariant: 'secondary',
          tooltipText: 'Continue business analysis',
          requiresUserAction: true,
          actionType: 'continue',
          isVisible: true,
          loadingText: 'Analyzing business...',
          fallbackAction: 'business_setup',
          providerInfo,
        };

      case 'COMPLETED':
        return {
          buttonText: 'AI Assistant',
          buttonIcon: 'IconSparkles',
          buttonVariant: 'secondary',
          tooltipText: 'Ask AI (Press @)',
          requiresUserAction: false,
          actionType: 'standard',
          isVisible: true,
          loadingText: 'Loading AI...',
          fallbackAction: 'general_ai_chat',
        };

      default:
        return this.getDefaultGuidance();
    }
  }
}
