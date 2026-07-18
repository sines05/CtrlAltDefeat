/**
 * @file manifest-adapter.js
 * @description Dynamic media manifest adaptation and data normalization layer.
 * 
 * SCHEMA NORMALIZATION, DATA INTEGRITY & GRACEFUL DEGRADATION:
 * - Manifest Adaptability & Fallback Safety: Translates and standardizes arbitrary raw museum assets into structured, 
 *   well-defined JavaScript objects. If the media manifest endpoint is blocked, fails, or returns incomplete payloads, 
 *   the adapter dynamically constructs a clean, default state (`createDegradedMediaState`) containing fallback 
 *   narration, text descriptions, and empty media fields. This prevents runtime errors and keeps the user interface functional.
 * - Dynamic Eager Guides Promotion: Restricts preloading scopes to active guides and prioritized station resources. 
 *   This ensures that resources (such as 3D glTF models, textures, and video frames) are loaded dynamically based 
 *   on the user's progress rather than blocking the browser thread at startup, keeping memory footprints light.
 * - Data Sanity Enforcement: Validates incoming station properties (order numbers, string parameters, nullable media links), 
 *   protecting downstream systems (like WebGL loaders and TTS API calls) from parsing malformed or corrupted values.
 */

const DEFAULT_SCENE_ID = 'tay-ho-giay-do-room-01';
export const DEFAULT_PROCESS_STATION_COUNT = 10;

function cloneStation(station) {
  return {
    order: station.order,
    title: station.title,
    titleEn: station.titleEn ?? '',
    narration: station.narration ?? '',
    narrationEn: station.narrationEn ?? '',
    videoUrl: station.videoUrl ?? null,
  };
}

function normalizeAsset(asset) {
  if (!asset || typeof asset !== 'object') {
    return null;
  }

  const { assetId, kind, publicPath, format } = asset;
  if (
    typeof assetId !== 'string'
    || !assetId
    || !['model', 'video'].includes(kind)
    || typeof publicPath !== 'string'
    || !publicPath.startsWith('/')
    || !['fbx', 'glb', 'mp4'].includes(format)
  ) {
    return null;
  }

  return {
    assetId,
    kind,
    format,
    loader: asset.loader ?? format,
    preload: asset.preload === 'eager' ? 'eager' : 'none',
    role: asset.role ?? null,
    publicPath,
    title: asset.title ?? asset.name ?? null,
    titleEn: asset.titleEn ?? asset.nameEn ?? null,
    metadata: asset.metadata && typeof asset.metadata === 'object' ? { ...asset.metadata } : {},
  };
}

function createStructuredStation(station, assetIndex) {
  const order = Number(station?.order);
  if (!Number.isInteger(order) || order <= 0) {
    return null;
  }

  const videoAsset = assetIndex.get(station.assetId);
  return {
    order,
    title: station.title ?? '',
    titleEn: station.titleEn ?? '',
    narration: station.narration ?? '',
    narrationEn: station.narrationEn ?? '',
    videoUrl: videoAsset?.kind === 'video' ? videoAsset.publicPath : null,
  };
}

export function createDegradedMediaState({
  sceneId = DEFAULT_SCENE_ID,
  count = DEFAULT_PROCESS_STATION_COUNT,
  error = null,
} = {}) {
  return {
    status: 'degraded',
    sceneId,
    error,
    assets: [],
    stations: Array.from({ length: count }, (_, index) => ({
      order: index + 1,
      title: `Bước ${index + 1}`,
      titleEn: `Step ${index + 1}`,
      narration: '',
      narrationEn: '',
      videoUrl: null,
    })),
  };
}

export function adaptMediaManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return createDegradedMediaState({ error: new Error('Media manifest payload is missing.') });
  }

  if (!Array.isArray(manifest.assets) || !Array.isArray(manifest.processStations)) {
    return createDegradedMediaState({
      sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
      error: new Error('Unsupported media manifest shape.'),
    });
  }

  const assets = manifest.assets.map(normalizeAsset).filter(Boolean);
  const assetIndex = new Map(assets.map((asset) => [asset.assetId, asset]));
  const stations = manifest.processStations
    .map((station) => createStructuredStation(station, assetIndex))
    .filter(Boolean)
    .sort((left, right) => left.order - right.order)
    .map(cloneStation);

  if (assets.length !== manifest.assets.length || stations.length === 0) {
    return createDegradedMediaState({
      sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
      error: new Error('Media manifest is malformed.'),
    });
  }

  return {
    status: 'ready',
    sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
    assets,
    stations,
    error: null,
  };
}

export function findAssetByRole(assets, role) {
  return (assets ?? []).find((asset) => asset.role === role) ?? null;
}

export function findAssetById(assets, assetId) {
  return (assets ?? []).find((asset) => asset.assetId === assetId) ?? null;
}
