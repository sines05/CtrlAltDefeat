import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { getAvatarManifest } from '../../apps/web/src/avatar/manifest.js';
import { getAvatarViewModel } from '../../apps/web/src/avatar/state.js';
import { loadAvatarViewModel } from '../../apps/web/src/avatar/runtime.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

test('test_avatar_manifest_accepts_backend_media_manifest_metadata', async () => {
  const mediaManifest = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const animated = getAvatarManifest('cesium-man', { mediaManifest });
  const preview = getAvatarManifest('huongdanvien', { mediaManifest });

  assert.equal(animated.assetPath, 'assets/avatar/cesium-man.glb');
  assert.equal(preview.assetPath, 'assets/avatar/huongdanvien.glb');
  assert.match(animated.source.url, /cesium-man\.glb$/u);
  assert.match(preview.source.url, /huongdanvien\.glb$/u);
});

test('test_avatar_view_model_prefers_media_manifest_when_available', async () => {
  const mediaManifest = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const animated = getAvatarViewModel('cesium-man', { mediaManifest });
  const preview = await loadAvatarViewModel('huongdanvien', { mediaManifest });

  assert.equal(animated.status, 'ready');
  assert.equal(animated.src, '/assets/avatar/cesium-man.glb');
  assert.equal(preview.status, 'ready');
  assert.equal(preview.src, '/assets/avatar/huongdanvien.glb');
});
