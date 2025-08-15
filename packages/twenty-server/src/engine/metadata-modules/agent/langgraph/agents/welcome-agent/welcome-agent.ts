import { Injectable } from '@nestjs/common';
import { AgentContext, ILangGraphAgent } from '../../types/langgraph-agent.types';

// Local type definitions
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentState {
  workflowStep: number;
  context: Record<string, any>;
  metadata: {
    lastUpdated: Date;
    version: string;
    checksum: string;
  };
}

interface AgentExecutionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

@Injectable()
export class WelcomeAgent implements ILangGraphAgent {
  private readonly tools: any[] = [
    {
      name: 'get_user_info',
      description: 'Получить информацию о пользователе',
      func: async () => {
        return "Пользователь Twenty";
      },
    },
    {
      name: 'get_workspace_info',
      description: 'Получить информацию о рабочем пространстве',
      func: async () => {
        return "Twenty CRM - современная CRM система";
      },
    },
  ];

  private readonly stateSchema = {
    type: 'object',
    properties: {
      workflowStep: { type: 'number' },
      userInfo: { type: 'object' },
      workspaceInfo: { type: 'object' },
      onboardingProgress: { type: 'object' },
    },
  };

  private readonly systemPrompt = `Вы - приветственный агент Twenty CRM. Ваша задача:

1. Поприветствовать новых пользователей
2. Объяснить основные возможности системы
3. Помочь с первыми шагами
4. Ответить на вопросы о функциональности

Будьте дружелюбны, полезны и информативны. Используйте доступные инструменты для получения информации о пользователе и рабочем пространстве.`;

  async execute(
    messages: AgentMessage[],
    context: AgentContext,
    currentState?: AgentState,
  ): Promise<AgentExecutionResult & { state: AgentState }> {
    try {
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage.content;
      
      // Simple response generation based on message content
      const response = await this.generateResponse(content, currentState);
      
      // Calculate token usage (simplified)
      const usage = {
        totalTokens: content.length + response.length,
        promptTokens: content.length,
        completionTokens: response.length,
      };
      
      // Update state
      const newState: AgentState = {
        workflowStep: (currentState?.workflowStep || 0) + 1,
        context: {
          ...(currentState?.context || {}),
          lastMessage: response,
          messageCount: (currentState?.context?.messageCount || 0) + 1,
          lastUserMessage: content,
        },
        metadata: {
          lastUpdated: new Date(),
          version: '1.0.0',
          checksum: this.generateChecksum(response),
        },
      };
      
      return {
        content: response,
        usage,
        metadata: {
          processingTime: Date.now(),
          agentType: 'welcome',
        },
        state: newState,
      };
    } catch (error) {
      console.error('Error in WelcomeAgent execute:', error);
      return {
        content: "Извините, произошла ошибка. Попробуйте еще раз.",
        usage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
        metadata: {
          isFallback: true,
          fallbackReason: 'execution_error',
        },
        state: currentState || this.createDefaultState(),
      };
    }
  }

  getTools(): any[] {
    return this.tools;
  }

  getStateSchema(): object {
    return this.stateSchema;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  private async generateResponse(userMessage: string, currentState?: AgentState): Promise<string> {
    const lowerMessage = userMessage.toLowerCase();
    const step = currentState?.workflowStep || 1;

    // Simple response logic based on workflow step and message content
    if (step === 1) {
      return `Добро пожаловать в Twenty CRM! 🎉

Я ваш персональный помощник, который поможет вам освоить нашу CRM систему. 

Twenty CRM - это современная платформа для управления отношениями с клиентами, которая поможет вам:
• Организовать контакты и компании
• Отслеживать сделки и возможности
• Автоматизировать рабочие процессы
• Получать аналитику и отчеты

С чего бы вы хотели начать? Могу показать вам основные функции или ответить на ваши вопросы.`;
    }

    if (lowerMessage.includes('привет') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return `Привет! Рад вас видеть в Twenty CRM! 

Как я могу помочь вам сегодня? Могу рассказать о возможностях системы или помочь с настройкой.`;
    }

    if (lowerMessage.includes('функции') || lowerMessage.includes('возможности') || lowerMessage.includes('features')) {
      return `Отличный вопрос! Вот основные возможности Twenty CRM:

🔹 **Управление контактами**
- Создание и организация контактов
- История взаимодействий
- Кастомные поля

🔹 **Управление компаниями**
- База данных компаний
- Иерархия организаций
- Отслеживание возможностей

🔹 **Сделки и воронка продаж**
- Создание сделок
- Отслеживание стадий
- Прогнозирование доходов

🔹 **Автоматизация**
- Рабочие процессы
- Email кампании
- Интеграции

🔹 **Аналитика**
- Дашборды
- Отчеты
- Метрики производительности

Что из этого вас больше всего интересует?`;
    }

    if (lowerMessage.includes('настройка') || lowerMessage.includes('setup') || lowerMessage.includes('начать')) {
      return `Отлично! Давайте настроим вашу CRM. Вот пошаговый план:

1️⃣ **Импорт данных**
   - Загрузите ваши контакты и компании
   - Поддерживаются CSV, Excel файлы

2️⃣ **Настройка полей**
   - Создайте кастомные поля под ваши нужды
   - Настройте типы данных

3️⃣ **Создание рабочих процессов**
   - Настройте автоматизацию
   - Создайте этапы воронки продаж

4️⃣ **Интеграции**
   - Подключите email
   - Настройте календарь
   - Интегрируйте с другими сервисами

Хотите начать с импорта данных или сначала изучить интерфейс?`;
    }

    if (lowerMessage.includes('помощь') || lowerMessage.includes('help') || lowerMessage.includes('поддержка')) {
      return `Конечно! Вот как получить помощь:

📚 **Документация**
- Подробные руководства по всем функциям
- Видео-уроки
- FAQ

💬 **Поддержка**
- Встроенный чат поддержки
- Email поддержка
- Телефонная поддержка

🎓 **Обучение**
- Вебинары
- Персональные демо
- Обучающие материалы

Что именно вас интересует? Могу показать конкретные разделы документации или связать с поддержкой.`;
    }

    // Default response
    return `Спасибо за ваш вопрос! 

Я здесь, чтобы помочь вам освоить Twenty CRM. Можете спрашивать о любых функциях, настройках или возможностях системы.

Если у вас есть конкретные задачи или проблемы, расскажите о них, и я помогу найти решение!`;
  }

  private generateChecksum(content: string): string {
    // Simple checksum generation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private createDefaultState(): AgentState {
    return {
      workflowStep: 1,
      context: {
        messageCount: 0,
        onboardingStarted: new Date().toISOString(),
      },
      metadata: {
        lastUpdated: new Date(),
        version: '1.0.0',
        checksum: '',
      },
    };
  }
}
