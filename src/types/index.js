export class VaultError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
    }
    static credentialNotFound(key) {
        return new VaultError(`Credential not found: ${key}`, 'CREDENTIAL_NOT_FOUND');
    }
    static authenticationFailed(msg) {
        return new VaultError(msg, 'AUTH_FAILED');
    }
}
