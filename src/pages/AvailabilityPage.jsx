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
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('載入資料失敗', 'error');
        }
        setLoading(false);
    };

    const handleCheckboxChange = (date, ruleId, checked) => {
        if (checked) {
            setUnavailability([...unavailability, { date, ruleId }]);
        } else {
            setUnavailability(unavailability.filter(
                u => !(u.date === date && u.ruleId === ruleId)
            ));
        }
    };

    // 點擊第一個時段時自動勾選全天
    const handleFirstShiftClick = (day, shift, isChecked) => {
        const shiftIndex = day.shifts.findIndex(s => s.ruleId === shift.ruleId);

        if (shiftIndex === 0) {
            // 第一個時段，自動勾選/取消勾選全天
            const newUnavail = unavailability.filter(u => u.date !== day.date);

            if (isChecked) {
                // 勾選全天的所有時段
                day.shifts.forEach(s => {
                    newUnavail.push({ date: day.date, ruleId: s.ruleId });
                });
            }

            setUnavailability(newUnavail);
        } else {
            handleCheckboxChange(day.date, shift.ruleId, isChecked);
        }
    };

    const handleClearAll = () => {
        setUnavailability([]);
        showToast('已清空所有選擇', 'info');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveMyUnavailability(user.email, currentMonth, unavailability);
            await saveSpecialRequest(user.email, currentMonth, specialRequest);
            showToast(`已儲存 ${unavailability.length} 筆沒空紀錄`, 'success');
        } catch (error) {
            console.error('Error saving:', error);
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
            flex items-center gap-2 p-2 rounded-btn cursor-pointer
            ${checked ? 'bg-error/20' : 'bg-base-200 hover:bg-base-300'}
            transition-colors
          `}
                >
                    <input
                        type="checkbox"
                        className="checkbox checkbox-error checkbox-sm"
                        checked={checked}
                        onChange={(e) => {
                            if (index === 0) {
                                handleFirstShiftClick(day, shift, e.target.checked);
                            } else {
                                handleCheckboxChange(day.date, shift.ruleId, e.target.checked);
                            }
                        }}
                    />
                    <span className="text-sm flex-1">{shift.label}</span>
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
            <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">填寫沒空時間</h2>
                <p className="text-base-content/70">
                    請勾選您<strong className="text-error">無法上班</strong>的時段
                </p>
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

            {/* 操作按鈕 */}
            <div className="flex flex-wrap justify-end gap-3">
                <button
                    className="btn btn-outline"
                    onClick={handleClearAll}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    清空全部
                </button>
                <button
                    className={`btn btn-primary ${saving ? 'loading' : ''}`}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {!saving && (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                    )}
                    {saving ? '儲存中...' : '儲存'}
                </button>
            </div>
        </div>
    );
}

