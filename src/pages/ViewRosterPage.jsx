import { useState, useEffect, useMemo } from 'react';
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
    getActiveUsers,
    getMonthlyWorkload,
} from '../services/firestore';
import { exportUserScheduleToICS } from '../services/icsExport';

// 預定義的顏色列表（用於區分不同使用者）
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

/**
 * 查看排班結果頁面（一般使用者只讀模式）
 * - 可查看班表，但不能修改
 * - 只顯示工時統計，不顯示特殊需求
 * - 可下載自己的班表 ICS 檔案
 */
export default function ViewRosterPage() {
    const { user, userProfile } = useAuth();
    const { showToast } = useToast();
    const isMobile = useMobileView();
    const [currentMonth, setCurrentMonth] = useState(getDefaultMonth());
    const [monthModel, setMonthModel] = useState(null);
    const [shiftRules, setShiftRules] = useState([]);
    const [roster, setRoster] = useState([]);
    const [users, setUsers] = useState([]);
    const [workload, setWorkload] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    function getDefaultMonth() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
    }

    useEffect(() => {
        loadAllData();
    }, [currentMonth]);

    const loadAllData = async () => {
        setLoading(true);
        try {
            const [rules, rosterData, usersData] = await Promise.all([
                getShiftRules(),
                getRoster(currentMonth),
                getActiveUsers(),
            ]);

            setShiftRules(rules);
            setRoster(rosterData);
            setUsers(usersData);

            const model = getMonthModel(currentMonth, rules);
            setMonthModel(model);

            const workloadData = getMonthlyWorkload(currentMonth, rosterData, rules, usersData);
            setWorkload(workloadData);
        } catch (error) {
            console.error('Error loading roster data:', error);
            showToast('載入排班資料失敗', 'error');
        }
        setLoading(false);
    };

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

    // 計算當前使用者的班次數量
    const myShiftsCount = useMemo(() => {
        return roster.filter(r => r.assignedUserId === user?.email).length;
    }, [roster, user]);

    // 下載 ICS 檔案
    const handleDownloadICS = async () => {
        if (exporting) return;
        setExporting(true);

        try {
            const result = exportUserScheduleToICS({
                userEmail: user.email,
                userName: userProfile?.name || user.email.split('@')[0],
                roster,
                shiftRules,
                month: currentMonth,
            });

            if (result.success) {
                showToast(`成功匯出 ${result.count} 個班次到行事曆`, 'success');
            } else {
                showToast(result.message, 'info');
            }
        } catch (error) {
            console.error('匯出失敗:', error);
            showToast('匯出失敗，請稍後再試', 'error');
        } finally {
            setExporting(false);
        }
    };

    // 渲染班段內容 - 只讀模式
    const renderDayContent = (day) => {
        return day.shifts.map((shift) => {
            const key = `${day.date}_${shift.ruleId}`;
            const assignment = rosterMap[key];
            const assignedUser = assignment
                ? users.find((u) => u.email === assignment.assignedUserId)
                : null;
            const userColor = assignedUser ? userColorMap[assignedUser.email] : null;
            const isMyShift = assignment?.assignedUserId === user?.email;

            const buttonStyle = userColor ? {
                backgroundColor: userColor.bg,
                color: userColor.text,
                borderLeftColor: userColor.text,
                borderLeftWidth: '4px',
                borderStyle: 'solid'
            } : {};

            return (
                <div
                    key={shift.ruleId}
                    style={buttonStyle}
                    className={`
                        flex items-center justify-between p-2 rounded-btn w-full
                        ${!assignment ? 'bg-base-200' : ''}
                        ${isMyShift ? 'ring-2 ring-primary ring-offset-1' : ''}
                    `}
                >
                    <span className={`text-sm truncate flex-1 ${assignment ? 'font-medium' : 'text-base-content/50'}`}>
                        {assignment
                            ? (assignedUser?.name || assignment.assignedUserId.split('@')[0])
                            : shift.label
                        }
                    </span>
                    {isMyShift && (
                        <span className="badge badge-primary badge-xs">我</span>
                    )}
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
                    <div>
                        <h2 className="text-2xl font-bold">查看班表</h2>
                        <p className="text-base-content/70 text-sm mt-1">
                            查看本月排班結果，您本月共有 <strong className="text-primary">{myShiftsCount}</strong> 個班次
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button className="btn btn-sm btn-outline" onClick={loadAllData}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            重新載入
                        </button>
                        <button
                            className="btn btn-sm btn-primary"
                            onClick={handleDownloadICS}
                            disabled={exporting || myShiftsCount === 0}
                        >
                            {exporting ? (
                                <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                            )}
                            下載行事曆
                        </button>
                    </div>
                </div>

                {/* 月份選擇器 */}
                <MonthSelector currentMonth={currentMonth} onMonthChange={setCurrentMonth} />

                {/* 日曆 */}
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

            {/* 側邊欄 - 只顯示工時統計 */}
            <aside className="w-full lg:w-80 flex-shrink-0">
                <div className="card bg-base-100 shadow-lg sticky top-4">
                    <div className="card-body p-4">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                            </svg>
                            工時統計
                        </h3>

                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {workload.length === 0 ? (
                                <p className="text-base-content/50 text-center py-4">尚無排班資料</p>
                            ) : (
                                workload.map((w) => {
                                    const wColor = userColorMap[w.userId];
                                    const isMe = w.userId === user?.email;
                                    return (
                                        <div
                                            key={w.userId}
                                            className={`flex justify-between items-center bg-base-200 rounded-box p-3 border-l-4 ${isMe ? 'ring-2 ring-primary' : ''}`}
                                            style={{ borderLeftColor: wColor?.text || 'transparent' }}
                                        >
                                            <span className="font-medium text-sm flex items-center gap-2">
                                                {w.name}
                                                {isMe && <span className="badge badge-primary badge-xs">我</span>}
                                            </span>
                                            <div className="flex gap-3 text-xs">
                                                <span className="text-primary font-bold">{w.hours}h</span>
                                                <span className="text-base-content/70">{w.shiftsCount} 班</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}
