import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedState {
  encrypted: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

@Injectable()
export class LangGraphEncryptionService {
  private readonly key: Buffer;
  private readonly keyVersion: number;

  constructor() {
    const encryptionKey = process.env.LANGGRAPH_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('LANGGRAPH_ENCRYPTION_KEY environment variable is required');
    }
    
    if (encryptionKey.length !== 64) { // 32 bytes = 64 hex chars
      throw new Error('LANGGRAPH_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
    }

    this.key = Buffer.from(encryptionKey, 'hex');
    this.keyVersion = parseInt(process.env.LANGGRAPH_ENCRYPTION_KEY_VERSION || '1');
  }

  async encryptState(state: any): Promise<EncryptedState> {
    const iv = randomBytes(12); // 96-bit для GCM
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    
    // Добавляем AAD для дополнительной безопасности
    cipher.setAAD(Buffer.from('langgraph-state', 'utf8'));
    
    const stateString = JSON.stringify(state);
    let encrypted = cipher.update(stateString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  async decryptState(encryptedState: EncryptedState): Promise<any> {
    if (encryptedState.keyVersion !== this.keyVersion) {
      throw new Error(`Key version mismatch: expected ${this.keyVersion}, got ${encryptedState.keyVersion}`);
    }

    const iv = Buffer.from(encryptedState.iv, 'base64');
    const authTag = Buffer.from(encryptedState.authTag, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    
    // Устанавливаем AAD
    decipher.setAAD(Buffer.from('langgraph-state', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedState.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  async encryptField(value: string): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('langgraph-field', 'utf8'));
    
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Формат: iv:authTag:encrypted
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  async decryptField(encryptedValue: string): Promise<string> {
    const [ivBase64, authTagBase64, encrypted] = encryptedValue.split(':');
    
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    
    decipher.setAAD(Buffer.from('langgraph-field', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  getKeyVersion(): number {
    return this.keyVersion;
  }
}
