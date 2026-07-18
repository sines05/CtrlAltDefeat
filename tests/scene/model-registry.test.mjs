import assert from 'node:assert/strict';
import test from 'node:test';

import { createModelRegistry } from '../../apps/web/src/media/model-registry.js';

const modelAsset = {
  assetId: 'guide-model',
  kind: 'model',
  format: 'fbx',
  loader: 'fbx',
  role: 'guide-model',
  publicPath: '/guide_girl/huongdanvien.fbx',
};

test('test_model_registry_loads_structured_manifest_model_by_format', async () => {
  const calls = [];
  const registry = createModelRegistry({ assets: [modelAsset] }, {
    loaders: {
      fbx: {
        async loadAsync(publicPath) {
          calls.push(publicPath);
          return { publicPath };
        },
      },
    },
  });

  assert.equal(registry.getAssetByRole('guide-model')?.format, 'fbx');
  assert.deepEqual(await registry.loadRole('guide-model'), { publicPath: modelAsset.publicPath });
  assert.deepEqual(calls, [modelAsset.publicPath]);
});
