import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { getAvatarManifest } from '../../apps/web/src/avatar/manifest.js';
import { configureModelViewerMeshopt, MESHOPT_DECODER_LOCATION } from '../../apps/web/src/avatar/runtime.js';
import { getAvatarViewModel, createAvatarPlaybackState, advanceAvatarPlayback } from '../../apps/web/src/avatar/state.js';
import { createSceneAppHtml } from '../../apps/web/src/scene/app.js';
import { getSceneConfig } from '../../services/api/src/scene/index.js';
import { getTourConfig } from '../../services/api/src/tour/index.js';

const repoRoot = '/home/anoreo/Desktop/CtrlAltDefeat';

test('test_static_preview_manifest_exists', async () => {
  const manifest = getAvatarManifest('huongdanvien');
  const assetStats = await stat(path.join(repoRoot, manifest.assetPath));

  assert.ok(assetStats.size > 0);
  assert.equal(manifest.kind, 'static-preview');
  assert.equal(manifest.assetPath, 'assets/avatar/huongdanvien.glb');
  assert.equal(manifest.clipIndex, null);
  assert.equal(manifest.isAnimated, false);
});

test('test_static_preview_playback_stays_static', () => {
  const manifest = getAvatarManifest('huongdanvien');
  const initialState = createAvatarPlaybackState(manifest);
  const nextState = advanceAvatarPlayback(initialState, 0.5);

  assert.equal(nextState.elapsedSeconds, initialState.elapsedSeconds);
  assert.equal(nextState.isAnimated, false);
});

test('test_static_preview_renders_without_autoplay', async () => {
  const [scene, tour] = await Promise.all([
    getSceneConfig('tay-ho-giay-do-room-01'),
    getTourConfig('tour-01'),
  ]);
  const avatar = getAvatarViewModel('huongdanvien');
  const html = createSceneAppHtml({
    scene,
    tour,
    hasWebGL: true,
    avatar,
    hasAvatarRuntime: true,
    interactionState: {},
  });

  assert.match(html, /data-avatar-kind="static-preview"/);
  assert.match(html, /huongdanvien\.glb/);
  assert.doesNotMatch(html, /autoplay/);
  assert.match(html, /Static preview/);
});

test('test_static_preview_configures_meshopt_decoder_location', () => {
  const targetWindow = {
    customElements: {
      get() {
        return null;
      },
    },
  };

  assert.equal(configureModelViewerMeshopt(targetWindow), true);
  assert.equal(targetWindow.ModelViewerElement.meshoptDecoderLocation, MESHOPT_DECODER_LOCATION);
});
