---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: media manifest + API cho model/video hiện có

**Mode**: breadth  
**Date**: 2026-07-18  
**Sources reviewed**: 5 external + repo evidence

## Executive Summary
[DERIVED] Nên thêm **approved media manifest riêng cho scene** và expose qua **`GET /api/media/{sceneId}`**, không nhét media vào `tour` và không dùng schema kiểu IIIF ngay vòng này.  
[OBSERVED] Repo đã có hai luồng tách biệt: tour 5 bước lấy từ `content/approved/tours/tour-01.json` qua `/api/tour/:id`, còn 10 video process station đang bị frontend tự quét trực tiếp từ `/making_step/*.mp4`; `scene.assets` vẫn rỗng và avatar manifest vẫn nằm ở frontend-local, nên ownership đang split sai chỗ: `services/api/src/scene/index.js:42-52`, `services/api/src/tour/index.js:17-23`, `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:77-151`, `apps/web/src/avatar/manifest.js:1-70`.  
[OBSERVED] Real server hiện serve `.mp4` và `.fbx` là `application/octet-stream`, còn `.glb` đúng là `model/gltf-binary`; giữ nguyên vậy là contract debt cho media API: `services/api/src/server.js:12-23`, probe `HEAD /making_step/Buoc1_nau_do.mp4 200 application/octet-stream`, `HEAD /asset/mortar.fbx 200 application/octet-stream`, `HEAD /assets/avatar/cesium-man.glb 200 model/gltf-binary`.  
[DERIVED] Rollout mỏng nhất: manifest JSON trong `content/approved/media/`, một service `media`, một endpoint GET, contract tests mới, rồi mới chuyển frontend 10 stations + avatar metadata sang đọc backend-approved manifest. Không cần upload system, không cần gallery, không cần đụng RAG/tour copy.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Media ownership tiếp tục split giữa frontend code và approved content | H | H | Chốt manifest SSOT trong `content/approved/media/`; frontend chỉ consume API |
| `.mp4`/`.fbx` trả sai `content-type` | H | M | Thêm MIME map tối thiểu cho `.mp4`; giữ `.fbx` là internal/original nếu chưa có web loader contract |
| 10 process stations vô tình mutate approved 5-step tour | M | H | Tách `processStations[]` khỏi `tour.steps[]`; test cố định `tour.steps.length === 5` |
| Eager video preload làm nặng mobile path | H | M | Giữ preload hint = `none`/lazy; bỏ preload-all khi chuyển sang manifest-driven loading |
| Schema overreach kiểu IIIF/CMS | M | M | Chỉ ship scene-scoped manifest read-only; bỏ upload/editor workflow |
| Asset volume làm startup nặng | H | H | API chỉ trả metadata; client lazy-load by station; đừng inline binary hay base64 |

## Strategic Options
| Rank | Option | Pros | Cons | Architectural fit | Adoption risk |
|---|---|---|---|---|---|
| 1 | **Dedicated media manifest endpoint**: `GET /api/media/{sceneId}` backed by `content/approved/media/*.json` | Tách ownership sạch; giữ `tour` nguyên vẹn; cache/version riêng; dễ test; gom được avatar/model/video metadata vào một SSOT | Thêm 1 endpoint + 1 fetch | **+** khớp backend Node HTTP hiện có và cây `content/approved/` | **Low-Med**: runtime nhỏ, schema custom mỏng; breaking surface hẹp |
| 2 | Inline media vào `GET /api/scene/{sceneId}` | Ít endpoint; frontend chỉ fetch 1 lần | Trộn scene shell với media catalog; cache kém; contract churn cho mọi consumer scene; khó giữ 10 stations tách tour | **~** chạy được nhưng sai ownership boundary | **Med**: nhanh lúc đầu, debt tích lũy nhanh |
| 3 | IIIF-like manifest | Chuẩn manifest mature, metadata phong phú, cấu trúc rõ | Overbuilt cho 1 scene + 10 videos; alien với codebase; thêm mapping layer vô ích | **-** mismatch scope/team/context | **Med-High [PRIOR]**: chuẩn bền nhưng team fit thấp, cost học + mapping cao |

## Recommended Approach
**Priority 1**: dedicated approved media manifest + `GET /api/media/{sceneId}`.  
**Fallback**: inline vào `/api/scene/{sceneId}` chỉ nếu team cần demo cực nhanh và chấp nhận dính contract debt ngay từ vòng đầu.

