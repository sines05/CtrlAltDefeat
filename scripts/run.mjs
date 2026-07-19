import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer as createViteServer } from 'vite';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appRoot = resolve(repoRoot, 'apps/web');
const mountedStaticRoots = [
  {
    mountPath: '/assets/avatar',
    root: resolve(repoRoot, 'assets/avatar'),
  },
  {
    mountPath: '/asset',
    root: resolve(appRoot, 'asset'),
  },
  {
    mountPath: '/guide_girl',
    root: resolve(appRoot, 'guide_girl'),
  },
  {
    mountPath: '/making_step',
    root: resolve(appRoot, 'making_step'),
  },
  {
    mountPath: '/audio',
    root: resolve(appRoot, 'audio'),
  },
];
const mimeTypes = {
  '.fbx': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

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

function isInsideRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}${sep}`);
}

function mountedStaticPlugin(entries) {
  async function serve(request, response, next) {
    if (!request.url || (request.method !== 'GET' && request.method !== 'HEAD')) {
      next();
      return;
    }

    const url = new URL(request.url, 'http://localhost');

    for (const entry of entries) {
      if (!url.pathname.startsWith(`${entry.mountPath}/`)) {
        continue;
      }

      const relativePath = decodeURIComponent(url.pathname.slice(entry.mountPath.length)).replace(/^\/+/, '');
      const filePath = resolve(entry.root, relativePath);

      if (!isInsideRoot(filePath, entry.root)) {
        response.statusCode = 403;
        response.end('Forbidden');
        return;
      }

      try {
        const details = await stat(filePath);

        if (!details.isFile()) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('content-type', mimeTypes[extname(filePath)] ?? 'application/octet-stream');
        response.end(request.method === 'HEAD' ? '' : await readFile(filePath));
        return;
      } catch {
        next();
        return;
      }
    }

    next();
  }

  return {
    name: 'mounted-static-roots',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        void serve(request, response, next);
      });
    },
  };
}

loadDotEnv();

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

process.chdir(repoRoot);

const { startServer } = await import('../services/api/src/server.js');
const apiRuntime = await startServer({
  host,
  port: 0,
  staticRoot: repoRoot,
  webRoot: appRoot,
});
const viteServer = await createViteServer({
  root: appRoot,
  publicDir: false,
  base: '/',
  appType: 'spa',
  logLevel: 'error',
  plugins: [mountedStaticPlugin(mountedStaticRoots)],
  server: {
    host,
    port,
    strictPort: true,
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      '/api': {
        target: apiRuntime.baseUrl,
      },
    },
  },
});

await viteServer.listen();

const baseUrl = viteServer.resolvedUrls?.local?.[0] ?? `http://${host}:${port}`;
console.log(`App running at ${baseUrl}`);

let stopping = false;

async function stop() {
  if (stopping) {
    return;
  }

  stopping = true;

  try {
    await viteServer.close();
  } finally {
    await apiRuntime.stop();
  }

  process.exit(0);
}

process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
