import { UseGuards } from '@nestjs/common';
import { Args, Field, InputType, Mutation, ObjectType, Query, Resolver } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { FeatureFlagGuard, RequireFeatureFlag } from 'src/engine/guards/feature-flag.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { AgentChatMessageEntity, AgentChatMessageRole } from '../../agent-chat-message.entity';
import { AgentChatService } from '../../agent-chat.service';
import { AgentExecutionService } from '../../agent-execution.service';
import { AgentService } from '../../agent.service';
import { LangGraphExecutionService } from '../services/langgraph-execution.service';

// GraphQL Object Types
@ObjectType()
class AgentChatThreadDTO {
  @Field()
  id: string;

  @Field()
  agentId: string;

  @Field()
  userWorkspaceId: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}

@ObjectType()
class AgentChatMessageDTO {
  @Field()
  id: string;

  @Field()
  threadId: string;

  @Field()
  role: string;

  @Field()
  content: string;

  @Field()
  createdAt: string;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, any>;
}

@InputType()
class SendWelcomeAgentMessageInput {
  @Field()
  agentId: string;

  @Field()
  threadId: string;

  @Field()
  workspaceId: string;

  @Field(() => [AgentMessageInput])
  messages: AgentMessageInput[];
}

@InputType()
class AgentMessageInput {
  @Field()
  id: string;

  @Field()
  role: string;

  @Field()
  content: string;

  @Field()
  timestamp: string;
}

@UseGuards(WorkspaceAuthGuard, FeatureFlagGuard)
@Resolver()
export class LangGraphAgentResolver {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentChatService: AgentChatService,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly langGraphExecutionService: LangGraphExecutionService,
  ) {}

  @Mutation(() => AgentChatThreadDTO)
  @RequireFeatureFlag(FeatureFlagKey.IS_AI_ENABLED)
  async createWelcomeAgentThread(
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @AuthWorkspace() { id: workspaceId }: Workspace,
  ): Promise<AgentChatThreadDTO> {
    // Find or create Welcome Agent
    const welcomeAgent = await this.agentService.findOneAgent(
      'welcome-agent', // Assuming this is the ID for welcome agent
      workspaceId,
    );
    
    if (!welcomeAgent) {
      throw new Error('Welcome agent not found');
    }
    
    // Create thread using existing service
    const thread = await this.agentChatService.createThread(welcomeAgent.id, userWorkspaceId);
    
    return {
      id: thread.id,
      agentId: thread.agentId,
      userWorkspaceId: thread.userWorkspaceId,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    };
  }

  @Mutation(() => AgentChatMessageDTO)
  @RequireFeatureFlag(FeatureFlagKey.IS_AI_ENABLED)
  async sendWelcomeAgentMessage(
    @Args('input') input: SendWelcomeAgentMessageInput,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<AgentChatMessageDTO> {
    // Convert input messages to the format expected by execution service
    const messages = input.messages.map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    // Use existing AgentExecutionService
    const result = await this.agentExecutionService.executeAgent(
      input.agentId,
      messages,
      input.workspaceId,
      userWorkspaceId,
      input.threadId,
    );

    // Save message to thread using addMessage method
    const message = await this.agentChatService.addMessage({
      threadId: input.threadId,
      role: AgentChatMessageRole.ASSISTANT,
      content: (result.result as any).response || (result.result as any).content || 'No response generated',
    });

    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      metadata: {}, // AgentChatMessageEntity doesn't have metadata field
    };
  }

  @Query(() => [AgentChatThreadDTO])
  @RequireFeatureFlag(FeatureFlagKey.IS_AI_ENABLED)
  async getLangGraphThreads(
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @AuthWorkspace() { id: workspaceId }: Workspace,
  ): Promise<AgentChatThreadDTO[]> {
    // Get threads for LangGraph agents - using repository directly
    const agents = await this.agentService['agentRepository'].find({
      where: { 
        workspaceId,
        agentType: 'langgraph',
      },
    });

    const threads = [];
    for (const agent of agents) {
      const agentThreads = await this.agentChatService['threadRepository'].find({
        where: { 
          agentId: agent.id,
          userWorkspaceId,
        },
      });
      threads.push(...agentThreads);
    }

    return threads.map(thread => ({
      id: thread.id,
      agentId: thread.agentId,
      userWorkspaceId: thread.userWorkspaceId,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
    }));
  }

  @Query(() => [AgentChatMessageDTO])
  @RequireFeatureFlag(FeatureFlagKey.IS_AI_ENABLED)
  async getLangGraphThreadMessages(
    @Args('threadId') threadId: string,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ): Promise<AgentChatMessageDTO[]> {
    // Get messages for a specific thread using existing method
    const messages = await this.agentChatService.getMessagesForThread(threadId, userWorkspaceId);

    return messages.map((message: AgentChatMessageEntity) => ({
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      metadata: {}, // AgentChatMessageEntity doesn't have metadata field
    }));
  }
}
