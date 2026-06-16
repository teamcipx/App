import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Account from './pages/Account';
import Tasks from './pages/Tasks';
import History from './pages/History';
import Withdraw from './pages/Withdraw';
import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Toaster } from 'sonner';
import SupportWidget from './components/SupportWidget';
import BottomNav from './components/BottomNav';

import Leaderboard from './pages/Leaderboard';
import Spin from './pages/Spin';
import Scratch from './pages/Scratch';
import Reviews from './pages/Reviews';
import Menu from './pages/Menu';
import Referrals from './pages/Referrals';

export default function App() {
  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
    } catch (e) {
      console.log('WebApp init error', e);
    }

    const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;
    const ping = () => {
      fetch('/api/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId })
      }).catch(console.error);
    };

    ping();
    const interval = setInterval(ping, 10000);
    
    const handleUnload = () => {
      fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId }),
        keepalive: true
      }).catch(console.error);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleUnload();
      } else {
        ping();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans font-medium selection:bg-[#038758]/30 pb-20">
        <Toaster position="top-center" theme="light" toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
            borderRadius: '12px'
          }
        }} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/account" element={<Account />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/spin" element={<Spin />} />
          <Route path="/scratch" element={<Scratch />} />
          <Route path="/history" element={<History />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/referrals" element={<Referrals />} />
        </Routes>
        <BottomNav />
        <SupportWidget />
      </div>
    </Router>
  );
}
