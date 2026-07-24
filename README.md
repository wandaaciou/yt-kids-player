# 酸菜 YouTube 小播放器

家長可以搜尋 YouTube 影片、手動核准 1 到 3 支影片，孩子端只能觀看已核准清單。第一版先用假資料做流程原型，不會連到你的 Google / YouTube 帳號。

## 安全原則

- 真正的金鑰只放在 `.env.local`，不要上傳 GitHub。
- `.env.example` 只放欄位名稱，可以安全上傳。
- 孩子端不登入 YouTube，也不能呼叫 YouTube 搜尋 API。
- YouTube 搜尋和新增影片都要由家長端透過後端處理。
- `SUPABASE_SERVICE_ROLE_KEY` 只能在伺服器端使用，不能出現在瀏覽器程式碼。

## 本機開發

```bash
npm install
npm run dev
npm run build
```
