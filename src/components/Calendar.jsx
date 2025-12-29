import { getWeeksFromMonth } from '../services/firestore';

export default function Calendar({
    monthModel,
    renderDayContent,
    className = ''
}) {
    if (!monthModel || !monthModel.days.length) {
        return (
            <div className="text-center text-base-content/50 py-10">
                載入中...
            </div>
        );
    }

    const weeks = getWeeksFromMonth(monthModel);

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

                        return (
                            <div
                                key={day.date}
                                className={`
                  min-h-[100px] rounded-box p-2 border
                  ${day.isWeekend
                                        ? 'bg-warning/10 border-warning/30'
                                        : 'bg-base-100 border-base-300'
                                    }
                `}
                            >
                                {/* 日期標題 */}
                                <div className="flex justify-between items-center mb-2 pb-1 border-b border-base-300">
                                    <span className="font-bold">{dateNum}日</span>
                                    <span className={`text-xs ${day.isWeekend ? 'text-error' : 'text-base-content/60'}`}>
                                        週{day.dayName}
                                    </span>
                                </div>

                                {/* 班段內容 - 由父組件提供 */}
                                <div className="space-y-1">
                                    {renderDayContent(day, weekIndex, weeks.length)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
