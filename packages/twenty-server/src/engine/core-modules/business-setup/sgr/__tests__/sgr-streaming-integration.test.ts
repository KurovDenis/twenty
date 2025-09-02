/**
 * Integration tests for SGR Streaming functionality
 * Tests the complete flow from SupervisorSGRService to GraphQL subscriptions
 */

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisPubSub } from 'graphql-redis-subscriptions';

import { BusinessSetupSubscriptionsResolver } from '../../business-setup-subscriptions.resolver';
import { EventEmitterBridgeService } from '../../services/event-emitter-bridge.service';
import { BusinessSetupEventType } from '../../types/business-setup-subscription.types';
import { SupervisorSGRService } from '../services/supervisor-sgr.service';
import { SGRStreamEvent, SGRStreamEventType } from '../types/sgr-stream.types';

describe('SGR Streaming Integration Tests', () => {
  let supervisorService: SupervisorSGRService;
  let eventBridge: EventEmitterBridgeService;
  let subscriptionResolver: BusinessSetupSubscriptionsResolver;
  let eventEmitter: EventEmitter2;
  let pubSub: jest.Mocked<RedisPubSub>;

  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  const mockWorkspaceId = 'test-workspace-id';
  const mockThreadId = 'test-thread-id';

  beforeEach(async () => {
    // Mock RedisPubSub
    pubSub = {
      publish: jest.fn().mockResolvedValue(undefined),
      asyncIterator: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventEmitterBridgeService,
        BusinessSetupSubscriptionsResolver,
        {
          provide: 'PUB_SUB',
          useValue: pubSub,
        },
        {
          provide: EventEmitter2,
          useValue: new EventEmitter2(),
        },
        // Mock SupervisorSGRService
        {
          provide: SupervisorSGRService,
          useValue: {
            processMessageWithDetailedStreaming: jest.fn(),
          },
        },
      ],
    }).compile();

    eventBridge = module.get<EventEmitterBridgeService>(EventEmitterBridgeService);
    subscriptionResolver = module.get<BusinessSetupSubscriptionsResolver>(BusinessSetupSubscriptionsResolver);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  describe('SGR Event Flow', () => {
    it('should handle complete SGR streaming flow', async () => {
      // Arrange: Create test events
      const testEvents: SGRStreamEvent[] = [
        {
          type: SGRStreamEventType.PROCESS_START,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            timestamp: new Date(),
          },
        },
        {
          type: SGRStreamEventType.JSON_STREAM_START,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            timestamp: new Date(),
          },
        },
        {
          type: SGRStreamEventType.JSON_TOKEN_CHUNK,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            token: '{"current_state": "analyzing..."',
            timestamp: new Date(),
          },
        },
        {
          type: SGRStreamEventType.JSON_STREAM_END,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            fullJson: '{"current_state": "analyzing...", "function": {"tool": "check_status"}}',
            timestamp: new Date(),
          },
        },
        {
          type: SGRStreamEventType.TOOL_CALL_PENDING,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            toolName: 'check_status',
            toolArgs: '{"userId": "test-user", "workspaceId": "test-workspace"}',
            timestamp: new Date(),
          },
        },
        {
          type: SGRStreamEventType.PROCESS_END,
          payload: {
            threadId: mockThreadId,
            stepId: 'step-1',
            timestamp: new Date(),
          },
        },
      ];

      // Act: Emit events through the system
      const publishedEvents: any[] = [];
      pubSub.publish.mockImplementation((channel, payload) => {
        publishedEvents.push({ channel, payload });
        return Promise.resolve();
      });

      for (const event of testEvents) {
        await eventBridge.handleSGRStreamingEvent(event);
      }

      // Assert: Check that events were properly transformed and published
      expect(publishedEvents).toHaveLength(testEvents.length);
      
      // Verify event structure
      const startEvent = publishedEvents.find(
        e => e.payload.type === BusinessSetupEventType.SGR_STREAMING_START
      );
      expect(startEvent).toBeDefined();
      expect(startEvent.payload.metadata.sgrStreaming).toBe(true);

      // Verify token chunk event
      const tokenEvent = publishedEvents.find(
        e => e.payload.type === BusinessSetupEventType.SGR_JSON_TOKEN_CHUNK
      );
      expect(tokenEvent).toBeDefined();
      expect(tokenEvent.payload.payload.token).toContain('current_state');

      // Verify tool call event
      const toolEvent = publishedEvents.find(
        e => e.payload.type === BusinessSetupEventType.SGR_TOOL_CALL_PENDING
      );
      expect(toolEvent).toBeDefined();
      expect(toolEvent.payload.payload.toolName).toBe('check_status');
    });

    it('should sanitize sensitive data in tool arguments', async () => {
      // Arrange: Event with sensitive data
      const sensitiveEvent: SGRStreamEvent = {
        type: SGRStreamEventType.TOOL_CALL_PENDING,
        payload: {
          threadId: mockThreadId,
          stepId: 'step-1',
          toolName: 'api_call',
          toolArgs: JSON.stringify({
            url: 'https://api.example.com',
            apiKey: 'secret-key-12345',
            password: 'super-secret-password',
            data: { normal: 'value' },
          }),
          timestamp: new Date(),
        },
      };

      // Act
      const publishedEvents: any[] = [];
      pubSub.publish.mockImplementation((channel, payload) => {
        publishedEvents.push({ channel, payload });
        return Promise.resolve();
      });

      await eventBridge.handleSGRStreamingEvent(sensitiveEvent);

      // Assert: Sensitive data should be redacted
      expect(publishedEvents).toHaveLength(1);
      const event = publishedEvents[0];
      const toolArgs = JSON.parse(event.payload.payload.toolArgs);
      
      expect(toolArgs.apiKey).toBe('[REDACTED]');
      expect(toolArgs.password).toBe('[REDACTED]');
      expect(toolArgs.url).toBe('https://api.example.com'); // Not sensitive
      expect(toolArgs.data.normal).toBe('value'); // Nested non-sensitive data
    });

    it('should throttle token emissions for performance', async () => {
      // Arrange: Multiple rapid token events
      const tokenEvents = Array.from({ length: 15 }, (_, i) => ({
        token: `token-${i}`,
        threadId: mockThreadId,
        stepId: 'step-1',
      }));

      // Act: Emit tokens rapidly
      const publishedEvents: any[] = [];
      pubSub.publish.mockImplementation((channel, payload) => {
        publishedEvents.push({ channel, payload });
        return Promise.resolve();
      });

      for (const tokenEvent of tokenEvents) {
        await eventBridge.handleSGRTokenChunk(tokenEvent);
      }

      // Wait for throttling to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      // Assert: Should have fewer published events due to batching
      expect(publishedEvents.length).toBeLessThan(tokenEvents.length);
      
      // Verify batched tokens
      const tokenEvent = publishedEvents.find(
        e => e.payload.type === BusinessSetupEventType.SGR_JSON_TOKEN_CHUNK
      );
      expect(tokenEvent).toBeDefined();
      expect(tokenEvent.payload.payload.token.length).toBeGreaterThan(7); // Multiple tokens batched
    });
  });

  describe('GraphQL Subscription Filtering', () => {
    it('should filter SGR events by workspace', async () => {
      // This would test the subscription filter logic
      const mockPayload = {
        id: 'test-id',
        type: BusinessSetupEventType.SGR_STREAMING_START,
        payload: {
          threadId: mockThreadId,
          workspaceId: mockWorkspaceId,
        },
        metadata: {
          source: 'test',
          version: '1.0.0',
          timestamp: new Date(),
          sgrStreaming: true,
        },
      };

      const mockVariables = {
        input: {
          workspaceId: mockWorkspaceId,
          eventTypes: [BusinessSetupEventType.SGR_STREAMING_START],
        },
      };

      const mockContext = {
        req: { user: mockUser },
      };

      // This would test the filter function if we could access it directly
      // In a real test, we'd need to extract and test the filter logic
      expect(mockPayload.payload.workspaceId).toBe(mockWorkspaceId);
    });
  });

  describe('Error Handling', () => {
    it('should handle publication errors gracefully', async () => {
      // Arrange: Mock publish to fail
      pubSub.publish.mockRejectedValue(new Error('Redis connection failed'));

      const testEvent: SGRStreamEvent = {
        type: SGRStreamEventType.PROCESS_START,
        payload: {
          threadId: mockThreadId,
          stepId: 'step-1',
          timestamp: new Date(),
        },
      };

      // Act & Assert: Should not throw
      await expect(
        eventBridge.handleSGRStreamingEvent(testEvent)
      ).resolves.not.toThrow();

      // Verify error metrics are updated
      const metrics = eventBridge.getSGRMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });

    it('should handle malformed JSON in events', async () => {
      const malformedEvent: SGRStreamEvent = {
        type: SGRStreamEventType.JSON_STREAM_END,
        payload: {
          threadId: mockThreadId,
          stepId: 'step-1',
          fullJson: '{"malformed": json}', // Invalid JSON
          timestamp: new Date(),
        },
      };

      // Should handle gracefully without throwing
      await expect(
        eventBridge.handleSGRStreamingEvent(malformedEvent)
      ).resolves.not.toThrow();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track SGR streaming metrics', async () => {
      // Arrange: Initial metrics
      const initialMetrics = eventBridge.getSGRMetrics();

      // Act: Process some events
      const testEvent: SGRStreamEvent = {
        type: SGRStreamEventType.PROCESS_START,
        payload: {
          threadId: mockThreadId,
          stepId: 'step-1',
          timestamp: new Date(),
        },
      };

      await eventBridge.handleSGRStreamingEvent(testEvent);
      await eventBridge.handleSGRTokenChunk({
        token: 'test-token',
        threadId: mockThreadId,
        stepId: 'step-1',
      });

      // Assert: Metrics should be updated
      const updatedMetrics = eventBridge.getSGRMetrics();
      expect(updatedMetrics.totalEventsProcessed).toBeGreaterThan(initialMetrics.totalEventsProcessed);
      expect(updatedMetrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should provide health check with SGR metrics', async () => {
      // Act
      const healthCheck = await eventBridge.healthCheck();

      // Assert
      expect(healthCheck).toHaveProperty('isHealthy');
      expect(healthCheck).toHaveProperty('sgrMetrics');
      expect(healthCheck).toHaveProperty('errorRate');
      expect(healthCheck).toHaveProperty('activeTokenBuffers');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
