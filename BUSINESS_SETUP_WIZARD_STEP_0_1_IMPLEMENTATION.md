# Business Setup Wizard - Шаг 0.1: Интеграция OpenRouter API

## 📋 Обзор

Этот документ содержит полный план реализации **Шага 0.1: Интеграция OpenRouter API** для Business Setup Wizard. Цель - интегрировать OpenRouter API в существующую AI систему Twenty CRM для создания специализированного Business Setup агента.

## 🎯 Цель

Интегрировать OpenRouter API в существующую AI систему Twenty CRM для создания специализированного Business Setup агента, который будет работать на первом шаге Business Setup Wizard с доступом к множеству AI моделей через единый API endpoint.

## 🔍 Анализ текущей архитектуры

### **Существующая AI система Twenty CRM:**

#### **1. AiService**
- Основной сервис для работы с AI моделями
- Поддержка streaming ответов
- Интеграция с AiModelRegistryService

#### **2. AiModelRegistryService**
- Управление реестром AI моделей
- Динамическая регистрация моделей
- Поддержка OpenAI, Anthropic, OpenAI-compatible провайдеров

#### **3. Поддерживаемые провайдеры**
```typescript
export enum ModelProvider {
  NONE = 'none',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENAI_COMPATIBLE = 'open_ai_compatible',
}
```

#### **4. Конфигурация**
- Через environment variables
- TwentyConfigService для управления
- Поддержка database и environment drivers

### **Текущая интеграция Business Setup:**

#### **1. useBusinessSetupAIChat**
- Хук для открытия AI чата
- Базовая интеграция с существующей AI системой

#### **2. openAskAIPage**
- Функция для открытия AI страницы
- Интеграция с командным меню

#### **3. FloatingAIChatButton**
- Кнопка для запуска AI чата
- Условная логика для Business Setup режима

## 🚀 План реализации

### **Этап 1: Backend интеграция OpenRouter (2-3 дня)**

#### **1.1 Создать OpenRouter провайдер**

**Файл:** `packages/twenty-server/src/engine/core-modules/ai/providers/openrouter.provider.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { type LanguageModel } from 'ai';

export interface OpenRouterModelConfig {
  modelId: string;
  label: string;
  provider: 'openrouter';
  inputCostPer1kTokensInCents: number;
  outputCostPer1kTokensInCents: number;
  openRouterModelName: string; // например: 'openai/gpt-4o'
}

@Injectable()
export class OpenRouterProvider {
  private createOpenRouterClient(apiKey: string) {
    return createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://twenty.com',
        'X-Title': process.env.OPENROUTER_X_TITLE || 'Twenty CRM',
      },
    });
  }

  createModel(config: OpenRouterModelConfig): LanguageModel {
    const client = this.createOpenRouterClient(process.env.OPENROUTER_API_KEY!);
    return client(config.openRouterModelName);
  }
}
```

#### **1.2 Расширить ModelProvider enum**

**Файл:** `packages/twenty-server/src/engine/core-modules/ai/constants/ai-models.const.ts`

```typescript
export enum ModelProvider {
  NONE = 'none',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  OPENAI_COMPATIBLE = 'open_ai_compatible',
  OPENROUTER = 'openrouter', // ✅ ДОБАВЛЕНО
}

// Добавить OpenRouter модели
export const OPENROUTER_MODELS: OpenRouterModelConfig[] = [
  {
    modelId: 'openrouter-gemini-2.5-flash',
    label: 'OpenRouter Gemini 2.5 Flash',
    provider: 'openrouter',
    inputCostPer1kTokensInCents: 0.075,  // Очень экономичная модель
    outputCostPer1kTokensInCents: 0.3,    // Дешевле GPT-4o в 3-4 раза
    openRouterModelName: 'google/gemini-2.5-flash',
  },
  // Fallback модели для критических случаев
  {
    modelId: 'openrouter-gpt-4o',
    label: 'OpenRouter GPT-4o',
    provider: 'openrouter',
    inputCostPer1kTokensInCents: 0.25,
    outputCostPer1kTokensInCents: 1.0,
    openRouterModelName: 'openai/gpt-4o',
  },
  {
    modelId: 'openrouter-claude-opus',
    label: 'OpenRouter Claude Opus',
    provider: 'openrouter',
    inputCostPer1kTokensInCents: 1.5,
    outputCostPer1kTokensInCents: 7.5,
    openRouterModelName: 'anthropic/claude-3-opus-20240229',
  },
];
```

