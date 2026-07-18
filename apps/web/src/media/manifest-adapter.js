const DEFAULT_SCENE_ID = 'tay-ho-giay-do-room-01';
export const DEFAULT_PROCESS_STATION_COUNT = 10;

const LEGACY_PROCESS_STATION_CATALOG = [
  {
    order: 1,
    title: 'Nấu vỏ cây Dó',
    titleEn: 'Cooking the Dó Bark',
    narration: 'Bước 1: Vỏ cây Dó khô sau khi ngâm nước sẽ được đem nấu chín nhừ cùng vôi bột từ 12 đến 18 tiếng.',
    narrationEn: 'Step 1: The Dó bark is cooked with lime powder for 12 to 18 hours until soft.',
  },
  {
    order: 2,
    title: 'Làm bìa vỏ Dó',
    titleEn: 'Making Cover Sheet',
    narration: 'Bước 2: Vỏ lụa chín vớt ra được ngâm rửa, lọc sạch chất nhựa và giã sơ để làm thành tấm bìa lọc thô.',
    narrationEn: 'Step 2: Cooked bark is washed, cleaned of sap, and lightly pounded to make cover sheets.',
  },
  {
    order: 3,
    title: 'Giã bột Dó',
    titleEn: 'Pounding the Pulp',
    narration: 'Bước 3: Cho sợi vỏ Dó vào cối đá và giã đều tay cho đến khi các thớ sợi tơi nhuyễn thành bột giấy mịn.',
    narrationEn: 'Step 3: Pounding the Dó fibers in a stone mortar until they disintegrate into fine pulp.',
  },
  {
    order: 4,
    title: 'Đập lề và bào gỗ',
    titleEn: 'Trimming & Wood Shaving',
    narration: 'Bước 4: Công đoạn đập lề giúp thợ xơ phẳng mép giấy và chuẩn bị khuôn tre phẳng phiu cho bể seo.',
    narrationEn: 'Step 4: Trimming edges and prepping wooden elements ensure a smooth sheet layout.',
  },
  {
    order: 5,
    title: 'Đãi bìa xơ',
    titleEn: 'Sifting the Pulp',
    narration: 'Bước 5: Bột giấy được đãi trong nước sạch để loại bỏ nốt các mảnh vỏ cứng và tạp chất thô còn sót.',
    narrationEn: 'Step 5: Rinsing and sifting the pulp in water to remove any remaining dark bark fragments.',
  },
  {
    order: 6,
    title: 'Pha keo tàu',
    titleEn: 'Mixing with Glue',
    narration: 'Bước 6: Pha nhựa cây mò (keo tàu) vào bể bột giúp kết dính các thớ sợi và giúp giấy không bị nhòe mực.',
    narrationEn: 'Step 6: Mixing natural glue into the pulp vat to bind fibers and ensure proper ink absorption.',
  },
  {
    order: 7,
    title: 'Seo giấy Dó',
    titleEn: 'Scooping the Sheets',
    narration: 'Bước 7: Người thợ chao liềm seo vớt bột giấy và lắc nhẹ đều tay để dàn thớ sợi thành một tờ giấy mỏng.',
    narrationEn: 'Step 7: The artisan scoops the screen into the vat and shakes it to lay fibers into a thin sheet.',
  },
  {
    order: 8,
    title: 'Ép giấy thoát nước',
    titleEn: 'Pressing the Paper',
    narration: 'Bước 8: Xếp các tờ giấy ướt chồng lên nhau thành thớt giấy lớn rồi ép thủy lực để ép kiệt nước.',
    narrationEn: 'Step 8: Stacking wet sheets and pressing them under heavy pressure to squeeze out excess water.',
  },
  {
    order: 9,
    title: 'Cán phẳng giấy',
    titleEn: 'Rolling & Flattening',
    narration: 'Bước 9: Tấm giấy ép được cán phẳng bề mặt để các sợi liên kết chặt chẽ và phẳng phiu trước khi sấy.',
    narrationEn: 'Step 9: Rolling the sheets to compact the fibers and flatten the surface for drying.',
  },
  {
    order: 10,
    title: 'Lột giấy sấy khô',
    titleEn: 'Peeling and Separating',
    narration: 'Bước 10: Từng tờ giấy sau khi sấy khô sẽ được lột cẩn thận ra khỏi vách sấy nóng và xếp thành tệp.',
    narrationEn: 'Step 10: Dried sheets are carefully peeled off from the heated wall and stacked into bundles.',
  },
];

const LEGACY_ROLE_PATTERNS = [
  { role: 'guide-model', pattern: /\/guide_girl\/huongdanvien\.fbx$/iu },
  { role: 'guide-idle', pattern: /\/guide_girl\/Idle\.fbx$/iu },
  { role: 'guide-walk', pattern: /\/guide_girl\/Walking\.fbx$/iu },
  { role: 'guide-talk', pattern: /\/guide_girl\/Talking\.fbx$/iu },
  { role: 'exhibit-product-showing', pattern: /\/asset\/product_showing\.fbx$/iu },
  { role: 'exhibit-showing-tree', pattern: /\/asset\/showing_tree_01\.fbx$/iu },
  { role: 'exhibit-village-picture', pattern: /\/asset\/village_picture\.fbx$/iu },
  { role: 'exhibit-mortar', pattern: /\/asset\/mortar\.fbx$/iu },
  { role: 'exhibit-paper-showing', pattern: /\/asset\/paper_showing\.fbx$/iu },
  { role: 'exhibit-wooden-mould', pattern: /\/asset\/woodenmould\.fbx$/iu },
  { role: 'avatar-animated', pattern: /\/assets\/avatar\/cesium-man\.glb$/iu },
  { role: 'avatar-static-preview', pattern: /\/assets\/avatar\/huongdanvien\.glb$/iu },
];

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

