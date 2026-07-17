# Deployment

Cập nhật: 2026-07-17

## Trạng thái

- [ASSUMED] Chưa chốt môi trường chạy cuối cùng.
- [PROPOSED] MVP nên ưu tiên một đường deploy đơn giản để giảm rủi ro demo.

## Mục tiêu deploy

- Mở được từ QR/marker trên điện thoại thật.
- Có URL demo ổn định.
- Có cách inject secret an toàn.
- Có thể rollback nhanh nếu hỏng.

## Môi trường đề xuất [PROPOSED]

### Local

- Chạy để dev và smoke test.
- Dùng dữ liệu mẫu đã duyệt.

### Demo/staging

- Dùng để trình bày với người chấm hoặc stakeholder.
- Không cần full infra phức tạp.

## Quy trình deploy tối thiểu

1. Chốt content và asset.
2. Build web app.
3. Deploy API/static host.
4. Gắn QR/marker trỏ về URL demo.
5. Test trên ít nhất một thiết bị thật.

## Secret management

- [PROPOSED] Không commit secret vào repo.
- Dùng biến môi trường hoặc secret store của nền tảng deploy.
- Tách key cho provider TTS / RAG nếu có.

## Rollback

- Giữ bản deploy trước đó còn truy cập được.
- Nếu WebAR fail, rollback sang fallback viewer vẫn phải chạy.
- Nếu provider ngoài lỗi, chuyển sang content tĩnh hoặc audio dựng sẵn.

## Go-live checklist

- URL demo hoạt động.
- QR/marker đã in hoặc export đúng link.
- Q&A và TTS chạy với quota còn đủ.
- Fallback được test trên mobile.
- Có người chịu trách nhiệm on-call cho buổi demo.