### 1. Ownership / SSOT
[OBSERVED] Approved editorial data đang sống dưới `content/approved/{sources,chunks,tours,qa-examples,tts}`, còn production-facing media metadata lại split ở frontend code: `docs/engineering/rag-content-schema.md:76-85`, `apps/web/src/avatar/manifest.js:1-70`, `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:77-151`.  
[DERIVED] Media manifest nên đặt cạnh approved content, ví dụ `content/approved/media/scene-media-01.json`, vì đây là cùng class “backend-approved metadata”, không phải runtime-only UI state.

Đề xuất ownership:
- `content/approved/media/*.json`: BA/content owner, approved metadata only.
- `services/api/src/media/index.js`: backend owner, read/validate/shape response.
- `apps/web`: consumer only; không giữ production SSOT cho avatar/video catalog nữa.
- Raw binaries tạm thời **không cần dời file** ở phase 1; manifest chỉ reference path public hiện có. Đây là đường đi ít churn nhất.

### 2. Schema recommendation
[OBSERVED] Hiện có 10 file MP4 trong `apps/web/making_step/` tổng `23,909,698` bytes và 11 file FBX trong `apps/web/asset/` + `apps/web/guide_girl/` tổng `143,189,644` bytes; GLB public hiện có 2 file tổng `5,348,068` bytes. API phải trả metadata nhẹ, không kéo binary vào payload.  
Evidence: filesystem probes on 2026-07-18.

Đề xuất schema tối thiểu:

```json
{
  "manifestId": "scene-media-01",
  "sceneId": "tay-ho-giay-do-room-01",
  "status": "provisional",
  "owner": "museum-mvp-phase-2",
  "version": 1,
  "updatedAt": "2026-07-18",
  "bindings": {
    "defaultAvatarId": "huongdanvien",
    "processStationIds": ["process-01", "process-02"]
  },
  "assets": [
    {
      "assetId": "huongdanvien",
      "kind": "model",
      "role": "guide-avatar",
      "format": "glb",
      "mimeType": "model/gltf-binary",
      "publicPath": "/assets/avatar/huongdanvien.glb",
      "byteLength": 4910024,
      "loader": "gltf",
      "approved": true,
      "notes": "static-preview"
    },
    {
      "assetId": "process-video-01",
      "kind": "video",
      "role": "process-station",
      "format": "mp4",
      "mimeType": "video/mp4",
      "publicPath": "/making_step/Buoc1_nau_do.mp4",
      "byteLength": 2430392,
      "preload": "none",
      "approved": true
    }
  ],
  "processStations": [
    {
      "stationId": "process-01",
      "order": 1,
      "title": "Nấu vỏ cây Dó",
      "assetId": "process-video-01",
      "narration": "...",
      "linkedTourStepIds": []
    }
  ]
}
```

Design notes:
- `assets[]` giữ technical metadata; `processStations[]` giữ UX grouping cho 10 video stations.
- `linkedTourStepIds` mặc định rỗng hoặc optional; đừng ép map 10 videos vào 5 steps.
- `loader` nên explicit (`gltf|fbx|html-video`) để frontend khỏi đoán theo extension.
- `byteLength` nên ship vì repo hiện đã có asset size rõ; useful cho perf budget/test gating.
- [ASSUMED] `checksum`/`etag` field có thể thêm sau nếu team muốn immutable asset pinning; không cần chặn phase 1.

### 3. API contract recommendation
[OBSERVED] Server hiện đã có pattern GET resource by id cho scene/tour và error shape thống nhất: `services/api/src/server.js:141-185`, `services/api/src/http/errors.js:1-12`, `tests/bootstrap/error-shape-contract-stub.test.mjs:13-21`.  
[DERIVED] Media nên follow đúng pattern đó.

Recommended endpoint:
- `GET /api/media/{sceneId}`
  - 200: trả scene-scoped manifest approved cho models + process videos.
  - 404: `MEDIA_MANIFEST_NOT_FOUND` theo error shape hiện có.

Response shape:
```json
{
  "manifestId": "scene-media-01",
  "sceneId": "tay-ho-giay-do-room-01",
  "status": "provisional",
  "version": 1,
  "updatedAt": "2026-07-18",
  "assets": [],
  "processStations": [],
  "bindings": {}
}
```

