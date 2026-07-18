---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: runtime/build tích hợp FBX/GLB + MP4

**Mode**: breadth  
**Date**: 2026-07-18  
**Sources reviewed**: 4 external official docs + repo evidence + runtime probes

## Summary

[OBSERVED] Build copy không phải blocker. `scripts/build.mjs:78-81` đã copy toàn bộ `apps/web`, `content/approved`, `assets/avatar`; probe build thực tế có đủ `.fbx`, `.mp4`, `.glb` trong `build/web/...` và `build/assets/avatar/...`.

[OBSERVED] Runtime hỏng trước khi chạm asset. `apps/web/index.html:494` nạp `/src/main.js`; file này import bare specifier `three` và `three/addons/*` ở `apps/web/src/main.js:1-5`. Probe Chrome trên cả repo runtime và build runtime đều ném `TypeError: Failed to resolve module specifier "three"`.

[OBSERVED] Sau khi sửa module resolution, `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:80-86` vẫn là blocker kế tiếp vì dùng `import.meta.glob('/making_step/*.mp4', { eager: true })`; Vite docs xác nhận đây là Vite-only, không phải web standard.

[OBSERVED] Quyết định user “backend manifest/API, videos separate from 5-step approved tour, no images yet” khớp với repo hiện tại. `services/api/src/tour/index.js:17-23` trả đúng 5 step approved; contract test khóa `steps.length === 5` tại `tests/api/scene-tour/scene-tour.contract.test.mjs:45-68`. `services/api/src/scene/index.js:49` vẫn để `assets: []`, nên có khoảng trống sạch để thêm media manifest riêng, không nhét video vào tour.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Browser không resolve `three` nên app không boot | H | H | Dùng bundler thật cho frontend hoặc import-map/vendorization; không tiếp tục serve raw source như hiện tại |
| `import.meta.glob` chạy trên stack không có Vite transform | H | H | Bỏ file discovery phía client; thay bằng backend media manifest/API |
| MP4 đang bị serve `application/octet-stream`, không `Accept-Ranges`, không `206` | M | M | Map `.mp4` -> `video/mp4`; thêm Range support nếu cần seek/progressive playback |
| Startup tải eager ~172MB media | H | M | Phase 2: bỏ preload video toàn cục, stage/lazy-load FBX thay vì `Promise.all` tất tay |
| Test suite không chạy browser bootstrap nên bỏ sót lỗi module/runtime | H | M | Thêm 1 browser smoke thật; mở rộng bootstrap static test cho `.fbx`/`.mp4` |

## Repo findings

### 1. Static server và build

- `services/api/src/server.js:12-23` chỉ map MIME cho `.glb`, `.html`, `.jpg`, `.js`, `.json`, `.png`, `.svg`, `.wav`, `.woff2`; không có `.mp4`, không có `.fbx`.
- `services/api/src/server.js:67-76` resolve static theo `webRoot` trước, rồi `staticRoot`; với layout hiện tại, URL công khai hợp lệ là:
  - `/guide_girl/*.fbx`
  - `/asset/*.fbx`
  - `/making_step/*.mp4`
  - `/assets/avatar/*.glb`
- `scripts/build.mjs:76-81` copy nguyên `apps/web` sang `build/web`, copy `content/approved` sang `build/content/approved`, và copy `assets/avatar` sang `build/assets/avatar`.
- [OBSERVED] `node /home/sonnq6/CtrlAltDefeat/scripts/build.mjs && find /home/sonnq6/CtrlAltDefeat/build -maxdepth 3 -type f \( -iname '*.fbx' -o -iname '*.mp4' -o -iname '*.glb' -o -name 'main.js' -o -name 'manifest.json' \) | sort`
  - Kết quả có đủ `build/web/asset/*.fbx`, `build/web/guide_girl/*.fbx`, `build/web/making_step/*.mp4`, `build/assets/avatar/*.glb`.
