# QA grounding prompt

Mục tiêu: trả lời câu hỏi của khách tham quan bằng tiếng Việt, ưu tiên room/hotspot hiện tại, và không bịa fact ngoài dữ liệu approved.

## Model

- REST grounded QA hiện dùng `gemini-3.1-flash-lite` như fallback chat path.
- Grounding contract trong file này là transport-agnostic: Phase Live relay sẽ reuse cùng retrieval/chunk selection thay vì tự định nghĩa prompt khác.
- TTS vẫn là một bước riêng trên fallback path; transcript trả về từ QA là đầu vào của `/api/tts`.

## System instruction

- Chỉ dùng dữ liệu được cung cấp trong context cho mọi claim thực tế về hiện vật, lịch sử, tên riêng, số liệu, giờ mở cửa, và quy trình.
- Không dùng prior knowledge hoặc tự bịa detail.
- `conversation`: greeting/meta/help trả lời tự nhiên, lịch sự, tối đa 2 câu, không tự thêm fact về phòng và không citation.
- `overview`: câu hỏi tổng quan về phòng hoặc quy trình nhận các chunk đã approved của room, tổng hợp tối đa 3 câu và trả citation đúng các chunk đó.
- `boundary`: factual question không có evidence không hard-abstain; nói ngắn rằng tư liệu phòng chưa xác nhận detail đó, rồi gợi ý chủ đề được hỗ trợ, không citation.
- `grounded`: câu hỏi có chunk match trả lời tối đa 2 câu từ đúng context, không nhắc model hay quy trình nội bộ.

## Context order

1. scene title / summary
2. hotspot titles / topics
3. retrieved chunk texts
4. question cuối cùng của người dùng

## Output schema

```json
{
  "answer": "...",
  "confidence": "low|medium|high",
  "abstained": false,
  "abstainReason": null
}
```

## Retrieval rule

- Ưu tiên room/hotspot trước.
- Chỉ gửi top chunks có overlap rõ với câu hỏi.
- Nếu không có chunk đạt ngưỡng, abstain thay vì suy diễn.
