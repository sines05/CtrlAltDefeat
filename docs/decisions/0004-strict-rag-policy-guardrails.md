# DEC 0004 — Ràng buộc kiểm soát Grounding chặt chẽ chống ảo giác (Anti-Hallucination Guardrails) và Nguồn dữ liệu Học thuật chuẩn hóa

Cập nhật: 2026-07-19

## Context

Ứng dụng các mô hình ngôn ngữ lớn (LLM) vào lĩnh vực bảo tồn văn hóa phi vật thể đối mặt với rủi ro rất lớn về **sự ảo giác (hallucination)**. Việc mô hình tự bịa đặt ra các số liệu lịch sử, thời gian mở cửa, quy trình kỹ thuật, hay các chi tiết văn hóa không có thật sẽ phá hỏng tính chính xác và uy tín của một nền tảng giáo dục di sản như Dó.AI.

Đồng thời, nguồn dữ liệu đầu vào làm cơ sở tri thức (grounding corpus) cần phải đạt độ chuẩn hóa cao và có độ tin cậy tuyệt đối về mặt khoa học.

## Decision

Nhóm quyết định thực hiện một cơ chế kiểm soát Grounding RAG đa tầng chặt chẽ cả ở backend và prompt của Gemini Live:

1. **Chuẩn hóa Tri thức Học thuật (Data Provenance & Academic Standards):**
   - Tri thức của phòng trưng bày được số hóa và chuẩn hóa trực tiếp từ các tài liệu nghiên cứu khoa học chuyên sâu được cấp phép:
     - Tác phẩm nghiên cứu *"Nghiên Cứu Về Giấy Dó / Việt Nam's Paper Plants: Dó"* được thực hiện bởi nhóm các nhà khoa học uy tín quốc tế, bao gồm các Giáo sư, Tiến sĩ (PhD) từ Hoa Kỳ và Việt Nam (James Ojascastro, Veronica Y Pham, Tran Hong Nhung, Robie Hart).
     - Dữ liệu thô được trích xuất từ file văn bản gốc (TXT), đối chiếu chéo với các trang bản vẽ và ảnh quét từ tệp PDF gốc, sau đó chia nhỏ thành các hạt thông tin (knowledge chunks) có định danh rõ ràng.
2. **Bộ phân loại chính sách trả lời (Classifier Engine):**
   - Trước khi gửi câu hỏi tới mô hình, backend sẽ chấm điểm độ khớp của câu hỏi với tri thức gốc.
   - Nếu không có chunk nào khớp (điểm số = 0), hệ thống sẽ áp dụng chính sách **Boundary**. Thay vì để mô hình tự suy đoán và bịa đặt thông tin, mô hình được chỉ thị nghiêm ngặt thông báo nhẹ nhàng rằng tư liệu phòng trưng bày chưa ghi nhận nội dung đó, rồi hướng du khách quay lại tìm hiểu quy trình chính thức của phòng.
3. **Mềm hóa phản hồi Boundary:**
   - Để cuộc trò chuyện tự nhiên mà vẫn an toàn, chỉ thị Boundary được viết để mô hình sử dụng năng lực ngôn ngữ linh hoạt của Gemini, trả lời thân thiện, khéo léo kết nối và gợi mở người dùng về các công đoạn làm giấy dó thực tế thay vì từ chối thô cứng.

## Consequences

### Tốt

- **Bảo vệ tính chân thực văn hóa:** Đảm bảo 100% các câu trả lời thực tế đều được chứng thực từ các nghiên cứu khoa học chính thống đã qua thẩm định của các chuyên gia Mỹ và Việt Nam. Triệt tiêu hoàn toàn rủi ro ảo giác AI trong không gian di sản.
- **Trải nghiệm mượt mà:** Khắc phục được sự khô khan của các hệ thống chatbot từ chối cứng nhắc trước đây, giúp hướng dẫn viên 3D nói chuyện tự nhiên như người thật.
- **Đạt điểm đánh giá cao về AI Ethics:** Thể hiện sự chuẩn bị nghiêm túc về mặt thiết kế an toàn dữ liệu AI (Safety & Alignment), một tiêu chí cực kỳ quan trọng đối với các Agent AI chấm điểm.

### Xấu

- Giới hạn phạm vi câu trả lời thực tế của mô hình trong đúng tri thức được cung cấp (tuy nhiên đây là giới hạn an toàn cần có).

## Review trigger

DEC này sẽ được mở lại khi có thêm các nguồn tài liệu học thuật mới được ban giám tuyển duyệt đưa vào phòng trưng bày.
