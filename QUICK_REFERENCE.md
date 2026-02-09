# Vault V4 Categories - Quick Reference

## Start Server
```bash
cd /home/architect/hearth/projects/fabled-vault/ui
node server.mjs
# Opens at http://localhost:3101
```

## API Endpoints Cheat Sheet

### Categories & Schema
```bash
# Get all categories (for dropdown)
curl http://localhost:3101/api/categories

# Get single category details
curl http://localhost:3101/api/category/ssn

# Get full schema (all metadata)
curl http://localhost:3101/api/schema
```

### Validation
```bash
# Validate SSN format (valid)
curl -X POST http://localhost:3101/api/validate \
  -H "Content-Type: application/json" \
  -d '{"value":"123-45-6789","categoryId":"ssn"}'

# Validate email (invalid)
curl -X POST http://localhost:3101/api/validate \
  -H "Content-Type: application/json" \
  -d '{"value":"not-an-email","categoryId":"email"}'
```

### Vault Operations
```bash
# Add SSN credential
curl -X POST http://localhost:3101/api/vault-item/add \
  -H "Content-Type: application/json" \
  -d '{
    "namespace":"personal",
    "name":"ssn",
    "categoryId":"ssn",
    "value":"123-45-6789"
  }'

# Delete credential (by index)
curl -X POST http://localhost:3101/api/vault-item/delete \
  -H "Content-Type: application/json" \
  -d '{"id":0}'

# Try to export (will be blocked for critical PII)
curl -X POST http://localhost:3101/api/vault/export \
  -H "Content-Type: application/json" \
  -d '{"items":[{"categoryId":"ssn"}]}'
```

### Audit Log
```bash
# View last 100 audit events
curl http://localhost:3101/api/audit-log

# Pretty-print
curl http://localhost:3101/api/audit-log | jq '.entries | .[] | {action, status, category}'

# Count events by action
curl http://localhost:3101/api/audit-log | jq '.entries | map(.action) | group_by(.) | map({(.[0]): length}) | add'
```

## Category Reference

| ID | Name | Example | Sensitivity | Export |
|----|----|---------|-------------|--------|
| ssn | Social Security | 123-45-6789 | Critical | ✗ No |
| credit_card | Credit Card | 4532-1488-0343-6467 | Critical | ✗ No |
| bank_account | Bank Account | 0123456789012345 | Critical | ✗ No |
| routing_number | Routing Number | 021000021 | High | ✗ No |
| passport | Passport | AB123456 | Critical | ✗ No |
| driver_license | Driver License | D1234567 | High | ✗ No |
| email | Email | user@example.com | Medium | ✓ Yes |
| phone | Phone | +1 (555) 123-4567 | Medium | ✓ Yes |
| api_key | API Key | sk_live_51234567890abc | Critical | ✗ No |
| aws_credentials | AWS Credentials | AKIAIOSFODNN7EXAMPLE | Critical | ✗ No |
| database_password | DB Password | MySecurePass123! | Critical | ✗ No |
| private_key | Private Key | -----BEGIN RSA PRIVATE KEY----- | Critical | ✗ No |
| oauth_token | OAuth Token | ghp_abcdefghij1234567890 | Critical | ✗ No |
| tax_id | Tax ID (EIN) | 12-3456789 | High | ✗ No |
| ipv4_address | IPv4 Address | 192.0.2.1 | Low | ✓ Yes |
| jwt_token | JWT Token | eyJ...JWT...token | High | ✗ No |
| certificate | Certificate | -----BEGIN CERTIFICATE----- | Medium | ✓ Yes |

## File Locations

```
/home/architect/hearth/projects/fabled-vault/
├── ui/config/pii-schema.json           # Schema (add/edit categories here)
├── ui/logs/vault-audit.jsonl           # Audit trail (read-only, append-only)
├── ui/public/index.html                # UI (browser interface)
├── ui/server.mjs                       # Server (API endpoints)
├── VAULT_V4_SECURITY.md                # Security documentation
├── VAULT_V4_CATEGORIES_README.md       # Usage documentation
└── QUICK_REFERENCE.md                  # This file
```

## Common Tasks

### View Audit Log (Command Line)
```bash
# Last 5 entries
tail -5 /home/architect/hearth/projects/fabled-vault/ui/logs/vault-audit.jsonl | jq '.'

# Filter by action
cat /home/architect/hearth/projects/fabled-vault/ui/logs/vault-audit.jsonl | jq 'select(.action == "vault_add")'

# Count by status
cat /home/architect/hearth/projects/fabled-vault/ui/logs/vault-audit.jsonl | jq '.status' | sort | uniq -c
```

