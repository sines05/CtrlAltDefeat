# PRD

Cập nhật: 2026-07-17

## 1. Bối cảnh

VAIC 2026 PS142 cần một MVP 40 giờ cho 4 người, trong đó 1 BA, với trọng tâm là trải nghiệm di sản sống dễ demo, có grounding, và có fallback.

## 2. Mục tiêu

- Tạo một entrypoint web từ QR/image marker.
- Trình bày một cảnh về nghệ nhân hoặc giấy dó.
- Dẫn người dùng qua tour 5 bước.
- Cho phép hỏi đáp text dựa trên dữ liệu chuyên gia.
- Phát TTS cho nội dung cốt lõi.

## 3. Phạm vi bắt buộc

### 3.1 Experience entry

- Scan QR hoặc marker mở web.
- Không yêu cầu cài app.

### 3.2 Content view

- Một scene chính.
- Một đường fallback rõ ràng từ WebAR sang 3D viewer hoặc 2D.

### 3.3 Guided tour

- 5 bước.
- Mỗi bước có mục tiêu riêng.

### 3.4 Grounded Q&A

- Text Q&A là bắt buộc.
- Câu trả lời phải bám dữ liệu chuyên gia đã duyệt.
- Có citation hoặc nguồn tham chiếu ngắn.

### 3.5 TTS

- Ít nhất một phần tour hoặc một câu trả lời có audio.
- Có transcript text.

## 4. Stretch scope

- STT.
- Lip-sync.
- WebAR nâng cao.

Các mục này chỉ vào khi Gate 4 mở.

## 5. Persona và nhu cầu

- Khách tham quan muốn xem nhanh và nghe nhanh.
- Người xem online muốn mở trên điện thoại của họ.
- BA muốn nội dung đúng và kiểm soát được rủi ro demo.

## 6. User success metrics

- Thời gian vào trải nghiệm ngắn.
- Tour hoàn tất trên thiết bị demo.
- Q&A có câu trả lời hữu ích và không bịa.
- Fallback giữ trải nghiệm sống.

## 7. Acceptance criteria

1. QR/marker mở đúng landing page.
2. Scene chính tải được.
3. Tour 5 bước chạy được end-to-end.
4. Q&A text trả về grounded answer.
5. TTS phát được tối thiểu một đoạn.
6. Khi WebAR fail, fallback vẫn cho đi tiếp.

## 8. Ràng buộc

- [ASSUMED] Stack chưa chốt.
- [ASSUMED] Asset 3D chưa xác minh.
- [ASSUMED] Provider RAG/TTS chưa xác minh.
- [PROPOSED] One-repo MVP là mặc định.

## 9. Out of scope

- CMS đầy đủ.
- Multi-language nếu làm chậm MVP.
- Analytics sâu.
- Admin portal phức tạp.

## 10. Phụ thuộc

- Dữ liệu chuyên gia đã duyệt.
- Asset hình/3D/audio.
- Chọn stack ứng dụng.
- Quyết định provider grounding và TTS.

## 11. Tài liệu liên quan

- [Vision](./vision.md)
- [User stories](./user-stories.md)
- [User flow](../ux/user-flow.md)
- [MVP 40h](../engineering/mvp-40h.md)
- [Decision 0001](../decisions/0001-mvp-scope.md)
