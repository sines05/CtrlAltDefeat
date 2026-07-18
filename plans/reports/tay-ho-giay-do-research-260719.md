---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: Hướng thị giác cho landing page bảo tàng số Tay Ho + giấy dó

**Mode**: breadth  
**Date**: 2026-07-19  
**Sources reviewed**: 5  

## Summary
Khuyến nghị mạnh nhất: dựng landing page theo hệ **paper-first, Tay Ho-accented**. Cốt thị giác nên đi từ **giấy dó Yên Thái/Kẻ Bưởi** rồi mới thêm tín hiệu địa phương bằng **sen Tây Hồ / trà sen Quảng An** và mặt nước hồ. Cách này khớp nguồn tốt nhất, rủi ro misrepresentation thấp nhất, và triển khai được bằng CSS + crop ảnh/surface scan hiện có thay vì cần minh họa mới. Tránh lấy **Đông Hồ, đền chùa, nón lá, đèn lồng** làm hero motif; trong tập nguồn này, các thứ đó không phải trục định danh mạnh bằng giấy dó ven Hồ Tây và sen Tây Hồ.

## Options / Comparison
| Option | Pros | Cons | Project fit |
|---|---|---|---|
| **A. Paper-first, Tay Ho-accented** | Bám sát nhất vào nguồn về **Yên Thái/Kẻ Bưởi giấy dó** ở Tây Hồ [1][2][3]; dễ chuyển thành texture, viền xơ, lớp giấy, nhịp 8 bước; CSS-native, ít phụ thuộc asset | Nếu làm quá beige sẽ thành shop thủ công, thiếu cảm giác hồ | **[+]** tốt nhất cho bảo tàng số, ít rủi ro, ít phụ thuộc asset mới |
| **B. Lake/lotus-first, paper-second** | Nhận diện địa phương nhanh nhờ **sen Tây Hồ / trà sen Quảng An / hồ Tây** [4][5]; hợp nếu đã có ảnh hồ/sen mạnh | Dễ trôi sang brochure du lịch; giấy dó bị tụt thành chất liệu nền mờ | **[~]** hợp khi kho ảnh hồ/sen mạnh hơn kho texture giấy |
| **C. Heritage collage** (sen + folk-print + temple + festival) | Nhiều tín hiệu, dễ “đậm văn hóa” bề mặt | Rủi ro kitsch/misrepresentation cao nhất; khó kiểm soát hierarchy; tốn asset; dễ biến landing page thành poster sự kiện | **[-]** không nên chọn |

## Recommendation
**Priority 1**: **Paper-first, Tay Ho-accented**  
Lý do: tập nguồn nối rất rõ **giấy dó** với **Yên Thái/Kẻ Bưởi ven Hồ Tây** [1][2][3], còn lớp định danh phụ của Tây Hồ hiện diện mạnh nhất qua **sen Tây Hồ / trà sen Quảng An** và cảnh quan mặt nước [4][5]. Đây là trục vừa đúng địa phương vừa đúng chất liệu trưng bày.

**Fallback**: **Lake/lotus-first, paper-second** — chỉ chọn khi [ASSUMED] kho asset hiện có thiên về ảnh hồ/sen, không có macro texture giấy đủ đẹp để làm nền/section divider.

### Cues nên dùng
- **Thuật ngữ**: ưu tiên `giấy dó`, `Yên Thái`, `Kẻ Bưởi`, `sen Tây Hồ`, `trà sen Quảng An`. Nếu cần song ngữ: `giấy dó` trước, giải thích sau; đừng thay bằng “rice paper”. [DERIVED from 1][2][3][4]
- **Material cues**: nền **off-white/ivory chưa tẩy**, đen mực/than, xám tro, thêm accent tiết chế từ **hồng sen**, **xanh lá sen**, **xanh xám mặt hồ**. Căn cứ: giấy được mô tả là `mỏng, dai như lụa` [1] và `bền dai, mịn màng, trắng ngần` [2]; Tây Hồ gắn với sen và mặt nước [4][5].
- **Surface treatment**: mép xơ nhẹ, lớp giấy chồng, vùng bán trong suốt, hạt sợi mịn; tránh texture giả cổ quá nặng. [DERIVED from 1][2]
- **Interaction metaphors, CSS-native**: reveal theo **lớp giấy**; hover/focus như **nhấc tờ giấy**; underline/halo gợn nhẹ như **mặt hồ**; progress/section markers theo **8 bước** nghề giấy nếu có module quy trình [3]. Không cần video mô phỏng hay canvas effect.
- **Image strategy**: dùng crop cận chất liệu giấy, chi tiết bàn tay/quy trình, sen/hồ ở vai trò accent. Hero full-bleed phong cảnh hồ chỉ nên là fallback, không phải mặc định.

