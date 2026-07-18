import { getAvatarManifest } from './manifest.js';

export function createAvatarPlaybackState(manifest = getAvatarManifest()) {
  return {
    id: manifest.id,
    kind: manifest.kind,
    isAnimated: manifest.isAnimated,
    clipIndex: manifest.clipIndex,
    clipLabel: manifest.clipLabel,
    elapsedSeconds: 0,
    transform: {
      scale: [...manifest.transform.scale],
      rotation: [...manifest.transform.rotation],
      position: [...manifest.transform.position],
    },
  };
}

export function advanceAvatarPlayback(state, deltaSeconds) {
  if (!state.isAnimated) {
    return {
      ...state,
      transform: {
        scale: [...state.transform.scale],
        rotation: [...state.transform.rotation],
        position: [...state.transform.position],
      },
    };
  }

  return {
    ...state,
    elapsedSeconds: Number((state.elapsedSeconds + Math.max(deltaSeconds, 0)).toFixed(3)),
    transform: {
      scale: [...state.transform.scale],
      rotation: [...state.transform.rotation],
      position: [...state.transform.position],
    },
  };
}

export function getAvatarViewModel(avatarId = 'cesium-man', options = {}) {
  const manifest = getAvatarManifest(avatarId, options);
  const playback = advanceAvatarPlayback(createAvatarPlaybackState(manifest), 0.5);

  return {
    status: 'ready',
    id: manifest.id,
    kind: manifest.kind,
    title: manifest.title,
    src: `/${manifest.assetPath}`,
    isAnimated: manifest.isAnimated,
    clipIndex: playback.clipIndex,
    clipLabel: playback.clipLabel,
    elapsedSeconds: playback.elapsedSeconds,
    scaleLocked: manifest.scaleLocked,
    transform: playback.transform,
    fallbackLabel: manifest.isAnimated ? 'Avatar unavailable' : 'Static preview unavailable',
    licenseLabel: manifest.license.label,
  };
}
