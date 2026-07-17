# RAG content schema

Cập nhật: 2026-07-17

## Mục tiêu

Giữ dữ liệu grounding gọn, truy được nguồn, và đủ để BA kiểm soát nội dung.

## Thực thể lõi [PROPOSED]

### 1. `ContentSource`

Nguồn gốc của dữ liệu.

```json
{
  "sourceId": "expert-01",
  "title": "Ghi chú chuyên gia",
  "type": "interview|paper|script|archive",
  "owner": "BA",
  "status": "approved"
}
```

### 2. `RagChunk`

Khối kiến thức nhỏ dùng cho grounding.

```json
{
  "chunkId": "chunk-001",
  "sourceId": "expert-01",
  "sceneId": "artisan-woodblock",
  "topic": "paper-making",
  "text": "...",
  "keywords": ["giấy dó", "xơ", "thủ công"],
  "citation": "Nguồn chuyên gia 1"
}
```

### 3. `TourStep`

Bước tour 5 bước.

```json
{
  "stepId": "1",
  "sceneId": "artisan-woodblock",
  "title": "Mở cảnh",
  "body": "...",
  "mediaRef": "...",
  "ttsText": "...",
  "citations": ["chunk-001"]
}
```

### 4. `QaExample`

Câu hỏi mẫu để smoke test.

```json
{
  "question": "Giấy dó làm từ gì?",
  "expectedAnswerHints": ["xơ", "nguồn chuyên gia"],
  "sourceIds": ["expert-01"]
}
```

## Quy tắc dữ liệu

- Mỗi chunk phải có nguồn.
- Mỗi câu trả lời QA phải truy được ít nhất một citation.
- Nội dung tour và Q&A phải dùng cùng bộ thuật ngữ.
- Không lưu các claim chưa được BA hoặc chuyên gia duyệt.

## Schema tối thiểu cho thư mục content [PROPOSED]

```text
content/approved/
  sources/
  chunks/
  tours/
  qa-examples/
  tts/
```

## Decision gate

- Nếu chưa có dữ liệu chuyên gia đủ tốt, không mở rộng RAG; chỉ demo bằng bộ content nhỏ nhưng chắc.
