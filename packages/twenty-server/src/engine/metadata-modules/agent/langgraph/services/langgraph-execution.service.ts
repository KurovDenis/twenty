import { Injectable } from '@nestjs/common';
import { SalesAgent } from '../agents/sales-agent/sales-agent';
import { SupportAgent } from '../agents/support-agent/support-agent';
import { WelcomeAgent } from '../agents/welcome-agent/welcome-agent';
import { AgentContext, ILangGraphAgent } from '../types/langgraph-agent.types';
import { LangGraphMetricsService } from './langgraph-metrics.service';
import { LangGraphStateService } from './langgraph-state.service';
import { LangGraphTracingService } from './langgraph-tracing.service';

// Local type definitions to avoid external dependencies
interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentExecutionResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, any>;
}

// Simple distributed lock implementation
class SimpleDistributedLock {
  private locks = new Map<string, boolean>();

  async acquire(key: string, ttl: number): Promise<{ release: () => Promise<void> }> {
    if (this.locks.get(key)) {
      throw new Error('Lock already acquired');
    }
    
    this.locks.set(key, true);
    
    return {
      release: async () => {
        this.locks.delete(key);
      }
    };
  }
}

@Injectable()
export class LangGraphExecutionService {
  // Cache only stateless agent instances (models, graphs)
  private agentCache = new Map<string, ILangGraphAgent>();
  private redlock: SimpleDistributedLock;

  constructor(
    private readonly stateService: LangGraphStateService,
    private readonly tracingService: LangGraphTracingService,
    private readonly metricsService: LangGraphMetricsService,
    private readonly welcomeAgent: WelcomeAgent,
    private readonly salesAgent: SalesAgent,
    private readonly supportAgent: SupportAgent,
  ) {
    // Initialize simple distributed lock
    this.redlock = new SimpleDistributedLock();
  }

  async execute(
    agentId: string,
    messages: AgentMessage[],
    context: AgentContext,
  ): Promise<AgentExecutionResult> {
    return this.tracingService.traceAgentExecution(
      agentId,
      'execute',
      async () => {
        const startTime = Date.now();
        
        try {
          // Record metrics
          this.metricsService.recordExecutionStart(agentId, context);
          
          // Acquire per-thread lock to prevent concurrent state modifications
          const lock = await this.redlock.acquire(`lock:thread:${context.threadId}`, 5000);
          
          try {
            const result = await this.executeWithLock(agentId, messages, context);
            
            // Record success metrics
            this.metricsService.recordExecutionSuccess(
              agentId, 
              Date.now() - startTime,
              result.usage?.totalTokens || 0,
              context,
            );
            
            return result;
          } finally {
            await lock.release();
          }
        } catch (error) {
          // Record error metrics
          this.metricsService.recordExecutionError(agentId, error, context);
          throw error;
        }
      },
      {
        'messages.count': messages.length,
        'workspace.id': context.workspaceId,
        'user.id': context.userId,
      }
    );
  }

  private async executeWithLock(
    agentId: string,
    messages: AgentMessage[],
    context: AgentContext,
  ): Promise<AgentExecutionResult> {
    // Get or create stateless agent instance
    let agent = this.agentCache.get(agentId);
    
    if (!agent) {
      // Create agent based on type (determined from agentId or context)
      agent = this.createAgent(agentId, context);
      this.agentCache.set(agentId, agent);
    }

    // Get current state from state service
    const currentState = await this.stateService.getState(context.threadId);
    
    // Convert messages to the format expected by agents
    const lcMessages = messages.map(m => ({
      role: m.role,
      content: m.content,
      id: m.id,
      timestamp: m.timestamp,
    }));

    // Execute agent with state
    const result = await agent.execute(lcMessages, context, currentState);
    
    // Save updated state
    await this.stateService.saveState(context.threadId, result.state);
    
    return {
      content: result.content,
      usage: result.usage,
      metadata: result.metadata,
    };
  }

  private createAgent(agentId: string, context: AgentContext): ILangGraphAgent {
    // Determine agent type from agentId or context
    // This is a simplified logic - in production, you'd get this from the agent configuration
    const agentType = this.getAgentType(agentId);
    
    switch (agentType) {
      case 'welcome':
        return this.welcomeAgent;
      case 'sales':
        return this.salesAgent;
      case 'support':
        return this.supportAgent;
      default:
        return this.welcomeAgent; // Default fallback
    }
  }

  private getAgentType(agentId: string): 'welcome' | 'sales' | 'support' {
    // Simple logic to determine agent type from agentId
    // In production, this would be more sophisticated
    if (agentId.includes('sales') || agentId.includes('demo')) {
      return 'sales';
    } else if (agentId.includes('support') || agentId.includes('help')) {
      return 'support';
    } else {
      return 'welcome';
    }
  }

  clearCache(agentId?: string) {
    if (agentId) {
      this.agentCache.delete(agentId);
    } else {
      this.agentCache.clear();
    }
  }
}
