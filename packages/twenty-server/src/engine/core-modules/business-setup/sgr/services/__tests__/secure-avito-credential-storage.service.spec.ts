import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import {
  type AvitoWorkflowContext,
  AvitoWorkflowState,
} from '../../types/avito-workflow-context';
import { SecureAvitoCredentialStorageService } from '../secure-avito-credential-storage.service';

describe('SecureAvitoCredentialStorageService', () => {
  let service: SecureAvitoCredentialStorageService;
  let userVarsService: jest.Mocked<UserVarsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockContext: AvitoWorkflowContext = {
    userId: 'test-user-123',
    workspaceId: 'test-workspace-456',
    threadId: 'test-thread-789',
    workflowId: 'workflow-id-123',
    state: AvitoWorkflowState.STORING_CREDENTIALS,
    stateChangedAt: new Date(),
    stateTransitionLog: [],
    attemptMetrics: {
      attemptCount: 1,
      maxAttempts: 3,
      firstAttemptAt: new Date(),
      failureReasons: [],
    },
    errorHistory: [],
    workflowStartedAt: new Date(),
    workflowVersion: '1.0.0',
    metrics: {
      completedSteps: 0,
      totalSteps: 5,
      averageStepDurationMs: 1000,
      bottleneckStates: [],
      recoveryRate: 0,
      errorRate: 0,
      apiResponseTimes: [],
    },
    userInteractions: [],
    integrations: {
      avitoApiEndpoint: 'https://api.avito.ru',
      backupStorageEnabled: true,
      monitoringEnabled: true,
      healthCheckInterval: 30000,
    },
    config: {
      maxAttempts: 3,
      timeoutMs: 600000,
      retryDelayMs: 2000,
      enableAutoRetry: true,
      enableEncryption: true,
      enableAuditLog: true,
      apiTimeoutMs: 30000,
      validationStrictMode: false,
      allowedCredentialFormats: ['JSON', 'KEY_VALUE'],
    },
  };

  const mockCredentials = {
    clientId: 'test-client-id-123',
    clientSecret: 'test-client-secret-456789',
    accessToken: 'access-token-xyz',
    tokenType: 'Bearer',
    lastValidatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockUserVarsService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecureAvitoCredentialStorageService,
        {
          provide: UserVarsService,
          useValue: mockUserVarsService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<SecureAvitoCredentialStorageService>(
      SecureAvitoCredentialStorageService,
    );
    userVarsService = module.get(UserVarsService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('Credential Storage', () => {
    it('should successfully store credentials with encryption', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.operationId).toBeDefined();
      expect(result.encryptionDetails.algorithm).toBe('aes-256-gcm');
      expect(result.encryptionDetails.integrityVerified).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(result.auditEntryId).toBeDefined();
    });

    it('should store encrypted data with proper format', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      await service.storeCredentials(mockCredentials, mockContext);

      expect(userVarsService.set).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockContext.userId,
          workspaceId: mockContext.workspaceId,
          key: expect.stringContaining('AVITO_CLIENT_SECRET'),
          value: expect.any(String),
        }),
      );

      // Verify the stored value is encrypted JSON
      const setCall = userVarsService.set.mock.calls[0][0];
      const storedValue = JSON.parse(setCall.value);

      expect(storedValue.algorithm).toBe('aes-256-gcm');
      expect(storedValue.encryptedData).toBeDefined();
      expect(storedValue.iv).toBeDefined();
      expect(storedValue.authTag).toBeDefined();
    });

    it('should emit storage events', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      await service.storeCredentials(mockCredentials, mockContext);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'avito.credentials.stored',
        expect.objectContaining({
          userId: mockContext.userId,
          workspaceId: mockContext.workspaceId,
          success: true,
          encryptionUsed: true,
        }),
      );
    });

    it('should handle storage failures gracefully', async () => {
      userVarsService.set.mockRejectedValue(new Error('Storage failed'));

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage failed');
      expect(result.operationId).toBeDefined();
    });

    it('should validate credentials before storage', async () => {
      const invalidCredentials = {
        clientId: 'x', // Too short
        clientSecret: 'y', // Too short
      };

      const result = await service.storeCredentials(
        invalidCredentials,
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
    });
  });

  describe('Credential Retrieval', () => {
    it('should successfully retrieve and decrypt credentials', async () => {
      // Mock encrypted data in storage
      const mockEncryptedData = {
        algorithm: 'aes-256-gcm',
        encryptedData: 'encrypted-test-data',
        iv: 'test-iv',
        authTag: 'test-auth-tag',
        keyVersion: 1,
        timestamp: new Date().toISOString(),
        integrityHash: 'test-hash',
      };

      userVarsService.get.mockResolvedValue(JSON.stringify(mockEncryptedData));

      const result = await service.retrieveCredentials(mockContext);

      expect(result.operationId).toBeDefined();
      expect(userVarsService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockContext.userId,
          workspaceId: mockContext.workspaceId,
          key: expect.stringContaining('AVITO_CLIENT_SECRET'),
        }),
      );
    });

    it('should handle missing credentials', async () => {
      userVarsService.get.mockResolvedValue(null);

      const result = await service.retrieveCredentials(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No encrypted credentials found');
    });

    it('should handle decryption errors', async () => {
      userVarsService.get.mockResolvedValue('invalid-json');

      const result = await service.retrieveCredentials(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Audit and Monitoring', () => {
    it('should create comprehensive audit log', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      await service.storeCredentials(mockCredentials, mockContext);

      const auditLog = service.getAuditLog(
        mockContext.userId,
        mockContext.workspaceId,
      );

      expect(auditLog.length).toBeGreaterThan(0);

      const latestEntry = auditLog[auditLog.length - 1];

      expect(latestEntry.userId).toBe(mockContext.userId);
      expect(latestEntry.workspaceId).toBe(mockContext.workspaceId);
      expect(latestEntry.operation).toBe('CREATE');
      expect(latestEntry.operationResult).toBe('SUCCESS');
      expect(latestEntry.dataType).toBe('CREDENTIALS');
    });

    it('should track storage metrics', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      await service.storeCredentials(mockCredentials, mockContext);

      const metrics = service.getStorageMetrics();

      expect(metrics.totalOperations).toBeGreaterThan(0);
      expect(metrics.successfulOperations).toBeGreaterThan(0);
      expect(metrics.auditLogSize).toBeGreaterThan(0);
    });

    it('should audit failed operations', async () => {
      userVarsService.set.mockRejectedValue(new Error('Storage failed'));

      await service.storeCredentials(mockCredentials, mockContext);

      const metrics = service.getStorageMetrics();

      expect(metrics.failedOperations).toBeGreaterThan(0);

      const auditLog = service.getAuditLog();
      const failedEntry = auditLog.find(
        (entry) => entry.operationResult === 'FAILURE',
      );

      expect(failedEntry).toBeDefined();
      expect(failedEntry?.errorDetails).toBeDefined();
    });
  });

  describe('Security Features', () => {
    it('should use AES-256-GCM encryption', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.encryptionDetails.algorithm).toBe('aes-256-gcm');
      expect(result.encryptionDetails.keyVersion).toBe(1);
    });

    it('should create backup of encrypted data', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.backupCreated).toBe(true);

      // Verify backup was created with timestamp
      const backupCall = userVarsService.set.mock.calls.find((call) =>
        call[0].key.includes('_BACKUP_'),
      );

      expect(backupCall).toBeDefined();
    });

    it('should verify data integrity', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.encryptionDetails.integrityVerified).toBe(true);
      expect(result.integrityHash).toBeDefined();
    });

    it('should handle encryption key management', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.encryptionDetails.keyVersion).toBe(1);
      expect(result.encryptionDetails.encryptionTime).toBeGreaterThan(0);
    });
  });

  describe('Performance and Reliability', () => {
    it('should measure encryption performance', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const result = await service.storeCredentials(
        mockCredentials,
        mockContext,
      );

      expect(result.encryptionDetails.encryptionTime).toBeGreaterThan(0);
      expect(result.encryptionDetails.encryptionTime).toBeLessThan(1000); // Should be under 1 second
    });

    it('should handle concurrent storage operations', async () => {
      userVarsService.set.mockResolvedValue(undefined);

      const promises = Array(5)
        .fill(0)
        .map((_, i) =>
          service.storeCredentials(
            { ...mockCredentials, clientId: `client-${i}` },
            { ...mockContext, userId: `user-${i}` },
          ),
        );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);
      expect(new Set(results.map((r) => r.operationId)).size).toBe(5); // All unique operation IDs
    });

    it('should validate operation timeouts', async () => {
      userVarsService.set.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const startTime = Date.now();

      await service.storeCredentials(mockCredentials, mockContext);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
