# 部署指南

完成 `docs/setup-guide.md` 中的 Spreadsheet 建立後，請依照以下步驟部署系統。

---

## Step 1: 複製程式碼到 Apps Script

在 Spreadsheet 的 Apps Script 專案中，建立以下檔案並貼上 `gas/` 資料夾中的對應程式碼：

| Apps Script 檔案名稱 | 對應本地檔案          |
| -------------------- | --------------------- |
| `Code.gs`            | `gas/Code.gs`         |
| `db.gs`              | `gas/db.gs`           |
| `auth.gs`            | `gas/auth.gs`         |
| `shifts.gs`          | `gas/shifts.gs`       |
| `availability.gs`    | `gas/availability.gs` |
| `roster.gs`          | `gas/roster.gs`       |
| `workload.gs`        | `gas/workload.gs`     |
| `export.gs`          | `gas/export.gs`       |
| `setup.gs`           | `gas/setup.gs`        |
| `ui.html`            | `gas/ui.html`         |
| `ui.css.html`        | `gas/ui.css.html`     |
| `ui.js.html`         | `gas/ui.js.html`      |

### 建立檔案步驟

1. 在 Apps Script 編輯器左側，點擊 **「+」** → **「腳本」**（.gs 檔案）或 **「HTML」**（.html 檔案）
2. 重新命名檔案（去掉副檔名）
3. 貼上對應的程式碼
4. 按 **Ctrl+S** 儲存

---

## Step 2: 設定 Spreadsheet ID

1. 複製你的 Spreadsheet ID（從網址中取得）
2. 開啟 `Code.gs`
3. 找到這一行：
   ```javascript
   SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
   ```
4. 將 `YOUR_SPREADSHEET_ID_HERE` 替換為你的實際 ID
5. 儲存檔案

---

## Step 3: 初始化資料庫 (自動建立工作表)

這一步會自動幫你建立所有工作表、標題欄位，並填入預設資料，**不需要手動輸入**。

1. 在 Apps Script 編輯器上方工具列的下拉選單中，選擇 **`setupDatabase`** 函數。
2. 點擊 **「執行」** 按鈕。
3. 若出現「審查權限」視窗：
   - 點擊「審查權限」
   - 選擇你的帳號
   - 點擊「進階」→「前往...（不安全）」
   - 點擊「允許」
4. 等待執行完畢（下方執行紀錄顯示「執行完畢」）。
5. 回到 Spreadsheet，你應該會看到所有工作表（Users, ShiftRules...）都已自動建立好了！

---

## Step 4: 部署 Web App

1. 點擊右上角 **「部署」** → **「新增部署」**
2. 點擊齒輪圖示，選擇 **「網頁應用程式」**
3. 填寫設定：
   - **說明**：`活動中心排班系統 v1.0`
   - **執行者**：`我`（Me）
   - **具有存取權的使用者**：
     - 學校帳號：選 `<你的網域> 中的任何人`
     - 開放：選 `任何人`
4. 點擊 **「部署」**
5. 授權應用程式存取 Google 服務
6. 複製產生的 **網頁應用程式網址**

---

## Step 4: 測試系統

### 4.1 一般使用者測試

1. 開啟 Web App 網址
2. 系統應自動識別你的 Google 帳號
3. 測試功能：
   - 勾選幾個「沒空」時段
   - 填寫特殊需求
   - 點擊「儲存」
   - 檢查 Spreadsheet 的 `Unavailability` 和 `SpecialRequests` 表

### 4.2 班長測試

1. 確認你的 Email 在 `Admins` 表中
2. 重新載入頁面
3. 應該看到「排班管理」標籤
4. 測試功能：
   - 點擊班段格子，選擇人員
   - 測試「同日自動補齊」
   - 查看工時統計側欄
   - 點擊「匯出 Sheet」

---

## 常見問題

### Q: 登入後顯示「未登入」？

**A:** 確認你在 Google 帳號已登入狀態下開啟 Web App。如果仍有問題，嘗試用無痕視窗重新登入。

### Q: 看不到班長功能？

**A:** 確認你的 Email 已加入 `Admins` 表中，且 `active` 欄位為 `TRUE`。

### Q: 儲存失敗？

**A:** 檢查 Apps Script 的執行紀錄（檢視 → 執行項目），查看錯誤訊息。

### Q: 匯出的 Sheet 在哪裡？

**A:** 匯出的班表會建立在你的 Google Drive 根目錄，檔名為 `活動中心排班_YYYY-MM`。

---

## 更新部署

修改程式碼後，需要重新部署：

1. 點擊 **「部署」** → **「管理部署」**
2. 點擊鉛筆圖示編輯
3. **版本** 改為 **「新版本」**
4. 點擊 **「部署」**

---

## 完成！ 🎉

恭喜！排班系統已成功部署。將 Web App 網址分享給同學即可開始使用。
