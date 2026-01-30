import { useState, useEffect } from 'react';

export default function MobileCalendar({
    monthModel,
    renderDayContent,
    renderDayHeader,  // 可選：自訂日期區域額外內容
    className = '',
    defaultExpanded = false,  // 新增：是否預設展開所有卡片
    disabledDates = [],  // 新增：閉館日列表
    showDayName = false,  // 新增：是否顯示星期幾
}) {
    const [expandedDates, setExpandedDates] = useState(new Set());

    // 當 monthModel 變更或 defaultExpanded 為 true 時，展開所有日期
    useEffect(() => {
        if (defaultExpanded && monthModel && monthModel.days.length > 0) {
            const allDates = new Set(monthModel.days.map(day => day.date));
            setExpandedDates(allDates);
        } else if (!defaultExpanded) {
            setExpandedDates(new Set());
        }
    }, [monthModel, defaultExpanded]);

    if (!monthModel || !monthModel.days.length) {
        return (
            <div className="text-center text-base-content/50 py-10">
                載入中...
            </div>
        );
    }

    const toggleDate = (date) => {
        setExpandedDates(prev => {
            const next = new Set(prev);
            if (next.has(date)) {
                next.delete(date);
            } else {
                next.add(date);
            }
            return next;
        });
    };

    // 檢查日期是否為閉館日
    const isClosedDay = (date) => {
        return disabledDates.some(d => d.date === date);
    };

    return (
        <div className={`mobile-calendar space-y-2 ${className}`}>
            {monthModel.days.map((day, dayIndex) => {
                const isExpanded = expandedDates.has(day.date);
                const dateNum = parseInt(day.date.split('-')[2]);
                const isClosed = isClosedDay(day.date);

                return (
                    <div
                        key={day.date}
                        className={`
                            mobile-calendar-item rounded-box border
                            ${isExpanded ? 'expanded' : ''}
                            ${isClosed
                                ? 'bg-base-300/50 border-base-300'
                                : day.isWeekend
                                    ? 'bg-warning/10 border-warning/30'
                                    : 'bg-base-100 border-base-300'
                            }
                        `}
                    >
                        {/* 日期標題（可點擊展開） */}
                        <div className="flex items-center justify-between p-3">
                            <button
                                onClick={() => !isClosed && toggleDate(day.date)}
                                className={`flex-1 flex items-center justify-between text-left transition-colors ${isClosed ? 'cursor-not-allowed' : 'hover:bg-base-200/50'}`}
                                disabled={isClosed}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`
                                        w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                                        ${isClosed
                                            ? 'bg-base-300 text-base-content/30 opacity-60'
                                            : day.isWeekend
                                                ? 'bg-warning/20 text-warning'
                                                : 'bg-base-200'
                                        }
                                    `}>
                                        {dateNum}
                                    </span>
                                    <div className="flex flex-col">
                                        {showDayName && (
                                            <span className={`text-sm ${isClosed ? 'text-base-content/50' : day.isWeekend ? 'text-warning' : 'text-base-content/60'}`}>
                                                週{day.dayName}
                                            </span>
                                        )}
                                        {!isClosed && (
                                            <span className="text-xs text-base-content/50">
                                                {day.shifts.length} 個時段
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!isClosed && (
                                    <svg
                                        className={`w-5 h-5 text-base-content/50 transition-transform ml-auto ${isExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                )}
                            </button>
                            {/* 自訂日期區域額外內容（如清除按鈕） - 靠右顯示 */}
                            {renderDayHeader && (
                                <div className="ml-2 flex-shrink-0">
                                    {renderDayHeader(day)}
                                </div>
                            )}
                        </div>

                        {/* 展開內容 */}
                        {isExpanded && !isClosed && (
                            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-base-300/50 animate-fade-in">
                                {renderDayContent(day, 0, 1, day.dayOfWeek)}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
