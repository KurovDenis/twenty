import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';

import { Observable } from 'rxjs';

import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import {
  AdaptiveSupervisorConfigService,
  RequestComplexity,
} from 'src/engine/core-modules/business-setup/services/adaptive-supervisor-config.service';
import { BusinessSetupStatusCacheService } from 'src/engine/core-modules/business-setup/services/business-setup-status-cache.service';
import { EnhancedSupervisorToolDispatcher } from 'src/engine/core-modules/business-setup/services/enhanced-supervisor-tool-dispatcher.service';
import { ProviderRegistry } from 'src/engine/core-modules/business-setup/services/provider-registry.service';
import {
  MessageEvent,
  StreamingProgressService,
} from 'src/engine/core-modules/business-setup/services/streaming-progress.service';
import { SupervisorAnalyticsService } from 'src/engine/core-modules/business-setup/services/supervisor-analytics.service';

export interface SupervisorUIGuidanceRequest {
  userId: string;
  workspaceId: string;
  requestType: 'ui_guidance' | 'action_execution';
  context?: {
    currentPage?: string;
    userAction?: string;
    timestamp?: string;
    metadata?: any;
  };
}

export interface SupervisorActionRequest {
  userId: string;
  workspaceId: string;
  actionType: string;
  context?: {
    actionType?: string;
    providerInfo?: any;
    timestamp?: string;
    metadata?: any;
  };
}

export interface UIGuidance {
  buttonText: string;
  buttonIcon: string;
  tooltipText: string;
  isEnabled: boolean;
  actionType: string;
  buttonVariant?: 'primary' | 'secondary';
  requiresUserAction?: boolean;
  loadingText?: string;
  isVisible?: boolean;
  fallbackAction?: string;
  providerInfo?: {
    providerId: string;
    displayName: string;
    capabilities: string[];
  };
}

export interface SupervisorUIGuidanceResponse {
  guidance: UIGuidance;
  success: boolean;
  message?: string;
  error?: string;
  isVisible: boolean;
  metadata?: {
    requestComplexity: RequestComplexity;
    executionTime: number;
    cacheHit: boolean;
    providerUsed?: string;
  };
}

export interface SupervisorActionResponse {
  success: boolean;
  message: string;
  operationId?: string;
  error?: string;
  redirectTo?: string;
  metadata?: {
    actionType: string;
    providerUsed?: string;
    executionTime: number;
    requiresFollowup?: boolean;
  };
}

/**
 * Controller for Supervisor Agent UI guidance and routing
 * Implements centralized routing that replaces direct UI status checking
 */
@Controller('supervisor')
@UseGuards(UserAuthGuard, WorkspaceAuthGuard)
export class SupervisorController {
  constructor(
    private readonly statusCache: BusinessSetupStatusCacheService,
    private readonly configService: AdaptiveSupervisorConfigService,
    private readonly toolDispatcher: EnhancedSupervisorToolDispatcher,
    private readonly providerRegistry: ProviderRegistry,
    private readonly streamingProgress: StreamingProgressService,
    private readonly analyticsService: SupervisorAnalyticsService,
  ) {}

