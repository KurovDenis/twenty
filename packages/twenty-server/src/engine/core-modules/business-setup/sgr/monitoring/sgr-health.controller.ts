import { Controller, Get, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { SGRModuleHealthIndicator } from './sgr-module-health.indicator';

@ApiTags('Business Setup SGR Health')
@Controller('health/business-setup-sgr')
export class SGRHealthController {
  private readonly logger = new Logger(SGRHealthController.name);

  constructor(
    private healthCheckService: HealthCheckService,
    private sgrHealthIndicator: SGRModuleHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Get SGR module health status',
    description:
      'Returns comprehensive health status of the Business Setup SGR module including services, dependencies, and metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health check passed - module is healthy',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Health check failed - module has issues',
  })
  async check() {
    this.logger.log('Performing SGR module health check');

    return this.healthCheckService.check([
      () => this.sgrHealthIndicator.isHealthy('sgr-module'),
    ]);
  }

  @Get('detailed')
  @ApiOperation({
    summary: 'Get detailed SGR module health report',
    description:
      'Returns detailed health metrics including service performance, dependency status, and event system metrics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detailed health report retrieved successfully',
  })
  async getDetailedHealth() {
    this.logger.log('Generating detailed SGR module health report');

    try {
      const report = await this.sgrHealthIndicator.performFullHealthCheck();

      return {
        status: HttpStatus.OK,
        timestamp: new Date().toISOString(),
        data: report,
      };
    } catch (error) {
      this.logger.error('Failed to generate detailed health report', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get current SGR module metrics',
    description:
      'Returns current performance and operational metrics for the SGR module',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics retrieved successfully',
  })
  async getMetrics() {
    this.logger.log('Retrieving SGR module metrics');

    try {
      const metrics = this.sgrHealthIndicator.getCurrentHealthMetrics();

      return {
        status: HttpStatus.OK,
        timestamp: new Date().toISOString(),
        data: {
          uptime: metrics.overall.uptime,
          eventMetrics: metrics.events,
          serviceCount: Object.keys(metrics.services).length,
          dependencyCount: Object.keys(metrics.dependencies).length,
          healthyServices: Object.values(metrics.services).filter(
            (service) => service.status === 'up',
          ).length,
          healthyDependencies: Object.values(metrics.dependencies).filter(
            (dep) => dep.status === 'connected',
          ).length,
          criticalIssuesCount: metrics.overall.criticalIssues.length,
          warningsCount: metrics.overall.warnings.length,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve metrics', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('dependencies')
  @ApiOperation({
    summary: 'Validate SGR module dependency integrity',
    description:
      'Checks if all dependencies are properly registered and configured',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dependency validation completed',
  })
  async validateDependencies() {
    this.logger.log('Validating SGR module dependency integrity');

    try {
      const validation =
        await this.sgrHealthIndicator.validateDependencyIntegrity();

      return {
        status: validation.isValid ? HttpStatus.OK : HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        data: validation,
      };
    } catch (error) {
      this.logger.error('Dependency validation failed', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('reset-metrics')
  @ApiOperation({
    summary: 'Reset SGR module metrics',
    description:
      'Resets all performance and operational metrics (use for debugging/testing)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Metrics reset successfully',
  })
  async resetMetrics() {
    this.logger.log('Resetting SGR module metrics');

    try {
      this.sgrHealthIndicator.resetMetrics();

      return {
        status: HttpStatus.OK,
        timestamp: new Date().toISOString(),
        message: 'SGR module metrics reset successfully',
      };
    } catch (error) {
      this.logger.error('Failed to reset metrics', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('services')
  @ApiOperation({
    summary: 'Get individual service health status',
    description: 'Returns health status for each SGR service individually',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service health status retrieved successfully',
  })
  async getServiceHealth() {
    this.logger.log('Retrieving individual service health status');

    try {
      const report = await this.sgrHealthIndicator.performFullHealthCheck();

      const serviceHealth = Object.entries(report.services).map(
        ([name, service]) => ({
          name,
          status: service.status,
          lastCheck: service.lastCheck,
          responseTime: service.metrics?.responseTime,
          availability: service.metrics?.availability,
          error: service.error,
        }),
      );

      return {
        status: HttpStatus.OK,
        timestamp: new Date().toISOString(),
        data: {
          services: serviceHealth,
          summary: {
            total: serviceHealth.length,
            healthy: serviceHealth.filter((s) => s.status === 'up').length,
            unhealthy: serviceHealth.filter((s) => s.status === 'down').length,
            degraded: serviceHealth.filter((s) => s.status === 'degraded')
              .length,
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve service health', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  @Get('events')
  @ApiOperation({
    summary: 'Get event system health and metrics',
    description:
      'Returns metrics about the event-driven architecture performance',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Event metrics retrieved successfully',
  })
  async getEventMetrics() {
    this.logger.log('Retrieving event system metrics');

    try {
      const metrics = this.sgrHealthIndicator.getCurrentHealthMetrics();
      const eventData = metrics.events;

      const handlingRatio =
        eventData.emittedCount > 0
          ? ((eventData.handledCount / eventData.emittedCount) * 100).toFixed(2)
          : '100.00';

      const errorRate =
        eventData.emittedCount > 0
          ? ((eventData.errorCount / eventData.emittedCount) * 100).toFixed(2)
          : '0.00';

      return {
        status: HttpStatus.OK,
        timestamp: new Date().toISOString(),
        data: {
          events: {
            emitted: eventData.emittedCount,
            handled: eventData.handledCount,
            errors: eventData.errorCount,
            lastEventTime: eventData.lastEventTime,
          },
          metrics: {
            handlingRatio: `${handlingRatio}%`,
            errorRate: `${errorRate}%`,
            isHealthy:
              parseFloat(handlingRatio) >= 80 && parseFloat(errorRate) <= 10,
          },
          analysis: {
            eventFlowStatus:
              parseFloat(handlingRatio) >= 80 ? 'healthy' : 'degraded',
            errorStatus:
              parseFloat(errorRate) <= 10 ? 'acceptable' : 'concerning',
            lastActivity: eventData.lastEventTime
              ? `${Math.round((Date.now() - eventData.lastEventTime.getTime()) / 1000 / 60)} minutes ago`
              : 'No events recorded',
          },
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve event metrics', error);

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
