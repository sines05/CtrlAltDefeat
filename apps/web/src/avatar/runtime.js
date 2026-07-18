import { getAvatarViewModel } from './state.js';

export const MESHOPT_DECODER_LOCATION = 'https://cdn.jsdelivr.net/npm/meshoptimizer/meshopt_decoder.js';

export function configureModelViewerMeshopt(targetWindow = window) {
  if (!targetWindow) {
    return false;
  }

  const registeredElement = targetWindow.customElements?.get?.('model-viewer') ?? null;

  if (registeredElement) {
    registeredElement.meshoptDecoderLocation = MESHOPT_DECODER_LOCATION;
    targetWindow.ModelViewerElement = registeredElement;
    return true;
  }

  targetWindow.ModelViewerElement = {
    ...(targetWindow.ModelViewerElement ?? {}),
    meshoptDecoderLocation: MESHOPT_DECODER_LOCATION,
  };
  return true;
}

export async function ensureAvatarRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  configureModelViewerMeshopt(window);

  if (window.customElements?.get('model-viewer')) {
    configureModelViewerMeshopt(window);
    return true;
  }

  try {
    await import('https://esm.sh/@google/model-viewer');
    configureModelViewerMeshopt(window);
    return true;
  } catch {
    return false;
  }
}

export async function loadAvatarViewModel(avatarId = 'cesium-man', options = {}) {
  try {
    return getAvatarViewModel(avatarId, options);
  } catch {
    return {
      status: 'error',
      title: avatarId === 'huongdanvien' ? 'Hướng dẫn viên' : 'CesiumMan',
      fallbackLabel: avatarId === 'huongdanvien' ? 'Static preview unavailable' : 'Avatar unavailable',
    };
  }
}
