# DEC 0005 — Trực quan hóa Landing Page và Tối ưu hóa Tải chậm (Lazy-Loading WebGL)

Cập nhật: 2026-07-19

## Context

Các cảnh quan 3D tương tác sử dụng Three.js/WebGL thường tiêu tốn lượng tài nguyên lớn (RAM, GPU). Nếu người dùng trực tiếp truy cập vào cảnh 3D ngay khi vừa mở trang:
- Thiết bị cấu hình thấp hoặc thiết bị di động (mobile) rất dễ bị đứng hình (freeze) hoặc sập trình duyệt do quá tải bộ nhớ (out-of-memory).
- Trình duyệt sẽ chặn toàn bộ các nỗ lực tự động phát âm thanh (autoplay) của AudioContext hoặc SpeechSynthesis do chưa nhận được tương tác click chuột chủ động từ người dùng (user gesture).
- Tốc độ tải trang đầu tiên (First Contentful Paint) sẽ rất chậm do phải chờ tải các mô hình 3D (.fbx, .glb) dung lượng lớn.

## Decision

Nhóm quyết định xây dựng một trang Landing Page trực quan làm cổng chào (Onboarding Gate) và thực hiện cơ chế tải chậm (lazy-loading) cho toàn bộ không gian 3D:
1. **Landing Page Nhẹ & Tối ưu SEO:** Khi truy cập trang web, chỉ có Landing Page HTML/CSS được tải. Trang này chứa thông tin giới thiệu lịch sử Giấy Dó, hình ảnh minh họa quy trình sản xuất và hướng dẫn du khách.
2. **Kích hoạt bằng cử chỉ người dùng (User Gesture Gate):** Không gian WebGL 3D, vòng lặp render, và bộ điều phối âm thanh (`sharedAudioCtx`) chỉ được khởi tạo khi người dùng click chủ động vào nút **"Bắt đầu tham quan"** (Start Tour) trên Landing Page.
3. **Lazy Preloading:** Các tài nguyên nặng (3D models, audio file thuyết minh) được tải ngầm (preloaded) tuần tự sau khi WebGL được mở, thay vì chặn luồng chính lúc mở trang.

## Consequences

### Tốt

- **Tối ưu hóa thiết bị di động:** Ngăn ngừa 100% rủi ro sập trình duyệt trên các dòng điện thoại thông minh cũ của du khách khi tham quan làng nghề.
- **Mở khóa Audio Context tự nhiên:** Thao tác bấm nút "Bắt đầu tham quan" đóng vai trò là tương tác hợp lệ mở khóa quyền phát âm thanh của trình duyệt, giúp luồng Q&A Live Voice và Narration tự động phát mà không gặp trở ngại.
- **Chỉ số FCP xuất sắc:** Landing Page hiển thị tức thì, tạo cảm giác mượt mà và nâng cao trải nghiệm người dùng (UX).

### Xấu

- Du khách cần thực hiện thêm một thao tác click chuột để bắt đầu tham quan không gian 3D (tuy nhiên đây là bước đệm Onboarding cần thiết để giới thiệu bối cảnh).

## Review trigger

DEC này sẽ được mở lại nếu có yêu cầu tích hợp trực tiếp không gian 3D vào màn hình khởi động mà không qua trang đệm.
