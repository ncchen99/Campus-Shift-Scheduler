import { useAuth } from '../contexts/AuthContext';

// Heroicons (outline style)
const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
);

const ClipboardDocumentListIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
);

const Cog6ToothIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const BuildingOfficeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
);

export default function Layout({ children, activeTab, onTabChange }) {
    const { userProfile, isLeader, isAdmin, signOut } = useAuth();

    const tabs = [
        { id: 'availability', label: '填寫', icon: <CalendarIcon />, show: true },
        { id: 'roster', label: '排班管理', icon: <ClipboardDocumentListIcon />, show: isLeader },
        { id: 'admin', label: '系統管理', icon: <Cog6ToothIcon />, show: isAdmin },
    ];

    const visibleTabs = tabs.filter(t => t.show);

    const getRoleBadge = () => {
        if (isAdmin) return { text: '管理員', class: 'badge-error' };
        if (isLeader) return { text: '班長', class: 'badge-warning' };
        return { text: '使用者', class: 'badge-info' };
    };

    const roleBadge = getRoleBadge();

    return (
        <div className="min-h-screen bg-base-200">
            {/* Header with integrated tabs */}
            <header className="navbar bg-neutral text-neutral-content shadow-lg px-4">
                <div className="navbar-start">
                    <h1 className="text-lg font-bold flex items-center gap-2">
                        <BuildingOfficeIcon />
                        <span className="hidden sm:inline">活動中心排班系統</span>
                        <span className="sm:hidden">排班系統</span>
                    </h1>
                </div>

                {/* Tabs in Header - Desktop */}
                <div className="navbar-center hidden md:flex">
                    <div className="flex gap-1 bg-neutral-focus/50 rounded-box p-1">
                        {visibleTabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`btn btn-sm gap-2 ${activeTab === tab.id
                                    ? 'btn-primary'
                                    : 'btn-ghost text-neutral-content hover:bg-neutral-focus'
                                    }`}
                                onClick={() => onTabChange(tab.id)}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="navbar-end gap-2">
                    <span className="text-sm hidden sm:inline">{userProfile?.name}</span>
                    <span className={`badge ${roleBadge.class} badge-sm`}>
                        {roleBadge.text}
                    </span>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={signOut}
                    >
                        登出
                    </button>
                </div>
            </header>

            {/* Mobile tabs */}
            <div className="md:hidden bg-neutral p-2">
                <div className="flex gap-1 justify-center bg-neutral-focus/50 rounded-box p-1">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`btn btn-sm gap-1 ${activeTab === tab.id
                                ? 'btn-primary'
                                : 'btn-ghost text-neutral-content hover:bg-neutral-focus'
                                }`}
                            onClick={() => onTabChange(tab.id)}
                        >
                            {tab.icon}
                            <span className="text-xs">{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <main className="container mx-auto p-4 max-w-7xl flex-1">
                {children}
            </main>

            {/* Footer / Banner message */}
            <footer className="footer footer-center p-6 bg-base-300 text-base-content/60 mt-10">
                <div className="flex items-center gap-2 text-sm">
                    <span>用</span>
                    <span className="text-error animate-heartbeat">❤️</span>
                    <span>製作 | </span>
                    <a
                        href="https://github.com/ncchen99/Campus-Shift-Scheduler"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-hover font-medium underline-offset-4 decoration-primary/30 text-primary"
                    >
                        網頁原始碼
                    </a>
                </div>
            </footer>

            {/* Toast container */}
            <div id="toast-container" className="toast toast-bottom toast-center z-50" />
        </div>
    );
}