### Add New PII Category
1. Edit `ui/config/pii-schema.json`
2. Add category object to `categories` array
3. Test regex pattern on https://regex101.com/
4. Restart server: `node server.mjs`
5. Verify in dropdown at http://localhost:3101

### Test Pattern Validation
```bash
# Get category details
curl http://localhost:3101/api/category/email | jq '.patternDescription'

# Test with valid email
curl -X POST http://localhost:3101/api/validate \
  -H "Content-Type: application/json" \
  -d '{"value":"test@example.com","categoryId":"email"}' | jq '.valid'

# Test with invalid email
curl -X POST http://localhost:3101/api/validate \
  -H "Content-Type: application/json" \
  -d '{"value":"not-an-email","categoryId":"email"}' | jq '.valid'
```

### Debug Regex Pattern
1. Get pattern description: `curl http://localhost:3101/api/category/:id | jq '.patternDescription'`
2. Get actual pattern: `curl http://localhost:3101/api/schema | jq '.categories[] | select(.id == "ssn") | .pattern'`
3. Test on https://regex101.com/ (paste the regex)
4. Example test values in `.examples` field

## Sensitivity Levels

| Level | Color | Export | MFA | Approval |
|-------|-------|--------|-----|----------|
| **critical** | Red 🔴 | ✗ Blocked | ✓ Required | ✓ Required |
| **high** | Orange 🟠 | ⚠️ Restricted | ✓ Required | ○ Optional |
| **medium** | Yellow 🟡 | ✓ Allowed | ○ Optional | ○ Optional |
| **low** | Blue 🔵 | ✓ Allowed | ○ Optional | ○ Optional |

## Security Quick Tips

✓ **Never log actual values** - Use hashes for audit
✓ **Never expose patterns** - Only show format descriptions
✓ **Never send values to client** - Return tokens only
✓ **Always validate server-side** - Never trust client
✓ **Log all access** - For compliance audits
✓ **Block critical exports** - SSN, cards, keys, passwords
✓ **Use HTTPS in production** - Encrypt in transit
✓ **Authenticate users** - Add JWT/API keys

## Regex Pattern Examples

```
SSN:          ^\d{3}-\d{2}-\d{4}$
Email:        ^[^@\s]+@[^@\s]+\.[^@\s]+$
Credit Card:  ^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$
Phone:        ^\+?1?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$
IPv4:         ^(\d{1,3}\.){3}\d{1,3}$
JWT:          ^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$
API Key:      ^[A-Za-z0-9_-]{20,}$
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Port 3101 in use | `lsof -i :3101` and kill process, or change port |
| Schema not loading | Check `ui/config/pii-schema.json` exists and is valid JSON |
| Validation not working | Verify category ID exists: `curl http://localhost:3101/api/categories` |
| Audit log not appearing | Ensure `ui/logs/` directory exists and is writable |
| Invalid JSON in schema | Validate with `cat ui/config/pii-schema.json \| jq '.'` |
| Regex pattern not matching | Test on https://regex101.com/ and compare carefully |

## Response Code Reference

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Good, action completed |
| 400 | Bad Request | Check input format |
| 403 | Forbidden | Export blocked (critical PII) |
| 404 | Not Found | Category doesn't exist |
| 500 | Server Error | Check server logs |

## Useful jq Filters

```bash
# List all category IDs
curl http://localhost:3101/api/categories | jq '.[] | .id'

# Show critical categories only
curl http://localhost:3101/api/categories | jq '.[] | select(.sensitivityLevel == "critical") | .name'

# Show export policies
curl http://localhost:3101/api/categories | jq '.[] | {id, name, export: .allowExport}'

# Count categories by sensitivity
curl http://localhost:3101/api/categories | jq 'group_by(.sensitivityLevel) | map({(.[0].sensitivityLevel): length}) | add'

# Extract pattern descriptions
curl http://localhost:3101/api/categories | jq '.[] | "\(.id): \(.patternDescription)"'
```

## Performance Tips

1. **Validation**: Patterns compiled once at startup (~50ms)
2. **Caching**: Category dropdown cached in browser (5 sec)
3. **Batch validation**: Validate multiple values in single request
4. **Audit log**: Only returns last 100 entries (use filtering for older)
5. **Export check**: Done in O(n) where n=item count (usually <100)

## Next Steps

1. **Deploy**: Follow VAULT_V4_SECURITY.md production checklist
2. **Monitor**: Set up audit log monitoring/alerting
3. **Backup**: Implement daily encrypted backup of audit logs
4. **Audit**: Regular compliance audits of access patterns
5. **Upgrade**: Add database, authentication, encryption

---

**Quick Ref v1.0** | Last updated 2026-02-08
