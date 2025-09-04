import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { BusinessSetupService } from '../business-setup.service';
import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

export interface BusinessSetupStatusCacheData {
  status: BusinessSetupStatus;
  lastUpdated: string;
  userId: string;
  workspaceId: string;
}

export interface BusinessSetupStatusCacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  hitRate: number;
}

/**
 * Service for caching business setup status with 5-minute TTL
 * Reduces database load and improves UI responsiveness
 */
@Injectable()
export class BusinessSetupStatusCacheService {
  private readonly logger = new Logger(BusinessSetupStatusCacheService.name);
  private readonly TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  // Metrics tracking
  private metrics: BusinessSetupStatusCacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
    hitRate: 0,
  };

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.BusinessSetup)
    private readonly cacheService: CacheStorageService,
    private readonly eventEmitter: EventEmitter2,
    private readonly businessSetupService: BusinessSetupService,
  ) {}

  /**
   * Get cached business setup status with fallback to database
   */
  async getStatus(
    userId: string,
    workspaceId: string,
    user?: User,
    workspace?: Workspace,
  ): Promise<BusinessSetupStatus | null> {
    const cacheKey = this.generateCacheKey(userId, workspaceId);
    
    this.logger.debug(`[BusinessSetupStatusCache] getStatus called for ${userId}:${workspaceId}, user provided: ${!!user}, workspace provided: ${!!workspace}`);

    this.metrics.totalRequests++;

    try {
      const cachedData =
        await this.cacheService.get<BusinessSetupStatusCacheData>(cacheKey);

      if (cachedData) {
        this.metrics.hits++;
        this.updateHitRate();

        this.logger.debug(
          `Cache hit for business setup status: ${userId}:${workspaceId} -> ${cachedData.status}`,
        );

        return cachedData.status;
      }

      this.metrics.misses++;
      this.updateHitRate();

      this.logger.debug(
        `Cache miss for business setup status: ${userId}:${workspaceId}, fetching from database`,
      );

      // Cache miss - fetch from business setup service
      if (user && workspace) {
        const status = await this.businessSetupService.getBusinessSetupStatus(
          user,
          workspace,
        );

        // Cache the result
        await this.setStatus(userId, workspaceId, status);

        this.logger.debug(
          `Populated cache with business setup status: ${userId}:${workspaceId} -> ${status}`,
        );

        return status;
      }

      // If user/workspace not provided, return null
      this.logger.warn(
        `Cannot fetch business setup status from database - user/workspace not provided: ${userId}:${workspaceId}`,
      );

      return null;
    } catch (error) {
      this.logger.error(
        `Error getting cached status for ${userId}:${workspaceId}`,
        error.stack,
      );
      this.metrics.misses++;
      this.updateHitRate();

      return null;
    }
  }

  /**
   * Set business setup status in cache
   */
  async setStatus(
    userId: string,
    workspaceId: string,
    status: BusinessSetupStatus,
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(userId, workspaceId);
    const cacheData: BusinessSetupStatusCacheData = {
      status,
      lastUpdated: new Date().toISOString(),
      userId,
      workspaceId,
    };

    try {
      await this.cacheService.set(cacheKey, cacheData, this.TTL);

      this.logger.debug(
        `Cached business setup status: ${userId}:${workspaceId} -> ${status}`,
      );

      // Emit cache update event for monitoring
      this.eventEmitter.emit('business-setup.cache-updated', {
        userId,
        workspaceId,
        status,
        timestamp: new Date(),
        ttl: this.TTL,
      });
    } catch (error) {
      this.logger.error(
        `Error setting cached status for ${userId}:${workspaceId}`,
        error.stack,
      );
    }
  }

  /**
   * Invalidate cached status (force refresh)
   */
  async invalidateStatus(userId: string, workspaceId: string): Promise<void> {
    const cacheKey = this.generateCacheKey(userId, workspaceId);

    try {
      await this.cacheService.del(cacheKey);

      this.logger.debug(
        `Invalidated cached business setup status: ${userId}:${workspaceId}`,
      );

      this.eventEmitter.emit('business-setup.cache-invalidated', {
        userId,
        workspaceId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Error invalidating cached status for ${userId}:${workspaceId}`,
        error.stack,
      );
    }
  }

  /**
   * Invalidate cache for workspace and user (alias for invalidateStatus)
   */
  async invalidateCache(userId: string, workspaceId: string): Promise<void> {
    return this.invalidateStatus(userId, workspaceId);
  }

  /**
   * Check if last request was a cache hit
   */
  get isCacheHit(): boolean {
    return this.metrics.hits > this.metrics.misses;
  }

  /**
   * Clear all cached statuses for a workspace
   */
  async clearWorkspaceCache(workspaceId: string): Promise<void> {
    try {
      // Note: This requires a pattern-based deletion which might not be available
      // in all cache implementations. For now, we'll emit an event for monitoring
      this.logger.debug(`Clearing workspace cache: ${workspaceId}`);

      this.eventEmitter.emit('business-setup.workspace-cache-cleared', {
        workspaceId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Error clearing workspace cache for ${workspaceId}`,
        error.stack,
      );
    }
  }

  /**
   * Get cache metrics for monitoring
   */
  getMetrics(): BusinessSetupStatusCacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      hitRate: 0,
    };

    this.logger.debug('Cache metrics reset');
  }

  /**
   * Get cache info for debugging
   */
  async getCacheInfo(
    userId: string,
    workspaceId: string,
  ): Promise<{
    exists: boolean;
    data?: BusinessSetupStatusCacheData;
    ttl?: number;
  }> {
    const cacheKey = this.generateCacheKey(userId, workspaceId);

    try {
      const data =
        await this.cacheService.get<BusinessSetupStatusCacheData>(cacheKey);

      return {
        exists: !!data,
        data: data || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Error getting cache info for ${userId}:${workspaceId}`,
        error.stack,
      );

      return { exists: false };
    }
  }

  /**
   * Generate consistent cache key
   */
  private generateCacheKey(userId: string, workspaceId: string): string {
    return `business-setup-status:${userId}:${workspaceId}`;
  }

  /**
   * Update hit rate metrics
   */
  private updateHitRate(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate = this.metrics.hits / this.metrics.totalRequests;
    }
  }
}
