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
      url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb',
      attribution: '© 2017 Cesium',
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

export function getAvatarManifest(avatarId = 'cesium-man') {
  return cloneManifest(avatarCatalog[avatarId] ?? avatarCatalog['cesium-man']);
}

export function listAvatarManifests() {
  return Object.values(avatarCatalog).map(cloneManifest);
}
