/**
 * 匯出功能模組
 * export.gs
 */

// 預定義顏色列表（柔和色調）
const PRESET_COLORS = [
  '#A3D977', '#77C4D9', '#D977A3', '#D9C477', '#77D9A3',
  '#7793D9', '#C477D9', '#D99377', '#77D9D9', '#D977D9',
  '#93D977', '#7777D9', '#D9A377', '#77D993', '#A377D9',
  '#D97793', '#C4D977', '#77A3D9', '#D977C4', '#93D9A3'
];

/**
 * 取得或生成使用者顏色
 * @param {string} userId - 使用者 ID
 */
function getUserColor(userId) {
  const colorMap = getAllData(CONFIG.SHEETS.COLOR_MAP).rows;
  const existing = colorMap.find(c => c.userId === userId);
  
  if (existing && existing.colorHex) {
    return existing.colorHex;
  }
  
  // 生成新顏色
  const usedColors = colorMap.map(c => c.colorHex);
  const availableColors = PRESET_COLORS.filter(c => !usedColors.includes(c));
  const newColor = availableColors.length > 0 
    ? availableColors[0] 
    : PRESET_COLORS[colorMap.length % PRESET_COLORS.length];
  
  // 儲存顏色
  const users = queryData(CONFIG.SHEETS.USERS, { userId: userId });
  const userName = users.length > 0 ? users[0].name : userId.split('@')[0];
  
  appendRow(CONFIG.SHEETS.COLOR_MAP, {
    userId: userId,
    name: userName,
    colorHex: newColor
  });
  
  return newColor;
}

/**
 * 匯出月份班表到新的 Google Sheet
 * @param {string} month - 月份格式 'YYYY-MM'
 * @returns {Object} { success, sheetUrl }
 */
function exportToSheet(month) {
  checkIsLeader();
  
  const monthModel = getMonthModel(month);
  const roster = getRoster(month);
  const shiftRules = getShiftRules();
  
  // 建立新 Spreadsheet
  const ss = SpreadsheetApp.create(`活動中心排班_${month}`);
  const sheet = ss.getActiveSheet();
  sheet.setName('班表');
  
  // 建立排班地圖
  const rosterMap = {};
  roster.forEach(r => {
    const key = `${r.date}_${r.ruleId}`;
    rosterMap[key] = r;
  });
  
  // 使用者顏色地圖
  const colorCache = {};
  
  // 計算欄位結構
  const weekdayShifts = shiftRules.filter(r => r.appliesTo === 'weekday');
  const weekendShifts = shiftRules.filter(r => r.appliesTo === 'weekend');
  const maxShiftsPerDay = Math.max(weekdayShifts.length, weekendShifts.length);
  
  let currentRow = 1;
  let currentWeek = -1;
  
  // 標題列
  sheet.getRange(1, 1).setValue(`${month} 班表`);
  sheet.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  currentRow = 3;
  
  // 依週分組處理
  monthModel.days.forEach((day, index) => {
    const weekNum = getWeekNumber(new Date(day.date));
    
    // 新的一週，加入分隔
    if (weekNum !== currentWeek) {
      if (currentWeek !== -1) {
        currentRow += 1; // 週間空行
      }
      currentWeek = weekNum;
      
      // 週標題
      sheet.getRange(currentRow, 1).setValue(`第 ${weekNum} 週`);
      sheet.getRange(currentRow, 1).setFontWeight('bold').setBackground('#E8E8E8');
      currentRow += 1;
      
      // Header：日期欄 + 班段欄
      sheet.getRange(currentRow, 1).setValue('日期');
      sheet.getRange(currentRow, 2).setValue('星期');
      
      // 最大班段標題
      for (let i = 0; i < maxShiftsPerDay; i++) {
        sheet.getRange(currentRow, 3 + i).setValue(`班段 ${i + 1}`);
      }
      sheet.getRange(currentRow, 1, 1, 2 + maxShiftsPerDay)
        .setBackground('#D0E0D0')
        .setFontWeight('bold');
      currentRow += 1;
    }
    
    // 日期列
    const dateNum = new Date(day.date).getDate();
    sheet.getRange(currentRow, 1).setValue(`${dateNum}日`);
    sheet.getRange(currentRow, 2).setValue(`週${day.dayName}`);
    
    if (day.isWeekend) {
      sheet.getRange(currentRow, 1, 1, 2).setBackground('#FFF8DC');
    }
    
    // 班段內容
    day.shifts.forEach((shift, shiftIdx) => {
      const col = 3 + shiftIdx;
      const key = `${day.date}_${shift.ruleId}`;
      const assignment = rosterMap[key];
      
      if (assignment && assignment.userId) {
        const displayName = assignment.userName || assignment.userId.split('@')[0];
        sheet.getRange(currentRow, col).setValue(displayName);
        
        // 取得使用者顏色
        if (!colorCache[assignment.userId]) {
          colorCache[assignment.userId] = getUserColor(assignment.userId);
        }
        sheet.getRange(currentRow, col).setBackground(colorCache[assignment.userId]);
      } else {
        sheet.getRange(currentRow, col).setValue('');
      }
      
      // 加入班段時間到 note
      sheet.getRange(currentRow, col).setNote(`${shift.label} (${shift.hours}h)`);
    });
    
    currentRow += 1;
  });
  
  // 自動調整欄寬
  sheet.autoResizeColumns(1, 2 + maxShiftsPerDay);
  
  // 凍結標題
  sheet.setFrozenRows(2);
  
  return {
    success: true,
    sheetUrl: ss.getUrl(),
    sheetId: ss.getId()
  };
}

/**
 * 取得週數
 */
function getWeekNumber(date) {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const firstDayOfWeek = firstDayOfMonth.getDay();
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

/**
 * 匯出為 Excel（實際上是建立 Sheet 再轉換）
 * @param {string} month - 月份格式 'YYYY-MM'
 */
function exportToExcel(month) {
  // 先建立 Google Sheet
  const result = exportToSheet(month);
  
  if (!result.success) {
    return result;
  }
  
  // 產生下載連結
  const excelUrl = `https://docs.google.com/spreadsheets/d/${result.sheetId}/export?format=xlsx`;
  
  return {
    success: true,
    sheetUrl: result.sheetUrl,
    excelUrl: excelUrl
  };
}
