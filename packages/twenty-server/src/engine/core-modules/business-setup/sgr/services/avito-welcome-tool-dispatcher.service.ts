import { Injectable, Logger } from '@nestjs/common';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { type HttpRequestInput } from 'src/engine/core-modules/tool/tools/http-tool/types/http-request-input.type';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { BusinessSetupKeyValueTypeMap, BusinessSetupStepKeys } from '../../business-setup.service';
import {
  type ExtractCredentialsType,
  type ReportWelcomeCompletionType,
  type RequestCredentialsType,
  type StoreCredentialsType,
  type ToolExecutionResult,
  type ValidateAvitoTokenType,
  validateCredentialFormat,
  type WelcomeToolUnion
} from '../schemas/avito-welcome-sgr.schema';

/**
 * Tool dispatcher for Avito Welcome Agent SGR system
 * 
 * Handles type-safe routing and execution of structured reasoning tools
 * for credential collection, validation, and storage.
 */
@Injectable()
export class AvitoWelcomeToolDispatcherService {
  private readonly logger = new Logger(AvitoWelcomeToolDispatcherService.name);

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly httpTool: HttpTool
  ) {}

  /**
   * Main dispatch method with type-safe routing
   */
  async dispatch(
    command: WelcomeToolUnion,
    userId: string,
    workspaceId: string
  ): Promise<ToolExecutionResult> {
    try {
      this.logger.log(`Dispatching tool: ${command.tool} for user ${userId}`);

      switch (command.tool) {
        case 'extract_credentials':
          return this.handleExtractCredentials(command);
          
        case 'request_credentials':
          return this.handleRequestCredentials(command);
          
        case 'validate_avito_token':
          return this.handleValidateToken(command);
          
        case 'store_credentials':
          return this.handleStoreCredentials(command, userId, workspaceId);
          
        case 'report_welcome_completion':
          return this.handleCompletion(command);
          
        default:
          // TypeScript ensures exhaustive handling
          const exhaustiveCheck: never = command;
          throw new Error(`Unknown tool: ${(exhaustiveCheck as any).tool}`);
      }
    } catch (error) {
      this.logger.error(`Tool dispatch failed for ${command.tool}:`, error);
      return {
        success: false,
        error: error.message || 'Tool execution failed',
        message: 'Произошла ошибка при выполнении операции. Попробуйте еще раз.'
      };
    }
  }

  /**
   * Extract credentials from user message using multiple patterns
   */
  private handleExtractCredentials(cmd: ExtractCredentialsType): ToolExecutionResult {
    this.logger.log('Extracting credentials from user message');

    // Enhanced extraction with multiple patterns
    const patterns = {
      standard: /CLIENT_ID[\s=:]*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i,
      json: /"client_id"\s*:\s*"([^"]+)"/i,
      yaml: /client_id\s*:\s*([^\s]+)/i,
      colon: /CLIENT_ID\s*:\s*([A-Za-z0-9_-]+)/i,
      equals: /CLIENT_ID\s*=\s*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i
    };
    
    const secretPatterns = {
      standard: /CLIENT_SECRET[\s=:]*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i,
      json: /"client_secret"\s*:\s*"([^"]+)"/i,
      yaml: /client_secret\s*:\s*([^\s]+)/i,
      colon: /CLIENT_SECRET\s*:\s*([A-Za-z0-9_-]+)/i,
      equals: /CLIENT_SECRET\s*=\s*['"]*([A-Za-z0-9_-]+)['"]*(?:\s|$)/i
    };

    // Try all patterns for CLIENT_ID
    let clientId = null;
    for (const [patternName, pattern] of Object.entries(patterns)) {
      const match = cmd.message.match(pattern);
      if (match) {
        clientId = match[1];
        this.logger.log(`CLIENT_ID extracted using ${patternName} pattern`);
        break;
      }
    }

    // Try all patterns for CLIENT_SECRET
    let clientSecret = null;
    for (const [patternName, pattern] of Object.entries(secretPatterns)) {
      const match = cmd.message.match(pattern);
      if (match) {
        clientSecret = match[1];
        this.logger.log(`CLIENT_SECRET extracted using ${patternName} pattern`);
        break;
      }
    }

    const extractionSuccessful = !!(clientId && clientSecret);
    const validFormat = extractionSuccessful && clientId && clientSecret ? validateCredentialFormat(clientId, clientSecret) : false;

    return {
      success: extractionSuccessful && validFormat,
      data: {
        client_id: clientId,
        client_secret: clientSecret,
        extraction_successful: extractionSuccessful,
        valid_format: validFormat,
        patterns_matched: clientId && clientSecret ? 'both' : clientId ? 'client_id_only' : clientSecret ? 'client_secret_only' : 'none',
        message: cmd.message
      },
      message: extractionSuccessful 
        ? (validFormat ? '✅ Учетные данные успешно извлечены!' : '⚠️ Учетные данные найдены, но формат может быть неверным')
        : '❌ Учетные данные не найдены в сообщении'
    };
  }

  /**
   * Generate user-friendly credential request messages
   */
  private handleRequestCredentials(cmd: RequestCredentialsType): ToolExecutionResult {
    this.logger.log(`Generating credential request message for reason: ${cmd.reason}`);

    const defaultMessages = {
      no_credentials_found: `🔍 Не удалось найти CLIENT_ID и CLIENT_SECRET в вашем сообщении.

💡 Пожалуйста, предоставьте ваши учетные данные Avito API в следующем формате:

**Вариант 1:**
CLIENT_ID = 'ваш_client_id'
CLIENT_SECRET = 'ваш_client_secret'

**Вариант 2:**
CLIENT_ID: ваш_client_id
CLIENT_SECRET: ваш_client_secret

**Вариант 3 (JSON):**
{
  "client_id": "ваш_client_id",
  "client_secret": "ваш_client_secret"
}

📋 **Где найти эти данные:**
1. Войдите в личный кабинет Avito
2. Перейдите в раздел "API для разработчиков"
3. Скопируйте CLIENT_ID и CLIENT_SECRET

🔒 Ваши данные будут надежно зашифрованы и сохранены.`,

      invalid_format: `❌ Неверный формат данных.

✅ **Правильные форматы:**

**Простой формат:**
CLIENT_ID = R3cTDMk9rEJ2lh5A9_QF
CLIENT_SECRET = ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc

**С кавычками:**
CLIENT_ID = 'R3cTDMk9rEJ2lh5A9_QF'
CLIENT_SECRET = 'ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc'

**JSON формат:**
{
  "client_id": "R3cTDMk9rEJ2lh5A9_QF",
  "client_secret": "ehAWb-RBQrLmgoJWfgtst737eQV6KIBHzmV1NmIc"
}`,

      missing_client_id: `❌ CLIENT_ID не найден.

🔍 Пожалуйста, укажите CLIENT_ID в любом из следующих форматов:
• CLIENT_ID = ваш_id
• CLIENT_ID: ваш_id
• "client_id": "ваш_id"`,

      missing_client_secret: `❌ CLIENT_SECRET не найден.

🔍 Пожалуйста, укажите CLIENT_SECRET в любом из следующих форматов:
• CLIENT_SECRET = ваш_secret
• CLIENT_SECRET: ваш_secret
• "client_secret": "ваш_secret"`
    };

    const message = cmd.user_friendly_message || defaultMessages[cmd.reason];

    return {
      success: true,
      data: {
        message_sent: true,
        message_content: message,
        reason: cmd.reason
      },
      message
    };
  }

  /**
   * Validate credentials with Avito API
   */
  private async handleValidateToken(cmd: ValidateAvitoTokenType): Promise<ToolExecutionResult> {
    this.logger.log('Validating credentials with Avito API');

    try {
      // Validate input format first
      if (!validateCredentialFormat(cmd.client_id, cmd.client_secret)) {
        return {
          success: false,
          error: 'Invalid credential format',
          message: '❌ Неверный формат учетных данных. Проверьте CLIENT_ID и CLIENT_SECRET.'
        };
      }

      // Call Avito API using existing HTTP tool
      const requestBody = `grant_type=client_credentials&client_id=${encodeURIComponent(cmd.client_id)}&client_secret=${encodeURIComponent(cmd.client_secret)}`;
      
      const httpInput: HttpRequestInput = {
        url: cmd.api_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: requestBody
      };
      
      const httpResult = await this.httpTool.execute(httpInput);

      if (httpResult.error) {
        this.logger.warn('Avito API validation failed:', httpResult.error);
        return {
          success: false,
          error: httpResult.error,
          message: '❌ Ошибка при проверке учетных данных через Avito API. Проверьте правильность CLIENT_ID и CLIENT_SECRET.'
        };
      }

      const responseData = httpResult.result as any;
      
      if (responseData && responseData.access_token) {
        this.logger.log('Avito API validation successful');
        return {
          success: true,
          data: {
            validation_successful: true,
            access_token: responseData.access_token,
            expires_in: responseData.expires_in,
            token_type: responseData.token_type,
            client_id: cmd.client_id,
            client_secret: cmd.client_secret
          },
          message: '✅ Учетные данные успешно проверены через Avito API!'
        };
      } else {
        return {
          success: false,
          error: 'Invalid response from Avito API',
          message: '❌ Неверный ответ от Avito API. Проверьте учетные данные.'
        };
      }

    } catch (error) {
      this.logger.error('Avito API validation error:', error);
      return {
        success: false,
        error: error.message,
        message: '❌ Ошибка соединения с Avito API. Проверьте подключение к интернету и повторите попытку.'
      };
    }
  }

  /**
   * Store validated credentials securely using UserVarsService
   */
  private async handleStoreCredentials(
    cmd: StoreCredentialsType,
    userId: string,
    workspaceId: string
  ): Promise<ToolExecutionResult> {
    this.logger.log('Storing validated credentials securely');

    try {
      // Store credentials using existing UserVarsService
      const storagePromises = [
        this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
          value: cmd.client_id
        }),
        this.userVarsService.set({
          userId,
          workspaceId,
          key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
          value: cmd.client_secret
        })
      ];

      // Store access token if provided
      if (cmd.access_token) {
        storagePromises.push(
          this.userVarsService.set({
            userId,
            workspaceId,
            key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
            value: cmd.access_token
          })
        );

        // Store token expiration if provided
        if (cmd.expires_in) {
          const expiresAt = new Date(Date.now() + cmd.expires_in * 1000);
          storagePromises.push(
            this.userVarsService.set({
              userId,
              workspaceId,
              key: BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT,
              value: expiresAt.toISOString()
            })
          );
        }
      }

      await Promise.all(storagePromises);

      this.logger.log('Credentials stored successfully');
      return {
        success: true,
        data: {
          storage_successful: true,
          credentials_saved: true,
          tokens_saved: !!cmd.access_token,
          stored_keys: [
            BusinessSetupStepKeys.AVITO_CLIENT_ID,
            BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
            ...(cmd.access_token ? [BusinessSetupStepKeys.AVITO_ACCESS_TOKEN] : []),
            ...(cmd.expires_in ? [BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT] : [])
          ]
        },
        message: '💾 Учетные данные безопасно сохранены в системе! Интеграция с Avito готова к использованию.'
      };

    } catch (error) {
      this.logger.error('Failed to store credentials:', error);
      return {
        success: false,
        error: error.message,
        message: '❌ Ошибка при сохранении учетных данных. Попробуйте еще раз.'
      };
    }
  }

  /**
   * Handle completion reporting
   */
  private handleCompletion(cmd: ReportWelcomeCompletionType): ToolExecutionResult {
    this.logger.log(`Welcome stage completion: success=${cmd.success}, next_stage=${cmd.next_stage}`);

    return {
      success: cmd.success,
      data: {
        task_completed: true,
        success: cmd.success,
        credentials_stored: cmd.credentials_stored,
        next_stage: cmd.next_stage,
        completion_message: cmd.summary_message
      },
      message: cmd.summary_message
    };
  }
}