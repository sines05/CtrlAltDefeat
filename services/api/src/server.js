import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { createErrorResponse } from './http/errors.js';
import { answerLiveQuestion, getLiveQaCapability } from './live/index.js';
import { answerQuestion } from './qa/index.js';
import { getSceneConfig } from './scene/index.js';
import { synthesizeSpeech } from './tts/index.js';
import { getTourConfig } from './tour/index.js';

const MIME_TYPES = {
  '.glb': 'model/gltf-binary',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

function send(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'content-type': contentType,
  });
  response.end(body);
}

function sendJson(response, statusCode, body) {
  send(response, statusCode, JSON.stringify(body), 'application/json; charset=utf-8');
}

function createRequestError(statusCode, code, message, retryable = false) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  return error;
}

async function readJsonBody(request, { signal, maxBytes } = {}) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    if (signal?.aborted) {
      throw createRequestError(499, 'LIVE_QA_ABORTED', signal.reason?.message ?? 'Request aborted.', true);
    }

    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;

    if (maxBytes && totalBytes > maxBytes) {
      throw createRequestError(413, 'LIVE_QA_REQUEST_TOO_LARGE', 'Live request body is too large.', false);
    }

    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function resolveStaticCandidates(urlPath, webRoot, staticRoot) {
  const normalizedPath = decodeURIComponent(urlPath).endsWith('/')
    ? `${decodeURIComponent(urlPath)}index.html`
    : decodeURIComponent(urlPath);
  const relativePath = normalizedPath === '/' ? 'index.html' : normalizedPath.replace(/^\/+/, '');

  return [
    resolve(webRoot, relativePath),
    resolve(staticRoot, relativePath),
  ];
}

function isInsideRoot(filePath, root) {
  return filePath === root || filePath.startsWith(`${root}${sep}`);
}

async function serveStatic(request, response, { webRoot, staticRoot }) {
  const url = new URL(request.url, 'http://localhost');
  const candidates = resolveStaticCandidates(url.pathname, webRoot, staticRoot);
  const roots = [webRoot, staticRoot];

  for (const [index, candidate] of candidates.entries()) {
    const root = roots[index];

    if (!isInsideRoot(candidate, root)) {
      continue;
    }

    try {
      const details = await stat(candidate);

      if (!details.isFile()) {
        continue;
      }

      const contentType = MIME_TYPES[extname(candidate)] ?? 'application/octet-stream';
      const body = request.method === 'HEAD' ? '' : await readFile(candidate);
      send(response, 200, body, contentType);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

function getRouteTimeoutMs(env) {
  const parsed = Number(env.GEMINI_LIVE_ROUTE_TIMEOUT_MS ?? env.GEMINI_REQUEST_TIMEOUT_MS ?? 20000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20000;
}

function createRequestSignal(request, env) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort(
    createRequestError(499, 'LIVE_QA_ABORTED', 'Client disconnected.', true),
  );
  const timer = setTimeout(() => {
    controller.abort(
      createRequestError(499, 'LIVE_QA_ABORTED', `Live route timeout after ${getRouteTimeoutMs(env)}ms.`, true),
    );
  }, getRouteTimeoutMs(env));

  request.on('aborted', abortRequest);

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      request.off('aborted', abortRequest);
    },
  };
}

async function routeRequest(request, response, options) {
  const url = new URL(request.url, 'http://localhost');
  const sceneMatch = url.pathname.match(/^\/api\/scene\/([^/]+)$/);
  const tourMatch = url.pathname.match(/^\/api\/tour\/([^/]+)$/);

  if (request.method === 'GET' && url.pathname === '/api/health') {
    sendJson(response, 200, {
      ok: true,
      capabilities: {
        qaLiveVoice: getLiveQaCapability(options.env),
      },
    });
    return;
  }

  if (request.method === 'GET' && sceneMatch) {
    const scene = await getSceneConfig(sceneMatch[1]);

    if (!scene) {
      sendJson(
        response,
        404,
        createErrorResponse('SCENE_NOT_FOUND', 'Scene not found.', false),
      );
      return;
    }

    sendJson(response, 200, scene);
    return;
  }

  if (request.method === 'GET' && tourMatch) {
    const tour = await getTourConfig(tourMatch[1]);

    if (!tour) {
      sendJson(
        response,
        404,
        createErrorResponse('TOUR_NOT_FOUND', 'Tour not found.', false),
      );
      return;
    }

    sendJson(response, 200, tour);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa') {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await answerQuestion(payload));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/tts') {
    const payload = await readJsonBody(request);
    sendJson(response, 200, await synthesizeSpeech(payload));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/qa/live') {
    const requestControl = createRequestSignal(request, options.env);

    try {
      const payload = await readJsonBody(request, {
        signal: requestControl.signal,
        // ponytail: transport cap slightly above decoded-audio limit; tighten only if uploads become abusive.
        maxBytes: 8_000_000,
      });
      const result = await answerLiveQuestion({
        payload,
        env: options.env,
        signal: requestControl.signal,
        liveProviderFactory: options.liveProviderFactory,
      });
      sendJson(response, result.status, result.body);
    } finally {
      requestControl.cleanup();
    }
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    const served = await serveStatic(request, response, options);

    if (served) {
      return;
    }
  }

  sendJson(
    response,
    404,
    createErrorResponse('ROUTE_NOT_FOUND', 'Not found.', false),
  );
}

function listen(server, host, port) {
  return new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolveReady();
    });
  });
}

function close(server) {
  return new Promise((resolveClosed, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClosed();
    });
  });
}

export async function startServer({
  host = '127.0.0.1',
  port = 0,
  staticRoot = process.cwd(),
  webRoot = resolve(staticRoot, 'apps/web'),
  env = process.env,
  liveProviderFactory,
} = {}) {
  const server = createServer((request, response) => {
    void routeRequest(request, response, {
      staticRoot,
      webRoot,
      env,
      liveProviderFactory,
    }).catch((error) => {
      const isSyntaxError = error instanceof SyntaxError;
      const message = isSyntaxError
        ? 'Malformed JSON body.'
        : error instanceof Error
          ? error.message
          : 'Internal server error.';
      const code = isSyntaxError
        ? 'BAD_REQUEST'
        : error?.code ?? 'SERVER_ERROR';
      const statusCode = isSyntaxError
        ? 400
        : error?.statusCode ?? 500;

      sendJson(response, statusCode, createErrorResponse(code, message, Boolean(error?.retryable)));
    });
  });

  await listen(server, host, port);
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind to a TCP port.');
  }

  return {
    baseUrl: `http://${host}:${address.port}`,
    stop: () => close(server),
  };
}
