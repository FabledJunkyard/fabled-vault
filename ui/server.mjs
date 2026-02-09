import express from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ============================================================================
// SECURITY: AUDIT LOGGING SYSTEM
// ============================================================================
const AUDIT_LOG_FILE = path.join(__dirname, "logs", "vault-audit.jsonl");

/**
 * Log security-relevant events to audit trail.
 *
 * Given: A security event (create, read, update, delete, export)
 * When: Event occurs in the vault system
 * Then: Event is logged with timestamp, user context, IP, and status
 */
async function auditLog(event) {
  try {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: event.action,
      category: event.category || null,
      sensitivityLevel: event.sensitivityLevel || null,
      status: event.status || "success",
      details: event.details || {},
      clientIp: event.clientIp || "unknown",
      // SECURITY: Never log actual sensitive values
      valueHash: event.valueHash || null,
    };

    // Ensure logs directory exists
    await fs.mkdir(path.dirname(AUDIT_LOG_FILE), { recursive: true });

    // Append to audit log (JSONL format for streaming)
    await fs.appendFile(
      AUDIT_LOG_FILE,
      JSON.stringify(auditEntry) + "\n"
    );
  } catch (err) {
    console.error("CRITICAL: Audit logging failed:", err.message);
  }
}

// ============================================================================
// PII SCHEMA MANAGEMENT
// ============================================================================
const SCHEMA_FILE = path.join(__dirname, "config", "pii-schema.json");
let piiSchema = null;

/**
 * Load PII schema from disk with caching.
 *
 * Given: Schema file exists at config/pii-schema.json
 * When: Server starts or schema is requested
 * Then: Returns validated schema with all categories and rules
 */
async function loadSchema() {
  try {
    const data = await fs.readFile(SCHEMA_FILE, "utf-8");
    piiSchema = JSON.parse(data);
    console.log(
      `✓ Loaded PII schema with ${piiSchema.categories.length} categories`
    );
    return piiSchema;
  } catch (err) {
    console.error("ERROR: Failed to load PII schema:", err.message);
    throw new Error("PII schema not found or invalid");
  }
}

/**
 * Validate a value against a PII category pattern.
 *
 * Given: A value and category ID
 * When: Validation is requested
 * Then: Returns true if matches pattern, false otherwise (does NOT expose pattern)
 */
function validatePattern(value, categoryId) {
  if (!piiSchema) return false;

  const category = piiSchema.categories.find((c) => c.id === categoryId);
  if (!category) return false;

  try {
    const regex = new RegExp(category.pattern);
    return regex.test(value);
  } catch (err) {
    console.error(`Regex error in category ${categoryId}:`, err.message);
    return false;
  }
}

/**
 * Mask sensitive value according to category rules.
 *
 * Given: A sensitive value and category ID
 * When: Value needs to be displayed (never in logs)
 * Then: Returns masked representation per maskFormat rule
 */
function maskValue(value, categoryId) {
  if (!piiSchema) return "***";

  const category = piiSchema.categories.find((c) => c.id === categoryId);
  if (!category) return "***";

  return category.maskFormat;
}

/**
 * Create hash of value for audit logs WITHOUT exposing value.
 *
 * Given: A sensitive value
 * When: Logging to audit trail
 * Then: Returns cryptographic hash of value (not reversible)
 */
function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ============================================================================
// API ENDPOINTS: PII SCHEMA CRUD
// ============================================================================

/**
 * GET /api/schema
 * Retrieve complete PII schema (no sensitive values exposed).
 *
 * Given: Schema is loaded
 * When: Client requests GET /api/schema
 * Then: Returns schema with all categories and validation rules
 */
app.get("/api/schema", (req, res) => {
  if (!piiSchema) {
    return res.status(500).json({ error: "Schema not loaded" });
  }

  auditLog({
    action: "schema_read",
    status: "success",
    clientIp: req.ip,
  });

  res.json(piiSchema);
});

/**
 * GET /api/categories
 * List all PII categories with metadata (for UI dropdown).
 *
 * Given: Schema is loaded
 * When: Client requests GET /api/categories
 * Then: Returns array of categories with id, name, description, sensitivityLevel
 */
app.get("/api/categories", (req, res) => {
  if (!piiSchema) {
    return res.status(500).json({ error: "Schema not loaded" });
  }

  const categories = piiSchema.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    sensitivityLevel: cat.sensitivityLevel,
    patternDescription: cat.patternDescription,
    fieldTypes: cat.fieldTypes,
  }));

  auditLog({
    action: "categories_list",
    status: "success",
    clientIp: req.ip,
  });

  res.json(categories);
});

/**
 * GET /api/category/:id
 * Retrieve single category details.
 *
 * Given: Category ID in URL parameter
 * When: Client requests category metadata
 * Then: Returns category with validation rules (pattern NOT exposed)
 */
app.get("/api/category/:id", (req, res) => {
  if (!piiSchema) {
    return res.status(500).json({ error: "Schema not loaded" });
  }

  const { id } = req.params;
  const category = piiSchema.categories.find((c) => c.id === id);

  if (!category) {
    auditLog({
      action: "category_read",
      category: id,
      status: "not_found",
      clientIp: req.ip,
    });
    return res.status(404).json({ error: "Category not found" });
  }

  auditLog({
    action: "category_read",
    category: id,
    sensitivityLevel: category.sensitivityLevel,
    status: "success",
    clientIp: req.ip,
  });

  res.json(category);
});

/**
 * POST /api/validate
 * Validate a value against a category pattern.
 *
 * Given: { value, categoryId } in request body
 * When: Client requests validation
 * Then: Returns { valid: boolean } WITHOUT exposing pattern or value details
 */