#### **1.3 Модифицировать AiModelRegistryService**

**Файл:** `packages/twenty-server/src/engine/core-modules/ai/services/ai-model-registry.service.ts`

```typescript
export class AiModelRegistryService {
  constructor(
    private twentyConfigService: TwentyConfigService,
    private openRouterProvider: OpenRouterProvider, // ✅ ДОБАВЛЕНО
  ) {
    this.buildModelRegistry();
  }

  private buildModelRegistry(): void {
    // ... существующий код ...

    // ✅ ДОБАВЛЕНО: OpenRouter интеграция
    const openRouterApiKey = this.twentyConfigService.get('OPENROUTER_API_KEY');
    if (openRouterApiKey) {
      this.registerOpenRouterModels();
    }
  }

  private registerOpenRouterModels(): void {
    OPENROUTER_MODELS.forEach((modelConfig) => {
      this.modelRegistry.set(modelConfig.modelId, {
        modelId: modelConfig.modelId,
        provider: ModelProvider.OPENROUTER,
        model: this.openRouterProvider.createModel(modelConfig),
      });
    });
  }
}
```

#### **1.4 Добавить environment variables**

**Файл:** `packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts`

```typescript
export class ConfigVariables {
  // ... существующий код ...

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'OpenRouter API key for accessing multiple AI models',
    type: ConfigVariableType.STRING,
    isSensitive: true,
  })
  OPENROUTER_API_KEY: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'HTTP Referer for OpenRouter (your site URL)',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_HTTP_REFERER: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'Site title for OpenRouter rankings',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_X_TITLE: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'Default OpenRouter model for Business Setup (Gemini 2.5 Flash)',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_DEFAULT_MODEL: string = 'openrouter-gemini-2.5-flash';
}
```

### **Этап 2: Business Setup AI Agent (2-3 дня)**

#### **2.1 Создать BusinessSetupAIService**

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/services/business-setup-ai.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/services/ai.service';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';
import { type CoreMessage } from 'ai';

export interface BusinessSetupContext {
  step: BusinessSetupStatus;
  userResponses: Record<string, string>;
  workspaceId: string;
  userId: string;
}

export interface BusinessSetupAIResponse {
  message: string;
  nextStep: BusinessSetupStatus;
  extractedData: Record<string, string>;
  shouldProceedToAnalysis: boolean;
}

@Injectable()
export class BusinessSetupAIService {
  private readonly logger = new Logger(BusinessSetupAIService.name);

  constructor(private readonly aiService: AiService) {}