- Kết luận: với vị trí file hiện tại, build copy không cần sửa. Nếu tương lai chuyển media ra `assets/models` hoặc `assets/images`, lúc đó `scripts/build.mjs` mới thiếu copy rule. User đã chốt “no images yet”, nên chưa cần.

### 2. Browser runtime và asset loading

- `apps/web/src/main.js:59-69` hardcode đường dẫn model FBX local.
- `apps/web/src/main.js:180-191` `Promise.all([...10 FBX...])` trước khi scene usable.
- `apps/web/src/main.js:198-201` và `598-600` preload toàn bộ video ngay startup qua `station.videoDisplay.load()`.
- `apps/web/src/systems/VideoActivationSystem/VideoActivationSystem.js:21-38` lại cố unload/cull theo khoảng cách. Hiện design này tự cãi nhau: preload upfront rồi mới cull.
- `apps/web/src/components/VideoDisplay/VideoDisplay.js:53-89` cho thấy video thực ra có thể lazy-load on first play; preload startup không bắt buộc.
- [OBSERVED] Tổng payload file hiện tại:
  - `.fbx`: `143189644` bytes
  - `.mp4`: `23909698` bytes
  - `.glb`: `5348068` bytes
  - Total: `172447410` bytes
- [OBSERVED] Format probe:
  - `huongdanvien.fbx` => `Kaydara FBX model, version 7700`
  - representative `.mp4` => `ISO Media, MP4 Base Media v1 [ISO 14496-12:2003]`
  - `huongdanvien.glb` => `glTF binary model, version 2, length 4910024 bytes`

### 3. Empirical blockers

#### 3.1 Browser bootstrap blocker

[OBSERVED] DevTools probe trên `http://127.0.0.1:3180/` và `http://127.0.0.1:3181/` trả cùng lỗi:

```text
EXCEPTION Uncaught TypeError: Failed to resolve module specifier "three". Relative references must start with either "/", "./", or "../".
```

Evidence chain:
- `apps/web/index.html:494` nạp raw module `/src/main.js`
- `apps/web/src/main.js:1-5` import bare specifier `three`
- `package.json:1-16` không có `dependencies`
- [OBSERVED] `test -d /home/sonnq6/CtrlAltDefeat/node_modules/three && echo installed || echo missing` => `missing`

Kết luận: scene app hiện không runnable trong browser theo stack hiện tại. Đây là blocker số 1, trước cả MIME hay asset discovery.

#### 3.2 Vite-only file discovery blocker

- `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:80-86` dùng `import.meta.glob('/making_step/*.mp4', { eager: true })`.
- [OBSERVED] Build output vẫn giữ nguyên token này: `build/web/src/components/ExhibitionWall/ExhibitionWall.js:82`.
- Vite docs nói rõ: `import.meta.glob` là “Vite-only feature” và “not a web or ES standard”.

Kết luận: kể cả sau khi browser resolve được `three`, current non-Vite runtime vẫn không có transform cho glob này. Đây là blocker số 2.

#### 3.3 Static media headers

[OBSERVED] Probe server trực tiếp:

```text
/guide_girl/huongdanvien.fbx 200 application/octet-stream 27118192
/asset/product_showing.fbx 200 application/octet-stream 2618668
/making_step/Buoc1_nau_do.mp4 200 application/octet-stream 2430392
/assets/avatar/huongdanvien.glb 200 model/gltf-binary 4910024
RANGE 200 null null 2430392
```

Kết luận:
- `.glb` đã ổn.
- `.mp4` chưa có `video/mp4`.
- Range request hiện bị ignore; server trả `200` full body, không `Accept-Ranges`, không `Content-Range`.
- `.fbx` hiện là `application/octet-stream`. [ASSUMED] Đây chưa phải blocker day-1 nếu loader chỉ cần byte stream; chưa có probe chứng minh phải đổi MIME để FBXLoader chạy.

