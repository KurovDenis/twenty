import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';

import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

import { BusinessSetupAgentService } from './business-setup-agent.service';
import { BusinessSetupStatusCacheService } from './business-setup-status-cache.service';
import {
  AdaptiveSupervisorConfigService,
  RequestComplexity,
} from './adaptive-supervisor-config.service';
import { SupervisorErrorRecoveryService } from './supervisor-error-recovery.service';
import { ProviderRegistry } from './provider-registry.service';

export interface ToolCommand {
  tool: string;
  params: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message: string;
  timestamp: Date;
  metadata?: any;
}

export interface SupervisorContext {
  userId: string;
  workspaceId: string;
  threadId?: string;
  complexity: RequestComplexity;
  requestId?: string;
}

export interface RouteToProviderParams {
  providerId: string;
  action: string;
  credentials?: any;
  context?: any;
}

export interface TransitionStatusParams {
  fromStatus: BusinessSetupStatus;
  toStatus: BusinessSetupStatus;
  reason: string;
  data?: any;
}

/**
 * Enhanced Supervisor Tool Dispatcher with centralized routing logic
 * Implements provider-agnostic architecture and advanced error recovery
 */
@Injectable()
export class EnhancedSupervisorToolDispatcher {
  private readonly logger = new Logger(EnhancedSupervisorToolDispatcher.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly statusCache: BusinessSetupStatusCacheService,
    private readonly configService: AdaptiveSupervisorConfigService,
    private readonly errorRecovery: SupervisorErrorRecoveryService,
    private readonly agentChatService: AgentChatService,
    private readonly businessSetupAgentService: BusinessSetupAgentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Main dispatch method with adaptive configuration and error recovery
   */
  async dispatch(
    command: ToolCommand,
    context: SupervisorContext,
  ): Promise<ToolResult> {
    const config = this.configService.getConfigForRequest(context.complexity);

    this.logger.debug(
      `Dispatching tool: ${command.tool} with ${context.complexity} complexity`,
      { maxRetries: config.retryAttempts, timeout: config.timeoutMs },
    );

    return await this.errorRecovery.executeWithRetry(
      () => this.executeCommand(command, context, config),
      { maxRetries: config.retryAttempts, timeoutMs: config.timeoutMs },
    );
  }

  /**
   * Execute command with timeout and proper error handling
   */
  private async executeCommand(
    command: ToolCommand,
    context: SupervisorContext,
    config: any,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      let result: ToolResult;

      switch (command.tool) {
        case 'check_business_setup_status':
          result = await this.checkBusinessSetupStatusWithCache(context);
          break;

        case 'route_to_provider':
          result = await this.routeToProvider(
            command.params as RouteToProviderParams,
            context,
          );
          break;

        case 'transition_status':
          result = await this.transitionStatusWithCache(
            command.params as TransitionStatusParams,
            context,
          );
          break;

        case 'get_provider_info':
          result = await this.getProviderInfo(command.params, context);
          break;

        case 'validate_provider_credentials':
          result = await this.validateProviderCredentials(
            command.params,
            context,
          );
          break;

        case 'list_available_providers':
          result = await this.listAvailableProviders(command.params, context);
          break;

        default:
          throw new Error(`Unknown tool: ${command.tool}`);
      }

      // Add execution metadata
      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - startTime,
        complexity: context.complexity,
        tool: command.tool,
      };

      // Emit success event for monitoring
      this.eventEmitter.emit('supervisor.tool-executed', {
        tool: command.tool,
        success: true,
        executionTime: Date.now() - startTime,
        context,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`Tool execution failed: ${command.tool}`, error.stack);

      // Emit error event for monitoring
      this.eventEmitter.emit('supervisor.tool-error', {
        tool: command.tool,
        error: errorMessage,
        executionTime: Date.now() - startTime,
        context,
      });

      return {
        success: false,
        error: errorMessage,
        message: `Tool ${command.tool} failed: ${errorMessage}`,
        timestamp: new Date(),
        metadata: {
          executionTime: Date.now() - startTime,
          complexity: context.complexity,
          tool: command.tool,
        },
      };
    }
  }

  /**
   * Check business setup status with caching
   */
  private async checkBusinessSetupStatusWithCache(
    context: SupervisorContext,
  ): Promise<ToolResult> {
    // Try cache first
    let status = await this.statusCache.getStatus(
      context.userId,
      context.workspaceId,
    );

    const source = status ? 'cache' : 'database';

    if (!status) {
      // Cache miss - fetch from business service
      // This would integrate with existing business setup service
      status = BusinessSetupStatus.WELCOME; // Placeholder - implement actual lookup

      // Update cache
      await this.statusCache.setStatus(
        context.userId,
        context.workspaceId,
        status,
      );
    }

    return {
      success: true,
      data: { status },
      message: `Business setup status retrieved from ${source}`,
      timestamp: new Date(),
      metadata: { source },
    };
  }

