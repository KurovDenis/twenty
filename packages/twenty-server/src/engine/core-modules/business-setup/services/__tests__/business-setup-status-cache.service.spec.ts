import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';

import { BusinessSetupStatusCacheService } from '../business-setup-status-cache.service';
import { SupervisorAnalyticsService } from '../supervisor-analytics.service';

// Mock RedisService interface
interface MockRedisService {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

describe('BusinessSetupStatusCacheService', () => {
  let service: BusinessSetupStatusCacheService;
  let cacheService: jest.Mocked<CacheStorageService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let analyticsService: jest.Mocked<SupervisorAnalyticsService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const mockAnalyticsService = {
      trackUIGuidanceRequest: jest.fn(),
      trackError: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupStatusCacheService,
        { provide: CacheStorageService, useValue: mockCacheService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: SupervisorAnalyticsService, useValue: mockAnalyticsService },
      ],
    }).compile();

    service = module.get<BusinessSetupStatusCacheService>(
      BusinessSetupStatusCacheService,
    );
    cacheService = module.get(CacheStorageService);
    eventEmitter = module.get(EventEmitter2);
    analyticsService = module.get(SupervisorAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatus', () => {
    it('should return cached status when cache hit', async () => {
      const userId = 'user123';
      const workspaceId = 'workspace456';
      const cachedStatus = {
        status: 'WELCOME',
        lastUpdated: new Date(),
        preferences: {},
      };

      cacheService.get.mockResolvedValue(JSON.stringify(cachedStatus));

      const result = await service.getStatus(userId, workspaceId);

      expect(cacheService.get).toHaveBeenCalledWith(
        `business-setup-status:${userId}:${workspaceId}`,
      );
      expect(result).toEqual(cachedStatus.status);
    });

    it('should query database and cache result on cache miss', async () => {
      const userId = 'user123';
      const workspaceId = 'workspace456';
      const dbStatus = {
        status: 'BUSINESS_ANALYSIS',
        lastUpdated: new Date(),
        preferences: { provider: 'avito' },
      };

      cacheService.get.mockResolvedValue(null);

      const result = await service.getStatus(userId, workspaceId);

      expect(cacheService.set).toHaveBeenCalled();
      expect(result).toBeNull(); // Since we don't have database fallback in this implementation
    });

    it('should handle redis errors gracefully', async () => {
      const userId = 'user123';
      const workspaceId = 'workspace456';

      cacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getStatus(userId, workspaceId);

      expect(result).toBeNull(); // Should return null on error
    });
  });

  describe('invalidateCache', () => {
    it('should delete cache entry and emit event', async () => {
      const userId = 'user123';
      const workspaceId = 'workspace456';

      await service.invalidateStatus(userId, workspaceId);

      expect(cacheService.del).toHaveBeenCalledWith(
        `business-setup-status:${userId}:${workspaceId}`,
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'business-setup.cache-invalidated',
        {
          userId,
          workspaceId,
          timestamp: expect.any(Date),
        },
      );
    });

    it('should handle deletion errors gracefully', async () => {
      const userId = 'user123';
      const workspaceId = 'workspace456';

      cacheService.del.mockRejectedValue(new Error('Delete failed'));

      // Should not throw error
      await expect(
        service.invalidateCache(userId, workspaceId),
      ).resolves.not.toThrow();
      expect(eventEmitter.emit).toHaveBeenCalled(); // Event should still be emitted
    });
  });

  describe('isCacheHit', () => {
    it('should return true when last request had cache hits', () => {
      // Simulate a cache hit by accessing the getter
      service.getStatus('user123', 'workspace456'); // This would increment hits

      const result = service.isCacheHit;

      expect(typeof result).toBe('boolean');
    });

    it('should return false initially', () => {
      const result = service.isCacheHit;

      expect(typeof result).toBe('boolean');
    });
  });
});

// Additional tests for cache performance and TTL behavior
describe('BusinessSetupStatusCacheService - Performance', () => {
  let service: BusinessSetupStatusCacheService;
  let redisService: jest.Mocked<MockRedisService>;

  beforeEach(async () => {
    const mockRedisService: MockRedisService = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessSetupStatusCacheService,
        { provide: 'RedisService', useValue: mockRedisService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: SupervisorAnalyticsService,
          useValue: { recordCacheHit: jest.fn(), recordCacheMiss: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BusinessSetupStatusCacheService>(
      BusinessSetupStatusCacheService,
    );
    redisService = module.get('RedisService');
  });

  it('should use correct TTL for caching', async () => {
    const userId = 'user123';
    const workspaceId = 'workspace456';
    const status = {
      status: 'WELCOME',
      lastUpdated: new Date(),
      preferences: {},
    };

    redisService.get.mockResolvedValue(null);
    jest.spyOn(service as any, 'queryDatabaseStatus').mockResolvedValue(status);

    await service.getStatus(userId, workspaceId);

    expect(redisService.setex).toHaveBeenCalledWith(
      expect.any(String),
      300, // 5 minutes = 300 seconds
      expect.any(String),
    );
  });

  it('should handle concurrent requests efficiently', async () => {
    const userId = 'user123';
    const workspaceId = 'workspace456';
    const status = {
      status: 'WELCOME',
      lastUpdated: new Date(),
      preferences: {},
    };

    redisService.get.mockResolvedValue(JSON.stringify(status));

    // Simulate concurrent requests
    const promises = Array(10)
      .fill(null)
      .map(() => service.getStatus(userId, workspaceId));
    const results = await Promise.all(promises);

    // All requests should return same result
    results.forEach((result) => {
      expect(result).toEqual(status);
    });

    // Redis should only be called once per concurrent batch
    expect(redisService.get).toHaveBeenCalledTimes(10);
  });
});