Contract rules:
- Giữ `GET /api/scene/{sceneId}` và `GET /api/tour/{tourId}` backward-compatible; không nhét 10 stations vào `tour.steps`.
- `scene.assets` hiện đang `[]`; phase 1 có thể giữ vậy hoặc chỉ thêm `mediaManifestId`, tránh dual truth: `services/api/src/scene/index.js:47-50`.
- Dùng error model hiện tại:
```json
{
  "error": {
    "code": "MEDIA_MANIFEST_NOT_FOUND",
    "message": "Media manifest not found.",
    "retryable": false,
    "traceId": "..."
  }
}
```

### 4. Caching and content-type
[OBSERVED] Static server map thiếu `.mp4` và `.fbx`; vì vậy probe thực trả `application/octet-stream` cho video/model FBX: `services/api/src/server.js:12-23`.  
[OBSERVED] MDN lists `.mp4 -> video/mp4`; `.glb` không có trên MDN common-types page, nhưng Khronos spec says GLB container should use `.glb` and `model/gltf-binary`.  
[DERIVED] Minimum rollout phải thêm `.mp4: video/mp4`; `.glb` đã đúng; `.fbx` có thể tạm để `application/octet-stream` nếu chưa expose như primary browser asset contract.

Caching recommendation:
- Manifest response: `Cache-Control: no-cache` + validator (`ETag`/`Last-Modified`) vì URL khó cache-bust và MDN nêu `manifest.json` thuộc nhóm nên revalidate thay vì long-cache.
- Versioned static assets: `Cache-Control: public, max-age=31536000, immutable` khi/if asset URLs được content-hash hoặc versioned.
- [ASSUMED] Repo hiện chưa có ETag/Last-Modified emission; cần implement nếu team muốn HTTP validation thật.

### 5. Frontend fit and rollout constraints
[OBSERVED] `VideoDisplay` tạo `HTMLVideoElement` với `preload = 'none'` và chỉ `load()` khi play/lazy path: `apps/web/src/components/VideoDisplay/VideoDisplay.js:18-27`, `:53-71`.  
[OBSERVED] Nhưng `apps/web/src/main.js:197-202` đang preload toàn bộ stations ngay startup; fallback path cũng preload all ở `apps/web/src/main.js:598-601`.  
[DERIVED] Nếu đã làm manifest/API mà vẫn preload-all thì gần như mất hết lợi ích contract mới cho mobile path. Phase 2 frontend nên consume manifest rồi lazy load theo `processStations` + `preload` hint, không quét `import.meta.glob('/making_step/*.mp4')` nữa.

### 6. Testable rollout
**Phase 0 — freeze scope**
- Explicit boundary: models + 10 MP4 first; không public JPEG gallery, không RAG expansion, không upload system.
- Keep approved 5-step tour untouched.

**Phase 1 — approved manifest + API**
- Add `content/approved/media/*.json`.
- Add `services/api/src/media/index.js` + `GET /api/media/{sceneId}`.
- Tests:
  - manifest content contract: count `processStations.length === 10`
  - API contract: `/api/media/tay-ho-giay-do-room-01` returns 200
  - error contract: unknown scene returns standard error shape

**Phase 2 — static delivery correctness**
- Add MIME for `.mp4` at minimum.
- Add smoke HEAD/GET tests for one MP4, one GLB, maybe one FBX if exposed.
- Keep `scene` and `tour` tests unchanged; current scene/tour smoke already passes: `tests/api/scene-tour/scene-tour.contract.test.mjs:17-68`, `tests/bootstrap/health-endpoint-smoke.test.mjs:20-64`.

**Phase 3 — frontend consumption**
- Replace `import.meta.glob('/making_step/*.mp4')` station discovery with API-provided station list.
- Replace frontend-local avatar catalog as production SSOT with media manifest adapter.
- Preserve fallback/mock screens if API/media missing.

**Phase 4 — debt paydown, optional**
- [ASSUMED] Convert browser-primary FBX assets to GLB where practical, if measured mobile perf or loader complexity justifies it.
- Add asset versioning/checksums if CDN caching becomes material.

## Operational Considerations
- [OBSERVED] Health smoke today checks only `/assets/avatar/*.glb`, not MP4/FBX media lanes: `tests/bootstrap/health-endpoint-smoke.test.mjs:20-64`. Extend it after API lands.
- [DERIVED] Add one manifest-level telemetry event: `media_manifest_loaded`, plus one station-level event: `process_station_video_started`; enough for demo-path verification, no analytics platform needed yet.
- [DERIVED] Keep manifest read-only. No POST/PUT/upload path in this phase.
- [DERIVED] Do not store media approval in frontend bundles; approval state belongs in backend-readable manifest near other approved content.

