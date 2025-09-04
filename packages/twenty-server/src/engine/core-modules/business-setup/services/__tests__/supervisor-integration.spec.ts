import { type INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { type User } from 'src/engine/core-modules/user/user.entity';

import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';

// Services to test
import { SupervisorController } from '../../controllers/supervisor.controller';
import { AvitoBusinessSetupProvider } from '../../providers/avito-provider.service';
import { AdaptiveSupervisorConfigService } from '../adaptive-supervisor-config.service';
import { BusinessSetupStatusCacheService } from '../business-setup-status-cache.service';
import { EnhancedSupervisorToolDispatcher } from '../enhanced-supervisor-tool-dispatcher.service';
import { ProviderRegistry } from '../provider-registry.service';
import { StreamingProgressService } from '../streaming-progress.service';
import { SupervisorAnalyticsService } from '../supervisor-analytics.service';

// Mock dependencies
class MockRedisService {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.store.set(key, value);
    // Simulate TTL by removing after timeout
    setTimeout(() => this.store.delete(key), ttl * 1000);
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);

    this.store.delete(key);

    return existed ? 1 : 0;
  }

  clear(): void {
    this.store.clear();
  }
}

class MockUser implements Partial<User> {
  id = 'test-user-123';
  firstName = 'Test';
  lastName = 'User';
  email = 'test@example.com';
  defaultAvatarUrl = 'https://example.com/avatar.png';
  isEmailVerified = true;
  disabled = false;
  passwordHash = 'mock-hash';
  canImpersonate = false;
  canAccessFullAdminPanel = false;
  createdAt = new Date();
  updatedAt = new Date();
  deletedAt = new Date(); // Changed from null to Date
  locale = 'en';
  appTokens = [];
  keyValuePairs = [];
  workspaceMember = {} as any; // Changed from null to empty object
  userWorkspaces = [];
  onboardingStatus = OnboardingStatus.COMPLETED; // Fixed: COMPLETE -> COMPLETED
  businessSetupStatus = BusinessSetupStatus.WELCOME;
  currentWorkspace = undefined; // Changed from null to undefined
  currentUserWorkspace = undefined; // Changed from null to undefined

  formatEmail() {
    this.email = this.email.toLowerCase();
  }
}

class MockWorkspace implements Partial<any> {
  id = 'test-workspace-456';
  name = 'Test Workspace';
}

