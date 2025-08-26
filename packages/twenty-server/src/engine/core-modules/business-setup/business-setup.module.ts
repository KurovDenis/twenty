import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentModule } from 'src/engine/metadata-modules/agent/agent.module';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { SubscriptionsModule } from 'src/engine/subscriptions/subscriptions.module';
import { AiModule } from 'src/engine/core-modules/ai/ai.module';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { TokenModule } from '../auth/token/token.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { UserVarsModule } from '../user/user-vars/user-vars.module';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { BusinessSetupResolver } from './business-setup.resolver';
import { BusinessSetupService } from './business-setup.service';
import { BusinessSetupSubscriptionsResolver } from './business-setup-subscriptions.resolver';
import { BusinessSetupChatContinuationService } from './chat-continuation/business-setup-chat-continuation.service';
import { BusinessSetupTransitionService } from './chat-continuation/business-setup-transition.service';
import { BusinessSetupChatResolver } from './resolvers/business-setup-chat.resolver';
import { BusinessSetupWelcomeAgentService } from './services/business-setup-welcome-agent.service';
import { BusinessSetupAgentService } from './services/business-setup-agent.service';
import { EventEmitterBridgeService } from './services/event-emitter-bridge.service';
// SGR (Schema-Guided Reasoning) services
import { AvitoWelcomeSGRService } from './sgr/services/avito-welcome-sgr.service';
import { AvitoWelcomeToolDispatcherService } from './sgr/services/avito-welcome-tool-dispatcher.service';

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
  ],
  providers: [
    BusinessSetupService, 
    BusinessSetupResolver,
    BusinessSetupSubscriptionsResolver, // Add GraphQL subscriptions resolver
    BusinessSetupWelcomeAgentService, // Добавляем новый сервис
    BusinessSetupAgentService, // Add new agent service
    BusinessSetupChatContinuationService, // Добавляем сервис продолжения чата
    BusinessSetupTransitionService, // Добавляем сервис переходов
    BusinessSetupChatResolver, // Добавляем новый resolver
    EventEmitterBridgeService, // Add event bridge service
    // SGR (Schema-Guided Reasoning) services
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
    HttpTool, // Add HTTP tool for Avito API validation
  ],
  exports: [
    BusinessSetupService,
    BusinessSetupWelcomeAgentService,
    BusinessSetupAgentService, // Export new agent service
    BusinessSetupChatContinuationService,
    BusinessSetupTransitionService,
    EventEmitterBridgeService, // Export event bridge service
    // SGR services for potential external use
    AvitoWelcomeSGRService,
    AvitoWelcomeToolDispatcherService,
  ],
})
export class BusinessSetupModule {}
