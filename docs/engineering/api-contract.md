# API contract

Cập nhật: 2026-07-18

## Trạng thái

- [OBSERVED] Node HTTP API phục vụ `scene`, `tour`, `media`, `qa`, `tts`, và Live QA voice.
- [ASSUMED] Production credential/provider cho chat và TTS vẫn phụ thuộc môi trường deploy.

## Nguyên tắc

- JSON over HTTPS.
- Client phụ thuộc vào API contract, không vào provider internals.
- Error response dùng shape thống nhất.
- Binary FBX/GLB/MP4 được phục vụ qua public static path; `/api/media` chỉ trả metadata.

## Endpoints

### `GET /api/scene/{sceneId}`

Trả metadata cảnh và `tourId`.

### `GET /api/tour/{tourId}`

Trả đúng 5 approved tour steps cho tour hiện tại.

### `GET /api/media/{sceneId}`

Trả approved metadata cho model/video của một scene, gồm cả preload policy để runtime phân biệt guide eager sau bootstrap với media lazy mặc định.

Response:

```json
{
  "manifestId": "scene-media-01",
  "sceneId": "tay-ho-giay-do-room-01",
  "status": "approved",
  "version": 1,
  "assets": [
    {
      "assetId": "process-video-01",
      "kind": "video",
      "format": "mp4",
      "publicPath": "/making_step/Buoc1_nau_do.mp4",
      "preload": "none"
    }
  ],
  "processStations": [
    {
      "stationId": "process-01",
      "order": 1,
      "title": "Nấu vỏ cây Dó",
      "narration": "...",
      "assetId": "process-video-01"
    }
  ]
}
```

Unknown scene trả HTTP 404:

```json
{
  "error": {
    "code": "MEDIA_MANIFEST_NOT_FOUND",
    "message": "Media manifest not found.",
    "retryable": false,
    "traceId": "..."
  }
}
```

### `POST /api/qa`

Nhận `sceneId` và `question`, sau đó trả grounded answer, citations, confidence, và boundary response không fabricated khi approved content không chứng minh được fact.

### `POST /api/tts`

Nhận transcript ngắn và voice option, trả audio hoặc transcript-only degraded response.

### `POST /api/qa/live`

Nhận typed/audio turn theo capability runtime; khi Live không khả dụng, client/API vẫn giữ REST grounded fallback và transcript.

### `GET /api/health`

Trả capability/health metadata để demo runtime.

## Error model

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

- Citation phải map về approved expert content.
- Approved 5-step tour độc lập với 10 media process stations.
- `assets[].preload` là runtime policy metadata; `"eager"` hiện chỉ dành cho guide assets promote sau shell/bootstrap, không phải signal để eager-load toàn bộ media ở initial route.
- API không trả factual QA content ngoài approved evidence.
