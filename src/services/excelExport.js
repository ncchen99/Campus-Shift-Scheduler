import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// 預定義的顏色列表（用於區分不同使用者）
const USER_COLORS = [
    { bg: 'FFE8F5E9', font: '1B5E20' }, // 淺綠
    { bg: 'FFFFF3E0', font: 'E65100' }, // 淺橙
    { bg: 'FFE3F2FD', font: '0D47A1' }, // 淺藍
    { bg: 'FFFCE4EC', font: 'AD1457' }, // 淺粉
    { bg: 'FFF3E5F5', font: '6A1B9A' }, // 淺紫
    { bg: 'FFFFF8E1', font: 'F57F17' }, // 淺黃
    { bg: 'FFE0F7FA', font: '00695C' }, // 淺青
    { bg: 'FFFFEBEE', font: 'B71C1C' }, // 淺紅
    { bg: 'FFE8EAF6', font: '283593' }, // 淺靛
    { bg: 'FFF1F8E9', font: '33691E' }, // 淺萊姆
    { bg: 'FFECEFF1', font: '37474F' }, // 淺灰藍
    { bg: 'FFFBE9E7', font: 'BF360C' }, // 淺深橙
];

/**
 * 匯出排班表為 Excel - 按時段橫向排列，每週一區塊
 * 格式：
 * 類別:     一(17-21) | 一(21-24) | 二(17-21) | ...
 * 日期:     12月1日   | 12月1日   | 12月2日   | ...
 * 當日值班: 念誠      | 念誠      | 張祐銘    | ...
 */
