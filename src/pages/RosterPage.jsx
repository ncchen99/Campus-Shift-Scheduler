import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Calendar from '../components/Calendar';
import MonthSelector from '../components/MonthSelector';
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

export default function RosterPage() {
    const { user, userProfile } = useAuth();
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

    // 取得某時段的可派人員（排除沒空者）
    const getCandidates = (date, ruleId) => {
        const key = `${date}_${ruleId}`;
        const unavailUsers = unavailabilityMap[key] || [];
        return users.filter((u) => !unavailUsers.includes(u.email));
    };

    // 指派人員
    const handleAssign = async (date, ruleId, userId, dayShifts) => {
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
                // 重新載入排班資料
                const rosterData = await getRoster(currentMonth);
                setRoster(rosterData);

                // 更新工時
                const workloadData = getMonthlyWorkload(currentMonth, rosterData, shiftRules, users);
                setWorkload(workloadData);
            }
        } catch (error) {
            console.error('Error assigning:', error);
        }
    };

    // 清除指派
    const handleClearAssignment = async (date, ruleId) => {
        await handleAssign(date, ruleId, null, []);
    };

    // 渲染班段內容 - 使用下拉選單
    const renderDayContent = (day) => {
        return day.shifts.map((shift) => {
            const key = `${day.date}_${shift.ruleId}`;
            const assignment = rosterMap[key];
            const candidates = getCandidates(day.date, shift.ruleId);
            const assignedUser = assignment
                ? users.find((u) => u.email === assignment.assignedUserId)
                : null;

            return (
                <div key={shift.ruleId} className="dropdown dropdown-end w-full">
                    <div
                        tabIndex={0}
                        role="button"
                        className={`
              flex items-center justify-between p-1.5 rounded cursor-pointer w-full text-left
              ${assignment ? 'bg-primary/20 border-l-4 border-primary' : 'bg-base-200 hover:bg-base-300'}
              transition-colors
            `}
                    >
                        <span className="text-xs truncate flex-1">
                            {assignment ? (
                                <span className="font-medium">{assignedUser?.name || assignment.assignedUserId.split('@')[0]}</span>
                            ) : (
                                <span className="text-base-content/50">{shift.label}</span>
                            )}
                        </span>
                        <svg
                            className="w-3 h-3 opacity-50"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
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
                            candidates.map((c) => (
                                <li key={c.email}>
                                    <button
                                        className="text-sm"
                                        onClick={() => handleAssign(day.date, shift.ruleId, c.email, day.shifts)}
                                    >
                                        {c.name}
                                    </button>
                                </li>
                            ))
                        )}
                        {assignment && (
                            <>
                                <li className="divider my-0"></li>
                                <li>
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
                            </>
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
                    </div>
                </div>

                {/* 月份選擇器 */}
                <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

                {/* 日曆 */}
                <div className="card bg-base-100 shadow-lg">
                    <div className="card-body p-4">
                        <Calendar monthModel={monthModel} renderDayContent={renderDayContent} />
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
                                        <div key={r.userId} className="bg-base-200 rounded-lg p-3">
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
                                    workload.map((w) => (
                                        <div
                                            key={w.userId}
                                            className="flex justify-between items-center bg-base-200 rounded-lg p-3"
                                        >
                                            <span className="font-medium text-sm">{w.name}</span>
                                            <div className="flex gap-3 text-xs">
                                                <span className="text-primary font-bold">{w.hours}h</span>
                                                <span className="text-base-content/70">{w.shiftsCount} 班</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
