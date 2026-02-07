/**
 * Universal Vault V4 - Token Processing Engine
 * 
 * Handles universal token parsing and substitution for any agent
 */

import { VaultToken, VaultError } from '../types/index.js';

export class TokenEngine {
  // Universal token pattern: [VAULT:namespace:credential(.field)?]
  private static readonly TOKEN_PATTERN = /\[VAULT:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_-]+))?\]/g;
  
  /**
   * Extract all vault tokens from text
   */
  extractTokens(text: string): VaultToken[] {
    const tokens: VaultToken[] = [];
    const matches = text.matchAll(TokenEngine.TOKEN_PATTERN);
    
    for (const match of matches) {
      const [, namespace, credential, field] = match;
      
      tokens.push({
        id: this.generateTokenId(),
        raw: match[0],
        namespace: namespace as any,
        credential: credential || "",
        field,
        createdAt: new Date().toISOString(),
        accessCount: 0,
      });
    }
    
    return tokens;
  }
  
  /**
   * Substitute tokens with actual values
   * Performance target: < 10ms
   */
  async substituteTokens(
    text: string, 
    credentials: Map<string, any>,
    context: { agentId: string; sessionId: string }
  ): Promise<{ text: string; processingTimeMs: number }> {
    const startTime = performance.now();
    
    let result = text;
    const tokens = this.extractTokens(text);
    
    // Process tokens in parallel for performance
    const substitutions = await Promise.all(
      tokens.map(token => this.resolveToken(token, credentials, context))
    );
    
    // Apply substitutions
    for (const [token, value] of substitutions) {
      result = result.replace(token, value);
    }
    
    const processingTimeMs = performance.now() - startTime;
    
    // Warn if we exceed performance target
    if (processingTimeMs > 10) {
      console.warn(`Token substitution slow: ${processingTimeMs}ms for ${tokens.length} tokens`);
    }
    
    return { text: result, processingTimeMs };
  }
  
  /**
   * Resolve individual token to credential value
   */
  private async resolveToken(
    token: VaultToken,
    credentials: Map<string, any>,
    context: { agentId: string; sessionId: string }
  ): Promise<[string, string]> {
    const key = `${token.namespace}:${token.credential}`;
    const credential = credentials.get(key);
    
    if (!credential) {
      throw VaultError.credentialNotFound(key);
    }
    
    // Handle structured credentials with field access
    let value: string;
    if (token.field) {
      if (typeof credential !== 'object' || !(token.field in credential)) {
        throw new VaultError(
          `Field '${token.field}' not found in credential '${key}'`,
          'FIELD_NOT_FOUND'
        );
      }
      value = credential[token.field];
    } else {
      value = typeof credential === 'string' ? credential : credential.value;
    }
    
    // Audit access
    await this.auditTokenAccess(token, context);
    
    return [token.raw, value];
  }
  
  /**
   * Audit token access for compliance
   */
  private async auditTokenAccess(
    token: VaultToken, 
    context: { agentId: string; sessionId: string }
  ): Promise<void> {
    // TODO: Implement audit logging
    console.log(`[AUDIT] ${context.agentId} accessed ${token.namespace}:${token.credential}`);
  }
  
  /**
   * Generate unique token ID
   */
  private generateTokenId(): string {
    return `tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Validate token format
   */
  static validateTokenFormat(token: string): boolean {
    const pattern = /\[VAULT:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_-]+))?\]/;
    return pattern.test(token);
  }
  
  /**
   * Parse token components
   */
  static parseToken(token: string): VaultToken | null {
    const match = token.match(/\[VAULT:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)(?:\.([a-zA-Z0-9_-]+))?\]/);
    if (!match) return null;
    
    const [, namespace, credential, field] = match;
    
    return {
      id: `parsed_${Date.now()}`,
      raw: match[0],
      namespace: namespace as any,
      credential: credential || "",
      field,
      createdAt: new Date().toISOString(),
      accessCount: 0,
    };
  }
}

export default TokenEngine;