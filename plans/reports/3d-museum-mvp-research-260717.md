---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: 3D lane cho scoped MVP museum

**Mode**: breadth  
**Date**: 2026-07-17  
**Sources reviewed**: 9 primary URLs + local probes

## Tóm tắt
Three.js native là nền đúng cho MVP này: `AnimationMixer.update(deltaTime)` và `clipAction()` đã có sẵn, `GLTFLoader` xử lý skin/morph target và các extension nén phổ biến như Draco/KTX2 [1][2].
Cho MVP, core scene nên là asset curated/hand-authored; image-to-3D chỉ nên dùng cho prop tĩnh, không phải avatar hay scene lõi. TripoSR là probe rẻ nhất; Hunyuan3D-2 là bước sau nếu chất lượng prop chưa đủ [5][6].
Fallback 2D phải là poster + entry HTML thật; pattern `poster until loaded` / `click to show` của model-viewer map thẳng sang museum-room fallback [7].
Budget mobile là điểm nghẽn chính: `requestAnimationFrame` phụ thuộc refresh rate (60Hz ~16.7ms, 120Hz ~8.3ms), và task >50ms là long task [8][9].

## Đánh giá rủi ro
| Rủi ro | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Avatar spring-bone hỏng khi scale runtime | M | H | Bake scale; probe 1 avatar thật; tránh scale runtime [3][4] |
| Prop AI output tốn cleanup hơn dự kiến | H | M | Chỉ dùng cho prop tĩnh; time-box 1 asset probe [5][6] |
| 2D fallback hỏng trên mobile | M | H | Build poster/list fallback trước; test Safari/Chrome thật [7] |
| Main-thread stall khi load/animate | M | H | Giữ work per frame nhỏ; batch load; tránh long tasks [8][9] |

## OBSERVED
- Repo hiện không có app implementation gần root: `find` chỉ ra `apps/web/.gitkeep`; không có `blender`; không có `package.json` gần root.
- Toolchain local sẵn sàng: Node 24.18.0, npm 11.16.0, Chrome 150.0.7871.114, Firefox 141.0.
- **[PRIOR]** probe Three.js r185 trong prompt nói headless Chrome đã render WebGL2 và `AnimationMixer` advance tới rotation 1.571; chưa tự repro trong turn này.

## DERIVED
- Three.js đủ làm runtime layer; đổi framework trước khi asset path rõ là churn. Nút thắt là asset discipline, không phải renderer [1][2].
- Runtime scale cho avatar spring-bone là bẫy; three-vrm cảnh báo scale làm spring bone/collider lệch, nên scale phải bake hoặc giữ bất biến [3][4].
- Image-to-3D không giải quyết rigging. Hunyuan3D-2 và TripoSR đều trả mesh/texture, nhưng không cho một pipeline avatar rigged end-to-end [5][6].
- Fallback 2D phải tồn tại như một mode thật, không phải canvas chết. Model-viewer chỉ ra pattern poster/load-on-demand đủ để sao chép vào museum shell [7].

## ASSUMED
- Có thể lấy guide avatar dạng pre-rigged humanoid/VRM mà không cần custom rigging lớn. Nguồn cần: 1 probe asset end-to-end qua three-vrm + three.js.
- 1 tool image-to-3D có thể cho prop stylized đủ sạch sau cleanup/bake trong budget. Nguồn cần: 1 test asset thật, đo retopo/bake hours.
- Target mobile chịu được 3–5 hotspots + 1 avatar animated trong frame budget. Nguồn cần: real device/browser run.

## Options / Comparison
| Option | Pros | Cons | Project fit |
|---|---|---|---|
| A. Curated glTF/VRM core, no AI in critical path | Kontrol cao, fallback dễ, ít moving parts, khớp repo blank hiện tại | Cần content authorship | [+] |
| B. AI-assisted props only (TripoSR trước, Hunyuan3D-2 sau) | Nhanh tạo prop, tốt cho static set dressing | Cleanup tax, variability, không giải bài rigging | [~] |
| C. Full AI-generated 3D scene/avatar | Demo nhanh | Rủi ro cao nhất, rig gap, mobile risk, fallback khó | [-] |

