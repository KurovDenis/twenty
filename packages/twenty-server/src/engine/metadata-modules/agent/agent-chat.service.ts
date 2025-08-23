import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

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

    // Send automatic welcome message for business setup agents
    if (isBusinessSetupAgent && businessSetupStep) {
      await this.sendWelcomeMessage(savedThread.id, businessSetupStep);
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

  private async sendWelcomeMessage(
    threadId: string,
    businessSetupStep: BusinessSetupStatus,
  ) {
    const welcomeMessages: Record<BusinessSetupStatus, string> = {
      [BusinessSetupStatus.WELCOME]: `🎉 **Добро пожаловать в Business Setup Wizard!** 

Привет! Я ваш Welcome AI-ассистент, и я здесь, чтобы помочь вам создать полностью автоматизированную бизнес-систему.

**Что мы будем делать вместе:**
🚀 Анализ вашего бизнеса и процессов
🎯 Дизайн эффективных воронок продаж
🤖 Настройка специализированных AI-агентов
⚡ Создание автоматизированных рабочих процессов
👥 Назначение команды и ролей
🧪 Тестирование и оптимизация системы

**Готовы начать?** Расскажите мне о своем бизнесе, и мы создадим для вас идеальную автоматизированную систему!`,
      
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

    // Create and save welcome message from assistant
    const welcomeMessage = this.messageRepository.create({
      threadId,
      role: 'assistant' as AgentChatMessageRole,
      content: welcomeContent,
    });

    await this.messageRepository.save(welcomeMessage);
  }
}
