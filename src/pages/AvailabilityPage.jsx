import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Calendar from '../components/Calendar';
import MobileCalendar from '../components/MobileCalendar';
import MonthSelector from '../components/MonthSelector';
import { useMobileView } from '../hooks/useMobileView';
import {
    getShiftRules,
    getMonthModel,
    getMyUnavailability,
    getMySpecialRequest,
    saveMyUnavailability,
    saveSpecialRequest,
    getAvailabilityConfirmation,
    setAvailabilityConfirmation,
    getClosedDays,
} from '../services/firestore';

export default function AvailabilityPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const isMobile = useMobileView();
    const [currentMonth, setCurrentMonth] = useState(getDefaultMonth());
    const [monthModel, setMonthModel] = useState(null);
    const [shiftRules, setShiftRules] = useState([]);
    const [unavailability, setUnavailability] = useState([]);
    const [specialRequest, setSpecialRequest] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [autoFillEnabled, setAutoFillEnabled] = useState(true);
    const [lastSavedState, setLastSavedState] = useState({ unavail: [], request: '' });
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'dirty' | 'saving' | 'error'
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // 確認填寫完成狀態
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);

    // 閉館日
    const [closedDays, setClosedDays] = useState([]);

    // 預設為下個月
    function getDefaultMonth() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    useEffect(() => {
        loadData();
    }, [currentMonth, user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [rules, unavail, request, confirmation, closed] = await Promise.all([
                getShiftRules(),
                getMyUnavailability(user.email, currentMonth),
                getMySpecialRequest(user.email, currentMonth),
                getAvailabilityConfirmation(user.email, currentMonth),
                getClosedDays(currentMonth),
            ]);

            setShiftRules(rules);
            const model = getMonthModel(currentMonth, rules);
            setMonthModel(model);

            setUnavailability(unavail);
            setSpecialRequest(request);
            setIsConfirmed(confirmation.confirmed || false);
            setClosedDays(closed);

            setLastSavedState({ unavail, request });
            setSaveStatus('saved');
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('載入資料失敗', 'error');
        }
        setLoading(false);
    };

    // 自動儲存邏輯
    useEffect(() => {
        if (loading || saving) return;

        const hasChanged =
            JSON.stringify(unavailability) !== JSON.stringify(lastSavedState.unavail) ||
            specialRequest !== lastSavedState.request;

        if (hasChanged) {
            setSaveStatus('dirty');
        } else {
            setSaveStatus('saved');
        }
    }, [unavailability, specialRequest, lastSavedState, loading, saving]);

    useEffect(() => {
        let timer;
        if (saveStatus === 'dirty') {
            timer = setTimeout(() => {
                handleSave(true); // 觸發自動儲存
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [saveStatus, unavailability, specialRequest]);

    // 檢查日期是否為閉館日
    const isClosedDay = (date) => {
        return closedDays.some(d => d.date === date);
    };

    const handleCheckboxChange = (date, ruleId, checked) => {
        // 如果是閉館日，不允許修改
        if (isClosedDay(date)) return;

        if (checked) {
            setUnavailability([...unavailability, { date, ruleId }]);
        } else {
            setUnavailability(unavailability.filter(
                u => !(u.date === date && u.ruleId === ruleId)
            ));
        }

        // 有任何修改時，取消確認狀態
        if (isConfirmed) {
            setIsConfirmed(false);
            // 同時更新資料庫
            setAvailabilityConfirmation(user.email, currentMonth, false).catch(console.error);
        }
    };

    // 點擊時段自動勾選（點擊的時段及之後的時段都會被選取）
    // 但如果當日已有任何選取，就不啟用自動補齊（代表使用者想個別操作）
    const handleShiftClick = (day, shift, shiftIndex, isChecked) => {
        // 如果是閉館日，不允許操作
        if (isClosedDay(day.date)) return;

        if (!autoFillEnabled) {
            handleCheckboxChange(day.date, shift.ruleId, isChecked);
            return;
        }

        // 檢查當日是否已有任何時段被選取
        const hasDaySelections = unavailability.some(u => u.date === day.date);

        if (isChecked) {
            // 如果當日已有選取，則不自動補齊，只操作單一時段
            if (hasDaySelections) {
                handleCheckboxChange(day.date, shift.ruleId, isChecked);
                return;
            }

            // 當日無選取時，勾選該時段及之後的所有時段
            const newUnavail = [...unavailability];
            day.shifts.forEach((s, idx) => {
                // 只處理當前時段及之後的時段
                if (idx >= shiftIndex) {
                    if (!newUnavail.some(u => u.date === day.date && u.ruleId === s.ruleId)) {
                        newUnavail.push({ date: day.date, ruleId: s.ruleId });
                    }
                }
            });
            setUnavailability(newUnavail);

            // 有任何修改時，取消確認狀態
            if (isConfirmed) {
                setIsConfirmed(false);
                setAvailabilityConfirmation(user.email, currentMonth, false).catch(console.error);
            }
        } else {
            // 只取消勾選當前時段
            handleCheckboxChange(day.date, shift.ruleId, isChecked);
        }
    };

    const handleClearAll = () => {
        if (unavailability.length === 0) {
            showToast('目前沒有選取任何時段', 'info');
            return;
        }
        setShowClearConfirm(true);
    };

    const confirmClearAll = () => {
        setUnavailability([]);
        setShowClearConfirm(false);
        showToast('已清空所有選擇', 'info');

        // 取消確認狀態
        if (isConfirmed) {
            setIsConfirmed(false);
            setAvailabilityConfirmation(user.email, currentMonth, false).catch(console.error);
        }
    };

    const handleSave = async (isAuto = false) => {
        if (saving) return;

        // 如果是手動儲存且狀態已經是 saved，則不重複執行
        if (!isAuto && saveStatus === 'saved') {
            showToast('資料已是最新狀態', 'info');
            return;
        }

        setSaving(true);
        if (isAuto) setSaveStatus('saving');

        try {
            await saveMyUnavailability(user.email, currentMonth, unavailability);
            await saveSpecialRequest(user.email, currentMonth, specialRequest);

            const newState = { unavail: [...unavailability], request: specialRequest };
            setLastSavedState(newState);
            setSaveStatus('saved');

            if (!isAuto) {
                showToast(`已儲存 ${unavailability.length} 筆沒空紀錄`, 'success');
            }
        } catch (error) {
            console.error('Error saving:', error);
            setSaveStatus('error');
            showToast('儲存失敗：' + error.message, 'error');
        }
        setSaving(false);
    };

    // 處理確認填寫完成
    const handleConfirmToggle = async () => {
        setConfirmLoading(true);
        try {
            // 先儲存所有資料
            if (saveStatus === 'dirty') {
                await saveMyUnavailability(user.email, currentMonth, unavailability);
                await saveSpecialRequest(user.email, currentMonth, specialRequest);
                setLastSavedState({ unavail: [...unavailability], request: specialRequest });
                setSaveStatus('saved');
            }

            const newConfirmState = !isConfirmed;
            await setAvailabilityConfirmation(user.email, currentMonth, newConfirmState);
            setIsConfirmed(newConfirmState);

            if (newConfirmState) {
                showToast('已確認填寫完成，您的資料將用於排班', 'success');
            } else {
                showToast('已取消確認，您可以繼續修改', 'info');
            }
        } catch (error) {
            console.error('Error updating confirmation:', error);
            showToast('更新確認狀態失敗', 'error');
        }
        setConfirmLoading(false);
    };

    const isUnavailable = (date, ruleId) => {
        return unavailability.some(u => u.date === date && u.ruleId === ruleId);
    };

    const renderDayContent = (day, weekIndex, totalWeeks) => {
        const isClosed = isClosedDay(day.date);

        // 如果是閉館日，顯示閉館提示
        if (isClosed) {
            return (
                <div className="flex items-center justify-center p-3 bg-base-300/50 rounded-btn text-base-content/50">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 mr-1">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <span className="text-sm font-medium">休館日</span>
                </div>
            );
        }

        return day.shifts.map((shift, index) => {
            const checked = isUnavailable(day.date, shift.ruleId);
            return (
                <label
                    key={shift.ruleId}
                    className={`
            flex items-center gap-1.5 p-1.5 rounded-btn cursor-pointer min-w-0
            ${checked ? 'bg-error/20' : 'bg-base-200 hover:bg-base-300'}
            transition-colors
          `}
                >
                    {/* 自訂 X 號勾選框 */}
                    <div className={`
                        w-4 h-4 rounded-full flex items-center justify-center transition-all flex-shrink-0 border-2
                        ${checked
                            ? 'bg-error border-error text-white scale-110 shadow-sm'
                            : 'bg-base-100 border-base-300'}
                    `}>
                        {checked && (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={5} stroke="currentColor" className="w-2.5 h-2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>

                    <input
                        type="checkbox"
                        className="hidden" // 隱藏原生 checkbox
                        checked={checked}
                        onChange={(e) => {
                            handleShiftClick(day, shift, index, e.target.checked);
                        }}
                    />
                    <span className="text-[10px] sm:text-xs flex-1 truncate font-medium" title={shift.label}>
                        {shift.label}
                    </span>
                </label>
            );
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 標題區 */}
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold mb-2">填寫沒空時間</h2>
                <p className="text-base-content/70">
                    請勾選您<strong className="text-error">無法上班</strong>的時段
                </p>
                <div className="flex justify-center">
                    <label className="label cursor-pointer gap-4 bg-base-200 px-4 py-2 rounded-full border border-base-300 shadow-sm">
                        <span className="label-text font-medium">同日自動勾選</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={autoFillEnabled}
                            onChange={(e) => setAutoFillEnabled(e.target.checked)}
                        />
                    </label>
                </div>
            </div>

            {/* 月份選擇器 */}
            <MonthSelector
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
            />

            {/* 日曆 - 響應式切換 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body p-4">
                    {isMobile ? (
                        <MobileCalendar
                            monthModel={monthModel}
                            renderDayContent={renderDayContent}
                            defaultExpanded={true}  // 手機版預設展開
                            disabledDates={closedDays}
                            showDayName={true}  // 顯示星期幾，幫助使用者確認日期
                        />
                    ) : (
                        <Calendar
                            monthModel={monthModel}
                            renderDayContent={renderDayContent}
                            disabledDates={closedDays}
                            showDayName={true}  // 顯示星期幾，幫助使用者確認日期
                        />
                    )}
                </div>
            </div>

            {/* 特殊需求 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title text-lg">特殊需求說明</h3>
                    <textarea
                        className="textarea textarea-bordered w-full"
                        placeholder="例如：希望連續時段、偏好週末、每週最多幾班..."
                        rows={3}
                        value={specialRequest}
                        onChange={(e) => {
                            setSpecialRequest(e.target.value);
                            // 有修改時取消確認狀態
                            if (isConfirmed) {
                                setIsConfirmed(false);
                                setAvailabilityConfirmation(user.email, currentMonth, false).catch(console.error);
                            }
                        }}
                    />
                </div>
            </div>

            {/* 確認填寫完成 */}
            <div className={`card shadow-lg mb-25 ${isConfirmed ? 'bg-success/10 border-2 border-success' : 'bg-base-100'}`}>
                <div className="card-body p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isConfirmed ? 'bg-success text-white' : 'bg-base-200'}`}>
                                {isConfirmed ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">
                                    {isConfirmed ? '已確認填寫完成' : '尚未確認填寫'}
                                </h3>
                                <p className="text-sm text-base-content/70">
                                    {isConfirmed
                                        ? '您的資料將用於管理員排班'
                                        : '確認後管理員才能使用您的資料進行排班'}
                                </p>
                            </div>
                        </div>
                        <button
                            className={`btn ${isConfirmed ? 'btn-warning' : 'btn-info'} ${confirmLoading ? 'loading' : ''}`}
                            onClick={handleConfirmToggle}
                            disabled={confirmLoading}
                        >
                            {confirmLoading ? '' : isConfirmed ? '取消確認' : '確認填寫完成'}
                        </button>
                    </div>
                </div>
            </div>

            {/* 清除全部按鈕 - 浮動在左下角 */}
            <div className="fixed bottom-0 left-6 z-40">
                <button
                    className="btn btn-circle btn-lg btn-error shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 group"
                    onClick={handleClearAll}
                    title="清空全部"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 group-hover:rotate-12 transition-transform">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </button>
            </div>

            {/* 確認填寫按鈕 - 浮動在右下角 */}
            <div className="fixed bottom-6 right-6 z-40">
                <button
                    className={`btn btn-circle btn-lg shadow-xl hover:scale-110 active:scale-95 transition-all duration-300 ${isConfirmed ? 'btn-success text-white' : 'btn-info'}`}
                    onClick={handleConfirmToggle}
                    disabled={confirmLoading}
                    title={isConfirmed ? '取消確認' : '確認填寫完成'}
                >
                    {confirmLoading ? (
                        <span className="loading loading-spinner"></span>
                    ) : isConfirmed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                        </svg>
                    )}
                </button>
                {/* 狀態氣泡提示 */}
                {!isConfirmed && saveStatus === 'dirty' && (
                    <div className="absolute -top-12 right-0 bg-info text-info-content text-xs font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap animate-bounce">
                        完成填寫按我
                    </div>
                )}
            </div>

            {/* 清除全部確認視窗 */}
            {showClearConfirm && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-sm">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold">確定全部清除?</h3>
                                <p className="text-base-content/70">
                                    這將會清除您目前在「{currentMonth}」所選取的所有不便上班時段。此動作無法復原。
                                </p>
                            </div>
                            <div className="flex gap-3 w-full pt-2">
                                <button
                                    className="btn btn-ghost flex-1 rounded-btn"
                                    onClick={() => setShowClearConfirm(false)}
                                >
                                    取消
                                </button>
                                <button
                                    className="btn btn-error flex-1 rounded-btn"
                                    onClick={confirmClearAll}
                                >
                                    確定清除
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop bg-black/40" onClick={() => setShowClearConfirm(false)}>
                        <button className="cursor-default">close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
