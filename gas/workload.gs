/**
 * 工時統計模組
 * workload.gs
 */

/**
 * 取得指定月份的工時統計
 * @param {string} month - 月份格式 'YYYY-MM'
 * @returns {Object} { userId: { name, hours, shiftsCount } }
 */
function getMonthlyWorkload(month) {
  checkIsLeader();
  
  // 取得班段規則（用於計算時數）
  const shiftRules = getAllData(CONFIG.SHEETS.SHIFT_RULES).rows;
  const ruleHours = {};
  shiftRules.forEach(r => {
    ruleHours[r.ruleId] = calculateHours(r.start, r.end);
  });
  
  // 取得該月排班
  const roster = getAllData(CONFIG.SHEETS.ROSTER).rows;
  const monthRoster = roster.filter(r => r.month === month);
  
  // 取得使用者名稱
  const users = getAllData(CONFIG.SHEETS.USERS).rows;
  const userMap = {};
  users.forEach(u => {
    userMap[u.userId] = {
      name: u.name,
      hours: 0,
      shiftsCount: 0,
      dates: []
    };
  });
  
  // 統計工時
  monthRoster.forEach(r => {
    const userId = r.assignedUserId;
    if (!userId) return;
    
    if (!userMap[userId]) {
      userMap[userId] = {
        name: userId.split('@')[0],
        hours: 0,
        shiftsCount: 0,
        dates: []
      };
    }
    
    const hours = ruleHours[r.ruleId] || 0;
    userMap[userId].hours += hours;
    userMap[userId].shiftsCount += 1;
    userMap[userId].dates.push(r.date);
  });
  
  // 轉為陣列並排序
  const result = Object.keys(userMap)
    .filter(userId => userMap[userId].shiftsCount > 0)
    .map(userId => ({
      userId: userId,
      name: userMap[userId].name,
      hours: userMap[userId].hours,
      shiftsCount: userMap[userId].shiftsCount,
      uniqueDays: [...new Set(userMap[userId].dates)].length
    }))
    .sort((a, b) => b.hours - a.hours);
  
  return result;
}

/**
 * 取得指定使用者的詳細工時（可用於檢視細節）
 * @param {string} month - 月份格式 'YYYY-MM'
 * @param {string} userId - 使用者 ID
 */
function getUserWorkloadDetails(month, userId) {
  checkIsLeader();
  
  const shiftRules = getAllData(CONFIG.SHEETS.SHIFT_RULES).rows;
  const ruleInfo = {};
  shiftRules.forEach(r => {
    ruleInfo[r.ruleId] = {
      label: r.label,
      hours: calculateHours(r.start, r.end)
    };
  });
  
  const roster = queryData(CONFIG.SHEETS.ROSTER, { month, assignedUserId: userId });
  
  return roster.map(r => ({
    date: r.date,
    ruleId: r.ruleId,
    label: ruleInfo[r.ruleId]?.label || r.ruleId,
    hours: ruleInfo[r.ruleId]?.hours || 0
  })).sort((a, b) => a.date.localeCompare(b.date));
}