describe('Supervisor Architecture Integration Tests', () => {
  let app: INestApplication;
  let module: TestingModule;
  let redisService: MockRedisService;
  let eventEmitter: EventEmitter2;
  let cacheService: BusinessSetupStatusCacheService;
  let providerRegistry: ProviderRegistry;
  let analyticsService: SupervisorAnalyticsService;
  let progressService: StreamingProgressService;
  let supervisorController: SupervisorController;

  beforeEach(async () => {
    redisService = new MockRedisService();

    module = await Test.createTestingModule({
      controllers: [SupervisorController],
      providers: [
        BusinessSetupStatusCacheService,
        ProviderRegistry,
        SupervisorAnalyticsService,
        StreamingProgressService,
        AdaptiveSupervisorConfigService,
        EnhancedSupervisorToolDispatcher,
        AvitoBusinessSetupProvider,
        EventEmitter2,
        {
          provide: 'RedisService',
          useValue: redisService,
        },
      ],
    })
      .overrideProvider(EventEmitter2)
      .useValue(new EventEmitter2())
      .compile();

    app = module.createNestApplication();
    await app.init();

    cacheService = module.get<BusinessSetupStatusCacheService>(
      BusinessSetupStatusCacheService,
    );
    providerRegistry = module.get<ProviderRegistry>(ProviderRegistry);
    analyticsService = module.get<SupervisorAnalyticsService>(
      SupervisorAnalyticsService,
    );
    progressService = module.get<StreamingProgressService>(
      StreamingProgressService,
    );
    supervisorController =
      module.get<SupervisorController>(SupervisorController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Register test providers
    const avitoProvider = module.get<AvitoBusinessSetupProvider>(
      AvitoBusinessSetupProvider,
    );

    providerRegistry.registerProvider(avitoProvider);
  });

  afterEach(async () => {
    redisService.clear();
    await app.close();
  });

  describe('Complete Supervisor Workflow', () => {
    it('should handle complete user journey from UI guidance to action execution', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Step 1: Get UI guidance (cache miss)
      const guidanceResponse = await supervisorController.getUIGuidance(
        user as any,
        workspace as any,
        { requestType: 'ui_guidance' },
      );

      expect(guidanceResponse.success).toBe(true);
      expect(guidanceResponse.guidance).toBeDefined();
      expect(guidanceResponse.guidance.buttonText).toBeTruthy();
      expect(guidanceResponse.guidance.actionType).toBeTruthy();
      expect(guidanceResponse.metadata?.cacheHit).toBe(false);

      // Step 2: Execute action based on guidance
      const actionResponse = await supervisorController.executeAction(
        user as any,
        workspace as any,
        {
          userId: user.id,
          workspaceId: workspace.id,
          actionType: guidanceResponse.guidance.actionType,
          context: {
            providerInfo: guidanceResponse.guidance.providerInfo,
          },
        },
      );

      expect(actionResponse.success).toBe(true);
      expect(actionResponse.operationId).toBeTruthy();
      expect(actionResponse.metadata?.providerUsed).toBeTruthy();

      // Step 3: Verify analytics were tracked
      const metrics = await analyticsService.getMetrics({
        userId: user.id,
        workspaceId: workspace.id,
        timeRange: '1h',
      });

      expect(metrics.routing.totalRequests).toBeGreaterThan(0);
      expect(metrics.actionExecution.totalActions).toBeGreaterThan(0);
      expect(metrics.uiGuidance.totalGuidanceRequests).toBeGreaterThan(0);

      // Step 4: Get UI guidance again (should be cache hit)
      const secondGuidanceResponse = await supervisorController.getUIGuidance(
        user as any,
        workspace as any,
        { requestType: 'ui_guidance' },
      );

      expect(secondGuidanceResponse.metadata?.cacheHit).toBe(true);
    });

    it('should handle provider routing correctly', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Mock business setup status for WELCOME stage
      await cacheService.setStatus(
        user.id,
        workspace.id,
        BusinessSetupStatus.WELCOME,
      );

      // Get UI guidance
      const guidanceResponse = await supervisorController.getUIGuidance(
        user as any,
        workspace as any,
        {},
      );

      expect(guidanceResponse.success).toBe(true);
      expect(guidanceResponse.guidance.providerInfo?.providerId).toBe(
        'avito-integration',
      );
      expect(guidanceResponse.metadata?.providerUsed).toBe('avito-integration');

      // Verify provider was selected correctly
      const selectedProvider = providerRegistry.findProvider('avito');

      expect(selectedProvider).toBeTruthy();
      expect(selectedProvider?.providerId).toBe('avito-integration');
    });

    it('should handle error scenarios with recovery', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Simulate provider error by removing all providers
      const allProviders = providerRegistry.getAllProviders();

      allProviders.forEach((provider) => {
        providerRegistry.unregisterProvider(provider.providerId);
      });

      // Get UI guidance (should fallback to default)
      const guidanceResponse = await supervisorController.getUIGuidance(
        user as any,
        workspace as any,
        {},
      );

      expect(guidanceResponse.success).toBe(true);
      expect(guidanceResponse.guidance.buttonText).toBe('AI Assistant'); // Default fallback
      expect(guidanceResponse.guidance.actionType).toBe('standard');

      // Try to execute action (should handle gracefully)
      const actionResponse = await supervisorController.executeAction(
        user,
        workspace as any,
        {
          userId: user.id,
          workspaceId: workspace.id,
          actionType: 'chat_button_clicked',
        },
      );

      expect(actionResponse.success).toBe(false);
      expect(actionResponse.error).toContain('No provider found');

      // Verify error was tracked in analytics
      const metrics = await analyticsService.getMetrics({
        userId: user.id,
        workspaceId: workspace.id,
        timeRange: '1h',
      });

      expect(metrics.systemHealth.errorRate).toBeGreaterThan(0);
    });

    it('should handle concurrent requests efficiently', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Make 10 concurrent UI guidance requests
      const promises = Array(10)
        .fill(null)
        .map(() =>
          supervisorController.getUIGuidance(user, workspace as any, {}),
        );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.success).toBe(true);
        expect(response.guidance).toBeDefined();
      });

      // Should have efficient caching (most should be cache hits)
      const cacheHits = responses.filter((r) => r.metadata?.cacheHit).length;

      expect(cacheHits).toBeGreaterThan(5); // At least half should be cache hits

      // Performance should be good
      const avgExecutionTime =
        responses.reduce(
          (sum, r) => sum + (r.metadata?.executionTime || 0),
          0,
        ) / responses.length;

      expect(avgExecutionTime).toBeLessThan(100); // Should be under 100ms on average
    });
  });

  describe('Caching Integration', () => {
    it('should implement proper cache TTL behavior', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Set initial status
      const initialStatus = BusinessSetupStatus.WELCOME;

      await cacheService.setStatus(user.id, workspace.id, initialStatus);

      // Get status (should be from cache)
      const cachedStatus = await cacheService.getStatus(user.id, workspace.id);

      expect(cachedStatus).toEqual(initialStatus);

      // Invalidate cache
      await cacheService.invalidateCache(user.id, workspace.id);

      // Get status again (should trigger database query)
      const freshStatus = await cacheService.getStatus(user.id, workspace.id);

      expect(freshStatus).toBeDefined();

      // Verify cache miss was tracked
      const isCacheHit = cacheService.isCacheHit;

      expect(isCacheHit).toBe(true); // Should be cached again
    });

    it('should handle cache invalidation events properly', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      let eventEmitted = false;

      eventEmitter.on('cache.invalidated', (data) => {
        expect(data.userId).toBe(user.id);
        expect(data.workspaceId).toBe(workspace.id);
        expect(data.type).toBe('business_setup_status');
        eventEmitted = true;
      });

      // Set and then invalidate cache
      await cacheService.setStatus(
        user.id,
        workspace.id,
        BusinessSetupStatus.WELCOME,
      );

      await cacheService.invalidateCache(user.id, workspace.id);

      // Give event time to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(eventEmitted).toBe(true);
    });
  });

  describe('Provider Registry Integration', () => {
    it('should handle provider registration and routing correctly', async () => {
      // Verify initial provider registration
      const providers = providerRegistry.getAllProviders();

      expect(providers.length).toBeGreaterThan(0);

      const avitoProvider = providers.find((p) =>
        p.providerId.includes('avito'),
      );

      expect(avitoProvider).toBeTruthy();

      // Test provider selection
      const selectedProvider = providerRegistry.findProvider(
        avitoProvider?.providerId || 'avito',
      );

      expect(selectedProvider).toBeTruthy();
      expect(selectedProvider?.providerId).toBe(avitoProvider?.providerId);

      // Test provider capabilities
      const providerConfig = selectedProvider?.getProviderConfig();

      expect(providerConfig).toBeDefined();
      expect(providerConfig?.requiredCredentials).toBeDefined();
      expect(providerConfig?.capabilities).toBeDefined();
    });

    it('should handle provider failures gracefully', async () => {
      // Create a failing provider
      const failingProvider = {
        providerId: 'failing-provider',
        displayName: 'Failing Provider',
        supportedStatuses: [BusinessSetupStatus.WELCOME],
        icon: '❌',
        description: 'Test failing provider',

        async validateCredentials(): Promise<any> {
          throw new Error('Provider failure');
        },

        async setupBusiness(): Promise<any> {
          throw new Error('Setup failed');
        },

        async processRequest(): Promise<any> {
          throw new Error('Request processing failed');
        },

        getSetupSteps(): any[] {
          return [];
        },

        getProviderConfig(): any {
          return {
            requiredCredentials: [],
            optionalCredentials: [],
            apiEndpoints: [],
            capabilities: [],
          };
        },

        // Add missing required methods
        supportsStatus(status: BusinessSetupStatus): boolean {
          return this.supportedStatuses.includes(status);
        },

        async getHealthStatus(): Promise<{
          isHealthy: boolean;
          lastChecked: Date;
          error?: string;
        }> {
          return {
            isHealthy: false,
            lastChecked: new Date(),
            error: 'Provider is failing',
          };
        },
      };

      providerRegistry.registerProvider(failingProvider);

      // Should find working provider, not the failing one
      const selectedProvider = providerRegistry.findProvider('avito');

      expect(selectedProvider?.providerId).not.toBe('failing-provider');
    });
  });

  describe('Analytics Integration', () => {
    it('should track comprehensive metrics across all services', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Generate activity to track
      await supervisorController.getUIGuidance(
        user as any,
        workspace as any,
        {},
      );
      await supervisorController.executeAction(user as any, workspace as any, {
        userId: user.id,
        workspaceId: workspace.id,
        actionType: 'chat_button_clicked',
      });

      // Get comprehensive metrics
      const metrics = await analyticsService.getMetrics({
        userId: user.id,
        workspaceId: workspace.id,
        timeRange: '1h',
      });

      // Verify all metric categories are present
      expect(metrics.routing).toBeDefined();
      expect(metrics.uiGuidance).toBeDefined();
      expect(metrics.actionExecution).toBeDefined();
      expect(metrics.systemHealth).toBeDefined();

      // Verify specific metrics
      expect(metrics.routing.totalRequests).toBeGreaterThan(0);
      expect(metrics.uiGuidance.totalGuidanceRequests).toBeGreaterThan(0);
      expect(metrics.systemHealth.performanceScore).toBeGreaterThan(0);

      // Test performance calculations
      const routingAccuracy = analyticsService.getRoutingAccuracy('1h');

      expect(routingAccuracy).toBeGreaterThanOrEqual(0);
      expect(routingAccuracy).toBeLessThanOrEqual(100);

      const avgResponseTime = analyticsService.getAverageResponseTime(
        'ui_guidance_request',
        '1h',
      );

      expect(avgResponseTime).toBeGreaterThan(0);
    });

    it('should provide accurate provider performance metrics', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      // Generate provider-specific activity
      for (let i = 0; i < 5; i++) {
        await supervisorController.executeAction(
          user as any,
          workspace as any,
          {
            userId: user.id,
            workspaceId: workspace.id,
            actionType: 'test_action',
          },
        );
      }

      const providerPerformance = analyticsService.getProviderPerformance('1h');

      // Should have provider metrics
      const providerIds = Object.keys(providerPerformance);

      expect(providerIds.length).toBeGreaterThan(0);

      providerIds.forEach((providerId) => {
        const perf = providerPerformance[providerId];

        expect(perf.totalRequests).toBeGreaterThan(0);
        expect(perf.averageTime).toBeGreaterThan(0);
        expect(perf.successRate).toBeGreaterThanOrEqual(0);
        expect(perf.successRate).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Progress Streaming Integration', () => {
    it('should handle real-time progress updates', async () => {
      const operationId = 'test-operation-123';

      // Start progress tracking
      progressService.startOperation(operationId, 'Test operation', 3);

      // Create progress stream
      const progressStream = progressService.createProgressStream(operationId);

      const progressUpdates: any[] = [];

      // Subscribe to progress updates
      const subscription = progressStream.subscribe({
        next: (update) => {
          const progressData = JSON.parse(update.data);

          progressUpdates.push(progressData);
        },
        error: (error) => {
          console.error('Progress stream error:', error);
        },
      });

      // Simulate progress updates
      progressService.updateProgress(
        operationId,
        'Step 1',
        33,
        'Processing first step',
      );
      progressService.updateProgress(
        operationId,
        'Step 2',
        66,
        'Processing second step',
      );
      progressService.completeOperation(
        operationId,
        'Operation completed successfully',
      );

      // Wait for updates to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      subscription.unsubscribe();

      // Verify progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);

      const startUpdate = progressUpdates.find((u) => u.status === 'started');
      const completeUpdate = progressUpdates.find(
        (u) => u.status === 'completed',
      );

      expect(startUpdate).toBeTruthy();
      expect(completeUpdate).toBeTruthy();
      expect(completeUpdate.progress).toBe(100);
    });

    it('should clean up completed operations', async () => {
      const operationId = 'cleanup-test-operation';

      // Start and complete operation
      progressService.startOperation(operationId, 'Test cleanup', 1);
      progressService.completeOperation(operationId, 'Done');

      // Verify operation is in active list
      const activeOps = progressService.getActiveOperationIds();

      expect(activeOps).toContain(operationId);

      // Manually trigger cleanup
      progressService.cleanupOperation(operationId);

      // Verify operation is cleaned up
      const activeOpsAfter = progressService.getActiveOperationIds();

      expect(activeOpsAfter).not.toContain(operationId);
    });
  });

  describe('End-to-End Performance', () => {
    it('should maintain good performance under load', async () => {
      const user = new MockUser();
      const workspace = new MockWorkspace();

      const startTime = Date.now();

      // Make 50 concurrent requests
      const promises = Array(50)
        .fill(null)
        .map(async (_, index) => {
          const response = await supervisorController.getUIGuidance(
            user as any,
            workspace as any,
            {},
          );

          return response;
        });

      const responses = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.success).toBe(true);
      });

      // Performance should be acceptable
      const totalTime = endTime - startTime;
      const avgTimePerRequest = totalTime / responses.length;

      expect(avgTimePerRequest).toBeLessThan(50); // Should be under 50ms per request

      // Cache hit rate should be high
      const cacheHits = responses.filter((r) => r.metadata?.cacheHit).length;
      const cacheHitRate = (cacheHits / responses.length) * 100;

      expect(cacheHitRate).toBeGreaterThan(80); // Should have >80% cache hit rate
    });

    it('should handle resource cleanup properly', async () => {
      const initialActiveOps = progressService.getActiveOperationsCount();

      // Create multiple operations
      const operationIds = Array(10)
        .fill(null)
        .map((_, i) => `op-${i}`);

      operationIds.forEach((id) => {
        progressService.startOperation(id, `Operation ${id}`, 1);
      });

      expect(progressService.getActiveOperationsCount()).toBe(
        initialActiveOps + 10,
      );

      // Complete all operations
      operationIds.forEach((id) => {
        progressService.completeOperation(id, 'Done');
      });

      // Wait for auto-cleanup (30 seconds in real code, but we'll force it)
      operationIds.forEach((id) => {
        progressService.cleanupOperation(id);
      });

      expect(progressService.getActiveOperationsCount()).toBe(initialActiveOps);
    });
  });
});

