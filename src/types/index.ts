/**
 * Universal Vault V4 - Core Type Definitions
 * 
 * Agent-agnostic credential management types that work with
 * any AI agent, schema, or external system.
 */

import { z } from 'zod';

// =============================================================================
// UNIVERSAL TOKEN SYSTEM
// =============================================================================

export const TokenNamespaceSchema = z.enum([
  'personal',    // Personal credentials (banking, social media)
  'business',    // Business credentials (AWS, databases) 
  'shared',      // Team/shared credentials
  'finance',     // Financial-specific (Grant's domain)
  'development', // Development APIs and keys
  'social',      // Social media platforms
  'custom',      // Custom namespaces
]);

export type TokenNamespace = z.infer<typeof TokenNamespaceSchema>;

export const VaultTokenSchema = z.object({
  id: z.string().nanoid(),
  raw: z.string(), // The original [VAULT:namespace:credential(.field)?] token
  namespace: TokenNamespaceSchema,
  credential: z.string(),
  field: z.string().optional(), // For structured credentials
  createdAt: z.string().datetime(),
  lastAccessed: z.string().datetime().optional(),
  accessCount: z.number().int().nonnegative().default(0),
});

export type VaultToken = z.infer<typeof VaultTokenSchema>;

// =============================================================================
// CREDENTIAL STORAGE
// =============================================================================

export const CredentialTypeSchema = z.enum([
  'simple',      // Single value (API key, password)
  'structured',  // Key-value pairs (username/password)
  'file',        // Binary data (SSH keys, certificates)
  'json',        // Complex structured data
]);

export type CredentialType = z.infer<typeof CredentialTypeSchema>;

export const CredentialSchema = z.object({
  id: z.string().nanoid(),
  namespace: TokenNamespaceSchema,
  name: z.string(),
  type: CredentialTypeSchema,
  description: z.string().optional(),
  
  // Security metadata
  sensitivityLevel: z.enum(['low', 'medium', 'high', 'critical']),
  requiresHardwareKey: z.boolean().default(false),
  requiresBiometric: z.boolean().default(false),
  
  // Encrypted data (never stored in plain text)
  encryptedData: z.string(), // Base64 encrypted blob
  encryptionKeyId: z.string(), // Reference to encryption key
  
  // Metadata
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  
  // Access control
  allowedAgents: z.array(z.string()).default([]), // Empty = all agents
  allowedTools: z.array(z.string()).default([]),  // Empty = all tools
});

export type Credential = z.infer<typeof CredentialSchema>;

// =============================================================================
// ACCESS CONTROL & GRANTS
// =============================================================================

export const AccessGrantSchema = z.object({
  id: z.string().nanoid(),
  credentialId: z.string(),
  agentId: z.string(), // 'grant', 'main', 'external-system-id', etc.
  
  // Grant parameters
  purpose: z.string(), // Human-readable reason
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  usesRemaining: z.number().int().positive().optional(),
  
  // Access restrictions
  allowedTools: z.array(z.string()).default([]),
  requiresConfirmation: z.boolean().default(false),
  
  // Context information
  context: z.record(z.string(), z.any()).default({}),
  
  // Status
  isActive: z.boolean().default(true),
  revokedAt: z.string().datetime().optional(),
  revokeReason: z.string().optional(),
});

export type AccessGrant = z.infer<typeof AccessGrantSchema>;

// =============================================================================
// AGENT INTEGRATION
// =============================================================================

export const AgentTypeSchema = z.enum([
  'mcp',         // MCP-compatible agents (Grant)
  'rest',        // REST API clients
  'graphql',     // GraphQL clients
  'websocket',   // Real-time clients
  'plugin',      // Custom plugin integrations
  'external',    // External systems
]);

export type AgentType = z.infer<typeof AgentTypeSchema>;

