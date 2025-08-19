# 園藝治療課程平台 — 最小可用版本（MVP）

這是一個 **免自架後端伺服器** 的課程平台雛形：前端純靜態（可放 GitHub Pages / Netlify / Vercel），
資料庫與登入用 **Supabase**，並透過 **RLS（Row Level Security）** 保護資料。
功能包含：
- Email/密碼註冊與登入
- 課程列表（僅顯示已發佈）
- 課程報名（Enroll）
- 單元列表與內容顯示
- 進度標記（完成/統計）

> 這是教學用範本，未包含金流。要付費報名可搭配 Stripe Checkout（需加一層 Vercel/Netlify Functions）。

---

## 快速開始（約 10–20 分鐘）

1. **建立 Supabase 專案**
   - 前往 Supabase，建立新專案，記下「Project URL」與「anon public key」。

2. **建立資料表與 RLS**
   - 打開 Supabase SQL Editor，貼上 `supabase_schema.sql` 全部內容後執行。
   - 在 `courses` 表新增幾筆測試資料（至少一筆 `published=true`）。
   - 在 `lessons` 表新增課程單元（關聯 `course_id`、設定 `order_no`）。

3. **設定前端**
   - 打開 `app.js`，把：
     ```js
     const SUPABASE_URL = "https://YOUR-PROJECT-ref.supabase.co";
     const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
     ```
     換成你專案的值（anon key 可放在前端，所有寫入都受 RLS 限制）。

4. **本機測試**
   - 直接用瀏覽器開 `index.html` 也能測試（建議使用 VSCode Live Server 或任何簡單靜態伺服器）。
   - 註冊一個帳號、登入、嘗試報名與完成單元。

5. **上線**
   - 推上 GitHub 後使用 GitHub Pages / Netlify / Vercel 其中一個託管即可。
   - 如要綁自訂網域，可在對應平台設定 DNS。

---

## 管理內容（無後端程式的做法）
- 用 Supabase Dashboard 直接新增/修改 `courses` 與 `lessons`。
- 或另建「後台」網頁，但**請勿**在前端使用服務金鑰（service key）。
  - 若需要後台，請使用「Serverless Functions」來保護金鑰。

---

## 延伸功能建議
- **金流與付費解鎖**：
  - 在報名前導向 Stripe Checkout（以 Vercel/Netlify Functions 建立一個 `/api/create-checkout-session`）。
  - 成功付款的 webhook（同樣用 Functions）寫入 `enrollments`。
- **影片託管**：YouTube Unlisted、Vimeo、或雲端儲存（Supabase Storage）。
- **問答/留言**：新增 `comments` 表；讀多寫少可用 Edge functions 做審核與節流。
- **成就/證書**：完成所有單元後提供證書（可產生 PDF）。
- **Analytics**：加上 Plausible/Umami（免 cookies）。

---

## 資料表摘要
- `courses (id, title, summary, description, cover_url, published, created_at)`
- `lessons (id, course_id, order_no, title, content, created_at)`
- `enrollments (user_id, course_id, enrolled_at)`
- `progress (user_id, lesson_id, done_at)`

RLS 重點：
- 任何人可讀「已發佈」課程與其單元。
- 只有登入者能建立/讀取自己的 `enrollments` 與 `progress`。

---

## 常見問題
- **anon key 放前端會不會不安全？**
  - 不會直接暴露敏感權限，因為所有操作皆受 **RLS** 約束。
- **我想有後台、也想自己發佈課程**？
  - 先用 Supabase Dashboard 管理內容；日後再加上 Admin Functions。

