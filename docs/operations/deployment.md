# Deployment

Cập nhật: 2026-07-18

## Trạng thái

- [OBSERVED] `render.yaml` khai báo một Render Web Service native Node tên `ctrlaltdfeat-museum`, build từ `main`, với health check `/api/health`.
- [ASSUMED] Service Render chưa được import và health check production chưa được chạy; chỉ thực hiện sau khi owner cho phép hành động outbound.

## Mục tiêu deploy

- Mở được từ QR/marker trên điện thoại thật.
- Giữ một URL demo ổn định của cùng service.
- Inject Gemini secret qua dashboard, không đưa giá trị vào Git.
- Rollback nhanh mà không thay service hoặc URL.

## Cấu hình Render

`render.yaml` là Blueprint duy nhất cho service này:

- `main` trigger deploy theo commit.
- `npm run build` tạo artifact; `node build/run.mjs` khởi động service.
- `HOST=0.0.0.0`, Node `24.14.1`, `NODE_ENV=production`.
- Render cấp `PORT`; không đặt `PORT` thủ công.
- `/api/health` là health check.
- `GEMINI_API_KEYS` dùng `sync: false`; chỉ tên biến được commit.

## Quy trình deploy

1. Chạy `npm test`, `npm run lint`, `npm run typecheck`, và `npm run build` ở local.
2. Trong Render dashboard, import `render.yaml` và tạo đúng một service `ctrlaltdfeat-museum` từ `main`.
3. Khi Blueprint prompt biến `GEMINI_API_KEYS`, xác minh tên biến từ cấu hình local rồi chỉ dán value trong dashboard; không copy, export, hoặc commit local configuration.
4. Chờ service healthy, lưu Render subdomain làm URL demo chuẩn, rồi kiểm tra root và `/api/health`.
5. Smoke test một scene/asset, một tương tác Gemini live, QR/mobile path, và fallback tĩnh.
6. Deploy commit thứ hai vào chính service đó; URL phải giữ nguyên trước khi submit.

## Rollback

- Dùng rollback hoặc redeploy revision healthy gần nhất của cùng Render Web Service.
- Không tạo service thay thế, vì làm đổi URL demo.
- Khi Gemini outage, tắt `GEMINI_LIVE_QA_ENABLED`; tour và static fallback vẫn phải phục vụ.

## Go-live checklist

- Root và `/api/health` trả response mong đợi từ URL production.
- URL Render không đổi sau deploy thứ hai.
- QR/marker mở đúng URL trên ít nhất một thiết bị thật.
- Gemini live được thử bằng key dashboard, hoặc degraded outcome được ghi rõ.
- Fallback được test trên mobile.
- Có người chịu trách nhiệm on-call cho buổi demo.
