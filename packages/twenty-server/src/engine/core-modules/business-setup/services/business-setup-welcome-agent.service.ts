import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import {
  OnboardingStatusChangedEvent
} from '../events/business-setup.events';

@Injectable()
export class BusinessSetupWelcomeAgentService {
  private readonly logger = new Logger(BusinessSetupWelcomeAgentService.name);
  // Define the Gemini model ID to be used exclusively for welcome step
  private readonly GEMINI_MODEL_ID = 'google/gemini-2.5-flash';
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentChatService: AgentChatService,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    @InjectRepository(AgentEntity, 'core')
    private readonly agentRepository: Repository<AgentEntity>,
  ) {}

  // Handle onboarding status changes to create welcome chat
  @OnEvent('onboarding.status.changed')
  private async handleOnboardingStatusChange(payload: OnboardingStatusChangedEvent) {
    // Validate event payload
    if (!this.validateEventPayload(payload)) {
      this.logger.warn('Invalid onboarding status change payload:', payload);
      return;
    }

    if (payload.status === 'COMPLETED' && payload.previousStatus !== 'COMPLETED') {
      try {
        this.logger.log(`Onboarding completed for user ${payload.userId}`);
        
        // Use retry mechanism for reliability
        await this.createWelcomeChatWithRetry(payload.userId, payload.workspaceId);
        
      } catch (error) {
        this.logger.error('Failed to create welcome chat after all retries:', error);
        
        // Emit error event
        this.eventEmitter.emit('ai-agent.welcome.chat-creation-failed', {
          userId: payload.userId,
          workspaceId: payload.workspaceId,
          error: error.message,
          attempts: this.maxRetries,
          timestamp: new Date()
        });
      }
    }
  }

  // Centralized validation for event payload
  private validateEventPayload(payload: any): payload is OnboardingStatusChangedEvent {
    return payload && 
           typeof payload.userId === 'string' &&
           typeof payload.workspaceId === 'string' &&
           typeof payload.status === 'string' &&
           typeof payload.previousStatus === 'string' &&
           payload.timestamp instanceof Date;
  }

  // Create welcome chat with retry mechanism for reliability
  private async createWelcomeChatWithRetry(userId: string, workspaceId: string): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.createWelcomeChat(userId, workspaceId);
        this.logger.log(`Welcome chat created successfully on attempt ${attempt}`);
        return; // Success
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} failed for user ${userId}:`, error);
        
        if (attempt === this.maxRetries) {
          // Final error
          this.logger.error(`All ${this.maxRetries} attempts failed for user ${userId}`);
          throw error;
        }
        
        // Use exponential backoff before retry
        const delayMs = Math.pow(2, attempt) * this.retryDelayMs;
        await this.delay(delayMs);
      }
    }
  }

  // Utility method for delay with promise
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Create new welcome chat using the AgentChatService with Gemini model
  private async createWelcomeChat(userId: string, workspaceId: string): Promise<void> {
    try {
      // Emit event for chat creation start
      this.eventEmitter.emit('ai-agent.welcome.chat-creation-started', {
        userId,
        workspaceId,
        timestamp: new Date()
      });

      // Fetch or create a welcome agent specifically with the Gemini model
      const welcomeAgent = await this.agentRepository.findOne({
        where: { 
          name: 'Welcome Greeting Bot',
          workspaceId 
        }
      });

      let agent;
      
      if (!welcomeAgent) {
        // Create a dedicated welcome agent that uses Gemini model
        agent = await this.agentRepository.save({
          name: 'Welcome Greeting Bot',
          description: 'Simple greeting bot for welcome status',
          prompt: 'You are a simple greeting bot. You ONLY respond with greetings.',
          modelId: this.GEMINI_MODEL_ID, // Force use of Gemini model via OpenRouter
          workspaceId,
        });
      } else {
        agent = welcomeAgent;
      }

      // Create a new chat thread using the existing AgentChatService
      const thread = await this.agentChatService.createThread('welcome-agent', workspaceId);

      // Get personalized welcome prompt
      const welcomePrompt = await this.getPersonalizedWelcomePrompt(userId, workspaceId);
      
      // Send prompt to LLM through the AgentExecutionService using the specific Gemini agent
      const aiResponse = await this.agentExecutionService.executeAgent({
        agent, // Use the specific Gemini-based welcome agent
        context: { 
          userId, 
          workspaceId, 
          step: 'WELCOME',
          prompt: welcomePrompt,
          threadId: thread.id,
          modelId: this.GEMINI_MODEL_ID // Ensure this specific model is used
        },
        schema: {}, // Simple schema for welcome
        userPrompt: welcomePrompt,
      });

      // Save LLM response to chat through existing AgentChatService
      const responseContent = (aiResponse.result as any)?.response || 'Welcome message';
      await this.agentChatService.addMessage({
        threadId: thread.id,
        role: AgentChatMessageRole.ASSISTANT,
        content: responseContent,
        fileIds: []
      });

      // Emit successful chat creation event
      this.eventEmitter.emit('ai-agent.welcome.chat-created', {
        userId,
        workspaceId,
        threadId: thread.id,
        aiResponse: responseContent,
        timestamp: new Date()
      });

      this.logger.log(`Welcome chat created successfully for user ${userId}, thread ID: ${thread.id}`);

    } catch (error) {
      this.logger.error('Failed to create welcome chat:', error);
      throw error;
    }
  }

  // Get personalized welcome prompt
  private async getPersonalizedWelcomePrompt(userId: string, workspaceId: string): Promise<string> {
    try {
      // Get user and workspace data for personalization
      const user = await this.userService.findById(userId);
      const workspace = await this.workspaceService.findById(workspaceId);

      const userName = user?.firstName || user?.email || 'User';
      const workspaceName = workspace?.displayName || 'Workspace';

      return `👋 Hello ${userName}!

I AM A WELCOME BOT AND NOTHING MORE. I'm here to greet you in ${workspaceName}.

Have a great day!`;
    } catch (error) {
      this.logger.warn('Failed to get personalized welcome prompt, using default:', error);
      
      // Fallback to default prompt
      return `👋 Hello there!

I AM A WELCOME BOT AND NOTHING MORE. I'm here to greet you.

Have a great day!`;
    }
  }
}
