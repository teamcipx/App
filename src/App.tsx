import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Account from './pages/Account';
import Tasks from './pages/Tasks';
import History from './pages/History';
import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import { Toaster } from 'react-hot-toast';
import SupportWidget from './components/SupportWidget';

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
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans font-medium selection:bg-indigo-500/30 pb-20">
        <Toaster position="top-center" toastOptions={{
          style: {
            background: '#1e293b',
            color: '#fff',
            borderRadius: '12px'
          }
        }} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/account" element={<Account />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/history" element={<History />} />
        </Routes>
        <SupportWidget />
      </div>
    </Router>
  );
}
