import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { adaptMediaManifest } from '../../apps/web/src/media/manifest-adapter.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

test('test_manifest_adapter_builds_ten_process_stations_from_media_manifest', async () => {
  const manifest = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const mediaState = adaptMediaManifest(manifest);

  assert.equal(mediaState.status, 'ready');
  assert.equal(mediaState.stations.length, 10);
  assert.equal(mediaState.stations[0].order, 1);
  assert.match(mediaState.stations[0].videoUrl ?? '', /Buoc1_/u);
  assert.equal(mediaState.stations[9].order, 10);
  assert.match(mediaState.stations[9].videoUrl ?? '', /Buoc10_/u);
  assert.ok(mediaState.stations.every((station) => typeof station.title === 'string' && station.title.length > 0));
  assert.ok(mediaState.stations.every((station) => typeof station.narration === 'string' && station.narration.length > 0));
});

test('test_exhibition_wall_source_no_longer_discovers_media_or_owns_catalog_copy', async () => {
  const source = await readFile(
    path.join(repoRoot, 'apps/web/src/components/ExhibitionWall/ExhibitionWall.js'),
    'utf8',
  );

  assert.doesNotMatch(source, /import\.meta\.glob\(/u);
  assert.doesNotMatch(source, /PAPERMAKING_STEPS/u);
  assert.match(source, /stationViewModels/u);
});
