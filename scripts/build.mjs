import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const buildDir = resolve(root, 'build');
const buildRunScript = `import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const buildRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));

function loadDotEnv(filePath = resolve(buildRoot, '.env')) {
  try {
    const contents = readFileSync(filePath, 'utf8');

    for (const rawLine of contents.split(/\\r?\\n/u)) {
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

process.chdir(buildRoot);

const { startServer } = await import('./api/src/server.js');
const runtime = await startServer({
  host,
  port,
  staticRoot: buildRoot,
  webRoot: resolve(buildRoot, 'web'),
});

console.log('App running at ' + runtime.baseUrl);

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
`;

await rm(buildDir, { recursive: true, force: true });
await mkdir(buildDir, { recursive: true });
await cp(resolve(root, 'apps/web'), resolve(buildDir, 'web'), { recursive: true });
await cp(resolve(root, 'services/api/src'), resolve(buildDir, 'api/src'), { recursive: true });
await cp(resolve(root, 'content/approved'), resolve(buildDir, 'content/approved'), { recursive: true });
await cp(resolve(root, 'assets/avatar'), resolve(buildDir, 'assets/avatar'), { recursive: true });
await writeFile(
  resolve(buildDir, 'manifest.json'),
  JSON.stringify({
    stack: 'node-http',
    web: 'web',
    api: 'api/src',
    content: 'content/approved',
    run: 'run.mjs',
  }, null, 2) + '\n',
);
await writeFile(
  resolve(buildDir, 'package.json'),
  JSON.stringify({
    name: 'ctrlaltdfeat-museum-mvp-build',
    private: true,
    type: 'module',
  }, null, 2) + '\n',
);
await writeFile(resolve(buildDir, 'run.mjs'), buildRunScript);
