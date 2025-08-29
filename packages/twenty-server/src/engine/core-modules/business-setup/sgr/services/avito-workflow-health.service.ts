import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import { BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import { AvitoWorkflowState } from '../types/avito-workflow-context';

import { AvitoErrorType } from './avito-error-recovery.service';

/**
 * Workflow health status levels
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Workflow performance metrics
 */
export interface WorkflowMetrics {
  // Execution metrics
  totalWorkflows: number;
  successfulWorkflows: number;
  failedWorkflows: number;
  averageExecutionTimeMs: number;

  // State metrics
  stateDistribution: Record<AvitoWorkflowState, number>;
  averageStepsPerWorkflow: number;

  // Error metrics
  errorFrequency: Record<AvitoErrorType, number>;
  recoverySuccessRate: number;

  // API metrics
  apiCallsTotal: number;
  apiCallsSuccessful: number;
  apiAverageResponseTimeMs: number;

  // Credential metrics
  credentialsProcessed: number;
  credentialsValidated: number;
  credentialsStored: number;

  // Time-based metrics
  lastUpdated: Date;
  metricsCollectionPeriod: string;
}

/**
 * Individual workflow execution record
 */
export interface WorkflowExecutionRecord {
  id: string;
  userId: string;
  workspaceId: string;
  threadId: string;
  startTime: Date;
  endTime?: Date;
  currentState: AvitoWorkflowState;
  stepsExecuted: Array<{
    state: AvitoWorkflowState;
    timestamp: Date;
    executionTimeMs: number;
    success: boolean;
    error?: string;
  }>;
  finalStatus: 'success' | 'failed' | 'in_progress' | 'timeout';
  totalExecutionTimeMs?: number;
  credentialsValidated: boolean;
  credentialsStored: boolean;
  errorCount: number;
  lastError?: {
    type: AvitoErrorType;
    message: string;
    timestamp: Date;
  };
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details: {
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
    responseTimeMs?: number;
  }[];
  metrics: WorkflowMetrics;
  timestamp: Date;
}

/**
 * Alert configuration
 */
export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number;
  severity: 'warning' | 'critical';
  message: string;
}

/**
 * Comprehensive workflow health monitoring and metrics collection service
 *
 * Provides real-time monitoring, performance metrics, health checks,
 * alerting, circuit breaker monitoring, and advanced analytics
 * for the Avito SGR workflow system.
 *
 * Enhanced with features extracted from AvitoWorkflowMonitoringService:
 * - Advanced performance tracking with percentiles
 * - Circuit breaker status monitoring
 * - Predictive alerting based on trends
 * - Real-time dashboard data aggregation
 * - Enhanced error pattern analysis
 */
// Type definitions for method return types
type AdvancedPerformanceAnalytics = {
  executionTimePercentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  throughputAnalysis: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  errorPatterns: Array<{
    pattern: string;
    frequency: number;
    lastOccurrence: Date;
  }>;
  resourceUtilization: { memory: number; cpu: number; connections: number };
  healthTrends: {
    current: number;
    trend: 'improving' | 'degrading' | 'stable';
  };
};

type RealTimeDashboardData = {
  timestamp: Date;
  activeWorkflows: number;
  throughputPerMinute: number;
  errorRatePercentage: number;
  averageResponseTimeMs: number;
  healthScore: number;
  topErrors: Array<{ type: string; count: number }>;
  systemAlerts: Array<{ severity: string; message: string; timestamp: Date }>;
  circuitBreakerStatus: Array<{
    service: string;
    isOpen: boolean;
    failureCount: number;
  }>;
};

type PerformanceTrends = {
  predictions: Array<{
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeToThreshold: number; // minutes
    recommendation: string;
  }>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    mitigationSuggestions: string[];
  };
};

@Injectable()
export class AvitoWorkflowHealthService {
  private readonly logger = new Logger(AvitoWorkflowHealthService.name);

  // In-memory metrics storage (in production, use Redis or database)
  private metrics: WorkflowMetrics = this.initializeMetrics();
  private executionRecords: Map<string, WorkflowExecutionRecord> = new Map();
  private healthHistory: HealthCheckResult[] = [];

  // Enhanced monitoring properties (extracted from AvitoWorkflowMonitoringService)
  private performanceHistory: Array<{
    timestamp: Date;
    executionTimeMs: number;
    memoryUsageMB: number;
    cpuUsagePercent: number;
    activeConnections: number;
  }> = [];

