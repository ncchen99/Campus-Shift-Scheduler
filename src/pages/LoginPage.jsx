import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
    const { signInWithGoogle, signOut, needsNameSetup, setupUserName, user, checkNameExists, deleteCurrentUserAndSignOut } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [settingUpName, setSettingUpName] = useState(false);

    // 暱稱重複檢查相關狀態
    const [checkingName, setCheckingName] = useState(false);
    const [nameExists, setNameExists] = useState(false);
    const [existingEmail, setExistingEmail] = useState('');
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    // 當使用者輸入名稱時，進行即時檢查（防抖）
    useEffect(() => {
        if (!name.trim()) {
            setNameExists(false);
            setExistingEmail('');
            return;
        }

        const timer = setTimeout(async () => {
            setCheckingName(true);
            try {
                const result = await checkNameExists(name.trim());
                setNameExists(result.exists);
                if (result.exists) {
                    setExistingEmail(result.email);
                } else {
                    setExistingEmail('');
                }
            } catch (err) {
                console.error('Error checking name:', err);
            }
            setCheckingName(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [name, checkNameExists]);

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

        // 再次檢查暱稱是否重複
        setSettingUpName(true);
        setError('');

        try {
            const result = await checkNameExists(name.trim());
            if (result.exists) {
                setNameExists(true);
                setExistingEmail(result.email);
                setShowDuplicateModal(true);
                setSettingUpName(false);
                return;
            }

            await setupUserName(name.trim());
        } catch (err) {
            setError('設定名稱失敗，請稍後再試');
            console.error(err);
        }
        setSettingUpName(false);
    };

    // 處理重複暱稱的確認（刪除帳號並登出）
    const handleDuplicateConfirm = async () => {
        setDeletingAccount(true);
        try {
            await deleteCurrentUserAndSignOut();
            setShowDuplicateModal(false);
            // 登出後會自動跳轉到登入頁面
        } catch (err) {
            console.error('Error deleting account:', err);
            setError('清除帳號失敗，請稍後再試');
        }
        setDeletingAccount(false);
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

                                <div className="relative group">
                                    <input
                                        type="text"
                                        className={`input input-bordered w-full transition-all duration-200 pr-12 ${nameExists ? 'input-error bg-error/5' : 'focus:input-primary'}`}
                                        placeholder="例如：王小明"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        autoFocus
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                                        {checkingName ? (
                                            <span className="loading loading-spinner loading-sm text-primary"></span>
                                        ) : name.trim() && !nameExists ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-success">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                            </svg>
                                        ) : nameExists ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-error">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        ) : null}
                                    </div>
                                </div>
                                {nameExists && (
                                    <label className="label px-1 py-2">
                                        <span className="label-text-alt text-error/80">
                                            此名稱由 {existingEmail} 使用中
                                        </span>
                                    </label>
                                )}
                            </div>

                            {error && (
                                <div className="alert alert-error">
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn btn-primary w-full"
                                disabled={settingUpName || nameExists || checkingName || !name.trim()}
                            >
                                {settingUpName ? (
                                    <>
                                        <span className="loading loading-spinner"></span>
                                        設定中...
                                    </>
                                ) : (
                                    '開始使用'
                                )}
                            </button>
                        </form>

                        <div className="divider text-xs text-base-content/30">或者</div>

                        <button
                            className="btn btn-ghost btn-sm w-full text-base-content/50"
                            onClick={() => signOut()}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            登出並更換帳號
                        </button>
                    </div>
                </div>

                {/* 暱稱重複確認彈窗 */}
                {showDuplicateModal && (
                    <div className="modal modal-open">
                        <div className="modal-box max-w-sm">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-xl font-bold">此名稱已被使用</h3>
                                    <p className="text-base-content/70">
                                        「{name}」這個名稱已經被 <strong className="text-primary">{existingEmail}</strong> 使用。
                                    </p>
                                    <p className="text-sm text-base-content/50">
                                        如果您已經有過帳號，請切換至正確的 Google 帳號登入。否則請嘗試使用不同的顯示名稱。
                                    </p>
                                </div>
                                <div className="flex flex-col gap-2 w-full pt-2">
                                    <button
                                        className="btn btn-primary w-full"
                                        onClick={handleDuplicateConfirm}
                                        disabled={deletingAccount}
                                    >
                                        {deletingAccount ? (
                                            <>
                                                <span className="loading loading-spinner"></span>
                                                處理中...
                                            </>
                                        ) : (
                                            '登出並尋找原帳號'
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-ghost w-full"
                                        onClick={() => setShowDuplicateModal(false)}
                                        disabled={deletingAccount}
                                    >
                                        更換名稱
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-backdrop bg-black/40" onClick={() => setShowDuplicateModal(false)}>
                            <button className="cursor-default">close</button>
                        </div>
                    </div>
                )}
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
