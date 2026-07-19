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

test('test_model_registry_deduplicates_concurrent_role_loads', async () => {
  let resolveLoad;
  let loadCount = 0;
  const registry = createModelRegistry({ assets: [modelAsset] }, {
    loaders: {
      fbx: {
        loadAsync() {
          loadCount += 1;
          return new Promise((resolve) => { resolveLoad = resolve; });
        },
      },
    },
  });

  const firstLoad = registry.loadRole('guide-model');
  const secondLoad = registry.loadRole('guide-model');
  await Promise.resolve();
  resolveLoad({ ready: true });

  assert.deepEqual(await Promise.all([firstLoad, secondLoad]), [{ ready: true }, { ready: true }]);
  assert.equal(loadCount, 1);
});

test('test_model_registry_retries_after_failed_preload', async () => {
  let loadCount = 0;
  const registry = createModelRegistry({ assets: [modelAsset] }, {
    loaders: {
      fbx: {
        async loadAsync() {
          loadCount += 1;
          if (loadCount === 1) {
            throw new Error('temporary preload failure');
          }
          return { recovered: true };
        },
      },
    },
  });

  await assert.rejects(registry.loadRole('guide-model'), /temporary preload failure/);
  assert.deepEqual(await registry.loadRole('guide-model'), { recovered: true });
  assert.equal(loadCount, 2);
});
