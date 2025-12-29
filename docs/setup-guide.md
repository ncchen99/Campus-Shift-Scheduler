# Google Spreadsheet 資料庫建立指南

## Step 1: 建立 Spreadsheet

1. 開啟 [Google Sheets](https://sheets.google.com)
2. 點擊 **「空白」** 建立新試算表
3. 將試算表命名為：`ActivityCenterSchedulerDB`

---

## Step 2: 建立工作表

在試算表底部建立以下 7 個工作表（點擊 `+` 新增，雙擊標籤重新命名）：

| 工作表名稱 | 用途 |
|-----------|------|
| `Users` | 使用者清單 |
| `ShiftRules` | 班段規則設定 |
| `Unavailability` | 沒空記錄 |
| `SpecialRequests` | 特殊需求 |
| `Roster` | 排班結果 |
| `Admins` | 管理員清單 |
| `ColorMap` | 使用者顏色對照 |

---

## Step 3: 設定各工作表欄位

### 3.1 Users 工作表

在第 1 列輸入以下標題：

| A | B | C | D |
|---|---|---|---|
| userId | name | role | active |

**說明：**
- `userId`: 使用者 Email（例：xxx@ncku.edu.tw）
- `name`: 姓名
- `role`: `user` 或 `leader`
- `active`: `TRUE` 或 `FALSE`

**範例資料：**
```
userId              | name   | role   | active
--------------------|--------|--------|--------
leader@ncku.edu.tw  | 班長   | leader | TRUE
user1@ncku.edu.tw   | 王小明 | user   | TRUE
user2@ncku.edu.tw   | 李小華 | user   | TRUE
```

---

### 3.2 ShiftRules 工作表

在第 1 列輸入以下標題：

| A | B | C | D | E |
|---|---|---|---|---|
| ruleId | appliesTo | start | end | label |

**預設班段資料（複製貼上）：**

| ruleId | appliesTo | start | end | label |
|--------|-----------|-------|-----|-------|
| W1 | weekday | 17:00 | 21:00 | 17-21 |
| W2 | weekday | 21:00 | 24:00 | 21-24 |
| H1 | weekend | 08:00 | 12:00 | 08-12 |
| H2 | weekend | 12:00 | 16:00 | 12-16 |
| H3 | weekend | 16:00 | 20:00 | 16-20 |
| H4 | weekend | 20:00 | 24:00 | 20-24 |

---

### 3.3 Unavailability 工作表

在第 1 列輸入以下標題：

| A | B | C | D |
|---|---|---|---|
| ts | userId | date | ruleId |

> 此表由系統自動寫入，無需手動填寫資料

---

### 3.4 SpecialRequests 工作表

在第 1 列輸入以下標題：

| A | B | C | D |
|---|---|---|---|
| ts | userId | month | text |

> 此表由系統自動寫入

---

### 3.5 Roster 工作表

在第 1 列輸入以下標題：

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| ts | month | date | ruleId | assignedUserId | assignedBy |

> 此表由系統自動寫入

---

### 3.6 Admins 工作表

在第 1 列輸入以下標題：

| A | B | C | D | E |
|---|---|---|---|---|
| email | name | createdAt | createdBy | active |

**範例資料：**
```
email              | name | createdAt           | createdBy          | active
-------------------|------|---------------------|--------------------|---------
leader@ncku.edu.tw | 班長 | 2024-12-29 14:00:00 | system             | TRUE
```

> ⚠️ 請至少填入一位管理員（建議是 Spreadsheet 擁有者）

---

### 3.7 ColorMap 工作表

在第 1 列輸入以下標題：

| A | B | C |
|---|---|---|
| userId | name | colorHex |

**說明：** 系統會自動為每位使用者生成顏色，也可手動指定：

```
userId             | name   | colorHex
-------------------|--------|----------
user1@ncku.edu.tw  | 王小明 | #A3D977
user2@ncku.edu.tw  | 李小華 | #77C4D9
```

---

## Step 4: 建立 Apps Script 專案

1. 在 Spreadsheet 選單點擊：**擴充功能 → Apps Script**
2. 專案會自動開啟
3. 將預設的 `Code.gs` 內容清空，準備貼上程式碼

---

## Step 5: 記錄 Spreadsheet ID

1. 查看試算表網址，格式如：
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```
2. 複製中間的 `SPREADSHEET_ID` 部分
3. 稍後需要將此 ID 填入程式碼中

---

## 完成檢查清單

- [ ] 建立 `ActivityCenterSchedulerDB` 試算表
- [ ] 建立 7 個工作表
- [ ] 設定各工作表標題列
- [ ] 填入 ShiftRules 預設班段資料
- [ ] 填入至少 1 位 Admin
- [ ] 開啟 Apps Script 專案
- [ ] 記錄 Spreadsheet ID

---

## 下一步

完成以上步驟後，請告訴我！我將提供 Apps Script 程式碼。
