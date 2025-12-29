/**
 * 資料庫讀寫 Helper
 * db.gs
 */

/**
 * 取得工作表所有資料（含標題）
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { headers: [], rows: [] }
 */
function getAllData(sheetName) {
  const sheet = getSheet(sheetName);
  if (!sheet) return { headers: [], rows: [] };
  
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return { headers: [], rows: [] };
  
  const headers = data[0];
  const rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  
  return { headers, rows };
}

/**
 * 根據條件查詢資料
 * @param {string} sheetName - 工作表名稱
 * @param {Object} filter - 過濾條件 { key: value }
 * @returns {Array} 符合條件的資料列
 */
function queryData(sheetName, filter) {
  const { rows } = getAllData(sheetName);
  return rows.filter(row => {
    return Object.keys(filter).every(key => row[key] === filter[key]);
  });
}

/**
 * 新增一筆資料
 * @param {string} sheetName - 工作表名稱
 * @param {Object} data - 要新增的資料
 */
function appendRow(sheetName, data) {
  const sheet = getSheet(sheetName);
  const { headers } = getAllData(sheetName);
  
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);
}

/**
 * 刪除符合條件的資料
 * @param {string} sheetName - 工作表名稱
 * @param {Object} filter - 過濾條件
 */
function deleteRows(sheetName, filter) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;
  
  const headers = data[0];
  
  // 從後往前刪除，避免索引問題
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    
    const match = Object.keys(filter).every(key => obj[key] === filter[key]);
    if (match) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * 更新或新增資料（Upsert）
 * @param {string} sheetName - 工作表名稱
 * @param {Object} filter - 查詢條件
 * @param {Object} data - 更新的資料
 */
function upsertRow(sheetName, filter, data) {
  const sheet = getSheet(sheetName);
  const allData = sheet.getDataRange().getValues();
  if (allData.length === 0) return;
  
  const headers = allData[0];
  let found = false;
  
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    
    const match = Object.keys(filter).every(key => obj[key] === filter[key]);
    if (match) {
      // 更新該列
      const newRow = headers.map(h => {
        if (data[h] !== undefined) return data[h];
        return obj[h];
      });
      sheet.getRange(i + 1, 1, 1, headers.length).setValues([newRow]);
      found = true;
      break;
    }
  }
  
  if (!found) {
    appendRow(sheetName, { ...filter, ...data });
  }
}

/**
 * 取得當前時間戳
 */
function getTimestamp() {
  return new Date().toISOString();
}
