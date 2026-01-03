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
    saveSpecialRequest
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
            const rules = await getShiftRules();
            setShiftRules(rules);

            const model = getMonthModel(currentMonth, rules);
            setMonthModel(model);

            const unavail = await getMyUnavailability(user.email, currentMonth);
            setUnavailability(unavail);

            const request = await getMySpecialRequest(user.email, currentMonth);
            setSpecialRequest(request);

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

    const handleCheckboxChange = (date, ruleId, checked) => {
        if (checked) {
            setUnavailability([...unavailability, { date, ruleId }]);
        } else {
            setUnavailability(unavailability.filter(
                u => !(u.date === date && u.ruleId === ruleId)
            ));
        }
    };

    // 點擊時段自動勾選（點擊的時段及之後的時段都會被選取）
    // 但如果當日已有任何選取，就不啟用自動補齊（代表使用者想個別操作）
    const handleShiftClick = (day, shift, shiftIndex, isChecked) => {
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

    const isUnavailable = (date, ruleId) => {
        return unavailability.some(u => u.date === date && u.ruleId === ruleId);
    };

    const renderDayContent = (day, weekIndex, totalWeeks) => {
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
                        />
                    ) : (
                        <Calendar
                            monthModel={monthModel}
                            renderDayContent={renderDayContent}
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
                        onChange={(e) => setSpecialRequest(e.target.value)}
                    />
                </div>
            </div>

            {/* 操作按鈕與自動儲存狀態 */}
            <div className="flex items-center justify-between gap-1.5 bg-base-100 p-2.5 rounded-box shadow-lg sticky bottom-4 z-10 border border-base-200">
                <div className="flex items-center gap-1 min-w-0 flex-shrink">
                    {saveStatus === 'saving' && (
                        <div className="flex items-center gap-1 text-primary text-xs font-medium whitespace-nowrap">
                            <span className="loading loading-spinner loading-xs"></span>
                            <span className="hidden sm:inline">自動儲存中...</span>
                            <span className="sm:hidden">儲存中</span>
                        </div>
                    )}
                    {saveStatus === 'dirty' && (
                        <div className="text-warning text-xs font-medium flex items-center gap-0.5 whitespace-nowrap">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin-slow flex-shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            <span className="hidden sm:inline">3秒後自動儲存</span>
                            <span className="sm:hidden">待儲存</span>
                        </div>
                    )}
                    {saveStatus === 'saved' && (
                        <div className="text-success text-xs font-medium flex items-center gap-0.5 whitespace-nowrap">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            <span className="hidden sm:inline">已儲存</span>
                            <span className="sm:hidden">已儲存</span>
                        </div>
                    )}
                    {saveStatus === 'error' && (
                        <div className="text-error text-xs font-medium whitespace-nowrap">
                            <span className="hidden sm:inline">儲存失敗，請檢查網路</span>
                            <span className="sm:hidden">失敗</span>
                        </div>
                    )}
                </div>

                <div className="flex gap-1.5 flex-shrink-0">
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={handleClearAll}
                    >
                        清空全部
                    </button>
                    <button
                        className={`btn btn-primary btn-sm px-3 ${saving ? 'loading' : ''}`}
                        onClick={() => handleSave(false)}
                        disabled={saving}
                    >
                        {!saving && '立即儲存'}
                    </button>
                </div>
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

