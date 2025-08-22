import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import IORedis from 'ioredis';
import { RedisClientService } from 'src/engine/core-modules/redis-client/redis-client.service';
import { BUSINESS_SETUP_EVENTS } from 'twenty-shared/types';
import { AIAgentEventsService } from './ai-agent-events.service';

describe('AIAgentEventsService', () => {
  let service: AIAgentEventsService;
  let redisClientService: RedisClientService;
  let mockRedis: jest.Mocked<IORedis>;

  beforeEach(async () => {
    // Mock Redis client
    mockRedis = {
      setex: jest.fn(),
      lpush: jest.fn(),
      ltrim: jest.fn(),
      expire: jest.fn(),
      lrange: jest.fn(),
      pipeline: jest.fn(),
      get: jest.fn(),
    } as any;

    const mockPipeline = {
      exec: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
    };

    mockRedis.pipeline.mockReturnValue(mockPipeline as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIAgentEventsService,
        {
          provide: RedisClientService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedis),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AIAgentEventsService>(AIAgentEventsService);
    redisClientService = module.get<RedisClientService>(RedisClientService);

    // Mock logger to avoid noise in tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  describe('handleWelcomeChatCreated', () => {
    it('should store welcome chat created event in Redis', async () => {
      const mockPayload = {
        userId: 'user-123',
        workspaceId: 'workspace-456',
        threadId: 'thread-789',
        aiResponse: 'Welcome to the system!',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
      };

      await service.handleWelcomeChatCreated(mockPayload);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^ai-agent-events:events:event-/),
        3600, // TTL
        expect.stringContaining('"type":"' + BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED + '"')
      );

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        'ai-agent-events:users:user-123:workspace-456',
        expect.stringMatching(/^event-/)
      );

      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        'ai-agent-events:users:user-123:workspace-456',
        0,
        49 // MAX_EVENTS_PER_USER - 1
      );

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'ai-agent-events:users:user-123:workspace-456',
        3600
      );
    });
  });

  describe('handleWelcomeChatCreationFailed', () => {
    it('should store welcome chat creation failed event in Redis', async () => {
      const mockPayload = {
        userId: 'user-123',
        workspaceId: 'workspace-456',
        error: 'Network timeout',
        attempts: 3,
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
      };

      await service.handleWelcomeChatCreationFailed(mockPayload);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^ai-agent-events:events:event-/),
        3600,
        expect.stringContaining('"type":"' + BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_FAILED + '"')
      );

      expect(mockRedis.lpush).toHaveBeenCalled();
      expect(mockRedis.ltrim).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('handleWelcomeChatCreationStarted', () => {
    it('should store welcome chat creation started event in Redis', async () => {
      const mockPayload = {
        userId: 'user-123',
        workspaceId: 'workspace-456',
        timestamp: new Date('2023-01-01T00:00:00.000Z'),
      };

      await service.handleWelcomeChatCreationStarted(mockPayload);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^ai-agent-events:events:event-/),
        3600,
        expect.stringContaining('"type":"' + BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED + '"')
      );
    });
  });

  describe('getEventsForUser', () => {
    it('should retrieve and return events for a user', async () => {
      const mockEventIds = ['event-1', 'event-2'];
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-123',
          workspaceId: 'workspace-456',
          type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
          payload: { message: 'Hello' },
          timestamp: new Date('2023-01-01T00:05:00.000Z'),
          consumed: false,
        },
        {
          id: 'event-2',
          userId: 'user-123',
          workspaceId: 'workspace-456',
          type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED,
          payload: {},
          timestamp: new Date('2023-01-01T00:03:00.000Z'),
          consumed: false,
        },
      ];

      const since = new Date('2023-01-01T00:00:00.000Z');

      mockRedis.lrange.mockResolvedValue(mockEventIds);
      
      const mockPipeline = {
        get: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, JSON.stringify(mockEvents[0])],
          [null, JSON.stringify(mockEvents[1])],
        ]),
        setex: jest.fn(),
      };
      
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await service.getEventsForUser('user-123', 'workspace-456', since);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
        payload: { message: 'Hello' },
        timestamp: '2023-01-01T00:05:00.000Z',
      });
      expect(result[1]).toEqual({
        type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED,
        payload: {},
        timestamp: '2023-01-01T00:03:00.000Z',
      });
    });

    it('should filter events by timestamp', async () => {
      const mockEventIds = ['event-1', 'event-2'];
      const mockEvents = [
        {
          id: 'event-1',
          userId: 'user-123',
          workspaceId: 'workspace-456',
          type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED,
          payload: { message: 'Hello' },
          timestamp: new Date('2023-01-01T00:05:00.000Z'), // After 'since'
          consumed: false,
        },
        {
          id: 'event-2',
          userId: 'user-123',
          workspaceId: 'workspace-456',
          type: BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATION_STARTED,
          payload: {},
          timestamp: new Date('2022-12-31T23:59:00.000Z'), // Before 'since'
          consumed: false,
        },
      ];

      const since = new Date('2023-01-01T00:00:00.000Z');

      mockRedis.lrange.mockResolvedValue(mockEventIds);
      
      const mockPipeline = {
        get: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, JSON.stringify(mockEvents[0])],
          [null, JSON.stringify(mockEvents[1])],
        ]),
        setex: jest.fn(),
      };
      
      mockRedis.pipeline.mockReturnValue(mockPipeline as any);

      const result = await service.getEventsForUser('user-123', 'workspace-456', since);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(BUSINESS_SETUP_EVENTS.AI_AGENT_WELCOME_CHAT_CREATED);
    });

    it('should return empty array when no events exist', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      const result = await service.getEventsForUser('user-123', 'workspace-456', new Date());

      expect(result).toEqual([]);
      expect(mockRedis.lrange).toHaveBeenCalledWith('ai-agent-events:users:user-123:workspace-456', 0, -1);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getEventsForUser('user-123', 'workspace-456', new Date());

      expect(result).toEqual([]);
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get events for user user-123'),
        expect.any(Error)
      );
    });
  });

  describe('simulateWelcomeChatCreated', () => {
    it('should create and store a simulated welcome event', async () => {
      await service.simulateWelcomeChatCreated('user-123', 'workspace-456');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^ai-agent-events:events:event-/),
        3600,
        expect.stringContaining('Welcome to Business Setup Wizard!')
      );

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Simulated welcome chat created for user user-123'
      );
    });
  });

  describe('Redis key helpers', () => {
    it('should generate correct user events key', () => {
      const service = new AIAgentEventsService(redisClientService);
      const key = (service as any).getUserEventsKey('user-123', 'workspace-456');
      expect(key).toBe('ai-agent-events:users:user-123:workspace-456');
    });

    it('should generate correct event key', () => {
      const service = new AIAgentEventsService(redisClientService);
      const key = (service as any).getEventKey('event-123');
      expect(key).toBe('ai-agent-events:events:event-123');
    });

    it('should generate unique event IDs', () => {
      const service = new AIAgentEventsService(redisClientService);
      const id1 = (service as any).generateEventId();
      const id2 = (service as any).generateEventId();
      
      expect(id1).toMatch(/^event-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^event-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });
});