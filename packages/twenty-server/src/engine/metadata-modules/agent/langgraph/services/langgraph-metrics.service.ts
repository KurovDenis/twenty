import { Injectable, Logger } from '@nestjs/common';
import { metrics, type Attributes } from '@opentelemetry/api';

export interface AgentExecutionMetrics {
  agentId: string;
  workspaceId: string;
  userId: string;
  duration: number;
  tokenUsage: number;
  success: boolean;
  errorType?: string;
}

@Injectable()
export class LangGraphMetricsService {
  private readonly logger = new Logger(LangGraphMetricsService.name);
  
  // Prometheus metrics
  private readonly executionCounter = metrics.getMeter('langgraph').createCounter('agent_executions_total', {
    description: 'Total number of agent executions',
  });
  
  private readonly executionDuration = metrics.getMeter('langgraph').createHistogram('agent_execution_duration_seconds', {
    description: 'Agent execution duration in seconds',
    unit: 's',
  });
  
  private readonly tokenUsageCounter = metrics.getMeter('langgraph').createCounter('agent_token_usage_total', {
    description: 'Total token usage by agents',
  });
  
  private readonly errorCounter = metrics.getMeter('langgraph').createCounter('agent_errors_total', {
    description: 'Total number of agent errors',
  });
  
  private readonly stateOperationsCounter = metrics.getMeter('langgraph').createCounter('state_operations_total', {
    description: 'Total number of state operations',
  });
  
  private readonly cacheHitRatio = metrics.getMeter('langgraph').createGauge('cache_hit_ratio', {
    description: 'Cache hit ratio for state operations',
  });

  recordExecutionStart(agentId: string, context: any): void {
    this.executionCounter.add(1, {
      agent_id: agentId,
      workspace_id: context.workspaceId,
      user_id: context.userId,
      status: 'started',
    });
  }

  recordExecutionSuccess(
    agentId: string,
    duration: number,
    tokenUsage: number,
    context: any,
  ): void {
    const attributes: Attributes = {
      agent_id: agentId,
      workspace_id: context.workspaceId,
      user_id: context.userId,
      status: 'success',
    };

    this.executionCounter.add(1, attributes);
    this.executionDuration.record(duration / 1000, attributes); // Convert to seconds
    this.tokenUsageCounter.add(tokenUsage, {
      agent_id: agentId,
      token_type: 'total',
    });

    this.logger.debug(`Agent execution success: ${agentId}, duration: ${duration}ms, tokens: ${tokenUsage}`);
  }

  recordExecutionError(
    agentId: string,
    error: Error,
    context: any,
  ): void {
    const attributes: Attributes = {
      agent_id: agentId,
      workspace_id: context.workspaceId,
      user_id: context.userId,
      status: 'error',
      error_type: error.constructor.name,
    };

    this.executionCounter.add(1, attributes);
    this.errorCounter.add(1, {
      agent_id: agentId,
      error_type: error.constructor.name,
    });

    this.logger.error(`Agent execution error: ${agentId}`, error.stack);
  }

  recordStateOperation(
    operation: 'get' | 'save' | 'archive' | 'recover',
    success: boolean,
    threadId: string,
  ): void {
    this.stateOperationsCounter.add(1, {
      operation,
      success: success.toString(),
      thread_id: threadId,
    });
  }

  recordCacheHit(hit: boolean, threadId: string): void {
    // Update cache hit ratio (simplified implementation)
    // В production это должно быть более сложная логика с sliding window
    this.cacheHitRatio.set(hit ? 1 : 0, {
      thread_id: threadId,
    });
  }

  recordTokenUsage(
    agentId: string,
    promptTokens: number,
    completionTokens: number,
  ): void {
    this.tokenUsageCounter.add(promptTokens, {
      agent_id: agentId,
      token_type: 'prompt',
    });
    
    this.tokenUsageCounter.add(completionTokens, {
      agent_id: agentId,
      token_type: 'completion',
    });
  }

  recordRateLimitViolation(
    identifier: string,
    limit: number,
    windowMs: number,
  ): void {
    this.errorCounter.add(1, {
      error_type: 'rate_limit_violation',
      identifier,
      limit: limit.toString(),
      window_ms: windowMs.toString(),
    });
  }

  recordValidationError(
    errorType: string,
    agentId: string,
    details?: string,
  ): void {
    this.errorCounter.add(1, {
      error_type: 'validation_error',
      validation_type: errorType,
      agent_id: agentId,
      details,
    });
  }

  recordPIIDetection(
    piiTypes: string[],
    agentId: string,
    severity: 'low' | 'medium' | 'high',
  ): void {
    this.errorCounter.add(1, {
      error_type: 'pii_detection',
      pii_types: piiTypes.join(','),
      agent_id: agentId,
      severity,
    });
  }

  recordEncryptionOperation(
    operation: 'encrypt' | 'decrypt',
    success: boolean,
    keyVersion: number,
  ): void {
    this.stateOperationsCounter.add(1, {
      operation: `encryption_${operation}`,
      success: success.toString(),
      key_version: keyVersion.toString(),
    });
  }

  recordCircuitBreakerState(
    service: string,
    state: 'closed' | 'open' | 'half_open',
  ): void {
    // Note: Gauge would be better for this, but using counter for simplicity
    this.stateOperationsCounter.add(1, {
      operation: 'circuit_breaker_state_change',
      service,
      state,
    });
  }

  // Batch metrics recording for performance
  recordBatchMetrics(metrics: AgentExecutionMetrics[]): void {
    for (const metric of metrics) {
      const attributes: Attributes = {
        agent_id: metric.agentId,
        workspace_id: metric.workspaceId,
        user_id: metric.userId,
        status: metric.success ? 'success' : 'error',
      };

      this.executionCounter.add(1, attributes);
      this.executionDuration.record(metric.duration / 1000, attributes);
      
      if (metric.success) {
        this.tokenUsageCounter.add(metric.tokenUsage, {
          agent_id: metric.agentId,
          token_type: 'total',
        });
      } else {
        this.errorCounter.add(1, {
          agent_id: metric.agentId,
          error_type: metric.errorType || 'unknown',
        });
      }
    }
  }

  // Health check metrics
  recordHealthCheck(
    component: string,
    status: 'healthy' | 'unhealthy' | 'degraded',
    details?: string,
  ): void {
    this.stateOperationsCounter.add(1, {
      operation: 'health_check',
      component,
      status,
      details: details || '',
    });
  }

  // Custom metric recording
  recordCustomMetric(
    name: string,
    value: number,
    attributes?: Attributes,
  ): void {
    const counter = metrics.getMeter('langgraph').createCounter(name);
    counter.add(value, attributes);
  }

  // Get current metrics summary (for monitoring)
  getMetricsSummary(): Record<string, any> {
    // This is a simplified implementation
    // In production, you'd query Prometheus or your metrics backend
    return {
      total_executions: 'N/A', // Would be queried from Prometheus
      average_duration: 'N/A',
      error_rate: 'N/A',
      cache_hit_ratio: 'N/A',
    };
  }
}