export const AgentContextSchema = z.object({
  agentId: z.string(),
  agentType: AgentTypeSchema,
  sessionId: z.string(),
  
  // Request context
  requestedCredentials: z.array(z.string()),
  tools: z.array(z.string()),
  purpose: z.string(),
  
  // Security context
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  timestamp: z.string().datetime(),
  
  // Custom context data
  metadata: z.record(z.string(), z.any()).default({}),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

// =============================================================================
// MULTI-DEVICE SYNC
// =============================================================================

export const DeviceSchema = z.object({
  id: z.string().nanoid(),
  name: z.string(), // "iPhone 15 Pro", "MacBook Air", etc.
  type: z.enum(['mobile', 'desktop', 'server', 'browser']),
  platform: z.string(), // "ios", "android", "macos", "windows", etc.
  
  // Sync credentials
  publicKey: z.string(), // Device's public key for E2E encryption
  lastSyncAt: z.string().datetime().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  authorizedAt: z.string().datetime(),
  authorizedBy: z.string(), // Device that authorized this device
});

export type Device = z.infer<typeof DeviceSchema>;

export const SyncEventSchema = z.object({
  id: z.string().nanoid(),
  deviceId: z.string(),
  type: z.enum(['create', 'update', 'delete', 'grant', 'revoke']),
  credentialId: z.string(),
  
  // Vector clock for conflict resolution
  vectorClock: z.record(z.string(), z.number()),
  
  // Encrypted delta
  encryptedDelta: z.string(), // Base64 encrypted change
  
  timestamp: z.string().datetime(),
});

export type SyncEvent = z.infer<typeof SyncEventSchema>;

// =============================================================================
// AUDIT & MONITORING
// =============================================================================

export const AuditActionSchema = z.enum([
  'credential_access',
  'credential_create', 
  'credential_update',
  'credential_delete',
  'grant_created',
  'grant_revoked',
  'device_authorized',
  'device_deauthorized',
  'vault_unlocked',
  'vault_locked',
  'sync_performed',
  'security_event',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntrySchema = z.object({
  id: z.string().nanoid(),
  timestamp: z.string().datetime(),
  action: AuditActionSchema,
  
  // Context
  agentId: z.string().optional(),
  deviceId: z.string().optional(),
  credentialId: z.string().optional(),
  sessionId: z.string().optional(),
  
  // Details
  details: z.record(z.string(), z.any()),
  
  // Security
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  
  // Risk assessment
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  
  // Integrity
  signature: z.string(), // HMAC signature for tamper detection
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

// =============================================================================
// HARDWARE SECURITY
// =============================================================================

export const HardwareKeyTypeSchema = z.enum([
  'yubikey',
  'tpm',
  'secure_enclave',
  'android_keystore',
  'windows_hello',
]);

export type HardwareKeyType = z.infer<typeof HardwareKeyTypeSchema>;

export const HardwareKeySchema = z.object({
  id: z.string(),
  type: HardwareKeyTypeSchema,
  name: z.string(),
  serialNumber: z.string().optional(),
  
  // Capabilities
  supportsTouch: z.boolean().default(false),
  supportsPIN: z.boolean().default(false),
  supportsBiometric: z.boolean().default(false),
  
  // Status
  isActive: z.boolean().default(true),
  lastUsedAt: z.string().datetime().optional(),
  registeredAt: z.string().datetime(),
});

export type HardwareKey = z.infer<typeof HardwareKeySchema>;

// =============================================================================
// API INTERFACES
// =============================================================================

export interface TokenSubstitutionResult {
  originalText: string;
  substitutedText: string;
  tokensProcessed: number;
  processingTimeMs: number;
  accessGrants: AccessGrant[];
}

export interface VaultAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    processingTimeMs: number;
  };
}

export interface CredentialRequest {
  namespace: TokenNamespace;
  name: string;
  type: CredentialType;
  data: any; // Will be encrypted
  description?: string;
  sensitivityLevel: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
  expiresAt?: string;
}

export interface GrantRequest {
  credentialIds: string[];
  agentId: string;
  purpose: string;
  duration?: number; // Seconds
  maxUses?: number;
  allowedTools?: string[];
  requiresConfirmation?: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const VaultConfigSchema = z.object({
  // Storage
  databasePath: z.string(),
  encryptDatabase: z.boolean().default(true),
  
  // Security
  masterPassword: z.string().min(12),
  hardwareKeyRequired: z.boolean().default(false),
  biometricUnlock: z.boolean().default(true),
  autoLockTimeoutMinutes: z.number().int().positive().default(30),
  
  // Performance
  maxTokensPerRequest: z.number().int().positive().default(100),
  tokenSubstitutionTimeoutMs: z.number().int().positive().default(10000),
  cacheSize: z.number().int().positive().default(1000),
  
  // Networking
  servers: z.object({
    mcp: z.object({
      enabled: z.boolean().default(true),
      port: z.number().int().min(1).max(65535).default(9001),
    }),
    rest: z.object({
      enabled: z.boolean().default(true), 
      port: z.number().int().min(1).max(65535).default(9002),
    }),
    graphql: z.object({
      enabled: z.boolean().default(true),
      port: z.number().int().min(1).max(65535).default(9003),
    }),
    websocket: z.object({
      enabled: z.boolean().default(true),
      port: z.number().int().min(1).max(65535).default(9004),
    }),
  }),
  
  // Sync
  sync: z.object({
    enabled: z.boolean().default(false),
    serverUrl: z.string().url().optional(),
    syncIntervalMinutes: z.number().int().positive().default(15),
  }),
  
  // Audit
  audit: z.object({
    enabled: z.boolean().default(true),
    retainDays: z.number().int().positive().default(90),
    encryptLogs: z.boolean().default(true),
  }),
});

export type VaultConfig = z.infer<typeof VaultConfigSchema>;

// =============================================================================
// ERROR TYPES
// =============================================================================

export class VaultError extends Error {
  constructor(
    message: string,
    public code: string,
    public isRetryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'VaultError';
  }
  
  static authenticationFailed(details?: any) {
    return new VaultError('Authentication failed', 'AUTH_FAILED', false, details);
  }
  
  static credentialNotFound(id: string) {
    return new VaultError(`Credential not found: ${id}`, 'CREDENTIAL_NOT_FOUND', false);
  }
  
  static grantExpired(grantId: string) {
    return new VaultError(`Grant expired: ${grantId}`, 'GRANT_EXPIRED', false);
  }
  
  static hardwareKeyRequired() {
    return new VaultError('Hardware key required for this operation', 'HARDWARE_KEY_REQUIRED', false);
  }
  
  static tokenSubstitutionTimeout() {
    return new VaultError('Token substitution timed out', 'SUBSTITUTION_TIMEOUT', true);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Schemas are already exported above as named exports

// Default export for convenience
export default {
  VaultError,
};