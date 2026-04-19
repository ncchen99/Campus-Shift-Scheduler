import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AvailabilityPage from './pages/AvailabilityPage';
import RosterPage from './pages/RosterPage';
import ViewRosterPage from './pages/ViewRosterPage';
import AdminPage from './pages/AdminPage';

function AppContent() {
  const { user, loading, needsNameSetup, isLeader, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('availability');

  // 載入中
  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
          <p className="mt-4 text-base-content/70">載入中...</p>
        </div>
      </div>
    );
  }

  // 未登入或需要設定名稱
  if (!user || needsNameSetup) {
    return <LoginPage />;
  }

  // 根據權限調整 tab
  const handleTabChange = (tab) => {
    // roster 分頁現在所有人都可以看（一般用戶看只讀版本）
    if (tab === 'admin' && !isAdmin) return;
    setActiveTab(tab);
  };

  // 渲染對應頁面
  const renderPage = () => {
    switch (activeTab) {
      case 'availability':
        return <AvailabilityPage />;
      case 'roster':
        // 管理員/班長可完整編輯，一般用戶只能查看
        return isLeader ? <RosterPage /> : <ViewRosterPage />;
      case 'admin':
        return isAdmin ? <AdminPage /> : <AvailabilityPage />;
      default:
        return <AvailabilityPage />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;

