# DEC 0003 — Giải mã và chuyển đổi âm thanh phía Client (PCM Transcoding)

Cập nhật: 2026-07-19

## Context

Trình duyệt ghi âm bằng `MediaRecorder` trả về định dạng đóng gói có nén (như WebM chứa Opus trên Chrome/Edge, hoặc MP4 chứa AAC trên Safari). Trong khi đó, WebSocket của Gemini Live API chỉ chấp nhận dữ liệu âm thanh PCM thô (`audio/pcm;rate=16000` hoặc `audio/pcm;rate=24000`), 16-bit little-endian.

Nếu thực hiện giải mã (decoding) và hạ tần số lấy mẫu (downsampling) ở backend:
- Đòi hỏi cài đặt các thư viện nặng nề như FFmpeg, làm tăng dung lượng build của Docker image và chi phí vận hành backend.
- Làm tăng đáng kể độ trễ truyền tải (latency) vì backend phải nhận toàn bộ WebM blob, lưu lại, chạy bộ giải mã rồi mới kết nối WebSocket.
- Gây quá tải CPU cho máy chủ khi có hàng trăm du khách cùng hỏi hướng dẫn viên 3D đồng thời.

## Decision

Nhóm quyết định thực hiện toàn bộ luồng giải mã và chuyển đổi tần số lấy mẫu trực tiếp trên trình duyệt (client-side) bằng cách tận dụng các Web API tiêu chuẩn của HTML5:
1. Sử dụng `AudioContext.decodeAudioData` để giải mã dữ liệu WebM/MP4 nén thành dạng `AudioBuffer` thô một cách nhanh chóng.
2. Sử dụng `OfflineAudioContext` cấu hình tần số mẫu `16000Hz` để trình duyệt tự động thực hiện thuật toán nội suy và hạ tần số mẫu (resampling) về đúng chuẩn đầu vào của Gemini Live.
3. Chuyển đổi mảng Float32 thu được sang định dạng 16-bit Int16 Little-Endian PCM thô và mã hóa base64 trước khi gửi lên API.
4. Tái sử dụng một đối tượng `AudioContext` duy nhất thông qua hàm `getSharedAudioContext()` để tránh vượt quá giới hạn phần cứng của trình duyệt (thường là 6 contexts trên Chrome/Safari).

## Consequences

### Tốt

- **Hiệu năng cao & Độ trễ thấp:** Luồng audio được chuẩn hóa ngay lập tức khi người dùng thả nút ghi âm, giảm độ trễ xử lý tổng thể xuống dưới 2 giây.
- **Zero-Dependency Backend:** Backend giữ nguyên thiết kế cực kỳ gọn nhẹ (pure Node.js), không cần cài thêm các công cụ giải mã âm thanh phụ thuộc vào hệ điều hành.
- **Tiết kiệm tài nguyên:** Chia sẻ gánh nặng tính toán giải mã cho thiết bị của người dùng (edge computing), giúp server chịu tải tốt hơn.
- **Tiết kiệm băng thông:** Gửi đi luồng PCM 16kHz thô mono có dung lượng tối thiểu, phù hợp cho du khách sử dụng mạng 3G/4G yếu tại các khu vực làng nghề truyền thống.

### Xấu

- Phụ thuộc vào sự hỗ trợ của trình duyệt đối với Web Audio API (tuy nhiên Web Audio API hiện đã được hỗ trợ 100% trên các trình duyệt hiện đại).

## Review trigger

Chỉ mở lại DEC này khi các tiêu chuẩn đầu vào của Gemini Live API thay đổi (ví dụ: hỗ trợ trực tiếp các codec nén qua WebSocket).
