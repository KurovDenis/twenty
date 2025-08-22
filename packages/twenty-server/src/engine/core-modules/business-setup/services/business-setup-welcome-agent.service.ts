import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import {
  OnboardingStatusChangedEvent
} from '../events/business-setup.events';

@Injectable()
export class BusinessSetupWelcomeAgentService {
  private readonly logger = new Logger(BusinessSetupWelcomeAgentService.name);
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentChatService: AgentChatService, // Используем существующий
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  // ✅ ИСПРАВЛЕНО: Используем только NestJS @OnEvent, убираем дублирование
  @OnEvent('onboarding.status.changed')
  private async handleOnboardingStatusChange(payload: OnboardingStatusChangedEvent) {
    // ✅ ДОБАВЛЕНО: Валидация payload
    if (!this.validateEventPayload(payload)) {
      this.logger.warn('Invalid onboarding status change payload:', payload);
      return;
    }

    if (payload.status === 'COMPLETED' && payload.previousStatus !== 'COMPLETED') {
      try {
        this.logger.log(`Onboarding completed for user ${payload.userId}`);
        
        // ✅ ИСПРАВЛЕНО: Используем retry механизм
        await this.createWelcomeChatWithRetry(payload.userId, payload.workspaceId);
        
      } catch (error) {
        this.logger.error('Failed to create welcome chat after all retries:', error);
        
        // Эмитим событие ошибки
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

  // ✅ ИСПРАВЛЕНО: Используем централизованную валидацию
  private validateEventPayload(payload: any): payload is OnboardingStatusChangedEvent {
    return payload && 
           typeof payload.userId === 'string' &&
           typeof payload.workspaceId === 'string' &&
           typeof payload.status === 'string' &&
           typeof payload.previousStatus === 'string' &&
           payload.timestamp instanceof Date;
  }

  // ✅ ИСПРАВЛЕНО: Создание чата с retry механизмом
  private async createWelcomeChatWithRetry(userId: string, workspaceId: string): Promise<void> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.createWelcomeChat(userId, workspaceId);
        this.logger.log(`Welcome chat created successfully on attempt ${attempt}`);
        return; // Успех
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} failed for user ${userId}:`, error);
        
        if (attempt === this.maxRetries) {
          // Финальная ошибка
          this.logger.error(`All ${this.maxRetries} attempts failed for user ${userId}`);
          throw error;
        }
        
        // ✅ ДОБАВЛЕНО: Exponential backoff перед retry
        const delayMs = Math.pow(2, attempt) * this.retryDelayMs;
        await this.delay(delayMs);
      }
    }
  }

  // ✅ ДОБАВЛЕНО: Utility метод для задержки
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Создание нового welcome чата через существующий AgentChatService
  private async createWelcomeChat(userId: string, workspaceId: string): Promise<void> {
    try {
      // Эмитим событие начала создания чата
      this.eventEmitter.emit('ai-agent.welcome.chat-creation-started', {
        userId,
        workspaceId,
        timestamp: new Date()
      });

      // Создаем новый чат через существующий AgentChatService
      const thread = await this.agentChatService.createThread('welcome-agent', workspaceId);

      // Получаем персонализированный промпт
      const welcomePrompt = await this.getPersonalizedWelcomePrompt(userId, workspaceId);
      
      // Отправляем промпт в LLM через существующий AgentExecutionService
      const aiResponse = await this.agentExecutionService.executeAgent({
        agent: null, // TODO: Создать welcome-agent или использовать default
        context: { 
          userId, 
          workspaceId, 
          step: 'WELCOME',
          prompt: welcomePrompt,
          threadId: thread.id
        },
        schema: {}, // Простая схема для welcome
        userPrompt: welcomePrompt,
      });

      // Сохраняем ответ LLM в чат через существующий AgentChatService
      const responseContent = (aiResponse.result as any)?.response || 'Welcome message';
      await this.agentChatService.addMessage({
        threadId: thread.id,
        role: AgentChatMessageRole.ASSISTANT,
        content: responseContent,
        fileIds: []
      });

      // Эмитим событие успешного создания чата
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

  // Получение персонализированного промпта
  private async getPersonalizedWelcomePrompt(userId: string, workspaceId: string): Promise<string> {
    try {
      // Получаем данные пользователя и workspace для персонализации
      const user = await this.userService.findById(userId);
      const workspace = await this.workspaceService.findById(workspaceId);

      const userName = user?.firstName || user?.email || 'User';
      const workspaceName = workspace?.displayName || 'Workspace';

      return `🎉 Welcome to Business Setup Wizard!

Hi ${userName}! I'm your AI assistant, and I'm here to help you automate your business and set up efficient processes for ${workspaceName}.

Let's start with a simple question: What type of business do you have?

I'll guide you through each step of the Business Setup process to help you:
• Design your sales funnel
• Set up email marketing automation
• Configure your CRM workflows
• Optimize your customer journey

Ready to get started? Just tell me about your business!`;
    } catch (error) {
      this.logger.warn('Failed to get personalized welcome prompt, using default:', error);
      
      // Fallback к дефолтному промпту
      return `🎉 Welcome to Business Setup Wizard!

Hi there! I'm your AI assistant, and I'm here to help you automate your business and set up efficient processes.

Let's start with a simple question: What type of business do you have?

I'll guide you through each step of the Business Setup process to help you:
• Design your sales funnel
• Set up email marketing automation
• Configure your CRM workflows
• Optimize your customer journey

Ready to get started? Just tell me about your business!`;
    }
  }
}
