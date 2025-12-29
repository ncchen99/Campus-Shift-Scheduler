/**
 * 班段邏輯模組
 * shifts.gs
 */

/**
 * 取得指定月份的班段模型
 * @param {string} month - 月份格式 'YYYY-MM'
 * @returns {Object} { month, days: [{ date, dayOfWeek, isWeekend, shifts: [...] }] }
 */
function getMonthModel(month) {
  const [year, mon] = month.split("-").map(Number);
  const firstDay = new Date(year, mon - 1, 1);
  const lastDay = new Date(year, mon, 0);

  const shiftRules = getAllData(CONFIG.SHEETS.SHIFT_RULES).rows;

  const weekdayShifts = shiftRules.filter((r) => r.appliesTo === "weekday");
  const weekendShifts = shiftRules.filter((r) => r.appliesTo === "weekend");

  const days = [];

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, mon - 1, d);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dateStr = formatDate(date);
    const shifts = isWeekend ? weekendShifts : weekdayShifts;

    days.push({
      date: dateStr,
      dayOfWeek: dayOfWeek,
      dayName: getDayName(dayOfWeek),
      isWeekend: isWeekend,
      shifts: shifts.map((s) => {
        const startStr = ensureStringTime(s.start);
        const endStr = ensureStringTime(s.end);
        return {
          ruleId: s.ruleId,
          label: `${startStr} ~ ${endStr}`,  // 動態生成 label，格式：16:00 ~ 20:00
          start: startStr,
          end: endStr,
          hours: calculateHours(s.start, s.end),
        };
      }),
    });
  }

  return {
    month: month,
    year: year,
    monthNum: mon,
    days: days,
  };
}

/**
 * 格式化日期為 YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 確保時間為 HH:mm 格式字串
 */
function ensureStringTime(time) {
  if (time instanceof Date) {
    const h = String(time.getHours()).padStart(2, "0");
    const m = String(time.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }
  if (typeof time === "number") {
    const totalMinutes = Math.round(time * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(time || "");
}

/**
 * 確保 label 為字串格式
 * 處理 Google Sheets 可能將 '08-12' 誤判為日期的問題
 */
function ensureStringLabel(label) {
  if (label instanceof Date) {
    // 如果被誤判為日期，嘗試還原成 HH-HH 格式
    const h = String(label.getHours()).padStart(2, "0");
    const m = String(label.getMinutes()).padStart(2, "0");
    // 假設 label 格式是 "開始時-結束時"，只取小時
    // 由於被誤判為日期，我們無法完全還原，所以直接返回時間部分
    return `${h}:${m}`;
  }
  return String(label || "");
}

/**
 * 取得星期幾名稱
 */
function getDayName(dayOfWeek) {
  const names = ["日", "一", "二", "三", "四", "五", "六"];
  return names[dayOfWeek];
}

/**
 * 解析時間為 [hours, minutes]
 */
function parseTime(time) {
  if (time instanceof Date) {
    return [time.getHours(), time.getMinutes()];
  }
  if (typeof time === "string" && time.includes(":")) {
    return time.split(":").map(Number);
  }
  if (typeof time === "number") {
    const totalMinutes = Math.round(time * 24 * 60);
    return [Math.floor(totalMinutes / 60), totalMinutes % 60];
  }
  return [0, 0];
}

/**
 * 計算時數
 * @param {string|Date|number} start - 開始時間
 * @param {string|Date|number} end - 結束時間
 * @returns {number} 時數
 */
function calculateHours(start, end) {
  const [sh, sm] = parseTime(start);
  const [eh, em] = parseTime(end);

  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;

  // 處理跨日（如 21:00-00:00）或 24:00
  if (endMin <= startMin) {
    endMin += 24 * 60;
  }

  return (endMin - startMin) / 60;
}

/**
 * 取得所有班段規則
 */
function getShiftRules() {
  return getAllData(CONFIG.SHEETS.SHIFT_RULES).rows;
}
