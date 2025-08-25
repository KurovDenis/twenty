import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { type User } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { type Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AgentChatMessageRole } from 'src/engine/metadata-modules/agent/agent-chat-message.entity';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AgentExecutionService } from 'src/engine/metadata-modules/agent/agent-execution.service';
import { AgentEntity } from 'src/engine/metadata-modules/agent/agent.entity';
import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../business-setup.service';
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

  // Metrics for monitoring
  private metrics = {
    agentCreationAttempts: 0,
    agentCreationSuccesses: 0,
    agentCreationFailures: 0,
    foreignKeyViolations: 0,
    uuidFormatErrors: 0,
    workspaceValidationFailures: 0,
    transactionRollbacks: 0,
    averageCreationTime: 0,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly agentExecutionService: AgentExecutionService,
    private readonly agentChatService: AgentChatService,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    @InjectDataSource('core')
    private readonly coreDataSource: DataSource,
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

  // Handle user messages in business setup threads to process Avito credentials
  @OnEvent('ai-agent.welcome.user-message-received')
  private async handleUserMessage(payload: {
    userId: string;
    workspaceId: string;
    threadId: string;
    message: string;
    timestamp: Date;
  }) {
    try {
      this.logger.log(`Processing user message in business setup thread ${payload.threadId}`);
      
      // Process the message for Avito credentials
      await this.processUserMessage(
        payload.threadId, 
        payload.message, 
        payload.workspaceId, 
        payload.userId
      );
      
    } catch (error) {
      this.logger.error('Failed to process user message in business setup thread:', error);
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
    // First validate that the workspace exists
    const workspace = await this.workspaceService.findById(workspaceId);
    if (!workspace) {
      this.logger.error(`Workspace with ID ${workspaceId} not found. Cannot create welcome chat.`);
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.createWelcomeChat(userId, workspaceId);
        this.logger.log(`Welcome chat created successfully on attempt ${attempt}`);
        return; // Success
      } catch (error) {
        this.logger.warn(`Attempt ${attempt} failed for user ${userId}:`, error);
        
        // Check if it's a foreign key constraint violation related to workspace
        if (error.message && error.message.includes('FK_c4cb56621768a4a325dd772bbe1')) {
          this.logger.error(`Foreign key constraint violation: workspace ${workspaceId} does not exist`);
          throw new Error(`Invalid workspace ID: ${workspaceId}. The workspace does not exist.`);
        }
        
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
    const startTime = Date.now();
    this.metrics.agentCreationAttempts++;
    
    // Use transaction for atomic agent and thread creation
    const queryRunner = this.coreDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Emit event for chat creation start
      this.eventEmitter.emit('ai-agent.welcome.chat-creation-started', {
        userId,
        workspaceId,
        timestamp: new Date()
      });

      // Validate workspace exists before creating agent
      await this.validateAgentCreationData(workspaceId);

      // Fetch or create a welcome agent specifically with the Gemini model
      let agent = await queryRunner.manager.findOne(AgentEntity, {
        where: { 
          name: 'Welcome Greeting Bot',
          workspaceId 
        }
      });
      
      if (!agent) {
        // Create a dedicated welcome agent that uses Gemini model within transaction
        agent = await queryRunner.manager.save(AgentEntity, {
          name: 'Welcome Greeting Bot',
          label: 'Welcome Greeting Bot',
          description: 'Simple greeting bot for welcome status',
          prompt: 'You are a simple greeting bot. You ONLY respond with greetings.',
          modelId: this.GEMINI_MODEL_ID, // Force use of Gemini model via OpenRouter
          workspaceId,
          isCustom: true,
        });
        this.logger.log(`Created new welcome agent for workspace ${workspaceId}`);
      } else {
        this.logger.log(`Using existing welcome agent for workspace ${workspaceId}`);
      }

      // Commit transaction after successful agent creation
      await queryRunner.commitTransaction();

      // Create thread outside transaction (AgentChatService handles its own transactions)
      const thread = await this.agentChatService.createThread(agent.id, workspaceId);

      // Continue with the rest of the logic
      await this.completeWelcomeChatSetup(userId, workspaceId, agent, thread);

      // Record success metrics
      const operationTime = Date.now() - startTime;
      this.metrics.agentCreationSuccesses++;
      this.updateAverageCreationTime(operationTime);
      this.logger.log(`Welcome chat created successfully in ${operationTime}ms`);

    } catch (error) {
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      this.metrics.transactionRollbacks++;
      this.metrics.agentCreationFailures++;
      
      const operationTime = Date.now() - startTime;
      this.logger.error(`Failed to create welcome chat (transaction rolled back) in ${operationTime}ms:`, error);
      
      // Handle specific database errors
      this.handleDatabaseError(error, workspaceId);
    } finally {
      await queryRunner.release();
    }
  }

  // Complete welcome chat setup after agent and thread creation
  private async completeWelcomeChatSetup(
    userId: string, 
    workspaceId: string, 
    agent: AgentEntity, 
    thread: any
  ): Promise<void> {
    try {
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
      this.logger.error('Failed to complete welcome chat setup:', error);
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

  // Validate workspace existence and data integrity before agent creation
  private async validateAgentCreationData(workspaceId: string): Promise<void> {
    const startTime = Date.now();
    this.logger.debug(`Validating workspace ${workspaceId} before agent creation`);
    
    try {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(workspaceId)) {
        this.metrics.uuidFormatErrors++;
        this.logger.error(`Invalid workspace ID format: ${workspaceId}`);
        throw new Error(`Invalid workspace ID format: ${workspaceId}`);
      }

      // Validate workspace exists
      const workspace = await this.workspaceService.findById(workspaceId);
      if (!workspace) {
        this.metrics.workspaceValidationFailures++;
        this.logger.error(`Workspace validation failed: workspace ${workspaceId} does not exist`);
        throw new Error(`Cannot create agent: workspace ${workspaceId} does not exist`);
      }
      
      const validationTime = Date.now() - startTime;
      this.logger.debug(`Workspace ${workspaceId} validation successful (${validationTime}ms)`);
    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.logger.error(`Workspace validation failed for ${workspaceId} (${validationTime}ms):`, error);
      throw error;
    }
  }

  // Handle database constraint errors with specific error messages
  private handleDatabaseError(error: any, workspaceId: string): never {
    if (error.message && error.message.includes('FK_c4cb56621768a4a325dd772bbe1')) {
      this.metrics.foreignKeyViolations++;
      this.logger.error(`Foreign key constraint violation: workspace ${workspaceId} does not exist`);
      throw new Error(`Invalid workspace ID: ${workspaceId}. The workspace does not exist.`);
    }
    
    if (error.message && error.message.includes('invalid input syntax for type uuid')) {
      this.metrics.uuidFormatErrors++;
      this.logger.error(`Invalid UUID format provided: ${error.message}`);
      throw new Error(`Invalid UUID format provided. Please check the agent ID.`);
    }
    
    if (error.message && error.message.includes('null value in column "label"')) {
      this.logger.error(`NULL constraint violation: label field is required`);
      throw new Error(`Agent creation failed: label field is required.`);
    }
    
    // Generic database error
    this.logger.error(`Database operation failed:`, error);
    throw error;
  }

  // Update average creation time for performance monitoring
  private updateAverageCreationTime(newTime: number): void {
    const totalOperations = this.metrics.agentCreationSuccesses;
    this.metrics.averageCreationTime = 
      ((this.metrics.averageCreationTime * (totalOperations - 1)) + newTime) / totalOperations;
  }

  // Get current metrics for monitoring and debugging
  public getMetrics(): any {
    const successRate = this.metrics.agentCreationAttempts > 0 
      ? (this.metrics.agentCreationSuccesses / this.metrics.agentCreationAttempts) * 100 
      : 0;
    
    return {
      ...this.metrics,
      successRate: `${successRate.toFixed(2)}%`,
      lastUpdated: new Date().toISOString()
    };
  }

  // Log metrics periodically for monitoring
  public logMetrics(): void {
    const metrics = this.getMetrics();
    this.logger.log('Agent Creation Metrics:', JSON.stringify(metrics, null, 2));
  }

  // Get the Avito agent for the workspace
  private async getAvitoAgent(workspaceId: string): Promise<AgentEntity> {
    // Validate workspace exists before creating agent
    const workspace = await this.workspaceService.findById(workspaceId);
    if (!workspace) {
      throw new Error(`Cannot create Avito agent: workspace ${workspaceId} does not exist`);
    }

    const avitoAgent = await this.agentRepository.findOne({
      where: { 
        name: 'Avito Agent',
        workspaceId 
      }
    });

    if (!avitoAgent) {
      // Create a dedicated Avito agent that uses Gemini model
      try {
        return await this.agentRepository.save({
          name: 'Avito Agent',
          label: 'Avito Agent',
          description: 'Avito API integration and credentials management agent for Russian marketplace',
          prompt: 'Привет! Добро пожаловать в интеграцию Avito! Я - агент для подключения к Avito API. Помогу вам настроить интеграцию с российским маркетплейсом Avito, собрать и проверить ваши API учетные данные CLIENT_ID и CLIENT_SECRET. Готовы начать?',
          modelId: this.GEMINI_MODEL_ID,
          workspaceId, // Now validated workspace ID
          isCustom: true,
        });
      } catch (error) {
        this.logger.error(`Failed to create Avito agent for workspace ${workspaceId}:`, error);
        if (error.message && error.message.includes('FK_c4cb56621768a4a325dd772bbe1')) {
          throw new Error(`Failed to create agent: workspace ${workspaceId} does not exist`);
        }
        throw error;
      }
    }

    return avitoAgent;
  }
}
