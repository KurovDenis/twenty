import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

import { AiModule } from 'src/engine/core-modules/ai/ai.module';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { AgentModule } from 'src/engine/metadata-modules/agent/agent.module';
import { SubscriptionsModule } from 'src/engine/subscriptions/subscriptions.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';

import { TokenModule } from '../auth/token/token.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UserVarsModule } from '../user/user-vars/user-vars.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { UserWorkspaceModule } from '../user-workspace/user-workspace.module';

import { BusinessSetupSubscriptionsResolver } from './business-setup-subscriptions.resolver';
import { BusinessSetupResolver } from './business-setup.resolver';
import { BusinessSetupService } from './business-setup.service';

import { BusinessSetupTransitionService } from './chat-continuation/business-setup-transition.service';
import { BusinessSetupChatResolver } from './resolvers/business-setup-chat.resolver';
import { BusinessSetupAgentService } from './services/business-setup-agent.service';
import { BusinessSetupWelcomeAgentService } from './services/business-setup-welcome-agent.service';
import { EventEmitterBridgeService } from './services/event-emitter-bridge.service';

// Critical Architecture Fixes - New Services
import { SupervisorController } from './controllers/supervisor.controller';
import { AvitoBusinessSetupProvider } from './providers/avito-provider.service';
import { AdaptiveSupervisorConfigService } from './services/adaptive-supervisor-config.service';
import { BusinessSetupStatusCacheService } from './services/business-setup-status-cache.service';
import { EnhancedSupervisorToolDispatcher } from './services/enhanced-supervisor-tool-dispatcher.service';
import { ProviderRegistry } from './services/provider-registry.service';
import { StreamingProgressService } from './services/streaming-progress.service';
import { SupervisorAnalyticsService } from './services/supervisor-analytics.service';
import { SupervisorErrorRecoveryService } from './services/supervisor-error-recovery.service';

// SGR (Schema-Guided Reasoning) services
import { AvitoWelcomeSGRService } from './sgr/services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from './sgr/services/avito-welcome-tool-dispatcher.service';
import { SupervisorSGRService } from './sgr/services/supervisor-sgr.service';
import { SupervisorToolDispatcherService } from './sgr/services/supervisor-tool-dispatcher.service';
// Monitoring services - TEMPORARILY DISABLED due to module resolution issues
// import { SGRModuleHealthIndicator } from './sgr/monitoring/sgr-module-health.indicator';
// import { SGRHealthController } from './sgr/monitoring/sgr-health.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity], 'core'),
    UserVarsModule,
    UserWorkspaceModule,
    OnboardingModule,
    TokenModule,
    WorkspaceCacheStorageModule,
    SubscriptionsModule, // Add for GraphQL subscriptions
    AiModule, // Add for AI model registry and SGR support
    AgentModule, // Добавляем для использования AgentChatService
    forwardRef(() => UserModule), // Fix circular dependency with forwardRef
    WorkspaceModule, // Добавляем для использования WorkspaceService
    TerminusModule, // Add for health checks and monitoring
    EventEmitterModule, // Add for event handling in new services
    HttpModule, // Add for HttpService dependency in AvitoBusinessSetupProvider
  ],
  providers: [
    // Core services (existing)
    BusinessSetupService,
    BusinessSetupResolver,
    BusinessSetupSubscriptionsResolver, // Add GraphQL subscriptions resolver
    BusinessSetupWelcomeAgentService, // Добавляем новый сервис
    BusinessSetupAgentService, // Add new agent service
    BusinessSetupTransitionService, // Добавляем сервис переходов
    BusinessSetupChatResolver, // Добавляем новый resolver
    EventEmitterBridgeService, // Add event bridge service

    // Critical Architecture Fixes - Core Foundation Services (register first)
    BusinessSetupStatusCacheService, // Status caching with 5-min TTL
    AdaptiveSupervisorConfigService, // Adaptive configuration management
    SupervisorErrorRecoveryService, // Error recovery with circuit breaker
    StreamingProgressService, // Real-time progress streaming
    SupervisorAnalyticsService, // Performance tracking and metrics

    // Provider System (register after foundation)
    ProviderRegistry, // Modular provider architecture
    AvitoBusinessSetupProvider, // Avito-specific provider implementation

    // Enhanced Supervisor Services (register after providers)
    EnhancedSupervisorToolDispatcher, // Enhanced routing with provider support

    // SGR (Schema-Guided Reasoning) services with dependency resolution
    SupervisorToolDispatcherService, // Register tool dispatcher first
    SupervisorSGRService, // Register supervisor service second
    AvitoWelcomeSGRService, // SGR service for Avito integration
    AvitoWelcomeToolDispatcherService, // Tool dispatcher for Avito

    // Monitoring and health check services - TEMPORARILY DISABLED
    // SGRModuleHealthIndicator, // Health indicator for SGR module

    HttpTool, // Add HTTP tool for Avito API validation
  ],
  controllers: [
    SupervisorController, // New Supervisor API endpoints
    // Health check controller - TEMPORARILY DISABLED
    // SGRHealthController, // Controller for health check endpoints
  ],
  exports: [
    // Core services (existing exports)
    BusinessSetupService,
    BusinessSetupWelcomeAgentService,
    BusinessSetupAgentService, // Export new agent service
    BusinessSetupTransitionService,
    EventEmitterBridgeService, // Export event bridge service

    // Critical Architecture Fixes - Export for external use
    BusinessSetupStatusCacheService, // Cache service for other modules
    AdaptiveSupervisorConfigService, // Configuration service
    ProviderRegistry, // Provider registry for extensibility
    AvitoBusinessSetupProvider, // Avito provider
    EnhancedSupervisorToolDispatcher, // Enhanced dispatcher
    SupervisorErrorRecoveryService, // Error recovery service
    StreamingProgressService, // Progress service
    SupervisorAnalyticsService, // Analytics service

    // SGR services for external use
    SupervisorSGRService,
    SupervisorToolDispatcherService,
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,

    // Monitoring services for external use - TEMPORARILY DISABLED
    // SGRModuleHealthIndicator, // Export health indicator

    HttpTool, // Export HTTP tool for external use
  ],
})
export class BusinessSetupModule {
  constructor(private readonly providerRegistry: ProviderRegistry) {
    // Register providers on module initialization
    this.registerProviders();
  }

  /**
   * Register all available providers with the registry
   * This ensures providers are available for routing decisions
   */
  private registerProviders(): void {
    // For now, we'll skip provider registration until dependencies are resolved
    // Future providers can be registered here once constructor dependencies are available
    // const avitoProvider = new AvitoBusinessSetupProvider();
    // this.providerRegistry.registerProvider(avitoProvider);

    // const ebayProvider = new EbayBusinessSetupProvider();
    // this.providerRegistry.registerProvider(ebayProvider);

    console.log(
      `BusinessSetupModule: Provider registration temporarily disabled`,
    );
  }
}
