import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Account from './pages/Account';
import Tasks from './pages/Tasks';
import History from './pages/History';
import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Toaster } from 'sonner';
import SupportWidget from './components/SupportWidget';
import BottomNav from './components/BottomNav';

import Leaderboard from './pages/Leaderboard';
import Spin from './pages/Spin';
import Scratch from './pages/Scratch';
import Reviews from './pages/Reviews';

export default function App() {
  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
    } catch (e) {
      console.log('WebApp init error', e);
    }
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
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/spin" element={<Spin />} />
          <Route path="/scratch" element={<Scratch />} />
          <Route path="/history" element={<History />} />
          <Route path="/reviews" element={<Reviews />} />
        </Routes>
        <BottomNav />
        <SupportWidget />
      </div>
    </Router>
  );
}
