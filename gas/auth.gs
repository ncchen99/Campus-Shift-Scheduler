/**
 * 認證與權限模組
 * auth.gs
 */

/**
 * 取得當前登入使用者資訊
 * @returns {Object} { email, name, role, isLeader, isAdmin }
 */
function getMe() {
  const email = Session.getActiveUser().getEmail();
  
  if (!email) {
    return {
      email: null,
      name: '未登入',
      role: 'guest',
      isLeader: false,
      isAdmin: false
    };
  }
  
  // 檢查是否為管理員
  const admins = queryData(CONFIG.SHEETS.ADMINS, { active: true });
  const isAdmin = admins.some(a => a.email === email);
  
  // 檢查使用者資料
  const users = queryData(CONFIG.SHEETS.USERS, { userId: email });
  const user = users[0];
  
  if (user) {
    return {
      email: email,
      name: user.name,
      role: user.role,
      isLeader: user.role === 'leader' || isAdmin,
      isAdmin: isAdmin
    };
  }
  
  // 使用者不在清單中，但可能是管理員
  if (isAdmin) {
    const adminInfo = admins.find(a => a.email === email);
    return {
      email: email,
      name: adminInfo?.name || email.split('@')[0],
      role: 'admin',
      isLeader: true,
      isAdmin: true
    };
  }
  
  // 新使用者，自動加入 Users 表
  const newUser = {
    userId: email,
    name: email.split('@')[0],
    role: 'user',
    active: true
  };
  appendRow(CONFIG.SHEETS.USERS, newUser);
  
  return {
    email: email,
    name: newUser.name,
    role: 'user',
    isLeader: false,
    isAdmin: false
  };
}

/**
 * 檢查是否為班長
 */
function checkIsLeader() {
  const me = getMe();
  if (!me.isLeader) {
    throw new Error('權限不足：需要班長權限');
  }
  return me;
}

/**
 * 檢查是否為管理員
 */
function checkIsAdmin() {
  const me = getMe();
  if (!me.isAdmin) {
    throw new Error('權限不足：需要管理員權限');
  }
  return me;
}

/**
 * 取得所有管理員列表
 */
function getAdmins() {
  checkIsAdmin();
  return queryData(CONFIG.SHEETS.ADMINS, { active: true });
}

/**
 * 新增管理員
 * @param {string} email - 管理員 Email
 * @param {string} name - 名稱
 */
function addAdmin(email, name) {
  const me = checkIsAdmin();
  
  // 檢查是否已存在
  const existing = queryData(CONFIG.SHEETS.ADMINS, { email: email });
  if (existing.length > 0) {
    throw new Error('此 Email 已是管理員');
  }
  
  appendRow(CONFIG.SHEETS.ADMINS, {
    email: email,
    name: name,
    createdAt: getTimestamp(),
    createdBy: me.email,
    active: true
  });
  
  return { success: true };
}

/**
 * 移除管理員
 * @param {string} email - 要移除的管理員 Email
 */
function removeAdmin(email) {
  const me = checkIsAdmin();
  
  // 不能移除自己（除非還有其他管理員）
  const admins = queryData(CONFIG.SHEETS.ADMINS, { active: true });
  
  if (admins.length <= 1) {
    throw new Error('至少需要保留一位管理員');
  }
  
  // 標記為非活動（軟刪除）
  upsertRow(CONFIG.SHEETS.ADMINS, { email: email }, { active: false });
  
  return { success: true };
}
