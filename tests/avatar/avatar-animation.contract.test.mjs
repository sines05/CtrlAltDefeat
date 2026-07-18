import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { getAvatarManifest } from '../../apps/web/src/avatar/manifest.js';
import { createAvatarPlaybackState, advanceAvatarPlayback } from '../../apps/web/src/avatar/state.js';
import { createSceneAppHtml } from '../../apps/web/src/scene/app.js';

const repoRoot = '/home/sonnq6/CtrlAltDefeat';

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), 'utf8'));
}

async function readGlbMetadata(relativePath) {
  const buffer = await readFile(path.join(repoRoot, relativePath));
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.toString('utf8', 16, 20);

  assert.equal(jsonChunkType, 'JSON');

  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonChunkLength));
  return {
    animations: (json.animations ?? []).map((animation) => animation.name ?? null),
  };
}

async function loadSceneFixture() {
  const [source, tour, hotspot01, hotspot02, hotspot03, hotspot04, hotspot05] = await Promise.all([
    readJson('content/approved/sources/museum-room-01.json'),
    readJson('content/approved/tours/tour-01.json'),
    readJson('content/approved/chunks/hotspot-01.json'),
    readJson('content/approved/chunks/hotspot-02.json'),
    readJson('content/approved/chunks/hotspot-03.json'),
    readJson('content/approved/chunks/hotspot-04.json'),
    readJson('content/approved/chunks/hotspot-05.json'),
  ]);

  return {
    scene: {
      sceneId: source.sceneId,
      title: source.title,
      summary: source.summary,
      roomScope: source.roomScope,
      tourId: tour.tourId,
      hotspots: [hotspot01, hotspot02, hotspot03, hotspot04, hotspot05].map((hotspot, index) => ({
        hotspotId: hotspot.chunkId,
        title: hotspot.title,
        body: hotspot.text,
        citation: hotspot.citation,
        position: {
          x: 18 + index * 16,
          y: 28 + (index % 2) * 18,
        },
      })),
    },
    tour: {
      tourId: tour.tourId,
      title: tour.title,
      sceneId: tour.sceneId,
      steps: tour.steps,
    },
  };
}

test('test_avatar_asset_manifest_exists', async () => {
  const manifest = getAvatarManifest();
  const assetStats = await stat(path.join(repoRoot, manifest.assetPath));

  assert.ok(assetStats.size > 0);
  assert.equal(manifest.assetPath, 'assets/avatar/cesium-man.glb');
  assert.equal(manifest.license.spdxLike, 'CC-BY-4.0');
  assert.match(manifest.source.url, /CesiumMan\.glb$/);
});

test('test_avatar_animation_clip_advances', async () => {
  const manifest = getAvatarManifest();
  const metadata = await readGlbMetadata(manifest.assetPath);
  const initialState = createAvatarPlaybackState(manifest);
  const nextState = advanceAvatarPlayback(initialState, 0.5);

  assert.ok(metadata.animations.length > manifest.clipIndex);
  assert.equal(nextState.clipIndex, manifest.clipIndex);
  assert.equal(nextState.clipLabel, manifest.clipLabel);
  assert.ok(nextState.elapsedSeconds > initialState.elapsedSeconds);
});

test('test_avatar_scale_is_locked', () => {
  const manifest = getAvatarManifest();
  const state = createAvatarPlaybackState(manifest);

  assert.equal(manifest.scaleLocked, true);
  assert.deepEqual(manifest.transform.scale, [1, 1, 1]);
  assert.deepEqual(state.transform.scale, [1, 1, 1]);
});

test('test_avatar_failure_degrades_to_scene_only', async () => {
  const { scene, tour } = await loadSceneFixture();
  const html = createSceneAppHtml({
    scene,
    tour,
    hasWebGL: true,
    avatar: {
      status: 'error',
      title: 'CesiumMan',
      fallbackLabel: 'Avatar unavailable',
    },
    hasAvatarRuntime: false,
  });

  assert.match(html, /data-mode="scene"/);
  assert.match(html, /Avatar unavailable/);
  assert.match(html, /room-shell/);
  assert.doesNotMatch(html, /TypeError|ReferenceError/);
});
