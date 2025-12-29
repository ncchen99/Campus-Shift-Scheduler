/**
 * 沒空資料模組
 * availability.gs
 */

/**
 * 取得當前使用者指定月份的沒空紀錄
 * @param {string} month - 月份格式 'YYYY-MM'
 * @returns {Object} { unavailabilities: [], specialRequest: '' }
 */
function getMyUnavailability(month) {
  const me = getMe();
  if (!me.email) {
    throw new Error('請先登入');
  }
  
  // 取得沒空紀錄
  const allUnavail = getAllData(CONFIG.SHEETS.UNAVAILABILITY).rows;
  const unavailabilities = allUnavail.filter(u => {
    return u.userId === me.email && u.date.startsWith(month);
  }).map(u => ({
    date: u.date,
    ruleId: u.ruleId
  }));
  
  // 取得特殊需求
  const requests = queryData(CONFIG.SHEETS.SPECIAL_REQUESTS, {
    userId: me.email,
    month: month
  });
  const specialRequest = requests.length > 0 ? requests[0].text : '';
  
  return {
    unavailabilities: unavailabilities,
    specialRequest: specialRequest
  };
}

/**
 * 儲存當前使用者的沒空資料與特殊需求
 * @param {string} month - 月份格式 'YYYY-MM'
 * @param {Array} selections - [{ date: 'YYYY-MM-DD', ruleId: 'W1' }, ...]
 * @param {string} specialText - 特殊需求文字
 */
function saveMyUnavailability(month, selections, specialText) {
  const me = getMe();
  if (!me.email) {
    throw new Error('請先登入');
  }
  
  const ts = getTimestamp();
  
  // 刪除該月份舊資料
  const sheet = getSheet(CONFIG.SHEETS.UNAVAILABILITY);
  const data = sheet.getDataRange().getValues();
  
  if (data.length > 1) {
    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      if (row[1] === me.email && String(row[2]).startsWith(month)) {
        sheet.deleteRow(i + 1);
      }
    }
  }
  
  // 新增新的沒空紀錄
  selections.forEach(sel => {
    appendRow(CONFIG.SHEETS.UNAVAILABILITY, {
      ts: ts,
      userId: me.email,
      date: sel.date,
      ruleId: sel.ruleId
    });
  });
  
  // 更新特殊需求
  upsertRow(CONFIG.SHEETS.SPECIAL_REQUESTS, 
    { userId: me.email, month: month },
    { ts: ts, text: specialText }
  );
  
  return { 
    success: true, 
    savedAt: ts,
    count: selections.length
  };
}

/**
 * 取得所有人的沒空資料（班長用）
 * @param {string} month - 月份格式 'YYYY-MM'
 */
function getAllUnavailability(month) {
  checkIsLeader();
  
  const allUnavail = getAllData(CONFIG.SHEETS.UNAVAILABILITY).rows;
  return allUnavail.filter(u => u.date.startsWith(month));
}

/**
 * 取得所有人的特殊需求（班長用）
 * @param {string} month - 月份格式 'YYYY-MM'
 */
function getAllSpecialRequests(month) {
  checkIsLeader();
  
  const requests = queryData(CONFIG.SHEETS.SPECIAL_REQUESTS, { month: month });
  
  // 附加使用者名稱
  const users = getAllData(CONFIG.SHEETS.USERS).rows;
  const userMap = {};
  users.forEach(u => userMap[u.userId] = u.name);
  
  return requests.map(r => ({
    userId: r.userId,
    name: userMap[r.userId] || r.userId.split('@')[0],
    text: r.text,
    updatedAt: r.ts
  }));
}
