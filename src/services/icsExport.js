/**
 * ICS 日曆檔案匯出服務
 * 用於將班表匯出為標準的 iCalendar (.ics) 格式
 */

/**
 * 生成唯一的事件 ID
 */
function generateUID() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@campus-shift-scheduler`;
}

/**
 * 將日期和時間格式化為 ICS 格式 (YYYYMMDDTHHMMSS)
 * @param {string} dateStr - 日期字串 (YYYY-MM-DD)
 * @param {string} timeStr - 時間字串 (HH:MM)
 * @param {boolean} isNextDay - 是否跨日 (例如 24:00 變成隔日 00:00)
 */
function formatICSDateTime(dateStr, timeStr, isNextDay = false) {
    const [year, month, day] = dateStr.split('-').map(Number);
    let [hour, minute] = timeStr.split(':').map(Number);

    // 處理 24:00 格式
    if (hour >= 24) {
        hour = hour - 24;
        isNextDay = true;
    }

    let date = new Date(year, month - 1, day);

    if (isNextDay) {
        date.setDate(date.getDate() + 1);
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(hour).padStart(2, '0');
    const min = String(minute).padStart(2, '0');

    return `${y}${m}${d}T${h}${min}00`;
}

/**
 * 將使用者的排班資料轉換為 ICS 事件
 * @param {Object} params - 參數
 * @param {string} params.userEmail - 使用者 Email
 * @param {string} params.userName - 使用者名稱
 * @param {Array} params.roster - 排班資料
 * @param {Array} params.shiftRules - 班次規則
 * @param {string} params.month - 月份 (YYYY-MM)
 * @returns {Array} ICS 事件陣列
 */
function generateEventsForUser({ userEmail, userName, roster, shiftRules, month }) {
    // 篩選出該使用者的班次
    const userShifts = roster.filter(r => r.assignedUserId === userEmail);

    // 建立規則查詢 Map
    const ruleMap = {};
    shiftRules.forEach(r => {
        ruleMap[r.ruleId] = r;
    });

    const events = [];

    userShifts.forEach(shift => {
        const rule = ruleMap[shift.ruleId];
        if (!rule) return;

        const startTime = formatICSDateTime(shift.date, rule.start);

        // 處理結束時間 (如果是 24:00 則需要特殊處理)
        let endTime;
        if (rule.end === '24:00') {
            endTime = formatICSDateTime(shift.date, '00:00', true);
        } else {
            const [endHour] = rule.end.split(':').map(Number);
            if (endHour >= 24) {
                endTime = formatICSDateTime(shift.date, `${endHour - 24}:00`, true);
            } else {
                endTime = formatICSDateTime(shift.date, rule.end);
            }
        }

        events.push({
            uid: generateUID(),
            summary: `活動中心值班`,
            description: `班次: ${rule.label}`,
            dtstart: startTime,
            dtend: endTime,
            location: '活動中心',
            attendee: userName,
        });
    });

    return events;
}

/**
 * 生成 ICS 檔案內容
 * @param {Array} events - 事件陣列
 * @param {string} calendarName - 日曆名稱
 * @returns {string} ICS 檔案內容
 */
function generateICSContent(events, calendarName = '活動中心值班表') {
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Campus Shift Scheduler//NONSGML v1.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${calendarName}`,
    ];

    events.forEach(event => {
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${event.uid}`);
        lines.push(`DTSTAMP:${formatICSDateTime(new Date().toISOString().split('T')[0], '00:00')}`);
        lines.push(`DTSTART:${event.dtstart}`);
        lines.push(`DTEND:${event.dtend}`);
        lines.push(`SUMMARY:${event.summary}`);
        if (event.description) {
            lines.push(`DESCRIPTION:${event.description}`);
        }
        if (event.location) {
            lines.push(`LOCATION:${event.location}`);
        }
        lines.push('STATUS:CONFIRMED');
        lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
}

/**
 * 下載 ICS 檔案
 * @param {string} content - ICS 內容
 * @param {string} filename - 檔案名稱
 */
function downloadICSFile(content, filename) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * 匯出使用者的班表為 ICS 檔案
 * @param {Object} params - 參數
 * @param {string} params.userEmail - 使用者 Email
 * @param {string} params.userName - 使用者名稱
 * @param {Array} params.roster - 排班資料
 * @param {Array} params.shiftRules - 班次規則
 * @param {string} params.month - 月份 (YYYY-MM)
 * @returns {Object} 結果
 */
export function exportUserScheduleToICS({ userEmail, userName, roster, shiftRules, month }) {
    const events = generateEventsForUser({ userEmail, userName, roster, shiftRules, month });

    if (events.length === 0) {
        return { success: false, message: '本月沒有排班資料', count: 0 };
    }

    const content = generateICSContent(events, `${month} 值班表 - ${userName}`);
    const filename = `值班表_${month}_${userName}.ics`;

    downloadICSFile(content, filename);

    return { success: true, message: '成功匯出行事曆', count: events.length };
}

/**
 * 生成 Google Calendar 加入連結
 * @param {Object} event - 事件資訊
 * @returns {string} Google Calendar URL
 */
export function generateGoogleCalendarURL({ title, description, location, startDate, startTime, endDate, endTime }) {
    const baseUrl = 'https://calendar.google.com/calendar/render';

    // 格式化日期時間為 Google Calendar 格式
    const formatDateTime = (date, time) => {
        const [y, m, d] = date.split('-');
        const [h, min] = time.split(':');
        return `${y}${m}${d}T${h}${min}00`;
    };

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatDateTime(startDate, startTime)}/${formatDateTime(endDate || startDate, endTime)}`,
        details: description || '',
        location: location || '',
    });

    return `${baseUrl}?${params.toString()}`;
}

/**
 * 生成所有班次的 Google Calendar 批次加入連結
 * 注意：Google Calendar 不支援批次加入，所以這裡只能開多個視窗
 * 建議使用 ICS 下載方式
 */
export function openGoogleCalendarForShift({ roster, shiftRules, userEmail, date, ruleId }) {
    const shift = roster.find(r => r.date === date && r.ruleId === ruleId && r.assignedUserId === userEmail);
    if (!shift) return null;

    const rule = shiftRules.find(r => r.ruleId === ruleId);
    if (!rule) return null;

    const url = generateGoogleCalendarURL({
        title: '活動中心值班',
        description: `班次: ${rule.label}`,
        location: '活動中心',
        startDate: date,
        startTime: rule.start,
        endDate: rule.end >= '24:00' ? getNextDay(date) : date,
        endTime: rule.end >= '24:00' ? '00:00' : rule.end,
    });

    window.open(url, '_blank');
    return url;
}

/**
 * 取得隔日日期
 */
function getNextDay(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
