/**
 * NestJS Exception Filter for Invariant Error Handling
 *
 * Provides specialized exception handling for InvariantError instances
 * in the NestJS backend application.
 */

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';
import {
  InvariantError,
  invariant,
  error as logError,
} from 'twenty-shared/utils';

/**
 * Exception filter that catches and handles InvariantError instances
 *
 * Features:
 * - Converts InvariantError to appropriate HTTP responses
 * - Logs errors using the invariant logging system
 * - Provides different handling for development vs production
 * - Supports numeric error codes with proper HTTP status mapping
 *
 * @example
 * ```typescript
 * // In your NestJS module
 * import { APP_FILTER } from '@nestjs/core';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_FILTER,
 *       useClass: InvariantExceptionFilter,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Catch(InvariantError)
@Injectable()
export class InvariantExceptionFilter
  implements ExceptionFilter<InvariantError>
{
  private readonly logger = new Logger(InvariantExceptionFilter.name);

  catch(exception: InvariantError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Log the error using invariant logging system
    logError('Invariant violation in request:', {
      message: exception.message,
      url: request.url,
      method: request.method,
      userAgent: request.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    // Determine HTTP status code based on error message/code
    const status = this.getHttpStatusFromError(exception);

    // Get safe error message for client
    const clientMessage = this.getClientMessage(exception);

    // Build response object
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error: 'Invariant Violation',
      message: clientMessage,
      ...(process.env.NODE_ENV === 'development' && {
        // Include additional details in development
        originalMessage: exception.message,
        stack: exception.stack,
      }),
    };

    // Send HTTP response
    response.status(status).json(errorResponse);
  }

  /**
   * Maps error codes to appropriate HTTP status codes
   *
   * @param error - The InvariantError instance
   * @returns Appropriate HTTP status code
   */
  private getHttpStatusFromError(error: InvariantError): HttpStatus {
    const message = error.message;

    // Check if message contains a numeric error code
    const codeMatch = message.match(/Invariant Violation: (\d+)/);

    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);

      return this.mapErrorCodeToHttpStatus(code);
    }

    // Default to Bad Request for assertion failures
    return HttpStatus.BAD_REQUEST;
  }

  /**
   * Maps numeric error codes to HTTP status codes based on ranges
   *
   * @param code - Numeric error code
   * @returns HTTP status code
   */
  private mapErrorCodeToHttpStatus(code: number): HttpStatus {
    if (code >= 1000 && code < 2000) {
      // Validation errors (1000-1999) -> Bad Request
      return HttpStatus.BAD_REQUEST;
    }

    if (code >= 2000 && code < 3000) {
      // Authentication errors (2000-2999) -> Unauthorized or Forbidden
      return code < 2500 ? HttpStatus.UNAUTHORIZED : HttpStatus.FORBIDDEN;
    }

    if (code >= 3000 && code < 4000) {
      // Database errors (3000-3999) -> Internal Server Error
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    if (code >= 4000 && code < 5000) {
      // Business logic errors (4000-4999) -> Conflict or Unprocessable Entity
      return code < 4500
        ? HttpStatus.CONFLICT
        : HttpStatus.UNPROCESSABLE_ENTITY;
    }

    if (code >= 5000 && code < 6000) {
      // System errors (5000-5999) -> Internal Server Error
      return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    // Default to Bad Request for unknown codes
    return HttpStatus.BAD_REQUEST;
  }

  /**
   * Gets a safe error message for the client
   *
   * @param error - The InvariantError instance
   * @returns Safe message for client consumption
   */
  private getClientMessage(error: InvariantError): string {
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, sanitize error messages
    if (isProduction) {
      const codeMatch = error.message.match(/Invariant Violation: (\d+)/);

      if (codeMatch) {
        return `Request validation failed. Reference: ${codeMatch[1]}`;
      }

      return 'Request validation failed. Please check your input and try again.';
    }

    // In development, return the full message
    return error.message;
  }
}

/**
 * Global exception filter that handles all types of errors including InvariantError
 *
 * Use this when you want a single filter to handle both invariant errors
 * and other application errors.
 */
@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: HttpStatus;
    let message: string;
    let error: string;

    if (exception instanceof InvariantError) {
      // Handle InvariantError specifically
      status = this.getHttpStatusFromInvariantError(exception);
      message = this.getSafeMessage(exception);
      error = 'Invariant Violation';

      logError('Invariant violation:', exception.message);
    } else if (exception instanceof Error) {
      // Handle other Error types
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message =
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message;
      error = 'Internal Server Error';

      this.logger.error('Unhandled error:', exception.stack);
    } else {
      // Handle unknown exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Unknown error occurred';
      error = 'Internal Server Error';

      this.logger.error('Unknown exception:', exception);
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
      ...(process.env.NODE_ENV === 'development' && {
        originalException: exception,
      }),
    };

    response.status(status).json(errorResponse);
  }

  private getHttpStatusFromInvariantError(error: InvariantError): HttpStatus {
    // Reuse the logic from InvariantExceptionFilter
    const codeMatch = error.message.match(/Invariant Violation: (\d+)/);

    if (codeMatch) {
      const code = parseInt(codeMatch[1], 10);

      if (code >= 1000 && code < 2000) return HttpStatus.BAD_REQUEST;
      if (code >= 2000 && code < 2500) return HttpStatus.UNAUTHORIZED;
      if (code >= 2500 && code < 3000) return HttpStatus.FORBIDDEN;
      if (code >= 3000 && code < 4000) return HttpStatus.INTERNAL_SERVER_ERROR;
      if (code >= 4000 && code < 4500) return HttpStatus.CONFLICT;
      if (code >= 4500 && code < 5000) return HttpStatus.UNPROCESSABLE_ENTITY;
      if (code >= 5000 && code < 6000) return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    return HttpStatus.BAD_REQUEST;
  }

  private getSafeMessage(error: InvariantError): string {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      const codeMatch = error.message.match(/Invariant Violation: (\d+)/);

      if (codeMatch) {
        return `Request validation failed. Reference: ${codeMatch[1]}`;
      }

      return 'Request validation failed.';
    }

    return error.message;
  }
}

