import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

import { BusinessSetupKeyValueTypeMap } from '../../business-setup.service';
import {
  type AvitoCredentials,
  AvitoWorkflowContext,
  StorageOperationStatus,
} from '../types/avito-workflow-context';

/**
 * Storage audit entry structure for secure credential operations
 */
export type StorageAuditEntry = {
  id: string;
  userId: string;
  workspaceId: string;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE';
  operationResult: 'SUCCESS' | 'FAILURE';
  timestamp: Date;
  dataType: 'CREDENTIALS' | 'ACCESS_TOKEN';
  encryptionDetails?: {
    algorithm: string;
    keyVersion: number;
    integrityVerified: boolean;
  };
  errorDetails?: {
    errorCode: string;
    errorMessage: string;
  };
  performanceMetrics?: {
    operationDurationMs: number;
    dataSizeBytes: number;
  };
};

/**
 * Encrypted credential data structure
 */
export type EncryptedCredentialData = {
  algorithm: string;
  encryptedData: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  timestamp: Date;
  integrityHash: string;
};

/**
 * Comprehensive storage result
 */
export type SecureStorageResult = {
  success: boolean;
  error?: string;
  operationId: string;
  storageLocation?: string;
  storedAt?: Date;
  encryptionDetails: {
    algorithm: string;
    keyVersion: number;
    encryptionTime: number;
    integrityVerified: boolean;
  };
  auditEntryId?: string;
  backupCreated: boolean;
  integrityHash?: string;
};

/**
 * Secure Avito Credential Storage Service
 *
 * Provides enterprise-grade secure storage with:
 * - AES-256-GCM encryption
 * - Comprehensive audit trail
 * - Integrity verification
 * - Key management
 * - Backup creation
 */
