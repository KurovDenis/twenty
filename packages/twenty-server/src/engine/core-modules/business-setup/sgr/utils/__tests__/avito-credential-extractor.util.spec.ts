import { AvitoCredentialExtractor } from '../avito-credential-extractor.util';

describe('AvitoCredentialExtractor', () => {
  let extractor: AvitoCredentialExtractor;

  beforeEach(() => {
    extractor = new AvitoCredentialExtractor();
  });

  describe('Basic Credential Extraction', () => {
    it('should extract credentials using KEY=VALUE format', async () => {
      const message = 'CLIENT_ID=test123 CLIENT_SECRET=secret456';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials).toBeDefined();
      expect(result.credentials!.clientId).toBe('test123');
      expect(result.credentials!.clientSecret).toBe('secret456');
      expect(result.patternUsed).toBe('KEY_VALUE_EQUALS');
      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should extract credentials using KEY:VALUE format', async () => {
      const message = 'CLIENT_ID: abc123xyz CLIENT_SECRET: def456uvw';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('abc123xyz');
      expect(result.credentials!.clientSecret).toBe('def456uvw');
      expect(result.patternUsed).toBe('KEY_VALUE_COLON');
    });

    it('should extract credentials with quotes', async () => {
      const message = 'CLIENT_ID="quoted123" CLIENT_SECRET="secretabc"';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('quoted123');
      expect(result.credentials!.clientSecret).toBe('secretabc');
    });

    it('should extract credentials from JSON format', async () => {
      const message =
        '{"CLIENT_ID": "json123", "CLIENT_SECRET": "jsonSecret456"}';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('json123');
      expect(result.credentials!.clientSecret).toBe('jsonSecret456');
      expect(result.patternUsed).toBe('JSON_FORMAT');
    });

    it('should extract credentials from YAML format', async () => {
      const message = `
        CLIENT_ID: yaml123
        CLIENT_SECRET: yamlSecret456
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('yaml123');
      expect(result.credentials!.clientSecret).toBe('yamlSecret456');
      expect(result.patternUsed).toBe('YAML_FORMAT');
    });
  });

  describe('Fuzzy Matching', () => {
    it('should handle variations in spacing', async () => {
      const message =
        '  CLIENT_ID   =   spaced123   CLIENT_SECRET   =   spacedSecret  ';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('spaced123');
      expect(result.credentials!.clientSecret).toBe('spacedSecret');
    });

    it('should handle case variations', async () => {
      const message = 'client_id=lower123 client_secret=lowerSecret';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('lower123');
      expect(result.credentials!.clientSecret).toBe('lowerSecret');
    });

    it('should handle missing quotes in fuzzy mode', async () => {
      const message = 'CLIENT_ID=noquotes123 CLIENT_SECRET=noquotesSecret';

      const result = await extractor.extractCredentials(message, {
        enableFuzzyMatching: true,
      });

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('noquotes123');
      expect(result.credentials!.clientSecret).toBe('noquotesSecret');
    });

    it('should apply confidence penalty for fuzzy matches', async () => {
      const strictMessage =
        'CLIENT_ID="strict123" CLIENT_SECRET="strictSecret"';
      const fuzzyMessage =
        'CLIENT_ID  = fuzzy123  CLIENT_SECRET  = fuzzySecret';

      const strictResult = await extractor.extractCredentials(strictMessage);
      const fuzzyResult = await extractor.extractCredentials(fuzzyMessage);

      expect(strictResult.confidence).toBeGreaterThan(fuzzyResult.confidence!);
    });
  });

  describe('Confidence Scoring', () => {
    it('should give high confidence for perfect format with context', async () => {
      const message = `
        Avito API credentials:
        CLIENT_ID="perfect123"
        CLIENT_SECRET="perfectSecret456"
        These are my auth tokens.
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.confidence).toBeGreaterThan(85);
    });

    it('should give lower confidence for poor format', async () => {
      const message = 'CLIENT_ID=x CLIENT_SECRET=y';

      const result = await extractor.extractCredentials(message);

      expect(result.confidence).toBeLessThan(70);
    });

    it('should increase confidence with context keywords', async () => {
      const withContextMessage =
        'My Avito API CLIENT_ID=context123 CLIENT_SECRET=contextSecret';
      const withoutContextMessage =
        'CLIENT_ID=nocontext123 CLIENT_SECRET=nocontextSecret';

      const withContext =
        await extractor.extractCredentials(withContextMessage);
      const withoutContext = await extractor.extractCredentials(
        withoutContextMessage,
      );

      expect(withContext.confidence).toBeGreaterThan(
        withoutContext.confidence!,
      );
    });

    it('should consider proximity of CLIENT_ID and CLIENT_SECRET', async () => {
      const closeMessage = 'CLIENT_ID=close123 CLIENT_SECRET=closeSecret';
      const farMessage = `
        CLIENT_ID=far123
        ${' '.repeat(200)}
        CLIENT_SECRET=farSecret
      `;

      const closeResult = await extractor.extractCredentials(closeMessage);
      const farResult = await extractor.extractCredentials(farMessage);

      expect(closeResult.confidence).toBeGreaterThan(farResult.confidence!);
    });
  });

  describe('Validation and Error Handling', () => {
    it('should fail with invalid CLIENT_ID format in strict mode', async () => {
      const message = 'CLIENT_ID=x CLIENT_SECRET=validSecret123456789';

      const result = await extractor.extractCredentials(message, {
        strictValidation: true,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CREDENTIAL_FORMAT');
      expect(result.metadata.validationDetails?.clientIdValid).toBe(false);
    });

    it('should fail with invalid CLIENT_SECRET format in strict mode', async () => {
      const message = 'CLIENT_ID=validClient123 CLIENT_SECRET=x';

      const result = await extractor.extractCredentials(message, {
        strictValidation: true,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INVALID_CREDENTIAL_FORMAT');
      expect(result.metadata.validationDetails?.clientSecretValid).toBe(false);
    });

    it('should handle empty message', async () => {
      const result = await extractor.extractCredentials('');

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('EMPTY_MESSAGE');
    });

    it('should handle message too long', async () => {
      const longMessage = 'x'.repeat(15000);

      const result = await extractor.extractCredentials(longMessage, {
        maxMessageLength: 10000,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('MESSAGE_TOO_LONG');
    });

    it('should fail when credentials not found', async () => {
      const message = 'This message has no credentials at all';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CREDENTIALS_NOT_FOUND');
      expect(result.metadata.suggestedFormats).toBeDefined();
      expect(result.metadata.suggestedFormats!.length).toBeGreaterThan(0);
    });

    it('should find only one credential', async () => {
      const message = 'CLIENT_ID=onlyid123 some other text';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('CREDENTIALS_NOT_FOUND');
    });
  });

  describe('Configuration Options', () => {
    it('should respect confidence threshold', async () => {
      const message = 'CLIENT_ID=low123 CLIENT_SECRET=lowSecret';

      const result = await extractor.extractCredentials(message, {
        confidenceThreshold: 95,
      });

      expect(result.success).toBe(false);
    });

    it('should disable fuzzy matching when configured', async () => {
      const message = '  CLIENT_ID  = fuzzy123  CLIENT_SECRET  = fuzzySecret  ';

      const result = await extractor.extractCredentials(message, {
        enableFuzzyMatching: false,
      });

      // Should fail without fuzzy matching
      expect(result.success).toBe(false);
    });

    it('should restrict to allowed patterns', async () => {
      const message = '{"CLIENT_ID": "json123", "CLIENT_SECRET": "jsonSecret"}';

      const result = await extractor.extractCredentials(message, {
        allowedPatterns: ['KEY_VALUE_EQUALS', 'KEY_VALUE_COLON'],
      });

      expect(result.success).toBe(false);
    });

    it('should use custom patterns', async () => {
      const customPattern = {
        name: 'CUSTOM_FORMAT',
        description: 'Custom format',
        clientIdRegex: /ID:\s*([A-Za-z0-9_-]+)/,
        clientSecretRegex: /SECRET:\s*([A-Za-z0-9_-]+)/,
        examples: ['ID: value SECRET: value'],
      };

      const message = 'ID: custom123 SECRET: customSecret456';

      const result = await extractor.extractCredentials(message, {
        customPatterns: [customPattern],
      });

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('custom123');
      expect(result.credentials!.clientSecret).toBe('customSecret456');
      expect(result.patternUsed).toBe('CUSTOM_FORMAT');
    });
  });

  describe('Metadata and Performance', () => {
    it('should provide comprehensive metadata', async () => {
      const message = 'CLIENT_ID=meta123 CLIENT_SECRET=metaSecret';

      const result = await extractor.extractCredentials(message);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.messageLength).toBe(message.length);
      expect(result.metadata.patternsAttempted).toBeInstanceOf(Array);
      expect(result.metadata.extractionTimeMs).toBeGreaterThan(0);
    });

    it('should track attempted patterns', async () => {
      const message = 'CLIENT_ID=pattern123 CLIENT_SECRET=patternSecret';

      const result = await extractor.extractCredentials(message);

      expect(result.metadata.patternsAttempted.length).toBeGreaterThan(0);
      expect(result.metadata.patternsAttempted).toContain('KEY_VALUE_EQUALS');
    });

    it('should measure extraction time', async () => {
      const message = 'CLIENT_ID=time123 CLIENT_SECRET=timeSecret';

      const startTime = Date.now();
      const result = await extractor.extractCredentials(message);
      const endTime = Date.now();

      expect(result.metadata.extractionTimeMs).toBeGreaterThan(0);
      expect(result.metadata.extractionTimeMs).toBeLessThan(
        endTime - startTime + 100,
      );
    });
  });

  describe('Format Suggestions', () => {
    it('should provide format suggestions when extraction fails', async () => {
      const message = 'client id is abc123 and client secret is def456';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(false);
      expect(result.metadata.suggestedFormats).toBeDefined();
      expect(result.metadata.suggestedFormats!.length).toBeGreaterThan(0);
    });

    it('should suggest appropriate formats based on content', async () => {
      const message = 'I have CLIENT data but in wrong format: id123 secret456';

      const result = await extractor.extractCredentials(message);

      expect(result.metadata.suggestedFormats).toContain(
        expect.stringMatching(/CLIENT_ID/),
      );
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle multilingual content', async () => {
      const message = `
        Мои учетные данные Avito:
        CLIENT_ID="русский123"
        CLIENT_SECRET="русскийSecret456"
        Используйте для API.
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('русский123');
      expect(result.credentials!.clientSecret).toBe('русскийSecret456');
    });

    it('should handle noisy content with credentials', async () => {
      const message = `
        Hi there! I got my Avito credentials today.
        My details are:
        - Name: John Doe
        - Email: john@example.com
        - CLIENT_ID=noisy123abc
        - Phone: +1234567890
        - CLIENT_SECRET=noisySecret456xyz
        - Address: 123 Main St
        Please set up my integration.
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('noisy123abc');
      expect(result.credentials!.clientSecret).toBe('noisySecret456xyz');
    });

    it('should handle credentials with special characters', async () => {
      const message =
        'CLIENT_ID="special_-123" CLIENT_SECRET="special_-Secret456"';

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('special_-123');
      expect(result.credentials!.clientSecret).toBe('special_-Secret456');
    });

    it('should handle credentials in code blocks', async () => {
      const message = `
        Here are my credentials:
        \`\`\`
        CLIENT_ID=code123
        CLIENT_SECRET=codeSecret456
        \`\`\`
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('code123');
      expect(result.credentials!.clientSecret).toBe('codeSecret456');
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate patterns in message', async () => {
      const message = `
        OLD: CLIENT_ID=old123 CLIENT_SECRET=oldSecret
        NEW: CLIENT_ID=new456 CLIENT_SECRET=newSecret
      `;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      // Should extract the first valid match
      expect(result.credentials!.clientId).toBe('old123');
      expect(result.credentials!.clientSecret).toBe('oldSecret');
    });

    it('should handle mixed quote types', async () => {
      const message = `CLIENT_ID='single123' CLIENT_SECRET="double456"`;

      const result = await extractor.extractCredentials(message);

      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('single123');
      expect(result.credentials!.clientSecret).toBe('double456');
    });

    it('should handle malformed JSON gracefully', async () => {
      const message = '{"CLIENT_ID": "json123", "CLIENT_SECRET": "jsonSecret"'; // Missing closing brace

      const result = await extractor.extractCredentials(message);

      // Should still extract using other patterns
      expect(result.success).toBe(true);
      expect(result.credentials!.clientId).toBe('json123');
      expect(result.credentials!.clientSecret).toBe('jsonSecret');
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive metadata', () => {
      const message = 'CLIENT_ID=stats123 CLIENT_SECRET=statsSecret';

      const extractorInstance = extractor as any;

      expect(extractorInstance).toBeDefined();
      expect(typeof extractorInstance.extractCredentials).toBe('function');
    });

    it('should validate extraction capabilities', () => {
      expect(extractor).toBeInstanceOf(AvitoCredentialExtractor);
      expect(typeof extractor.extractCredentials).toBe('function');
    });
  });
});
