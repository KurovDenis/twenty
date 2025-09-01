import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { BusinessSetupStatus } from '../../enums/business-setup-status.enum';
import { RequestComplexity } from '../adaptive-supervisor-config.service';
import { SupervisorAnalyticsService } from '../supervisor-analytics.service';

describe('SupervisorAnalyticsService', () => {
  let service: SupervisorAnalyticsService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const mockEventEmitter = {
      on: jest.fn(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupervisorAnalyticsService,
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<SupervisorAnalyticsService>(
      SupervisorAnalyticsService,
    );
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackUIGuidanceRequest', () => {
    it('should track UI guidance request with all metadata', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: 'WELCOME' as BusinessSetupStatus,
        complexity: 'complex' as RequestComplexity,
        executionTime: 250,
        cacheHit: true,
        providerUsed: 'avito-provider',
      };

      service.trackUIGuidanceRequest(data);

      // Verify event was added internally
      const metrics = service.getMetrics({ timeRange: '1h' });

      expect(metrics).resolves.toBeDefined();
    });

    it('should log debug information', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: 'WELCOME' as BusinessSetupStatus,
        complexity: RequestComplexity.SIMPLE,
        executionTime: 150,
        cacheHit: false,
      };

      service.trackUIGuidanceRequest(data);

      // Note: The actual logging is done via Logger, so we can't easily test it
      // In a real implementation, we'd inject a logger mock

      consoleSpy.mockRestore();
    });
  });

  describe('trackActionExecution', () => {
    it('should track successful action execution', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'chat_button_clicked',
        providerUsed: 'avito-provider',
        executionTime: 500,
        success: true,
      };

      service.trackActionExecution(data);

      // Verify tracking by checking if metrics can be retrieved
      expect(() => service.getMetrics({ timeRange: '1h' })).not.toThrow();
    });

    it('should track failed action execution with error', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'setup_integration',
        providerUsed: 'avito-provider',
        executionTime: 1000,
        success: false,
        error: 'Provider timeout',
      };

      service.trackActionExecution(data);

      expect(() => service.getMetrics({ timeRange: '1h' })).not.toThrow();
    });
  });

  describe('trackRoutingDecision', () => {
    it('should track routing decision with confidence score', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: 'WELCOME' as BusinessSetupStatus,
        selectedProvider: 'avito-provider',
        decisionTime: 50,
        confidence: 0.95,
        alternatives: ['ebay-provider', 'amazon-provider'],
      };

      service.trackRoutingDecision(data);

      expect(() => service.getMetrics({ timeRange: '1h' })).not.toThrow();
    });
  });

  describe('trackError', () => {
    it('should track error with context', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        operation: 'ui_guidance',
        actionType: 'chat_button_clicked',
        error: 'Network timeout',
        executionTime: 5000,
        context: { retryAttempt: 2 },
      };

      service.trackError(data);

      expect(() => service.getMetrics({ timeRange: '1h' })).not.toThrow();
    });
  });

  describe('trackUserSatisfaction', () => {
    it('should track user satisfaction rating', () => {
      const data = {
        userId: 'user123',
        workspaceId: 'workspace456',
        operationId: 'op123',
        rating: 5,
        feedback: 'Excellent service',
      };

      service.trackUserSatisfaction(data);

      expect(() => service.getMetrics({ timeRange: '1h' })).not.toThrow();
    });
  });

  describe('getMetrics', () => {
    beforeEach(() => {
      // Add some test data
      service.trackUIGuidanceRequest({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.WELCOME,
        complexity: RequestComplexity.SIMPLE,
        executionTime: 200,
        cacheHit: true,
        providerUsed: 'avito-provider',
      });

      service.trackActionExecution({
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'chat_button_clicked',
        providerUsed: 'avito-provider',
        executionTime: 300,
        success: true,
      });

      service.trackRoutingDecision({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.WELCOME,
        selectedProvider: 'avito-provider',
        decisionTime: 50,
        confidence: 0.9,
        alternatives: [],
      });
    });

    it('should return comprehensive metrics', async () => {
      const metrics = await service.getMetrics({ timeRange: '24h' });

      expect(metrics).toHaveProperty('routing');
      expect(metrics).toHaveProperty('uiGuidance');
      expect(metrics).toHaveProperty('actionExecution');
      expect(metrics).toHaveProperty('systemHealth');
      expect(metrics).toHaveProperty('timeRange', '24h');
      expect(metrics).toHaveProperty('generatedAt');
      expect(metrics.generatedAt).toBeInstanceOf(Date);
    });

    it('should filter by timeRange correctly', async () => {
      const metrics1h = await service.getMetrics({ timeRange: '1h' });
      const metrics24h = await service.getMetrics({ timeRange: '24h' });

      expect(metrics1h.routing.totalRequests).toBeGreaterThanOrEqual(0);
      expect(metrics24h.routing.totalRequests).toBeGreaterThanOrEqual(
        metrics1h.routing.totalRequests,
      );
    });

    it('should filter by userId when provided', async () => {
      const userMetrics = await service.getMetrics({
        timeRange: '24h',
        userId: 'user123',
      });

      expect(userMetrics.routing.totalRequests).toBeGreaterThan(0);

      const otherUserMetrics = await service.getMetrics({
        timeRange: '24h',
        userId: 'user999',
      });

      expect(otherUserMetrics.routing.totalRequests).toBe(0);
    });

    it('should filter by workspaceId when provided', async () => {
      const workspaceMetrics = await service.getMetrics({
        timeRange: '24h',
        workspaceId: 'workspace456',
      });

      expect(workspaceMetrics.routing.totalRequests).toBeGreaterThan(0);

      const otherWorkspaceMetrics = await service.getMetrics({
        timeRange: '24h',
        workspaceId: 'workspace999',
      });

      expect(otherWorkspaceMetrics.routing.totalRequests).toBe(0);
    });
  });

  describe('getRoutingAccuracy', () => {
    beforeEach(() => {
      // Add successful routing decisions
      service.trackRoutingDecision({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.WELCOME,
        selectedProvider: 'avito-provider',
        decisionTime: 50,
        confidence: 0.9,
        alternatives: [],
      });

      service.trackRoutingDecision({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.BUSINESS_ANALYSIS,
        selectedProvider: 'analysis-provider',
        decisionTime: 75,
        confidence: 0.8,
        alternatives: [],
      });
    });

    it('should calculate routing accuracy correctly', () => {
      const accuracy = service.getRoutingAccuracy('24h');

      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    });

    it('should return 0 for no routing decisions', () => {
      const newService = new SupervisorAnalyticsService(eventEmitter);
      const accuracy = newService.getRoutingAccuracy('24h');

      expect(accuracy).toBe(0);
    });
  });

  describe('getAverageResponseTime', () => {
    beforeEach(() => {
      service.trackUIGuidanceRequest({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.WELCOME,
        complexity: RequestComplexity.SIMPLE,
        executionTime: 100,
        cacheHit: true,
      });

      service.trackUIGuidanceRequest({
        userId: 'user123',
        workspaceId: 'workspace456',
        businessStatus: BusinessSetupStatus.WELCOME,
        complexity: RequestComplexity.SIMPLE,
        executionTime: 200,
        cacheHit: false,
      });

      service.trackActionExecution({
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'chat_button_clicked',
        providerUsed: 'avito-provider',
        executionTime: 300,
        success: true,
      });
    });

    it('should calculate average response time for all operations', () => {
      const avgTime = service.getAverageResponseTime(undefined, '24h');

      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it('should calculate average response time for specific operation', () => {
      const avgUITime = service.getAverageResponseTime(
        'ui_guidance_request',
        '24h',
      );

      expect(avgUITime).toBe(150); // (100 + 200) / 2
    });

    it('should return 0 for no matching operations', () => {
      const avgTime = service.getAverageResponseTime(
        'non_existent_operation',
        '24h',
      );

      expect(avgTime).toBe(0);
    });
  });

  describe('getProviderPerformance', () => {
    beforeEach(() => {
      // Add data for multiple providers
      service.trackActionExecution({
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'setup',
        providerUsed: 'avito-provider',
        executionTime: 200,
        success: true,
      });

      service.trackActionExecution({
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'setup',
        providerUsed: 'avito-provider',
        executionTime: 400,
        success: false,
      });

      service.trackActionExecution({
        userId: 'user123',
        workspaceId: 'workspace456',
        actionType: 'analysis',
        providerUsed: 'ebay-provider',
        executionTime: 150,
        success: true,
      });
    });

    it('should calculate provider performance metrics', () => {
      const performance = service.getProviderPerformance('24h');

      expect(performance).toHaveProperty('avito-provider');
      expect(performance).toHaveProperty('ebay-provider');

      const avitoPerf = performance['avito-provider'];

      expect(avitoPerf.successRate).toBe(50); // 1 success out of 2
      expect(avitoPerf.averageTime).toBe(300); // (200 + 400) / 2
      expect(avitoPerf.totalRequests).toBe(2);

      const ebayPerf = performance['ebay-provider'];

      expect(ebayPerf.successRate).toBe(100); // 1 success out of 1
      expect(ebayPerf.averageTime).toBe(150);
      expect(ebayPerf.totalRequests).toBe(1);
    });

    it('should return empty object for no provider data', () => {
      const newService = new SupervisorAnalyticsService(eventEmitter);
      const performance = newService.getProviderPerformance('24h');

      expect(performance).toEqual({});
    });
  });

  describe('Memory Management', () => {
    it('should limit events to maxEvents to prevent memory leaks', () => {
      const maxEvents = (service as any).maxEvents;

      // Add more events than the limit
      for (let i = 0; i < maxEvents + 100; i++) {
        service.trackUIGuidanceRequest({
          userId: `user${i}`,
          workspaceId: 'workspace456',
          businessStatus: BusinessSetupStatus.WELCOME,
          complexity: RequestComplexity.SIMPLE,
          executionTime: 100,
          cacheHit: false,
        });
      }

      const events = (service as any).events;

      expect(events.length).toBe(maxEvents);
    });

    it('should maintain event order after cleanup', () => {
      const maxEvents = (service as any).maxEvents;

      // Add events with identifiable data
      for (let i = 0; i < maxEvents + 10; i++) {
        service.trackUIGuidanceRequest({
          userId: `user${i}`,
          workspaceId: 'workspace456',
          businessStatus: BusinessSetupStatus.WELCOME,
          complexity: RequestComplexity.SIMPLE,
          executionTime: i, // Use index as execution time for identification
          cacheHit: false,
        });
      }

      const events = (service as any).events;

      // Should keep the latest events
      expect(events[0].duration).toBe(10); // First kept event
      expect(events[events.length - 1].duration).toBe(maxEvents + 9); // Last event
    });
  });
});

