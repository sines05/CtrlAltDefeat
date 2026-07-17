# MVP 40h plan

Cập nhật: 2026-07-17

## Mục tiêu

Đưa ra một bản chạy được, không overbuild, trong 40 giờ cho team 4 người gồm 1 BA.

## Giả định phân vai [ASSUMED]

- 1 BA: chốt nội dung, script tour, citations, review scope.
- 1 người frontend: landing, tour, fallback, Q&A UI.
- 1 người backend/content: API nhẹ, data schema, grounding.
- 1 người integration/demo: asset, TTS, smoke test, demo polish.

## Phân bổ thời gian gợi ý [PROPOSED]

### Phase 1 — Chốt scope và data (6h)

- Chốt 1 cảnh chính.
- Chốt 5 bước tour.
- Chốt 10–20 khối dữ liệu chuyên gia ban đầu.
- Chốt danh sách stretch bị khóa.

### Phase 2 — Skeleton và entry flow (10h)

- Landing từ QR/marker.
- Layout mobile-first.
- Cảnh chính + fallback viewer.
- Tour navigation.

### Phase 3 — Q&A grounded và TTS (10h)

- Data schema cho content.
- API trả lời text grounded.
- TTS path tối thiểu.
- Transcript và error state.

### Phase 4 — Demo hardening (8h)

- Smoke test luồng bắt buộc.
- Fix các điểm AR/fallback.
- Chuẩn hóa copy và citation.

### Phase 5 — Buffer và go/no-go stretch (6h)

- Chỉ dành cho STT / lip-sync / WebAR nâng cao nếu core đã pass.
- Nếu core chưa pass, giữ buffer cho bugfix.

## Go / no-go criteria

### Go

- QR/marker mở được.
- Fallback chạy được.
- Tour 5 bước hoàn chỉnh.
- Q&A grounded hoạt động.
- TTS chạy được.

### No-go cho stretch

- Nếu asset chưa đủ.
- Nếu provider chưa ổn định.
- Nếu core demo còn hỏng trên mobile thật.

## Delivery checklist

- Một luồng chính chạy được end-to-end.
- Một luồng fallback rõ ràng.
- Một bộ câu hỏi mẫu và câu trả lời mẫu.
- Một bản demo có transcript và citation.
