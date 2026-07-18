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

- Vite bundle giải quyết dependency browser của Three.js và phục vụ `apps/web/src/main.js` qua build output.
- Bootstrap lấy scene, tour, rồi media manifest; lỗi manifest chỉ đưa wall/model về degraded state, không làm gãy tour, QA, hoặc TTS.
- Video MP4 giữ URL public hiện hữu và `preload: "none"`; guide animated assets dùng policy `preload: "eager"` sau shell/bootstrap, còn scene props và media còn lại vẫn đi theo lazy/degraded contract.

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

1. Browser mở root Vite-built app và render fallback scene shell trước.
2. Client lấy scene và tour, sau đó lấy `/api/media/{sceneId}`.
3. Adapter map process station sang MP4 được manifest tham chiếu; `VideoDisplay.play()` mới đặt `src` cho video.
4. Model registry resolve role sang asset metadata; guide assets được prewarm/promote theo policy eager sau bootstrap, còn scene-prop activation path vẫn giữ lazy target hiện có.
5. Nếu asset hoặc manifest lỗi, fallback geometry/mock station vẫn giữ tour 5 bước và các luồng QA/TTS hoạt động.

## Deferred runtime issues

Các điểm dưới đây là **known trade-offs của pass hiện tại**, không phải claim đã được sửa:

- Scene-prop lazy activation trong guided flow còn cần siết lại để một số prop không phụ thuộc quá nhiều vào movement path hiện tại.
- Shared model registry còn nợ một pass alignment quanh GLB role/loader handling trước khi mọi avatar/media role đi chung một seam.
- Một số issue media-service/static-serving cấp thấp hơn đã được nhận diện nhưng chưa nằm trong pass này vì repo đang ưu tiên clarity framing thay vì sửa logic runtime.

## Fallback ladder

1. Guide assets eager sau bootstrap; video và scene props còn lại tải lazy theo manifest/runtime policy.
2. Fallback geometry hoặc mock station khi media không khả dụng.
3. Scene/tour/QA/TTS vẫn usable khi toàn bộ media manifest lỗi.

## Non-functional baseline

- Mobile-first; initial route không được eager-load toàn bộ FBX/MP4, và guide eager chỉ được phép sau shell/bootstrap.
- Nội dung factual phải đi từ approved content store.
- Service lỗi phải có degraded state rõ ràng, không phá user journey còn lại.
- Log runtime tối thiểu cho scene bootstrap và media fallback.

## Tài liệu liên quan

- [Code standards](./code-standards.md)
- [API contract](./engineering/api-contract.md)
- [Deployment](./operations/deployment.md)
- [Decision 0001](./decisions/0001-mvp-scope.md)
