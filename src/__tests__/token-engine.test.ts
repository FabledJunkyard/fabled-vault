import { beforeEach, describe, expect, it, vi } from "vitest";
/**
 * Universal Vault V4 - Token Engine Tests
 */

import { describe, test, expect } from 'vitest';
import { TokenEngine } from '../core/token-engine.js';

describe('TokenEngine', () => {
  let engine: TokenEngine;
  
  beforeEach(() => {
    engine = new TokenEngine();
  });
  
  describe('Token Extraction', () => {
    test('extracts simple tokens', () => {
      const text = 'Use [VAULT:personal:api_key] to authenticate';
      const tokens = engine.extractTokens(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].raw).toBe('[VAULT:personal:api_key]');
      expect(tokens[0].namespace).toBe('personal');
      expect(tokens[0].credential).toBe('api_key');
      expect(tokens[0].field).toBeUndefined();
    });
    
    test('extracts structured tokens with fields', () => {
      const text = 'Login with [VAULT:personal:chase_login.username] and [VAULT:personal:chase_login.password]';
      const tokens = engine.extractTokens(text);
      
      expect(tokens).toHaveLength(2);
      
      expect(tokens[0].raw).toBe('[VAULT:personal:chase_login.username]');
      expect(tokens[0].credential).toBe('chase_login');
      expect(tokens[0].field).toBe('username');
      
      expect(tokens[1].raw).toBe('[VAULT:personal:chase_login.password]');
      expect(tokens[1].credential).toBe('chase_login');
      expect(tokens[1].field).toBe('password');
    });
    
    test('handles multiple namespaces', () => {
      const text = `
        Business: [VAULT:business:aws_key]
        Personal: [VAULT:personal:bank_login]
        Finance: [VAULT:finance:investment_api]
      `;
      const tokens = engine.extractTokens(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens.map(t => t.namespace)).toEqual(['business', 'personal', 'finance']);
    });
    
    test('handles no tokens', () => {
      const text = 'This text has no vault tokens';
      const tokens = engine.extractTokens(text);
      
      expect(tokens).toHaveLength(0);
    });
    
    test('ignores invalid token formats', () => {
      const text = `
        Valid: [VAULT:personal:valid_token]
        Invalid: [VAULT:invalid]
        Also invalid: VAULT:personal:no_brackets
        Still invalid: [NOT_VAULT:personal:token]
      `;
      const tokens = engine.extractTokens(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].credential).toBe('valid_token');
    });
  });
  
  describe('Token Substitution', () => {
    test('substitutes simple credentials', async () => {
      const text = 'API Key: [VAULT:personal:github_token]';
      const credentials = new Map([
        ['personal:github_token', 'ghp_1234567890abcdef']
      ]);
      
      const result = await engine.substituteTokens(text, credentials, {
        agentId: 'grant',
        sessionId: 'test'
      });
      
      expect(result.text).toBe('API Key: ghp_1234567890abcdef');
      expect(result.processingTimeMs).toBeLessThan(10); // Performance target
    });
    
    test('substitutes structured credentials', async () => {
      const text = 'Login: [VAULT:personal:bank.username] Password: [VAULT:personal:bank.password]';
      const credentials = new Map([
        ['personal:bank', {
          username: 'matthew@example.com',
          password: 'secure123',
          account: '1234567890'
        }]
      ]);
      
      const result = await engine.substituteTokens(text, credentials, {
        agentId: 'grant',
        sessionId: 'test'
      });
      
      expect(result.text).toBe('Login: matthew@example.com Password: secure123');
    });
    
    test('handles missing credentials', async () => {
      const text = 'Missing: [VAULT:personal:missing_cred]';
      const credentials = new Map();
      
      await expect(
        engine.substituteTokens(text, credentials, {
          agentId: 'grant',
          sessionId: 'test'
        })
      ).rejects.toThrow('Credential not found');
    });
    
    test('handles missing fields', async () => {
      const text = 'Missing field: [VAULT:personal:cred.missing_field]';
      const credentials = new Map([
        ['personal:cred', { username: 'test' }]
      ]);
      
      await expect(
        engine.substituteTokens(text, credentials, {
          agentId: 'grant',
          sessionId: 'test'
        })
      ).rejects.toThrow('Field \'missing_field\' not found');
    });
    
    test('performance: processes multiple tokens quickly', async () => {
      const text = `
        [VAULT:personal:token1] [VAULT:personal:token2] [VAULT:personal:token3]
        [VAULT:business:token4] [VAULT:business:token5] [VAULT:finance:token6]
        [VAULT:personal:structured.field1] [VAULT:personal:structured.field2]
      `;
      
      const credentials = new Map([
        ['personal:token1', 'value1'],
        ['personal:token2', 'value2'],
        ['personal:token3', 'value3'],
        ['business:token4', 'value4'],
        ['business:token5', 'value5'],
        ['finance:token6', 'value6'],
        ['personal:structured', { field1: 'struct1', field2: 'struct2' }]
      ]);
      
      const result = await engine.substituteTokens(text, credentials, {
        agentId: 'grant',
        sessionId: 'performance_test'
      });
      
      // Should process 8 tokens in under 10ms
      expect(result.processingTimeMs).toBeLessThan(10);
      expect(result.text).toContain('value1');
      expect(result.text).toContain('struct2');
    });
  });
  
  describe('Token Validation', () => {
    test('validates correct token formats', () => {
      expect(TokenEngine.validateTokenFormat('[VAULT:personal:simple]')).toBe(true);
      expect(TokenEngine.validateTokenFormat('[VAULT:business:structured.field]')).toBe(true);
      expect(TokenEngine.validateTokenFormat('[VAULT:finance:api_key]')).toBe(true);
    });
    
    test('rejects invalid token formats', () => {
      expect(TokenEngine.validateTokenFormat('[VAULT:invalid]')).toBe(false);
      expect(TokenEngine.validateTokenFormat('VAULT:personal:no_brackets')).toBe(false);
      expect(TokenEngine.validateTokenFormat('[NOT_VAULT:personal:wrong_prefix]')).toBe(false);
    });
  });
  
  describe('Token Parsing', () => {
    test('parses valid tokens', () => {
      const token = TokenEngine.parseToken('[VAULT:personal:github_token]');
      
      expect(token).toBeTruthy();
      expect(token?.namespace).toBe('personal');
      expect(token?.credential).toBe('github_token');
      expect(token?.field).toBeUndefined();
    });
    
    test('parses structured tokens', () => {
      const token = TokenEngine.parseToken('[VAULT:business:aws.access_key]');
      
      expect(token).toBeTruthy();
      expect(token?.namespace).toBe('business');
      expect(token?.credential).toBe('aws');
      expect(token?.field).toBe('access_key');
    });
    
    test('returns null for invalid tokens', () => {
      expect(TokenEngine.parseToken('[VAULT:invalid]')).toBeNull();
      expect(TokenEngine.parseToken('not_a_token')).toBeNull();
    });
  });
  
  describe('Grant Financial Workflows', () => {
    test('handles typical Grant banking scenario', async () => {
      const bankingPrompt = `
        Log into my Chase bank using credentials [VAULT:personal:chase_login.username] 
        and [VAULT:personal:chase_login.password]. Then check my account balance 
        and download recent transactions.
        
        Also access my Schwab investment account with [VAULT:finance:schwab_api] 
        to get portfolio summary.
      `;
      
      const credentials = new Map([
        ['personal:chase_login', {
          username: 'matthew@example.com',
          password: 'secure_bank_password',
          account_number: '1234567890'
        }],
        ['finance:schwab_api', 'schwab_api_key_12345']
      ]);
      
      const result = await engine.substituteTokens(bankingPrompt, credentials, {
        agentId: 'grant',
        sessionId: 'banking_workflow_001'
      });
      
      expect(result.text).toContain('matthew@example.com');
      expect(result.text).toContain('secure_bank_password');
      expect(result.text).toContain('schwab_api_key_12345');
      expect(result.text).not.toContain('[VAULT:');
      expect(result.processingTimeMs).toBeLessThan(10);
    });
  });
});