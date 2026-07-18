import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(await readFile(absolutePath, 'utf8'));
}

function resolvePublicAsset(publicPath) {
  return publicPath.startsWith('/assets/')
    ? path.join(repoRoot, publicPath)
    : path.join(repoRoot, 'apps/web', publicPath);
}

test('test_media_manifest_content_contract', async () => {
  const manifest = await readJson('content/approved/media/tay-ho-giay-do-room-01.json');
  const assetsById = new Map(manifest.assets.map((asset) => [asset.assetId, asset]));

  assert.equal(manifest.manifestId, 'scene-media-01');
  assert.equal(manifest.sceneId, 'tay-ho-giay-do-room-01');
  assert.equal(manifest.status, 'approved');
  assert.equal(manifest.version, 1);
  assert.equal(manifest.assets.length, 23);
  assert.equal(manifest.processStations.length, 10);
  assert.equal(manifest.assets.filter((asset) => asset.format === 'fbx').length, 11);
  assert.equal(manifest.assets.filter((asset) => asset.format === 'glb').length, 2);
  assert.equal(manifest.assets.filter((asset) => asset.format === 'mp4').length, 10);

  for (const asset of manifest.assets) {
    assert.ok(['model', 'video'].includes(asset.kind));
    assert.ok(asset.publicPath.startsWith('/'));
    assert.ok(asset.byteLength > 0);
    assert.doesNotMatch(asset.publicPath, /\.(?:jpe?g|png)$/iu);
    const details = await stat(resolvePublicAsset(asset.publicPath));
    assert.equal(details.size, asset.byteLength);
  }

  for (const [index, station] of manifest.processStations.entries()) {
    assert.equal(station.order, index + 1);
    assert.ok(station.title.length > 0);
    assert.ok(station.narration.length > 0);
    assert.equal(assetsById.get(station.assetId)?.format, 'mp4');
  }
});
