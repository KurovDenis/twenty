import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentChatMessageEntity } from './agent-chat-message.entity';
import { AgentChatThreadEntity } from './agent-chat-thread.entity';
import { AgentChatService } from './agent-chat.service';
import { AgentExecutionService } from './agent-execution.service';
import { AgentEntity } from './agent.entity';
import { AgentResolver } from './agent.resolver';
import { AgentService } from './agent.service';
import { LangGraphModule } from './langgraph/langgraph.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentChatThreadEntity,
      AgentChatMessageEntity,
    ]),
    LangGraphModule, // Import LangGraph module
  ],
  providers: [
    AgentService,
    AgentChatService,
    AgentExecutionService,
    AgentResolver,
  ],
  exports: [
    AgentService,
    AgentChatService,
    AgentExecutionService,
    LangGraphModule, // Export LangGraph module
  ],
})
export class AgentModule {}
