const avatarCatalog = {
  'cesium-man': {
    id: 'cesium-man',
    kind: 'animated',
    title: 'CesiumMan',
    assetPath: 'assets/avatar/cesium-man.glb',
    clipIndex: 0,
    clipLabel: 'Clip 1',
    isAnimated: true,
    scaleLocked: true,
    transform: {
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      position: [0, 0, 0],
    },
    source: {
      url: '/assets/avatar/cesium-man.glb',
      attribution: 'User-supplied local GLB',
    },
    license: {
      spdxLike: 'CC-BY-4.0',
      label: 'CC-BY 4.0 International with Trademark Limitations',
    },
  },
  huongdanvien: {
    id: 'huongdanvien',
    kind: 'static-preview',
    title: 'Hướng dẫn viên',
    assetPath: 'assets/avatar/huongdanvien.glb',
    clipIndex: null,
    clipLabel: null,
    isAnimated: false,
    scaleLocked: true,
    transform: {
      scale: [1, 1, 1],
      rotation: [0, 0, 0],
      position: [0, 0, 0],
    },
    source: {
      url: '/assets/avatar/huongdanvien.glb',
      attribution: 'User-supplied local GLB',
    },
    license: {
      spdxLike: 'UNKNOWN',
      label: 'User-supplied preview asset',
    },
  },
};

function cloneManifest(manifest) {
  return {
    ...manifest,
    transform: {
      ...manifest.transform,
      scale: [...manifest.transform.scale],
      rotation: [...manifest.transform.rotation],
      position: [...manifest.transform.position],
    },
    source: { ...manifest.source },
    license: { ...manifest.license },
  };
}

function selectMediaAvatarAsset(mediaManifest, avatarId) {
  const assets = [
    ...(mediaManifest?.assets ?? []),
    ...((mediaManifest?.glb ?? []).map((publicPath) => ({ publicPath, kind: 'glb' }))),
  ];

  const fileName = avatarId === 'huongdanvien' ? 'huongdanvien.glb' : 'cesium-man.glb';
  return assets.find((asset) => typeof asset.publicPath === 'string' && asset.publicPath.endsWith(fileName)) ?? null;
}

export function getAvatarManifest(avatarId = 'cesium-man', { mediaManifest } = {}) {
  const base = cloneManifest(avatarCatalog[avatarId] ?? avatarCatalog['cesium-man']);
  const mediaAsset = mediaManifest ? selectMediaAvatarAsset(mediaManifest, avatarId) : null;

  if (!mediaAsset) {
    return base;
  }

  return {
    ...base,
    assetPath: mediaAsset.publicPath.replace(/^\//u, ''),
    source: {
      ...base.source,
      url: mediaAsset.publicPath,
    },
  };
}

export function listAvatarManifests(options = {}) {
  return Object.keys(avatarCatalog).map((avatarId) => getAvatarManifest(avatarId, options));
}
