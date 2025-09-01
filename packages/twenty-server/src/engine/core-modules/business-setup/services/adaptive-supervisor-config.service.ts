import { Injectable, Logger } from '@nestjs/common';

import { BusinessSetupStatus } from '../enums/business-setup-status.enum';

export enum RequestComplexity {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
}

export interface SupervisorConfig {
  maxSteps: number;
  timeoutMs: number;
  retryAttempts: number;
  model: string;
  temperature: number;
  maxTokens?: number;
}

export interface SupervisorRequest {
  requiresExternalAPI?: boolean;
  hasMultipleSteps?: boolean;
  needsProviderIntegration?: boolean;
  messageLength?: number;
  userMessage?: string;
  requestType?: string;
  businessStatus?: BusinessSetupStatus;
  context?: any;
}

/**
 * Service for adaptive Supervisor configuration based on request complexity
 * Implements memory-specified simple (3 steps) vs complex (8 steps) logic
 */
@Injectable()
export class AdaptiveSupervisorConfigService {
  private readonly logger = new Logger(AdaptiveSupervisorConfigService.name);

  /**
   * Get configuration based on request complexity
   */
  getConfigForRequest(complexity: RequestComplexity): SupervisorConfig {
    const baseConfigs = {
      [RequestComplexity.SIMPLE]: {
        maxSteps: 3,
        timeoutMs: 15000,
        retryAttempts: 2,
        model: 'google/gemini-2.0-flash-001',
        temperature: 0.1, // Lower temperature for precise simple tasks
        maxTokens: 1000,
      },
      [RequestComplexity.COMPLEX]: {
        maxSteps: 8,
        timeoutMs: 45000,
        retryAttempts: 3,
        model: 'google/gemini-2.0-flash-001',
        temperature: 0.3, // Higher temperature for creative complex tasks
        maxTokens: 4000,
      },
    };

    const config = baseConfigs[complexity];

    this.logger.debug(
      `Generated ${complexity} configuration: maxSteps=${config.maxSteps}, timeout=${config.timeoutMs}ms`,
    );

    return config;
  }

  /**
   * Determine request complexity based on multiple factors
   */
  determineComplexity(request: SupervisorRequest): RequestComplexity {
    const complexityIndicators = [
      request.requiresExternalAPI || false,
      request.hasMultipleSteps || false,
      request.needsProviderIntegration || false,
      (request.messageLength || 0) > 500,
      this.hasComplexKeywords(request.userMessage || ''),
      this.requiresMultiStepReasoning(request.userMessage || ''),
    ];

    const complexityScore = complexityIndicators.filter(Boolean).length;
    const complexity =
      complexityScore >= 2
        ? RequestComplexity.COMPLEX
        : RequestComplexity.SIMPLE;

    this.logger.debug(
      `Complexity analysis: score=${complexityScore}/6, result=${complexity}`,
      {
        indicators: {
          requiresExternalAPI: request.requiresExternalAPI,
          hasMultipleSteps: request.hasMultipleSteps,
          needsProviderIntegration: request.needsProviderIntegration,
          longMessage: (request.messageLength || 0) > 500,
          complexKeywords: this.hasComplexKeywords(request.userMessage || ''),
          multiStepReasoning: this.requiresMultiStepReasoning(
            request.userMessage || '',
          ),
        },
      },
    );

    return complexity;
  }

  /**
   * Analyze request and return appropriate configuration
   */
  analyzeAndConfigure(request: SupervisorRequest): {
    complexity: RequestComplexity;
    config: SupervisorConfig;
    reasoning: string;
  } {
    const complexity = this.determineComplexity(request);
    const config = this.getConfigForRequest(complexity);

    const reasoning = this.explainComplexityDecision(request, complexity);

    return {
      complexity,
      config,
      reasoning,
    };
  }

  /**
   * Analyze complexity for a given request
   */
  analyzeComplexity(request: SupervisorRequest): RequestComplexity {
    return this.determineComplexity(request);
  }

