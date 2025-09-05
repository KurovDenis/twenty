import { Injectable, Logger } from '@nestjs/common';

import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

export interface ProviderCredentials {
  [key: string]: string;
}

export interface ValidationResult {
  isValid: boolean;
  providerId: string;
  error?: string;
  details?: any;
}

export interface SetupResult {
  success: boolean;
  providerId: string;
  data?: any;
  error?: string;
  nextStatus?: BusinessSetupStatus;
}

export interface ProviderSetupStep {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  order: number;
}

export interface BusinessSetupContext {
  userId: string;
  workspaceId: string;
  currentStatus: BusinessSetupStatus;
  providerParams?: any;
}

/**
 * Abstract interface for business setup providers
 * Enables modular architecture without hard coupling to specific providers
 */
export abstract class BusinessSetupProvider {
  abstract readonly providerId: string;
  abstract readonly displayName: string;
  abstract readonly supportedStatuses: BusinessSetupStatus[];
  abstract readonly icon: string;
  abstract readonly description: string;

  /**
   * Validate provider credentials
   */
  abstract validateCredentials(
    credentials: ProviderCredentials,
  ): Promise<ValidationResult>;

  /**
   * Execute provider-specific business setup
   */
  abstract setupBusiness(context: BusinessSetupContext): Promise<SetupResult>;

  /**
   * Process a request through this provider
   */
  abstract processRequest(request: any): Promise<any>;

  /**
   * Get setup steps for this provider
   */
  abstract getSetupSteps(): ProviderSetupStep[];

  /**
   * Get provider-specific configuration
   */
  abstract getProviderConfig(): {
    requiredCredentials: string[];
    optionalCredentials: string[];
    apiEndpoints: string[];
    capabilities: string[];
  };

  /**
   * Check if provider is available for given status
   */
  supportsStatus(status: BusinessSetupStatus): boolean {
    return this.supportedStatuses.includes(status);
  }

  /**
   * Get UI guidance for the current business setup status
   */
  async getUIGuidance(businessStatus: string): Promise<{
    buttonText: string;
    buttonIcon: string;
    tooltipText: string;
    isEnabled: boolean;
    nextAction: string;
    buttonVariant: string;
    requiresUserAction: boolean;
    loadingText?: string;
    fallbackAction: string;
  }> {
    // Default implementation - providers should override
    return {
      buttonText: 'AI Assistant',
      buttonIcon: 'IconSparkles',
      tooltipText: 'Ask AI (Press @)',
      isEnabled: true,
      nextAction: 'standard',
      buttonVariant: 'secondary',
      requiresUserAction: false,
      loadingText: 'Loading AI...',
      fallbackAction: 'general_ai_chat',
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
    // Default implementation - providers can override
    return {
      isHealthy: true,
      lastChecked: new Date(),
    };
  }
}

/**
 * Registry for managing business setup providers
 * Enables modular architecture and easy addition of new providers
 */
@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, BusinessSetupProvider>();

  /**
   * Register a new provider
   */
  registerProvider(provider: BusinessSetupProvider): void {
    if (this.providers.has(provider.providerId)) {
      this.logger.warn(
        `Provider ${provider.providerId} is already registered, overriding`,
      );
    }

    this.providers.set(provider.providerId, provider);
    this.logger.log(
      `Registered provider: ${provider.providerId} (${provider.displayName})`,
    );
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): BusinessSetupProvider | null {
    return this.providers.get(providerId) || null;
  }

  /**
   * Find provider by ID (alias for getProvider)
   */
  findProvider(providerId: string): BusinessSetupProvider | null {
    return this.getProvider(providerId);
  }

  /**
   * Check if provider exists
   */
  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): BusinessSetupProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers that support a specific status
   */
  getProvidersForStatus(status: BusinessSetupStatus): BusinessSetupProvider[] {
    return Array.from(this.providers.values()).filter((provider) =>
      provider.supportsStatus(status),
    );
  }

  /**
   * Get default provider for a status (first available)
   */
  getDefaultProviderForStatus(
    status: BusinessSetupStatus,
  ): BusinessSetupProvider | null {
    const providers = this.getProvidersForStatus(status);

    return providers.length > 0 ? providers[0] : null;
  }

  /**
   * Check if any provider supports the given status
   */
  hasProviderForStatus(status: BusinessSetupStatus): boolean {
    return this.getProvidersForStatus(status).length > 0;
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: string): boolean {
    const existed = this.providers.has(providerId);

    this.providers.delete(providerId);

    if (existed) {
      this.logger.log(`Unregistered provider: ${providerId}`);
    }

    return existed;
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalProviders: number;
    providersByStatus: Record<BusinessSetupStatus, number>;
    providers: Array<{
      id: string;
      name: string;
      statuses: BusinessSetupStatus[];
    }>;
  } {
    const providers = Array.from(this.providers.values());

    const providersByStatus = Object.values(BusinessSetupStatus).reduce(
      (acc, status) => {
        acc[status] = this.getProvidersForStatus(status).length;

        return acc;
      },
      {} as Record<BusinessSetupStatus, number>,
    );

    return {
      totalProviders: providers.length,
      providersByStatus,
      providers: providers.map((provider) => ({
        id: provider.providerId,
        name: provider.displayName,
        statuses: provider.supportedStatuses,
      })),
    };
  }

  /**
   * Validate all registered providers
   */
  async validateAllProviders(): Promise<
    Array<{
      providerId: string;
      isHealthy: boolean;
      error?: string;
    }>
  > {
    const providers = Array.from(this.providers.values());
    const results = [];

    for (const provider of providers) {
      try {
        const health = await provider.getHealthStatus();

        results.push({
          providerId: provider.providerId,
          isHealthy: health.isHealthy,
          error: health.error,
        });
      } catch (error) {
        results.push({
          providerId: provider.providerId,
          isHealthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}

/**
 * Default provider factory for auto-registration
 */
export class ProviderFactory {
  static createProvider(
    config: {
      providerId: string;
      displayName: string;
      supportedStatuses: BusinessSetupStatus[];
      icon: string;
      description: string;
    },
    implementation: {
      validateCredentials: (
        credentials: ProviderCredentials,
      ) => Promise<ValidationResult>;
      setupBusiness: (context: BusinessSetupContext) => Promise<SetupResult>;
      processRequest: (request: any) => Promise<any>;
      getSetupSteps: () => ProviderSetupStep[];
      getProviderConfig: () => any;
    },
  ): BusinessSetupProvider {
    return new (class extends BusinessSetupProvider {
      readonly providerId = config.providerId;
      readonly displayName = config.displayName;
      readonly supportedStatuses = config.supportedStatuses;
      readonly icon = config.icon;
      readonly description = config.description;

      validateCredentials = implementation.validateCredentials;
      setupBusiness = implementation.setupBusiness;
      processRequest = implementation.processRequest;
      getSetupSteps = implementation.getSetupSteps;
      getProviderConfig = implementation.getProviderConfig;
    })();
  }
}
