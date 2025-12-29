# 🏫 校園工讀生排班系統 (Campus Shift Scheduler)

這是一個基於 **Google Apps Script (GAS)** 與 **Google Sheets** 建構的線上排班系統，旨在解決校園工讀生排班流程中的痛點，將「收集沒空時間」、「手動排班」、「工時統計」等流程完全數位化與自動化。

## ✨ 核心功能

### 👨‍🎓 一般使用者 (工讀生)
- **自動登入**：支援 Google 帳號自動識別，無需記憶額外密碼（需在同網域或授權）。
- **線上填寫沒空時間**：直覺的月曆介面，快速勾選無法上班的班段。
- **特殊需求備註**：可填寫當月的排班備註（如：希望連班、特定日期偏好）。
- **個人化介面**：登入後僅能編輯自己的資料。

### 👑 班長 (管理者)
- **視覺化排班**：在月曆上直接點選班段，下拉選單會自動過濾出「可上班」（未勾選沒空）的候選人。
- **同日自動補齊**：獨家加速功能！選完第一格後，可一鍵將同一人套用到當天其他班段。
- **即時工時統計**：排班時側欄即時顯示每位同學的「已排時數」與「班數」，方便平衡工作量。
- **特殊需求提示**：側欄整合所有人的特殊需求，排班時隨時參考。
- **自動化匯出**：一鍵產生漂亮的 Google Sheet 班表（含自動上色、合併儲存格）或 Excel 檔。
- **權限管理**：可直接在介面上新增或移除管理員。

---

## 🛠️ 技術架構

- **前端**：HTML5, CSS3, Vanilla JavaScript (Web App)
- **後端**：Google Apps Script (GAS)
- **資料庫**：Google Sheets (試算表)
- **部署模式**：Google Web App Info

---

## 🚀 快速開始 (Quick Start)

本專案包含完整的自動化建置腳本，約 **5 分鐘** 即可部署完成。

### 1. 準備工作
建立一個新的 Google Spreadsheet，並開啟 **擴充功能 (Extensions) > Apps Script**。

### 2. 複製程式碼
將本專案 `gas/` 資料夾中的所有檔案內容，對應複製到 Apps Script 專案中：
- `Code.gs` (核心)
- `setup.gs` (自動初始化)
- `db.gs`, `auth.gs`, `shifts.gs`, ... (其他後端模組)
- `ui.html`, `ui.css.html`, `ui.js.html` (前端)

### 3. 初始化設定
在 Apps Script 編輯器中：
1. 開啟 `Code.gs`，填入您的 **Spreadsheet ID**。
2. 執行 `setup.gs` 中的 `setupDatabase()` 函式。
   - 系統會自動建立所有工作表 (`Users`, `Availability`, `Roster`...)。
   - 並將您自動設為管理員。

### 4. 部署
點擊 **部署 (Deploy) > 新增部署 (New deployment) > 網頁應用程式 (Web app)**，取得網址即可開始使用！

---

## 📚 詳細文件

- **[資料庫建立指南 (Setup Guide)](docs/setup-guide.md)**：了解資料庫結構與各工作表用途。
- **[部署指南 (Deployment Guide)](docs/deployment-guide.md)**：詳細的部署圖文步驟說明。
- **[需求規格書 (Requirement)](docs/requirement.md)**：原始專案需求與規格定義。

---

## 📁 檔案結構

```text
Campus-Shift-Scheduler/
├── docs/               # 專案文件
│   ├── requirement.md
│   ├── setup-guide.md
│   └── deployment-guide.md
├── gas/                # Google Apps Script 原始碼
│   ├── Code.gs         # 入口點與路由
│   ├── setup.gs        # 資料庫自動初始化
│   ├── db.gs           # 資料庫讀寫封裝
│   ├── auth.gs         # 身份驗證與權限
│   ├── roster.gs       # 排班邏輯
│   ├── export.gs       # 匯出功能
│   ├── ui.html         # 前端 HTML 模板
│   └── ...
└── README.md           # 本說明文件
```

---

## 📄 License
MIT License
