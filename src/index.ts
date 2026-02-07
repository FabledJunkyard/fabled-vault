/**
 * FabledVault - Main Entry Point
 * 
 * Agent-agnostic credential management for any AI agent, schema, or system
 */

// Core exports
export { TokenEngine } from './core/token-engine.js';
export { UniversalVaultMCPServer } from './servers/mcp-server.js';

// Type exports
export * from './types/index.js';

// Version
export const VERSION = '4.0.0';

// Simple examples without template literals
export const examples = {
  grantBankingWorkflow: "Grant banking workflow example",
  universalAgentIntegration: "Universal agent integration example", 
  multiDeviceSync: "Multi-device sync example",
  hardwareSecurity: "Hardware security example"
};

console.log('🚀 FabledVault loaded');
console.log('📚 Examples available: import { examples } from "FabledVault"');
console.log('💰 Perfect for Grant financial workflows!');