  async processBusinessSetupChat(
    userMessage: string,
    context: BusinessSetupContext,
  ): Promise<BusinessSetupAIResponse> {
    try {
      // Создаем системный промпт для Business Setup агента
      const systemPrompt = this.createSystemPrompt(context.step);
      
      // Формируем сообщения для AI
      const messages: CoreMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ];

      // Добавляем контекст предыдущих ответов
      if (Object.keys(context.userResponses).length > 0) {
        const contextMessage = `Previous responses: ${JSON.stringify(context.userResponses)}`;
        messages.push({ role: 'assistant', content: contextMessage });
      }

      // ✅ ИСПОЛЬЗУЕМ GEMINI 2.5 FLASH - ОПТИМИЗИРОВАННАЯ МОДЕЛЬ ДЛЯ BUSINESS SETUP
      const result = await this.aiService.streamText(messages, {
        modelId: 'openrouter-gemini-2.5-flash', // Оптимизированная модель для Business Setup
        temperature: 0.7,
        maxTokens: 800, // Оптимальная длина для Gemini 2.5 Flash
      });

      // Обрабатываем результат
      const aiResponse = await this.processAIResponse(result, context);
      
      return aiResponse;
    } catch (error) {
      this.logger.error('Error processing Business Setup AI chat:', error);
      throw error;
    }
  }

  private createSystemPrompt(step: BusinessSetupStatus): string {
    const basePrompt = `You are a Business Setup AI assistant for Twenty CRM powered by Google Gemini 2.5 Flash. Your role is to help users set up their business automation system.

Current step: ${step}

Your responses should be:
1. Helpful and encouraging
2. Focused on gathering specific information
3. Clear about next steps
4. Professional but friendly
5. Concise and actionable (Gemini 2.5 Flash excels at this)

Always extract relevant business information from user responses and suggest the next logical step.`;

    switch (step) {
      case 'WELCOME':
        return `${basePrompt}

In the WELCOME step, you should:
- Welcome the user warmly
- Explain what will be accomplished
- Ask about their business type and industry
- Motivate them to start the journey
- Keep responses under 80 words (Gemini 2.5 Flash is very concise)

Extract: business_type, industry, motivation_level`;
      
      case 'BUSINESS_ANALYSIS':
        return `${basePrompt}

In the BUSINESS_ANALYSIS step, you should:
- Ask about business size and structure
- Understand their target market
- Identify key pain points
- Suggest optimization opportunities
- Prepare them for funnel design
- Use Gemini 2.5 Flash's business analysis capabilities

Extract: business_size, target_market, pain_points, optimization_areas`;
      
      default:
        return basePrompt;
    }
  }

  private async processAIResponse(
    result: any,
    context: BusinessSetupContext,
  ): Promise<BusinessSetupAIResponse> {
    // Обрабатываем AI ответ и определяем следующий шаг
    const aiMessage = result.choices[0]?.message?.content || '';
    
    // Анализируем ответ для извлечения данных
    const extractedData = this.extractBusinessData(aiMessage, context.step);
    
    // Определяем следующий шаг
    const nextStep = this.determineNextStep(context.step, extractedData);
    
    return {
      message: aiMessage,
      nextStep,
      extractedData,
      shouldProceedToAnalysis: nextStep === 'BUSINESS_ANALYSIS',
    };
  }

  private extractBusinessData(message: string, step: BusinessSetupStatus): Record<string, string> {
    // Логика извлечения структурированных данных из AI ответа
    const extractedData: Record<string, string> = {};
    
    // Простое извлечение данных (можно улучшить с помощью AI parsing)
    if (step === 'WELCOME') {
      if (message.toLowerCase().includes('b2b')) extractedData.business_type = 'B2B';
      if (message.toLowerCase().includes('b2c')) extractedData.business_type = 'B2C';
      if (message.toLowerCase().includes('saas')) extractedData.business_type = 'SaaS';
    }
    
    return extractedData;
  }

  private determineNextStep(
    currentStep: BusinessSetupStatus,
    extractedData: Record<string, string>,
  ): BusinessSetupStatus {
    // Логика определения следующего шага на основе извлеченных данных
    switch (currentStep) {
      case 'WELCOME':
        if (extractedData.business_type && extractedData.industry) {
          return 'BUSINESS_ANALYSIS';
        }
        return 'WELCOME'; // Остаемся на том же шаге
        
      case 'BUSINESS_ANALYSIS':
        if (extractedData.target_market && extractedData.pain_points) {
          return 'SALES_FUNNEL_DESIGN';
        }
        return 'BUSINESS_ANALYSIS';
        
      default:
        return currentStep;
    }
  }
}
```

#### **2.2 Создать BusinessSetupAIResolver**

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup-ai.resolver.ts`

```typescript
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { BusinessSetupAIService } from './services/business-setup-ai.service';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

@Resolver()
@UseGuards(JwtAuthGuard)
export class BusinessSetupAIResolver {
  constructor(private readonly businessSetupAIService: BusinessSetupAIService) {}

  @Mutation(() => String)
  async processBusinessSetupChat(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Args('message') message: string,
    @Args('step') step: string,
    @Args('context') context: Record<string, any>,
  ): Promise<string> {
    const businessSetupContext = {
      step,
      userResponses: context.userResponses || {},
      workspaceId: workspace.id,
      userId: user.id,
    };

    const result = await this.businessSetupAIService.processBusinessSetupChat(
      message,
      businessSetupContext,
    );

    return result.message;
  }
}
```

### **Этап 3: Frontend интеграция (2-3 дня)**

#### **3.1 Модифицировать useBusinessSetupAIChat**

**Файл:** `packages/twenty-front/src/modules/business-setup/hooks/useBusinessSetupAIChat.ts`