  private circuitBreakerStatus = new Map<
    string,
    {
      isOpen: boolean;
      lastFailure: Date;
      failureCount: number;
      recoveryAttempts: number;
    }
  >();

  private alertHistory: Array<{
    id: string;
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
    resolved: boolean;
    resolutionTime?: Date;
  }> = [];

  private realTimeDashboardData = {
    lastUpdate: new Date(),
    activeWorkflows: 0,
    throughputPerMinute: 0,
    errorRatePercentage: 0,
    averageResponseTimeMs: 0,
    healthScore: 100,
  };

  // Alert thresholds
  private readonly ALERT_THRESHOLDS: AlertThreshold[] = [
    {
      metric: 'errorRate',
      operator: 'gt',
      value: 0.1, // > 10% error rate
      severity: 'warning',
      message: 'High error rate detected in Avito workflow',
    },
    {
      metric: 'errorRate',
      operator: 'gt',
      value: 0.25, // > 25% error rate
      severity: 'critical',
      message: 'Critical error rate in Avito workflow',
    },
    {
      metric: 'averageExecutionTimeMs',
      operator: 'gt',
      value: 60000, // > 1 minute
      severity: 'warning',
      message: 'Avito workflow execution time is high',
    },
    {
      metric: 'apiAverageResponseTimeMs',
      operator: 'gt',
      value: 10000, // > 10 seconds
      severity: 'warning',
      message: 'Avito API response time is slow',
    },
  ];

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Set up periodic health checks
    this.schedulePeriodicHealthChecks();
  }

  /**
   * Event listeners for workflow monitoring
   */
  @OnEvent('avito.workflow.started')
  onWorkflowStarted(payload: {
    userId: string;
    workspaceId: string;
    threadId: string;
    timestamp: Date;
  }): void {
    const executionId = `${payload.userId}_${payload.workspaceId}_${payload.threadId}`;

    const record: WorkflowExecutionRecord = {
      id: executionId,
      userId: payload.userId,
      workspaceId: payload.workspaceId,
      threadId: payload.threadId,
      startTime: payload.timestamp,
      currentState: AvitoWorkflowState.INIT,
      stepsExecuted: [],
      finalStatus: 'in_progress',
      credentialsValidated: false,
      credentialsStored: false,
      errorCount: 0,
    };

    this.executionRecords.set(executionId, record);
    this.metrics.totalWorkflows++;
    this.updateMetrics();

    this.logger.log(`Workflow monitoring started for ${executionId}`);
  }

  @OnEvent('avito.workflow.state.changed')
  onWorkflowStateChanged(payload: {
    userId: string;
    workspaceId: string;
    threadId: string;
    fromState: AvitoWorkflowState;
    toState: AvitoWorkflowState;
    executionTimeMs: number;
    timestamp: Date;
  }): void {
    const executionId = `${payload.userId}_${payload.workspaceId}_${payload.threadId}`;
    const record = this.executionRecords.get(executionId);

    if (record) {
      record.currentState = payload.toState;
      record.stepsExecuted.push({
        state: payload.toState,
        timestamp: payload.timestamp,
        executionTimeMs: payload.executionTimeMs,
        success: true,
      });

      // Update state distribution metrics
      this.metrics.stateDistribution[payload.toState] =
        (this.metrics.stateDistribution[payload.toState] || 0) + 1;

      this.updateMetrics();
    }
  }

  @OnEvent('avito.workflow.completed')
  onWorkflowCompleted(payload: {
    userId: string;
    workspaceId: string;
    threadId: string;
    success: boolean;
    credentialsValidated: boolean;
    credentialsStored: boolean;
    totalExecutionTimeMs: number;
    timestamp: Date;
  }): void {
    const executionId = `${payload.userId}_${payload.workspaceId}_${payload.threadId}`;
    const record = this.executionRecords.get(executionId);

    if (record) {
      record.endTime = payload.timestamp;
      record.finalStatus = payload.success ? 'success' : 'failed';
      record.credentialsValidated = payload.credentialsValidated;
      record.credentialsStored = payload.credentialsStored;
      record.totalExecutionTimeMs = payload.totalExecutionTimeMs;

      // Update completion metrics
      if (payload.success) {
        this.metrics.successfulWorkflows++;
      } else {
        this.metrics.failedWorkflows++;
      }

      if (payload.credentialsValidated) {
        this.metrics.credentialsValidated++;
      }

      if (payload.credentialsStored) {
        this.metrics.credentialsStored++;
      }

      // Update average execution time
      this.updateAverageExecutionTime();
      this.updateMetrics();

      this.logger.log(
        `Workflow completed: ${executionId} - Success: ${payload.success}`,
      );
    }
  }

  @OnEvent('avito.error.recovery.started')
  onErrorRecoveryStarted(payload: {
    errorType: AvitoErrorType;
    userId: string;
    workspaceId: string;
    attemptCount: number;
    timestamp: Date;
  }): void {
    const executionId = `${payload.userId}_${payload.workspaceId}`;
    const record = this.executionRecords.get(executionId);

    if (record) {
      record.errorCount++;
      record.lastError = {
        type: payload.errorType,
        message: `Recovery attempt ${payload.attemptCount}`,
        timestamp: payload.timestamp,
      };
    }

    // Update error frequency
    this.metrics.errorFrequency[payload.errorType] =
      (this.metrics.errorFrequency[payload.errorType] || 0) + 1;

    this.updateMetrics();
  }

  @OnEvent('avito.api.call.completed')
  onAPICallCompleted(payload: {
    success: boolean;
    responseTimeMs: number;
    endpoint: string;
    timestamp: Date;
  }): void {
    this.metrics.apiCallsTotal++;

    if (payload.success) {
      this.metrics.apiCallsSuccessful++;
    }

    // Update average API response time
    this.updateAverageAPIResponseTime(payload.responseTimeMs);
    this.updateMetrics();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const healthDetails = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkAvitoAPIHealth(),
        this.checkWorkflowPerformance(),
        this.checkErrorRates(),
        this.checkSystemResources(),
      ]);

      const overallStatus = this.determineOverallHealth(healthDetails);

      const result: HealthCheckResult = {
        status: overallStatus,
        message: this.getHealthMessage(overallStatus),
        details: healthDetails,
        metrics: { ...this.metrics },
        timestamp: new Date(),
      };

      // Store health history
      this.healthHistory.push(result);
      if (this.healthHistory.length > 100) {
        this.healthHistory.shift(); // Keep last 100 records
      }

      // Check alert thresholds
      this.checkAlertThresholds(result);

      const checkDuration = Date.now() - startTime;

      this.logger.log(
        `Health check completed in ${checkDuration}ms - Status: ${overallStatus}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Health check failed:', error);

      return {
        status: HealthStatus.CRITICAL,
        message: 'Health check execution failed',
        details: [
          {
            component: 'health-check-system',
            status: HealthStatus.CRITICAL,
            message: error.message,
            lastCheck: new Date(),
          },
        ],
        metrics: this.metrics,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Individual health check components
   */
  private async checkDatabaseHealth(): Promise<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
    responseTimeMs?: number;
  }> {
    const startTime = Date.now();

    try {
      // Test database connectivity by attempting a simple operation
      await this.userVarsService.get({
        userId: 'health-check',
        workspaceId: 'health-check',
        key: 'health-check-test',
      });

      const responseTime = Date.now() - startTime;

      return {
        component: 'database',
        status:
          responseTime < 1000 ? HealthStatus.HEALTHY : HealthStatus.WARNING,
        message: `Database accessible in ${responseTime}ms`,
        lastCheck: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        component: 'database',
        status: HealthStatus.CRITICAL,
        message: `Database connection failed: ${error.message}`,
        lastCheck: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  private async checkAvitoAPIHealth(): Promise<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
    responseTimeMs?: number;
  }> {
    const startTime = Date.now();

    try {
      // Simple connectivity test to Avito API (without authentication)
      const response = await fetch('https://api.avito.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials&client_id=test&client_secret=test',
      });

      const responseTime = Date.now() - startTime;

      // We expect a 401 or 400 response for invalid credentials, which means API is reachable
      const isReachable = response.status === 401 || response.status === 400;

      return {
        component: 'avito-api',
        status: isReachable ? HealthStatus.HEALTHY : HealthStatus.WARNING,
        message: isReachable
          ? `Avito API reachable in ${responseTime}ms`
          : `Avito API responded with status ${response.status}`,
        lastCheck: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        component: 'avito-api',
        status: HealthStatus.CRITICAL,
        message: `Avito API unreachable: ${error.message}`,
        lastCheck: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  private async checkWorkflowPerformance(): Promise<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
  }> {
    const errorRate = this.calculateErrorRate();
    const avgExecutionTime = this.metrics.averageExecutionTimeMs;

    let status = HealthStatus.HEALTHY;
    let message = 'Workflow performance is good';

    if (errorRate > 0.25) {
      status = HealthStatus.CRITICAL;
      message = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
    } else if (errorRate > 0.1 || avgExecutionTime > 60000) {
      status = HealthStatus.WARNING;
      message = `Performance degraded - Error rate: ${(errorRate * 100).toFixed(1)}%, Avg time: ${avgExecutionTime}ms`;
    }

    return {
      component: 'workflow-performance',
      status,
      message,
      lastCheck: new Date(),
    };
  }

  private async checkErrorRates(): Promise<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
  }> {
    const totalErrors = Object.values(this.metrics.errorFrequency).reduce(
      (sum, count) => sum + count,
      0,
    );
    const errorRate = this.calculateErrorRate();

    let status = HealthStatus.HEALTHY;
    let message = `Low error rate: ${(errorRate * 100).toFixed(1)}%`;

    if (totalErrors > 50) {
      status = HealthStatus.WARNING;
      message = `High error count: ${totalErrors} total errors`;
    }

    if (errorRate > 0.15) {
      status = HealthStatus.CRITICAL;
      message = `Critical error rate: ${(errorRate * 100).toFixed(1)}%`;
    }

    return {
      component: 'error-rates',
      status,
      message,
      lastCheck: new Date(),
    };
  }

  private async checkSystemResources(): Promise<{
    component: string;
    status: HealthStatus;
    message: string;
    lastCheck: Date;
  }> {
    // Basic memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;

    let status = HealthStatus.HEALTHY;
    let message = `Memory usage: ${memUsageMB.toFixed(1)}MB`;

    if (memUsageMB > 500) {
      status = HealthStatus.WARNING;
      message = `High memory usage: ${memUsageMB.toFixed(1)}MB`;
    }

    if (memUsageMB > 1000) {
      status = HealthStatus.CRITICAL;
      message = `Critical memory usage: ${memUsageMB.toFixed(1)}MB`;
    }

    return {
      component: 'system-resources',
      status,
      message,
      lastCheck: new Date(),
    };
  }

  /**
   * Helper methods
   */
  private initializeMetrics(): WorkflowMetrics {
    return {
      totalWorkflows: 0,
      successfulWorkflows: 0,
      failedWorkflows: 0,
      averageExecutionTimeMs: 0,
      stateDistribution: {} as Record<AvitoWorkflowState, number>,
      averageStepsPerWorkflow: 0,
      errorFrequency: {} as Record<AvitoErrorType, number>,
      recoverySuccessRate: 0,
      apiCallsTotal: 0,
      apiCallsSuccessful: 0,
      apiAverageResponseTimeMs: 0,
      credentialsProcessed: 0,
      credentialsValidated: 0,
      credentialsStored: 0,
      lastUpdated: new Date(),
      metricsCollectionPeriod: '24h',
    };
  }

  private calculateErrorRate(): number {
    const totalWorkflows = this.metrics.totalWorkflows;
    const failedWorkflows = this.metrics.failedWorkflows;

    return totalWorkflows > 0 ? failedWorkflows / totalWorkflows : 0;
  }

  private updateAverageExecutionTime(): void {
    const completedRecords = Array.from(this.executionRecords.values()).filter(
      (record) => record.totalExecutionTimeMs !== undefined,
    );

    if (completedRecords.length > 0) {
      const totalTime = completedRecords.reduce(
        (sum, record) => sum + (record.totalExecutionTimeMs || 0),
        0,
      );

      this.metrics.averageExecutionTimeMs = totalTime / completedRecords.length;
    }
  }

  private updateAverageAPIResponseTime(responseTime: number): void {
    const currentAvg = this.metrics.apiAverageResponseTimeMs;
    const totalCalls = this.metrics.apiCallsTotal;

    // Calculate running average
    this.metrics.apiAverageResponseTimeMs =
      (currentAvg * (totalCalls - 1) + responseTime) / totalCalls;
  }

  private updateMetrics(): void {
    this.metrics.lastUpdated = new Date();
  }

  private determineOverallHealth(healthDetails: any[]): HealthStatus {
    const criticalCount = healthDetails.filter(
      (detail) => detail.status === HealthStatus.CRITICAL,
    ).length;
    const warningCount = healthDetails.filter(
      (detail) => detail.status === HealthStatus.WARNING,
    ).length;

    if (criticalCount > 0) {
      return HealthStatus.CRITICAL;
    } else if (warningCount > 0) {
      return HealthStatus.WARNING;
    } else {
      return HealthStatus.HEALTHY;
    }
  }

  private getHealthMessage(status: HealthStatus): string {
    switch (status) {
      case HealthStatus.HEALTHY:
        return 'All Avito workflow components are operating normally';
      case HealthStatus.WARNING:
        return 'Some Avito workflow components have performance issues';
      case HealthStatus.CRITICAL:
        return 'Critical issues detected in Avito workflow system';
      default:
        return 'Health status unknown';
    }
  }

  private checkAlertThresholds(healthResult: HealthCheckResult): void {
    for (const threshold of this.ALERT_THRESHOLDS) {
      const metricValue = this.getMetricValue(threshold.metric);

      if (this.shouldTriggerAlert(metricValue, threshold)) {
        this.triggerAlert(threshold, metricValue, healthResult);
      }
    }
  }

  private getMetricValue(metric: string): number {
    switch (metric) {
      case 'errorRate':
        return this.calculateErrorRate();
      case 'averageExecutionTimeMs':
        return this.metrics.averageExecutionTimeMs;
      case 'apiAverageResponseTimeMs':
        return this.metrics.apiAverageResponseTimeMs;
      default:
        return 0;
    }
  }

  private shouldTriggerAlert(
    value: number,
    threshold: AlertThreshold,
  ): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.value;
      case 'gte':
        return value >= threshold.value;
      case 'lt':
        return value < threshold.value;
      case 'lte':
        return value <= threshold.value;
      case 'eq':
        return value === threshold.value;
      default:
        return false;
    }
  }

  private triggerAlert(
    threshold: AlertThreshold,
    currentValue: number,
    healthResult: HealthCheckResult,
  ): void {
    const alertEvent = {
      alertType: threshold.severity,
      metric: threshold.metric,
      threshold: threshold.value,
      currentValue,
      message: threshold.message,
      healthStatus: healthResult.status,
      timestamp: new Date(),
    };

    this.eventEmitter.emit('avito.workflow.alert', alertEvent);

    this.logger.warn(
      `ALERT [${threshold.severity.toUpperCase()}]: ${threshold.message} - Current: ${currentValue}, Threshold: ${threshold.value}`,
    );
  }

  private schedulePeriodicHealthChecks(): void {
    // Perform health check every 5 minutes
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Periodic health check failed:', error);
      }
    }, 300000); // 5 minutes
  }

  /**
   * Public API methods
   */
  getMetrics(): WorkflowMetrics {
    return { ...this.metrics };
  }

  /**
   * Get workflow metrics (required by tests)
   */
  getWorkflowMetrics(): WorkflowMetrics {
    return { ...this.metrics };
  }

  /**
   * Get workflow execution record for specific workflow (required by tests)
   */
  getWorkflowExecutionRecord(
    userId: string,
    workspaceId: string,
    threadId: string,
  ): WorkflowExecutionRecord | undefined {
    const executionId = `${userId}_${workspaceId}_${threadId}`;

    return this.executionRecords.get(executionId);
  }

  getExecutionRecords(): WorkflowExecutionRecord[] {
    return Array.from(this.executionRecords.values());
  }

  getHealthHistory(): HealthCheckResult[] {
    return [...this.healthHistory];
  }

  async resetMetrics(): Promise<void> {
    this.metrics = this.initializeMetrics();
    this.executionRecords.clear();
    this.healthHistory.length = 0;
    this.logger.log('Metrics and history reset');
  }

  // ===============================================================
  // ENHANCED MONITORING METHODS (Extracted from duplicate services)
  // ===============================================================

  /**
   * ENHANCED: Advanced performance analytics with percentiles
   * Extracted from: AvitoWorkflowMonitoringService
   */
  getAdvancedPerformanceAnalytics(): AdvancedPerformanceAnalytics {
    const executionTimes = this.performanceHistory
      .map((p) => p.executionTimeMs)
      .sort((a, b) => a - b);

    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil((arr.length * p) / 100) - 1;

      return arr[index] || 0;
    };

    // Calculate throughput trend
    const recentMetrics = this.performanceHistory.slice(-10);
    const oldMetrics = this.performanceHistory.slice(-20, -10);
    const currentThroughput = recentMetrics.length;
    const previousThroughput = oldMetrics.length;

    let throughputTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (currentThroughput > previousThroughput * 1.1) {
      throughputTrend = 'increasing';
    } else if (currentThroughput < previousThroughput * 0.9) {
      throughputTrend = 'decreasing';
    }

    // Analyze error patterns
    const errorPatterns: Array<{
      pattern: string;
      frequency: number;
      lastOccurrence: Date;
    }> = [];
    const errorMap = new Map<string, { count: number; lastSeen: Date }>();

    Object.entries(this.metrics.errorFrequency).forEach(
      ([errorType, frequency]) => {
        errorMap.set(errorType, { count: frequency, lastSeen: new Date() });
      },
    );

    errorMap.forEach((value, pattern) => {
      errorPatterns.push({
        pattern,
        frequency: value.count,
        lastOccurrence: value.lastSeen,
      });
    });

    // Calculate health trend
    const recentHealth = this.healthHistory.slice(-5);
    const healthScores = recentHealth.map((h) => {
      switch (h.status) {
        case HealthStatus.HEALTHY:
          return 100;
        case HealthStatus.WARNING:
          return 70;
        case HealthStatus.CRITICAL:
          return 30;
        default:
          return 50;
      }
    });

    const avgHealthScore =
      healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length;
    const prevHealthScore =
      healthScores.slice(0, 2).reduce((sum, score) => sum + score, 0) / 2;

    let healthTrend: 'improving' | 'degrading' | 'stable' = 'stable';

    if (avgHealthScore > prevHealthScore * 1.1) {
      healthTrend = 'improving';
    } else if (avgHealthScore < prevHealthScore * 0.9) {
      healthTrend = 'degrading';
    }

    const latestPerformance =
      this.performanceHistory[this.performanceHistory.length - 1];

    return {
      executionTimePercentiles: {
        p50: percentile(executionTimes, 50),
        p90: percentile(executionTimes, 90),
        p95: percentile(executionTimes, 95),
        p99: percentile(executionTimes, 99),
      },
      throughputAnalysis: {
        current: currentThroughput,
        trend: throughputTrend,
      },
      errorPatterns: errorPatterns.sort((a, b) => b.frequency - a.frequency),
      resourceUtilization: {
        memory: latestPerformance?.memoryUsageMB || 0,
        cpu: latestPerformance?.cpuUsagePercent || 0,
        connections: latestPerformance?.activeConnections || 0,
      },
      healthTrends: {
        current: avgHealthScore,
        trend: healthTrend,
      },
    };
  }

  /**
   * ENHANCED: Circuit breaker monitoring
   * Extracted from: AvitoWorkflowMonitoringService
   */
  monitorCircuitBreaker(
    serviceName: string,
    isOpen: boolean,
    error?: Error,
  ): void {
    if (!this.circuitBreakerStatus.has(serviceName)) {
      this.circuitBreakerStatus.set(serviceName, {
        isOpen: false,
        lastFailure: new Date(),
        failureCount: 0,
        recoveryAttempts: 0,
      });
    }

    const status = this.circuitBreakerStatus.get(serviceName)!;

    if (isOpen && !status.isOpen) {
      // Circuit breaker opened
      status.isOpen = true;
      status.lastFailure = new Date();
      status.failureCount++;

      this.createAlert({
        type: 'circuit-breaker-opened',
        severity: 'error',
        message: `Circuit breaker opened for ${serviceName}: ${error?.message || 'Unknown error'}`,
        metadata: { serviceName, failureCount: status.failureCount },
      });

      this.logger.warn(`Circuit breaker opened for ${serviceName}`);
    } else if (!isOpen && status.isOpen) {
      // Circuit breaker closed (recovered)
      status.isOpen = false;
      status.recoveryAttempts++;

      this.createAlert({
        type: 'circuit-breaker-recovered',
        severity: 'info',
        message: `Circuit breaker recovered for ${serviceName}`,
        metadata: { serviceName, recoveryAttempts: status.recoveryAttempts },
      });

      this.logger.log(`Circuit breaker recovered for ${serviceName}`);
    }
  }

  /**
   * ENHANCED: Real-time dashboard data aggregation
   * Extracted from: AvitoWorkflowMonitoringService
   */
  getRealTimeDashboardData(): RealTimeDashboardData {
    // Calculate active workflows
    const activeWorkflows = Array.from(this.executionRecords.values()).filter(
      (record) => record.finalStatus === 'in_progress',
    ).length;

    // Calculate throughput per minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentCompletions = Array.from(this.executionRecords.values()).filter(
      (record) => record.endTime && record.endTime > oneMinuteAgo,
    ).length;

    // Calculate current error rate
    const errorRatePercentage = this.calculateErrorRate() * 100;

    // Get top errors
    const topErrors = Object.entries(this.metrics.errorFrequency)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get recent alerts
    const recentAlerts = this.alertHistory
      .filter((alert) => !alert.resolved)
      .slice(-10)
      .map((alert) => ({
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
      }));

    // Get circuit breaker status
    const circuitBreakerStatusList = Array.from(
      this.circuitBreakerStatus.entries(),
    ).map(([service, status]) => ({
      service,
      isOpen: status.isOpen,
      failureCount: status.failureCount,
    }));

    // Calculate health score
    const latestHealth = this.healthHistory[this.healthHistory.length - 1];
    let healthScore = 100;

    if (latestHealth) {
      switch (latestHealth.status) {
        case HealthStatus.WARNING:
          healthScore = 70;
          break;
        case HealthStatus.CRITICAL:
          healthScore = 30;
          break;
        case HealthStatus.UNKNOWN:
          healthScore = 50;
          break;
      }
    }

    // Update cached dashboard data
    this.realTimeDashboardData = {
      lastUpdate: new Date(),
      activeWorkflows,
      throughputPerMinute: recentCompletions,
      errorRatePercentage,
      averageResponseTimeMs: this.metrics.averageExecutionTimeMs,
      healthScore,
    };

    return {
      timestamp: new Date(),
      activeWorkflows,
      throughputPerMinute: recentCompletions,
      errorRatePercentage,
      averageResponseTimeMs: this.metrics.averageExecutionTimeMs,
      healthScore,
      topErrors,
      systemAlerts: recentAlerts,
      circuitBreakerStatus: circuitBreakerStatusList,
    };
  }

  /**
   * ENHANCED: Predictive alerting based on trends
   * Extracted from: AvitoWorkflowMonitoringService
   */
  analyzePerformanceTrends(): PerformanceTrends {
    const predictions: Array<{
      metric: string;
      currentValue: number;
      predictedValue: number;
      confidence: number;
      timeToThreshold: number;
      recommendation: string;
    }> = [];

    // Analyze error rate trend
    const recentErrorRates = this.healthHistory.slice(-10).map((h) => {
      const totalWorkflows = h.metrics.totalWorkflows;
      const failedWorkflows = h.metrics.failedWorkflows;

      return totalWorkflows > 0 ? failedWorkflows / totalWorkflows : 0;
    });

    if (recentErrorRates.length >= 3) {
      const trend = this.calculateLinearTrend(recentErrorRates);
      const currentErrorRate = recentErrorRates[recentErrorRates.length - 1];
      const predictedErrorRate = currentErrorRate + trend * 5; // 5 time periods ahead

      predictions.push({
        metric: 'error_rate',
        currentValue: currentErrorRate,
        predictedValue: predictedErrorRate,
        confidence: 0.75,
        timeToThreshold: predictedErrorRate > 0.15 ? 25 : -1,
        recommendation:
          predictedErrorRate > 0.15
            ? 'Investigate error patterns and prepare mitigation'
            : 'Continue monitoring',
      });
    }

    // Analyze response time trend
    const recentResponseTimes = this.performanceHistory
      .slice(-10)
      .map((p) => p.executionTimeMs);

    if (recentResponseTimes.length >= 3) {
      const trend = this.calculateLinearTrend(recentResponseTimes);
      const currentResponseTime =
        recentResponseTimes[recentResponseTimes.length - 1];
      const predictedResponseTime = currentResponseTime + trend * 5;

      predictions.push({
        metric: 'response_time',
        currentValue: currentResponseTime,
        predictedValue: predictedResponseTime,
        confidence: 0.7,
        timeToThreshold: predictedResponseTime > 60000 ? 30 : -1,
        recommendation:
          predictedResponseTime > 60000
            ? 'Consider performance optimization'
            : 'Performance is stable',
      });
    }

    // Risk assessment
    const riskFactors: string[] = [];
    const mitigationSuggestions: string[] = [];

    const currentErrorRate = this.calculateErrorRate();
    const openCircuitBreakers = Array.from(
      this.circuitBreakerStatus.values(),
    ).filter((status) => status.isOpen).length;

    if (currentErrorRate > 0.1) {
      riskFactors.push('High error rate detected');
      mitigationSuggestions.push(
        'Review error logs and implement additional retry mechanisms',
      );
    }

    if (openCircuitBreakers > 0) {
      riskFactors.push(
        `${openCircuitBreakers} circuit breaker(s) currently open`,
      );
      mitigationSuggestions.push('Investigate downstream service issues');
    }

    if (this.metrics.averageExecutionTimeMs > 45000) {
      riskFactors.push('High average execution time');
      mitigationSuggestions.push('Optimize workflow steps and API calls');
    }

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (riskFactors.length >= 3) {
      riskLevel = 'critical';
    } else if (riskFactors.length === 2) {
      riskLevel = 'high';
    } else if (riskFactors.length === 1) {
      riskLevel = 'medium';
    }

    return {
      predictions,
      riskAssessment: {
        level: riskLevel,
        factors: riskFactors,
        mitigationSuggestions,
      },
    };
  }

  /**
   * ENHANCED: Enhanced alert management system
   * Extracted from: AvitoWorkflowMonitoringService
   */
  private createAlert(alertData: {
    type: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    metadata?: Record<string, any>;
  }): string {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const alert = {
      id: alertId,
      type: alertData.type,
      severity: alertData.severity,
      message: alertData.message,
      timestamp: new Date(),
      resolved: false,
    };

    this.alertHistory.push(alert);

    // Keep only last 200 alerts
    if (this.alertHistory.length > 200) {
      this.alertHistory.splice(0, this.alertHistory.length - 200);
    }

    // Emit alert event
    this.eventEmitter.emit('avito.monitoring.alert', {
      ...alert,
      metadata: alertData.metadata,
    });

    return alertId;
  }

  /**
   * Resolve an active alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(
      (a) => a.id === alertId && !a.resolved,
    );

    if (alert) {
      alert.resolved = true;
      alert.resolutionTime = new Date();

      this.eventEmitter.emit('avito.monitoring.alert.resolved', {
        alertId,
        resolutionTime: alert.resolutionTime,
      });

      return true;
    }

    return false;
  }

  /**
   * Helper method to calculate linear trend from data points
   */
  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return isNaN(slope) ? 0 : slope;
  }

  /**
   * Enhanced method to track performance metrics
   */
  trackPerformanceMetric(data: {
    executionTimeMs: number;
    memoryUsageMB?: number;
    cpuUsagePercent?: number;
    activeConnections?: number;
  }): void {
    const memUsage = process.memoryUsage();

    this.performanceHistory.push({
      timestamp: new Date(),
      executionTimeMs: data.executionTimeMs,
      memoryUsageMB: data.memoryUsageMB || memUsage.heapUsed / 1024 / 1024,
      cpuUsagePercent: data.cpuUsagePercent || 0,
      activeConnections: data.activeConnections || 0,
    });

    // Keep only last 1000 performance records
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.splice(0, this.performanceHistory.length - 1000);
    }
  }

  /**
   * Get comprehensive monitoring report
   */
  getComprehensiveMonitoringReport(): {
    summary: {
      overallHealth: HealthStatus;
      totalWorkflows: number;
      activeWorkflows: number;
      errorRate: number;
      averageResponseTime: number;
    };
    analytics: AdvancedPerformanceAnalytics;
    dashboard: RealTimeDashboardData;
    trends: PerformanceTrends;
    alerts: {
      active: number;
      resolved: number;
      bySeveiry: Record<string, number>;
    };
    circuitBreakers: {
      total: number;
      open: number;
      services: string[];
    };
  } {
    const latestHealth = this.healthHistory[this.healthHistory.length - 1];
    const activeAlerts = this.alertHistory.filter((a) => !a.resolved);
    const resolvedAlerts = this.alertHistory.filter((a) => a.resolved);

    const alertsBySeverity: Record<string, number> = {};

    this.alertHistory.forEach((alert) => {
      alertsBySeverity[alert.severity] =
        (alertsBySeverity[alert.severity] || 0) + 1;
    });

    const openCircuitBreakers = Array.from(
      this.circuitBreakerStatus.entries(),
    ).filter(([_, status]) => status.isOpen);

    return {
      summary: {
        overallHealth: latestHealth?.status || HealthStatus.UNKNOWN,
        totalWorkflows: this.metrics.totalWorkflows,
        activeWorkflows: Array.from(this.executionRecords.values()).filter(
          (record) => record.finalStatus === 'in_progress',
        ).length,
        errorRate: this.calculateErrorRate(),
        averageResponseTime: this.metrics.averageExecutionTimeMs,
      },
      analytics: this.getAdvancedPerformanceAnalytics(),
      dashboard: this.getRealTimeDashboardData(),
      trends: this.analyzePerformanceTrends(),
      alerts: {
        active: activeAlerts.length,
        resolved: resolvedAlerts.length,
        bySeveiry: alertsBySeverity,
      },
      circuitBreakers: {
        total: this.circuitBreakerStatus.size,
        open: openCircuitBreakers.length,
        services: openCircuitBreakers.map(([service]) => service),
      },
    };
  }
}