### 4. Tests hiện tại bắt gì, bỏ sót gì

- `tests/bootstrap/health-endpoint-smoke.test.mjs:20-64` chỉ verify `/`, `/src/main.js`, scene API, và 2 file `.glb`; test này pass thật với `node --test /home/sonnq6/CtrlAltDefeat/tests/bootstrap/health-endpoint-smoke.test.mjs`.
- `tests/api/scene-tour/scene-tour.contract.test.mjs:45-68` khóa approved tour ở đúng 5 steps.
- `tests/e2e/mvp-smoke.test.mjs:11-111` smoke API + HTML rendering, nhưng không execute `apps/web/index.html` trong browser và không import `apps/web/src/main.js`.
- [OBSERVED] `rg -n "making_step|mp4|fbx|glb|import\.meta\.glob|VideoDisplay|videoDisplay|guide_girl|asset/" /home/sonnq6/CtrlAltDefeat/tests` chỉ ra coverage media gần như chỉ có `.glb`; không có test nào chạm `.fbx`/`.mp4` hoặc browser bootstrap.

## Strategic Options

| Option | Effort | Risk | Flexibility | Team fit | Adoption risk | Notes |
|---|---|---|---|---|---|---|
| A. Backend media manifest riêng + frontend bundler thật cho module resolution | ~ | ~ | + | + | External low [PRIOR], repo migration medium [OBSERVED] | Giải đúng 2 blocker lớn: bare imports + Vite-only glob. Manifest giữ video tách khỏi approved 5-step tour. |
| B. Backend media manifest riêng + giữ raw server, thêm import-map/vendorized `three`, bỏ `import.meta.glob` | ~ | - | ~ | ~ | External n/a, internal maintenance high | Ít thay build hơn trên giấy, nhưng tạo plumbing bespoke cho browser modules. Đây là debt, không phải đường sạch. |
| C. Nhét media vào scene/tour hiện tại hoặc giữ local discovery phía client | + | - | - | - | High | Trái user decision, làm mờ boundary giữa 10 media stations và approved 5-step tour, vẫn không chữa được bare imports nếu không có bundler/import-map. |

### Ranking

1. **Priority 1 — Option A**
2. **Fallback — Option B**
3. **Do not choose — Option C**

## Recommendation

**Priority 1: backend media manifest/API riêng cho model+video, giữ tour approved 5 bước nguyên trạng, và dùng bundler thật để giải quyết browser module graph.**

Lý do:
- [OBSERVED] Code frontend hiện đã bundler-shaped (`three`, `three/addons`, `import.meta.glob`). Cố cứu raw-source runtime chỉ để tránh bundler là tiết kiệm giả.
- [OBSERVED] User đã chốt video tách khỏi approved 5-step tour. Repo cũng đang tách được: `tour-01.json` là narrative approved 5 bước; `scene.assets` đang rỗng.
- Build copy cho current asset placement đã đủ; đừng phí thời gian vá nhầm `scripts/build.mjs`.

### Minimal remediation đề xuất

1. **Thêm media manifest backend riêng**, ví dụ `content/approved/media/tay-ho-giay-do-room-01.json`, rồi expose qua endpoint kiểu `/api/media/:sceneId`.
   - Không sửa `content/approved/tours/tour-01.json`.
   - Không thêm image collection bây giờ.
   - Nên model hóa `videos` theo `stationId` hoặc `ordinal` 1..10, **không** reuse `tour.steps[*].stepId`, vì current gallery có 10 screens còn approved tour chỉ có 5 bước.
   - `models` nên chứa ít nhất nhóm local URL đang dùng thật:
     - `/guide_girl/*.fbx`
     - `/asset/*.fbx`
     - `/assets/avatar/*.glb`

2. **Frontend bỏ `import.meta.glob` cho domain data**.
   - Bundler có thể vẫn tồn tại để resolve JS modules.
   - Nhưng video/model catalog nên tới từ backend manifest/API, không quét file system từ client.