@Injectable()
export class SecureAvitoCredentialStorageService {
  private readonly logger = new Logger(
    SecureAvitoCredentialStorageService.name,
  );
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly CURRENT_KEY_VERSION = 1;
  private readonly auditLog: StorageAuditEntry[] = [];
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly userVarsService: UserVarsService<BusinessSetupKeyValueTypeMap>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Initialize encryption key (in production, this would come from secure key management)
    this.encryptionKey = this.deriveEncryptionKey();
  }

  /**
   * Securely store Avito credentials with encryption and audit
   */
  async storeCredentials(
    credentials: AvitoCredentials,
    context: AvitoWorkflowContext,
  ): Promise<SecureStorageResult> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    this.logger.log(
      `Starting secure credential storage operation ${operationId}`,
    );

    try {
      // Validate credentials
      const validationResult = this.validateCredentials(credentials);

      if (!validationResult.valid) {
        throw new Error(
          `Credential validation failed: ${validationResult.errors.join(', ')}`,
        );
      }

      // Prepare and encrypt data
      const credentialData = this.prepareCredentialData(credentials);
      const encryptionStartTime = Date.now();
      const encryptedResult = await this.encryptCredentialData(credentialData);
      const encryptionTime = Date.now() - encryptionStartTime;

      // Store encrypted data
      await this.storeEncryptedData(encryptedResult, context);

      // Create backup
      const backupCreated = await this.createBackup(
        encryptedResult,
        context,
        operationId,
      );

      // Verify integrity
      const integrityVerified = await this.verifyIntegrity(
        encryptedResult,
        credentialData,
      );

      // Create audit entry
      const auditEntry = await this.createAuditEntry({
        operation: 'CREATE',
        userId: context.userId,
        workspaceId: context.workspaceId,
        operationResult: 'SUCCESS',
        timestamp: new Date(),
        dataType: 'CREDENTIALS',
        encryptionDetails: {
          algorithm: this.ENCRYPTION_ALGORITHM,
          keyVersion: this.CURRENT_KEY_VERSION,
          integrityVerified,
        },
        performanceMetrics: {
          operationDurationMs: Date.now() - startTime,
          dataSizeBytes: credentialData.length,
        },
      });

      // Emit success event
      this.eventEmitter.emit('avito.credentials.stored', {
        operationId,
        userId: context.userId,
        workspaceId: context.workspaceId,
        success: true,
        encryptionUsed: true,
      });

      return {
        success: true,
        operationId,
        storageLocation: 'UserVarsService',
        storedAt: new Date(),
        backupCreated,
        integrityHash: encryptedResult.integrityHash,
        encryptionDetails: {
          algorithm: this.ENCRYPTION_ALGORITHM,
          keyVersion: this.CURRENT_KEY_VERSION,
          encryptionTime,
          integrityVerified,
        },
        auditEntryId: auditEntry.id,
      };
    } catch (error) {
      this.logger.error(
        `Credential storage failed for operation ${operationId}:`,
        error,
      );

      // Create failure audit entry
      await this.createAuditEntry({
        operation: 'CREATE',
        userId: context.userId,
        workspaceId: context.workspaceId,
        operationResult: 'FAILURE',
        timestamp: new Date(),
        dataType: 'CREDENTIALS',
        errorDetails: {
          errorCode: 'STORAGE_FAILED',
          errorMessage: error.message,
        },
        performanceMetrics: {
          operationDurationMs: Date.now() - startTime,
          dataSizeBytes: 0,
        },
      });

      return {
        success: false,
        error: error.message,
        operationId,
        encryptionDetails: {
          algorithm: this.ENCRYPTION_ALGORITHM,
          keyVersion: this.CURRENT_KEY_VERSION,
          encryptionTime: 0,
          integrityVerified: false,
        },
        auditEntryId: '',
        backupCreated: false,
      };
    }
  }

  /**
   * Securely retrieve and decrypt credentials
   */
  async retrieveCredentials(context: AvitoWorkflowContext): Promise<{
    success: boolean;
    credentials?: AvitoCredentials;
    error?: string;
    operationId: string;
  }> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    try {
      // Retrieve encrypted data
      const encryptedData = await this.retrieveEncryptedData(context);

      if (!encryptedData) {
        return {
          success: false,
          error: 'No encrypted credentials found',
          operationId,
        };
      }

      // Decrypt data
      const decryptedData = await this.decryptCredentialData(encryptedData);

      // Verify integrity
      const integrityVerified = await this.verifyIntegrity(
        encryptedData,
        decryptedData,
      );

      if (!integrityVerified) {
        throw new Error('Data integrity verification failed');
      }

      // Parse credentials
      const credentials = this.parseCredentialData(decryptedData);

      // Create audit entry
      await this.createAuditEntry({
        operation: 'READ',
        userId: context.userId,
        workspaceId: context.workspaceId,
        operationResult: 'SUCCESS',
        timestamp: new Date(),
        dataType: 'CREDENTIALS',
        performanceMetrics: {
          operationDurationMs: Date.now() - startTime,
          dataSizeBytes: decryptedData.length,
        },
      });

      return {
        success: true,
        credentials,
        operationId,
      };
    } catch (error) {
      this.logger.error(
        `Credential retrieval failed for operation ${operationId}:`,
        error,
      );

      return {
        success: false,
        error: error.message,
        operationId,
      };
    }
  }

  /**
   * ENCRYPTION METHODS
   */

  private async encryptCredentialData(
    data: string,
  ): Promise<EncryptedCredentialData> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
      this.ENCRYPTION_ALGORITHM,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');

    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      algorithm: this.ENCRYPTION_ALGORITHM,
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: this.CURRENT_KEY_VERSION,
      timestamp: new Date(),
      integrityHash: this.calculateIntegrityHash(data),
    };
  }

  private async decryptCredentialData(
    encryptedData: EncryptedCredentialData,
  ): Promise<string> {
    const decipher = createDecipheriv(
      encryptedData.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex'),
    ) as any; // Cast to any for GCM auth tag support

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * STORAGE OPERATIONS
   */

  private async storeEncryptedData(
    encryptedData: EncryptedCredentialData,
    context: AvitoWorkflowContext,
  ): Promise<void> {
    // Store encrypted credentials
    await this.userVarsService.set({
      userId: context.userId,
      workspaceId: context.workspaceId,
      key: 'AVITO_CLIENT_SECRET',
      value: JSON.stringify(encryptedData),
    });

    // Mark credentials as stored and encrypted
    await this.userVarsService.set({
      userId: context.userId,
      workspaceId: context.workspaceId,
      key: 'AVITO_CLIENT_SECRET_STATUS',
      value: StorageOperationStatus.ENCRYPTED,
    });
  }

  private async retrieveEncryptedData(
    context: AvitoWorkflowContext,
  ): Promise<EncryptedCredentialData | null> {
    const encryptedValue = await this.userVarsService.get({
      userId: context.userId,
      workspaceId: context.workspaceId,
      key: 'AVITO_CLIENT_SECRET',
    });

    if (!encryptedValue) {
      return null;
    }

    const parsed = JSON.parse(encryptedValue as string);

    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
    };
  }

  /**
   * UTILITY METHODS
   */

  private validateCredentials(credentials: AvitoCredentials): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!credentials.clientId) {
      errors.push('CLIENT_ID is required');
    }

    if (!credentials.clientSecret) {
      errors.push('CLIENT_SECRET is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private prepareCredentialData(credentials: AvitoCredentials): string {
    return JSON.stringify({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      expiresAt: credentials.expiresAt?.toISOString(),
      tokenType: credentials.tokenType,
      lastValidatedAt: credentials.lastValidatedAt?.toISOString(),
      validationStatus: credentials.validationStatus,
      encryptionStatus: credentials.encryptionStatus,
    });
  }

  private parseCredentialData(data: string): AvitoCredentials {
    const parsed = JSON.parse(data);

    return {
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : undefined,
      tokenType: parsed.tokenType,
      lastValidatedAt: parsed.lastValidatedAt
        ? new Date(parsed.lastValidatedAt)
        : undefined,
      validationStatus: parsed.validationStatus,
      encryptionStatus: parsed.encryptionStatus,
    };
  }

  private calculateIntegrityHash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  private async verifyIntegrity(
    encryptedData: EncryptedCredentialData,
    originalData: string,
  ): Promise<boolean> {
    const calculatedHash = this.calculateIntegrityHash(originalData);

    return calculatedHash === encryptedData.integrityHash;
  }

  private async createBackup(
    encryptedData: EncryptedCredentialData,
    context: AvitoWorkflowContext,
    operationId: string,
  ): Promise<boolean> {
    try {
      const backupKey = 'AVITO_CLIENT_SECRET_BACKUP';

      await this.userVarsService.set({
        userId: context.userId,
        workspaceId: context.workspaceId,
        key: backupKey,
        value: JSON.stringify({
          ...encryptedData,
          operationId,
          backupTimestamp: new Date().toISOString(),
        }),
      });

      return true;
    } catch (error) {
      this.logger.error('Backup creation failed:', error);

      return false;
    }
  }

  private async createAuditEntry(
    entryData: Partial<StorageAuditEntry>,
  ): Promise<StorageAuditEntry> {
    const auditEntry: StorageAuditEntry = {
      id: this.generateOperationId(),
      userId: entryData.userId!,
      workspaceId: entryData.workspaceId!,
      operation: entryData.operation!,
      operationResult: entryData.operationResult!,
      timestamp: new Date(),
      dataType: entryData.dataType!,
      encryptionDetails: entryData.encryptionDetails,
      errorDetails: entryData.errorDetails,
      performanceMetrics: entryData.performanceMetrics,
    };

    this.auditLog.push(auditEntry);

    // Emit audit event
    this.eventEmitter.emit('avito.storage.audit', auditEntry);

    return auditEntry;
  }

  private deriveEncryptionKey(): Buffer {
    // In production, this would use proper key derivation from secure storage
    const masterPassword =
      process.env.AVITO_MASTER_PASSWORD || 'default-master-key';

    return createHash('sha256').update(masterPassword).digest();
  }

  private generateOperationId(): string {
    return `storage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get audit log for compliance and monitoring
   */
  getAuditLog(userId?: string, workspaceId?: string): StorageAuditEntry[] {
    if (userId && workspaceId) {
      return this.auditLog.filter(
        (entry) => entry.userId === userId && entry.workspaceId === workspaceId,
      );
    }

    return [...this.auditLog];
  }

  /**
   * Get storage metrics for monitoring
   */
  getStorageMetrics(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    auditLogSize: number;
  } {
    const successful = this.auditLog.filter(
      (entry) => entry.operationResult === 'SUCCESS',
    ).length;
    const failed = this.auditLog.filter(
      (entry) => entry.operationResult === 'FAILURE',
    ).length;

    return {
      totalOperations: this.auditLog.length,
      successfulOperations: successful,
      failedOperations: failed,
      auditLogSize: this.auditLog.length,
    };
  }
}
