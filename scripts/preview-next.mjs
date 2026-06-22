#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = process.env.PORT || '3000';
const host = process.env.HOST || '127.0.0.1';
const extraPorts = ['3000', '3001'];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
    shell: false,
  });
}

function stopPort(portNumber) {
  const result = run('lsof', ['-ti', `tcp:${portNumber}`]);
  const pids = result.stdout
    .split(/\s+/)
    .map((pid) => pid.trim())
    .filter(Boolean);

  for (const pid of pids) {
    const killResult = run('kill', ['-TERM', pid]);
    if (killResult.status === 0) {
      console.log(`[preview] stopped process ${pid} on port ${portNumber}`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clearNextCache() {
  const nextDir = path.join(root, '.next');
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      if (!existsSync(nextDir)) {
        console.log('[preview] cleared .next cache');
        return;
      }
    } catch (error) {
      if (attempt === 6) throw error;
    }
    await sleep(250 * attempt);
  }
  console.log('[preview] cleared .next cache');
}

for (const portNumber of Array.from(new Set([port, ...extraPorts]))) {
  stopPort(portNumber);
}

await clearNextCache();

const child = spawn(
  'npx',
  ['next', 'dev', '--hostname', host, '--port', port],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
