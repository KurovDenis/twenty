import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

import { RequestComplexity } from './adaptive-supervisor-config.service';

export interface RoutingMetrics {
  totalRequests: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageResponseTime: number;
  cacheHitRate: number;
  providerDistribution: Record<string, number>;
  complexityDistribution: Record<RequestComplexity, number>;
  statusDistribution: Record<BusinessSetupStatus, number>;
}

export interface UIGuidanceMetrics {
  totalGuidanceRequests: number;
  averageGenerationTime: number;
  buttonClickRate: number;
  errorRate: number;
  userSatisfactionScore?: number;
}

export interface ActionExecutionMetrics {
  totalActions: number;
  successfulActions: number;
  averageExecutionTime: number;
  actionTypeDistribution: Record<string, number>;
  providerPerformance: Record<
    string,
    {
      successRate: number;
      averageTime: number;
      errorCount: number;
    }
  >;
}

export interface SupervisorMetrics {
  routing: RoutingMetrics;
  uiGuidance: UIGuidanceMetrics;
  actionExecution: ActionExecutionMetrics;
  systemHealth: {
    uptime: number;
    errorRate: number;
    performanceScore: number;
  };
  timeRange: string;
  generatedAt: Date;
}

export interface MetricsQuery {
  userId?: string;
  workspaceId?: string;
  timeRange: string; // '1h', '24h', '7d', '30d'
  includeDetails?: boolean;
}

export interface TrackingEvent {
  userId: string;
  workspaceId: string;
  timestamp: Date;
  operation: string;
  duration?: number;
  success?: boolean;
  metadata?: any;
}

/**
 * Service for tracking and analyzing Supervisor Agent performance
 * Provides comprehensive analytics for routing accuracy, response times, and user satisfaction
 */