```typescript
import { useOpenAskAIPageInCommandMenu } from '@/command-menu/hooks/useOpenAskAIPageInCommandMenu';
import { useBusinessSetupStatus } from './useBusinessSetupStatus';
import { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client';
import { PROCESS_BUSINESS_SETUP_CHAT } from '../graphql/mutations';

export const useBusinessSetupAIChat = () => {
  const { openAskAIPage } = useOpenAskAIPageInCommandMenu();
  const businessSetupStatus = useBusinessSetupStatus();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [processBusinessSetupChat] = useMutation(PROCESS_BUSINESS_SETUP_CHAT);

  const openBusinessSetupChat = useCallback(async () => {
    try {
      setIsProcessing(true);
      
      // Открываем AI чат с OpenRouter интеграцией
      const initialMessage = await getOpenRouterResponse(
        "Настройка системы",
        'WELCOME'
      );
      
      openAskAIPage(initialMessage);
    } catch (error) {
      console.error('Failed to open Business Setup AI chat:', error);
      // Fallback - обычный AI чат
      openAskAIPage("Настройка системы");
    } finally {
      setIsProcessing(false);
    }
  }, [openAskAIPage, processBusinessSetupChat]);

  const getOpenRouterResponse = async (message: string, step: string): Promise<string> => {
    try {
      const response = await processBusinessSetupChat({
        variables: {
          message,
          step,
          context: {
            userResponses: {},
            step: 'WELCOME',
          },
        },
      });
      
      return response.data?.processBusinessSetupChat || message;
    } catch (error) {
      console.error('OpenRouter API error:', error);
      return message; // Возвращаем исходное сообщение при ошибке
    }
  };

  return {
    openBusinessSetupChat,
    isProcessing,
  };
};
```

#### **3.2 Создать GraphQL mutation**

**Файл:** `packages/twenty-front/src/modules/business-setup/graphql/mutations.ts`

```typescript
import { gql } from '@apollo/client';

export const PROCESS_BUSINESS_SETUP_CHAT = gql`
  mutation ProcessBusinessSetupChat($message: String!, $step: String!, $context: JSON!) {
    processBusinessSetupChat(message: $message, step: $step, context: $context)
  }
`;
```

### **Этап 4: Конфигурация и развертывание (1 день)**

#### **4.1 Environment variables**

```bash
# .env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_HTTP_REFERER=https://yourdomain.com
OPENROUTER_X_TITLE=Twenty CRM
OPENROUTER_DEFAULT_MODEL=openrouter-gemini-2.5-flash
```

#### **4.2 Docker configuration**

```yaml
# docker-compose.yml
services:
  server:
    environment:
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      OPENROUTER_HTTP_REFERER: ${OPENROUTER_HTTP_REFERER}
      OPENROUTER_X_TITLE: ${OPENROUTER_X_TITLE}
      OPENROUTER_DEFAULT_MODEL: ${OPENROUTER_DEFAULT_MODEL}
```

## 🎯 Ключевые преимущества OpenRouter интеграции с Gemini 2.5 Flash

### **1. Доступ к множеству AI моделей**
- **Google**: Gemini 2.5 Flash (основная модель для Business Setup)
- **OpenAI**: GPT-4o, GPT-4o Mini, GPT-4 Turbo (fallback)
- **Anthropic**: Claude Opus, Claude Sonnet, Claude Haiku
- **Meta**: Llama 3.1, Code Llama
- **Mistral**: Mixtral, Mistral 7B

### **2. Автоматический fallback и оптимизация стоимости**
- **Gemini 2.5 Flash** как основная модель (в 3-4 раза дешевле GPT-4o)
- OpenRouter автоматически выбирает наиболее эффективную модель
- Fallback на доступные модели при недоступности
- Оптимизация стоимости на основе требований

### **3. Единый API endpoint**
- Один API ключ для всех моделей
- Упрощенная интеграция
- Централизованное управление

## 🚀 **Преимущества Gemini 2.5 Flash для Business Setup**

### **1. Производительность**
- **Быстрые ответы** - оптимизирована для быстрого генерирования
- **Высокая точность** - отличные результаты для бизнес-аналитики
- **Контекстное понимание** - хорошо понимает бизнес-терминологию

### **2. Стоимость**
- **Экономичная** - значительно дешевле GPT-4o
- **Оптимальное соотношение цена/качество** - идеально для MVP
- **Масштабируемость** - подходит для массового использования

### **3. Специализация**
- **Бизнес-аналитика** - отлично подходит для анализа бизнес-процессов
- **Структурированные данные** - хорошо извлекает бизнес-информацию
- **Многоязычность** - поддержка различных языков

### **4. Сравнение моделей для Business Setup**

