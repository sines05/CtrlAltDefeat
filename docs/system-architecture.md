# System architecture

Cập nhật: 2026-07-18

## Trạng thái hiện tại

- [OBSERVED] Repo có web runtime Vite tại `apps/web/`, Node HTTP API tại `services/api/`, nội dung đã duyệt tại `content/approved/`, và kiểm thử runtime tại `tests/`.
- [OBSERVED] Scene giấy dó hiện phục vụ tour 5 bước, grounded QA/TTS, Gemini Live voice có degraded fallback, cùng manifest model/video theo scene.

## Sơ đồ mức cao

```text
Mobile browser
  -> Vite-built web runtime
      -> GET /api/scene/{sceneId}
      -> GET /api/tour/{tourId}
      -> GET /api/media/{sceneId}
      -> scene/tour/QA/TTS/voice UI
  -> Node HTTP API
      -> scene + tour services
      -> media manifest service
      -> grounded QA + TTS + Live relay
  -> approved content store
      -> scene, tour, chunks, TTS scripts
      -> media manifest metadata
  -> static public assets
      -> FBX, GLB, MP4
```

## Thành phần chính

### Client web

- Vite bundle giải quyết dependency browser của Three.js; landing warm module `apps/web/src/main.js` khi browser rảnh nhưng module import không mount WebGL hoặc khởi động scene.
- Bootstrap lấy scene, tour, rồi media manifest; lỗi manifest chỉ đưa wall/model về degraded state, không làm gãy tour, QA, hoặc TTS.
- Chỉ khi browser xác nhận desktop `4g`, RAM >= 4 GiB và không bật Data Saver, tương tác có chủ đích với landing mới preload tuần tự `guide-model` + `guide-idle`; thiếu probe thì fail-closed. Đủ 4 guide assets chỉ load/promote sau entry, scene props và MP4 vẫn lazy/degraded.

### Node HTTP API

- `GET /api/scene/{sceneId}` trả metadata cảnh.
- `GET /api/tour/{tourId}` giữ contract tour 5 bước đã duyệt.
- `GET /api/media/{sceneId}` trả metadata model/video theo scene, không trả binary hoặc base64.
- `POST /api/qa`, `POST /api/tts`, và `/api/qa/live` giữ grounded/degraded behavior hiện có.

### Approved content store

- `content/approved/` là nguồn dữ liệu factual cho scene, tour, citations, QA, TTS, và metadata media.
- `content/approved/media/tay-ho-giay-do-room-01.json` liên kết `assets[]` với `processStations[]`; UI không tự sinh diễn giải quy trình.

### Static assets

- Server phục vụ `/asset`, `/guide_girl`, `/making_step`, và `/assets/avatar` từ build output.
- Static binaries không đi qua API media manifest; manifest chỉ cung cấp asset ID, role, format, public path, và preload metadata cho runtime policy.

## Why this architecture exists

Kiến trúc hiện tại không tối ưu cho một demo 3D “hào nhoáng” nhất thời; nó tối ưu cho một bài toán di sản khó hơn vẻ bề ngoài:
- người xem phải vào được nhanh trên điện thoại;
- nội dung văn hóa phải đi từ approved sources thay vì prompt tự do;
- voice chỉ có ý nghĩa khi nó bám một answer path đáng tin;
- media hoặc AI lỗi vẫn không được làm gãy toàn bộ hành trình.

Trong 48 giờ, việc ghép cùng lúc web runtime 3D, content architecture, grounded QA/TTS, voice path, và fallback behavior là một scope lớn bất thường so với một MVP chỉ ship một lớp đơn lẻ. Vì vậy repo ưu tiên trust, recoverability, và demo continuity trước khi tối ưu hết mọi media/runtime edge.

## Luồng runtime

1. Browser render landing trước; khi idle và không bật Data Saver/2G, client warm module Three.js nhưng chưa tạo renderer hoặc canvas.
2. Khi người xem nhấc tấm dó hoặc cuộn tới quy trình, client chỉ preload tuần tự `guide-model` + `guide-idle` nếu Network Information báo `4g`, Device Memory báo >= 4 GiB và pointer/viewport là desktop; probe thiếu, mobile, 3G hoặc Data Saver đều bỏ qua.
3. CTA gọi `startMuseumApp()`, dựng fallback scene shell và render first frame trước khi commit media promotion.
4. Full guide promotion reuse hai promise đã warm rồi tải thêm walk/talk; `VideoDisplay.play()` và scene-prop activation vẫn là lazy path riêng.
5. Nếu preload, asset hoặc manifest lỗi, fallback geometry/mock station vẫn giữ tour 5 bước và các luồng QA/TTS hoạt động.

## Deferred runtime issues

Các điểm dưới đây là **known trade-offs của pass hiện tại**, không phải claim đã được sửa:

- Scene-prop activation window đã được siết để spawn point không tải non-guide FBX trước first frame; guided-flow sequencing sâu hơn vẫn còn là deferred work.
- Shared model registry còn nợ một pass alignment quanh GLB role/loader handling trước khi mọi avatar/media role đi chung một seam.
- Một số issue media-service/static-serving cấp thấp hơn đã được nhận diện nhưng chưa nằm trong pass này vì repo đang ưu tiên clarity framing thay vì sửa logic runtime.

## Fallback ladder

1. Landing chỉ warm module; partial guide preload được network/device-gate và chỉ gồm model + idle.
2. Full guide promotion chạy sau entry; video và scene props còn lại tải lazy theo manifest/runtime policy.
3. Fallback geometry hoặc mock station khi media không khả dụng.
4. Scene/tour/QA/TTS vẫn usable khi toàn bộ media manifest lỗi.

## Non-functional baseline

- Mobile-first; initial route không eager-load FBX/MP4, module warmup không mount WebGL, và partial guide preload bị chặn trên mobile/3G/Data Saver.
- Nội dung factual phải đi từ approved content store.
- Service lỗi phải có degraded state rõ ràng, không phá user journey còn lại.
- Log runtime tối thiểu cho scene bootstrap và media fallback.

## Edge-Case & Resiliency Specifications

To satisfy production-grade requirements, the platform handles critical environmental edge cases with deterministic fallbacks:

| Edge Case | Detection Trigger | Architectural Mitigation | Code Location |
| :--- | :--- | :--- | :--- |
| **Browser Audio Autoplay Block** | `AudioContext.state === 'suspended'` | Gated initialization; context is dynamically resumed via Landing Page user gesture. | [main.js](../apps/web/src/main.js) |
| **Hardware Audio Limit Reach** | Multiple audio instances crash | Implements a globally-shared `sharedAudioCtx` singleton pool to reuse resource instances. | [main.js](../apps/web/src/main.js) |
| **Live API Relayer Outage** | Connection error or Live API timeout | Automatically degrades to grounded REST Q&A engine and triggers backend speech synthesis fallback. | [live/index.js](../services/api/src/live/index.js) |
| **Network Speech Engine Failure** | TTS API returns non-200 or connection drop | Gracefully degrades to native browser `SpeechSynthesis`; if unsupported, falls back to silent FSM timer. | [TourManager.js](../apps/web/src/systems/TourManager.js) |
| **Generative LLM Hallucinations** | Grounding evidence score = 0 | Enforces RAG boundary policies to redirect out-of-scope queries back to active museum topics. | [qa/index.js](../services/api/src/qa/index.js) |

---

## Tài liệu liên quan

- [Code standards](./code-standards.md)
- [API contract](./engineering/api-contract.md)
- [Deployment](./operations/deployment.md)
- [Decision 0001](./decisions/0001-mvp-scope.md)