## Recommendation
**Priority 1**: A — native Three.js + core glTF/VRM curated + poster-based 2D fallback. Dùng AI chỉ cho prop tĩnh sau khi core chạy.
**Priority 2 / Fallback**: B — nếu art throughput là bottleneck thật, probe TripoSR trước; chỉ lên Hunyuan3D-2 nếu chất lượng prop chưa đạt.
**Không chọn**: C — full AI-generated scene/avatar là prototype trap, không phải MVP lane.

## Operational considerations
- Giữ `AnimationMixer.update(delta)` trong render loop; đừng tách animation into side loops [1].
- Nếu dùng glTF, ưu tiên Draco/KTX2 để giảm tải tải mạng và GPU memory pressure [2].
- Build 2D fallback trước 3D polish: poster, hotspot list, static room card, error state.
- Nếu avatar dùng spring bones, khóa scale trước; đừng để runtime transform làm lệch secondary animation [3][4].
- Cook phải probe trên browser thật, không chỉ headless: performance, fallback, asset size, hot spot interaction.

## Decisons needed
- Chọn avatar source: VRM-style vs custom rigged GLB vs service-generated avatar.
- Chọn content strategy: manual/curated core vs AI-assisted props.
- Chọn mobile minimum matrix: iOS Safari / Android Chrome / desktop Chrome.

## Evidence and references
[1] https://raw.githubusercontent.com/mrdoob/three.js/r185/src/animation/AnimationMixer.js | mrdoob/three.js | 2026-07-17 | VERIFIED | high | `update(deltaTime)` advances mixer time; `clipAction()` creates/reuses actions
[2] https://raw.githubusercontent.com/mrdoob/three.js/r185/examples/jsm/loaders/GLTFLoader.js | mrdoob/three.js | 2026-07-17 | VERIFIED | high | glTF loader handles skins, morph targets, Draco/KTX2, external extensions
[3] https://raw.githubusercontent.com/pixiv/three-vrm/dev/guides/migration-guide-1.0.md | pixiv/three-vrm | 2026-07-17 | VERIFIED | high | humanoid/expression/orientation migration constraints
[4] https://raw.githubusercontent.com/pixiv/three-vrm/dev/guides/spring-bones-on-scaled-models.md | pixiv/three-vrm | 2026-07-17 | VERIFIED | high | runtime scaling distorts spring bones/colliders
[5] https://api.github.com/repos/Tencent-Hunyuan/Hunyuan3D-2 | Tencent-Hunyuan | 2026-07-17 | VERIFIED | high | 6.7k stars, 864 forks, no releases on repo page summary, single-image / multiview 3D, 6GB VRAM shape, 16GB shape+texture
[6] https://api.github.com/repos/VAST-AI-Research/TripoSR | VAST-AI-Research | 2026-07-17 | VERIFIED | high | 14.3k stars, 1.5k forks, 240 open issues, MIT/noassertion, 6GB VRAM shape, 16GB shape+texture
[7] https://modelviewer.dev/examples/loading/ | model-viewer | 2026-07-17 | VERIFIED | high | poster-until-loaded, click-to-show, static-image fallback pattern
[8] https://web.dev/articles/optimize-long-tasks | Chrome/Web.dev | 2026-07-17 | VERIFIED | high | >50ms = long task; yield to main thread
[9] https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame | MDN | 2026-07-17 | VERIFIED | medium | refresh-rate-dependent callbacks; 60Hz/120Hz frame budget implication

## Open questions
- [PRIOR] Three.js r185 headless Chrome probe from prompt should be reproduced locally in cook — source needed: minimal browser harness on this host.
- [ASSUMED] Guide avatar source can stay pre-rigged without custom rigging cost — source needed: one candidate avatar end-to-end.
- [ASSUMED] AI prop cleanup stays under budget — source needed: one real prop test with import/retopo/bake timing.
- [ASSUMED] 2D fallback is usable on target mobile browsers — source needed: Safari/Chrome mobile probe.