// Additional integration tests for specific scenarios
describe('Supervisor Architecture - Error Recovery Integration', () => {
  let module: TestingModule;
  let cacheService: BusinessSetupStatusCacheService;
  let analyticsService: SupervisorAnalyticsService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        BusinessSetupStatusCacheService,
        SupervisorAnalyticsService,
        EventEmitter2,
        {
          provide: 'RedisService',
          useValue: new MockRedisService(),
        },
      ],
    }).compile();

    cacheService = module.get<BusinessSetupStatusCacheService>(
      BusinessSetupStatusCacheService,
    );
    analyticsService = module.get<SupervisorAnalyticsService>(
      SupervisorAnalyticsService,
    );
  });

  it('should recover from redis failures gracefully', async () => {
    // Simulate redis failure by throwing error
    const failingRedisService = {
      get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      setex: jest.fn().mockRejectedValue(new Error('Redis write failed')),
      del: jest.fn().mockRejectedValue(new Error('Redis delete failed')),
    };

    // Create service with failing redis
    const failingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupStatusCacheService,
        EventEmitter2,
        {
          provide: 'RedisService',
          useValue: failingRedisService,
        },
      ],
    }).compile();

    const failingCacheService =
      failingModule.get<BusinessSetupStatusCacheService>(
        BusinessSetupStatusCacheService,
      );

    // Should fallback to database query without throwing
    const status = await failingCacheService.getStatus(
      'user123',
      'workspace456',
    );

    expect(status).toBeDefined();
    // Should have called database fallback
    expect(failingRedisService.get).toHaveBeenCalled();
  });
});
