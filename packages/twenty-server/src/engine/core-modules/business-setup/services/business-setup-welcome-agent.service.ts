import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { BusinessSetupStepKeys, BusinessSetupKeyValueTypeMap } from '../business-setup.service';
import {
  OnboardingStatusChangedEvent
} from '../events/business-setup.events';
import {
  type AvitoCredentials,
  type CredentialsExtractionResult,
} from '../types/avito.types';

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
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
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

      // Get user and workspace data for personalization
      const [user, workspace] = await Promise.all([
        this.userService.findById(userId),
        this.workspaceService.findById(workspaceId)
      ]);

      if (!user) {
        throw new Error(`User with ID ${userId} not found`);
      }

      if (!workspace) {
        throw new Error(`Workspace with ID ${workspaceId} not found`);
      }

      // Get Avito-specific welcome prompt
      const welcomePrompt = await this.getAvitoWelcomePrompt(user, workspace);
      
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

  // Get Avito-specific welcome prompt with credential collection instructions
  private async getAvitoWelcomePrompt(user: User, workspace: Workspace): Promise<string> {
    return `
Привет, ${user.firstName || 'пользователь'}! 👋

Добро пожаловать в настройку интеграции с Avito для ${workspace.displayName}!

Для подключения к Avito API мне нужны ваши уникальные учетные данные:

📋 **Что мне нужно:**
• CLIENT_ID - идентификатор вашего приложения
• CLIENT_SECRET - секретный ключ

🔍 **Где найти эти данные:**
1. Войдите в ваш аккаунт на Avito
2. Перейдите в раздел "API для разработчиков"
3. Скопируйте CLIENT_ID и CLIENT_SECRET

💡 **Как отправить:**
Просто напишите мне в любом удобном формате, например:

CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF'
CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'

Или просто:
CLIENT_ID: ваш_id
CLIENT_SECRET: ваш_secret

Я автоматически извлеку данные и проверю их работоспособность! 🚀

TOOL USAGE INSTRUCTIONS:
When user provides credentials:
1. Extract CLIENT_ID and CLIENT_SECRET from their message
2. Use http_request tool to validate credentials:
   - URL: https://api.avito.ru/token
   - Method: POST
   - Headers: Content-Type: application/x-www-form-urlencoded
   - Body: grant_type=client_credentials&client_id=EXTRACTED_ID&client_secret=EXTRACTED_SECRET
3. If successful (status 200), store credentials and congratulate user
4. If failed, explain the error and ask to retry
5. Once validated, transition to next business setup step
    `;
  }

  // Extract CLIENT_ID and CLIENT_SECRET from user message using regex
  private extractCredentialsFromMessage(message: string): CredentialsExtractionResult {
    // Support multiple formats: CLIENT_ID = 'value', CLIENT_ID: value, CLIENT_ID=value
    const clientIdRegex = /CLIENT_ID[\s=:]*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i;
    const clientSecretRegex = /CLIENT_SECRET[\s=:]*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i;
    
    const clientIdMatch = message.match(clientIdRegex);
    const clientSecretMatch = message.match(clientSecretRegex);
    
    return {
      clientId: clientIdMatch ? clientIdMatch[1] : null,
      clientSecret: clientSecretMatch ? clientSecretMatch[1] : null,
      isValid: !!(clientIdMatch && clientSecretMatch)
    };
  }

  // Process user messages containing potential Avito credentials
  async processUserMessage(threadId: string, message: string, workspaceId: string, userId: string): Promise<void> {
    try {
      // Extract credentials from user message
      const credentials = this.extractCredentialsFromMessage(message);
      
      if (credentials.isValid) {
        // Agent uses HTTP tool to validate credentials automatically
        const validationPrompt = `
User provided Avito credentials:
CLIENT_ID: ${credentials.clientId}
CLIENT_SECRET: ${credentials.clientSecret}

Validate these credentials using the http_request tool:
- URL: https://api.avito.ru/token
- Method: POST
- Headers: Content-Type: application/x-www-form-urlencoded
- Body: grant_type=client_credentials&client_id=${credentials.clientId}&client_secret=${credentials.clientSecret}

Respond with validation results and next steps.`;
        
        // Execute agent with HTTP tool for validation
        const agent = await this.getAvitoAgent(workspaceId);
        const agentResponse = await this.agentExecutionService.executeAgent({
          agent,
          context: {
            workspaceId,
            userId,
            threadId,
            prompt: validationPrompt
          },
          schema: {},
          userPrompt: validationPrompt
        });
        
        await this.handleValidationResponse(agentResponse, credentials, workspaceId, userId, threadId);
        
      } else {
        // Request credentials again with helpful message
        const retryMessage = `🔍 Не удалось найти CLIENT_ID и CLIENT_SECRET в вашем сообщении.

💡 Пожалуйста, отправьте данные в формате:
CLIENT_ID: ваш_client_id
CLIENT_SECRET: ваш_client_secret`;
        
        await this.agentChatService.addMessage({
          threadId,
          role: AgentChatMessageRole.ASSISTANT,
          content: retryMessage,
          fileIds: []
        });
      }
    } catch (error) {
      this.logger.error('Error processing user message:', error);
    }
  }

  // Process agent validation response and handle success/failure
  private async handleValidationResponse(
    agentResponse: any, 
    credentials: CredentialsExtractionResult, 
    workspaceId: string, 
    userId: string, 
    threadId: string
  ): Promise<void> {
    // Check if the agent's response indicates successful validation
    const responseText = agentResponse.result?.response || agentResponse.text;
    const isValidationSuccessful = this.parseValidationResult(responseText);
    
    if (isValidationSuccessful) {
      // Store credentials using UserVarsService
      await this.storeAvitoCredentials(workspaceId, userId, {
        clientId: credentials.clientId!,
        clientSecret: credentials.clientSecret!
      });
      
      await this.transitionToBusinessAnalysis(workspaceId, userId);
      
    } else {
      this.logger.warn(`Avito credentials validation failed for workspace ${workspaceId}`);
    }
  }

  // Parse agent response to determine if validation was successful
  private parseValidationResult(agentResponse: string): boolean {
    // Parse the agent's response to determine if validation was successful
    const successIndicators = [
      'access_token',
      'успешно',
      'status":200',
      'successfully',
      'validated'
    ];
    
    const errorIndicators = [
      'error',
      'failed',
      'invalid',
      'unauthorized',
      'status":400',
      'status":401'
    ];
    
    const hasSuccess = successIndicators.some(indicator => 
      agentResponse.toLowerCase().includes(indicator)
    );
    
    const hasError = errorIndicators.some(indicator => 
      agentResponse.toLowerCase().includes(indicator)
    );
    
    return hasSuccess && !hasError;
  }

  // Store Avito credentials securely using UserVarsService
  private async storeAvitoCredentials(
    workspaceId: string, 
    userId: string, 
    credentials: AvitoCredentials
  ): Promise<void> {
    // Store using existing UserVarsService
    await Promise.all([
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: credentials.clientId
      }),
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: credentials.clientSecret
      })
    ]);
  }

  // Transition from welcome step to business analysis step
  private async transitionToBusinessAnalysis(workspaceId: string, userId: string): Promise<void> {
    // Mark welcome step as completed and transition to business analysis
    await this.userVarsService.set({
      userId,
      workspaceId,
      key: BusinessSetupStepKeys.BUSINESS_SETUP_WELCOME_PENDING,
      value: false
    });
    
    await this.userVarsService.set({
      userId,
      workspaceId,
      key: BusinessSetupStepKeys.BUSINESS_SETUP_BUSINESS_ANALYSIS_PENDING,
      value: true
    });
    
    // Emit transition event
    this.eventEmitter.emit('business-setup.step-transition', {
      userId,
      workspaceId,
      fromStep: 'WELCOME',
      toStep: 'BUSINESS_ANALYSIS',
      timestamp: new Date()
    });
  }

  // Get the Avito agent for the workspace
  private async getAvitoAgent(workspaceId: string): Promise<AgentEntity> {
    const avitoAgent = await this.agentRepository.findOne({
      where: { 
        name: 'Avito Agent',
        workspaceId 
      }
    });

    if (!avitoAgent) {
      // Create a dedicated Avito agent that uses Gemini model
      return await this.agentRepository.save({
        name: 'Avito Agent',
        description: 'Avito API integration and credentials management agent for Russian marketplace',
        prompt: 'Привет! Добро пожаловать в интеграцию Avito! Я - агент для подключения к Avito API. Помогу вам настроить интеграцию с российским маркетплейсом Avito, собрать и проверить ваши API учетные данные CLIENT_ID и CLIENT_SECRET. Готовы начать?',
        modelId: this.GEMINI_MODEL_ID,
        workspaceId,
      });
    }

    return avitoAgent;
  }
}