## Evidence and references
### Repo
- `services/api/src/server.js:12-23` — static MIME map currently includes `.glb` but not `.mp4`/`.fbx`.
- `services/api/src/server.js:141-223` — existing GET resource routing pattern; media route should match this shape.
- `services/api/src/http/errors.js:1-12` — canonical error object shape.
- `services/api/src/scene/index.js:42-52` — scene payload returns `assets: []` and links only `tourId`.
- `services/api/src/tour/index.js:17-23` — tour payload is independent and small.
- `apps/web/src/avatar/manifest.js:1-70` — avatar media SSOT is currently frontend-local.
- `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:4-75` — frontend owns 10 process-step labels/narration.
- `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:77-151` — frontend auto-discovers `/making_step/*.mp4`, sorts by `BuocN`, builds 10 stations.
- `apps/web/src/components/VideoDisplay/VideoDisplay.js:18-35` — video element uses `preload='none'` and `THREE.VideoTexture`.
- `apps/web/src/components/VideoDisplay/VideoDisplay.js:53-89` — video load/play/pause/unload lifecycle.
- `apps/web/src/main.js:197-202` and `apps/web/src/main.js:598-601` — startup preloads all station videos, defeating lazy intent.
- `content/approved/tours/tour-01.json:19-70` — approved tour has exactly 5 steps.
- `tests/api/scene-tour/scene-tour.contract.test.mjs:45-67` — contract already asserts exactly 5 tour steps.
- `tests/bootstrap/error-shape-contract-stub.test.mjs:13-21` — error shape is test-covered.
- `tests/bootstrap/health-endpoint-smoke.test.mjs:20-64` — health smoke validates scene + GLB assets only.

### External
- [1] https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html | Khronos | current spec page | credibility: high | Probe via `python urllib` found: GLB container files should use `.glb` and `model/gltf-binary`; spec also defines GLB-stored BIN chunk.
- [2] https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types | MDN | current | credibility: high | Official common type list includes `.mp4 -> video/mp4` and does not list `.glb`.
- [3] https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preload | MDN | current | credibility: high | `preload` values are `none`, `metadata`, `auto`, `""`.
- [4] https://threejs.org/docs/pages/VideoTexture.html | three.js docs | current | credibility: high | `THREE.VideoTexture` is tied to an `HTMLVideoElement`; renderer updates frames automatically; lifecycle/dispose matters.
- [5] https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching | MDN | current | credibility: high | Recommends `no-cache` + validators for non-busted manifest-like resources; long immutable caching for versioned static assets.
- [6] https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/ETag | MDN | current | credibility: high | `ETag` identifies a specific version and enables `304 Not Modified` via `If-None-Match`.
- [7] https://iiif.io/api/presentation/3.0/ | IIIF Consortium | 3.0 | credibility: high | Manifest is a description of a compound object with `items`/Canvases/metadata; useful comparison point, but too heavy here.

## Limitations
- Không benchmark thật trên mobile cho FBX vs GLB loader cost; mọi khuyến nghị perf-format beyond MIME/lazy-load vẫn là `[ASSUMED]` hoặc `[PRIOR]` nếu chưa bakeoff.
- Không kiểm tra browser playback behavior của MP4 dưới `application/octet-stream`; chỉ probe server headers, không claim playback success/failure.
- Không audit CDN/deploy layer; caching notes mới ở mức app/server contract.

## Open questions
- [ASSUMED] Có cần expose FBX ra browser contract dài hạn không, hay chỉ giữ như source/original và dần chuẩn hóa sang GLB? Nên settle bằng `hs:bakeoff` trên thiết bị mục tiêu trước khi chốt loader strategy.
- [ASSUMED] Team có muốn `scene` response chỉ chứa `mediaManifestId`, hay giữ `scene.assetsSummary` nhỏ để giảm extra fetch? Nếu muốn one-fetch DX, phải chấp nhận thêm coupling.
- [ASSUMED] Có cần version/hash field ngay phase 1 không? Nếu deploy path chưa có cache busting, có thể defer nhưng phải ghi debt.
- [OBSERVED] `docs/code-standards.md:7` và `docs/system-architecture.md:7` vẫn nói repo chưa có app code; docs này đang stale so với trạng thái repo hiện tại và có thể làm plan drift.

## Suggested next step
Implement theo **Priority 1** bằng `hs:plan`: chốt manifest schema file, endpoint shape, MIME patch cho `.mp4`, và test matrix trước khi động vào frontend consumer.
