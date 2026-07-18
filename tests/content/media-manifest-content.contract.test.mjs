import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const contents = await readFile(absolutePath, 'utf8');
  return JSON.parse(contents);
}

test('test_media_manifest_content_contract', async () => {
  const manifest = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const allMediaPaths = [...manifest.fbx, ...manifest.glb, ...manifest.mp4];

  assert.equal(manifest.sceneId, 'tay-ho-giay-do-room-01');
  assert.deepEqual(Object.keys(manifest).sort(), ['fbx', 'glb', 'mp4', 'sceneId']);
  assert.equal(manifest.fbx.length, 11);
  assert.equal(manifest.glb.length, 2);
  assert.equal(manifest.mp4.length, 10);
  assert.equal(new Set(allMediaPaths).size, allMediaPaths.length);
  assert.ok(manifest.fbx.every((mediaPath) => mediaPath.startsWith('/') && mediaPath.endsWith('.fbx')));
  assert.ok(manifest.glb.every((mediaPath) => mediaPath.startsWith('/') && mediaPath.endsWith('.glb')));
  assert.ok(manifest.mp4.every((mediaPath) => mediaPath.startsWith('/') && mediaPath.endsWith('.mp4')));
  assert.ok(allMediaPaths.every((mediaPath) => !/\.(?:jpe?g|png)$/iu.test(mediaPath)));
});
