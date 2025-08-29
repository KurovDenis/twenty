/**
 * Avito Credential Extraction Utility
 *
 * Provides comprehensive credential extraction with multiple format support,
 * intelligent parsing, and robust validation for Avito API CLIENT_ID and CLIENT_SECRET.
 */

export interface CredentialExtractionResult {
  success: boolean;
  credentials?: {
    clientId: string;
    clientSecret: string;
  };
  error?: string;
  confidence?: number; // 0-1 scale indicating extraction confidence
  extractionMethod?: string;
  detectedFormat?: string;
}

export interface ExtractionPattern {
  name: string;
  description: string;
  clientIdPattern: RegExp;
  clientSecretPattern: RegExp;
  confidence: number;
}

/**
 * Comprehensive credential extraction patterns
 */
export class AvitoCredentialExtractor {
  /**
   * Predefined extraction patterns ordered by confidence level
   */
  private static readonly EXTRACTION_PATTERNS: ExtractionPattern[] = [
    // Pattern 1: Standard KEY = VALUE format (highest confidence)
    {
      name: 'standard_equals',
      description: 'Standard KEY = VALUE format with optional quotes',
      clientIdPattern:
        /(?:CLIENT_ID|client_id)\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      clientSecretPattern:
        /(?:CLIENT_SECRET|client_secret)\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      confidence: 0.95,
    },

    // Pattern 2: JSON format (high confidence)
    {
      name: 'json_format',
      description: 'Proper JSON object format',
      clientIdPattern: /"(?:client_id|CLIENT_ID)"\s*:\s*"([A-Za-z0-9_-]+)"/i,
      clientSecretPattern:
        /"(?:client_secret|CLIENT_SECRET)"\s*:\s*"([A-Za-z0-9_-]+)"/i,
      confidence: 0.9,
    },

    // Pattern 3: Colon-separated format (medium-high confidence)
    {
      name: 'colon_separated',
      description: 'KEY: VALUE format',
      clientIdPattern:
        /(?:CLIENT_ID|client_id)\s*:\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      clientSecretPattern:
        /(?:CLIENT_SECRET|client_secret)\s*:\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      confidence: 0.85,
    },

    // Pattern 4: Environment variable format (medium confidence)
    {
      name: 'env_var_format',
      description: 'Environment variable export format',
      clientIdPattern:
        /export\s+(?:CLIENT_ID|AVITO_CLIENT_ID)\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      clientSecretPattern:
        /export\s+(?:CLIENT_SECRET|AVITO_CLIENT_SECRET)\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      confidence: 0.8,
    },

    // Pattern 5: Configuration file format (medium confidence)
    {
      name: 'config_format',
      description: 'Configuration file format with brackets',
      clientIdPattern:
        /\[?(?:CLIENT_ID|client_id)\]?\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      clientSecretPattern:
        /\[?(?:CLIENT_SECRET|client_secret)\]?\s*=\s*['"]?([A-Za-z0-9_-]+)['"]?/i,
      confidence: 0.75,
    },

    // Pattern 6: Space-separated format (lower confidence)
    {
      name: 'space_separated',
      description: 'Space-separated key value pairs',
      clientIdPattern: /(?:CLIENT_ID|client_id)\s+([A-Za-z0-9_-]+)/i,
      clientSecretPattern:
        /(?:CLIENT_SECRET|client_secret)\s+([A-Za-z0-9_-]+)/i,
      confidence: 0.7,
    },

    // Pattern 7: Relaxed format (lowest confidence)
    {
      name: 'relaxed_format',
      description: 'Relaxed pattern matching for various formats',
      clientIdPattern: /(?:id|клиент|client)[:\s=_-]*([A-Za-z0-9_-]{10,})/i,
      clientSecretPattern:
        /(?:secret|секрет|ключ|key)[:\s=_-]*([A-Za-z0-9_-]{20,})/i,
      confidence: 0.6,
    },
  ];

  /**
   * Extract credentials from text using multiple patterns
   */
  static extractCredentials(message: string): CredentialExtractionResult {
    if (!message || message.trim().length === 0) {
      return {
        success: false,
        error: 'Empty message provided',
        confidence: 0,
      };
    }

    // Pre-process message to normalize whitespace and encoding
    const normalizedMessage = this.preprocessMessage(message);

    // Try JSON extraction first as it's most reliable
    const jsonResult = this.tryJsonExtraction(normalizedMessage);

    if (jsonResult.success) {
      return jsonResult;
    }

    // Try pattern matching in order of confidence
    for (const pattern of this.EXTRACTION_PATTERNS) {
      const result = this.tryPatternExtraction(normalizedMessage, pattern);

      if (result.success) {
        return result;
      }
    }

    // Try fuzzy extraction as last resort
    const fuzzyResult = this.tryFuzzyExtraction(normalizedMessage);

    if (fuzzyResult.success) {
      return fuzzyResult;
    }

    return {
      success: false,
      error: 'Could not extract valid CLIENT_ID and CLIENT_SECRET from message',
      confidence: 0,
      extractionMethod: 'none',
    };
  }

  /**
   * Validate extracted credentials format
   */
  static validateCredentials(
    clientId: string,
    clientSecret: string,
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // CLIENT_ID validation
    if (!clientId || clientId.length < 8) {
      errors.push('CLIENT_ID must be at least 8 characters long');
    } else if (clientId.length < 10) {
      warnings.push('CLIENT_ID seems unusually short for Avito API');
    }

    if (!/^[A-Za-z0-9_-]+$/.test(clientId)) {
      errors.push(
        'CLIENT_ID contains invalid characters (only alphanumeric, underscore, and dash allowed)',
      );
    }

    // CLIENT_SECRET validation
    if (!clientSecret || clientSecret.length < 16) {
      errors.push('CLIENT_SECRET must be at least 16 characters long');
    } else if (clientSecret.length < 20) {
      warnings.push('CLIENT_SECRET seems unusually short for Avito API');
    }

    if (!/^[A-Za-z0-9_-]+$/.test(clientSecret)) {
      errors.push(
        'CLIENT_SECRET contains invalid characters (only alphanumeric, underscore, and dash allowed)',
      );
    }

    // Additional security checks
    if (clientId === clientSecret) {
      errors.push('CLIENT_ID and CLIENT_SECRET cannot be identical');
    }

    if (
      clientId.toLowerCase().includes('example') ||
      clientSecret.toLowerCase().includes('example')
    ) {
      errors.push('Credentials appear to be example values, not real API keys');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Pre-process message to normalize formatting
   */
  private static preprocessMessage(message: string): string {
    return message
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
  }

  /**
   * Try to extract credentials from JSON content
   */
  private static tryJsonExtraction(
    message: string,
  ): CredentialExtractionResult {
    // Look for JSON-like structures
    const jsonMatches = message.match(/\{[^}]*\}/g);

    if (!jsonMatches) {
      return { success: false, error: 'No JSON structure found' };
    }

    for (const jsonString of jsonMatches) {
      try {
        const parsed = JSON.parse(jsonString);

        // Try different key variations
        const clientIdKeys = ['client_id', 'CLIENT_ID', 'clientId', 'id'];
        const clientSecretKeys = [
          'client_secret',
          'CLIENT_SECRET',
          'clientSecret',
          'secret',
        ];

        let clientId = '';
        let clientSecret = '';

        // Find client ID
        for (const key of clientIdKeys) {
          if (parsed[key]) {
            clientId = String(parsed[key]).trim();
            break;
          }
        }

        // Find client secret
        for (const key of clientSecretKeys) {
          if (parsed[key]) {
            clientSecret = String(parsed[key]).trim();
            break;
          }
        }

        if (clientId && clientSecret) {
          const validation = this.validateCredentials(clientId, clientSecret);

          if (validation.valid) {
            return {
              success: true,
              credentials: { clientId, clientSecret },
              confidence: 0.95,
              extractionMethod: 'json_parsing',
              detectedFormat: 'JSON',
            };
          }
        }
      } catch (error) {
        // Continue to next JSON candidate
        continue;
      }
    }

    return {
      success: false,
      error: 'No valid credentials found in JSON structures',
    };
  }

  /**
   * Try to extract using a specific pattern
   */
  private static tryPatternExtraction(
    message: string,
    pattern: ExtractionPattern,
  ): CredentialExtractionResult {
    const clientIdMatch = message.match(pattern.clientIdPattern);
    const clientSecretMatch = message.match(pattern.clientSecretPattern);

    if (clientIdMatch && clientSecretMatch) {
      const clientId = clientIdMatch[1].trim();
      const clientSecret = clientSecretMatch[1].trim();

      const validation = this.validateCredentials(clientId, clientSecret);

      if (validation.valid) {
        return {
          success: true,
          credentials: { clientId, clientSecret },
          confidence: pattern.confidence,
          extractionMethod: pattern.name,
          detectedFormat: pattern.description,
        };
      } else {
        return {
          success: false,
          error: `Invalid credential format: ${validation.errors.join(', ')}`,
          confidence: 0,
          extractionMethod: pattern.name,
        };
      }
    }

    return {
      success: false,
      error: `Pattern ${pattern.name} did not match`,
      extractionMethod: pattern.name,
    };
  }

  /**
   * Fuzzy extraction for edge cases
   */
  private static tryFuzzyExtraction(
    message: string,
  ): CredentialExtractionResult {
    // Extract all potential alphanumeric strings
    const allTokens: string[] = message.match(/[A-Za-z0-9_-]{8,}/g) || [];

    if (allTokens.length < 2) {
      return {
        success: false,
        error: 'Not enough potential credential tokens found',
      };
    }

    // Sort by length (longer strings are more likely to be secrets)
    allTokens.sort((a, b) => b.length - a.length);

    // Try combinations where first is shorter (ID) and second is longer (SECRET)
    for (let i = 0; i < Math.min(allTokens.length, 5); i++) {
      for (let j = i + 1; j < Math.min(allTokens.length, 5); j++) {
        const candidate1 = allTokens[i];
        const candidate2 = allTokens[j];

        // Try both orders
        const combinations = [
          { clientId: candidate1, clientSecret: candidate2 },
          { clientId: candidate2, clientSecret: candidate1 },
        ];

        for (const combo of combinations) {
          const validation = this.validateCredentials(
            combo.clientId,
            combo.clientSecret,
          );

          if (
            validation.valid &&
            combo.clientSecret.length > combo.clientId.length
          ) {
            return {
              success: true,
              credentials: combo,
              confidence: 0.5, // Lower confidence for fuzzy extraction
              extractionMethod: 'fuzzy_extraction',
              detectedFormat: 'Automatic detection',
            };
          }
        }
      }
    }

    return {
      success: false,
      error: 'Fuzzy extraction could not find valid credential pairs',
      extractionMethod: 'fuzzy_extraction',
    };
  }

  /**
   * Get extraction guidance for users
   */
  static getExtractionGuidance(): string {
    return `
🔑 **Поддерживаемые форматы для учетных данных Avito API:**

**1. Стандартный формат (рекомендуется):**
\`\`\`
CLIENT_ID = your_client_id_here
CLIENT_SECRET = your_client_secret_here
\`\`\`

**2. JSON формат:**
\`\`\`json
{
  "client_id": "your_client_id_here",
  "client_secret": "your_client_secret_here"
}
\`\`\`

**3. Формат с двоеточием:**
\`\`\`
CLIENT_ID: your_client_id_here
CLIENT_SECRET: your_client_secret_here
\`\`\`

**4. Environment переменные:**
\`\`\`
export CLIENT_ID=your_client_id_here
export CLIENT_SECRET=your_client_secret_here
\`\`\`

⚠️ **Требования к формату:**
- CLIENT_ID: минимум 8 символов, только буквы, цифры, подчеркивания и дефисы
- CLIENT_SECRET: минимум 16 символов, только буквы, цифры, подчеркивания и дефисы
- Значения должны быть реальными, не примерами

📋 **Где найти учетные данные:**
1. Войдите в личный кабинет Avito для бизнеса
2. Перейдите в раздел "API и интеграции"
3. Скопируйте CLIENT_ID и CLIENT_SECRET полностью`;
  }

  /**
   * Generate example formats for testing
   */
  static generateExampleFormats(
    clientId = 'ABC123DEF456',
    clientSecret = 'xyz789uvw012mno345pqr678stu901',
  ): string[] {
    return [
      // Standard format
      `CLIENT_ID = ${clientId}\nCLIENT_SECRET = ${clientSecret}`,

      // JSON format
      `{\n  "client_id": "${clientId}",\n  "client_secret": "${clientSecret}"\n}`,

      // Colon format
      `CLIENT_ID: ${clientId}\nCLIENT_SECRET: ${clientSecret}`,

      // Environment format
      `export CLIENT_ID=${clientId}\nexport CLIENT_SECRET=${clientSecret}`,

      // Mixed case
      `Client_ID = "${clientId}"\nclient_secret = "${clientSecret}"`,
    ];
  }
}

/**
 * Credential extraction service interface for dependency injection
 */
export interface ICredentialExtractionService {
  extractCredentials(message: string): CredentialExtractionResult;
  validateCredentials(
    clientId: string,
    clientSecret: string,
  ): { valid: boolean; errors: string[]; warnings: string[] };
  getExtractionGuidance(): string;
}

/**
 * Injectable service wrapper
 */
export class CredentialExtractionService
  implements ICredentialExtractionService
{
  extractCredentials(message: string): CredentialExtractionResult {
    return AvitoCredentialExtractor.extractCredentials(message);
  }

  validateCredentials(
    clientId: string,
    clientSecret: string,
  ): { valid: boolean; errors: string[]; warnings: string[] } {
    return AvitoCredentialExtractor.validateCredentials(clientId, clientSecret);
  }

  getExtractionGuidance(): string {
    return AvitoCredentialExtractor.getExtractionGuidance();
  }
}
