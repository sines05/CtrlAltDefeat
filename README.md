# Dó.AI

Dó.AI là một MVP 48 giờ cho trải nghiệm di sản giấy dó trên điện thoại: vào từ QR/web, đi theo tour có dẫn dắt, rồi hỏi lại bằng grounded AI thay vì chatbot tự bịa.

## Repo này đang chứng minh điều gì?

- Một **mobile-first museum walkthrough** mở trên web, không yêu cầu cài app.
- Một **tour 5 bước** giúp người xem hiểu nhanh quy trình thay vì chỉ đọc bảng thông tin tĩnh.
- Một lớp **grounded Q&A + TTS + voice** bám nội dung đã duyệt, để AI đóng vai trò truy cập và diễn giải, không làm sai lệch dữ liệu văn hóa.
- Một runtime có **degraded fallback**: media hoặc voice lỗi thì phần còn lại của trải nghiệm vẫn usable.

## Vì sao bài toán này khó hơn vẻ bề ngoài?

Đây không chỉ là một demo 3D hoặc một chatbot bọc ngoài bảo tàng. Repo hiện tại đang ghép cùng lúc nhiều lớp thường bị tách rời:
- web runtime 3D/Vite;
- approved content store cho scene, tour, chunks, TTS, media manifest;
- grounded QA boundary để tránh hallucination;
- guide voice path có fallback;
- static media delivery và degraded behavior để demo không gãy khi hạ tầng hoặc thiết bị không hoàn hảo.

Trong phạm vi 48 giờ, khối lượng này được ưu tiên theo hướng **đường đi tin cậy trước, độ hào nhoáng sau**.

## AI đang tạo giá trị ở đâu?

AI trong repo này không được dùng như lớp “wow factor” chung chung. Nó đang được đặt vào ba vai trò hẹp nhưng có giá trị thật:

1. **Grounded answer layer**
   - câu trả lời bám approved chunks;
   - có citation khi câu hỏi thuộc corpus;
   - có boundary/fallback khi dữ liệu không chứng minh được fact.

2. **Voice access layer**
   - người xem có thể hỏi bằng text hoặc giọng nói;
   - hướng dẫn viên phát lại câu trả lời bằng audio khi có thể;
   - nếu Live/TTS lỗi, transcript và trải nghiệm cốt lõi vẫn giữ được.

3. **Cultural trust layer**
   - repo ưu tiên nội dung đã duyệt hơn là sinh tự do;
   - đây là quyết định quan trọng với bài toán di sản, nơi sai lệch nhỏ cũng làm giảm độ tin cậy của sản phẩm.

## Kiến trúc hiện tại, rất ngắn

- `apps/web/` — Vite browser runtime.
- `services/api/` — Node HTTP API cho scene, tour, media, QA, TTS, Live voice.
- `content/approved/` — approved scene/tour/chunks/TTS/media metadata.
- `assets/` + public static paths — FBX, GLB, MP4.
- `tests/` — contract, smoke, e2e, perf/docs checks.

Xem thêm: `docs/system-architecture.md`, `docs/engineering/api-contract.md`, `docs/product/vision.md`.

## Những gì đang chạy được

- scene + tour 5 bước;
- approved media manifest qua `/api/media/{sceneId}`;
- grounded QA/TTS;
- guide voice integration ở mức gesture + audio playback;
- browser/build/test gates cho media runtime và docs contract.

## Deferred issues đã biết

Repo này không giả vờ mọi thứ đã hoàn hảo. Một số media/runtime lệch pha đã được nhận diện và để dành cho pass sau, ví dụ:
- guide animated assets hiện chưa đạt lazy-load đúng mục tiêu ban đầu;
- một phần scene-prop lazy activation còn cần siết lại trong guided flow;
- shared model registry còn một số nợ kỹ thuật quanh GLB role/loader alignment.

Các điểm này không phủ nhận giá trị của MVP hiện tại; chúng phản ánh đúng trade-off của một build 48 giờ đang cố ship đồng thời 3D runtime, approved-content architecture, và grounded AI.

## Cách đọc repo nhanh nhất

1. `docs/submission-overview.md` — submission framing rất ngắn cho người mới vào repo.
2. `docs/product/vision.md` — bài toán và giá trị cốt lõi.
3. `docs/system-architecture.md` — kiến trúc thực tế đang có.
4. `docs/engineering/api-contract.md` — các contract chính.
5. `tests/e2e/` và `tests/api/` — các đường chạy mà repo đang tự chứng minh.

## Sanity check

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Mục tiêu của repo này không phải “AI vì AI”. Mục tiêu là biến một chủ đề di sản rất dễ bị làm tĩnh, dài, và khó tiếp cận thành một trải nghiệm ngắn, nói được, hỏi lại được, và vẫn giữ được hàng rào tin cậy nội dung.