export async function exportRosterToExcel(monthModel, roster, users, shiftRules, currentMonth) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '活動中心排班系統';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('排班表');

    // 建立排班的快速查詢 Map
    const rosterMap = {};
    roster.forEach(r => {
        const key = `${r.date}_${r.ruleId}`;
        rosterMap[key] = r.assignedUserId;
    });

    // 建立使用者名稱查詢 Map 和顏色對應
    const userNameMap = {};
    const userColorMap = {};
    users.forEach((u, index) => {
        userNameMap[u.email] = u.name || u.email.split('@')[0];
        userColorMap[u.email] = USER_COLORS[index % USER_COLORS.length];
    });

    // 分組為週次
    const weeks = getWeeksFromMonth(monthModel);

    // 星期對照
    const dayNameMap = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };

    let currentRow = 1;

    // 處理每一週
    weeks.forEach((week) => {
        // 收集這一週所有的欄位資料
        const columns = []; // { dayName, shiftLabel, date, dateStr, assignedUserId, assignedName }

        week.forEach(day => {
            if (!day) return;

            const dayName = dayNameMap[day.dayOfWeek];
            const month = parseInt(day.date.split('-')[1]);
            const dayNum = parseInt(day.date.split('-')[2]);
            const dateStr = `${month}月${dayNum}日 (${dayName})`;

            day.shifts.forEach(shift => {
                const key = `${day.date}_${shift.ruleId}`;
                const assignedUserId = rosterMap[key];
                const assignedName = assignedUserId ? userNameMap[assignedUserId] : '';

                columns.push({
                    dayName,
                    // 格式化時段，移除 :00 並將 ~ 改為 -
                    shiftLabel: shift.label.replace(/:00/g, '').replace('~', '-'),
                    date: day.date,
                    dateStr,
                    assignedUserId,
                    assignedName,
                    isWeekend: day.isWeekend
                });
            });
        });

        if (columns.length === 0) return;

        // ============ 第一列：日期 ============
        const dateRow = currentRow;
        worksheet.getCell(dateRow, 1).value = '日期';
        styleHeaderCell(worksheet.getCell(dateRow, 1), 'FFF3E5F5'); // 極淺紫標籤

        columns.forEach((col, index) => {
            const cell = worksheet.getCell(dateRow, index + 2);
            cell.value = col.dateStr;
            if (col.isWeekend) {
                styleHeaderCell(cell, 'FFFFF3E0'); // 週末極淺橙色
            } else {
                styleHeaderCell(cell, 'FFE8F5E9'); // 平日極淺綠色
            }
        });

        // 合併相同日期的儲存格
        let i = 0;
        while (i < columns.length) {
            const currentDate = columns[i].dateStr;
            let j = i + 1;
            while (j < columns.length && columns[j].dateStr === currentDate) {
                j++;
            }
            if (j > i + 1) {
                worksheet.mergeCells(dateRow, i + 2, dateRow, j + 1);
            }
            i = j;
        }

        currentRow++;

        // ============ 第二列：時段 ============
        const categoryRow = currentRow;
        worksheet.getCell(categoryRow, 1).value = '時段';
        styleSubHeaderCell(worksheet.getCell(categoryRow, 1));

        columns.forEach((col, index) => {
            const cell = worksheet.getCell(categoryRow, index + 2);
            cell.value = col.shiftLabel;
            styleSubHeaderCell(cell);
        });

        currentRow++;

        // ============ 第三列：當日值班 ============
        const staffRow = currentRow;
        worksheet.getCell(staffRow, 1).value = '當日值班';
        styleSubHeaderCell(worksheet.getCell(staffRow, 1));
        worksheet.getRow(staffRow).height = 30; // 增加高度

        columns.forEach((col, index) => {
            const cell = worksheet.getCell(staffRow, index + 2);
            cell.value = col.assignedName || '';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = getThinBorder();

            if (col.assignedUserId && userColorMap[col.assignedUserId]) {
                const userColor = userColorMap[col.assignedUserId];
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: userColor.bg }
                };
                // 名字加粗並確保顏色顯眼
                cell.font = { 
                    bold: true, 
                    color: { argb: userColor.font },
                    size: 11
                };
            }
        });

        // 合併連續相同人名的儲存格
        i = 0;
        while (i < columns.length) {
            const currentUserId = columns[i].assignedUserId;
            if (currentUserId) {
                let j = i + 1;
                while (j < columns.length && columns[j].assignedUserId === currentUserId) {
                    j++;
                }
                if (j > i + 1) {
                    worksheet.mergeCells(staffRow, i + 2, staffRow, j + 1);
                }
                i = j;
            } else {
                i++;
            }
        }

        currentRow++;

        // 週與週之間加一個空列
        currentRow++;
    });

    // 設定欄寬
    worksheet.getColumn(1).width = 10;
    for (let col = 2; col <= 20; col++) {
        worksheet.getColumn(col).width = 12;
    }

    // ============ 第二個工作表：工時統計 ============
    const worksheet2 = workbook.addWorksheet('工時統計');

    worksheet2.getColumn(1).width = 15;
    worksheet2.getColumn(2).width = 10;
    worksheet2.getColumn(3).width = 10;

    // 標題列
    worksheet2.getCell(1, 1).value = '姓名';
    worksheet2.getCell(1, 2).value = '班次';
    worksheet2.getCell(1, 3).value = '工時';

    [1, 2, 3].forEach(col => {
        const cell = worksheet2.getCell(1, col);
        styleHeaderCell(cell, 'FFE0F7FA');
    });

    // 計算每個使用者的工時
    const userStats = {};
    roster.forEach(r => {
        if (!r.assignedUserId) return;
        if (!userStats[r.assignedUserId]) {
            userStats[r.assignedUserId] = {
                name: userNameMap[r.assignedUserId] || r.assignedUserId.split('@')[0],
                shiftsCount: 0,
                hours: 0
            };
        }
        userStats[r.assignedUserId].shiftsCount++;

        const rule = shiftRules.find(s => s.ruleId === r.ruleId);
        if (rule) {
            userStats[r.assignedUserId].hours += calculateHours(rule.start, rule.end);
        }
    });

    // 填入統計資料
    let statsRow = 2;
    Object.keys(userStats)
        .sort((a, b) => userStats[b].hours - userStats[a].hours)
        .forEach(userId => {
            const stats = userStats[userId];
            const userColor = userColorMap[userId];

            worksheet2.getCell(statsRow, 1).value = stats.name;
            worksheet2.getCell(statsRow, 2).value = stats.shiftsCount;
            worksheet2.getCell(statsRow, 3).value = stats.hours;

            [1, 2, 3].forEach(col => {
                const cell = worksheet2.getCell(statsRow, col);
                cell.border = getThinBorder();
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (userColor) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: userColor.bg }
                    };
                }
            });

            statsRow++;
        });

    // ============ 匯出檔案 ============
    const [year, month] = currentMonth.split('-');
    const fileName = `排班表_${year}年${month}月.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, fileName);

    return fileName;
}

// 樣式輔助函式
function styleHeaderCell(cell, bgColor = 'FFE0F7FA') {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
    };
    // 移除粗體，由於背景變淡，將文字顏色改為黑色以增加視覺對比
    cell.font = { bold: false, color: { argb: 'FF000000' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = getThinBorder();
}

function styleSubHeaderCell(cell) {
    cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    cell.font = { size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = getThinBorder();
}

function getThinBorder() {
    return {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };
}

function calculateHours(start, end) {
    const parseTime = (timeStr) => {
        if (typeof timeStr !== 'string') return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h + (m || 0) / 60;
    };
    const startHours = parseTime(start);
    const endHours = parseTime(end);
    return endHours > startHours ? endHours - startHours : 24 - startHours + endHours;
}

// 取得月份的週次分組 - 以週一為起始
function getWeeksFromMonth(monthModel) {
    const weeks = [];
    let currentWeek = [];

    monthModel.days.forEach((day, index) => {
        // 如果是第一天且不是週一，需要在前面補空格
        // 週一=1, 週二=2...週六=6, 週日=0
        // 補位數量: (day.dayOfWeek + 6) % 7 
        if (index === 0) {
            const paddingCount = (day.dayOfWeek + 6) % 7;
            for (let i = 0; i < paddingCount; i++) {
                currentWeek.push(null);
            }
        }

        // 如果新的一週開始（週一）且不是第一天
        if (day.dayOfWeek === 1 && currentWeek.length > 0) {
            // 補齊前一週到 7 天（如果需要）
            while (currentWeek.length < 7) {
                currentWeek.push(null);
            }
            weeks.push(currentWeek);
            currentWeek = [];
        }

        currentWeek.push(day);
    });

    // 最後一週的處理
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    return weeks;
}
