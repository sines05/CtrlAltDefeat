# Code standards

Cập nhật: 2026-07-17

## Trạng thái hiện tại

- [OBSERVED] Repo hiện chỉ có SDLC harness và chưa có app code, `src/`, `app/`, `package.json`, `pyproject.toml` hay test runtime.
- [PROPOSED] Tài liệu này là chuẩn khởi tạo để team code thống nhất ngay từ vòng MVP 40 giờ.

## Nguyên tắc làm MVP

1. Ưu tiên đường đi chắc chắn: QR hoặc image marker mở web, xem nội dung được trên điện thoại phổ thông.
2. Có fallback trước rồi mới thêm WebAR: nếu AR lỗi, người dùng vẫn xem được 3D viewer hoặc nội dung 2D.
3. Chỉ ship nội dung đã được chuyên gia duyệt cho RAG và tour.
4. Text Q&A và TTS là bắt buộc; STT, lip-sync, WebAR nâng cao là stretch.
5. Mọi claim chưa kiểm chứng bằng code hoặc hạ tầng phải gắn `[PROPOSED]` hoặc `[ASSUMED]`.

## Cấu trúc repo đề xuất

- [PROPOSED] Chỉ chốt khi team chọn stack tại decision gate đầu tiên.
- [PROPOSED] Nếu làm một repo cho MVP, dùng cấu trúc mỏng sau:

```text
/docs/
  code-standards.md
  system-architecture.md
  product/
  engineering/
  operations/
  decisions/
/apps/
  web/          # frontend trải nghiệm khách tham quan
/services/
  api/          # backend nhẹ cho scene, Q&A, TTS
/content/
  approved/     # dữ liệu chuyên gia đã duyệt, citations, scripts
/tests/         # smoke test tối thiểu cho luồng bắt buộc
```

## Quy ước đặt tên

- File và thư mục: `kebab-case`.
- Route HTTP: danh từ số nhiều hoặc action rõ nghĩa, ví dụ `[PROPOSED] /api/scenes/{id}`.
- JSON key: `camelCase`.
- Biến môi trường: `UPPER_SNAKE_CASE`.
- Decision record: `docs/decisions/NNNN-short-title.md`.

## Quy ước tài liệu và evidence

- Dùng nhãn `[OBSERVED]`, `[PROPOSED]`, `[ASSUMED]` nhất quán.
- Không ghi "đã hỗ trợ" nếu chưa có code chạy thật.
- Khi chốt provider hoặc framework, cập nhật đồng thời:
  - `docs/system-architecture.md`
  - `docs/engineering/api-contract.md`
  - `docs/operations/deployment.md`
  - decision record liên quan

## Quy ước code đề xuất

- [PROPOSED] Tách ba lớp tối thiểu: UI, application/service, data/provider adapter.
- Không gọi trực tiếp provider LLM/TTS/STT từ view nếu có backend.
- Scene data, tour data, citation data phải có schema riêng; không hardcode text dài trong UI.
- Một lỗi ở tính năng stretch không được làm hỏng luồng bắt buộc.

## Error handling

- [PROPOSED] Mọi API trả object lỗi nhất quán:

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

- UI phải có 3 trạng thái rõ: loading, degraded fallback, fail with recovery action.
- Nếu Q&A thất bại, vẫn cho người dùng đọc nội dung tour và citations tĩnh.
- Nếu TTS thất bại, vẫn hiển thị transcript text.

## Testing tối thiểu cho MVP

- [PROPOSED] Trước demo phải có smoke test cho:
  1. QR/image marker mở đúng landing page.
  2. Tải được scene nghệ nhân hoặc giấy dó.
  3. Fallback từ WebAR sang viewer thường hoạt động.
  4. Q&A text trả lời có citation hoặc nguồn chuyên gia.
  5. TTS đọc được ít nhất 1 đoạn tour.

## Accessibility và UX baseline

- Text chính dễ đọc trên mobile.
- Có nút bật/tắt âm thanh.
- Không buộc người dùng cấp micro cho các luồng bắt buộc.
- Có transcript cho audio.
- Có CTA rõ khi AR không hỗ trợ.

## Decision gates bắt buộc trước khi code nhiều

1. Chốt stack frontend/backend [PROPOSED].
2. Chốt nguồn dữ liệu chuyên gia ban đầu [ASSUMED].
3. Chat model đã khóa vào Gemini 3.1 Flash Lite cho grounded answer; provider TTS production vẫn phải chốt trước khi ship [OBSERVED/ASSUMED].
4. Chốt mức WebAR mục tiêu: marker-based tối thiểu hay full surface/object tracking [PROPOSED].

## Tài liệu liên quan

- [Tổng quan dự án / PDR](./project-overview-pdr.md)
- [Kiến trúc hệ thống](./system-architecture.md)
- [PRD](./product/prd.md)
- [Kế hoạch MVP 40 giờ](./engineering/mvp-40h.md)
