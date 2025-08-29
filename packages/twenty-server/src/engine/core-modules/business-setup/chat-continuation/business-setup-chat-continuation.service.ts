import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';

import { BusinessSetupService } from '../business-setup.service';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

import { ChatContinuationInput } from './dtos/chat-continuation.input';

@Injectable()
export class BusinessSetupChatContinuationService {
  private readonly logger = new Logger(
    BusinessSetupChatContinuationService.name,
  );

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentChatService: AgentChatService,
    private readonly businessSetupService: BusinessSetupService,
  ) {}

  async continueWelcomeChat(
    userId: string,
    workspaceId: string,
    input: ChatContinuationInput,
  ): Promise<{ success: boolean; response: string; nextStep?: string }> {
    try {
      this.logger.log(
        `Continuing welcome chat for user ${userId}, thread ${input.threadId}`,
      );

      // Эмитим событие получения сообщения пользователя
      this.eventEmitter.emit('ai-agent.welcome.user-message-received', {
        userId,
        workspaceId,
        threadId: input.threadId,
        message: input.message,
        timestamp: new Date(),
      });

      // Сохраняем сообщение пользователя в чат
      await this.agentChatService.addMessage({
        threadId: input.threadId,
        role: AgentChatMessageRole.USER,
        content: input.message,
        fileIds: input.fileIds || [],
      });

      // Получаем контекст чата для AI
      const chatContext = await this.getChatContext(
        input.threadId,
        workspaceId,
      );

      // Генерируем ответ AI
      const aiResponse = await this.generateAIResponse(
        userId,
        workspaceId,
        input.message,
        chatContext,
        input.context,
      );

      // Сохраняем ответ AI в чат
      await this.agentChatService.addMessage({
        threadId: input.threadId,
        role: AgentChatMessageRole.ASSISTANT,
        content: aiResponse.response,
        fileIds: [],
      });

      // Эмитим событие генерации ответа AI
      this.eventEmitter.emit('ai-agent.welcome.ai-response-generated', {
        userId,
        workspaceId,
        threadId: input.threadId,
        response: aiResponse.response,
        context: aiResponse.context,
        timestamp: new Date(),
      });

      // Анализируем готовность к следующему шагу
      const nextStep = await this.analyzeReadinessForNextStep(
        userId,
        workspaceId,
        input.message,
        aiResponse.response,
      );

      if (nextStep) {
        // Эмитим событие готовности к следующему шагу
        this.eventEmitter.emit('business-setup.ready-for-next-step', {
          userId,
          workspaceId,
          fromStep: BusinessSetupStatus.WELCOME,
          toStep: nextStep,
          reason: 'User ready for next step based on chat analysis',
          timestamp: new Date(),
        });
      }

      return {
        success: true,
        response: aiResponse.response,
        nextStep: nextStep || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to continue welcome chat:', error);
      throw error;
    }
  }

  private async getChatContext(
    threadId: string,
    workspaceId: string,
  ): Promise<string> {
    try {
      const messages = await this.agentChatService.getMessagesForThread(
        threadId,
        workspaceId,
      );

      // Формируем контекст из последних сообщений
      const recentMessages = messages.slice(-10); // Последние 10 сообщений

      return recentMessages
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');
    } catch (error) {
      this.logger.warn('Failed to get chat context:', error);

      return '';
    }
  }

  private async generateAIResponse(
    userId: string,
    workspaceId: string,
    userMessage: string,
    chatContext: string,
    additionalContext?: string,
  ): Promise<{ response: string; context: Record<string, any> }> {
    try {
      // Формируем промпт для AI с контекстом
      const systemPrompt = `You are a Business Setup AI Assistant helping users set up their business automation.

Current conversation context:
${chatContext}

User's message: ${userMessage}

Additional context: ${additionalContext || 'None'}

Please provide a helpful, friendly response that:
1. Addresses the user's question or concern
2. Guides them toward the next step in business setup
3. Maintains a conversational tone
4. Suggests specific next actions when appropriate

Keep your response concise but informative.`;

      // Выполняем AI агента
      const aiResponse = await this.agentExecutionService.executeAgent({
        agent: null, // TODO: Создать welcome-agent или использовать default
        context: {
          userId,
          workspaceId,
          step: 'WELCOME',
          userMessage,
          chatContext,
          additionalContext,
        },
        schema: {},
        userPrompt: systemPrompt,
      });

      return {
        response:
          (aiResponse.result as any)?.response ||
          'I understand your message. Let me help you with that.',
        context: {
          userId,
          workspaceId,
          step: 'WELCOME',
          userMessage,
          chatContext,
        },
      };
    } catch (error) {
      this.logger.error('Failed to generate AI response:', error);

      // Fallback ответ
      return {
        response:
          "I understand your message. Let me help you with that. Could you please provide more details about what you'd like to accomplish?",
        context: {
          userId,
          workspaceId,
          step: 'WELCOME',
          userMessage,
          chatContext,
        },
      };
    }
  }

  private async analyzeReadinessForNextStep(
    userId: string,
    workspaceId: string,
    userMessage: string,
    aiResponse: string,
  ): Promise<string | null> {
    try {
      // Простая логика анализа готовности к следующему шагу
      const messageLower = userMessage.toLowerCase();
      const responseLower = aiResponse.toLowerCase();

      // Ключевые слова для определения готовности
      const businessKeywords = [
        'business',
        'company',
        'startup',
        'enterprise',
        'organization',
      ];
      const processKeywords = ['process', 'workflow', 'automation', 'system'];
      const salesKeywords = [
        'sales',
        'marketing',
        'funnel',
        'leads',
        'customers',
      ];
      const teamKeywords = ['team', 'employees', 'staff', 'people', 'roles'];

      // Проверяем готовность к BUSINESS_ANALYSIS
      if (
        businessKeywords.some((keyword) => messageLower.includes(keyword)) ||
        processKeywords.some((keyword) => messageLower.includes(keyword))
      ) {
        return BusinessSetupStatus.BUSINESS_ANALYSIS;
      }

      // Проверяем готовность к SALES_FUNNEL_DESIGN
      if (salesKeywords.some((keyword) => messageLower.includes(keyword))) {
        return BusinessSetupStatus.SALES_FUNNEL_DESIGN;
      }

      // Проверяем готовность к TEAM_ASSIGNMENT
      if (teamKeywords.some((keyword) => messageLower.includes(keyword))) {
        return BusinessSetupStatus.TEAM_ASSIGNMENT;
      }

      // Если пользователь явно говорит о готовности
      if (
        messageLower.includes('ready') ||
        messageLower.includes('next') ||
        messageLower.includes('continue')
      ) {
        return BusinessSetupStatus.BUSINESS_ANALYSIS;
      }

      return null; // Пользователь еще не готов к следующему шагу
    } catch (error) {
      this.logger.warn('Failed to analyze readiness for next step:', error);

      return null;
    }
  }
}
