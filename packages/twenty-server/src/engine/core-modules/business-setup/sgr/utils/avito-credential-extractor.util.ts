import { Logger } from '@nestjs/common';

import {
  CREDENTIAL_EXTRACTION_PATTERNS,
  CREDENTIAL_VALIDATION_RULES,
  CredentialValidationStatus,
  type AvitoCredentials,
  type CredentialExtractionPattern,
} from '../types/avito-workflow-context';

/**
 * Detailed extraction result with comprehensive metadata
 */
export interface CredentialExtractionResult {
  success: boolean;
  credentials?: AvitoCredentials;
  error?: string;
  errorCode?: string;
  patternUsed?: string;
  confidence?: number; // 0-100% confidence in extraction
  metadata: {
    messageLength: number;
    patternsAttempted: string[];
    extractionTimeMs: number;
    validationDetails?: {
      clientIdValid: boolean;
      clientSecretValid: boolean;
      errors: string[];
    };
    suggestedFormats?: string[];
  };
}

/**
 * Enhanced extraction configuration
 */
export interface ExtractionConfig {
  strictValidation: boolean;
  enableFuzzyMatching: boolean;
  confidenceThreshold: number; // Minimum confidence to accept extraction
  maxMessageLength: number;
  allowedPatterns?: string[]; // Restrict to specific patterns
  customPatterns?: CredentialExtractionPattern[];
}

/**
 * Pattern matching result with confidence scoring
 */
interface PatternMatchResult {
  pattern: CredentialExtractionPattern;
  clientId?: string;
  clientSecret?: string;
  confidence: number;
  matchQuality: {
    exactMatch: boolean;
    positionScore: number; // How well positioned are the matches
    formatScore: number; // How well do values match expected format
    contextScore: number; // Are there good context indicators
  };
}

/**
 * Comprehensive Avito Credential Extractor
 *
 * This utility implements the multi-pattern credential extraction with:
 * - Multiple extraction patterns (KEY=VALUE, KEY:VALUE, JSON, etc.)
 * - Confidence scoring for extraction quality
 * - Fuzzy matching for minor format variations
 * - Comprehensive validation with detailed error reporting
 * - Suggestion engine for format improvements
 * - Performance optimization for large messages
 */
export class AvitoCredentialExtractor {
  private readonly logger = new Logger(AvitoCredentialExtractor.name);

  private readonly DEFAULT_CONFIG: ExtractionConfig = {
    strictValidation: true,
    enableFuzzyMatching: true,
    confidenceThreshold: 75,
    maxMessageLength: 10000,
  };

  /**
   * Main extraction method with comprehensive pattern matching
   */
  async extractCredentials(
    message: string,
    config: Partial<ExtractionConfig> = {},
  ): Promise<CredentialExtractionResult> {
    const startTime = Date.now();
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    this.logger.log('Starting credential extraction with multiple patterns');

    // Input validation
    if (!message || message.trim().length === 0) {
      return this.createFailureResult(
        'Empty message provided',
        'EMPTY_MESSAGE',
        [],
        Date.now() - startTime,
        0,
      );
    }

    if (message.length > finalConfig.maxMessageLength) {
      return this.createFailureResult(
        `Message too long (${message.length}>${finalConfig.maxMessageLength} characters)`,
        'MESSAGE_TOO_LONG',
        [],
        Date.now() - startTime,
        message.length,
      );
    }

    // Get patterns to use
    const patterns = this.getActivePatterns(finalConfig);
    const attemptedPatterns: string[] = [];
    const matchResults: PatternMatchResult[] = [];

    // Try each pattern and collect results
    for (const pattern of patterns) {
      attemptedPatterns.push(pattern.name);

      try {
        const matchResult = await this.attemptPatternMatch(
          message,
          pattern,
          finalConfig,
        );

        if (matchResult) {
          matchResults.push(matchResult);
        }
      } catch (error) {
        this.logger.warn(`Pattern ${pattern.name} failed:`, error);
      }
    }

    // Find best match based on confidence
    const bestMatch = this.selectBestMatch(
      matchResults,
      finalConfig.confidenceThreshold,
    );

    if (!bestMatch) {
      return this.createFailureResult(
        'No valid credentials found in message',
        'CREDENTIALS_NOT_FOUND',
        attemptedPatterns,
        Date.now() - startTime,
        message.length,
        this.generateFormatSuggestions(message, patterns),
      );
    }

    // Validate extracted credentials if strict validation enabled
    let validationDetails;

    if (finalConfig.strictValidation) {
      validationDetails = this.validateExtractedCredentials(
        bestMatch.clientId!,
        bestMatch.clientSecret!,
      );

      if (
        !validationDetails.clientIdValid ||
        !validationDetails.clientSecretValid
      ) {
        return {
          success: false,
          error: `Invalid credential format: ${validationDetails.errors.join(', ')}`,
          errorCode: 'INVALID_CREDENTIAL_FORMAT',
          patternUsed: bestMatch.pattern.name,
          confidence: bestMatch.confidence,
          metadata: {
            messageLength: message.length,
            patternsAttempted: attemptedPatterns,
            extractionTimeMs: Date.now() - startTime,
            validationDetails,
            suggestedFormats: this.generateFormatSuggestions(message, patterns),
          },
        };
      }
    }

    // Create successful result
    const credentials: AvitoCredentials = {
      clientId: bestMatch.clientId!,
      clientSecret: bestMatch.clientSecret!,
      validationStatus: CredentialValidationStatus.PENDING,
      lastValidatedAt: new Date(),
    };

    return {
      success: true,
      credentials,
      patternUsed: bestMatch.pattern.name,
      confidence: bestMatch.confidence,
      metadata: {
        messageLength: message.length,
        patternsAttempted: attemptedPatterns,
        extractionTimeMs: Date.now() - startTime,
        validationDetails,
      },
    };
  }

