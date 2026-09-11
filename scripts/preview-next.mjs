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
const previewCheckPaths = (process.env.PREVIEW_CHECK_PATHS || '/path')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const previewVerifyTimeoutMs = Number(process.env.PREVIEW_VERIFY_TIMEOUT_MS || 90_000);

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

function previewUrl(routePath = '/') {
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `http://${host}:${port}${normalizedPath}`;
}

function extractStylesheetUrls(html, baseUrl) {
  const urls = new Set();
  const linkPattern = /<link\b[^>]*\bhref=(["'])(.*?)\1[^>]*>/gi;
  let match = linkPattern.exec(html);

  while (match) {
    const fullTag = match[0];
    const href = match[2];
    const isStylesheet = /\brel=(["'])stylesheet\1/i.test(fullTag);
    const isCssAsset = /\/_next\/static\/css\/|\.css(?:\?|$)/i.test(href);
    if (isStylesheet || isCssAsset) {
      urls.add(new URL(href, baseUrl).toString());
    }
    match = linkPattern.exec(html);
  }

  return Array.from(urls);
}

async function verifyStyledRoute(routePath) {
  const routeUrl = previewUrl(routePath);
  const htmlResponse = await fetch(routeUrl, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!htmlResponse.ok) {
    throw new Error(`${routeUrl} returned ${htmlResponse.status}`);
  }

  const html = await htmlResponse.text();
  const stylesheetUrls = extractStylesheetUrls(html, routeUrl);
  if (stylesheetUrls.length === 0) {
    throw new Error(`${routeUrl} did not include stylesheet links`);
  }

  for (const stylesheetUrl of stylesheetUrls) {
    const cssResponse = await fetch(stylesheetUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    if (!cssResponse.ok) {
      throw new Error(`${stylesheetUrl} returned ${cssResponse.status}`);
    }
    const cssText = await cssResponse.text();
    if (cssText.trim().length < 100) {
      throw new Error(`${stylesheetUrl} returned an unexpectedly small stylesheet`);
    }
  }

  return { routeUrl, stylesheetCount: stylesheetUrls.length };
}

async function waitForStyledPreview() {
  const deadline = Date.now() + previewVerifyTimeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const results = [];
      for (const routePath of previewCheckPaths) {
        results.push(await verifyStyledRoute(routePath));
      }
      results.forEach((result) => {
        console.log(`[preview] verified styles for ${result.routeUrl} (${result.stylesheetCount} CSS asset${result.stylesheetCount === 1 ? '' : 's'})`);
      });
      return;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }

  throw lastError || new Error('preview style verification timed out');
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

void waitForStyledPreview().catch((error) => {
  console.error(`[preview] style verification failed: ${error instanceof Error ? error.message : String(error)}`);
  child.kill('TERM');
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
