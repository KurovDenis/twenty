import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedContent?: string;
}

export interface RateLimitInfo {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
}

@Injectable()
export class LangGraphValidationService {
  private readonly logger = new Logger(LangGraphValidationService.name);
  
  // Rate limiting storage (в production должен быть Redis)
  private rateLimitStore = new Map<string, { count: number; resetTime: Date }>();

  // PII patterns
  private readonly piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  };

  // Validation schemas
  private readonly messageSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10000).min(1),
    timestamp: z.string().datetime(),
  });

  private readonly agentContextSchema = z.object({
    workspaceId: z.string().uuid(),
    userId: z.string().uuid(),
    threadId: z.string().uuid(),
    userWorkspaceId: z.string().uuid(),
  });

  async validateMessage(message: any): Promise<ValidationResult> {
    try {
      const validated = this.messageSchema.parse(message);
      
      // Check for PII
      const piiCheck = this.detectPII(validated.content);
      if (piiCheck.detected) {
        this.logger.warn(`PII detected in message: ${piiCheck.types.join(', ')}`);
      }

      // Sanitize content for logging
      const sanitizedContent = this.sanitizeContent(validated.content);

      return {
        isValid: true,
        errors: [],
        sanitizedContent,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      
      return {
        isValid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  async validateAgentContext(context: any): Promise<ValidationResult> {
    try {
      this.agentContextSchema.parse(context);
      
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        };
      }
      
      return {
        isValid: false,
        errors: ['Unknown validation error'],
      };
    }
  }

  async checkRateLimit(
    identifier: string,
    limit: number = 100,
    windowMs: number = 3600000, // 1 hour
  ): Promise<RateLimitInfo> {
    const now = new Date();
    const key = `rate_limit:${identifier}`;
    
    const current = this.rateLimitStore.get(key);
    
    if (!current || now > current.resetTime) {
      // Reset or create new rate limit window
      this.rateLimitStore.set(key, {
        count: 1,
        resetTime: new Date(now.getTime() + windowMs),
      });
      
      return {
        isLimited: false,
        remainingRequests: limit - 1,
        resetTime: new Date(now.getTime() + windowMs),
      };
    }
    
    if (current.count >= limit) {
      return {
        isLimited: true,
        remainingRequests: 0,
        resetTime: current.resetTime,
      };
    }
    
    // Increment count
    current.count++;
    this.rateLimitStore.set(key, current);
    
    return {
      isLimited: false,
      remainingRequests: limit - current.count,
      resetTime: current.resetTime,
    };
  }

  detectPII(content: string): { detected: boolean; types: string[] } {
    const detectedTypes: string[] = [];
    
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      if (pattern.test(content)) {
        detectedTypes.push(type);
      }
    }
    
    return {
      detected: detectedTypes.length > 0,
      types: detectedTypes,
    };
  }

  sanitizeContent(content: string): string {
    let sanitized = content;
    
    // Replace PII with placeholders
    sanitized = sanitized.replace(this.piiPatterns.email, '[EMAIL]');
    sanitized = sanitized.replace(this.piiPatterns.phone, '[PHONE]');
    sanitized = sanitized.replace(this.piiPatterns.creditCard, '[CREDIT_CARD]');
    sanitized = sanitized.replace(this.piiPatterns.ssn, '[SSN]');
    sanitized = sanitized.replace(this.piiPatterns.ipAddress, '[IP_ADDRESS]');
    
    // Truncate if too long
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000) + '...';
    }
    
    return sanitized;
  }

  validateState(state: any): ValidationResult {
    try {
      // Basic state validation
      if (!state || typeof state !== 'object') {
        return {
          isValid: false,
          errors: ['State must be an object'],
        };
      }
      
      // Check for required fields
      if (state.workflowStep !== undefined && typeof state.workflowStep !== 'number') {
        return {
          isValid: false,
          errors: ['workflowStep must be a number'],
        };
      }
      
      if (state.context && typeof state.context !== 'object') {
        return {
          isValid: false,
          errors: ['context must be an object'],
        };
      }
      
      if (state.metadata && typeof state.metadata !== 'object') {
        return {
          isValid: false,
          errors: ['metadata must be an object'],
        };
      }
      
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['State validation error'],
      };
    }
  }

  // Cleanup expired rate limit entries
  cleanupRateLimits(): void {
    const now = new Date();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }
}