  /**
   * Get UI guidance for components - replaces direct status checking
   */
  @Post('ui-guidance')
  async getUIGuidance(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() request: Partial<SupervisorUIGuidanceRequest>,
  ): Promise<SupervisorUIGuidanceResponse> {
    const startTime = Date.now();
    const fullRequest = {
      userId: user.id,
      workspaceId: workspace.id,
      requestType: 'ui_guidance' as const,
      ...request,
    };

    try {
      // Get business setup status from cache
      const status = await this.statusCache.getStatus(user.id, workspace.id);
      const isCacheHit = this.statusCache.isCacheHit;

      if (!status) {
        throw new Error('Business setup status not found');
      }

      // Get adaptive configuration
      const complexity = this.configService.analyzeComplexity({
        businessStatus: status,
        context: fullRequest.context,
      });
      const config = this.configService.getConfigForRequest(complexity);

      // Find appropriate provider
      const provider = this.providerRegistry.findProvider(status);

      // Generate UI guidance
      const guidance: UIGuidance = await this.generateUIGuidance(
        status,
        provider,
        fullRequest.context,
      );

      // Determine visibility
      const isVisible = this.shouldShowButton(
        status,
        provider,
        fullRequest.context,
      );

      const executionTime = Date.now() - startTime;

      // Track analytics
      this.analyticsService.trackUIGuidanceRequest({
        userId: user.id,
        workspaceId: workspace.id,
        businessStatus: status,
        complexity,
        executionTime,
        cacheHit: isCacheHit,
        providerUsed: provider?.providerId,
      });

      return {
        guidance,
        success: true,
        isVisible,
        message: 'UI guidance generated successfully',
        metadata: {
          requestComplexity: complexity,
          executionTime,
          cacheHit: isCacheHit,
          providerUsed: provider?.providerId,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Track error analytics
      this.analyticsService.trackError({
        userId: user.id,
        workspaceId: workspace.id,
        operation: 'ui_guidance',
        error: error.message,
        executionTime,
      });

      return {
        guidance: this.getDefaultGuidance(),
        success: false,
        isVisible: true, // Fallback to visible
        error: `Failed to generate UI guidance: ${error.message}`,
        metadata: {
          requestComplexity: RequestComplexity.SIMPLE,
          executionTime,
          cacheHit: false,
        },
      };
    }
  }

  /**
   * Execute user actions through Supervisor routing
   */
  @Post('execute-action')
  async executeAction(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() request: SupervisorActionRequest,
  ): Promise<SupervisorActionResponse> {
    const startTime = Date.now();
    const operationId = `action_${user.id}_${Date.now()}`;

    try {
      // Start progress tracking
      this.streamingProgress.startOperation(
        operationId,
        `Executing ${request.actionType} action`,
        5,
      );

      // Get business setup status
      const status = await this.statusCache.getStatus(user.id, workspace.id);

      if (!status) {
        throw new Error('Business setup status not found');
      }

      this.streamingProgress.updateProgress(
        operationId,
        'Analyzing Request',
        20,
        'Determining best provider for action',
      );

      // Find appropriate provider
      const provider = this.providerRegistry.findProvider(status);

      if (!provider) {
        throw new Error(
          `No provider found for action ${request.actionType} with status ${status}`,
        );
      }

      this.streamingProgress.updateProgress(
        operationId,
        'Executing Action',
        60,
        `Using ${provider.displayName} provider`,
      );

      // Execute action through provider
      const result = await provider.processRequest({
        action: request.actionType,
        userId: user.id,
        workspaceId: workspace.id,
        context: request.context,
      });

      this.streamingProgress.updateProgress(
        operationId,
        'Finalizing',
        90,
        'Processing action results',
      );

      // Invalidate cache if action might change status
      if (this.isStatusChangingAction(request.actionType)) {
        await this.statusCache.invalidateCache(user.id, workspace.id);
      }

      this.streamingProgress.completeOperation(
        operationId,
        'Action completed successfully',
      );

      const executionTime = Date.now() - startTime;

      // Track analytics
      this.analyticsService.trackActionExecution({
        userId: user.id,
        workspaceId: workspace.id,
        actionType: request.actionType,
        providerUsed: provider.providerId,
        executionTime,
        success: true,
      });

      return {
        success: true,
        message: result.message || 'Action executed successfully',
        operationId,
        redirectTo: result.redirectTo,
        metadata: {
          actionType: request.actionType,
          providerUsed: provider.providerId,
          executionTime,
          requiresFollowup: result.requiresFollowup,
        },
      };
    } catch (error) {
      this.streamingProgress.failOperation(
        operationId,
        `Action failed: ${error.message}`,
      );

      const executionTime = Date.now() - startTime;

      // Track error analytics
      this.analyticsService.trackError({
        userId: user.id,
        workspaceId: workspace.id,
        operation: 'action_execution',
        actionType: request.actionType,
        error: error.message,
        executionTime,
      });

      return {
        success: false,
        message: `Failed to execute action: ${error.message}`,
        operationId,
        error: error.message,
        metadata: {
          actionType: request.actionType,
          executionTime,
        },
      };
    }
  }

  /**
   * Stream real-time progress updates for operations
   */
  @Get('progress/:operationId')
  @Sse()
  streamProgress(
    @Param('operationId') operationId: string,
    @AuthUser() user: User,
  ): Observable<MessageEvent> {
    return this.streamingProgress.createProgressStream(operationId);
  }

  /**
   * Get Supervisor analytics and metrics
   */
  @Get('metrics')
  async getMetrics(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Query('timeRange') timeRange?: string,
  ) {
    return this.analyticsService.getMetrics({
      userId: user.id,
      workspaceId: workspace.id,
      timeRange: timeRange || '24h',
    });
  }

  /**
   * Get current business setup status (cached)
   */
  @Get('status')
  async getStatus(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.statusCache.getStatus(user.id, workspace.id);
  }

  /**
   * Invalidate status cache manually
   */
  @Post('invalidate-cache')
  async invalidateCache(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.statusCache.invalidateCache(user.id, workspace.id);

    return { success: true, message: 'Cache invalidated successfully' };
  }

  /**
   * Generate UI guidance based on business status and provider
   */
  private async generateUIGuidance(
    businessStatus: string,
    provider: any,
    context?: any,
  ): Promise<UIGuidance> {
    if (!provider) {
      return this.getDefaultGuidance();
    }

    // Get provider-specific UI guidance
    const providerGuidance = await provider.getUIGuidance(businessStatus);

    return {
      buttonText: providerGuidance.buttonText || 'AI Assistant',
      buttonIcon: providerGuidance.buttonIcon || 'IconSparkles',
      tooltipText: providerGuidance.tooltipText || 'Ask AI (Press @)',
      isEnabled: providerGuidance.isEnabled !== false,
      actionType: providerGuidance.nextAction || 'standard',
      buttonVariant: providerGuidance.buttonVariant || 'secondary',
      requiresUserAction: providerGuidance.requiresUserAction || false,
      isVisible: true,
      loadingText: providerGuidance.loadingText,
      providerInfo: {
        providerId: provider.providerId,
        displayName: provider.displayName,
        capabilities: provider.supportedCapabilities,
      },
      fallbackAction: providerGuidance.fallbackAction,
    };
  }

  /**
   * Determine if button should be visible
   */
  private shouldShowButton(
    businessStatus: string,
    provider: any,
    context?: any,
  ): boolean {
    // Always show button unless explicitly disabled
    if (provider?.uiGuidance?.forceHidden) {
      return false;
    }

    // Show button for all business setup stages
    return true;
  }

  /**
   * Get default guidance when no provider is available
   */
  private getDefaultGuidance(): UIGuidance {
    return {
      buttonText: 'AI Assistant',
      buttonIcon: 'IconSparkles',
      tooltipText: 'Ask AI (Press @)',
      isEnabled: true,
      actionType: 'standard',
      buttonVariant: 'secondary',
      requiresUserAction: false,
      isVisible: true,
      fallbackAction: 'general_ai_chat',
    };
  }

  /**
   * Check if action might change business setup status
   */
  private isStatusChangingAction(actionType: string): boolean {
    const statusChangingActions = [
      'chat_button_clicked',
      'setup_completed',
      'provider_configured',
      'integration_finished',
    ];

    return statusChangingActions.includes(actionType);
  }
}
