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
}