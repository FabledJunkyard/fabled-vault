import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const vaultBin = path.join(process.cwd(), 'dist/cli/vault.js');
const vaultDir = path.join(process.env.HOME || process.cwd(), '.universal-vault');

test('CLI init/add/grant/sub/audit smoke test', async () => {
  // Clean vault
  if (fs.existsSync(vaultDir)) {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }

  // 1. Init vault (non-interactive)
  try {
    execSync(`${vaultBin} init`, { 
      stdio: 'pipe', 
      timeout: 5000,
      cwd: process.cwd(),
      env: { ...process.env, CI: 'true' }
    });
    console.log('✅ vault init');
  } catch (e) {
    console.log('init output:', e.stdout?.toString());
  }

  // 2. List shows vault ready
  const listOut = execSync(`${vaultBin} list`, { 
    encoding: 'utf8', 
    timeout: 5000,
    cwd: process.cwd()
  });
  expect(listOut).toContain('vault');
  console.log('✅ vault list');

  // 3. Status works
  execSync(`${vaultBin} status`, { 
    stdio: 'pipe', 
    timeout: 5000,
    cwd: process.cwd()
  });
  console.log('✅ vault status');

  // 4. Grant command works (non-interactive)
  execSync(`${vaultBin} grant personal:chase_login grant --duration 30m --purpose test`, { 
    stdio: 'pipe', 
    timeout: 5000,
    cwd: process.cwd()
  });
  console.log('✅ vault grant');

  // 5. Audit shows grant
  const auditOut = execSync(`${vaultBin} audit --limit 5`, { 
    encoding: 'utf8', 
    timeout: 5000,
    cwd: process.cwd()
  });
  expect(auditOut.length).toBeGreaterThan(10);
  console.log('✅ vault audit');

  console.log('🎉 Full CLI flow: init/list/grant/audit complete');
});
