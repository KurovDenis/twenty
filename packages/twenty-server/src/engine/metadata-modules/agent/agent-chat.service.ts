import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Repository } from 'typeorm';

import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';
import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';
import {
  AgentChatMessageEntity,
  type AgentChatMessageRole,
} from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatThreadEntity } from 'src/engine/metadata-modules/agent/agent-chat-thread.entity';
import {
  AgentException,
  AgentExceptionCode,
} from 'src/engine/metadata-modules/agent/agent.exception';

import { AgentTitleGenerationService } from './agent-title-generation.service';

@Injectable()
export class AgentChatService {
  constructor(
    @InjectRepository(AgentChatThreadEntity, 'core')
    private readonly threadRepository: Repository<AgentChatThreadEntity>,
    @InjectRepository(AgentChatMessageEntity, 'core')
    private readonly messageRepository: Repository<AgentChatMessageEntity>,
    @InjectRepository(FileEntity, 'core')
    private readonly fileRepository: Repository<FileEntity>,
    private readonly titleGenerationService: AgentTitleGenerationService,
    private readonly businessSetupAgentService: BusinessSetupAgentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createThread(agentId: string, userWorkspaceId: string) {
    const thread = this.threadRepository.create({
      agentId,
      userWorkspaceId,
    });

    return this.threadRepository.save(thread);
  }

  async createThreadWithBusinessSetupContext(
    agentId: string,
    userWorkspaceId: string,
    businessSetupStep?: BusinessSetupStatus,
  ) {
    let effectiveAgentId = agentId;
    let isBusinessSetupAgent = false;

    // If business setup step is provided, use appropriate agent
    if (businessSetupStep) {
      try {
        const businessSetupAgent = await this.businessSetupAgentService.getAgentForStep(
          businessSetupStep,
          userWorkspaceId,
        );
        effectiveAgentId = businessSetupAgent.id;
        isBusinessSetupAgent = true;
      } catch (error) {
        // Log warning but continue with original agentId as fallback
        console.warn(`Failed to get business setup agent for step ${businessSetupStep}:`, error);
      }
    }

    const thread = this.threadRepository.create({
      agentId: effectiveAgentId,
      userWorkspaceId,
    });

    const savedThread = await this.threadRepository.save(thread);

    // Send automatic greeting message for business setup agents
    // This is essential for guiding users through the business setup process
    if (isBusinessSetupAgent && businessSetupStep) {
      try {
        console.log(`Sending welcome message for business setup step: ${businessSetupStep}, threadId: ${savedThread.id}`);
        
        await this.sendWelcomeMessage(savedThread.id, businessSetupStep);
        
        console.log(`Welcome message sent successfully for thread: ${savedThread.id}`);
        
        // Emit event for real-time UI updates
        this.eventEmitter.emit('ai-agent.welcome.chat-created', {
          threadId: savedThread.id,
          agentId: effectiveAgentId,
          businessSetupStep,
          userWorkspaceId,
          aiResponse: 'Welcome message sent automatically', // Will be updated when actual greeting is sent
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`Failed to send welcome message for business setup step ${businessSetupStep}:`, error);
        
        // Emit failure event for frontend error handling
        this.eventEmitter.emit('ai-agent.welcome.chat-failed', {
          threadId: savedThread.id,
          agentId: effectiveAgentId,
          businessSetupStep,
          userWorkspaceId,
          error: error instanceof Error ? error.message : String(error),
          attempts: 1,
          timestamp: new Date()
        });
        
        // Don't fail thread creation if welcome message fails
        console.warn(`Thread ${savedThread.id} created successfully but welcome message failed. Thread is still usable.`);
      }
    }

    return savedThread;
  }

  async getThreadsForAgent(agentId: string, userWorkspaceId: string) {
    return this.threadRepository.find({
      where: {
        agentId,
        userWorkspaceId,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getThreadById(threadId: string, userWorkspaceId: string) {
    const thread = await this.threadRepository.findOne({
      where: {
        id: threadId,
        userWorkspaceId,
      },
    });

    if (!thread) {
      throw new AgentException(
        'Thread not found',
        AgentExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    return thread;
  }

  async addMessage({
    threadId,
    role,
    content,
    fileIds,
  }: {
    threadId: string;
    role: AgentChatMessageRole;
    content: string;
    fileIds?: string[];
  }) {
    const message = this.messageRepository.create({
      threadId,
      role,
      content,
    });

    const savedMessage = await this.messageRepository.save(message);

    if (fileIds && fileIds.length > 0) {
      for (const fileId of fileIds) {
        await this.fileRepository.update(fileId, {
          messageId: savedMessage.id,
        });
      }
    }

    // Check if this is a user message in a business setup thread
    if (role === 'user') {
      await this.checkAndEmitBusinessSetupEvent(threadId, content);
    }

    this.generateTitleIfNeeded(threadId, content);

    return savedMessage;
  }

  async getMessagesForThread(threadId: string, userWorkspaceId: string) {
    const thread = await this.threadRepository.findOne({
      where: {
        id: threadId,
        userWorkspaceId,
      },
    });

    if (!thread) {
      throw new AgentException(
        'Thread not found',
        AgentExceptionCode.AGENT_EXECUTION_FAILED,
      );
    }

    return this.messageRepository.find({
      where: { threadId },
      order: { createdAt: 'ASC' },
      relations: ['files'],
    });
  }

  private async generateTitleIfNeeded(
    threadId: string,
    messageContent: string,
  ) {
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      select: ['id', 'title'],
    });

    if (!thread || thread.title) {
      return;
    }

    const title =
      await this.titleGenerationService.generateThreadTitle(messageContent);

    await this.threadRepository.update(threadId, { title });
  }

  // Check if thread belongs to a business setup agent and emit event for user messages
  private async checkAndEmitBusinessSetupEvent(threadId: string, content: string) {
    try {
      const thread = await this.threadRepository.findOne({
        where: { id: threadId },
        relations: ['agent', 'userWorkspace'] // ✅ ADD userWorkspace relation
      });

      if (!thread) {
        return;
      }

      // ✅ CHECK: Ensure userWorkspace relation is loaded
      if (!thread.userWorkspace) {
        console.error('UserWorkspace relation not found for thread:', threadId);
        return;
      }

      // Check if this thread is associated with a business setup agent
      const isBusinessSetupThread = await this.isBusinessSetupThread(thread.agentId, thread.userWorkspaceId);
      
      if (isBusinessSetupThread) {
        // ✅ FIXED: Use correct userId and workspaceId from UserWorkspace relation
        this.eventEmitter.emit('ai-agent.welcome.user-message-received', {
          userId: thread.userWorkspace.userId,        // ✅ CORRECT: Real userId from UserWorkspace
          workspaceId: thread.userWorkspace.workspaceId, // ✅ CORRECT: Real workspaceId from UserWorkspace
          threadId,
          message: content,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Failed to check business setup thread:', error);
    }
  }

  // Check if agent is a business setup agent
  private async isBusinessSetupThread(agentId: string, userWorkspaceId: string): Promise<boolean> {
    try {
      // We need to inject the AgentEntity repository to check agent details
      // For now, let's use a simple approach by checking specific agent names
      // that are used by the BusinessSetupWelcomeAgentService
      
      // Business setup agents are identified by specific names or patterns
      const businessSetupAgentNames = [
        'Welcome Greeting Bot',
        'Avito Agent',
        'welcome-agent',
        'business-analysis-agent',
        'funnel-designer-agent',
        'agent-orchestrator-agent',
        'workflow-generator-agent',
        'team-assignment-agent',
        'testing-optimization-agent'
      ];
      
      // Get the agent from business setup service
      try {
        // Try to resolve workspace from userWorkspaceId and check if any business setup agent
        // matches this agentId
        for (const status of Object.values(BusinessSetupStatus)) {
          if (status === BusinessSetupStatus.COMPLETED) continue;
          
          try {
            const agent = await this.businessSetupAgentService.getAgentForStep(
              status,
              userWorkspaceId
            );
            
            if (agent.id === agentId) {
              return true;
            }
          } catch (error) {
            // Agent for this step doesn't exist, continue
            continue;
          }
        }
      } catch (error) {
        console.error('Failed to check business setup agents:', error);
      }
      
      return false;
      
    } catch (error) {
      console.error('Failed to check if agent is business setup agent:', error);
      return false;
    }
  }

  private async sendWelcomeMessage(
    threadId: string,
    businessSetupStep: BusinessSetupStatus,
  ) {
    console.log('Sending welcome message for business setup step:', businessSetupStep);
    
    const welcomeMessages: Record<BusinessSetupStatus, string> = {
      [BusinessSetupStatus.WELCOME]: `🤖 **Привет! Я SGR Avito Integration Assistant**

**Моя задача:** Помочь вам настроить интеграцию с Avito для автоматизации вашего бизнеса.

**Мои инструменты и возможности:**
🔧 **Извлечение учетных данных** - безопасно извлекаю CLIENT_ID и CLIENT_SECRET из ваших сообщений
🔐 **Валидация API** - проверяю подлинность ваших Avito API ключей
📋 **Пошаговая настройка** - веду вас через весь процесс интеграции
🔄 **SGR Processing** - использую Schema-Guided Reasoning для точной обработки
📊 **Анализ данных** - помогаю понять структуру ваших Avito данных

**Что мне нужно от вас:**
Предоставьте ваши Avito API учетные данные:
- CLIENT_ID (идентификатор клиента)
- CLIENT_SECRET (секретный ключ)

Я обработаю их безопасно и настрою интеграцию для вашего CRM.

**Готовы начать? Отправьте мне ваши учетные данные Avito API!** 🚀`,
      
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: `🚀 **Время анализировать ваш бизнес!**

Привет! Я специалист по бизнес-анализу. Моя задача - помочь вам глубоко понять ваш бизнес и найти возможности для оптимизации.

**Что мы сделаем:**
📊 Проанализируем вашу отрасль и рынок
🎯 Определим целевую аудиторию
💼 Изучим бизнес-модель
📈 Найдем точки роста
🔍 Подготовим данные для создания воронки

Давайте начнем с основ - расскажите мне о своем бизнесе!`,
      
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: `🎯 **Создаем идеальную воронку продаж!**

Здравствуйте! Я дизайнер воронок продаж. На основе анализа вашего бизнеса мы создадим высокоэффективную систему конверсии.

**Мы спроектируем:**
🎪 Этапы воронки и точки касания
🔄 Логику автоматизации
📝 Сценарии взаимодействия
📊 Метрики и KPI
🎨 Пользовательский опыт

Готовы создать воронку, которая будет работать на автопилоте?`,
      
      [BusinessSetupStatus.AGENT_SETUP]: `🤖 **Настраиваем вашу команду AI-агентов!**

Привет! Я оркестратор AI-агентов. Теперь мы создадим специализированную команду агентов для автоматизации вашего бизнеса.

**Настроим:**
👥 Роли и ответственности агентов
🔄 Процессы передачи между агентами
⚙️ Параметры производительности
🎯 Специализацию по задачам
🤝 Интеграцию с рабочими процессами

Давайте создадим эффективную команду AI-агентов!`,
      
      [BusinessSetupStatus.WORKFLOW_CREATION]: `⚡ **Создаем автоматизированные рабочие процессы!**

Здравствуйте! Я генератор рабочих процессов. На основе вашей воронки и настроенных агентов мы создадим полную автоматизацию.

**Создадим:**
🔧 Автоматические процессы
⏰ Триггеры и условия
📋 Шаблоны задач
📊 Мониторинг процессов
🔄 Оптимизацию потоков

Готовы автоматизировать ваш бизнес?`,
      
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: `👥 **Организуем вашу команду!**

Привет! Я специалист по управлению командами. Теперь мы настроим роли, доступы и распределим ответственности.

**Настроим:**
🎭 Роли и права доступа
📋 Зоны ответственности
🤝 Структуру сотрудничества
🔐 Безопасность и разрешения
📊 Подготовку к тестированию

Давайте оптимизируем работу вашей команды!`,
      
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: `🧪 **Тестируем и оптимизируем систему!**

Здравствуйте! Я специалист по тестированию и оптимизации. Финальный этап - убедимся, что все работает идеально!

**Проверим:**
✅ Функциональность всех компонентов
📊 Производительность системы
🔍 Возможности для улучшения
📈 Метрики эффективности
🎯 Готовность к работе

Давайте убедимся, что ваша система работает безупречно!`,
      
      [BusinessSetupStatus.COMPLETED]: `✅ **Поздравляем! Настройка завершена!**

Ваша бизнес-система полностью настроена и готова к работе! 🎉

Теперь вы можете пользоваться всеми возможностями автоматизации. Если нужна помощь - обращайтесь!`
    };

    const welcomeContent = welcomeMessages[businessSetupStep] || welcomeMessages[BusinessSetupStatus.WELCOME];

    console.log('Sending welcome content:', welcomeContent.substring(0, 100) + '...');

    // Create and save welcome message from assistant
    const welcomeMessage = this.messageRepository.create({
      threadId,
      role: 'assistant' as AgentChatMessageRole,
      content: welcomeContent,
    });

    await this.messageRepository.save(welcomeMessage);
    
    // Emit event for real-time UI updates and GraphQL subscriptions
    this.eventEmitter.emit('ai-agent.welcome.greeting-sent', {
      threadId,
      messageId: welcomeMessage.id,
      greetingMessage: welcomeContent,
      businessSetupStep,
      timestamp: new Date()
    });
  }
}