function slugFromPath(publicPath = '') {
  return publicPath
    .replace(/^\//u, '')
    .replace(/\.[^.]+$/u, '')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '') || 'media-asset';
}

function inferLegacyRole(publicPath) {
  return LEGACY_ROLE_PATTERNS.find(({ pattern }) => pattern.test(publicPath))?.role ?? null;
}

function inferMediaKind(publicPath = '') {
  if (/\.fbx$/iu.test(publicPath)) {
    return 'fbx';
  }

  if (/\.glb$/iu.test(publicPath)) {
    return 'glb';
  }

  if (/\.mp4$/iu.test(publicPath)) {
    return 'mp4';
  }

  return 'unknown';
}

function normalizeAsset(asset, fallbackKind = null) {
  if (!asset || typeof asset !== 'object') {
    return null;
  }

  const publicPath = asset.publicPath ?? asset.url ?? asset.path ?? null;
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) {
    return null;
  }

  const kind = asset.kind ?? fallbackKind ?? inferMediaKind(publicPath);
  const role = asset.role ?? inferLegacyRole(publicPath);

  return {
    assetId: asset.assetId ?? slugFromPath(publicPath),
    kind,
    role,
    publicPath,
    title: asset.title ?? asset.name ?? null,
    titleEn: asset.titleEn ?? asset.nameEn ?? null,
    metadata: asset.metadata && typeof asset.metadata === 'object' ? { ...asset.metadata } : {},
  };
}

function createAssetIndex(assets) {
  return new Map(assets.map((asset) => [asset.assetId, asset]));
}

function getVideoAssetId(station) {
  return station.videoAssetId ?? station.assetId ?? station.mediaAssetId ?? null;
}

function createStructuredStation(station, assetIndex) {
  const order = Number(station.order ?? station.stepNum ?? station.step ?? 0);
  if (!Number.isInteger(order) || order <= 0) {
    return null;
  }

  const videoAsset = assetIndex.get(getVideoAssetId(station));

  return {
    order,
    title: station.title ?? station.name ?? '',
    titleEn: station.titleEn ?? station.nameEn ?? '',
    narration: station.narration ?? station.body ?? '',
    narrationEn: station.narrationEn ?? station.bodyEn ?? '',
    videoUrl: videoAsset?.publicPath ?? null,
  };
}

function createLegacyAssets(manifest) {
  return [
    ...(Array.isArray(manifest.fbx) ? manifest.fbx.map((publicPath) => normalizeAsset({ publicPath }, 'fbx')) : []),
    ...(Array.isArray(manifest.glb) ? manifest.glb.map((publicPath) => normalizeAsset({ publicPath }, 'glb')) : []),
    ...(Array.isArray(manifest.mp4) ? manifest.mp4.map((publicPath) => normalizeAsset({ publicPath }, 'mp4')) : []),
  ].filter(Boolean);
}

function createLegacyStations(manifest) {
  const videoByOrder = new Map();

  for (const publicPath of manifest.mp4 ?? []) {
    const match = publicPath.match(/Buoc(\d+)/iu);
    if (!match) {
      continue;
    }

    videoByOrder.set(Number(match[1]), publicPath);
  }

  return LEGACY_PROCESS_STATION_CATALOG.map((station) => ({
    ...station,
    videoUrl: videoByOrder.get(station.order) ?? null,
  }));
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

  if (Array.isArray(manifest.assets) && Array.isArray(manifest.processStations)) {
    const assets = manifest.assets.map((asset) => normalizeAsset(asset)).filter(Boolean);
    const assetIndex = createAssetIndex(assets);
    const stations = manifest.processStations
      .map((station) => createStructuredStation(station, assetIndex))
      .filter(Boolean)
      .sort((left, right) => left.order - right.order)
      .map(cloneStation);

    if (stations.length === 0) {
      return createDegradedMediaState({ sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID, error: new Error('Media manifest has no stations.') });
    }

    return {
      status: 'ready',
      sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
      assets,
      stations,
      error: null,
    };
  }

  if (Array.isArray(manifest.fbx) && Array.isArray(manifest.glb) && Array.isArray(manifest.mp4)) {
    return {
      status: 'ready',
      sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
      assets: createLegacyAssets(manifest),
      stations: createLegacyStations(manifest).map(cloneStation),
      error: null,
    };
  }

  return createDegradedMediaState({
    sceneId: manifest.sceneId ?? DEFAULT_SCENE_ID,
    error: new Error('Unsupported media manifest shape.'),
  });
}

export function findAssetByRole(assets, role) {
  return (assets ?? []).find((asset) => asset.role === role) ?? null;
}

export function findAssetById(assets, assetId) {
  return (assets ?? []).find((asset) => asset.assetId === assetId) ?? null;
}
