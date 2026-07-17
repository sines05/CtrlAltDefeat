# User flow

Cập nhật: 2026-07-17

## Luồng chính [PROPOSED]

### 0. Điểm vào

- Người dùng nhìn thấy QR hoặc image marker.
- Scan xong mở web trên mobile.

### 1. Landing

- Hiển thị tiêu đề ngắn.
- Nói rõ đây là trải nghiệm di sản sống.
- Có CTA bắt đầu.

### 2. Chuẩn bị hiển thị

- Client kiểm tra thiết bị.
- Nếu đủ điều kiện thì vào WebAR.
- Nếu không, vào 3D viewer hoặc 2D fallback.

### 3. Cảnh chính

- Người dùng thấy một cảnh về nghệ nhân hoặc giấy dó.
- Có điểm nhấn thị giác và một mô tả rất ngắn.

### 4. Tour 5 bước

1. Giới thiệu bối cảnh.
2. Xem vật liệu / quy trình.
3. Xem kỹ thuật / thao tác.
4. Xem ý nghĩa văn hóa.
5. Kết thúc và gợi mở câu hỏi.

### 5. Hỏi đáp

- Người dùng nhập câu hỏi text.
- Hệ thống trả lời ngắn, grounded, có nguồn.
- Nếu không đủ dữ liệu, trả lời bảo thủ và chỉ ra giới hạn.

### 6. TTS

- Người dùng bấm play để nghe một đoạn tour hoặc một câu trả lời.
- Transcript luôn hiện trên màn hình.

## Fallback flow

- Nếu WebAR fail: chuyển sang viewer thường.
- Nếu viewer fail: chuyển sang ảnh + hotspot + text.
- Nếu TTS fail: giữ transcript text.
- Nếu Q&A fail: giữ tour tĩnh và citation tĩnh.

## UI notes

- Nút chính phải rõ một chạm.
- Không ép dùng micro.
- Không giấu transcript.
- Không để người dùng rơi vào màn hình trống.

## Điều cần kiểm trên thiết bị thật

- Khởi tạo camera / AR permission.
- Hiển thị tốt trên màn hình dọc.
- Đọc được text trên mạng di động.
- Chuyển fallback không mất ngữ cảnh.
