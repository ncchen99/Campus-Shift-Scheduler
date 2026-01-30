import { getWeeksFromMonth } from '../services/firestore';

export default function Calendar({
    monthModel,
    renderDayContent,
    renderDayHeader,  // 可選：自訂日期標題區域（傳入 day 物件）
    className = '',
    disabledDates = [],  // 新增：閉館日列表
}) {
    if (!monthModel || !monthModel.days.length) {
        return (
            <div className="text-center text-base-content/50 py-10">
                載入中...
            </div>
        );
    }

    const weeks = getWeeksFromMonth(monthModel);

    // 檢查日期是否為閉館日
    const isClosedDay = (date) => {
        return disabledDates.some(d => d.date === date);
    };

    return (
        <div className={`calendar-grid ${className}`}>
            {/* 星期標題列 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {['日', '一', '二', '三', '四', '五', '六'].map((day, i) => (
                    <div
                        key={day}
                        className={`text-center text-sm font-medium py-2 ${i === 0 || i === 6 ? 'text-error' : 'text-base-content/70'
                            }`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* 週次 */}
            {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                    {week.map((day, dayIndex) => {
                        if (!day) {
                            // 空格 (月初或月底的填充)
                            return (
                                <div
                                    key={`empty-${weekIndex}-${dayIndex}`}
                                    className="min-h-[100px]"
                                />
                            );
                        }

                        const dateNum = parseInt(day.date.split('-')[2]);
                        const isClosed = isClosedDay(day.date);

                        return (
                            <div
                                key={day.date}
                                className={`
                  min-h-[100px] rounded-box p-2 border
                  ${isClosed
                                        ? 'bg-base-300/50 border-base-300'
                                        : day.isWeekend
                                            ? 'bg-warning/10 border-warning/30'
                                            : 'bg-base-100 border-base-300'
                                    }
                `}
                            >
                                {/* 日期標題 */}
                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-base-300">
                                    <div className="flex items-center gap-1">
                                        <span className={`font-bold ${isClosed ? 'text-base-content/30 opacity-50' : ''}`}>{dateNum}日</span>
                                        {/* 自訂日期標題區域（如清除按鈕） */}
                                        {renderDayHeader && renderDayHeader(day)}
                                    </div>
                                    <span className={`text-xs ${isClosed ? 'text-base-content/30 opacity-50' : day.isWeekend ? 'text-error' : 'text-base-content/60'}`}>
                                        週{day.dayName}
                                    </span>
                                </div>

                                {/* 班段內容 - 由父組件提供，傳入 dayIndex 用於判斷位置 */}
                                <div className={`space-y-1 ${isClosed ? 'opacity-60' : ''}`}>
                                    {renderDayContent(day, weekIndex, weeks.length, dayIndex)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

