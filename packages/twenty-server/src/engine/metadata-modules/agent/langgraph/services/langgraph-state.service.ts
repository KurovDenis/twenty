import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LangGraphStateEntity } from '../entities/langgraph-state.entity';
import { AgentState } from '@twenty/shared/langgraph/types';
import { LangGraphStateCacheService } from './langgraph-state-cache.service';
import { LangGraphStateRecoveryService } from './langgraph-state-recovery.service';

@Injectable()
export class LangGraphStateService {
  constructor(
    @InjectRepository(LangGraphStateEntity)
    private readonly langGraphStateRepository: Repository<LangGraphStateEntity>,
    private readonly stateCacheService: LangGraphStateCacheService,
    private readonly stateRecoveryService: LangGraphStateRecoveryService,
  ) {}

  async getState(threadId: string): Promise<AgentState | null> {
    try {
      // Try cache first
      let state = await this.stateCacheService.getState(threadId);
      
      if (!state) {
        // Try database
        const dbState = await this.langGraphStateRepository.findOne({
          where: { threadId, isActive: true },
        });

        if (dbState) {
          state = dbState.state;
          // Cache the state
          await this.stateCacheService.saveState(threadId, state);
        } else {
          // Try recovery
          state = await this.stateRecoveryService.recoverState(threadId);
        }
      }

      return state;
    } catch (error) {
      console.error('Error getting state for thread:', threadId, error);
      return null;
    }
  }

  async saveState(threadId: string, state: AgentState): Promise<void> {
    try {
      // Save to cache
      await this.stateCacheService.saveState(threadId, state);
      
      // Save to database
      await this.langGraphStateRepository.upsert(
        {
          threadId,
          state,
          isActive: true,
          updatedAt: new Date(),
        },
        { conflictPaths: ['threadId'] }
      );
    } catch (error) {
      console.error('Error saving state for thread:', threadId, error);
      throw error;
    }
  }

  async archiveState(threadId: string): Promise<void> {
    try {
      // Remove from cache
      await this.stateCacheService.archiveState(threadId);
      
      // Archive in database
      await this.langGraphStateRepository.update(
        { threadId },
        { 
          isActive: false,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        }
      );
    } catch (error) {
      console.error('Error archiving state for thread:', threadId, error);
      throw error;
    }
  }

  async getActiveStates(workspaceId: string): Promise<LangGraphStateEntity[]> {
    return this.langGraphStateRepository.find({
      where: { workspaceId, isActive: true },
    });
  }

  async cleanupExpiredStates(): Promise<number> {
    const result = await this.langGraphStateRepository.delete({
      expiresAt: new Date(),
      isActive: false,
    });
    
    return result.affected || 0;
  }
}
