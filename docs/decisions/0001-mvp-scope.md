# DEC 0001 — MVP scope

Cập nhật: 2026-07-17

## Context

Team có 40 giờ, 4 người, 1 BA, và một mục tiêu sản phẩm phải chạy được trước khi mở rộng. Scope quá rộng sẽ làm hỏng demo.

## Decision

Chốt MVP vào đường sau:

- QR hoặc image marker mở web.
- Một cảnh chính về nghệ nhân hoặc giấy dó.
- WebAR hoặc 3D viewer với fallback.
- Tour 5 bước.
- Q&A text grounded bằng dữ liệu chuyên gia.
- TTS bắt buộc.

## Không chốt trong MVP

- STT.
- Lip-sync.
- WebAR nâng cao nếu ảnh hưởng đường bắt buộc.

## Consequences

### Tốt

- Giảm rủi ro scope.
- Tập trung vào trải nghiệm có thể demo.
- Dễ kiểm chứng grounding và fallback.

### Xấu

- Một số tính năng hấp dẫn bị để lại cho sau.
- Cần kỷ luật không “trượt scope” khi còn thời gian.

## Go / no-go rules

- Nếu đường bắt buộc chưa pass smoke test, không bật stretch.
- Nếu asset hoặc provider chưa chắc, dùng fallback tĩnh trước.

## Review trigger

Chỉ mở lại DEC này khi có thay đổi lớn về timeline, asset, hoặc yêu cầu demo.
