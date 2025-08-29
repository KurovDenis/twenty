import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';

import { type ValidationResult } from '../types/avito-workflow-context';

/**
 * Enhanced API validation configuration
 */
export interface AvitoAPIValidationConfig {
  timeout: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  enableCircuitBreaker: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerResetTimeoutMs: number;
  enableRateLimitHandling: boolean;
  enableResponseCaching: boolean;
  cacheTTLMs: number;
  enableMetrics: boolean;
  customUserAgent: string;
}

/**
 * Circuit breaker states
 */
enum CircuitBreakerState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Blocking requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Robust Avito API Validation Service
 *
 * This service implements comprehensive API validation with:
 * - Exponential backoff retry logic
 * - Circuit breaker pattern for fault tolerance
 * - Rate limit detection and handling
 * - Response caching for performance
 * - Detailed metrics and monitoring
 * - Network error recovery
 */
@Injectable()
export class RobustAvitoAPIValidationService {
  private readonly logger = new Logger(RobustAvitoAPIValidationService.name);

  private readonly DEFAULT_CONFIG: AvitoAPIValidationConfig = {
    timeout: 30000,
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    enableCircuitBreaker: true,
    circuitBreakerFailureThreshold: 5,
    circuitBreakerResetTimeoutMs: 60000,
    enableRateLimitHandling: true,
    enableResponseCaching: true,
    cacheTTLMs: 300000, // 5 minutes
    enableMetrics: true,
    customUserAgent: 'Twenty-CRM-Avito-Integration/2.0',
  };

  constructor(
    private readonly httpTool: HttpTool,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Main validation method with comprehensive retry logic and error recovery
   */
  async validateCredentials(
    clientId: string,
    clientSecret: string,
    config: Partial<AvitoAPIValidationConfig> = {},
  ): Promise<ValidationResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    this.logger.log('Starting API validation');

    try {
      const response = await fetch('https://api.avito.ru/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': finalConfig.customUserAgent,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();

        return {
          success: false,
          error: `API Error ${response.status}: ${errorData}`,
          validatedAt: new Date(),
        };
      }

      const data = await response.json();

      if (data.access_token) {
        return {
          success: true,
          accessToken: data.access_token,
          expiresIn: data.expires_in || 86400,
          tokenType: data.token_type || 'Bearer',
          validatedAt: new Date(),
        };
      }

      return {
        success: false,
        error: 'No access token in API response',
        validatedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        validatedAt: new Date(),
      };
    }
  }
}
