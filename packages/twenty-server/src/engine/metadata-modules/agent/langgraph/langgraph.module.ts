import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SalesAgent } from './agents/sales-agent/sales-agent';
import { SupportAgent } from './agents/support-agent/support-agent';
import { WelcomeAgent } from './agents/welcome-agent/welcome-agent';
import { LangGraphStateEntity } from './entities/langgraph-state.entity';
import { LangGraphAgentResolver } from './resolvers/langgraph-agent.resolver';
import { LangGraphEncryptionService } from './services/langgraph-encryption.service';
import { LangGraphExecutionService } from './services/langgraph-execution.service';
import { LangGraphMetricsService } from './services/langgraph-metrics.service';
import { LangGraphStateCacheService } from './services/langgraph-state-cache.service';
import { LangGraphStateRecoveryService } from './services/langgraph-state-recovery.service';
import { LangGraphStateService } from './services/langgraph-state.service';
import { LangGraphTracingService } from './services/langgraph-tracing.service';
import { LangGraphValidationService } from './services/langgraph-validation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LangGraphStateEntity]),
  ],
  providers: [
    LangGraphExecutionService,
    LangGraphStateService,
    LangGraphStateCacheService,
    LangGraphStateRecoveryService,
    LangGraphEncryptionService,
    LangGraphValidationService,
    LangGraphMetricsService,
    LangGraphTracingService,
    LangGraphAgentResolver,
    WelcomeAgent,
    SalesAgent,
    SupportAgent,
  ],
  exports: [
    LangGraphExecutionService,
    LangGraphStateService,
    LangGraphStateCacheService,
    LangGraphStateRecoveryService,
    LangGraphEncryptionService,
    LangGraphValidationService,
    LangGraphMetricsService,
    LangGraphTracingService,
    WelcomeAgent,
    SalesAgent,
    SupportAgent,
  ],
})
export class LangGraphModule {}