3. **Server hardening tối thiểu**.
   - Thêm `.mp4 -> video/mp4`.
   - Giữ `.glb -> model/gltf-binary` như hiện tại.
   - Với `.fbx`, **không cần đoán bừa MIME exotic** nếu chưa có consumer bắt buộc; `application/octet-stream` chưa được chứng minh là blocker. Nếu muốn explicit type sau này, research tiếp bằng source đáng tin cậy rồi mới đổi.
   - Range support cho MP4 là phase kế tiếp, không phải first unblock. Video hiện ngắn (~1.6MB đến ~2.5MB/file), autoplay muted loop, không có UI seek được thấy trong code. Nếu kiosk/mobile/network constraint nặng, nâng mức ưu tiên.

4. **Tests tối thiểu cần bổ sung sau khi sửa**.
   - Bootstrap static test: fetch 1 file `.fbx` + 1 file `.mp4`; assert `200`; assert `.mp4` có `video/mp4`.
   - Browser smoke thật: load `/` trong Chrome/headless, fail nếu có `Failed to resolve module specifier` hoặc exception bootstrap.
   - Contract test cho media manifest/API: không cho drift giữa 10 media stations và approved 5-step tour.

### Phase 2, sau khi unblock runtime

- Bỏ preload video startup ở `apps/web/src/main.js:198-201` và `598-600`; để `VideoDisplay.play()` tự lazy-load lần đầu.
- Giảm eager FBX load. `apps/web/src/main.js:180-191` đang kéo ~143MB trước first interactive render. Nếu phải ship kiosk-only có mạng nội bộ thì còn chịu được; nếu web-facing/mobile thì quá nặng.
- [PRIOR] Nếu media pipeline ổn định hơn, cân nhắc chuyển FBX nặng sang GLB để giảm payload và simplify runtime. Claim này chưa được probe trong repo nên không xếp vào minimal remediation.

## Operational Considerations

- Build path hiện tại đủ cho asset location hiện hữu; đừng sửa `scripts/build.mjs` chỉ vì thấy media mới.
- Nếu media manifest đặt dưới `content/approved/media/`, build cũng đã copy sẵn parent tree nhờ `scripts/build.mjs:80`.
- Vì tests hiện không boot browser, mọi regression liên quan module graph sẽ tiếp tục lọt nếu không thêm browser smoke.
- `404 favicon.ico` trong browser probe là noise, không phải blocker.

## Empirical commands / results

### Build copy probe

```bash
node /home/sonnq6/CtrlAltDefeat/scripts/build.mjs && \
find /home/sonnq6/CtrlAltDefeat/build -maxdepth 3 -type f \
  \( -iname '*.fbx' -o -iname '*.mp4' -o -iname '*.glb' -o -name 'main.js' -o -name 'manifest.json' \) | sort
```

Result: build output có đủ `build/web/asset/*.fbx`, `build/web/guide_girl/*.fbx`, `build/web/making_step/*.mp4`, `build/assets/avatar/*.glb`.

### Static header probe

```bash
node --input-type=module - <<'NODE'
import { startServer } from '/home/sonnq6/CtrlAltDefeat/services/api/src/server.js';
const runtime = await startServer({ host: '127.0.0.1', port: 0, staticRoot: '/home/sonnq6/CtrlAltDefeat', webRoot: '/home/sonnq6/CtrlAltDefeat/apps/web' });
const urls = [
  '/guide_girl/huongdanvien.fbx',
  '/asset/product_showing.fbx',
  '/making_step/Buoc1_nau_do.mp4',
  '/assets/avatar/huongdanvien.glb',
];
for (const url of urls) {
  const res = await fetch(runtime.baseUrl + url);
  console.log(url, res.status, res.headers.get('content-type'), (await res.arrayBuffer()).byteLength);
}
const rangeRes = await fetch(runtime.baseUrl + '/making_step/Buoc1_nau_do.mp4', { headers: { Range: 'bytes=0-99' } });
console.log('RANGE', rangeRes.status, rangeRes.headers.get('content-range'), rangeRes.headers.get('accept-ranges'), (await rangeRes.arrayBuffer()).byteLength);
await runtime.stop();
NODE
```

