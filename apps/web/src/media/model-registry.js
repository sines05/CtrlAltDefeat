import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const DEFAULT_LOADER_CACHE = {
  fbx: new FBXLoader(),
};

function createDefaultLoaders() {
  return {
    fbx: {
      loadAsync(publicPath) {
        return DEFAULT_LOADER_CACHE.fbx.loadAsync(publicPath);
      },
    },
    glb: {
      async loadAsync(publicPath) {
        return publicPath;
      },
    },
  };
}

export function createModelRegistry(mediaState, { loaders = createDefaultLoaders() } = {}) {
  const modelAssets = (mediaState?.assets ?? []).filter((asset) => asset.kind === 'fbx' || asset.kind === 'glb');
  const assetRecords = new Map(
    modelAssets.map((asset) => [asset.assetId, { ...asset, promise: null, error: null }]),
  );
  const roleIndex = new Map(
    modelAssets
      .filter((asset) => typeof asset.role === 'string' && asset.role.length > 0)
      .map((asset) => [asset.role, asset.assetId]),
  );

  function getAsset(assetId) {
    const asset = assetRecords.get(assetId);
    if (!asset) {
      return null;
    }

    const { promise, error, ...metadata } = asset;
    return { ...metadata, error };
  }

  function getAssetByRole(role) {
    const assetId = roleIndex.get(role);
    return assetId ? getAsset(assetId) : null;
  }

  async function loadAsset(assetId) {
    const asset = assetRecords.get(assetId);
    if (!asset) {
      throw new Error(`Unknown media asset: ${assetId}`);
    }

    if (asset.promise) {
      return asset.promise;
    }

    const loader = loaders[asset.kind];
    if (!loader || typeof loader.loadAsync !== 'function') {
      throw new Error(`No loader configured for asset kind: ${asset.kind}`);
    }

    asset.promise = Promise.resolve()
      .then(() => loader.loadAsync(asset.publicPath))
      .catch((error) => {
        asset.error = error;
        asset.promise = null;
        throw error;
      });

    return asset.promise;
  }

  async function loadRole(role) {
    const assetId = roleIndex.get(role);
    if (!assetId) {
      throw new Error(`Unknown media role: ${role}`);
    }

    return loadAsset(assetId);
  }

  return {
    listRoles() {
      return [...roleIndex.keys()];
    },
    getAsset,
    getAssetByRole,
    loadAsset,
    loadRole,
  };
}
