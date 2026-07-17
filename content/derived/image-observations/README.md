# Image observations — Bảo tàng Giấy Dó Tây Hồ

Trạng thái: **derived_unverified**. Đây là lớp mô tả được tạo từ ảnh bằng agent vision Haiku, chưa phải content đã duyệt và không được dùng làm nguồn grounding cuối cùng nếu chưa review.

## Tệp

- `images.json`: dataset đầy đủ, giữ cấu trúc lồng nhau.
- `images.csv`: bản phẳng để lọc, biên tập và import.

## Phạm vi

- 78 ảnh gốc được quét, mỗi ảnh một record.
- 74 nội dung file duy nhất; 4 nhóm trùng byte được giữ lại dưới dạng alias, không xóa file gốc.
- Metadata file được tính lại từ `assets/images/`: kích thước, dung lượng, SHA-256, hướng ảnh.
- Mỗi record giữ `evidence_scope=image_only`, `evidence_status=derived_unverified` và `confidence` trong khoảng 0–1.

## Cách dùng

Dùng `display_type`, `possible_process_stage`, `keywords_vi` và `caption_vi` để dựng index/visual narrative. Dùng `visible_text` làm bản nháp OCR/transcription, không coi là bản dịch hoặc bản chép đã hiệu đính.

Các record có `process_stage_basis=inference` là suy luận từ hình ảnh; cần gắn nhãn rõ nếu đưa vào sản phẩm. Các bản trùng có `duplicate_of` trỏ về file chính; giữ alias để không làm hỏng tham chiếu hiện có.

## Giới hạn

Ảnh chủ yếu ghi lại mô hình, tranh, bảng chú thích và hiện vật trong không gian trưng bày. Dataset không xác nhận quy trình sản xuất hiện nay, danh tính nhân vật, lịch sử bảo tàng hoặc quyền sử dụng hình ảnh.
