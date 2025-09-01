import { Test, type TestingModule } from '@nestjs/testing';

import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import {
  BusinessSetupProvider,
  ProviderRegistry,
} from '../provider-registry.service';

// Mock provider for testing
class MockAvitoProvider extends BusinessSetupProvider {
  providerId = 'test-avito';
  displayName = 'Test Avito Provider';
  supportedStatuses = [BusinessSetupStatus.WELCOME];
  icon = '🏪';
  description = 'Test Avito provider';

  async validateCredentials(): Promise<any> {
    return { isValid: true, providerId: this.providerId };
  }

  async setupBusiness(): Promise<any> {
    return { success: true, providerId: this.providerId };
  }

  async processRequest(request: any): Promise<any> {
    return { success: true, data: request, providerId: this.providerId };
  }

  getSetupSteps(): any[] {
    return [];
  }

  getProviderConfig(): any {
    return {
      requiredCredentials: [],
      optionalCredentials: [],
      apiEndpoints: [],
      capabilities: [],
    };
  }
}

class MockEbayProvider extends BusinessSetupProvider {
  providerId = 'test-ebay';
  displayName = 'Test eBay Provider';
  supportedStatuses = [BusinessSetupStatus.BUSINESS_ANALYSIS];
  icon = '💰';
  description = 'Test eBay provider';

  async validateCredentials(): Promise<any> {
    return { isValid: true, providerId: this.providerId };
  }

  async setupBusiness(): Promise<any> {
    return { success: true, providerId: this.providerId };
  }

  async processRequest(request: any): Promise<any> {
    return { success: true, data: request, providerId: this.providerId };
  }

  getSetupSteps(): any[] {
    return [];
  }

  getProviderConfig(): any {
    return {
      requiredCredentials: [],
      optionalCredentials: [],
      apiEndpoints: [],
      capabilities: [],
    };
  }
}

describe('ProviderRegistry', () => {
  let service: ProviderRegistry;
  let avitoProvider: MockAvitoProvider;
  let ebayProvider: MockEbayProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderRegistry],
    }).compile();

    service = module.get<ProviderRegistry>(ProviderRegistry);
    avitoProvider = new MockAvitoProvider();
    ebayProvider = new MockEbayProvider();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerProvider', () => {
    it('should register a provider successfully', () => {
      service.registerProvider(avitoProvider);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('test-avito');
    });

    it('should register multiple providers', () => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.providerId)).toEqual([
        'test-avito',
        'test-ebay',
      ]);
    });

    it('should replace provider with same ID', () => {
      service.registerProvider(avitoProvider);

      const newAvitoProvider = new MockAvitoProvider();

      newAvitoProvider.displayName = 'Updated Avito Provider';

      service.registerProvider(newAvitoProvider);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(1);
      expect(providers[0].displayName).toBe('Updated Avito Provider');
    });

    it('should log provider registration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.registerProvider(avitoProvider);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Registered provider: test-avito',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('findProvider', () => {
    beforeEach(() => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);
    });

    it('should find provider for supported status', () => {
      const provider = service.findProvider(BusinessSetupStatus.WELCOME);

      expect(provider).toBeTruthy();
      expect(provider?.providerId).toBe('test-avito');
    });

    it('should find provider based on status', () => {
      const provider = service.findProvider(
        BusinessSetupStatus.BUSINESS_ANALYSIS,
      );

      expect(provider).toBeTruthy();
      expect(provider?.providerId).toBe('test-ebay');
    });

    it('should return null when no provider can handle status', () => {
      const provider = service.findProvider(BusinessSetupStatus.COMPLETED);

      expect(provider).toBeNull();
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);
    });

    it('should get provider by ID', () => {
      const provider = service.getProvider('test-avito');

      expect(provider).toBeTruthy();
      expect(provider?.providerId).toBe('test-avito');
    });

    it('should return null for non-existent provider', () => {
      const provider = service.getProvider('non-existent');

      expect(provider).toBeNull();
    });
  });

  describe('getAllProviders', () => {
    it('should return empty array when no providers registered', () => {
      const providers = service.getAllProviders();

      expect(providers).toEqual([]);
    });

    it('should return all registered providers', () => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);

      const providers = service.getAllProviders();

      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.providerId)).toEqual([
        'test-avito',
        'test-ebay',
      ]);
    });
  });

  describe('getProvidersForStatus', () => {
    beforeEach(() => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);
    });

    it('should return providers that support the status', () => {
      const providers = service.getProvidersForStatus(
        BusinessSetupStatus.WELCOME,
      );

      expect(providers).toHaveLength(1);
      expect(providers[0].providerId).toBe('test-avito');
    });

    it('should return empty array for unsupported status', () => {
      const providers = service.getProvidersForStatus(
        BusinessSetupStatus.COMPLETED,
      );

      expect(providers).toHaveLength(0);
    });

    it('should handle invalid status gracefully', () => {
      const providers = service.getProvidersForStatus('INVALID_STATUS' as any);

      expect(providers).toHaveLength(0);
    });
  });

  describe('hasProvider', () => {
    beforeEach(() => {
      service.registerProvider(avitoProvider);
    });

    it('should return true for registered provider', () => {
      const hasProvider = service.hasProvider('test-avito');

      expect(hasProvider).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      const hasProvider = service.hasProvider('non-existent');

      expect(hasProvider).toBe(false);
    });
  });

  describe('unregisterProvider', () => {
    beforeEach(() => {
      service.registerProvider(avitoProvider);
      service.registerProvider(ebayProvider);
    });

    it('should unregister provider successfully', () => {
      const result = service.unregisterProvider('test-avito');

      expect(result).toBe(true);
      expect(service.getAllProviders()).toHaveLength(1);
      expect(service.hasProvider('test-avito')).toBe(false);
    });

    it('should return false for non-existent provider', () => {
      const result = service.unregisterProvider('non-existent');

      expect(result).toBe(false);
      expect(service.getAllProviders()).toHaveLength(2);
    });

    it('should log provider unregistration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.unregisterProvider('test-avito');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unregistered provider: test-avito',
      );

      consoleSpy.mockRestore();
    });
  });
});

