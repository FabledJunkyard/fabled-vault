/**
 * Universal Vault V4 - MCP Server
 * 
 * Model Context Protocol server for AI agent integration (Grant, etc.)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TokenEngine } from '../core/token-engine.js';
import { VaultError, type Credential, type AccessGrant } from '../types/index.js';

export class UniversalVaultMCPServer {
  private server: Server;
  private tokenEngine: TokenEngine;
  private credentials: Map<string, Credential> = new Map();
  private grants: Map<string, AccessGrant> = new Map();
  
  constructor() {
    this.server = new Server(
      {
        name: 'universal-vault-v4',
        version: '4.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.tokenEngine = new TokenEngine();
    this.setupTools();
  }
  
  private setupTools() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'vault_substitute_tokens',
            description: 'Substitute vault tokens in text with actual credential values',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: 'Text containing [VAULT:namespace:credential] tokens',
                },
                agent_id: {
                  type: 'string',
                  description: 'Agent requesting substitution (e.g., "grant")',
                },
                tools: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tools the agent plans to use with credentials',
                  default: [],
                },
                purpose: {
                  type: 'string',
                  description: 'Purpose of credential access (for audit)',
                  default: 'Agent credential access',
                },
              },
              required: ['text', 'agent_id'],
            },
          },
          {
            name: 'vault_add_credential',
            description: 'Add a new credential to the vault',
            inputSchema: {
              type: 'object',
              properties: {
                namespace: {
                  type: 'string',
                  enum: ['personal', 'business', 'shared', 'finance', 'development'],
                  description: 'Credential namespace',
                },
                name: {
                  type: 'string',
                  description: 'Credential name',
                },
                data: {
                  type: 'object',
                  description: 'Credential data (will be encrypted)',
                },
                description: {
                  type: 'string',
                  description: 'Optional description',
                },
                sensitivity: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'critical'],
                  default: 'high',
                },
              },
              required: ['namespace', 'name', 'data'],
            },
          },
          {
            name: 'vault_grant_access',
            description: 'Grant agent access to specific credentials',
            inputSchema: {
              type: 'object',
              properties: {
                credential_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Credential IDs to grant access to',
                },
                agent_id: {
                  type: 'string',
                  description: 'Agent to grant access to',
                },
                duration_minutes: {
                  type: 'number',
                  description: 'Access duration in minutes (0 = unlimited)',
                  default: 30,
                },
                max_uses: {
                  type: 'number',
                  description: 'Maximum number of uses (0 = unlimited)',
                  default: 0,
                },
                purpose: {
                  type: 'string',
                  description: 'Purpose of access grant',
                },
              },
              required: ['credential_ids', 'agent_id', 'purpose'],
            },
          },
          {
            name: 'vault_list_credentials',
            description: 'List available credentials (names only, not values)',
            inputSchema: {
              type: 'object',
              properties: {
                namespace: {
                  type: 'string',
                  description: 'Filter by namespace (optional)',
                },
                agent_id: {
                  type: 'string',
                  description: 'Filter by accessible credentials for agent',
                },
              },
            },
          },
          {
            name: 'vault_audit_log',
            description: 'View credential access audit log',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Number of entries to return',
                  default: 10,
                },
                credential_name: {
                  type: 'string',
                  description: 'Filter by credential name',
                },
                agent_id: {
                  type: 'string',
                  description: 'Filter by agent ID',
                },
              },
            },
          },
        ],
      };
    });
    
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'vault_substitute_tokens':
            return await this.handleTokenSubstitution(args);
          case 'vault_add_credential':
            return await this.handleAddCredential(args);
          case 'vault_grant_access':
            return await this.handleGrantAccess(args);
          case 'vault_list_credentials':
            return await this.handleListCredentials(args);
          case 'vault_audit_log':
            return await this.handleAuditLog(args);
          default:
            throw new VaultError(`Unknown tool: ${name}`, 'UNKNOWN_TOOL');
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }
  
  /**
   * Handle token substitution - core functionality for Grant
   */
  private async handleTokenSubstitution(args: any) {
    const { text, agent_id, tools = [], purpose = 'Agent credential access' } = args;
    
    // Extract tokens from text
    const tokens = this.tokenEngine.extractTokens(text);
    
    if (tokens.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: text, // No tokens to substitute
          },
        ],
      };
    }
    
    // Validate agent has access to all tokens
    for (const token of tokens) {
      const credentialKey = `${token.namespace}:${token.credential}`;
      if (!this.hasAccess(agent_id, credentialKey)) {
        throw VaultError.authenticationFailed(`No access to ${credentialKey}`);
      }
    }
    
    // Build credentials map for substitution
    const credentialsMap = new Map();
    for (const token of tokens) {
      const credentialKey = `${token.namespace}:${token.credential}`;
      const credential = this.credentials.get(credentialKey);
      if (credential) {
        credentialsMap.set(credentialKey, JSON.parse(credential.encryptedData));
      }
    }
    
    // Perform substitution
    const result = await this.tokenEngine.substituteTokens(
      text,
      credentialsMap,
      { agentId: agent_id, sessionId: 'mcp_session' }
    );
    
    return {
      content: [
        {
          type: 'text',
          text: result.text,
        },
      ],
    };
  }
  
  /**
   * Add new credential to vault
   */
  private async handleAddCredential(args: any) {
    const { namespace, name, data, description, sensitivity = 'high' } = args;
    
    const credential: Credential = {
      id: this.generateId(),
      namespace,
      name,
      type: typeof data === 'object' ? 'structured' : 'simple',
      description,
      sensitivityLevel: sensitivity,
      requiresHardwareKey: sensitivity === 'critical',
      requiresBiometric: sensitivity === 'critical',
      encryptedData: JSON.stringify(data), // TODO: Actually encrypt
      encryptionKeyId: 'default',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      allowedAgents: [],
      allowedTools: [],
    };
    
    const key = `${namespace}:${name}`;
    this.credentials.set(key, credential);
    
    return {
      content: [
        {
          type: 'text',
          text: `Credential '${key}' added successfully. Use token: [VAULT:${namespace}:${name}]`,
        },
      ],
    };
  }
  
  /**
   * Grant agent access to credentials
   */
  private async handleGrantAccess(args: any) {
    const { credential_ids, agent_id, duration_minutes = 30, max_uses = 0, purpose } = args;
    
    const grants: string[] = [];
    
    for (const credId of credential_ids) {
      const grant: AccessGrant = {
        id: this.generateId(),
        credentialId: credId,
        agentId: agent_id,
        purpose,
        grantedAt: new Date().toISOString(),
        expiresAt: duration_minutes > 0 
          ? new Date(Date.now() + duration_minutes * 60 * 1000).toISOString()
          : undefined,
        usesRemaining: max_uses > 0 ? max_uses : undefined,
        allowedTools: [],
        requiresConfirmation: false,
        context: {},
        isActive: true,
      };
      
      this.grants.set(grant.id, grant);
      grants.push(grant.id);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Access granted to ${agent_id} for ${credential_ids.length} credentials. Grant IDs: ${grants.join(', ')}`,
        },
      ],
    };
  }
  
  /**
   * List available credentials
   */
  private async handleListCredentials(args: any) {
    const { namespace, agent_id } = args;
    
    const credentials = Array.from(this.credentials.values())
      .filter(cred => !namespace || cred.namespace === namespace)
      .map(cred => ({
        namespace: cred.namespace,
        name: cred.name,
        description: cred.description,
        token: `[VAULT:${cred.namespace}:${cred.name}]`,
        hasAccess: agent_id ? this.hasAccess(agent_id, `${cred.namespace}:${cred.name}`) : false,
      }));
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(credentials, null, 2),
        },
      ],
    };
  }
  
  /**
   * View audit log
   */
  private async handleAuditLog(args: any) {
    // TODO: Implement audit log retrieval
    return {
      content: [
        {
          type: 'text',
          text: 'Audit log functionality coming soon',
        },
      ],
    };
  }
  
  /**
   * Check if agent has access to credential
   */
  private hasAccess(agentId: string, credentialKey: string): boolean {
    // TODO: Implement proper access checking based on grants
    return true; // For now, allow all access
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Start the MCP server
   */
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Universal Vault V4 MCP Server started');
  }
}

// Example usage for Grant financial workflows
export default UniversalVaultMCPServer;