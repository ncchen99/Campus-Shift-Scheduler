/**
 * 資料庫自動初始化模組
 * setup.gs
 */

/**
 * 初始化資料庫結構與預設資料
 * 執行此函數後，會自動建立所有工作表並填入預設值
 */
function setupDatabase() {
  const ss = getSpreadsheet();
  let ui = null;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    console.warn('Cannot get UI: ' + e.message);
  }
  
  try {
    // 1. 建立工作表與標題
    createSheetIfNotExists(ss, CONFIG.SHEETS.USERS, ['userId', 'name', 'role', 'active']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.SHIFT_RULES, ['ruleId', 'appliesTo', 'start', 'end', 'label']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.UNAVAILABILITY, ['ts', 'userId', 'date', 'ruleId']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.SPECIAL_REQUESTS, ['ts', 'userId', 'month', 'text']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.ROSTER, ['ts', 'month', 'date', 'ruleId', 'assignedUserId', 'assignedBy']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.ADMINS, ['email', 'name', 'createdAt', 'createdBy', 'active']);
    createSheetIfNotExists(ss, CONFIG.SHEETS.COLOR_MAP, ['userId', 'name', 'colorHex']);
    
    // 2. 填入預設 ShiftRules
    const rulesSheet = ss.getSheetByName(CONFIG.SHEETS.SHIFT_RULES);
    if (rulesSheet.getLastRow() <= 1) { // 只有標題或空的
      const defaultRules = [
        ['W1', 'weekday', '17:00', '21:00', '17-21'],
        ['W2', 'weekday', '21:00', '24:00', '21-24'],
        ['H1', 'weekend', '08:00', '12:00', '08-12'],
        ['H2', 'weekend', '12:00', '16:00', '12-16'],
        ['H3', 'weekend', '16:00', '20:00', '16-20'],
        ['H4', 'weekend', '20:00', '24:00', '20-24']
      ];
      rulesSheet.getRange(2, 1, defaultRules.length, 5).setValues(defaultRules);
      console.log('已填寫預設班段規則');
    }
    
    // 3. 將目前使用者設為預設 Admin
    const adminSheet = ss.getSheetByName(CONFIG.SHEETS.ADMINS);
    if (adminSheet.getLastRow() <= 1) {
      const email = Session.getActiveUser().getEmail();
      if (email) {
        const defaultAdmin = [
          [email, email.split('@')[0], new Date().toISOString(), 'system', true]
        ];
        adminSheet.getRange(2, 1, 1, 5).setValues(defaultAdmin);
        console.log(`已將 ${email} 設為預設管理員`);
      } else {
        console.warn('無法取得當前使用者 Email，請手動新增管理員');
      }
    }

    // 4. 清理預設的 '工作表1' (如果存在且是空白的)
    const sheet1 = ss.getSheetByName('工作表1');
    if (sheet1 && sheet1.getLastRow() === 0) {
      ss.deleteSheet(sheet1);
    }
    
    if (ui) {
      ui.alert('初始化成功！', '資料庫結構與預設資料已建立完成。', ui.ButtonSet.OK);
    } else {
      console.log('初始化成功！資料庫結構與預設資料已建立完成。');
    }
    
  } catch (error) {
    console.error('初始化失敗', error);
    if (ui) {
      ui.alert('初始化失敗', error.toString(), ui.ButtonSet.OK);
    }
  }
}

/**
 * 輔助函數：如果工作表不存在則建立，並設定標題
 */
function createSheetIfNotExists(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
      sheet.setFrozenRows(1);
    }
    console.log(`已建立工作表: ${sheetName}`);
  } else {
    // 確保標題存在
    if (headers && headers.length > 0 && sheet.getLastRow() === 0) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
       sheet.setFrozenRows(1);
    }
  }
  return sheet;
}
