import { Injectable, Logger } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { AgentChatService } from 'src/engine/metadata-modules/agent/agent-chat.service';
import { AiModelRegistryService } from 'src/engine/core-modules/ai/services/ai-model-registry.service';

import { SupervisorSGRService } from '../services/supervisor-sgr.service';
import { SupervisorToolDispatcherService } from '../services/supervisor-tool-dispatcher.service';
import { AvitoWelcomeSGRService } from '../services/avito-welcome-sgr.service';
import { BusinessSetupAgentService } from '../../services/business-setup-agent.service';
import { BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import { BUSINESS_SETUP_EVENTS } from '../../events/business-setup.events';

export interface SGRModuleHealthReport {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: {
    [serviceName: string]: {
      status: 'up' | 'down' | 'degraded';
      lastCheck: Date;
      error?: string;
      metrics?: {
        responseTime?: number;
        errorRate?: number;
        availability?: number;
      };
    };
  };
  dependencies: {
    [dependencyName: string]: {
      status: 'connected' | 'disconnected' | 'slow';
      lastCheck: Date;
      error?: string;
    };
  };
  events: {
    emittedCount: number;
    handledCount: number;
    errorCount: number;
    lastEventTime?: Date;
  };
  overall: {
    uptime: number;
    lastFullCheck: Date;
    criticalIssues: string[];
    warnings: string[];
  };
}

@Injectable()
export class SGRModuleHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(SGRModuleHealthIndicator.name);
  private healthMetrics: SGRModuleHealthReport;
  private moduleStartTime: Date = new Date();
  private eventMetrics = {
    emitted: 0,
    handled: 0,
    errors: 0,
    lastEvent: undefined as Date | undefined,
  };

  constructor(
    private supervisorSGRService: SupervisorSGRService,
    private toolDispatcherService: SupervisorToolDispatcherService,
    private avitoWelcomeService: AvitoWelcomeSGRService,
    private userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private agentChatService: AgentChatService,
    private aiModelRegistryService: AiModelRegistryService,
    private businessSetupAgentService: BusinessSetupAgentService,
    private eventEmitter: EventEmitter2,
  ) {
    super();
    this.initializeHealthMetrics();
    this.setupEventMetricsTracking();
  }

  private initializeHealthMetrics(): void {
    this.healthMetrics = {
      status: 'healthy',
      services: {},
      dependencies: {},
      events: {
        emittedCount: 0,
        handledCount: 0,
        errorCount: 0,
      },
      overall: {
        uptime: 0,
        lastFullCheck: new Date(),
        criticalIssues: [],
        warnings: [],
      },
    };
  }

  private setupEventMetricsTracking(): void {
    // Track event emissions
    const originalEmit = this.eventEmitter.emit.bind(this.eventEmitter);

    this.eventEmitter.emit = (event: string, ...args: any[]) => {
      this.eventMetrics.emitted++;
      this.eventMetrics.lastEvent = new Date();

      return originalEmit(event, ...args);
    };

    // Track specific business setup events
    this.eventEmitter.on(
      BUSINESS_SETUP_EVENTS.SUPERVISOR_PROCESS_MESSAGE,
      () => {
        this.eventMetrics.handled++;
      },
    );

    this.eventEmitter.on(BUSINESS_SETUP_EVENTS.SUPERVISOR_AGENT_HANDOFF, () => {
      this.eventMetrics.handled++;
    });

    this.eventEmitter.on('supervisor.status-changed', () => {
      this.eventMetrics.handled++;
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthReport = await this.performFullHealthCheck();

      if (healthReport.status === 'healthy') {
        return this.getStatus(key, true, healthReport);
      } else {
        throw new HealthCheckError(
          'SGR Module Health Check Failed',
          this.getStatus(key, false, healthReport),
        );
      }
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw new HealthCheckError(
        'SGR Module Health Check Error',
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }

  async performFullHealthCheck(): Promise<SGRModuleHealthReport> {
    const startTime = Date.now();
    const report: SGRModuleHealthReport = {
      status: 'healthy',
      services: {},
      dependencies: {},
      events: {
        emittedCount: this.eventMetrics.emitted,
        handledCount: this.eventMetrics.handled,
        errorCount: this.eventMetrics.errors,
        lastEventTime: this.eventMetrics.lastEvent,
      },
      overall: {
        uptime: Date.now() - this.moduleStartTime.getTime(),
        lastFullCheck: new Date(),
        criticalIssues: [],
        warnings: [],
      },
    };

    // Check core SGR services
    await this.checkSGRServices(report);

    // Check external dependencies
    await this.checkExternalDependencies(report);

    // Check event system health
    this.checkEventSystemHealth(report);

    // Determine overall status
    this.determineOverallHealth(report);

    const checkTime = Date.now() - startTime;

    this.logger.log(
      `Health check completed in ${checkTime}ms - Status: ${report.status}`,
    );

    this.healthMetrics = report;

    return report;
  }

  private async checkSGRServices(report: SGRModuleHealthReport): Promise<void> {
    const services = [
      { name: 'SupervisorSGRService', instance: this.supervisorSGRService },
      {
        name: 'SupervisorToolDispatcherService',
        instance: this.toolDispatcherService,
      },
      { name: 'AvitoWelcomeService', instance: this.avitoWelcomeService },
    ];

    for (const service of services) {
      const startTime = Date.now();

      try {
        // Check if service is properly instantiated
        if (!service.instance) {
          throw new Error('Service not instantiated');
        }

        // Perform service-specific health checks
        await this.performServiceHealthCheck(service.name, service.instance);

        const responseTime = Date.now() - startTime;

        report.services[service.name] = {
          status: 'up',
          lastCheck: new Date(),
          metrics: {
            responseTime,
            availability: 100,
            errorRate: 0,
          },
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        report.services[service.name] = {
          status: 'down',
          lastCheck: new Date(),
          error: error.message,
          metrics: {
            responseTime,
            availability: 0,
            errorRate: 100,
          },
        };
        report.overall.criticalIssues.push(`${service.name}: ${error.message}`);
      }
    }
  }

  private async performServiceHealthCheck(
    serviceName: string,
    serviceInstance: any,
  ): Promise<void> {
    switch (serviceName) {
      case 'SupervisorToolDispatcherService':
        // Test basic status check functionality
        await serviceInstance.checkBusinessSetupStatus(
          'health-check',
          'health-check',
        );
        break;

      case 'SupervisorSGRService':
        // Verify service is responsive (basic method availability check)
        if (typeof serviceInstance.processMessageWithStreaming !== 'function') {
          throw new Error('Core method not available');
        }
        break;

      case 'AvitoWelcomeService':
        // Check if streaming method is available
        if (
          typeof serviceInstance.processWelcomeMessageWithStreaming !==
          'function'
        ) {
          throw new Error('Streaming method not available');
        }
        break;

      default:
        // Generic service health check
        if (!serviceInstance) {
          throw new Error('Service instance is null or undefined');
        }
    }
  }

  private async checkExternalDependencies(
    report: SGRModuleHealthReport,
  ): Promise<void> {
    const dependencies = [
      { name: 'UserVarsService', instance: this.userVarsService },
      { name: 'AgentChatService', instance: this.agentChatService },
      { name: 'AiModelRegistryService', instance: this.aiModelRegistryService },
      {
        name: 'BusinessSetupAgentService',
        instance: this.businessSetupAgentService,
      },
      { name: 'EventEmitter', instance: this.eventEmitter },
    ];

    for (const dep of dependencies) {
      const startTime = Date.now();

      try {
        await this.checkDependencyHealth(dep.name, dep.instance);

        const responseTime = Date.now() - startTime;

        report.dependencies[dep.name] = {
          status: responseTime > 1000 ? 'slow' : 'connected',
          lastCheck: new Date(),
        };

        if (responseTime > 1000) {
          report.overall.warnings.push(
            `${dep.name} responding slowly (${responseTime}ms)`,
          );
        }
      } catch (error) {
        report.dependencies[dep.name] = {
          status: 'disconnected',
          lastCheck: new Date(),
          error: error.message,
        };
        report.overall.criticalIssues.push(`${dep.name}: ${error.message}`);
      }
    }
  }

  private async checkDependencyHealth(
    depName: string,
    depInstance: any,
  ): Promise<void> {
    if (!depInstance) {
      throw new Error('Dependency not injected');
    }

    switch (depName) {
      case 'UserVarsService':
        // Test basic get operation
        try {
          await depInstance.get({
            userId: 'health-check',
            workspaceId: 'health-check',
            key: 'health-check',
          });
        } catch (error) {
          // This is expected for non-existent health check keys
          if (!error.message.includes('not found')) {
            throw error;
          }
        }
        break;

      case 'AgentChatService':
        // Test service availability
        if (typeof depInstance.getMessages !== 'function') {
          throw new Error('Required methods not available');
        }
        break;

      case 'AiModelRegistryService':
        // Test service availability
        if (typeof depInstance.getEffectiveModelConfig !== 'function') {
          throw new Error('AI model registry not available');
        }
        break;

      case 'BusinessSetupAgentService':
        // Test service availability
        if (typeof depInstance.getAgentForStep !== 'function') {
          throw new Error('Agent service methods not available');
        }
        break;

      case 'EventEmitter':
        // Test event emission capability
        const testEventName = `health-check-${Date.now()}`;

        depInstance.emit(testEventName, { test: true });
        break;

      default:
        // Generic dependency check
        if (!depInstance) {
          throw new Error('Dependency instance is null');
        }
    }
  }

  private checkEventSystemHealth(report: SGRModuleHealthReport): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Check if events are being processed
    if (
      this.eventMetrics.lastEvent &&
      this.eventMetrics.lastEvent.getTime() < oneHourAgo
    ) {
      report.overall.warnings.push('No events processed in the last hour');
    }

    // Check event handling ratio
    const handlingRatio =
      this.eventMetrics.emitted > 0
        ? this.eventMetrics.handled / this.eventMetrics.emitted
        : 1;

    if (handlingRatio < 0.8) {
      report.overall.warnings.push(
        `Low event handling ratio: ${(handlingRatio * 100).toFixed(1)}%`,
      );
    }

    // Check error rate
    const errorRate =
      this.eventMetrics.emitted > 0
        ? this.eventMetrics.errors / this.eventMetrics.emitted
        : 0;

    if (errorRate > 0.1) {
      report.overall.criticalIssues.push(
        `High event error rate: ${(errorRate * 100).toFixed(1)}%`,
      );
    }
  }

  private determineOverallHealth(report: SGRModuleHealthReport): void {
    const hasDownServices = Object.values(report.services).some(
      (service) => service.status === 'down',
    );

    const hasDisconnectedDeps = Object.values(report.dependencies).some(
      (dep) => dep.status === 'disconnected',
    );

    const hasCriticalIssues = report.overall.criticalIssues.length > 0;

    if (hasDownServices || hasDisconnectedDeps || hasCriticalIssues) {
      report.status = 'unhealthy';
    } else if (report.overall.warnings.length > 0) {
      report.status = 'degraded';
    } else {
      report.status = 'healthy';
    }
  }

  // Public method to get current health metrics
  getCurrentHealthMetrics(): SGRModuleHealthReport {
    return { ...this.healthMetrics };
  }

  // Public method to reset metrics
  resetMetrics(): void {
    this.eventMetrics = {
      emitted: 0,
      handled: 0,
      errors: 0,
      lastEvent: undefined,
    };
    this.moduleStartTime = new Date();
    this.initializeHealthMetrics();
  }

  // Method to track custom metrics
  incrementErrorCount(): void {
    this.eventMetrics.errors++;
  }

  // Method to validate module dependency integrity
  async validateDependencyIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check service registration order
      const services = [
        this.toolDispatcherService,
        this.supervisorSGRService,
        this.avitoWelcomeService,
      ];

      for (let i = 0; i < services.length; i++) {
        if (!services[i]) {
          issues.push(`Service at index ${i} is not properly registered`);
          recommendations.push(
            'Check BusinessSetupModule provider registration order',
          );
        }
      }

      // Check for circular dependency resolution
      if (this.supervisorSGRService && this.toolDispatcherService) {
        // If both services are available, the circular dependency was resolved
        recommendations.push(
          'Circular dependency successfully resolved through event-driven architecture',
        );
      }

      // Check event system
      if (!this.eventEmitter) {
        issues.push('EventEmitter2 not available');
        recommendations.push('Ensure EventEmitterModule is imported');
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      issues.push(`Dependency validation failed: ${error.message}`);

      return { isValid: false, issues, recommendations };
    }
  }
}
