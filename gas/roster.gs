/**
 * 排班模組
 * roster.gs
 */

/**
 * 取得指定月份的排班表
 * @param {string} month - 月份格式 'YYYY-MM'
 */
function getRoster(month) {
  checkIsLeader();
  
  const roster = getAllData(CONFIG.SHEETS.ROSTER).rows;
  const monthRoster = roster.filter(r => r.month === month);
  
  // 附加使用者名稱
  const users = getAllData(CONFIG.SHEETS.USERS).rows;
  const userMap = {};
  users.forEach(u => userMap[u.userId] = u.name);
  
  return monthRoster.map(r => ({
    date: r.date,
    ruleId: r.ruleId,
    userId: r.assignedUserId,
    userName: userMap[r.assignedUserId] || r.assignedUserId?.split('@')[0] || '',
    assignedBy: r.assignedBy,
    assignedAt: r.ts
  }));
}

/**
 * 取得指定日期班段的候選人（排除沒空者）
 * @param {string} date - 日期格式 'YYYY-MM-DD'
 * @param {string} ruleId - 班段 ID
 */
function getCandidates(date, ruleId) {
  checkIsLeader();
  
  // 取得所有活躍使用者
  const users = queryData(CONFIG.SHEETS.USERS, { active: true });
  
  // 取得該日該班段的沒空名單
  const unavail = getAllData(CONFIG.SHEETS.UNAVAILABILITY).rows;
  const unavailUsers = unavail
    .filter(u => u.date === date && u.ruleId === ruleId)
    .map(u => u.userId);
  
  // 過濾可上班者
  const candidates = users.filter(u => !unavailUsers.includes(u.userId));
  
  return candidates.map(u => ({
    userId: u.userId,
    name: u.name
  }));
}

/**
 * 設定排班格子
 * @param {string} month - 月份格式 'YYYY-MM'
 * @param {string} date - 日期格式 'YYYY-MM-DD'
 * @param {string} ruleId - 班段 ID
 * @param {string} userId - 被指派的使用者 ID（空字串表示清除）
 * @param {Object} options - { autoFillSameDay: boolean }
 */
function setRosterCell(month, date, ruleId, userId, options = {}) {
  const me = checkIsLeader();
  const ts = getTimestamp();
  
  const affectedCells = [];
  
  // 更新指定格子
  const result = updateRosterCell(month, date, ruleId, userId, me.email, ts);
  affectedCells.push({ date, ruleId, userId });
  
  // 同日自動補齊
  if (options.autoFillSameDay && userId) {
    const monthModel = getMonthModel(month);
    const dayInfo = monthModel.days.find(d => d.date === date);
    
    if (dayInfo) {
      for (const shift of dayInfo.shifts) {
        if (shift.ruleId !== ruleId) {
          // 檢查目標格子是否已有人
          const existingRoster = queryData(CONFIG.SHEETS.ROSTER, { 
            month: month, 
            date: date, 
            ruleId: shift.ruleId 
          });
          
          if (existingRoster.length === 0) {
            // 檢查該使用者是否沒空
            const unavail = queryData(CONFIG.SHEETS.UNAVAILABILITY, {
              userId: userId,
              date: date,
              ruleId: shift.ruleId
            });
            
            if (unavail.length === 0) {
              updateRosterCell(month, date, shift.ruleId, userId, me.email, ts);
              affectedCells.push({ date, ruleId: shift.ruleId, userId });
            }
          }
        }
      }
    }
  }
  
  return { 
    success: true, 
    affectedCells: affectedCells
  };
}

/**
 * 更新單一排班格子
 * @private
 */
function updateRosterCell(month, date, ruleId, userId, assignedBy, ts) {
  if (!userId) {
    // 清除排班
    deleteRows(CONFIG.SHEETS.ROSTER, { month, date, ruleId });
    return { cleared: true };
  }
  
  // 更新或新增
  upsertRow(CONFIG.SHEETS.ROSTER, 
    { month, date, ruleId },
    { 
      ts: ts,
      assignedUserId: userId, 
      assignedBy: assignedBy 
    }
  );
  
  return { updated: true };
}

/**
 * 清除指定月份所有排班
 * @param {string} month - 月份格式 'YYYY-MM'
 */
function clearMonthRoster(month) {
  checkIsLeader();
  
  const sheet = getSheet(CONFIG.SHEETS.ROSTER);
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === month) {
      sheet.deleteRow(i + 1);
    }
  }
  
  return { success: true };
}
