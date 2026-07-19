# Code standards

Cập nhật: 2026-07-18

## Trạng thái hiện tại

- [OBSERVED] Repo có Vite web app, Node HTTP API, approved content store, build scripts, và runtime tests.
- [OBSERVED] Scene media dùng manifest JSON theo scene; public binaries vẫn được phục vụ tĩnh, với guide animated FBX eager sau shell/bootstrap còn media khác giữ lazy-load ở browser.

## Nguyên tắc MVP

1. QR hoặc marker mở được web trên điện thoại phổ thông.
2. Có fallback trước khi thêm WebAR: media lỗi không được làm gãy scene/tour/QA/TTS.
3. Chỉ ship factual content đã duyệt cho RAG, tour, TTS, và process station copy.
4. Text Q&A và TTS là bắt buộc; STT, lip-sync, WebAR nâng cao là stretch.
5. Claim chưa kiểm chứng bằng code hoặc hạ tầng phải gắn `[PROPOSED]` hoặc `[ASSUMED]`.

## Cấu trúc repo

```text
/apps/web/                 # Vite browser runtime
/services/api/             # Node HTTP API
/content/approved/         # approved scene/tour/QA/TTS/media metadata
/assets/                   # public static binaries
/tests/                    # contract, smoke, e2e, perf checks
```

## Quy ước đặt tên

- File và thư mục: `kebab-case`.
- Route HTTP: noun/action rõ nghĩa, ví dụ `/api/media/{sceneId}`.
- JSON key: `camelCase`.
- Biến môi trường: `UPPER_SNAKE_CASE`.
- Decision record: `docs/decisions/NNNN-short-title.md`.

## Quy ước code và content

- Tách UI, service, và provider/data adapter ở các boundary hiện có.
- Browser không gọi LLM/TTS provider trực tiếp khi API có capability tương ứng.
- Scene, tour, citation, và media manifest có schema riêng; không hardcode prose dài trong UI.
- Media manifest ở `content/approved/media/` là metadata-only: public path, role, format, byte length, preload policy, và process station binding.
- MP4 và non-guide FBX/GLB giữ lazy semantics; landing chỉ preload tuần tự `guide-model` + `guide-idle` khi browser xác nhận 4g, RAM >= 4 GiB, desktop pointer/viewport và không Data Saver; probe thiếu phải fail-closed. Full guide promotion chạy sau first render, không preload-all.
- Một lỗi stretch hoặc media không được làm hỏng luồng bắt buộc.

## Error handling

Mọi API dùng error object nhất quán:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message",
    "retryable": false,
    "traceId": "optional"
  }
}
```

- UI phải có loading, degraded fallback, và fail-with-recovery states.
- Q&A failure vẫn để người dùng đọc tour và citations tĩnh.
- TTS failure vẫn hiển thị transcript text.
- Media manifest failure chỉ degrade media elements; scene, approved 5-step tour, QA, và TTS phải tiếp tục usable.

## Testing tối thiểu

Trước demo chạy `npm test`, `npm run lint`, `npm run typecheck`, và `npm run build`.

- Browser smoke mở Vite-built runtime mà không có unresolved bare import.
- API contract giữ scene, tour 5 bước, và `/api/media/{sceneId}`.
- Media smoke xác nhận initial route chỉ warm module không mount WebGL; partial guide preload bị network/device-gate và chỉ gồm model + idle; MP4/non-guide FBX vẫn lazy, fallback render được, và process copy đến từ manifest đã duyệt.
- QA/TTS smoke xác nhận grounded citations hoặc degraded transcript.

## Accessibility và UX baseline

- Text chính dễ đọc trên mobile.
- Có nút bật/tắt âm thanh.
- Không buộc micro cho luồng bắt buộc.
- Có transcript cho audio.
- Có CTA rõ khi AR không hỗ trợ.

## Tài liệu liên quan

- [Kiến trúc hệ thống](./system-architecture.md)
- [API contract](./engineering/api-contract.md)
- [PRD](./product/prd.md)
