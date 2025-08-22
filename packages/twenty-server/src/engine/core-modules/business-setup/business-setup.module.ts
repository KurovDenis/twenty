import { Module, forwardRef } from '@nestjs/common';
import { AgentModule } from 'src/engine/metadata-modules/agent/agent.module';
import { WorkspaceCacheStorageModule } from 'src/engine/workspace-cache-storage/workspace-cache-storage.module';
import { SubscriptionsModule } from 'src/engine/subscriptions/subscriptions.module';
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
import { EventEmitterBridgeService } from './services/event-emitter-bridge.service';

@Module({
  imports: [
    UserVarsModule, 
    OnboardingModule, 
    TokenModule, 
    WorkspaceCacheStorageModule,
    SubscriptionsModule, // Add for GraphQL subscriptions
    AgentModule, // Добавляем для использования AgentChatService
    forwardRef(() => UserModule), // Fix circular dependency with forwardRef
    WorkspaceModule, // Добавляем для использования WorkspaceService
  ],
  providers: [
    BusinessSetupService, 
    BusinessSetupResolver,
    BusinessSetupSubscriptionsResolver, // Add GraphQL subscriptions resolver
    BusinessSetupWelcomeAgentService, // Добавляем новый сервис
    BusinessSetupChatContinuationService, // Добавляем сервис продолжения чата
    BusinessSetupTransitionService, // Добавляем сервис переходов
    BusinessSetupChatResolver, // Добавляем новый resolver
    EventEmitterBridgeService, // Add event bridge service
  ],
  exports: [
    BusinessSetupService,
    BusinessSetupWelcomeAgentService,
    BusinessSetupChatContinuationService,
    BusinessSetupTransitionService,
    EventEmitterBridgeService, // Export event bridge service
  ],
})
export class BusinessSetupModule {}