// Performance and concurrency tests
describe('ProviderRegistry - Performance', () => {
  let service: ProviderRegistry;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProviderRegistry],
    }).compile();

    service = module.get<ProviderRegistry>(ProviderRegistry);
  });

  it('should handle large number of providers efficiently', () => {
    const providers = Array(1000)
      .fill(null)
      .map((_, index) => ({
        providerId: `provider-${index}`,
        displayName: `Provider ${index}`,
        supportedStatuses: [BusinessSetupStatus.WELCOME],
        icon: '🔧',
        description: `Test Provider ${index}`,
        validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
        setupBusiness: jest.fn().mockResolvedValue({ success: true }),
        processRequest: jest.fn().mockResolvedValue({ success: true }),
        getSetupSteps: jest.fn().mockReturnValue([]),
        getProviderConfig: jest.fn().mockReturnValue({
          requiredCredentials: [],
          optionalCredentials: [],
          apiEndpoints: [],
          capabilities: [],
        }),
        supportsStatus: jest.fn().mockReturnValue(true),
        getHealthStatus: jest
          .fn()
          .mockResolvedValue({ isHealthy: true, lastChecked: new Date() }),
      }));

    const start = Date.now();

    providers.forEach((provider) => service.registerProvider(provider));
    const end = Date.now();

    expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    expect(service.getAllProviders()).toHaveLength(1000);
  });

  it('should handle concurrent findProvider calls', async () => {
    // Register providers
    const providers = Array(10)
      .fill(null)
      .map((_, index) => ({
        providerId: `provider-${index}`,
        displayName: `Provider ${index}`,
        supportedStatuses: [BusinessSetupStatus.WELCOME],
        icon: '🔧',
        description: `Test Provider ${index}`,
        validateCredentials: jest.fn().mockResolvedValue({ isValid: true }),
        setupBusiness: jest.fn().mockResolvedValue({ success: true }),
        processRequest: jest.fn().mockImplementation(async () => {
          // Simulate async work
          await new Promise((resolve) => setTimeout(resolve, 10));

          return { success: index === 5, providerId: `provider-${index}` }; // Only provider-5 succeeds
        }),
        getSetupSteps: jest.fn().mockReturnValue([]),
        getProviderConfig: jest.fn().mockReturnValue({
          requiredCredentials: [],
          optionalCredentials: [],
          apiEndpoints: [],
          capabilities: [],
        }),
        supportsStatus: jest.fn().mockReturnValue(true),
        getHealthStatus: jest
          .fn()
          .mockResolvedValue({ isHealthy: true, lastChecked: new Date() }),
      }));

    providers.forEach((provider) => service.registerProvider(provider));

    // Make concurrent findProvider calls
    const promises = Array(20)
      .fill(null)
      .map(() => service.findProvider(`provider-5`));

    const results = await Promise.all(promises);

    // All should return the same provider (provider-5)
    results.forEach((result) => {
      expect(result?.providerId).toBe('provider-5');
    });
  });
});
