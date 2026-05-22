import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import { useEffect } from 'react';
import WebApp from '@twa-dev/sdk';

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
      <div className="min-h-screen bg-slate-950 text-slate-50 font-sans font-medium selection:bg-indigo-500/30">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </Router>
  );
}
