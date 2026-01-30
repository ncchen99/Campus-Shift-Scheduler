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
    getConfirmedUsers,
    getUnconfirmedUsers,
    getClosedDays,
    setClosedDay,
    unsetClosedDay,
} from '../services/firestore';
import { exportRosterToExcel } from '../services/excelExport';
import { exportUserScheduleToICS } from '../services/icsExport';

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

// 閉館選項的特殊標識
const CLOSED_OPTION = '__CLOSED__';

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
    const [confirmedUsers, setConfirmedUsers] = useState([]);
    const [unconfirmedUsers, setUnconfirmedUsers] = useState([]);
    const [specialRequests, setSpecialRequests] = useState([]);
    const [workload, setWorkload] = useState([]);
    const [loading, setLoading] = useState(true);
    const [autoFillEnabled, setAutoFillEnabled] = useState(true);
    const [activeSidebar, setActiveSidebar] = useState('unconfirmed');
    const [exporting, setExporting] = useState(false);
    const [exportingICS, setExportingICS] = useState(false);
    const [pendingOperations, setPendingOperations] = useState(new Set());

    // 閉館日
    const [closedDays, setClosedDays] = useState([]);

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
            const [rules, rosterData, unavailData, usersData, confirmed, unconfirmed, closed] = await Promise.all([
                getShiftRules(),
                getRoster(currentMonth),
                getAllUnavailability(currentMonth),
                getActiveUsers(),
                getConfirmedUsers(currentMonth),
                getUnconfirmedUsers(currentMonth),
                getClosedDays(currentMonth),
            ]);

            setShiftRules(rules);
            setRoster(rosterData);
            setUnavailability(unavailData);
            setUsers(usersData);
            setConfirmedUsers(confirmed);
            setUnconfirmedUsers(unconfirmed);
            setClosedDays(closed);

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

    // 建立使用者顏色對應 Map（只用已確認的使用者）
    const userColorMap = useMemo(() => {
        const map = {};
        users.sort((a, b) => a.email.localeCompare(b.email)).forEach((u, index) => {
            map[u.email] = USER_UI_COLORS[index % USER_UI_COLORS.length];
        });
        return map;
    }, [users]);

    // 建立閉館日快速查詢 Set
    const closedDaysSet = useMemo(() => {
        return new Set(closedDays.map(d => d.date));
    }, [closedDays]);

    // 檢查日期是否為閉館日
    const isClosedDay = (date) => closedDaysSet.has(date);

    // 取得某時段的可派人員（排除沒空者，只顯示已確認的使用者）
    const getCandidates = (date, ruleId) => {
        const key = `${date}_${ruleId}`;
        const unavailUsers = unavailabilityMap[key] || [];
        // 只返回已確認填寫的使用者
        return confirmedUsers.filter((u) => !unavailUsers.includes(u.email));
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

    // 處理閉館日設定
    const handleClosedDayToggle = async (date) => {
        const operationKey = `closed_${date}`;
        if (pendingOperations.has(operationKey)) return;

        setPendingOperations(prev => new Set([...prev, operationKey]));

        try {
            if (isClosedDay(date)) {
                // 取消閉館
                await unsetClosedDay(currentMonth, date);
                setClosedDays(prev => prev.filter(d => d.date !== date));
                showToast(`已取消 ${date} 的休館設定`, 'info');
            } else {
                // 設定閉館：先清除該天的所有排班，再設定閉館日
                const dayShifts = monthModel?.days.find(d => d.date === date)?.shifts || [];

                // 1. 先清除 Firebase 中該天的所有排班資料
                for (const shift of dayShifts) {
                    const hasAssignment = roster.some(r => r.date === date && r.ruleId === shift.ruleId);
                    if (hasAssignment) {
                        await setRosterCell(currentMonth, date, shift.ruleId, null, user.email, {});
                    }
                }

                // 2. 更新本地 roster 狀態（清除該天的排班）
                const updatedRoster = roster.filter(r => r.date !== date);
                setRoster(updatedRoster);

                // 3. 最後才設定閉館日
                await setClosedDay(currentMonth, date, user.email);
                setClosedDays(prev => [...prev, { date, closedBy: user.email }]);

                // 4. 更新工時統計
                const workloadData = getMonthlyWorkload(currentMonth, updatedRoster, shiftRules, users);
                setWorkload(workloadData);

                showToast(`已設定 ${date} 為休館日並清除所有排班`, 'success');
            }
        } catch (error) {
            console.error('Error toggling closed day:', error);
            showToast('設定閉館日失敗', 'error');
        } finally {
            setPendingOperations(prev => {
                const next = new Set(prev);
                next.delete(operationKey);
                return next;
            });
        }
    };

    // 指派人員（樂觀更新 + 背景處理）
    // shiftIndex: 當前被點擊的時段索引，用於同日自動補齊（會覆蓋該時段之後的所有時段）
    const handleAssign = useCallback(async (date, ruleId, userId, dayShifts, shiftIndex = 0) => {
        // 如果選擇閉館選項
        if (userId === CLOSED_OPTION) {
            await handleClosedDayToggle(date);
            return;
        }

        const operationKey = `${date}_${ruleId}`;

        // 防止重複操作
        if (pendingOperations.has(operationKey)) return;

        // 保存原始狀態以便恢復
        const previousRoster = [...roster];

        // 標記操作進行中
        setPendingOperations(prev => new Set([...prev, operationKey]));

        // 1. 樂觀更新 UI（立即回應）
        updateLocalRoster(date, ruleId, userId);

        // 如果啟用同日補齊，補齊該時段之後尚未指派的時段（不覆蓋已有人的）
        if (autoFillEnabled && dayShifts && userId) {
            dayShifts.forEach((shift, idx) => {
                // 只處理點擊時段之後的時段
                if (idx > shiftIndex && shift.ruleId !== ruleId) {
                    const otherKey = `${date}_${shift.ruleId}`;
                    const hasExistingAssignment = previousRoster.some(r => r.date === date && r.ruleId === shift.ruleId);
                    const isUserUnavail = (unavailabilityMap[otherKey] || []).includes(userId);

                    // 只有在該時段尚未有人、且使用者有空時，才補齊
                    if (!hasExistingAssignment && !isUserUnavail) {
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
                { autoFillSameDay: autoFillEnabled, dayShifts, shiftIndex, overwriteExisting: false }
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
    }, [roster, currentMonth, user, autoFillEnabled, shiftRules, users, unavailabilityMap, updateLocalRoster, showToast, pendingOperations, monthModel]);

    // 清除單一時段指派
    const handleClearAssignment = async (date, ruleId) => {
        await handleAssign(date, ruleId, null, [], 0);
    };

    // 清除當日所有排班
    const handleClearDayAssignments = async (date, dayShifts) => {
        const previousRoster = [...roster];

        try {
            // 樂觀更新 - 清除當日所有時段
            dayShifts.forEach(shift => {
                updateLocalRoster(date, shift.ruleId, null);
            });

            // 背景處理 Firebase - 逐一刪除
            for (const shift of dayShifts) {
                const cellId = `${date}_${shift.ruleId}`;
                const hasAssignment = roster.some(r => r.date === date && r.ruleId === shift.ruleId);
                if (hasAssignment) {
                    await setRosterCell(currentMonth, date, shift.ruleId, null, user.email, {});
                }
            }

            // 重新載入資料
            const rosterData = await getRoster(currentMonth);
            setRoster(rosterData);

            const workloadData = getMonthlyWorkload(currentMonth, rosterData, shiftRules, users);
            setWorkload(workloadData);

            showToast('已清除當日所有排班', 'success');
        } catch (error) {
            console.error('Error clearing day:', error);
            setRoster(previousRoster);
            showToast('清除失敗：' + error.message, 'error');
        }
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

    // 下載我的班表 ICS 檔案
    const handleDownloadMyICS = async () => {
        if (exportingICS) return;
        setExportingICS(true);

        try {
            const result = exportUserScheduleToICS({
                userEmail: user.email,
                userName: userProfile?.name || user.email.split('@')[0],
                roster,
                shiftRules,
                month: currentMonth,
            });

            if (result.success) {
                showToast(`已匯出 ${result.count} 個班次，請將檔案匯入常用的行事曆軟體`, 'success');
            } else {
                showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('匯出 ICS 失敗:', error);
            showToast('匯出失敗，請稍後再試', 'error');
        } finally {
            setExportingICS(false);
        }
    };

    // 計算當前使用者的班次數量
    const myShiftsCount = useMemo(() => {
        return roster.filter(r => r.assignedUserId === user?.email).length;
    }, [roster, user]);

    // 計算當日是否有任何排班
    const hasDayAssignments = (date, dayShifts) => {
        return dayShifts.some(shift => {
            return roster.some(r => r.date === date && r.ruleId === shift.ruleId);
        });
    };

    // 渲染日期標題區域（清除當日按鈕 + 閉館按鈕）
    const renderDayHeader = (day) => {
        const hasAssignments = hasDayAssignments(day.date, day.shifts);
        const isClosed = isClosedDay(day.date);
        const isToggling = pendingOperations.has(`closed_${day.date}`);

        return (
            <div className="flex items-center gap-0.5">
                {/* 清除當日排班按鈕 - 移到左邊 */}
                {hasAssignments && !isClosed && (
                    <button
                        className="btn btn-ghost btn-xs text-error hover:bg-error/20 p-0 min-h-0 h-5 w-5 flex items-center justify-center"
                        onClick={() => handleClearDayAssignments(day.date, day.shifts)}
                        title="清除當日所有排班"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* 閉館切換按鈕 */}
                <button
                    className={`btn btn-ghost btn-xs p-0 min-h-0 h-5 w-5 flex items-center justify-center ${isClosed ? 'text-success' : 'text-base-content/50 hover:text-error'}`}
                    onClick={() => handleClosedDayToggle(day.date)}
                    title={isClosed ? '取消休館' : '設為休館日'}
                    disabled={isToggling}
                >
                    {isToggling ? (
                        <span className="loading loading-spinner loading-xs"></span>
                    ) : isClosed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                    )}
                </button>
            </div>
        );
    };

    // 渲染班段內容 - 使用下拉選單
    // dayIndex: 0=週日, 1=週一, ... 6=週六（用於判斷是否在畫面左側）
    const renderDayContent = (day, weekIndex, totalWeeks, dayIndex = 0) => {
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

        // 判斷是否在最後兩週，需要向上展開選單
        const isNearBottom = weekIndex >= totalWeeks - 2;
        // 判斷是否在畫面左側（週日或週一），需要向右展開選單而非向左
        const isOnLeftSide = dayIndex <= 1;

        return day.shifts.map((shift, shiftIndex) => {
            const key = `${day.date}_${shift.ruleId}`;
            const assignment = rosterMap[key];
            const candidates = getCandidates(day.date, shift.ruleId);
            const assignedUser = assignment
                ? users.find((u) => u.email === assignment.assignedUserId)
                : null;
            const isPending = pendingOperations.has(key);
            const userColor = assignedUser ? userColorMap[assignedUser.email] : null;
            const isMyShift = assignedUser?.email === user?.email;

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

            // 動態調整下拉選單方向：左側向右展開，右側向左展開
            const dropdownClass = `dropdown w-full ${shouldDropUp ? 'dropdown-top' : ''} ${isOnLeftSide ? 'dropdown-start' : 'dropdown-end'}`;

            return (
                <div key={shift.ruleId} className={dropdownClass}>
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
                        className="dropdown-content menu bg-base-100 rounded-box w-52 shadow-lg z-50 max-h-96 overflow-y-auto flex-nowrap"
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
                                            onClick={() => handleAssign(day.date, shift.ruleId, c.email, day.shifts, shiftIndex)}
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
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={handleDownloadMyICS}
                            disabled={exportingICS || myShiftsCount === 0}
                            title={myShiftsCount === 0 ? '您本月沒有排班' : '匯出我的排班行事曆'}
                        >
                            {exportingICS ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                            )}
                            匯出行事曆
                        </button>
                    </div>
                </div>

                {/* 月份選擇器 */}
                <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

                {/* 日曆 - 響應式切換 */}
                <div className="card bg-base-100 shadow-lg mb-20">
                    <div className="card-body p-4">
                        {isMobile ? (
                            <MobileCalendar
                                monthModel={monthModel}
                                renderDayContent={renderDayContent}
                                renderDayHeader={renderDayHeader}
                                disabledDates={closedDays}
                            />
                        ) : (
                            <Calendar monthModel={monthModel} renderDayContent={renderDayContent} renderDayHeader={renderDayHeader} disabledDates={closedDays} />
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
                                className={`tab ${activeSidebar === 'unconfirmed' ? 'tab-active' : ''}`}
                                onClick={() => setActiveSidebar('unconfirmed')}
                            >
                                未確認
                                {unconfirmedUsers.length > 0 && (
                                    <span className="badge badge-primary badge-xs ml-1">{unconfirmedUsers.length}</span>
                                )}
                            </button>
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
                                {specialRequests.filter(r => r.text && r.text.trim()).length === 0 ? (
                                    <p className="text-base-content/50 text-center py-4">本月無特殊需求</p>
                                ) : (
                                    specialRequests
                                        .filter(r => r.text && r.text.trim())
                                        .map((r) => (
                                            <div key={r.userId} className="bg-base-200 rounded-box p-3">
                                                <div className="font-medium text-sm">{r.name}</div>
                                                <div className="text-xs text-base-content/70 whitespace-pre-wrap">
                                                    {r.text}
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

                        {/* 未確認使用者列表 */}
                        {activeSidebar === 'unconfirmed' && (
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {unconfirmedUsers.length === 0 ? (
                                    <div className="text-center py-4">
                                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-success/10 flex items-center justify-center text-success">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-success font-medium">所有使用者都已確認填寫</p>
                                        <p className="text-base-content/50 text-sm mt-1">可以開始排班了！</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="alert alert-info bg-primary/99 border-primary/20 text-primary-content text-sm py-2 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                            </svg>
                                            <span>以下使用者尚未確認填寫，不會出現在排班選單中</span>
                                        </div>
                                        {unconfirmedUsers.map((u) => {
                                            const uColor = userColorMap[u.email];
                                            return (
                                                <div
                                                    key={u.email}
                                                    className="flex items-center gap-3 bg-base-200 rounded-box p-3 border-l-4 opacity-60"
                                                    style={{ borderLeftColor: uColor?.text || 'transparent' }}
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-base-content/50">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">{u.name}</div>
                                                        <div className="text-xs text-base-content/50">尚未確認填寫</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
