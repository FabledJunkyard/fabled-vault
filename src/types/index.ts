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



export interface VaultToken { namespace: string; credential: string; field?: string; }
export class VaultError {
  constructor(msg: string, code: string) {}
  static credentialNotFound(key: string) { return new VaultError('Not found', 'CREDENTIAL_NOT_FOUND'); }
  static authenticationFailed(msg: string) { return new VaultError(msg, 'AUTH_FAILED'); }
}
export interface Credential { encryptedData: string; }
export interface AccessGrant { id: string; }
