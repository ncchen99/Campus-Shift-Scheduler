export default function MonthSelector({ currentMonth, onMonthChange }) {
    const formatMonthDisplay = (month) => {
        const [year, mon] = month.split('-');
        return `${year} 年 ${parseInt(mon)} 月`;
    };

    const handlePrevMonth = () => {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month - 2, 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange(newMonth);
    };

    const handleNextMonth = () => {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month, 1);
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange(newMonth);
    };

    return (
        <div className="flex items-center justify-center gap-4 mb-6">
            <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={handlePrevMonth}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <span className="text-xl font-bold min-w-[140px] text-center">
                {formatMonthDisplay(currentMonth)}
            </span>

            <button
                className="btn btn-circle btn-ghost btn-sm"
                onClick={handleNextMonth}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
