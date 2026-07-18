import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

function loadDotEnv(filePath = resolve(repoRoot, '.env')) {
  try {
    const contents = readFileSync(filePath, 'utf8');

    for (const rawLine of contents.split(/\r?\n/u)) {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        continue;
      }

      const separator = line.indexOf('=');
      if (separator < 0) {
        continue;
      }

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();

      if (!key || process.env[key]) {
        continue;
      }

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  } catch {
    // ponytail: optional local env file, runtime still works with shell-exported vars.
  }
}

loadDotEnv();

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

process.chdir(repoRoot);

const { startServer } = await import('../services/api/src/server.js');
const runtime = await startServer({
  host,
  port,
  staticRoot: repoRoot,
  webRoot: resolve(repoRoot, 'apps/web'),
});

console.log(`App running at ${runtime.baseUrl}`);

async function stop() {
  await runtime.stop();
  process.exit(0);
}

process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