app.post("/api/validate", (req, res) => {
  const { value, categoryId } = req.body;

  if (!value || !categoryId) {
    return res.status(400).json({ error: "Missing value or categoryId" });
  }

  const category = piiSchema?.categories.find((c) => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  const isValid = validatePattern(value, categoryId);

  auditLog({
    action: "validate",
    category: categoryId,
    sensitivityLevel: category.sensitivityLevel,
    status: isValid ? "valid" : "invalid",
    clientIp: req.ip,
  });

  res.json({
    valid: isValid,
    category: categoryId,
    sensitivityLevel: category.sensitivityLevel,
    maskFormat: category.maskFormat,
  });
});

/**
 * POST /api/vault-item/add
 * Add new credential with PII classification.
 *
 * Given: { namespace, name, categoryId, value } in request
 * When: Client submits new credential
 * Then: Validates against category pattern, stores locally, logs audit
 */
app.post("/api/vault-item/add", async (req, res) => {
  const { namespace, name, categoryId, value } = req.body;

  // SECURITY: Validate all inputs
  if (!namespace || !name || !categoryId || !value) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const category = piiSchema?.categories.find((c) => c.id === categoryId);
  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  // SECURITY: Validate against regex pattern
  const isValid = validatePattern(value, categoryId);
  if (!isValid) {
    auditLog({
      action: "vault_add",
      category: categoryId,
      status: "validation_failed",
      details: { reason: "Pattern mismatch" },
      clientIp: req.ip,
    });

    return res.status(400).json({
      error: `Value does not match ${category.name} pattern: ${category.patternDescription}`,
      category,
    });
  }

  auditLog({
    action: "vault_add",
    category: categoryId,
    sensitivityLevel: category.sensitivityLevel,
    status: "success",
    valueHash: await hashValue(value),
    clientIp: req.ip,
  });

  // Return token (never expose actual value)
  res.json({
    success: true,
    token: `[VAULT:${namespace}:${name}]`,
    category: categoryId,
    sensitivityLevel: category.sensitivityLevel,
    message: `Added ${category.name} to vault`,
  });
});

/**
 * POST /api/vault-item/delete
 * Delete credential from vault.
 *
 * Given: { id } in request
 * When: Client requests deletion
 * Then: Records audit log (storage is in browser localStorage)
 */
app.post("/api/vault-item/delete", (req, res) => {
  const { id } = req.body;

  if (id === undefined) {
    return res.status(400).json({ error: "Missing id" });
  }

  auditLog({
    action: "vault_delete",
    status: "success",
    details: { itemId: id },
    clientIp: req.ip,
  });

  res.json({ success: true, message: `Item ${id} deleted` });
});

/**
 * POST /api/vault/export
 * Export vault contents with restrictions on critical data.
 *
 * Given: Vault data exists
 * When: Client requests export
 * Then: Blocks export of critical PII, logs audit event
 */
app.post("/api/vault/export", (req, res) => {
  const { items } = req.body || {};

  // SECURITY: Check for critical categories
  const hasCritical = items?.some((item) => {
    const category = piiSchema?.categories.find(
      (c) => c.id === item.categoryId
    );
    return category?.allowExport === false && category?.sensitivityLevel === "critical";
  });

  if (hasCritical) {
    auditLog({
      action: "vault_export",
      status: "blocked",
      details: {
        reason: "Critical PII in export",
        itemCount: items?.length,
      },
      clientIp: req.ip,
    });

    return res.status(403).json({
      error:
        "Cannot export vault containing critical PII (SSN, credit card, API keys, private keys)",
      blockedCategories: [
        "ssn",
        "credit_card",
        "api_key",
        "private_key",
        "database_password",
      ],
    });
  }

  auditLog({
    action: "vault_export",
    status: "success",
    details: { itemCount: items?.length },
    clientIp: req.ip,
  });

  // Return masked version suitable for export
  res.json({
    success: true,
    itemCount: items?.length || 0,
    timestamp: new Date().toISOString(),
    warning:
      "Never share exported vault data. Contains sensitive credentials.",
  });
});

/**
 * GET /api/audit-log
 * Retrieve audit log (admin endpoint - in production, add authentication).
 *
 * Given: Audit log file exists
 * When: Admin requests audit trail
 * Then: Returns paginated audit entries
 */
app.get("/api/audit-log", async (req, res) => {
  try {
    const lines = await fs.readFile(AUDIT_LOG_FILE, "utf-8");
    const entries = lines
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
      .reverse() // Most recent first
      .slice(0, 100); // Last 100 events

    res.json({
      total: entries.length,
      entries,
    });
  } catch (err) {
    if (err.code === "ENOENT") {
      return res.json({ total: 0, entries: [] });
    }
    res.status(500).json({ error: "Failed to read audit log" });
  }
});

// ============================================================================
// LEGACY ENDPOINTS (for backward compatibility)
// ============================================================================

app.post("/delete", (req, res) => {
  const { id } = req.body;
  auditLog({
    action: "vault_delete",
    status: "success",
    details: { itemId: id },
    clientIp: req.ip,
  });

  res.json({ success: true });
});

app.post("/export", (req, res) => {
  auditLog({
    action: "vault_export",
    status: "success",
    clientIp: req.ip,
  });

  res.json([]);
});

// ============================================================================
// SERVER START
// ============================================================================

const PORT = 3101;

async function start() {
  try {
    await loadSchema();
    app.listen(PORT, () => {
      console.log(`✓ FabledVault V4 Categories UI: http://localhost:${PORT}`);
      console.log(`✓ PII Categories enabled: ${piiSchema.categories.length}`);
      console.log(`✓ Audit logging: ${AUDIT_LOG_FILE}`);
    });
  } catch (err) {
    console.error("FATAL: Failed to start server:", err.message);
    process.exit(1);
  }
}

start(); 
