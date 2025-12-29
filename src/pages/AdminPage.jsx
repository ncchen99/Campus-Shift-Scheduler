import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
    getAdmins,
    addAdmin,
    removeAdmin,
    initializeShiftRules,
    getShiftRules,
    getActiveUsers,
    deleteUser,
} from '../services/firestore';

export default function AdminPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [admins, setAdmins] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [hasShiftRules, setHasShiftRules] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [adminList, userList, rules] = await Promise.all([
                getAdmins(),
                getActiveUsers(),
                getShiftRules(),
            ]);
            setAdmins(adminList);
            setUsers(userList);
            setHasShiftRules(rules.length > 0);
        } catch (error) {
            console.error('Error loading admins:', error);
            showToast('載入管理員資料失敗', 'error');
        }
        setLoading(false);
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        if (!newEmail.trim()) {
            showToast('請輸入 Email', 'warning');
            return;
        }

        setAdding(true);

        try {
            await addAdmin(
                newEmail.trim(),
                newName.trim() || newEmail.split('@')[0],
                user.email
            );
            setNewEmail('');
            setNewName('');
            showToast('已新增管理員', 'success');
            await loadData();
        } catch (error) {
            console.error('Error adding admin:', error);
            showToast('新增失敗：' + error.message, 'error');
        }
        setAdding(false);
    };

    const handleRemoveAdmin = async (email) => {
        if (!confirm(`確定要移除管理員 ${email}？`)) return;

        if (admins.length <= 1) {
            showToast('至少需要保留一位管理員', 'warning');
            return;
        }

        try {
            await removeAdmin(email);
            showToast('已移除管理員', 'success');
            await loadData();
        } catch (error) {
            console.error('Error removing admin:', error);
            showToast('移除失敗：' + error.message, 'error');
        }
    };

    const handleDeleteUser = async (email, name) => {
        if (email === user.email) {
            showToast('不能刪除自己', 'error');
            return;
        }

        if (!confirm(`確定要移除用戶 ${name || email} 嗎？\n這將使其無法登入且不顯示在排班名單中。`)) return;

        try {
            await deleteUser(email);
            showToast('已移除用戶', 'success');
            await loadData();
        } catch (error) {
            console.error('Error deleting user:', error);
            showToast('移除失敗：' + error.message, 'error');
        }
    };

    const handleInitializeRules = async () => {
        if (!confirm('確定要初始化預設班段規則嗎？這會覆蓋現有規則。')) return;

        try {
            await initializeShiftRules();
            showToast('已初始化班段規則', 'success');
            setHasShiftRules(true);
        } catch (error) {
            console.error('Error initializing rules:', error);
            showToast('初始化失敗：' + error.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold">系統管理</h2>

            {/* 班段規則設定 */}
            {!hasShiftRules && (
                <div className="card bg-warning/10 border border-warning">
                    <div className="card-body">
                        <h3 className="card-title text-warning">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            尚未設定班段規則
                        </h3>
                        <p className="text-sm">系統尚未設定班段規則，請先初始化預設規則或手動設定。</p>
                        <div className="card-actions justify-end">
                            <button className="btn btn-primary" onClick={handleInitializeRules}>
                                初始化預設規則
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 管理員列表 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title text-primary">管理員列表</h3>

                    <div className="space-y-2">
                        {admins.map((admin) => (
                            <div
                                key={admin.email}
                                className="flex flex-col sm:flex-row sm:items-center justify-between bg-base-200 rounded-box p-3 gap-2"
                            >
                                <div className="min-w-0">
                                    <div className="font-medium truncate">{admin.name}</div>
                                    <div className="text-sm text-base-content/70 break-all">{admin.email}</div>
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm text-error self-end sm:self-auto"
                                    onClick={() => handleRemoveAdmin(admin.email)}
                                    disabled={admins.length <= 1}
                                >
                                    取消管理權限
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 用戶列表 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title text-secondary">所有用戶列表</h3>
                    <p className="text-xs text-base-content/60 mb-2">列出所有在系統中註冊且啟用的用戶</p>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {users.length === 0 ? (
                            <div className="text-center py-4 text-base-content/50 italic">暫無用戶資料</div>
                        ) : (
                            users.map((u) => (
                                <div
                                    key={u.id}
                                    className="flex items-center justify-between bg-base-200 rounded-box p-3"
                                >
                                    <div>
                                        <div className="font-medium flex items-center gap-2">
                                            {u.name}
                                            {u.role === 'admin' && (
                                                <span className="badge badge-primary badge-xs">Admin</span>
                                            )}
                                        </div>
                                        <div className="text-sm text-base-content/70">{u.id}</div>
                                    </div>
                                    <button
                                        className="btn btn-outline btn-error btn-sm"
                                        onClick={() => handleDeleteUser(u.id, u.name)}
                                        disabled={u.id === user.email}
                                    >
                                        移除
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* 新增管理員 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title">新增管理員</h3>

                    <form onSubmit={handleAddAdmin} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                            <input
                                type="email"
                                className="input input-bordered flex-1 h-12 min-h-[3rem] w-full"
                                placeholder="Email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                            />
                            <input
                                type="text"
                                className="input input-bordered flex-1 h-12 min-h-[3rem] w-full"
                                placeholder="姓名（可選）"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <button
                                type="submit"
                                className={`btn btn-primary h-12 min-h-[3rem] ${adding ? 'loading' : ''}`}
                                disabled={adding}
                            >
                                {adding ? '新增中...' : '新增'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* 系統資訊 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title">系統資訊</h3>
                    <div className="text-sm space-y-1 text-base-content/70">
                        <p>版本：React + Firebase Edition</p>
                        <p>當前用戶：{user?.email}</p>
                        <p>管理員數量：{admins.length}</p>
                        <p>班段規則：{hasShiftRules ? '已設定' : '未設定'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

