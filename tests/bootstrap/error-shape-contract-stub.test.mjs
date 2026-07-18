import assert from 'node:assert/strict';
import test from 'node:test';

import { startServer } from '../../services/api/src/server.js';

test('test_error_shape_contract_stub', async (t) => {
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${runtime.baseUrl}/api/missing`);
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.deepEqual(Object.keys(payload), ['error']);
  assert.equal(typeof payload.error.code, 'string');
  assert.equal(typeof payload.error.message, 'string');
  assert.equal(typeof payload.error.retryable, 'boolean');
  assert.equal(typeof payload.error.traceId, 'string');
});
