# User stories

Cập nhật: 2026-07-17

## Persona

- Khách tham quan.
- Người xem online.
- BA / người vận hành nội dung.

## Story map

### 1. Vào trải nghiệm

**Là** khách tham quan, **tôi muốn** scan QR hoặc marker để mở web ngay, **để** bắt đầu xem nhanh.

**AC**
- Mở đúng landing page.
- Không cần đăng nhập.
- Có mô tả ngắn về cách dùng.

### 2. Xem cảnh chính

**Là** người xem, **tôi muốn** thấy một cảnh về nghệ nhân hoặc giấy dó, **để** hiểu chủ đề trong vài giây.

**AC**
- Scene tải được trên mobile.
- Có fallback nếu WebAR không sẵn sàng.

### 3. Đi tour 5 bước

**Là** người xem, **tôi muốn** đi qua 5 bước có dẫn dắt, **để** không bị lạc.

**AC**
- Có bước hiện tại và bước tiếp theo.
- Mỗi bước có text ngắn.

### 4. Hỏi đáp text

**Là** người xem, **tôi muốn** hỏi bằng text, **để** nhận câu trả lời có nguồn.

**AC**
- Trả lời grounding theo dữ liệu chuyên gia.
- Nếu không chắc, hệ thống nói rõ giới hạn.
- Có citation hoặc nguồn tham chiếu.

### 5. Nghe TTS

**Là** người xem, **tôi muốn** nghe một đoạn đọc tự động, **để** trải nghiệm sống hơn.

**AC**
- Có nút play/pause.
- Có transcript.
- Nếu audio lỗi thì vẫn đọc text được.

### 6. Kiểm soát nội dung

**Là** BA, **tôi muốn** biết phần nào là bắt buộc và phần nào là stretch, **để** giữ scope trong 40 giờ.

**AC**
- Có nhãn scope rõ.
- Có decision gate cho stretch.

## Ưu tiên

1. Ingress + scene + fallback.
2. Tour 5 bước.
3. Q&A grounded.
4. TTS.
5. Stretch features.
