# API contract

Cập nhật: 2026-07-17

## Trạng thái

- [OBSERVED] Repo có backend Node HTTP cho `scene`, `tour`, `qa`, và `tts`.
- [OBSERVED] `POST /api/qa` đang là đường grounded answer cho room hiện tại và được nâng từ exact-match sang retrieval-backed chat.
- [ASSUMED] Credential/provider production cho chat và TTS vẫn phụ thuộc môi trường deploy.

## Nguyên tắc

- JSON over HTTPS.
- Client chỉ dựa vào contract, không dựa vào provider trực tiếp nếu có backend.
- Mọi lỗi dùng shape thống nhất từ `docs/code-standards.md`.

## Endpoints đề xuất [PROPOSED]

### `GET /api/scene/{sceneId}`

Trả metadata cho cảnh chính.

Response
```json
{
  "sceneId": "artisan-woodblock",
  "title": "Nghệ nhân / giấy dó",
  "entryMode": "qr",
  "fallbackMode": "viewer",
  "assets": [],
  "tourId": "tour-01"
}
```

### `GET /api/tour/{tourId}`

Trả 5 bước tour.

Response
```json
{
  "tourId": "tour-01",
  "steps": [
    { "stepId": "1", "title": "Mở cảnh", "body": "..." }
  ]
}
```

### `POST /api/qa`

Nhận câu hỏi text, retrieve chunk theo `sceneId`, rồi dùng chat model để trả lời grounded hoặc abstain nếu bằng chứng không đủ.

Request
```json
{
  "sceneId": "artisan-woodblock",
  "question": "Giấy dó khác gì giấy thường?"
}
```

Response
```json
{
  "answer": "...",
  "citations": [
    { "label": "Nguồn chuyên gia 1", "ref": "content/approved/source-1" }
  ],
  "confidence": "medium",
  "abstained": false,
  "abstainReason": null
}
```

### `POST /api/tts`

Sinh hoặc trả về audio cho transcript ngắn, thường là câu trả lời vừa được grounded từ `/api/qa` hoặc một câu tour ngắn.

Request
```json
{
  "text": "...",
  "voice": "default"
}
```

Response
```json
{
  "audioUrl": "https://...",
  "transcript": "..."
}
```

### `GET /api/health`

Kiểm tra service sống để demo.

Response
```json
{ "ok": true }
```

## Error model [PROPOSED]

```json
{
  "error": {
    "code": "QA_UNAVAILABLE",
    "message": "Không trả lời được ngay lúc này.",
    "retryable": true,
    "traceId": "..."
  }
}
```

## Notes

- Nếu không chốt backend runtime, có thể mock contract bằng static JSON để demo.
- Citation phải map về dữ liệu chuyên gia đã duyệt.
- Không để API trả nội dung chưa grounded ở đường QA bắt buộc.
