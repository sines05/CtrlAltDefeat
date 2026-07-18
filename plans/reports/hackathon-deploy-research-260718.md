---
harness_version: 5.1.0
harness_kit_digest: 207d8b3cef0dda4b0d13164ded40b0d1a8111d40335becaef304cb86773fcfe8
harness_schema_version: 1.0
---

# Research: Nền tảng deploy nhanh cho hackathon với URL không đổi qua redeploy

**Mode**: breadth  
**Date**: 2026-07-18  
**Sources reviewed**: 5  

## Summary

**Khuyến nghị: Render Web Service.** Dùng cùng một service `onrender.com`; mỗi lần push/redeploy chỉ thay revision của service, nên URL nộp bài không cần thay đổi — [DERIVED] từ mô hình một service có subdomain riêng và GitHub deploys [1].
Repo không phải static site: build sao chép web, API Node và content vào `build/`; runtime khởi động HTTP server [OBSERVED: `scripts/build.mjs:76-100`].
`npm run build` đã chạy thành công, và `HOST=0.0.0.0 PORT=10000 node build/run.mjs` đã trả HTTP 2xx ở `/` [OBSERVED: command output, 2026-07-18].
Chọn **Railway** khi tài khoản Render bị chặn/xác thực lâu; không chọn Vercel cho deadline này vì app hiện tại tự serve static files và Vercel bỏ qua `express.static()` [5].

## Options / Comparison

| Option | URL và redeploy | Fit runtime | Ma sát deploy | Project fit |
|---|---|---|---|---|
| **1. Render Web Service** | Service có subdomain `onrender.com` riêng; Git provider hỗ trợ deploy; URL không đổi qua redeploy là [DERIVED], cần xác nhận ngay sau deploy [1] | Node 24.14.1 là default cho service mới; repo yêu cầu Node `>=24` [OBSERVED: `package.json:13-15`], nên khớp trực tiếp [2] | 1 service, 2 commands, secrets trên dashboard | **[+]** |
| **2. Railway** | Kết nối GitHub, Generate Domain; GitHub autodeploy khi có commit [3][4]. Tính bền URL qua redeploy không được tài liệu đã đọc cam kết rõ, nên [ASSUMED]. | Nhận Node app, nhưng guide dùng `npm start`; repo chỉ có `run`, cần chỉ định Start Command [OBSERVED: `package.json:6-11`]. | Nhanh, nhưng thêm cấu hình command/domain | **[~]** |
| **3. Vercel** | Có production URL theo project; không phải ưu tiên cho server nguyên trạng. | Vercel biến Express thành Function, yêu cầu assets trong `public/**`; `express.static()` bị bỏ qua [5]. Repo dùng Node core server và tree `apps/web`, `build/web` [OBSERVED: `scripts/build.mjs:76-100`]. | Cần sửa/adapt cấu trúc trước deploy | **[-]** |

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Deploy từ URL preview/thay service mới làm link nộp bài đổi | M | H | Chỉ tạo **một** Render Web Service và nộp URL production của service; redeploy đúng service đó. Mở URL sau lần deploy thứ hai để xác nhận [OBSERVED] trước khi gửi. |
| Server bind loopback, platform không route được | M | H | Đặt `HOST=0.0.0.0`; runtime đã được probe với `PORT=10000` và trả HTTP thành công. |
| Voice/Gemini không hoạt động trên production vì thiếu secret | M | H | Tạo `GEMINI_API_KEY` hoặc `GEMINI_API_KEYS` trong Render Environment; code đọc các key này [OBSERVED: `services/api/src/providers/gemini-live.js:15-17`]. Không commit `.env`. |
| Tương thích Node drift do `>=24` không có upper bound | L | M | Đặt `NODE_VERSION=24.14.1` ở Render; Render ưu tiên biến này và cảnh báo range không chặn major version [2]. |

## Recommendation

**Priority 1: Render Web Service** — ít nợ kỹ thuật nhất: deploy đúng Node HTTP service hiện có, không biến backend thành function hoặc tách static hosting.  

Thiết lập dashboard tối thiểu, không cần sửa code:

1. Push revision hiện tại lên GitHub; trên Render chọn **New → Web Service → Git Provider** và chọn branch nộp bài [1].
2. Thiết lập **Build Command**: `npm run build`.
3. Thiết lập **Start Command**: `node build/run.mjs`.
4. Thiết lập Environment: `HOST=0.0.0.0`, `NODE_VERSION=24.14.1`, `GEMINI_API_KEY=<secret>`; giữ `PORT` do Render cấp.
5. Đợi deploy, copy duy nhất URL `https://<service>.onrender.com` để nộp.
6. Sửa bài xong chỉ push branch đã kết nối hoặc dùng **Deploy latest commit** trên **chính service đó** [1]. Sau redeploy, kiểm tra lại cùng URL và luồng voice trước khi nộp.

**Fallback: Railway** — chọn nếu Render gặp vấn đề đăng nhập/credit/card hoặc build queue. Tạo một service từ GitHub, đặt Build Command `npm run build`, Start Command `node build/run.mjs`, đặt `HOST=0.0.0.0` và secrets, rồi **Networking → Generate Domain** [3][4]. Không tạo project/service mới sau khi đã nộp URL.

## Evidence and references

[1] https://render.com/docs/web-services | Render | accessed 2026-07-18 | [PRIOR] Official docs: Git provider deploy, web service subdomain, custom domains; no explicit redeploy-URL retention guarantee.

[2] https://render.com/docs/node-version | Render | accessed 2026-07-18 | [PRIOR] Official docs: default Node `24.14.1` for services created after 2026-04-21 and `NODE_VERSION` precedence.

[3] https://docs.railway.com/deployments/github-autodeploys | Railway | accessed 2026-07-18 | [PRIOR] Official docs: connected GitHub branch autodeploys and manual `Deploy Latest Commit`.

[4] https://docs.railway.com/guides/express | Railway | accessed 2026-07-18 | [PRIOR] Official guide: GitHub deploy and Networking → Generate Domain.

[5] https://vercel.com/docs/frameworks/backend/express | Vercel | updated 2026-07-06 | [PRIOR] Official docs: Express becomes one Vercel Function; static assets must live under `public/**`; `express.static()` is ignored.

## Open questions

- [ASSUMED] Render account/plan is usable and its service subdomain persists across a redeploy in this account. Source needed: create the target service, redeploy a trivial revision, compare exact URL; this is the required final probe before submitting.
- [ASSUMED] `GEMINI_API_KEY` held by the team is valid for the live voice model in production. Source needed: run one voice interaction from the deployed URL.
- Outside scope: custom domain purchase/DNS. It is unnecessary for a hackathon submission; the service URL is the least moving part.
