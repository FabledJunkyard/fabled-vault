/**
 * Universal Vault V4 - SQLite Database Layer
 */
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
const VAULT_DIR = process.env.VAULT_DIR || path.join(os.homedir(), '.universal-vault');
const VAULT_DB_PATH = path.join(VAULT_DIR, 'vault.db');
export class VaultDB {
    db;
    constructor(dbPath = VAULT_DB_PATH) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(dbPath);
        this.initSchema();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        description TEXT,
        sensitivity_level TEXT,
        encrypted_data TEXT NOT NULL,
        encryption_key_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(namespace, name)
      );

      CREATE TABLE IF NOT EXISTS access_grants (
        id TEXT PRIMARY KEY,
        credential_id TEXT,
        agent_id TEXT,
        uses_remaining INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (credential_id) REFERENCES credentials(id)
      );

      CREATE INDEX IF NOT EXISTS idx_credentials_namespace ON credentials(namespace);
      CREATE INDEX IF NOT EXISTS idx_grants_agent ON access_grants(agent_id);
    `);
    }
    // Credential operations
    addCredential(credential) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO credentials (
        id, namespace, name, type, description, sensitivity_level,
        encrypted_data, encryption_key_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(credential.id, credential.namespace, credential.name, credential.type, credential.description, credential.sensitivityLevel, credential.encryptedData, credential.encryptionKeyId, credential.createdAt, credential.updatedAt);
    }
    getCredential(namespace, name) {
        const stmt = this.db.prepare('SELECT * FROM credentials WHERE namespace = ? AND name = ?');
        const row = stmt.get(namespace, name);
        if (!row)
            return null;
        return {
            id: row.id,
            namespace: row.namespace,
            name: row.name,
            type: row.type,
            description: row.description,
            sensitivityLevel: row.sensitivity_level,
            encryptedData: row.encrypted_data,
            encryptionKeyId: row.encryption_key_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    listCredentials(namespace) {
        const stmt = namespace
            ? this.db.prepare('SELECT * FROM credentials WHERE namespace = ?')
            : this.db.prepare('SELECT * FROM credentials');
        const rows = (namespace ? stmt.all(namespace) : stmt.all());
        return rows.map(row => ({
            id: row.id,
            namespace: row.namespace,
            name: row.name,
            type: row.type,
            description: row.description,
            sensitivityLevel: row.sensitivity_level,
            encryptedData: row.encrypted_data,
            encryptionKeyId: row.encryption_key_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
    }
    // Grant operations
    createGrant(grant) {
        const stmt = this.db.prepare(`
      INSERT INTO access_grants (id, credential_id, agent_id, uses_remaining, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(grant.id, grant.credentialId, grant.agentId, grant.usesRemaining, grant.isActive ? 1 : 0, new Date().toISOString());
    }
    hasAccess(agentId, credentialId) {
        const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM access_grants
      WHERE agent_id = ? AND credential_id = ? AND is_active = 1
    `);
        const result = stmt.get(agentId, credentialId);
        return result.count > 0;
    }
    close() {
        this.db.close();
    }
}
export default VaultDB;