  /**
   * Attempt to match a specific pattern with confidence scoring
   */
  private async attemptPatternMatch(
    message: string,
    pattern: CredentialExtractionPattern,
    config: ExtractionConfig,
  ): Promise<PatternMatchResult | null> {
    // Try exact pattern match first
    const clientIdMatch = message.match(pattern.clientIdRegex);
    const clientSecretMatch = message.match(pattern.clientSecretRegex);

    if (clientIdMatch && clientSecretMatch) {
      const clientId = clientIdMatch[1];
      const clientSecret = clientSecretMatch[1];

      // Calculate confidence score
      const confidence = this.calculateConfidence(
        message,
        clientId,
        clientSecret,
        pattern,
        clientIdMatch,
        clientSecretMatch,
      );

      const matchQuality = this.assessMatchQuality(
        message,
        clientId,
        clientSecret,
        clientIdMatch,
        clientSecretMatch,
      );

      return {
        pattern,
        clientId,
        clientSecret,
        confidence,
        matchQuality,
      };
    }

    // Try fuzzy matching if enabled
    if (config.enableFuzzyMatching) {
      return this.attemptFuzzyMatch(message, pattern);
    }

    return null;
  }

  /**
   * Fuzzy matching for minor format variations
   */
  private attemptFuzzyMatch(
    message: string,
    pattern: CredentialExtractionPattern,
  ): PatternMatchResult | null {
    // Create variations of the pattern with common mistakes
    const fuzzyPatterns = this.createFuzzyPatterns(pattern);

    for (const fuzzyPattern of fuzzyPatterns) {
      const clientIdMatch = message.match(fuzzyPattern.clientIdRegex);
      const clientSecretMatch = message.match(fuzzyPattern.clientSecretRegex);

      if (clientIdMatch && clientSecretMatch) {
        const clientId = this.cleanExtractedValue(clientIdMatch[1]);
        const clientSecret = this.cleanExtractedValue(clientSecretMatch[1]);

        // Lower confidence for fuzzy matches
        const baseConfidence = this.calculateConfidence(
          message,
          clientId,
          clientSecret,
          pattern,
          clientIdMatch,
          clientSecretMatch,
        );

        const confidence = Math.max(baseConfidence - 20, 50); // Penalty for fuzzy match

        const matchQuality = this.assessMatchQuality(
          message,
          clientId,
          clientSecret,
          clientIdMatch,
          clientSecretMatch,
        );

        return {
          pattern,
          clientId,
          clientSecret,
          confidence,
          matchQuality,
        };
      }
    }

    return null;
  }

