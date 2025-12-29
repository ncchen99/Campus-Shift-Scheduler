# Firebase 專案設定指南

本文件說明如何建立 Firebase 專案並連接到排班系統。

## 步驟 1：建立 Firebase 專案

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 點擊「新增專案」
3. 輸入專案名稱（例如：`campus-shift-scheduler`）
4. 選擇是否啟用 Google Analytics（可選）
5. 點擊「建立專案」

## 步驟 2：啟用 Authentication

1. 在左側選單點擊「Authentication」
2. 點擊「開始使用」
3. 在「登入方式」標籤頁中，點擊「Google」
4. 啟用 Google 登入
5. 填入專案支援電子郵件
6. 點擊「儲存」

## 步驟 3：建立 Firestore 資料庫

1. 在左側選單點擊「Firestore Database」
2. 點擊「建立資料庫」
3. 選擇「在測試模式下啟動」（之後可調整安全規則）
4. 選擇伺服器位置（建議選擇 `asia-east1` - Taiwan）
5. 點擊「啟用」

## 步驟 4：設定安全規則

在 Firestore 的「規則」標籤頁中，設定以下規則：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 輔助函數：檢查是否為管理員
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/admins/$(request.auth.token.email)) &&
             get(/databases/$(database)/documents/admins/$(request.auth.token.email)).data.active == true;
    }
    
    // 輔助函數：檢查是否為班長或管理員
    function isLeaderOrAdmin() {
      return request.auth != null && (
        isAdmin() ||
        (exists(/databases/$(database)/documents/users/$(request.auth.token.email)) &&
         get(/databases/$(database)/documents/users/$(request.auth.token.email)).data.role == 'leader')
      );
    }
    
    // 支援全域搜尋與大掃除 (Collection Group)
    match /{path=**}/entries/{docId} {
      allow read: if request.auth != null;
      allow write: if isLeaderOrAdmin();
    }
    
    // 使用者資料
    match /users/{email} {
      // 所有已登入用戶可讀
      allow read: if request.auth != null;
      // 本人可修改自己的基本資料（名稱等），但 role 欄位只有管理員可改
      allow write: if request.auth != null && (
        (request.auth.token.email == email && (resource == null || !('role' in request.resource.data.diff(resource.data).affectedKeys()))) ||
        isAdmin()
      );
    }
    
    // 班段規則（所有登入使用者可讀，管理員可寫）
    match /shiftRules/{ruleId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
    
    // 沒空資料
    match /unavailability/{month}/entries/{docId} {
      allow read: if request.auth != null;
      // 本人可寫自己的沒空資料，或班長/管理員可幫忙修改
      allow write: if request.auth != null && (
        docId.matches(request.auth.token.email + '.*') ||
        isLeaderOrAdmin()
      );
    }
    
    // 特殊需求
    match /specialRequests/{month}/entries/{userId} {
      allow read: if request.auth != null;
      // 本人可寫自己的特殊需求
      allow write: if request.auth != null && request.auth.token.email == userId;
    }
    
    // 排班表（班長或管理員可修改）
    match /roster/{month}/entries/{docId} {
      allow read: if request.auth != null;
      allow write: if isLeaderOrAdmin();
    }
    
    // 管理員列表（只有管理員可修改）
    match /admins/{email} {
      allow read: if request.auth != null;
      // 只有現有管理員可以新增/修改/移除管理員
      // 特例：如果 admins 集合是空的，第一個登入的用戶可以自己成為管理員
      allow write: if request.auth != null && (
        isAdmin() ||
        !exists(/databases/$(database)/documents/admins/$(request.auth.token.email))
      );
    }
  }
}
```

> **注意**：上述規則已加入管理員權限驗證。`isAdmin()` 函數會檢查用戶是否在 `admins` 集合中且狀態為 `active`。

## 步驟 5：取得應用程式設定

1. 在專案概覽頁面，點擊「網頁」圖示 (</>) 來新增網頁應用程式
2. 輸入應用程式暱稱（例如：`Campus Shift Scheduler Web`）
3. 不需勾選 Firebase Hosting（我們使用 Vercel）
4. 點擊「註冊應用程式」
5. 複製顯示的 `firebaseConfig` 設定

## 步驟 6：設定環境變數

在專案根目錄建立 `.env.local` 檔案，填入以下內容：

```env
VITE_FIREBASE_API_KEY=你的_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=你的專案.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=你的_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=你的專案.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=你的_SENDER_ID
VITE_FIREBASE_APP_ID=你的_APP_ID
```

將上面的值替換為步驟 5 中取得的對應值。

## 步驟 7：新增授權網域（部署後）

部署到 Vercel 後，需要在 Firebase 中新增授權網域：

1. 前往 Firebase Console > Authentication > Settings
2. 在「授權網域」區段，點擊「新增網域」
3. 新增您的 Vercel 網域（例如：`campus-shift-scheduler.vercel.app`）

## 步驟 8：初始化資料

首次使用時：

1. 啟動開發伺服器：`npm run dev`
2. 使用 Google 登入
3. 進入「系統管理」頁面
4. 點擊「初始化預設規則」來建立班段規則

## 常見問題

### Q: 登入時出現錯誤

確認：
- Firebase Authentication 已啟用 Google 登入
- 在 Firebase Console 中已設定授權網域

### Q: 無法讀寫資料

確認：
- Firestore 已建立
- 安全規則已正確設定
- 使用者已登入

### Q: 出現 ERR_BLOCKED_BY_CLIENT
確認：
- 或是瀏覽器是否安裝了廣告攔截器（AdBlocker），這可能會攔截 Firebase 的請求。
- 請嘗試關閉該頁面的廣告攔截器，或更換瀏覽器測試。

### Q: 環境變數無效

確認：
- `.env.local` 檔案在專案根目錄
- 變數名稱以 `VITE_` 開頭
- 重新啟動開發伺服器