| Модель | Стоимость (за сессию) | Скорость | Качество | Рекомендация |
|--------|----------------------|----------|----------|--------------|
| **Gemini 2.5 Flash** | **$2-3** | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ **ЛУЧШИЙ ВЫБОР** |
| GPT-4o | $8-12 | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | Дорого для MVP |
| Claude Haiku | $4-6 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Хорошо, но дороже |
| GPT-4o Mini | $3-5 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | Хорошо, но менее точен |

## 🔑 **Конфигурация API ключа OpenRouter**

### **1. API ключ OpenRouter**
```bash
API_KEY: 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
```

### **2. Где добавить API ключ**

#### **2.1 Локальная разработка (.env.local)**
```bash
# packages/twenty-server/.env.local
OPENROUTER_API_KEY=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
OPENROUTER_HTTP_REFERER=https://twenty.com
OPENROUTER_X_TITLE=Twenty CRM Business Setup
OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash
```

#### **2.2 Production Environment Variables**
```bash
# В production окружении через docker-compose.yml или k8s secrets
OPENROUTER_API_KEY=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
OPENROUTER_HTTP_REFERER=https://your-domain.com
OPENROUTER_X_TITLE=Your CRM Name
OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash
```

#### **2.3 TwentyConfigService (packages/twenty-server/src/engine/core-modules/environment/configs/twenty.config.ts)**
```typescript
export class TwentyConfig {
  // ... существующие переменные ...

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'OpenRouter API key for AI services',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_API_KEY: string;

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'OpenRouter HTTP Referer header',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_HTTP_REFERER: string = 'https://twenty.com';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'OpenRouter X-Title header',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_X_TITLE: string = 'Twenty CRM';

  @ConfigVariablesMetadata({
    group: ConfigVariablesGroup.AI,
    description: 'Default OpenRouter model for Business Setup (Gemini 2.5 Flash)',
    type: ConfigVariableType.STRING,
    isEnvOnly: true,
  })
  OPENROUTER_DEFAULT_MODEL: string = 'google/gemini-2.5-flash';
}
```

#### **2.4 Docker Configuration (packages/twenty-docker/docker-compose.yml)**
```yaml
services:
  server:
    environment:
      - OPENROUTER_API_KEY=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
      - OPENROUTER_HTTP_REFERER=https://twenty.com
      - OPENROUTER_X_TITLE=Twenty CRM
      - OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash
```

#### **2.5 Kubernetes Secrets (packages/twenty-docker/k8s/manifests/)**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: openrouter-secrets
type: Opaque
stringData:
  openrouter-api-key: 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
  openrouter-http-referer: https://twenty.com
  openrouter-x-title: Twenty CRM
  openrouter-default-model: google/gemini-2.5-flash
```

### **3. Безопасность API ключа**

#### **3.1 .gitignore проверка**
```bash
# Убедитесь, что .env.local в .gitignore
echo ".env.local" >> .gitignore
echo "*.env.local" >> .gitignore
```

#### **3.2 Ротация ключей**
```typescript
// Планируйте ротацию ключей каждые 90 дней
export const API_KEY_ROTATION_SCHEDULE = {
  development: '30 days',
  staging: '60 days', 
  production: '90 days'
};
```

#### **3.3 Мониторинг использования**
```typescript
// Мониторинг через OpenRouter dashboard
export const USAGE_MONITORING = {
  dailyLimit: 1000, // requests per day
  monthlyBudget: 50, // USD per month
  alertThreshold: 0.8 // 80% of budget
};
```

## 🔧 Технические детали реализации

### **1. Модель интеграции**
```
User → FloatingAIChatButton → useBusinessSetupAIChat → 
BusinessSetupAIResolver → BusinessSetupAIService → 
AiService → OpenRouterProvider → OpenRouter API (Gemini 2.5 Flash)
```

### **2. Обработка ошибок**
- Fallback на существующие AI модели при недоступности OpenRouter
- Retry логика для временных сбоев
- Graceful degradation

### **3. Мониторинг и аналитика**
- Логирование всех OpenRouter API вызовов
- Метрики использования различных моделей
- Стоимость и производительность

### **4. Оптимизация для Gemini 2.5 Flash**
```typescript
// Настройки для оптимальной стоимости Gemini 2.5 Flash
export const GEMINI_2_5_FLASH_OPTIMIZATION = {
  // Оптимальные параметры для Business Setup
  temperature: 0.7,        // Баланс креативности и точности
  maxTokens: 800,          // Оптимальная длина для Business Setup
  topP: 0.9,              // Высокое качество ответов
  frequencyPenalty: 0.1,  // Минимизация повторений
  
  // Стоимость: ~$0.075 за 1K input tokens, ~$0.3 за 1K output tokens
  // В среднем Business Setup сессия: 2-3$ вместо 8-12$ с GPT-4o
};
```

## 📊 План тестирования

### **1. Unit тесты**

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/services/business-setup-ai.service.spec.ts`

