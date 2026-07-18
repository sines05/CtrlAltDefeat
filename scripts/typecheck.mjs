import assert from 'node:assert/strict';

const [{ startServer }, { createErrorResponse }] = await Promise.all([
  import('../services/api/src/server.js'),
  import('../services/api/src/http/errors.js'),
]);

assert.equal(typeof startServer, 'function');
assert.equal(typeof createErrorResponse, 'function');
