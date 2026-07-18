import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { startServer } from '../../../services/api/src/server.js';

const repoRoot = new URL('../../..', import.meta.url);
const sceneId = 'tay-ho-giay-do-room-01';
const tourId = 'tour-01';

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot.pathname, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

test('test_scene_api_returns_approved_scene_config', async (t) => {
  const [source, signoff, tour] = await Promise.all([
    readJson('content/approved/sources/museum-room-01.json'),
    readJson('content/approved/signoffs/museum-room-01.json'),
    readJson('content/approved/tours/tour-01.json'),
  ]);
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${runtime.baseUrl}/api/scene/${sceneId}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.sceneId, source.sceneId);
  assert.equal(payload.title, source.title);
  assert.equal(payload.summary, source.summary);
  assert.equal(payload.roomScope, source.roomScope);
  assert.equal(payload.tourId, tour.tourId);
  assert.equal(payload.hotspots.length, signoff.reviewScope.chunkIds.length);
  assert.deepEqual(
    payload.hotspots.map((hotspot) => hotspot.hotspotId),
    signoff.reviewScope.chunkIds,
  );
});

test('test_tour_api_returns_exactly_five_steps', async (t) => {
  const tour = await readJson('content/approved/tours/tour-01.json');
  const runtime = await startServer({ host: '127.0.0.1', port: 0 });

  t.after(async () => {
    await runtime.stop();
  });

  const response = await fetch(`${runtime.baseUrl}/api/tour/${tourId}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.tourId, tour.tourId);
  assert.equal(payload.sceneId, tour.sceneId);
  assert.equal(payload.steps.length, 5);
  assert.deepEqual(
    payload.steps.map((step) => step.stepId),
    tour.steps.map((step) => step.stepId),
  );
  assert.deepEqual(
    payload.steps.map((step) => step.body),
    tour.steps.map((step) => step.body),
  );
});