```typescript
describe('BusinessSetupAIService', () => {
  it('should process welcome step correctly', async () => {
    // Тест обработки WELCOME шага
  });

  it('should extract business data from AI response', async () => {
    // Тест извлечения данных
  });

  it('should determine next step based on extracted data', async () => {
    // Тест логики переходов
  });
});
```

### **2. Integration тесты**

**Файл:** `packages/twenty-server/src/engine/core-modules/business-setup/business-setup-ai.resolver.spec.ts`

```typescript
describe('BusinessSetupAIResolver', () => {
  it('should process chat message through OpenRouter', async () => {
    // Тест полной интеграции
  });
});
```

### **3. E2E тесты**

**Файл:** `packages/twenty-e2e-testing/tests/business-setup-openrouter.spec.ts`

```typescript
test('should use OpenRouter for Business Setup AI chat', async ({ page }) => {
  // Тест пользовательского сценария
});
```

## 🚀 Следующие шаги после шага 0.1

### **1. Расширение AI агентов для других шагов**
- Business Analysis Agent (с Gemini 2.5 Flash)
- Sales Funnel Design Agent (с Gemini 2.5 Flash)
- Workflow Creation Agent (с Gemini 2.5 Flash)

### **2. Улучшение извлечения данных**
- AI-powered parsing ответов с Gemini 2.5 Flash
- Структурированные данные
- Валидация информации

### **3. Интеграция с workflow системой**
- Автоматическое создание workflows
- AI-powered оптимизация
- Human-in-the-loop валидация

### **4. Дополнительные оптимизации для Gemini 2.5 Flash**
```typescript
// Оптимизация промптов для Gemini 2.5 Flash
private createOptimizedGeminiPrompt(step: BusinessSetupStatus): string {
  return `You are a Business Setup AI assistant for Twenty CRM.

ROLE: Help users set up business automation
CURRENT STEP: ${step}
MODEL: Google Gemini 2.5 Flash (optimized for business analysis)

RESPONSE FORMAT:
- Welcome message (if applicable)
- Specific questions (2-3 max)
- Next step explanation
- Extracted data summary

CONSTRAINTS:
- Keep responses under 80 words
- Use bullet points for clarity
- Focus on actionable insights
- Extract structured business data`;
}

// Оптимизация извлечения данных с Gemini 2.5 Flash
private async extractBusinessDataWithGemini(
  message: string, 
  step: BusinessSetupStatus
): Promise<Record<string, string>> {
  try {
    // Используем Gemini 2.5 Flash для извлечения данных
    const extractionPrompt = `Extract business information from this message: "${message}"

Step: ${step}
Required fields: ${this.getRequiredFieldsForStep(step)}

Return only JSON format:
{
  "business_type": "B2B/B2C/SaaS",
  "industry": "industry name",
  "size": "small/medium/large",
  "target_market": "description"
}`;

    const extractionResult = await this.aiService.streamText([
      { role: 'user', content: extractionPrompt }
    ], {
      modelId: 'openrouter-gemini-2.5-flash',
      temperature: 0.1, // Низкая температура для точности
      maxTokens: 200,
    });

    // Парсим JSON ответ
    const extractedData = JSON.parse(extractionResult.choices[0]?.message?.content || '{}');
    return extractedData;
  } catch (error) {
    // Fallback на простое извлечение
    return this.extractBusinessData(message, step);
  }
}
```

## 📋 Чек-лист реализации для Gemini 2.5 Flash

### **🔑 Конфигурация API ключа**
- [ ] ✅ **Получен OpenRouter API ключ**: `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`
- [ ] Создать `.env.local` файл с API ключом в `packages/twenty-server/.env.local`
- [ ] Добавить переменные в `TwentyConfigService` (`OPENROUTER_API_KEY`, `OPENROUTER_HTTP_REFERER`, etc.)
- [ ] Проверить `.gitignore` для исключения `.env.local` файлов
- [ ] Настроить production environment variables
- [ ] Настроить Docker и Kubernetes secrets