### Guardrails để khỏi sai chất
- **Không lấy Đông Hồ làm ngôn ngữ hình chính**. Nguồn chỉ cho thấy giấy dó từng dùng cho tranh Đông Hồ/Hàng Trống [3]; đó là **use-case**, không phải bản sắc địa phương chính của landing page Tay Hồ.
- **Không spiritualize quá tay**. West Lake có giá trị lịch sử-văn hóa-tâm linh [5], nhưng tập nguồn này không buộc landing page phải dựng motif đền/phủ/chùa. Dùng nó làm texture chính là bước trượt dễ thành poster lễ hội.
- **Không generic-Vietnam**. Trong tập nguồn này, tín hiệu xác đáng hơn là **giấy dó ven Hồ Tây** và **sen Tây Hồ**, không phải icon du lịch toàn quốc.

### Credibility / adoption risk / architectural fit
- **Source credibility**: [2][4][5] là nguồn cơ quan/bảo tàng cấp thành phố, trọng số cao; [3] là cổng nhà nước thiên về phục dựng làng nghề, trọng số khá; [1] là nguồn bảo tàng chuyên ngành, tốt cho lịch sử-quy trình nhưng ít trích dẫn học thuật.
- **Adoption risk**: thấp về implementation vì toàn bộ ngôn ngữ đề xuất đi được bằng CSS + asset crop; trung bình về content vì nếu copy dùng sai thuật ngữ địa danh (`Tây Hồ` vs `Hồ Tây` vs `Quảng An`) sẽ mất độ thật.
- **Architectural fit**: hợp landing page tĩnh hoặc motion nhẹ; không đòi thêm dependency; có thể cắm trực tiếp vào hero, section divider, card chrome, caption system.

## Evidence and references
[1] https://baotangvanhoc.vn/hien-vat-hinh-anh/hien-vat-len-tieng/nghe-lam-giay-do-o-viet-nam/ | Bảo tàng Văn học Việt Nam | n.d. | credibility: high | OBSERVED | Giấy dó: vật liệu, quy trình, câu `mỏng, dai như lụa`, gắn Yên Thái.

[2] https://baotanghanoi.com.vn/en/giay-do-ke-buoi-dau-an-vang-son-dat-thang-long/ | Bảo tàng Hà Nội | n.d. | credibility: high | OBSERVED | Kẻ Bưởi/Yên Thái ven Hồ Tây; câu `bền dai, mịn màng, trắng ngần`.

[3] https://nongthonmoihanoi.gov.vn/tin-tuc/yen-thai-bao-ton-va-phuc-dung-nghe-lam-giay-do-3978 | Văn phòng điều phối Chương trình xây dựng nông thôn mới Hà Nội | 2024 | credibility: medium-high | OBSERVED | Xác nhận `làng Yên Thái nay thuộc phường Bưởi, quận Tây Hồ`; không gian phục dựng `8 bước`.

[4] https://sovhtt.hanoi.gov.vn/khai-mac-le-hoi-sen-ha-noi-nam-2026-ton-vinh-di-san-tra-sen-quang-an-cong-bo-khu-du-lich-ho-tay-va-vung-phu-can/ | Sở Văn hóa và Thể thao Hà Nội | 2026 | credibility: high | OBSERVED | Quảng An lotus tea = di sản; thuật ngữ `sen Tây Hồ`, `hồn cốt Thăng Long – Hà Nội`.

[5] https://english.hanoi.gov.vn/direction-of-hanoi-peoples-committee/hanoi-approves-plan-to-preserve-and-promote-west-lake-area-cultural-values-2655260129124020528.htm | Hanoi City Information Portal | 2026-01-22 | credibility: high | OBSERVED | Hồ Tây được định khung bởi cảnh quan tự nhiên, giá trị văn hóa-lịch sử-tâm linh, công viên ven hồ, hệ sinh thái nước.

## Open questions
- [ASSUMED] Kho asset hiện có có ít nhất 1 macro texture giấy và 1 ảnh hồ/sen đủ sạch để dùng hero/section accent; nếu không, cần đi gần như full-CSS.
- [ASSUMED] Brand hiện tại chấp nhận palette nền sáng, low-saturation; nếu brand buộc saturation cao, cần làm pass thứ hai để tránh xung đột.
- Chưa rà typography hiện có; nếu font display quá trang trí, toàn bộ hệ paper-first sẽ dễ trượt sang hàng lưu niệm thay vì bảo tàng số.
