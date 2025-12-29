import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    getAdmins,
    addAdmin,
    removeAdmin,
    initializeShiftRules,
    getShiftRules,
} from '../services/firestore';

export default function AdminPage() {
    const { user } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [hasShiftRules, setHasShiftRules] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [adminList, rules] = await Promise.all([
                getAdmins(),
                getShiftRules(),
            ]);
            setAdmins(adminList);
            setHasShiftRules(rules.length > 0);
        } catch (error) {
            console.error('Error loading admins:', error);
        }
        setLoading(false);
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        if (!newEmail.trim()) {
            setError('請輸入 Email');
            return;
        }

        setAdding(true);
        setError('');
        setSuccess('');

        try {
            await addAdmin(
                newEmail.trim(),
                newName.trim() || newEmail.split('@')[0],
                user.email
            );
            setNewEmail('');
            setNewName('');
            setSuccess('已新增管理員');
            await loadData();
        } catch (error) {
            console.error('Error adding admin:', error);
            setError('新增失敗：' + error.message);
        }
        setAdding(false);
    };

    const handleRemoveAdmin = async (email) => {
        if (!confirm(`確定要移除管理員 ${email}？`)) return;

        if (admins.length <= 1) {
            setError('至少需要保留一位管理員');
            return;
        }

        try {
            await removeAdmin(email);
            setSuccess('已移除管理員');
            await loadData();
        } catch (error) {
            console.error('Error removing admin:', error);
            setError('移除失敗：' + error.message);
        }
    };

    const handleInitializeRules = async () => {
        if (!confirm('確定要初始化預設班段規則嗎？這會覆蓋現有規則。')) return;

        try {
            await initializeShiftRules();
            setSuccess('已初始化班段規則');
            setHasShiftRules(true);
        } catch (error) {
            console.error('Error initializing rules:', error);
            setError('初始化失敗：' + error.message);
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

            {/* 狀態訊息 */}
            {error && (
                <div className="alert alert-error">
                    <span>{error}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setError('')}>
                        ✕
                    </button>
                </div>
            )}
            {success && (
                <div className="alert alert-success">
                    <span>{success}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSuccess('')}>
                        ✕
                    </button>
                </div>
            )}

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
                    <h3 className="card-title">管理員列表</h3>

                    <div className="space-y-2">
                        {admins.map((admin) => (
                            <div
                                key={admin.email}
                                className="flex items-center justify-between bg-base-200 rounded-lg p-3"
                            >
                                <div>
                                    <div className="font-medium">{admin.name}</div>
                                    <div className="text-sm text-base-content/70">{admin.email}</div>
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm text-error"
                                    onClick={() => handleRemoveAdmin(admin.email)}
                                    disabled={admins.length <= 1}
                                >
                                    移除
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 新增管理員 */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                    <h3 className="card-title">新增管理員</h3>

                    <form onSubmit={handleAddAdmin} className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                className="input input-bordered flex-1"
                                placeholder="Email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                            />
                            <input
                                type="text"
                                className="input input-bordered flex-1"
                                placeholder="姓名（可選）"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                            <button
                                type="submit"
                                className={`btn btn-primary ${adding ? 'loading' : ''}`}
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
