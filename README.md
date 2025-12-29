# 🏢 活動中心排班系統

校園活動中心工讀生排班管理系統。

## ✨ 功能特色

- **Google 登入**：使用 Google 帳號快速登入
- **沒空登記**：使用者可標記無法上班的時段
- **排班管理**：班長可快速排定班表
- **工時統計**：自動計算各使用者工時
- **響應式設計**：支援桌面與手機瀏覽

## 🛠️ 技術架構

- **前端**：React 18 + Vite
- **樣式**：Tailwind CSS 4 + DaisyUI 5
- **資料庫**：Firebase Firestore
- **認證**：Firebase Authentication
- **部署**：Vercel

## 📦 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 Firebase

請參閱 [Firebase 設定指南](./docs/firebase-setup.md) 完成以下步驟：

1. 建立 Firebase 專案
2. 啟用 Google 登入
3. 建立 Firestore 資料庫
4. 取得應用程式設定

### 3. 設定環境變數

複製 `.env.example` 為 `.env.local` 並填入 Firebase 設定：

```bash
cp .env.example .env.local
```

編輯 `.env.local`：

```env
VITE_FIREBASE_API_KEY=你的_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=你的專案.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=你的_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=你的專案.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=你的_SENDER_ID
VITE_FIREBASE_APP_ID=你的_APP_ID
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:5173

### 5. 初始化系統

1. 使用 Google 登入
2. 首次登入時設定顯示名稱
3. 進入「系統管理」初始化班段規則

## 📁 專案結構

```
├── src/
│   ├── components/      # 可重用元件
│   ├── contexts/        # React Context
│   ├── hooks/           # 自訂 Hooks
│   ├── lib/             # 函式庫配置
│   ├── pages/           # 頁面元件
│   ├── services/        # API 服務
│   ├── App.jsx          # 主應用程式
│   ├── main.jsx         # 入口點
│   └── index.css        # 全域樣式
├── gas/                  # 舊版 Google Apps Script
├── docs/                 # 文件
└── public/               # 靜態資源
```

## 🚀 部署到 Vercel

1. 將程式碼推送到 GitHub
2. 在 [Vercel](https://vercel.com) 匯入專案
3. 設定環境變數（與 `.env.local` 相同）
4. 部署完成後，在 Firebase Console 新增授權網域

## 📖 使用說明

### 一般使用者

1. 使用 Google 帳號登入
2. 在「填寫沒空」頁面標記無法上班的時段
3. 可在備註欄填寫特殊需求

### 班長

除了一般功能外，還可以：

1. 在「排班管理」頁面進行排班
2. 點擊時段可快速選擇人員
3. 查看特殊需求與工時統計

### 管理員

擁有所有權限，還可以：

1. 在「系統管理」管理管理員列表
2. 初始化或修改班段規則

## 📝 授權

MIT License