  /**
   * Create fuzzy pattern variations for common mistakes
   */
  private createFuzzyPatterns(
    pattern: CredentialExtractionPattern,
  ): CredentialExtractionPattern[] {
    const variations: CredentialExtractionPattern[] = [];

    if (pattern.name === 'KEY_VALUE_EQUALS') {
      // Allow missing quotes, extra spaces, etc.
      variations.push({
        ...pattern,
        name: 'KEY_VALUE_EQUALS_FUZZY',
        clientIdRegex:
          /CLIENT[\s_]*ID\s*=\s*['"`]?\s*([A-Za-z0-9_-]+)\s*['"`]?/i,
        clientSecretRegex:
          /CLIENT[\s_]*SECRET\s*=\s*['"`]?\s*([A-Za-z0-9_-]+)\s*['"`]?/i,
      });
    }

    if (pattern.name === 'KEY_VALUE_COLON') {
      // Allow variations in spacing and punctuation
      variations.push({
        ...pattern,
        name: 'KEY_VALUE_COLON_FUZZY',
        clientIdRegex:
          /CLIENT[\s_]*ID\s*:+\s*['"`]?\s*([A-Za-z0-9_-]+)\s*['"`]?/i,
        clientSecretRegex:
          /CLIENT[\s_]*SECRET\s*:+\s*['"`]?\s*([A-Za-z0-9_-]+)\s*['"`]?/i,
      });
    }

    return variations;
  }

  /**
   * Clean extracted values by removing unwanted characters
   */
  private cleanExtractedValue(value: string): string {
    return value
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '') // Remove quotes
      .replace(/\s+/g, '') // Remove internal spaces
      .replace(/[^A-Za-z0-9_-]/g, ''); // Keep only valid characters
  }

  /**
   * Calculate confidence score for extraction (0-100)
   */
  private calculateConfidence(
    message: string,
    clientId: string,
    clientSecret: string,
    pattern: CredentialExtractionPattern,
    clientIdMatch: RegExpMatchArray,
    clientSecretMatch: RegExpMatchArray,
  ): number {
    let confidence = 60; // Base confidence

    // Format validation bonus
    const validation = this.validateExtractedCredentials(
      clientId,
      clientSecret,
    );

    if (validation.clientIdValid) confidence += 15;
    if (validation.clientSecretValid) confidence += 15;

    // Position scoring - closer together = higher confidence
    const positionDiff = Math.abs(
      (clientIdMatch.index || 0) - (clientSecretMatch.index || 0),
    );

    if (positionDiff < 100) confidence += 5;
    if (positionDiff < 50) confidence += 5;

    // Context indicators
    const contextWords = [
      'avito',
      'api',
      'token',
      'auth',
      'credentials',
      'client',
    ];
    const messageWords = message.toLowerCase().split(/\W+/);
    const contextMatches = contextWords.filter((word) =>
      messageWords.includes(word),
    ).length;

    confidence += contextMatches * 2;

    // Length appropriateness
    if (clientId.length >= 10 && clientId.length <= 50) confidence += 5;
    if (clientSecret.length >= 20 && clientSecret.length <= 100)
      confidence += 5;

    return Math.min(confidence, 100);
  }

  /**
   * Assess the quality of pattern matches
   */
  private assessMatchQuality(
    message: string,
    clientId: string,
    clientSecret: string,
    clientIdMatch: RegExpMatchArray,
    clientSecretMatch: RegExpMatchArray,
  ) {
    const validation = this.validateExtractedCredentials(
      clientId,
      clientSecret,
    );
    const exactMatch = validation.clientIdValid && validation.clientSecretValid;

    // Position score based on proximity
    const positionDiff = Math.abs(
      (clientIdMatch.index || 0) - (clientSecretMatch.index || 0),
    );
    const positionScore = Math.max(0, 100 - positionDiff / 10);

    // Format score based on validation
    const formatScore =
      (validation.clientIdValid ? 50 : 0) +
      (validation.clientSecretValid ? 50 : 0);

    // Context score based on surrounding text
    const contextScore = this.calculateContextScore(
      message,
      clientIdMatch.index || 0,
      clientSecretMatch.index || 0,
    );

    return {
      exactMatch,
      positionScore,
      formatScore,
      contextScore,
    };
  }

  /**
   * Calculate context score based on surrounding keywords
   */
  private calculateContextScore(
    message: string,
    clientIdPos: number,
    clientSecretPos: number,
  ): number {
    const keywords = [
      'avito',
      'api',
      'credentials',
      'auth',
      'token',
      'client',
      'secret',
      'id',
    ];
    let score = 0;

    // Check text around both positions
    const checkRadius = 50;
    const positions = [clientIdPos, clientSecretPos];

    for (const pos of positions) {
      const start = Math.max(0, pos - checkRadius);
      const end = Math.min(message.length, pos + checkRadius);
      const context = message.substring(start, end).toLowerCase();

      for (const keyword of keywords) {
        if (context.includes(keyword)) {
          score += 10;
        }
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Select the best match from multiple results
   */
  private selectBestMatch(
    results: PatternMatchResult[],
    confidenceThreshold: number,
  ): PatternMatchResult | null {
    if (results.length === 0) return null;

    // Filter by confidence threshold
    const validResults = results.filter(
      (r) => r.confidence >= confidenceThreshold,
    );

    if (validResults.length === 0) return null;

    // Sort by confidence (highest first)
    validResults.sort((a, b) => b.confidence - a.confidence);

    return validResults[0];
  }

  /**
   * Get active patterns based on configuration
   */
  private getActivePatterns(
    config: ExtractionConfig,
  ): CredentialExtractionPattern[] {
    let patterns = [...CREDENTIAL_EXTRACTION_PATTERNS];

    // Add custom patterns if provided
    if (config.customPatterns) {
      patterns = [...patterns, ...config.customPatterns];
    }

    // Filter by allowed patterns if specified
    if (config.allowedPatterns) {
      patterns = patterns.filter((p) =>
        config.allowedPatterns!.includes(p.name),
      );
    }

    return patterns;
  }

  /**
   * Validate extracted credentials against rules
   */
  private validateExtractedCredentials(clientId: string, clientSecret: string) {
    const errors: string[] = [];

    // Validate CLIENT_ID
    const clientIdRule = CREDENTIAL_VALIDATION_RULES.clientId;
    const clientIdValid =
      clientId.length >= clientIdRule.minLength &&
      clientId.length <= clientIdRule.maxLength &&
      clientIdRule.pattern.test(clientId);

    if (!clientIdValid) {
      if (clientId.length < clientIdRule.minLength) {
        errors.push(
          `CLIENT_ID too short (${clientId.length} < ${clientIdRule.minLength})`,
        );
      }
      if (clientId.length > clientIdRule.maxLength) {
        errors.push(
          `CLIENT_ID too long (${clientId.length} > ${clientIdRule.maxLength})`,
        );
      }
      if (!clientIdRule.pattern.test(clientId)) {
        errors.push('CLIENT_ID contains invalid characters');
      }
    }

    // Validate CLIENT_SECRET
    const clientSecretRule = CREDENTIAL_VALIDATION_RULES.clientSecret;
    const clientSecretValid =
      clientSecret.length >= clientSecretRule.minLength &&
      clientSecret.length <= clientSecretRule.maxLength &&
      clientSecretRule.pattern.test(clientSecret);

    if (!clientSecretValid) {
      if (clientSecret.length < clientSecretRule.minLength) {
        errors.push(
          `CLIENT_SECRET too short (${clientSecret.length} < ${clientSecretRule.minLength})`,
        );
      }
      if (clientSecret.length > clientSecretRule.maxLength) {
        errors.push(
          `CLIENT_SECRET too long (${clientSecret.length} > ${clientSecretRule.maxLength})`,
        );
      }
      if (!clientSecretRule.pattern.test(clientSecret)) {
        errors.push('CLIENT_SECRET contains invalid characters');
      }
    }

    return {
      clientIdValid,
      clientSecretValid,
      errors,
    };
  }

  /**
   * Generate format suggestions based on message content
   */
  private generateFormatSuggestions(
    message: string,
    patterns: CredentialExtractionPattern[],
  ): string[] {
    const suggestions: string[] = [];

    // Check if message contains potential credential-like strings
    const potentialIds = message.match(/[A-Za-z0-9_-]{8,}/g) || [];

    if (potentialIds.length >= 2) {
      suggestions.push('Possible credentials found but in unsupported format');
      suggestions.push('Try using format: CLIENT_ID = value');
    }

    // Check for common keywords
    if (message.toLowerCase().includes('client')) {
      suggestions.push('Found "client" keyword - ensure correct field names');
    }

    // Suggest based on available patterns
    if (patterns.length > 0) {
      suggestions.push(
        `Supported formats: ${patterns.map((p) => p.description).join(', ')}`,
      );
    }

    return suggestions;
  }

  /**
   * Create failure result with comprehensive metadata
   */
  private createFailureResult(
    error: string,
    errorCode: string,
    patternsAttempted: string[],
    executionTime: number,
    messageLength: number,
    suggestedFormats?: string[],
  ): CredentialExtractionResult {
    return {
      success: false,
      error,
      errorCode,
      metadata: {
        messageLength,
        patternsAttempted,
        extractionTimeMs: executionTime,
        suggestedFormats,
      },
    };
  }

  /**
   * Get extraction statistics for monitoring
   */
  getExtractionStats(): {
    supportedPatterns: number;
    validationRules: any;
    defaultConfig: ExtractionConfig;
  } {
    return {
      supportedPatterns: CREDENTIAL_EXTRACTION_PATTERNS.length,
      validationRules: CREDENTIAL_VALIDATION_RULES,
      defaultConfig: this.DEFAULT_CONFIG,
    };
  }
}
