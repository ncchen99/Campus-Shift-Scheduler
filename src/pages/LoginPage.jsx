import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { signInWithGoogle, needsNameSetup, setupUserName, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [settingUpName, setSettingUpName] = useState(false);

    const handleGoogleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            setError('登入失敗，請稍後再試');
            console.error(err);
        }
        setLoading(false);
    };

    const handleNameSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setError('請輸入您的名稱');
            return;
        }
        setSettingUpName(true);
        setError('');
        try {
            await setupUserName(name.trim());
        } catch (err) {
            setError('設定名稱失敗，請稍後再試');
            console.error(err);
        }
        setSettingUpName(false);
    };

    // 如果需要設定名稱
    if (needsNameSetup && user) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
                <div className="card bg-base-100 shadow-xl w-full max-w-md">
                    <div className="card-body">
                        <h2 className="card-title justify-center text-2xl mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                            </svg>
                            歡迎加入！
                        </h2>
                        <p className="text-center text-base-content/70 mb-4">
                            這是您第一次登入，請設定您的顯示名稱
                        </p>

                        <form onSubmit={handleNameSubmit} className="space-y-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">您的名稱</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered w-full"
                                    placeholder="例如：王小明"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="alert alert-error">
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className={`btn btn-primary w-full ${settingUpName ? 'loading' : ''}`}
                                disabled={settingUpName}
                            >
                                {settingUpName ? '設定中...' : '開始使用'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // 登入頁面
    return (
        <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
            <div className="card bg-base-100 shadow-xl w-full max-w-md">
                <figure className="px-10 pt-10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-primary">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                </figure>
                <div className="card-body items-center text-center">
                    <h1 className="card-title text-2xl mb-2">活動中心排班系統</h1>
                    <p className="text-base-content/70 mb-6">
                        請使用 Google 帳號登入
                    </p>

                    {error && (
                        <div className="alert alert-error w-full mb-4">
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        className={`btn btn-primary btn-lg gap-2 ${loading ? 'loading' : ''}`}
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                    >
                        {!loading && (
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        )}
                        {loading ? '登入中...' : '使用 Google 登入'}
                    </button>
                </div>
            </div>
        </div>
    );
}