/**
 * Decorator to automatically handle invariant errors in controller methods
 *
 * @example
 * ```typescript
 * @Controller('users')
 * export class UsersController {
 *   @Get(':id')
 *   @HandleInvariantErrors()
 *   async getUser(@Param('id') id: string) {
 *     invariant(id, 'User ID is required');
 *     // ... rest of method
 *   }
 * }
 * ```
 */
export function HandleInvariantErrors() {
  return function (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      try {
        return await method.apply(this, args);
      } catch (error) {
        if (error instanceof InvariantError) {
          logError(
            `Invariant error in ${target.constructor.name}.${propertyName}:`,
            error.message,
          );
        }
        throw error; // Re-throw to be handled by exception filter
      }
    };

    return descriptor;
  };
}

/**
 * Service for handling invariant errors with additional context
 *
 * Provides utilities for error handling, logging, and recovery in services.
 */
@Injectable()
export class InvariantErrorService {
  private readonly logger = new Logger(InvariantErrorService.name);

  /**
   * Validates a condition and throws InvariantError with additional context
   *
   * @param condition - Condition to validate
   * @param message - Error message or code
   * @param context - Additional context for logging
   */
  assert(
    condition: any,
    message?: string | number,
    context?: Record<string, any>,
  ): asserts condition {
    if (!condition) {
      if (context) {
        logError('Assertion failed with context:', { message, context });
      }
      invariant(condition, message);
    }
  }

  /**
   * Safely executes a function and handles any invariant errors
   *
   * @param fn - Function to execute
   * @param onError - Error handler
   * @returns Result or error
   */
  async safeExecute<T>(
    fn: () => Promise<T> | T,
    onError?: (error: InvariantError) => T | Promise<T>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof InvariantError) {
        logError('Safe execution failed:', error.message);
        if (onError) {
          return await onError(error);
        }
      } else {
        this.logger.error('Unexpected error in safe execution:', error);
      }

      return null;
    }
  }

  /**
   * Validates multiple conditions and collects all errors
   *
   * @param validations - Array of validation configurations
   * @returns Array of validation results
   */
  validateMany(
    validations: Array<{
      condition: any;
      message: string | number;
      field?: string;
    }>,
  ): Array<{ field?: string; message: string | number; isValid: boolean }> {
    return validations.map(({ condition, message, field }) => ({
      field,
      message,
      isValid: !!condition,
    }));
  }
}

// Export types for external use
export type InvariantErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  message: string;
  originalMessage?: string;
  stack?: string;
};