### **🤖 Интеграция Gemini 2.5 Flash**
- [ ] Создать OpenRouterProvider с Gemini 2.5 Flash
- [ ] Настроить `google/gemini-2.5-flash` как основную модель  
- [ ] Оптимизировать промпты для Gemini 2.5 Flash
- [ ] Настроить извлечение данных с Gemini 2.5 Flash
- [ ] Оптимизировать параметры для стоимости (maxTokens: 800, temperature: 0.7)
- [ ] Протестировать качество ответов Gemini 2.5 Flash
- [ ] Настроить fallback на другие модели (GPT-4o, Claude)

### **🏗️ Backend компоненты**
- [ ] Создать BusinessSetupAIService
- [ ] Создать BusinessSetupAIResolver
- [ ] Модифицировать AiModelRegistryService
- [ ] Расширить ModelProvider enum для OpenRouter

### **⚛️ Frontend компоненты**
- [ ] Модифицировать useBusinessSetupAIChat
- [ ] Обновить FloatingAIChatButton
- [ ] Создать GraphQL mutations для Business Setup AI

### **🧪 Тестирование**
- [ ] Написать unit тесты для OpenRouterProvider
- [ ] Протестировать качество ответов Gemini 2.5 Flash
- [ ] Протестировать fallback механизмы
- [ ] Протестировать интеграцию end-to-end
- [ ] Проверить мониторинг usage и costs

**Общее время реализации: 7-9 дней**

## 🎉 Результат с Gemini 2.5 Flash

После реализации Шага 0.1 у вас будет:

✅ **Полная интеграция OpenRouter API** с Gemini 2.5 Flash как основной моделью  
✅ **Специализированный Business Setup агент** с доступом к множеству AI моделей  
✅ **Оптимальная стоимость** - в 3-4 раза дешевле GPT-4o  
✅ **Высокая производительность** - быстрые ответы для пользователей  
✅ **Отличное качество** - специализация на бизнес-аналитике  
✅ **Масштабируемость** - подходит для массового использования  
✅ **Будущее-ориентированность** - Google активно развивает Gemini  

**Gemini 2.5 Flash - идеальный выбор для Business Setup Wizard MVP!** 🚀✨

## 🚀 **Быстрый старт для разработчика**

### **1. Первые шаги (5 минут)**
```bash
# 1. Создайте .env.local файл
cd packages/twenty-server
echo "OPENROUTER_API_KEY=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" > .env.local
echo "OPENROUTER_HTTP_REFERER=https://twenty.com" >> .env.local
echo "OPENROUTER_X_TITLE=Twenty CRM" >> .env.local
echo "OPENROUTER_DEFAULT_MODEL=google/gemini-2.5-flash" >> .env.local

# 2. Проверьте .gitignore
grep -q ".env.local" ../../.gitignore || echo ".env.local" >> ../../.gitignore

# 3. Перезапустите сервер
npx nx run twenty-server:start
```

### **2. Тестирование API ключа (2 минуты)**
```bash
# Быстрая проверка OpenRouter API
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer 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" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://twenty.com" \
  -H "X-Title: Twenty CRM" \
  -d '{
    "model": "google/gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello, can you help with business setup?"}],
    "max_tokens": 100
  }'
```

### **3. Следующий шаг в разработке**
После успешной проверки API ключа, переходите к:
1. **Создание OpenRouterProvider** (Этап 1.1)
2. **Расширение ModelProvider enum** (Этап 1.2)
3. **Интеграция с TwentyConfigService** (Этап 1.3)

### **4. Мониторинг и отладка**
- **OpenRouter Dashboard**: https://openrouter.ai/activity
- **Usage tracking**: Проверяйте использование ежедневно
- **Cost monitoring**: Устанавливайте лимиты на $50/месяц

---

## 📚 Дополнительные ресурсы

- [OpenRouter API Documentation](https://openrouter.ai/docs) - официальная документация
- [Twenty AI Architecture](../TWENTY_EXISTING_SYSTEM_EXTENSION_PLAN.md) - существующая AI система
- [Business Setup Wizard Plan](../BUSINESS_SETUP_WIZARD_PLAN.md) - общий план реализации
- [AI Integration Examples](../TWENTY_EXISTING_SYSTEM_EXTENSION_PLAN.md) - примеры интеграции
