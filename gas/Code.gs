/**
 * 校園工讀生排班系統 - 入口與路由
 * Code.gs
 */

// ====== 配置 ======
const CONFIG = {
  // 請將此處替換為您的 Spreadsheet ID
  SPREADSHEET_ID: 'YOUR_SPREADSHEET_ID_HERE',
  
  // 工作表名稱
  SHEETS: {
    USERS: 'Users',
    SHIFT_RULES: 'ShiftRules',
    UNAVAILABILITY: 'Unavailability',
    SPECIAL_REQUESTS: 'SpecialRequests',
    ROSTER: 'Roster',
    ADMINS: 'Admins',
    COLOR_MAP: 'ColorMap'
  }
};

/**
 * Web App 入口點
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('ui')
    .evaluate()
    .setTitle('活動中心排班系統')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 引入 HTML 片段
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * 取得 Spreadsheet 實例
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * 取得指定工作表
 */
function getSheet(sheetName) {
  return getSpreadsheet().getSheetByName(sheetName);
}