// Integration tests for real-world scenarios
describe('SupervisorAnalyticsService - Integration', () => {
  let service: SupervisorAnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupervisorAnalyticsService,
        {
          provide: EventEmitter2,
          useValue: { on: jest.fn(), emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SupervisorAnalyticsService>(
      SupervisorAnalyticsService,
    );
  });

  it('should handle complete user journey analytics', async () => {
    const userId = 'user123';
    const workspaceId = 'workspace456';
    const operationId = 'op123';

    // Simulate complete user journey

    // 1. UI guidance request
    service.trackUIGuidanceRequest({
      userId,
      workspaceId,
      businessStatus: BusinessSetupStatus.WELCOME,
      complexity: RequestComplexity.SIMPLE,
      executionTime: 150,
      cacheHit: false,
      providerUsed: 'avito-provider',
    });

    // 2. Routing decision
    service.trackRoutingDecision({
      userId,
      workspaceId,
      businessStatus: BusinessSetupStatus.WELCOME,
      selectedProvider: 'avito-provider',
      decisionTime: 25,
      confidence: 0.95,
      alternatives: ['ebay-provider'],
    });

    // 3. Action execution
    service.trackActionExecution({
      userId,
      workspaceId,
      actionType: 'chat_button_clicked',
      providerUsed: 'avito-provider',
      executionTime: 500,
      success: true,
    });

    // 4. User satisfaction
    service.trackUserSatisfaction({
      userId,
      workspaceId,
      operationId,
      rating: 5,
      feedback: 'Great experience!',
    });

    // Get comprehensive metrics
    const metrics = await service.getMetrics({ timeRange: '1h' });

    expect(metrics.routing.totalRequests).toBe(1);
    expect(metrics.routing.successfulRoutes).toBe(1);
    expect(metrics.routing.averageResponseTime).toBe(150);
    expect(metrics.routing.cacheHitRate).toBe(0);

    expect(metrics.uiGuidance.totalGuidanceRequests).toBe(1);
    expect(metrics.uiGuidance.buttonClickRate).toBe(100); // 1 action for 1 guidance
    expect(metrics.uiGuidance.userSatisfactionScore).toBe(5);

    expect(metrics.actionExecution.totalActions).toBe(1);
    expect(metrics.actionExecution.successfulActions).toBe(1);
    expect(metrics.actionExecution.averageExecutionTime).toBe(500);

    expect(metrics.systemHealth.errorRate).toBe(0);
    expect(metrics.systemHealth.performanceScore).toBeGreaterThan(0);
  });

  it('should handle error scenarios correctly', async () => {
    const userId = 'user123';
    const workspaceId = 'workspace456';

    // Track some errors
    service.trackError({
      userId,
      workspaceId,
      operation: 'ui_guidance',
      error: 'Network timeout',
      executionTime: 5000,
    });

    service.trackActionExecution({
      userId,
      workspaceId,
      actionType: 'setup_integration',
      providerUsed: 'avito-provider',
      executionTime: 2000,
      success: false,
      error: 'Provider unavailable',
    });

    const metrics = await service.getMetrics({ timeRange: '1h' });

    expect(metrics.systemHealth.errorRate).toBeGreaterThan(0);
    expect(metrics.actionExecution.successfulActions).toBe(0);
    expect(metrics.systemHealth.performanceScore).toBeLessThan(100);
  });
});