  /**
   * Route to provider using registry
   */
  private async routeToProvider(
    params: RouteToProviderParams,
    context: SupervisorContext,
  ): Promise<ToolResult> {
    const provider = this.providerRegistry.getProvider(params.providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${params.providerId}`);
    }

    this.logger.debug(
      `Routing to provider: ${provider.displayName} (${provider.providerId})`,
    );

    // Execute provider-specific logic
    const setupResult = await provider.setupBusiness({
      userId: context.userId,
      workspaceId: context.workspaceId,
      currentStatus: BusinessSetupStatus.WELCOME, // Get from cache
      providerParams: params,
    });

    // Update status cache if transition occurred
    if (setupResult.success && setupResult.nextStatus) {
      await this.statusCache.invalidateStatus(
        context.userId,
        context.workspaceId,
      );
    }

    return {
      success: setupResult.success,
      data: setupResult.data,
      error: setupResult.error,
      message: setupResult.success
        ? `Successfully routed to ${provider.displayName}`
        : `Failed to route to ${provider.displayName}: ${setupResult.error}`,
      timestamp: new Date(),
      metadata: {
        providerId: params.providerId,
        providerName: provider.displayName,
        nextStatus: setupResult.nextStatus,
      },
    };
  }

  /**
   * Transition status with cache invalidation
   */
  private async transitionStatusWithCache(
    params: TransitionStatusParams,
    context: SupervisorContext,
  ): Promise<ToolResult> {
    try {
      // Update cache with new status
      await this.statusCache.setStatus(
        context.userId,
        context.workspaceId,
        params.toStatus,
      );

      // Emit transition event
      this.eventEmitter.emit('business-setup.status-transitioned', {
        userId: context.userId,
        workspaceId: context.workspaceId,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        reason: params.reason,
        data: params.data,
        timestamp: new Date(),
      });

      this.logger.log(
        `Status transitioned: ${params.fromStatus} -> ${params.toStatus} for user ${context.userId}`,
      );

      return {
        success: true,
        data: {
          fromStatus: params.fromStatus,
          toStatus: params.toStatus,
          reason: params.reason,
        },
        message: `Status transitioned from ${params.fromStatus} to ${params.toStatus}`,
        timestamp: new Date(),
      };
    } catch (error) {
      throw new Error(`Status transition failed: ${error.message}`);
    }
  }

  /**
   * Get provider information
   */
  private async getProviderInfo(
    params: { providerId?: string; status?: BusinessSetupStatus },
    context: SupervisorContext,
  ): Promise<ToolResult> {
    if (params.providerId) {
      const provider = this.providerRegistry.getProvider(params.providerId);

      if (!provider) {
        return {
          success: false,
          error: `Provider not found: ${params.providerId}`,
          message: `Provider ${params.providerId} not found`,
          timestamp: new Date(),
        };
      }

      const health = await provider.getHealthStatus();

      return {
        success: true,
        data: {
          provider: {
            id: provider.providerId,
            name: provider.displayName,
            description: provider.description,
            icon: provider.icon,
            supportedStatuses: provider.supportedStatuses,
            config: provider.getProviderConfig(),
            setupSteps: provider.getSetupSteps(),
            health,
          },
        },
        message: `Provider information retrieved for ${provider.displayName}`,
        timestamp: new Date(),
      };
    }

    if (params.status) {
      const providers = this.providerRegistry.getProvidersForStatus(
        params.status,
      );

      return {
        success: true,
        data: {
          status: params.status,
          availableProviders: providers.map((p) => ({
            id: p.providerId,
            name: p.displayName,
            description: p.description,
            icon: p.icon,
          })),
        },
        message: `Found ${providers.length} providers for status ${params.status}`,
        timestamp: new Date(),
      };
    }

    // Return all providers
    const stats = this.providerRegistry.getRegistryStats();

    return {
      success: true,
      data: stats,
      message: `Registry contains ${stats.totalProviders} providers`,
      timestamp: new Date(),
    };
  }

  /**
   * Validate provider credentials
   */
  private async validateProviderCredentials(
    params: { providerId: string; credentials: any },
    context: SupervisorContext,
  ): Promise<ToolResult> {
    const provider = this.providerRegistry.getProvider(params.providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${params.providerId}`);
    }

    const validation = await provider.validateCredentials(params.credentials);

    return {
      success: validation.isValid,
      data: validation,
      error: validation.error,
      message: validation.isValid
        ? `Credentials validated for ${provider.displayName}`
        : `Credential validation failed for ${provider.displayName}: ${validation.error}`,
      timestamp: new Date(),
      metadata: {
        providerId: params.providerId,
        providerName: provider.displayName,
      },
    };
  }

  /**
   * List available providers for status
   */
  private async listAvailableProviders(
    params: { status?: BusinessSetupStatus },
    context: SupervisorContext,
  ): Promise<ToolResult> {
    const providers = params.status
      ? this.providerRegistry.getProvidersForStatus(params.status)
      : this.providerRegistry.getAllProviders();

    return {
      success: true,
      data: {
        providers: providers.map((p) => ({
          id: p.providerId,
          name: p.displayName,
          description: p.description,
          icon: p.icon,
          supportedStatuses: p.supportedStatuses,
        })),
        total: providers.length,
      },
      message: `Found ${providers.length} available providers`,
      timestamp: new Date(),
    };
  }
}