Result: `.fbx`/`.mp4` => `application/octet-stream`; `.glb` => `model/gltf-binary`; Range => `200 null null`.

### Browser runtime probe

Chrome DevTools capture against repo runtime and build runtime both returned:

```text
EXCEPTION Uncaught TypeError: Failed to resolve module specifier "three". Relative references must start with either "/", "./", or "../".
```

### Existing smoke

```bash
node --test /home/sonnq6/CtrlAltDefeat/tests/bootstrap/health-endpoint-smoke.test.mjs
```

Result: pass; therefore current test suite is not exercising browser bootstrap failure.

## Evidence and references

### Repo anchors

- `scripts/build.mjs:76-81`
- `services/api/src/server.js:12-23`
- `services/api/src/server.js:67-76`
- `apps/web/index.html:494`
- `apps/web/src/main.js:1-5`
- `apps/web/src/main.js:59-69`
- `apps/web/src/main.js:180-201`
- `apps/web/src/main.js:598-600`
- `apps/web/src/components/ExhibitionWall/ExhibitionWall.js:80-117`
- `apps/web/src/components/VideoDisplay/VideoDisplay.js:53-89`
- `apps/web/src/systems/VideoActivationSystem/VideoActivationSystem.js:13-38`
- `services/api/src/scene/index.js:42-50`
- `services/api/src/tour/index.js:17-23`
- `tests/api/scene-tour/scene-tour.contract.test.mjs:45-68`
- `tests/bootstrap/health-endpoint-smoke.test.mjs:20-64`
- `tests/e2e/mvp-smoke.test.mjs:11-111`
- `package.json:1-16`

### External sources

[1] https://vite.dev/guide/features | Vite official docs | current | credibility: high | `import.meta.glob` là Vite-only feature, không phải ES/web standard.  
[2] https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules | MDN | current | credibility: high | Browser module specifier phải là absolute/relative URL, hoặc dùng import map; unresolved specifier ném `TypeError`.  
[3] https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Range_requests | MDN | current | credibility: high | Omit `Accept-Ranges` => không support partial requests; success path là `206 Partial Content`.  
[4] https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types | MDN | current | credibility: high | `.mp4` => `video/mp4`; `.fbx` không có trong common table.  

## Open questions

- [ASSUMED] Có cần explicit MIME cho `.fbx` không, hay giữ `application/octet-stream` là đủ cho runtime thật? Cần một probe sau khi browser bootstrap chạy được, dùng FBXLoader thật thay vì suy luận.
- [ASSUMED] Range support cho MP4 có thành day-1 requirement không? Chỉ cần nâng ưu tiên nếu target có seek, mobile mạng yếu, hoặc browser/device thực tế không happy với full-body 200.
- [ASSUMED] Chọn endpoint riêng `/api/media/:sceneId` hay mở rộng `/api/scene/:sceneId` với field `media`. Tôi xếp endpoint riêng cao hơn vì giữ boundary sạch giữa curated scene/tour và runtime media, nhưng nếu team tối ưu round-trip hơn boundary thì có thể chọn field nhúng.
- [ASSUMED] Nếu chọn bundler, dùng Vite hay bundler khác. Tôi nghiêng Vite vì source đã có Vite-shaped code, nhưng chưa làm bakeoff migration cost trong repo này.

## Suggested next step

`hs:plan` cho một implementation plan nhỏ: (1) chốt manifest schema + endpoint path, (2) chốt frontend module strategy để sửa blocker `three`, (3) lên minimal test additions.