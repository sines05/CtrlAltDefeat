# Submission overview

## One-line pitch

Dó.AI biến một chủ đề di sản rất dễ bị trình bày tĩnh thành một trải nghiệm web ngắn, có dẫn dắt, có giọng nói, và có grounded AI để người xem hiểu nhanh mà không phải đánh đổi độ tin cậy nội dung.

## Bài toán

Di sản phi vật thể thường được số hóa theo hai cực đoan:
- hoặc chỉ là nội dung tĩnh, dài, khó giữ người xem;
- hoặc là AI tự do quá mức, dễ hallucinate và làm sai lệch chi tiết văn hóa.

Với không gian giấy dó, mục tiêu của repo này là chọn con đường thứ ba: giữ trải nghiệm đủ sống để thu hút người xem, nhưng buộc AI đi qua approved content boundary trước khi nói thay cho hiện vật/quy trình.

## Điều MVP này đang chứng minh

Trong phạm vi 48 giờ, repo hiện tại đã ghép được các lớp vốn thường nằm ở những dự án tách rời:
- mobile-first web entry từ QR/browser;
- tour 5 bước cho quy trình giấy dó;
- approved media manifest cho model/video;
- grounded Q&A + citation-aware behavior;
- TTS + voice interaction path;
- degraded fallback để demo vẫn usable khi media hoặc AI lỗi.

Điểm đáng chú ý không nằm ở một model đơn lẻ, mà ở việc cả content, runtime, và AI boundary đang được kéo về cùng một đường dẫn sản phẩm có thể demo được.

## Vì sao AI ở đây có giá trị thật

### 1. AI là lớp truy cập, không phải lớp bịa nội dung

Repo ưu tiên approved chunks, signoff, citations, và boundary response. Điều này đặc biệt quan trọng với di sản văn hóa, nơi một câu trả lời nghe trôi chảy nhưng sai sẽ phá hỏng niềm tin nhanh hơn nhiều so với một câu trả lời biết giới hạn của mình.

### 2. AI làm trải nghiệm “sống” hơn mà không tách khỏi dữ liệu gốc

Người xem có thể:
- đi theo tour;
- hỏi lại bằng text;
- hỏi bằng giọng nói;
- nghe hướng dẫn viên phát lại câu trả lời.

Nhưng answer path vẫn quay về cùng một seam grounded, thay vì để mỗi modality tự nói một kiểu.

### 3. AI được đặt trong một sản phẩm có recovery path

Repo này không giả định network, media, device, hoặc voice service luôn hoàn hảo. Khi một lớp lỗi, walkthrough cốt lõi vẫn còn. Đó là giá trị thực tế cho demo tại hiện trường và cũng là dấu hiệu của một kiến trúc có kỷ luật hơn một bản showcase chỉ tối ưu happy path.

## Standout points của submission

- **Niche nhưng thật:** bài toán giấy dó không chạy theo trào lưu AI chung chung; nó đòi hỏi vừa kể chuyện, vừa giữ hàng rào sự thật văn hóa.
- **Scope 48 giờ lớn:** 3D runtime, approved content architecture, grounded QA/TTS, voice path, và fallback behavior đang được ghép trong cùng một MVP.
- **Trust-first:** repo chủ động dùng approved-content boundary thay vì dùng “AI nói hay” như một sự thay thế cho dữ liệu đã duyệt.
- **Demo continuity:** degraded behavior là một quyết định sản phẩm, không chỉ là defensive coding.

## Những gì evaluator nên nhìn đầu tiên

1. `README.md` — tổng quan ngắn, shipped value, deferred issues.
2. `docs/system-architecture.md` — vì sao kiến trúc này tồn tại và runtime currently behaves thế nào.
3. `docs/engineering/api-contract.md` — scene/tour/media/QA/TTS/voice contracts.
4. `tests/api/`, `tests/e2e/`, `tests/docs/` — evidence repo tự chạy được.

## Honest boundaries

Repo này không claim mọi media/runtime edge đã hoàn hảo. Một số deferred issues đã được ghi thẳng trong `docs/system-architecture.md`. Điều quan trọng ở pass hiện tại là: dù còn debt, sản phẩm đã có một đường đi rõ ràng từ nội dung đã duyệt đến trải nghiệm tương tác trên điện thoại.

## Sanity check

- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Nếu phải tóm lại trong một câu: đây không phải một demo “AI cho có”, mà là một nỗ lực biến di sản thành trải nghiệm có thể tiếp cận rộng hơn mà vẫn giữ được kỷ luật nội dung.
