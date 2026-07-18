import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

async function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        reject(new Error('Failed to reserve a TCP port.'));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

async function waitForBaseUrl(child, { timeoutMs = 30000 } = {}) {
  let output = '';

  return new Promise((resolveBaseUrl, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for app startup. Output:\n${output}`));
    }, timeoutMs);

    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/App running at (http:\/\/127\.0\.0\.1:\d+)/u);

      if (match) {
        clearTimeout(timer);
        child.stdout.off('data', onData);
        child.stderr.off('data', onData);
        resolveBaseUrl(match[1]);
      }
    };

    const onExit = (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`App exited before startup (code=${code}, signal=${signal}). Output:\n${output}`));
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', onExit);
  }).finally(() => {
    child.removeAllListeners('exit');
  });
}

test('test_browser_bootstrap_smoke', async (t) => {
  const port = await reservePort();
  const child = spawn('node', ['./scripts/run.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  t.after(async () => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit').catch(() => {});
    }
  });

  const baseUrl = await waitForBaseUrl(child);
  const [rootResponse, mainResponse, wallResponse, avatarResponse] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/src/main.js`),
    fetch(`${baseUrl}/src/components/ExhibitionWall/ExhibitionWall.js`),
    fetch(`${baseUrl}/assets/avatar/README.md`),
  ]);

  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.headers.get('content-type') ?? '', /text\/html/);

  assert.equal(mainResponse.status, 200);
  assert.match(mainResponse.headers.get('content-type') ?? '', /javascript/);
  const mainSource = await mainResponse.text();
  assert.doesNotMatch(mainSource, /from ['"]three['"]/);
  assert.match(mainSource, /node_modules\/\.vite\/deps\/three/u);

  assert.equal(wallResponse.status, 200);
  const wallSource = await wallResponse.text();
  assert.doesNotMatch(wallSource, /import\.meta\.glob\(/);

  assert.equal(avatarResponse.status, 200);
  assert.ok((await avatarResponse.text()).includes('avatar'));
});
