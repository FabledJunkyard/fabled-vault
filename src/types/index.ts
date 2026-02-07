export interface VaultToken {
  id: string;
  raw: string;
  namespace: string;
  credential: string;
  field?: string;
  createdAt: string;
  accessCount: number;
}

export class VaultError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
  
  static credentialNotFound(key: string) {
    return new VaultError(`Credential not found: ${key}`, 'CREDENTIAL_NOT_FOUND');
  }
  
  static authenticationFailed(msg: string) {
    return new VaultError(msg, 'AUTH_FAILED');
  }
}

export interface Credential {
  id?: string;
  namespace: string;
  name: string;
  description?: string;
  type?: string;
  sensitivityLevel?: string;
  requiresHardwareKey?: boolean;
  requiresBiometric?: boolean;
  encryptionKeyId?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  allowedAgents?: string[];
  allowedTools?: string[];
  purpose?: string;
  encryptedData: string;
}

export interface AccessGrant {
  id: string;
  credentialId?: string;
  agentId?: string;
  usesRemaining?: number;
  allowedTools?: string[];
  requiresConfirmation?: boolean;
  context?: Record<string, any>;
  isActive?: boolean;
}
