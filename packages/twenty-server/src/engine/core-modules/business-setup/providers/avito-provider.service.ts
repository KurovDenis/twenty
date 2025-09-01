import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import { BusinessSetupStatus } from '../enums/business-setup-status.enum';
import { BusinessSetupStepKeys } from '../business-setup.service';
import {
  BusinessSetupContext,
  BusinessSetupProvider,
  ProviderCredentials,
  ProviderSetupStep,
  SetupResult,
  ValidationResult,
} from '../services/provider-registry.service';

export interface AvitoCredentials extends ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface AvitoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Avito provider implementation using the modular provider registry
 * Removes hard coupling from the UI and enables easy provider swapping
 */
@Injectable()
export class AvitoBusinessSetupProvider extends BusinessSetupProvider {
  private readonly logger = new Logger(AvitoBusinessSetupProvider.name);

  readonly providerId = 'avito';
  readonly displayName = 'Avito Integration';
  readonly supportedStatuses = [BusinessSetupStatus.WELCOME];
  readonly icon = '🏪';
  readonly description =
    'Integrate your business with Avito marketplace for automated listings and management';

  constructor(
    private readonly httpService: HttpService,
    private readonly userVarsService: UserVarsService,
  ) {
    super();
  }

  /**
   * Validate Avito API credentials
   */
  async validateCredentials(
    credentials: AvitoCredentials,
  ): Promise<ValidationResult> {
    try {
      const { clientId, clientSecret } = credentials;

      if (!clientId || !clientSecret) {
        return {
          isValid: false,
          providerId: this.providerId,
          error: 'CLIENT_ID and CLIENT_SECRET are required',
        };
      }

      // Validate credentials with Avito API
      const tokenResponse = await this.requestAvitoToken(
        clientId,
        clientSecret,
      );

      if (tokenResponse.access_token) {
        return {
          isValid: true,
          providerId: this.providerId,
          details: {
            tokenType: tokenResponse.token_type,
            expiresIn: tokenResponse.expires_in,
            hasAccess: true,
          },
        };
      }

      return {
        isValid: false,
        providerId: this.providerId,
        error: 'Invalid credentials - no access token received',
      };
    } catch (error) {
      this.logger.error('Avito credential validation failed:', error.stack);

      return {
        isValid: false,
        providerId: this.providerId,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Execute Avito business setup process
   */
  async setupBusiness(context: BusinessSetupContext): Promise<SetupResult> {
    try {
      const { userId, workspaceId, providerParams } = context;

      if (!providerParams?.credentials) {
        return {
          success: false,
          providerId: this.providerId,
          error: 'No credentials provided',
        };
      }

      // Validate credentials first
      const validation = await this.validateCredentials(
        providerParams.credentials,
      );

      if (!validation.isValid) {
        return {
          success: false,
          providerId: this.providerId,
          error: validation.error,
        };
      }

      // Store credentials securely
      await this.storeCredentials(
        userId,
        workspaceId,
        providerParams.credentials,
      );

      // Store access token if available
      if (validation.details?.hasAccess) {
        const tokenResponse = await this.requestAvitoToken(
          providerParams.credentials.clientId,
          providerParams.credentials.clientSecret,
        );

        await this.storeAccessToken(userId, workspaceId, tokenResponse);
      }

      this.logger.log(
        `Avito setup completed for user ${userId} in workspace ${workspaceId}`,
      );

      return {
        success: true,
        providerId: this.providerId,
        data: {
          credentialsStored: true,
          accessTokenStored: true,
          setupComplete: true,
        },
        nextStatus: BusinessSetupStatus.BUSINESS_ANALYSIS,
      };
    } catch (error) {
      this.logger.error('Avito business setup failed:', error.stack);

      return {
        success: false,
        providerId: this.providerId,
        error: error instanceof Error ? error.message : 'Setup failed',
      };
    }
  }

  /**
   * Process a request through the Avito provider
   */
  async processRequest(request: any): Promise<any> {
    try {
      const { action, userId, workspaceId, context } = request;

      switch (action) {
        case 'validate_credentials':
          return await this.validateCredentials(context.credentials);
        case 'setup_business':
          return await this.setupBusiness({
            userId,
            workspaceId,
            currentStatus: context.status,
            providerParams: context,
          });
        default:
          return {
            success: false,
            message: `Unknown action: ${action}`,
            providerId: this.providerId,
          };
      }
    } catch (error) {
      this.logger.error('Avito request processing failed:', error.stack);

      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Request processing failed',
        providerId: this.providerId,
      };
    }
  }

  /**
   * Get Avito setup steps
   */
  getSetupSteps(): ProviderSetupStep[] {
    return [
      {
        id: 'credentials',
        title: 'Provide Avito API Credentials',
        description:
          'Enter your CLIENT_ID and CLIENT_SECRET from Avito Developer Console',
        required: true,
        order: 1,
      },
      {
        id: 'validation',
        title: 'Validate API Access',
        description: 'Verify your credentials work with Avito API',
        required: true,
        order: 2,
      },
      {
        id: 'configuration',
        title: 'Configure Integration',
        description: 'Set up your Avito integration preferences',
        required: true,
        order: 3,
      },
    ];
  }

  /**
   * Get Avito provider configuration
   */
  getProviderConfig() {
    return {
      requiredCredentials: ['clientId', 'clientSecret'],
      optionalCredentials: [],
      apiEndpoints: [
        'https://api.avito.ru/token',
        'https://api.avito.ru/core/v1/',
      ],
      capabilities: [
        'credential_validation',
        'token_management',
        'api_access',
        'marketplace_integration',
      ],
    };
  }

  /**
   * Get provider health status
   */
  async getHealthStatus(): Promise<{
    isHealthy: boolean;
    lastChecked: Date;
    error?: string;
  }> {
    try {
      // Simple health check - try to reach Avito API endpoint
      const response = await firstValueFrom(
        this.httpService.get('https://api.avito.ru/health', {
          timeout: 5000,
        }),
      );

      return {
        isHealthy: response.status === 200,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Request access token from Avito API
   */
  private async requestAvitoToken(
    clientId: string,
    clientSecret: string,
  ): Promise<AvitoTokenResponse> {
    const tokenUrl = 'https://api.avito.ru/token';
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await firstValueFrom(
      this.httpService.post(tokenUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }),
    );

    if (response.status !== 200) {
      throw new Error(`Avito API returned status ${response.status}`);
    }

    return response.data;
  }

  /**
   * Store credentials securely using UserVarsService
   */
  private async storeCredentials(
    userId: string,
    workspaceId: string,
    credentials: AvitoCredentials,
  ): Promise<void> {
    await Promise.all([
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_ID,
        value: credentials.clientId,
      }),
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_CLIENT_SECRET,
        value: credentials.clientSecret,
      }),
    ]);
  }

  /**
   * Store access token and expiration
   */
  private async storeAccessToken(
    userId: string,
    workspaceId: string,
    tokenResponse: AvitoTokenResponse,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await Promise.all([
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_ACCESS_TOKEN,
        value: tokenResponse.access_token,
      }),
      this.userVarsService.set({
        userId,
        workspaceId,
        key: BusinessSetupStepKeys.AVITO_TOKEN_EXPIRES_AT,
        value: expiresAt.toISOString(),
      }),
    ]);
  }
}
