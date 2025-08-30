import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { BusinessSetupStatus } from 'src/engine/core-modules/business-setup/enums/business-setup-status.enum';
import { BusinessSetupAgentService } from 'src/engine/core-modules/business-setup/services/business-setup-agent.service';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
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

  // REMOVED: createThreadWithBusinessSetupContext method - OBSOLETE
  // This method was the old approach that created specialized agents directly
  // Now replaced by createThreadWithSupervisorAgent which provides intelligent routing
  // All business setup now goes through supervisor agents for proper routing

  /**
   * Create thread with supervisor agent for business setup routing
   */
  async createThreadWithSupervisorAgent(userWorkspaceId: string) {
    try {
      // Get the supervisor agent for this workspace
      const supervisorAgent =
        await this.businessSetupAgentService.getSupervisorAgent(
          userWorkspaceId,
        );

      const thread = this.threadRepository.create({
        agentId: supervisorAgent.id,
        userWorkspaceId,
      });

      const savedThread = await this.threadRepository.save(thread);

      // Send supervisor welcome message
      try {
        await this.sendSupervisorWelcomeMessage(savedThread.id);

        // Emit event for real-time UI updates
        this.eventEmitter.emit('ai-agent.welcome.chat-created', {
          threadId: savedThread.id,
          agentId: supervisorAgent.id,
          businessSetupStep: 'SUPERVISOR',
          userWorkspaceId,
          aiResponse: 'Supervisor welcome message sent',
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Failed to send supervisor welcome message:`, error);
      }

      return savedThread;
    } catch (error) {
      console.error('Failed to create thread with supervisor agent:', error);
      throw error;
    }
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
  private async checkAndEmitBusinessSetupEvent(
    threadId: string,
    content: string,
  ) {
    try {
      const thread = await this.threadRepository.findOne({
        where: { id: threadId },
        relations: ['agent', 'userWorkspace'], // ✅ ADD userWorkspace relation
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
      const isBusinessSetupThread = await this.isBusinessSetupThread(
        thread.agentId,
        thread.userWorkspaceId,
      );

      if (isBusinessSetupThread) {
        // Check if this is a supervisor agent
        const isSupervisor =
          await this.businessSetupAgentService.isSupervisorAgent(
            thread.agentId,
            thread.userWorkspace.workspaceId,
          );

        if (isSupervisor) {
          // Emit supervisor routing event
          this.eventEmitter.emit('business-setup.route-message', {
            userId: thread.userWorkspace.userId,
            workspaceId: thread.userWorkspace.workspaceId,
            threadId,
            message: content,
            timestamp: new Date(),
          });
        } else {
          // Emit regular business setup event
          this.eventEmitter.emit('ai-agent.welcome.user-message-received', {
            userId: thread.userWorkspace.userId, // ✅ CORRECT: Real userId from UserWorkspace
            workspaceId: thread.userWorkspace.workspaceId, // ✅ CORRECT: Real workspaceId from UserWorkspace
            threadId,
            message: content,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Failed to check business setup thread:', error);
    }
  }

  // Check if agent is a business setup agent
  private async isBusinessSetupThread(
    agentId: string,
    userWorkspaceId: string,
  ): Promise<boolean> {
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
        'testing-optimization-agent',
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
              userWorkspaceId,
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
    console.log(
      'Sending welcome message for business setup step:',
      businessSetupStep,
    );

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

Теперь вы можете пользоваться всеми возможностями автоматизации. Если нужна помощь - обращайтесь!`,
    };

    const welcomeContent =
      welcomeMessages[businessSetupStep] ||
      welcomeMessages[BusinessSetupStatus.WELCOME];

    console.log(
      'Sending welcome content:',
      welcomeContent.substring(0, 100) + '...',
    );

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
      timestamp: new Date(),
    });
  }

  /**
   * Send supervisor welcome message with automatic status check
   */
  private async sendSupervisorWelcomeMessage(threadId: string) {
    console.log('Sending supervisor welcome message for thread:', threadId);

    const supervisorWelcomeContent = `🎯 **Welcome to Business Setup Assistant!**

I'm your **Business Setup Supervisor** - an intelligent routing agent that will help guide you through the complete business automation setup process.

**How I work:**
🧠 **Smart Analysis** - I analyze your requests and understand where you are in the setup process
🎯 **Intelligent Routing** - I route your questions to the right specialized agent for your current stage
📊 **Progress Tracking** - I monitor your progress and help you move through each setup stage
💡 **Transparent Reasoning** - I show you my thinking process so you understand why I'm routing you to specific agents

**Business Setup Stages:**
1. **🔑 WELCOME** - Avito API credential setup and validation
2. **📊 BUSINESS ANALYSIS** - Understanding your business model and requirements
3. **🎯 SALES FUNNEL DESIGN** - Creating optimized customer acquisition funnels
4. **🤖 AGENT SETUP** - Configuring your AI agent team
5. **⚡ WORKFLOW CREATION** - Building automated business processes
6. **👥 TEAM ASSIGNMENT** - Organizing roles and responsibilities
7. **🧪 TESTING & OPTIMIZATION** - Final testing and performance optimization

**What you can ask me:**
- "What's my current setup status?"
- "Help me set up my Avito credentials"
- "I need help designing my sales funnel"
- "What's the next step in my business setup?"
- "I have a question about team assignments"

**Ready to get started?** Just tell me what you need help with, and I'll route you to the perfect specialist or handle it myself if it's a general question!

*I'm here to make your business setup journey smooth and efficient.* 🚀`;

    console.log(
      'Sending supervisor welcome content:',
      supervisorWelcomeContent.substring(0, 100) + '...',
    );

    // Create and save welcome message from assistant
    const welcomeMessage = this.messageRepository.create({
      threadId,
      role: 'assistant' as AgentChatMessageRole,
      content: supervisorWelcomeContent,
    });

    await this.messageRepository.save(welcomeMessage);

    // Emit event for real-time UI updates and GraphQL subscriptions
    this.eventEmitter.emit('ai-agent.welcome.greeting-sent', {
      threadId,
      messageId: welcomeMessage.id,
      greetingMessage: supervisorWelcomeContent,
      businessSetupStep: 'SUPERVISOR',
      timestamp: new Date(),
    });

    // 🚀 AUTO STATUS CHECK: Send automatic system message to determine user status
    // This triggers the supervisor SGR workflow to check status and route appropriately
    console.log('Triggering automatic status check for thread:', threadId);
    
    // Wait a moment for welcome message to be processed
    setTimeout(async () => {
      try {
        await this.triggerAutomaticStatusCheck(threadId);
      } catch (error) {
        console.error('Failed to trigger automatic status check:', error);
      }
    }, 1000); // 1 second delay
  }

  /**
   * Trigger automatic status check by sending system message to supervisor
   * This activates the supervisor SGR workflow to determine user status and route appropriately
   */
  private async triggerAutomaticStatusCheck(threadId: string): Promise<void> {
    console.log('Executing automatic status check for thread:', threadId);

    // Get the thread to extract user and workspace info
    const thread = await this.threadRepository.findOne({
      where: { id: threadId },
      relations: ['userWorkspace'],
    });

    if (!thread || !thread.userWorkspace) {
      console.error('Thread or userWorkspace not found for automatic status check');
      return;
    }

    // Create system message for automatic status check
    const automaticStatusMessage = this.messageRepository.create({
      threadId,
      role: 'user' as AgentChatMessageRole,
      content: '🔍 Определи мой текущий статус в бизнес-настройке и перенаправь меня к соответствующему агенту для следующего шага. Мне нужно узнать, где я нахожусь в процессе настройки.',
    });

    await this.messageRepository.save(automaticStatusMessage);

    console.log('Auto status check message saved, triggering supervisor routing...');

    // Trigger supervisor routing for the automatic status check
    this.eventEmitter.emit('business-setup.route-message', {
      userId: thread.userWorkspace.userId,
      workspaceId: thread.userWorkspace.workspaceId,
      threadId,
      message: automaticStatusMessage.content,
      timestamp: new Date(),
    });

    console.log('Automatic status check routing triggered successfully');
  }
}
