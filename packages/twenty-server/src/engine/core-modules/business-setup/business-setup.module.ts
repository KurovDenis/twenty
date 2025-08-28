import { Module, forwardRef } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { BusinessSetupSubscriptionsResolver } from './business-setup-subscriptions.resolver';
import { BusinessSetupResolver } from './business-setup.resolver';
import { BusinessSetupService } from './business-setup.service';
import { BusinessSetupChatContinuationService } from './chat-continuation/business-setup-chat-continuation.service';
import { BusinessSetupTransitionService } from './chat-continuation/business-setup-transition.service';
import { BusinessSetupChatResolver } from './resolvers/business-setup-chat.resolver';
import { BusinessSetupAgentService } from './services/business-setup-agent.service';
import { BusinessSetupWelcomeAgentService } from './services/business-setup-welcome-agent.service';
import { EventEmitterBridgeService } from './services/event-emitter-bridge.service';
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
    OnboardingModule, 
    TokenModule, 
    WorkspaceCacheStorageModule,
    SubscriptionsModule, // Add for GraphQL subscriptions
    AiModule, // Add for AI model registry and SGR support
    AgentModule, // Добавляем для использования AgentChatService
    forwardRef(() => UserModule), // Fix circular dependency with forwardRef
    WorkspaceModule, // Добавляем для использования WorkspaceService
    TerminusModule, // Add for health checks and monitoring
  ],
  providers: [
    // Core services
    BusinessSetupService, 
    BusinessSetupResolver,
    BusinessSetupSubscriptionsResolver, // Add GraphQL subscriptions resolver
    BusinessSetupWelcomeAgentService, // Добавляем новый сервис
    BusinessSetupAgentService, // Add new agent service
    BusinessSetupChatContinuationService, // Добавляем сервис продолжения чата
    BusinessSetupTransitionService, // Добавляем сервис переходов
    BusinessSetupChatResolver, // Добавляем новый resolver
    EventEmitterBridgeService, // Add event bridge service
    
    // SGR (Schema-Guided Reasoning) services with dependency resolution
    SupervisorToolDispatcherService, // Register tool dispatcher first
    SupervisorSGRService, // Register supervisor service second
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
    
    // Monitoring and health check services - TEMPORARILY DISABLED
    // SGRModuleHealthIndicator, // Health indicator for SGR module
    
    HttpTool, // Add HTTP tool for Avito API validation
  ],
  controllers: [
    // Health check controller - TEMPORARILY DISABLED
    // SGRHealthController, // Controller for health check endpoints
  ],
  exports: [
    BusinessSetupService,
    BusinessSetupWelcomeAgentService,
    BusinessSetupAgentService, // Export new agent service
    BusinessSetupChatContinuationService,
    BusinessSetupTransitionService,
    EventEmitterBridgeService, // Export event bridge service
    
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
export class BusinessSetupModule {}
