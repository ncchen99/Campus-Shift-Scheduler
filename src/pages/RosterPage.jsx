import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Calendar from '../components/Calendar';
import MobileCalendar from '../components/MobileCalendar';
import MonthSelector from '../components/MonthSelector';
import { useMobileView } from '../hooks/useMobileView';
import {
    getShiftRules,
    getMonthModel,
    getRoster,
    getAllUnavailability,
    getAllSpecialRequests,
    getActiveUsers,
    setRosterCell,
    getMonthlyWorkload,
} from '../services/firestore';
import { exportRosterToExcel } from '../services/excelExport';

// 預定義的顏色列表（用於區分不同使用者）- 與 Excel 匯出保持一致
const USER_UI_COLORS = [
    { bg: '#E8F5E9', text: '#1B5E20', border: '#C8E6C9' }, // 淺綠
    { bg: '#FFF3E0', text: '#E65100', border: '#FFE0B2' }, // 淺橙
    { bg: '#E3F2FD', text: '#0D47A1', border: '#BBDEFB' }, // 淺藍
    { bg: '#FCE4EC', text: '#AD1457', border: '#F8BBD0' }, // 淺粉
    { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' }, // 淺紫
    { bg: '#FFF8E1', text: '#F57F17', border: '#FFECB3' }, // 淺黃
    { bg: '#E0F7FA', text: '#00695C', border: '#B2EBF2' }, // 淺青
    { bg: '#FFEBEE', text: '#B71C1C', border: '#FFCDD2' }, // 淺紅
    { bg: '#E8EAF6', text: '#283593', border: '#C5CAE9' }, // 淺靛
    { bg: '#F1F8E9', text: '#33691E', border: '#DCEDC8' }, // 淺萊姆
    { bg: '#ECEFF1', text: '#37474F', border: '#CFD8DC' }, // 淺灰藍
    { bg: '#FBE9E7', text: '#BF360C', border: '#FFCCBC' }, // 淺深橙
];

export default function RosterPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const isMobile = useMobileView();
    const [currentMonth, setCurrentMonth] = useState(getDefaultMonth());
    const [monthModel, setMonthModel] = useState(null);
    const [shiftRules, setShiftRules] = useState([]);
    const [roster, setRoster] = useState([]);
    const [unavailability, setUnavailability] = useState([]);
    const [users, setUsers] = useState([]);
    const [specialRequests, setSpecialRequests] = useState([]);
    const [workload, setWorkload] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoFillEnabled, setAutoFillEnabled] = useState(true);
    const [activeSidebar, setActiveSidebar] = useState('requests');
    const [exporting, setExporting] = useState(false);
    const [pendingOperations, setPendingOperations] = useState(new Set());

    function getDefaultMonth() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    // 進入頁面時預先載入所有資料
    useEffect(() => {
        loadAllData();
    }, [currentMonth]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            // 並行載入所有資料
            const [rules, rosterData, unavailData, usersData] = await Promise.all([
                getShiftRules(),
                getRoster(currentMonth),
                getAllUnavailability(currentMonth),
                getActiveUsers(),
            ]);

            setShiftRules(rules);
            setRoster(rosterData);
            setUnavailability(unavailData);
            setUsers(usersData);

            const model = getMonthModel(currentMonth, rules);
            setMonthModel(model);

            // 載入特殊需求和工時統計
            const [requests, workloadData] = await Promise.all([
                getAllSpecialRequests(currentMonth, usersData),
                Promise.resolve(getMonthlyWorkload(currentMonth, rosterData, rules, usersData)),
            ]);

            setSpecialRequests(requests);
            setWorkload(workloadData);
        } catch (error) {
            console.error('Error loading roster data:', error);
            showToast('載入排班資料失敗', 'error');
        }
        setLoading(false);
    };

    // 建立沒空資料的快速查詢 Map
    const unavailabilityMap = useMemo(() => {
        const map = {};
        unavailability.forEach((u) => {
            const key = `${u.date}_${u.ruleId}`;
            if (!map[key]) map[key] = [];
            map[key].push(u.userId);
        });
        return map;
    }, [unavailability]);

    // 建立排班資料的快速查詢 Map
    const rosterMap = useMemo(() => {
        const map = {};
        roster.forEach((r) => {
            map[`${r.date}_${r.ruleId}`] = r;
        });
        return map;
    }, [roster]);

    // 建立使用者顏色對應 Map
    const userColorMap = useMemo(() => {
        const map = {};
        users.sort((a, b) => a.email.localeCompare(b.email)).forEach((u, index) => {
            map[u.email] = USER_UI_COLORS[index % USER_UI_COLORS.length];
        });
        return map;
    }, [users]);

    // 取得某時段的可派人員（排除沒空者）
    const getCandidates = (date, ruleId) => {
        const key = `${date}_${ruleId}`;
        const unavailUsers = unavailabilityMap[key] || [];
        return users.filter((u) => !unavailUsers.includes(u.email));
    };

    // 樂觀更新本地 roster 狀態
    const updateLocalRoster = useCallback((date, ruleId, userId) => {
        setRoster(prev => {
            const key = `${date}_${ruleId}`;
            const filtered = prev.filter(r => !(r.date === date && r.ruleId === ruleId));

            if (userId) {
                return [...filtered, {
                    date,
                    ruleId,
                    assignedUserId: userId,
                    assignedBy: user.email,
                    ts: new Date(),
                }];
            }
            return filtered;
        });
    }, [user]);

    // 指派人員（樂觀更新 + 背景處理）
    const handleAssign = useCallback(async (date, ruleId, userId, dayShifts) => {
        const operationKey = `${date}_${ruleId}`;

        // 防止重複操作
        if (pendingOperations.has(operationKey)) return;

        // 保存原始狀態以便恢復
        const previousRoster = [...roster];

        // 標記操作進行中
        setPendingOperations(prev => new Set([...prev, operationKey]));

        // 1. 樂觀更新 UI（立即回應）
        updateLocalRoster(date, ruleId, userId);

        // 如果啟用同日補齊，也要樂觀更新這些格子
        if (autoFillEnabled && dayShifts && userId) {
            dayShifts.forEach(shift => {
                if (shift.ruleId !== ruleId) {
                    const otherKey = `${date}_${shift.ruleId}`;
                    const hasAssignment = previousRoster.some(r => r.date === date && r.ruleId === shift.ruleId);
                    const isUserUnavail = (unavailabilityMap[otherKey] || []).includes(userId);

                    if (!hasAssignment && !isUserUnavail) {
                        updateLocalRoster(date, shift.ruleId, userId);
                    }
                }
            });
        }

        // 2. 背景處理 Firebase
        try {
            const result = await setRosterCell(
                currentMonth,
                date,
                ruleId,
                userId,
                user.email,
                { autoFillSameDay: autoFillEnabled, dayShifts }
            );

            if (result.success) {
                // 成功後重新載入以確保資料同步（靜默更新）
                const rosterData = await getRoster(currentMonth);
                setRoster(rosterData);

                // 更新工時
                const workloadData = getMonthlyWorkload(currentMonth, rosterData, shiftRules, users);
                setWorkload(workloadData);
            }
        } catch (error) {
            console.error('Error assigning:', error);
            // 3. 失敗時恢復原始狀態
            setRoster(previousRoster);
            showToast('指派失敗：' + error.message, 'error');
        } finally {
            // 移除操作標記
            setPendingOperations(prev => {
                const next = new Set(prev);
                next.delete(operationKey);
                return next;
            });
        }
    }, [roster, currentMonth, user, autoFillEnabled, shiftRules, users, unavailabilityMap, updateLocalRoster, showToast, pendingOperations]);

    // 清除指派
    const handleClearAssignment = async (date, ruleId) => {
        await handleAssign(date, ruleId, null, []);
    };

    // 匯出 Excel
    const handleExport = async () => {
        if (!monthModel || exporting) return;

        setExporting(true);
        try {
            const fileName = await exportRosterToExcel(
                monthModel,
                roster,
                users,
                shiftRules,
                currentMonth
            );
            showToast(`成功匯出: ${fileName}`, 'success');
        } catch (error) {
            console.error('匯出失敗:', error);
            showToast('匯出失敗，請稍後再試', 'error');
        } finally {
            setExporting(false);
        }
    };

    // 渲染班段內容 - 使用下拉選單
    const renderDayContent = (day, weekIndex, totalWeeks) => {
        // 判斷是否在最後兩週，需要向上展開選單
        const isNearBottom = weekIndex >= totalWeeks - 2;

        return day.shifts.map((shift, shiftIndex) => {
            const key = `${day.date}_${shift.ruleId}`;
            const assignment = rosterMap[key];
            const candidates = getCandidates(day.date, shift.ruleId);
            const assignedUser = assignment
                ? users.find((u) => u.email === assignment.assignedUserId)
                : null;
            const isPending = pendingOperations.has(key);
            const userColor = assignedUser ? userColorMap[assignedUser.email] : null;

            // 最後的時段也需要向上展開
            const isLastShift = shiftIndex === day.shifts.length - 1;
            const shouldDropUp = isNearBottom || (weekIndex === totalWeeks - 3 && isLastShift);

            const buttonStyle = userColor ? {
                backgroundColor: userColor.bg,
                color: userColor.text,
                borderLeftColor: userColor.text,
                borderLeftWidth: '4px',
                borderStyle: 'solid'
            } : {};

            return (
                <div key={shift.ruleId} className={`dropdown dropdown-end w-full ${shouldDropUp ? 'dropdown-top' : ''}`}>
                    <div
                        tabIndex={0}
                        role="button"
                        style={buttonStyle}
                        className={`
                  flex items-center justify-between p-2 rounded-btn cursor-pointer w-full text-left
                  ${!assignment ? 'bg-base-200 hover:bg-base-300' : ''}
                  ${isPending ? 'opacity-60' : ''}
                  transition-colors
                `}
                    >
                        <span className={`text-sm truncate flex-1 ${assignment ? 'font-medium' : 'text-base-content/50'}`}>
                            {assignment
                                ? (assignedUser?.name || assignment.assignedUserId.split('@')[0])
                                : shift.label
                            }
                        </span>
                        {isPending ? (
                            <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                            <svg
                                className={`w-3 h-3 opacity-50 transition-transform ${shouldDropUp ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        )}
                    </div>

                    {/* 下拉選單 */}
                    <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-base-100 rounded-box w-52 shadow-lg z-50 max-h-60 overflow-y-auto"
                    >
                        {candidates.length === 0 ? (
                            <li className="text-base-content/50 p-3 text-center text-sm">
                                沒有可用人員
                            </li>
                        ) : (
                            candidates.map((c) => {
                                const cColor = userColorMap[c.email];
                                return (
                                    <li key={c.email}>
                                        <button
                                            className="text-sm flex items-center gap-2"
                                            onClick={() => handleAssign(day.date, shift.ruleId, c.email, day.shifts)}
                                        >
                                            <span
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: cColor?.text || 'currentColor' }}
                                            ></span>
                                            {c.name}
                                        </button>
                                    </li>
                                );
                            })
                        )}
                        {assignment && (
                            <li className="border-t border-base-300 mt-1 pt-1">
                                <button
                                    className="text-error text-sm"
                                    onClick={() => handleClearAssignment(day.date, shift.ruleId)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    清除指派
                                </button>
                            </li>
                        )}
                    </ul>
                </div>
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
        <div className="flex flex-col lg:flex-row gap-6">
            {/* 主區域 */}
            <div className="flex-1">
                {/* 標題和操作 */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-bold">排班管理</h2>
                    <div className="flex flex-wrap items-center gap-4">
                        <label className="label cursor-pointer gap-2">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary checkbox-sm"
                                checked={autoFillEnabled}
                                onChange={(e) => setAutoFillEnabled(e.target.checked)}
                            />
                            <span className="label-text">同日自動補齊</span>
                        </label>
                        <button className="btn btn-sm btn-outline" onClick={loadAllData}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            重新載入
                        </button>
                        <button
                            className="btn btn-sm btn-success"
                            onClick={handleExport}
                            disabled={exporting || !monthModel}
                        >
                            {exporting ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                            )}
                            匯出 Excel
                        </button>
                    </div>
                </div>

                {/* 月份選擇器 */}
                <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

                {/* 日曆 - 響應式切換 */}
                <div className="card bg-base-100 shadow-lg mb-20">
                    <div className="card-body p-4">
                        {isMobile ? (
                            <MobileCalendar monthModel={monthModel} renderDayContent={renderDayContent} />
                        ) : (
                            <Calendar monthModel={monthModel} renderDayContent={renderDayContent} />
                        )}
                    </div>
                </div>
            </div>

            {/* 側邊欄 */}
            <aside className="w-full lg:w-80 flex-shrink-0">
                <div className="card bg-base-100 shadow-lg sticky top-4">
                    <div className="card-body p-4">
                        {/* 側邊欄 Tab */}
                        <div className="tabs tabs-boxed mb-4">
                            <button
                                className={`tab ${activeSidebar === 'requests' ? 'tab-active' : ''}`}
                                onClick={() => setActiveSidebar('requests')}
                            >
                                特殊需求
                            </button>
                            <button
                                className={`tab ${activeSidebar === 'workload' ? 'tab-active' : ''}`}
                                onClick={() => setActiveSidebar('workload')}
                            >
                                工時統計
                            </button>
                        </div>

                        {/* 特殊需求列表 */}
                        {activeSidebar === 'requests' && (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {specialRequests.length === 0 ? (
                                    <p className="text-base-content/50 text-center py-4">本月無特殊需求</p>
                                ) : (
                                    specialRequests.map((r) => (
                                        <div key={r.userId} className="bg-base-200 rounded-box p-3">
                                            <div className="font-medium text-sm">{r.name}</div>
                                            <div className="text-xs text-base-content/70 whitespace-pre-wrap">
                                                {r.text || '（無內容）'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 工時統計列表 */}
                        {activeSidebar === 'workload' && (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {workload.length === 0 ? (
                                    <p className="text-base-content/50 text-center py-4">尚無排班資料</p>
                                ) : (
                                    workload.map((w) => {
                                        const wColor = userColorMap[w.userId];
                                        return (
                                            <div
                                                key={w.userId}
                                                className="flex justify-between items-center bg-base-200 rounded-box p-3 border-l-4"
                                                style={{ borderLeftColor: wColor?.text || 'transparent' }}
                                            >
                                                <span className="font-medium text-sm">{w.name}</span>
                                                <div className="flex gap-3 text-xs">
                                                    <span className="text-primary font-bold">{w.hours}h</span>
                                                    <span className="text-base-content/70">{w.shiftsCount} 班</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}

