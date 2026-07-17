# Project overview / PDR

Cập nhật: 2026-07-17

## 1. Tóm tắt

- Dự án: VAIC 2026 PS142 Reviving Living Heritage.
- Bối cảnh team: 4 người, gồm 1 BA.
- Giới hạn: MVP trong 40 giờ.
- [OBSERVED] Repo hiện chưa có app code; bộ tài liệu này đóng vai trò mốc khởi tạo.

## 2. Mục tiêu sản phẩm

Xây một trải nghiệm di sản sống trên mobile: người dùng scan QR hoặc image marker để mở web, xem cảnh về nghệ nhân hoặc giấy dó, theo tour 5 bước, hỏi đáp bằng text dựa trên dữ liệu chuyên gia, và nghe TTS.

## 3. Phạm vi MVP bắt buộc

1. QR hoặc image marker mở đúng web entry.
2. Một cảnh nội dung về nghệ nhân hoặc giấy dó.
3. WebAR hoặc 3D viewer có fallback rõ.
4. Tour 5 bước.
5. Q&A text grounded bằng dữ liệu chuyên gia.
6. TTS cho ít nhất phần tour hoặc câu trả lời ngắn.

## 4. Stretch scope có gate

- STT.
- Lip-sync.
- WebAR nâng cao vượt quá fallback cơ bản.

Chỉ làm khi luồng bắt buộc đã ổn trên thiết bị thật.

## 5. Functional requirements

- Người dùng vào được trải nghiệm trong ít thao tác.
- Mỗi bước tour có text ngắn, media phù hợp, CTA sang bước tiếp.
- Q&A không bịa nguồn; nếu không chắc, trả lời bảo thủ.
- TTS có transcript nhìn thấy được.

## 6. Non-functional requirements

- Mobile-first.
- Dễ demo trực tiếp.
- Có degraded mode khi AR hoặc AI provider lỗi.
- Nội dung chuyên gia phải có nguồn nội bộ rõ.

## 7. Ràng buộc và giả định

- [ASSUMED] Chưa chốt stack, provider, hosting.
- [ASSUMED] Chưa xác nhận asset 3D sẵn có.
- [ASSUMED] Chưa xác nhận bộ dữ liệu chuyên gia cuối cùng.
- [PROPOSED] Một repo duy nhất là phương án gọn nhất cho hackathon.

## 8. Acceptance criteria cho MVP demo

- Có thể mở từ QR hoặc marker trên ít nhất một điện thoại demo.
- Có thể hoàn thành tour 5 bước mà không cần tính năng stretch.
- Có thể đặt ít nhất 3 câu hỏi text mẫu và nhận câu trả lời grounded.
- Có thể phát ít nhất 1 audio TTS.
- Khi AR không chạy, trải nghiệm vẫn tiếp tục qua fallback.

## 9. Decision gates

- Gate 1: chốt stack trước khi dựng skeleton app.
- Gate 2: chốt asset và scene chính trước khi làm UX chi tiết.
- Gate 3: chốt provider Q&A/TTS trước khi nối runtime service.
- Gate 4: chỉ bật stretch khi smoke test luồng bắt buộc đã pass.

## 10. Tài liệu điều hướng

- [Vision](./product/vision.md)
- [PRD](./product/prd.md)
- [User stories](./product/user-stories.md)
- [User flow](./ux/user-flow.md)
- [MVP 40h](./engineering/mvp-40h.md)
- [Deployment](./operations/deployment.md)
