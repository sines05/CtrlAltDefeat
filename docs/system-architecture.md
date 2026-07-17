# System architecture

Cập nhật: 2026-07-17

## Trạng thái hiện tại

- [OBSERVED] Repo chưa có ứng dụng chạy thực tế; hiện chỉ có harness và tài liệu khởi tạo.
- [PROPOSED] Kiến trúc dưới đây là bản mỏng để team có thể code trong 40 giờ mà vẫn giữ đường fallback.

## Mục tiêu kỹ thuật

- Mở trải nghiệm từ QR hoặc image marker.
- Hiển thị một cảnh về nghệ nhân hoặc giấy dó.
- Ưu tiên WebAR hoặc 3D viewer trên web; nếu AR lỗi thì fallback không vỡ luồng.
- Cung cấp tour 5 bước, Q&A dạng text có grounding, và TTS.

## Sơ đồ mức cao [PROPOSED]

```text
Người dùng mobile
  -> QR / image marker
  -> Web app trải nghiệm
      -> Scene/tour content
      -> 3D viewer hoặc WebAR layer
      -> Q&A UI + TTS controls
  -> API nhẹ
      -> Scene service
      -> Tour service
      -> Q&A/RAG service
      -> TTS adapter
  -> Content store đã duyệt
      -> scene metadata
      -> tour steps
      -> expert Q&A chunks
      -> citations
      -> TTS scripts
  -> Asset store/CDN
      -> ảnh, audio, GLB/USDZ nếu có
```

## Thành phần chính

### 1. Client web [PROPOSED]

Chịu trách nhiệm:
- mở từ QR hoặc image marker;
- phát hiện khả năng thiết bị;
- ưu tiên WebAR nếu đủ điều kiện;
- fallback sang 3D viewer hoặc nội dung 2D nếu cần;
- hiển thị tour, Q&A text, và transcript TTS.

### 2. API nhẹ [PROPOSED]

Chịu trách nhiệm:
- trả scene config cho client;
- trả dữ liệu tour 5 bước;
- nhận câu hỏi text và trả lời grounded;
- gọi provider TTS hoặc phát audio đã chuẩn bị sẵn.

### 3. Content store đã duyệt [PROPOSED]

Chứa dữ liệu có kiểm duyệt:
- hồ sơ hiện vật/cảnh;
- khối kiến thức chuyên gia dùng cho grounding;
- nguồn trích dẫn ngắn, rõ;
- script TTS.

### 4. Asset store/CDN [PROPOSED]

Chứa các file nặng như hình, âm thanh, model 3D nếu team có sẵn.

## Luồng runtime bắt buộc [PROPOSED]

1. Người dùng scan QR hoặc marker.
2. Client mở landing scene.
3. Client kiểm tra năng lực thiết bị.
4. Nếu WebAR sẵn sàng thì tải trải nghiệm AR; nếu không thì mở viewer thường.
5. Người dùng đi qua tour 5 bước.
6. Người dùng đặt câu hỏi text.
7. API trả lời grounded kèm citation.
8. Người dùng nghe TTS hoặc đọc transcript.

## Fallback ladder [PROPOSED]

1. WebAR marker-based.
2. 3D viewer trong web.
3. Ảnh/slide + hotspot + text.

Stretch feature không được chen vào giữa ladder này.

## Decision gates

### Gate A — stack ứng dụng

- [ASSUMED] Chưa có stack được chốt.
- Cần quyết định: web thuần hay framework frontend; backend serverless hay service riêng.
- Chỉ sau gate này mới khóa cấu trúc thư mục thật.

### Gate B — 3D/AR asset

- [ASSUMED] Chưa xác nhận có GLB/USDZ hay asset tối ưu mobile.
- Nếu không có asset đủ chất lượng, demo ưu tiên 2D/3D viewer nhẹ trước.

### Gate C — RAG/TTS provider

- [ASSUMED] Chưa xác nhận provider, quota, chi phí, latency.
- Nếu chưa chốt kịp, dùng bộ trả lời giới hạn theo dữ liệu đã duyệt và audio dựng sẵn.

### Gate D — stretch features

- STT, lip-sync, WebAR nâng cao chỉ bật khi luồng bắt buộc đã ổn và có thời gian test thiết bị thật.

## Non-functional baseline [PROPOSED]

- Mobile-first.
- Khởi động luồng chính nhanh trên mạng di động ổn định.
- Có degraded mode rõ ràng khi AR hoặc AI service lỗi.
- Không phụ thuộc micro cho use case bắt buộc.
- Log tối thiểu cho demo: scene load, fallback hit, QA request, TTS play.

## Tài liệu liên quan

- [Code standards](./code-standards.md)
- [Vision](./product/vision.md)
- [PRD](./product/prd.md)
- [API contract](./engineering/api-contract.md)
- [RAG content schema](./engineering/rag-content-schema.md)
- [Decision 0001](./decisions/0001-mvp-scope.md)