  /**
   * Get configuration for specific request types
   */
  getConfigForRequestType(requestType: string): SupervisorConfig {
    const typeComplexityMap: Record<string, RequestComplexity> = {
      ui_guidance: RequestComplexity.SIMPLE,
      status_check: RequestComplexity.SIMPLE,
      quick_action: RequestComplexity.SIMPLE,
      business_setup: RequestComplexity.COMPLEX,
      provider_integration: RequestComplexity.COMPLEX,
      workflow_creation: RequestComplexity.COMPLEX,
      multi_step_analysis: RequestComplexity.COMPLEX,
    };

    const complexity =
      typeComplexityMap[requestType] || RequestComplexity.SIMPLE;

    return this.getConfigForRequest(complexity);
  }

  /**
   * Update configuration based on performance metrics
   */
  adaptConfigBasedOnMetrics(
    baseConfig: SupervisorConfig,
    metrics: {
      averageExecutionTime: number;
      successRate: number;
      timeoutRate: number;
    },
  ): SupervisorConfig {
    const adaptedConfig = { ...baseConfig };

    // Increase timeout if we're seeing too many timeouts
    if (metrics.timeoutRate > 0.1) {
      // More than 10% timeouts
      adaptedConfig.timeoutMs = Math.min(
        adaptedConfig.timeoutMs * 1.5,
        120000, // Max 2 minutes
      );
      this.logger.debug(
        `Increased timeout to ${adaptedConfig.timeoutMs}ms due to high timeout rate: ${metrics.timeoutRate}`,
      );
    }

    // Increase retry attempts if success rate is low
    if (metrics.successRate < 0.8) {
      // Less than 80% success
      adaptedConfig.retryAttempts = Math.min(
        adaptedConfig.retryAttempts + 1,
        5, // Max 5 retries
      );
      this.logger.debug(
        `Increased retry attempts to ${adaptedConfig.retryAttempts} due to low success rate: ${metrics.successRate}`,
      );
    }

    // Adjust temperature based on success patterns
    if (metrics.successRate > 0.95) {
      // Very high success rate
      adaptedConfig.temperature = Math.max(
        adaptedConfig.temperature - 0.05,
        0.05, // Min temperature
      );
    } else if (metrics.successRate < 0.7) {
      // Low success rate
      adaptedConfig.temperature = Math.min(
        adaptedConfig.temperature + 0.05,
        0.5, // Max temperature
      );
    }

    return adaptedConfig;
  }

  /**
   * Check if message contains complex keywords
   */
  private hasComplexKeywords(message: string): boolean {
    const complexKeywords = [
      'analyze',
      'compare',
      'integrate',
      'workflow',
      'automation',
      'multi-step',
      'complex',
      'advanced',
      'comprehensive',
      'detailed',
      'elaborate',
      'sophisticated',
      'enterprise',
    ];

    const lowerMessage = message.toLowerCase();

    return complexKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  /**
   * Check if message requires multi-step reasoning
   */
  private requiresMultiStepReasoning(message: string): boolean {
    const multiStepIndicators = [
      'first.*then',
      'step.*step',
      'after.*before',
      'once.*then',
      'when.*do',
      'if.*then',
      'plan',
      'strategy',
      'process',
      'workflow',
    ];

    const lowerMessage = message.toLowerCase();

    return multiStepIndicators.some((pattern) => {
      const regex = new RegExp(pattern);

      return regex.test(lowerMessage);
    });
  }

  /**
   * Explain complexity decision for debugging
   */
  private explainComplexityDecision(
    request: SupervisorRequest,
    complexity: RequestComplexity,
  ): string {
    const factors = [];

    if (request.requiresExternalAPI) factors.push('requires external API');
    if (request.hasMultipleSteps) factors.push('has multiple steps');
    if (request.needsProviderIntegration)
      factors.push('needs provider integration');
    if ((request.messageLength || 0) > 500) factors.push('long message');
    if (this.hasComplexKeywords(request.userMessage || ''))
      factors.push('complex keywords');
    if (this.requiresMultiStepReasoning(request.userMessage || ''))
      factors.push('multi-step reasoning');

    if (factors.length === 0) {
      return `Classified as ${complexity}: no complexity indicators found`;
    }

    return `Classified as ${complexity} due to: ${factors.join(', ')}`;
  }
}