@Injectable()
export class SupervisorAnalyticsService {
  private readonly logger = new Logger(SupervisorAnalyticsService.name);
  private readonly events: TrackingEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events in memory
  private readonly startTime = new Date();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Listen for system events
    this.eventEmitter.on(
      'supervisor.request',
      this.handleSupervisorRequest.bind(this),
    );
    this.eventEmitter.on(
      'supervisor.response',
      this.handleSupervisorResponse.bind(this),
    );
    this.eventEmitter.on(
      'provider.selected',
      this.handleProviderSelection.bind(this),
    );
    this.eventEmitter.on(
      'action.executed',
      this.handleActionExecution.bind(this),
    );
  }

  /**
   * Track UI guidance request
   */
  trackUIGuidanceRequest(data: {
    userId: string;
    workspaceId: string;
    businessStatus: BusinessSetupStatus;
    complexity: RequestComplexity;
    executionTime: number;
    cacheHit: boolean;
    providerUsed?: string;
  }): void {
    this.addEvent({
      userId: data.userId,
      workspaceId: data.workspaceId,
      timestamp: new Date(),
      operation: 'ui_guidance_request',
      duration: data.executionTime,
      success: true,
      metadata: {
        businessStatus: data.businessStatus,
        complexity: data.complexity,
        cacheHit: data.cacheHit,
        providerUsed: data.providerUsed,
      },
    });

    this.logger.debug(
      `UI guidance request tracked: ${data.businessStatus} (${data.executionTime}ms)`,
    );
  }

  /**
   * Track action execution
   */
  trackActionExecution(data: {
    userId: string;
    workspaceId: string;
    actionType: string;
    providerUsed: string;
    executionTime: number;
    success: boolean;
    error?: string;
  }): void {
    this.addEvent({
      userId: data.userId,
      workspaceId: data.workspaceId,
      timestamp: new Date(),
      operation: 'action_execution',
      duration: data.executionTime,
      success: data.success,
      metadata: {
        actionType: data.actionType,
        providerUsed: data.providerUsed,
        error: data.error,
      },
    });

    this.logger.debug(
      `Action execution tracked: ${data.actionType} (${data.success ? 'success' : 'failed'})`,
    );
  }

  /**
   * Track routing decision
   */
  trackRoutingDecision(data: {
    userId: string;
    workspaceId: string;
    businessStatus: BusinessSetupStatus;
    selectedProvider: string;
    decisionTime: number;
    confidence: number;
    alternatives: string[];
  }): void {
    this.addEvent({
      userId: data.userId,
      workspaceId: data.workspaceId,
      timestamp: new Date(),
      operation: 'routing_decision',
      duration: data.decisionTime,
      success: true,
      metadata: {
        businessStatus: data.businessStatus,
        selectedProvider: data.selectedProvider,
        confidence: data.confidence,
        alternatives: data.alternatives,
      },
    });

    this.logger.debug(
      `Routing decision tracked: ${data.businessStatus} -> ${data.selectedProvider}`,
    );
  }

  /**
   * Track error occurrence
   */
  trackError(data: {
    userId: string;
    workspaceId: string;
    operation: string;
    actionType?: string;
    error: string;
    executionTime: number;
    context?: any;
  }): void {
    this.addEvent({
      userId: data.userId,
      workspaceId: data.workspaceId,
      timestamp: new Date(),
      operation: data.operation,
      duration: data.executionTime,
      success: false,
      metadata: {
        actionType: data.actionType,
        error: data.error,
        context: data.context,
      },
    });

    this.logger.error(`Error tracked: ${data.operation} - ${data.error}`);
  }

  /**
   * Track user satisfaction feedback
   */
  trackUserSatisfaction(data: {
    userId: string;
    workspaceId: string;
    operationId: string;
    rating: number; // 1-5 scale
    feedback?: string;
  }): void {
    this.addEvent({
      userId: data.userId,
      workspaceId: data.workspaceId,
      timestamp: new Date(),
      operation: 'user_satisfaction',
      success: true,
      metadata: {
        operationId: data.operationId,
        rating: data.rating,
        feedback: data.feedback,
      },
    });

    this.logger.debug(`User satisfaction tracked: ${data.rating}/5 stars`);
  }

  /**
   * Get comprehensive metrics for dashboard
   */
  async getMetrics(query: MetricsQuery): Promise<SupervisorMetrics> {
    const timeFilter = this.getTimeFilter(query.timeRange);
    const filteredEvents = this.filterEvents(timeFilter, query);

    const routing = this.calculateRoutingMetrics(filteredEvents);
    const uiGuidance = this.calculateUIGuidanceMetrics(filteredEvents);
    const actionExecution =
      this.calculateActionExecutionMetrics(filteredEvents);
    const systemHealth = this.calculateSystemHealth(filteredEvents);

    return {
      routing,
      uiGuidance,
      actionExecution,
      systemHealth,
      timeRange: query.timeRange,
      generatedAt: new Date(),
    };
  }

  /**
   * Get routing accuracy percentage
   */
  getRoutingAccuracy(timeRange = '24h'): number {
    const timeFilter = this.getTimeFilter(timeRange);
    const events = this.filterEvents(timeFilter);

    const routingEvents = events.filter(
      (e) => e.operation === 'routing_decision',
    );
    const successfulRoutes = routingEvents.filter((e) => e.success).length;

    return routingEvents.length > 0
      ? (successfulRoutes / routingEvents.length) * 100
      : 0;
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(operation?: string, timeRange = '24h'): number {
    const timeFilter = this.getTimeFilter(timeRange);
    const events = this.filterEvents(timeFilter);

    const filteredEvents = operation
      ? events.filter((e) => e.operation === operation)
      : events;

    const durations = filteredEvents
      .filter((e) => e.duration && e.duration > 0)
      .map((e) => e.duration!);

    return durations.length > 0
      ? durations.reduce((sum, duration) => sum + duration, 0) /
          durations.length
      : 0;
  }

  /**
   * Get provider performance comparison
   */
  getProviderPerformance(timeRange = '24h'): Record<
    string,
    {
      successRate: number;
      averageTime: number;
      totalRequests: number;
    }
  > {
    const timeFilter = this.getTimeFilter(timeRange);
    const events = this.filterEvents(timeFilter);

    const providerEvents = events.filter(
      (e) =>
        e.metadata?.providerUsed &&
        (e.operation === 'action_execution' ||
          e.operation === 'ui_guidance_request'),
    );

    const providerStats: Record<
      string,
      {
        total: number;
        successful: number;
        totalTime: number;
      }
    > = {};

    providerEvents.forEach((event) => {
      const provider = event.metadata.providerUsed;

      if (!providerStats[provider]) {
        providerStats[provider] = { total: 0, successful: 0, totalTime: 0 };
      }

      providerStats[provider].total++;
      if (event.success) {
        providerStats[provider].successful++;
      }
      if (event.duration) {
        providerStats[provider].totalTime += event.duration;
      }
    });

    const result: Record<
      string,
      {
        successRate: number;
        averageTime: number;
        totalRequests: number;
      }
    > = {};

    Object.entries(providerStats).forEach(([provider, stats]) => {
      result[provider] = {
        successRate: (stats.successful / stats.total) * 100,
        averageTime: stats.totalTime / stats.total,
        totalRequests: stats.total,
      };
    });

    return result;
  }

  /**
   * Calculate routing metrics
   */
  private calculateRoutingMetrics(events: TrackingEvent[]): RoutingMetrics {
    const routingEvents = events.filter(
      (e) => e.operation === 'routing_decision',
    );
    const uiGuidanceEvents = events.filter(
      (e) => e.operation === 'ui_guidance_request',
    );

    const totalRequests = uiGuidanceEvents.length;
    const successfulRoutes = routingEvents.filter((e) => e.success).length;
    const failedRoutes = routingEvents.filter((e) => !e.success).length;

    const responseTimes = uiGuidanceEvents
      .filter((e) => e.duration)
      .map((e) => e.duration!);
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const cacheHits = uiGuidanceEvents.filter(
      (e) => e.metadata?.cacheHit,
    ).length;
    const cacheHitRate =
      totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    // Provider distribution
    const providerDistribution: Record<string, number> = {};

    routingEvents.forEach((event) => {
      const provider = event.metadata?.selectedProvider;

      if (provider) {
        providerDistribution[provider] =
          (providerDistribution[provider] || 0) + 1;
      }
    });

    // Complexity distribution
    const complexityDistribution: Record<RequestComplexity, number> = {
      [RequestComplexity.SIMPLE]: 0,
      [RequestComplexity.COMPLEX]: 0,
    };

    uiGuidanceEvents.forEach((event) => {
      const complexity = event.metadata?.complexity as RequestComplexity;

      if (complexity && Object.values(RequestComplexity).includes(complexity)) {
        complexityDistribution[complexity]++;
      }
    });

    // Status distribution
    const statusDistribution: Record<BusinessSetupStatus, number> = {
      [BusinessSetupStatus.WELCOME]: 0,
      [BusinessSetupStatus.BUSINESS_ANALYSIS]: 0,
      [BusinessSetupStatus.SALES_FUNNEL_DESIGN]: 0,
      [BusinessSetupStatus.AGENT_SETUP]: 0,
      [BusinessSetupStatus.WORKFLOW_CREATION]: 0,
      [BusinessSetupStatus.TEAM_ASSIGNMENT]: 0,
      [BusinessSetupStatus.TESTING_OPTIMIZATION]: 0,
      [BusinessSetupStatus.COMPLETED]: 0,
    };

    uiGuidanceEvents.forEach((event) => {
      const status = event.metadata?.businessStatus as BusinessSetupStatus;

      if (status && Object.values(BusinessSetupStatus).includes(status)) {
        statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      }
    });

    return {
      totalRequests,
      successfulRoutes,
      failedRoutes,
      averageResponseTime,
      cacheHitRate,
      providerDistribution,
      complexityDistribution,
      statusDistribution,
    };
  }

  /**
   * Calculate UI guidance metrics
   */
  private calculateUIGuidanceMetrics(
    events: TrackingEvent[],
  ): UIGuidanceMetrics {
    const guidanceEvents = events.filter(
      (e) => e.operation === 'ui_guidance_request',
    );
    const actionEvents = events.filter(
      (e) => e.operation === 'action_execution',
    );
    const satisfactionEvents = events.filter(
      (e) => e.operation === 'user_satisfaction',
    );

    const totalGuidanceRequests = guidanceEvents.length;

    const generationTimes = guidanceEvents
      .filter((e) => e.duration)
      .map((e) => e.duration!);
    const averageGenerationTime =
      generationTimes.length > 0
        ? generationTimes.reduce((sum, time) => sum + time, 0) /
          generationTimes.length
        : 0;

    const buttonClickRate =
      totalGuidanceRequests > 0
        ? (actionEvents.length / totalGuidanceRequests) * 100
        : 0;

    const errorEvents = events.filter(
      (e) => !e.success && e.operation === 'ui_guidance_request',
    );
    const errorRate =
      totalGuidanceRequests > 0
        ? (errorEvents.length / totalGuidanceRequests) * 100
        : 0;

    const ratings = satisfactionEvents
      .filter((e) => e.metadata?.rating)
      .map((e) => e.metadata.rating);
    const userSatisfactionScore =
      ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : undefined;

    return {
      totalGuidanceRequests,
      averageGenerationTime,
      buttonClickRate,
      errorRate,
      userSatisfactionScore,
    };
  }

  /**
   * Calculate action execution metrics
   */
  private calculateActionExecutionMetrics(
    events: TrackingEvent[],
  ): ActionExecutionMetrics {
    const actionEvents = events.filter(
      (e) => e.operation === 'action_execution',
    );

    const totalActions = actionEvents.length;
    const successfulActions = actionEvents.filter((e) => e.success).length;

    const executionTimes = actionEvents
      .filter((e) => e.duration)
      .map((e) => e.duration!);
    const averageExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((sum, time) => sum + time, 0) /
          executionTimes.length
        : 0;

    // Action type distribution
    const actionTypeDistribution: Record<string, number> = {};

    actionEvents.forEach((event) => {
      const actionType = event.metadata?.actionType;

      if (actionType) {
        actionTypeDistribution[actionType] =
          (actionTypeDistribution[actionType] || 0) + 1;
      }
    });

    // Provider performance
    const providerPerformance: Record<
      string,
      {
        successRate: number;
        averageTime: number;
        errorCount: number;
      }
    > = {};

    const providerGroups = this.groupBy(
      actionEvents,
      (e) => e.metadata?.providerUsed,
    );

    Object.entries(providerGroups).forEach(([provider, events]) => {
      if (provider && provider !== 'undefined') {
        const successful = events.filter((e) => e.success).length;
        const times = events.filter((e) => e.duration).map((e) => e.duration!);
        const avgTime =
          times.length > 0
            ? times.reduce((sum, time) => sum + time, 0) / times.length
            : 0;
        const errorCount = events.filter((e) => !e.success).length;

        providerPerformance[provider] = {
          successRate:
            events.length > 0 ? (successful / events.length) * 100 : 0,
          averageTime: avgTime,
          errorCount,
        };
      }
    });

    return {
      totalActions,
      successfulActions,
      averageExecutionTime,
      actionTypeDistribution,
      providerPerformance,
    };
  }

  /**
   * Calculate system health metrics
   */
  private calculateSystemHealth(events: TrackingEvent[]): {
    uptime: number;
    errorRate: number;
    performanceScore: number;
  } {
    const uptime = Date.now() - this.startTime.getTime();

    const totalEvents = events.length;
    const errorEvents = events.filter((e) => !e.success).length;
    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;

    // Performance score calculation (0-100)
    const avgResponseTime = this.getAverageResponseTime();
    const routingAccuracy = this.getRoutingAccuracy();

    // Score factors: response time (40%), accuracy (40%), error rate (20%)
    const responseTimeScore = Math.max(0, 100 - avgResponseTime / 100); // Good if < 1s
    const accuracyScore = routingAccuracy;
    const errorScore = Math.max(0, 100 - errorRate);

    const performanceScore =
      responseTimeScore * 0.4 + accuracyScore * 0.4 + errorScore * 0.2;

    return {
      uptime,
      errorRate,
      performanceScore,
    };
  }

  /**
   * Event handlers
   */
  private handleSupervisorRequest(event: any): void {
    // Handle supervisor request events
  }

  private handleSupervisorResponse(event: any): void {
    // Handle supervisor response events
  }

  private handleProviderSelection(event: any): void {
    // Handle provider selection events
  }

  private handleActionExecution(event: any): void {
    // Handle action execution events
  }

  /**
   * Utility methods
   */
  private addEvent(event: TrackingEvent): void {
    this.events.push(event);

    // Cleanup old events to prevent memory leaks
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  private getTimeFilter(timeRange: string): Date {
    const now = new Date();

    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private filterEvents(afterTime: Date, query?: MetricsQuery): TrackingEvent[] {
    return this.events.filter((event) => {
      if (event.timestamp < afterTime) return false;
      if (query?.userId && event.userId !== query.userId) return false;
      if (query?.workspaceId && event.workspaceId !== query.workspaceId)
        return false;

      return true;
    });
  }

  private groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K,
  ): Record<K, T[]> {
    return array.reduce(
      (groups, item) => {
        const key = keyFn(item);

        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(item);

        return groups;
      },
      {} as Record<K, T[]>,
    );
  }
}
