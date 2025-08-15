import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { LangGraphStateEntity } from '../entities/langgraph-state.entity';
import { AgentState } from '@twenty/shared/langgraph/types';

@Injectable()
export class LangGraphStateCacheService {
  private readonly redisClient: Redis;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly STATE_KEY_PREFIX = 'langgraph:state:';

  constructor(
    @InjectRedis() redisClient: Redis,
    private readonly langGraphStateRepository: Repository<LangGraphStateEntity>,
  ) {
    this.redisClient = redisClient;
  }

  async getState(threadId: string): Promise<AgentState | null> {
    const cacheKey = `${this.STATE_KEY_PREFIX}${threadId}`;
    
    try {
      // Try cache first
      const cachedState = await this.redisClient.get(cacheKey);
      if (cachedState) {
        return JSON.parse(cachedState);
      }

      // Fallback to database
      const dbState = await this.langGraphStateRepository.findOne({
        where: { threadId, isActive: true },
      });

      if (dbState) {
        // Cache the state
        await this.redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(dbState.state));
        return dbState.state;
      }

      return null;
    } catch (error) {
      console.error('Error getting state from cache for thread:', threadId, error);
      return null;
    }
  }

  async saveState(threadId: string, state: AgentState): Promise<void> {
    const cacheKey = `${this.STATE_KEY_PREFIX}${threadId}`;
    
    try {
      // Save to cache
      await this.redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving state to cache for thread:', threadId, error);
      throw error;
    }
  }

  async archiveState(threadId: string): Promise<void> {
    const cacheKey = `${this.STATE_KEY_PREFIX}${threadId}`;
    
    try {
      // Remove from cache
      await this.redisClient.del(cacheKey);
    } catch (error) {
      console.error('Error archiving state from cache for thread:', threadId, error);
      throw error;
    }
  }

  async clearCache(threadId?: string): Promise<void> {
    try {
      if (threadId) {
        const cacheKey = `${this.STATE_KEY_PREFIX}${threadId}`;
        await this.redisClient.del(cacheKey);
      } else {
        // Clear all langgraph state cache
        const keys = await this.redisClient.keys(`${this.STATE_KEY_PREFIX}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  async getCacheStats(): Promise<{ totalKeys: number; memoryUsage: string }> {
    try {
      const keys = await this.redisClient.keys(`${this.STATE_KEY_PREFIX}*`);
      const info = await this.redisClient.info('memory');
      
      return {
        totalKeys: keys.length,
        memoryUsage: info,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { totalKeys: 0, memoryUsage: 'unknown' };
    }
  }
}
