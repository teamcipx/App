import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Users, Check, X, Loader2, Save } from 'lucide-react';
import WebApp from '@twa-dev/sdk';

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;
  const adminId = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822);

  useEffect(() => {
    if (telegramId !== adminId) {
      alert('Access Denied');
      return;
    }
    fetchData();
  }, [telegramId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: s, error: sErr } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (sErr) console.error('Error fetching settings:', sErr);
      if (s) setSettings(s);

      // Fetch withdrawals
      const { data: w, error: wErr } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(50);
      if (wErr) console.error('Error fetching withdrawals:', wErr);
      if (w) setWithdrawals(w);
    } catch (err) {
      console.error('Unexpected error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSetting = (field: string, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await supabase.from('settings').update(settings).eq('id', 1);
    setSaving(false);
    WebApp.showAlert('Settings saved successfully!');
  };

  const handleWithdrawalStatus = async (id: string, status: string, telegram_id: number, amount: number) => {
    await supabase.from('withdrawals').update({ status }).eq('id', id);
    
    // If rejected, refund balance
    if (status === 'rejected') {
      const { data: user } = await supabase.from('users').select('balance').eq('telegram_id', telegram_id).single();
      if (user) {
        await supabase.from('users').update({ balance: user.balance + amount }).eq('telegram_id', telegram_id);
      }
    }
    
    fetchData();
  };

  if (telegramId !== adminId) {
    return <div className="p-8 text-center text-red-400">Unauthorized</div>;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8 pt-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" /> Admin Panel
        </h1>
        <a href="/" className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg">Back to App</a>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-6">App Settings</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Daily Ad Limit</label>
            <input 
              type="number"
              value={settings?.daily_ad_limit || ''}
              onChange={e => handleUpdateSetting('daily_ad_limit', parseInt(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Coins Per Ad</label>
            <input 
              type="number"
              value={settings?.coins_per_ad || ''}
              onChange={e => handleUpdateSetting('coins_per_ad', parseInt(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Min Withdraw Amount</label>
            <input 
              type="number"
              value={settings?.min_withdraw || ''}
              onChange={e => handleUpdateSetting('min_withdraw', parseInt(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Coin to Currency Rate</label>
            <input 
              type="number"
              step="0.0001"
              value={settings?.coin_rate || ''}
              onChange={e => handleUpdateSetting('coin_rate', parseFloat(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-slate-400">Enable Popup Notice</label>
              <button 
                onClick={() => handleUpdateSetting('notice_active', !settings?.notice_active)}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings?.notice_active ? 'bg-indigo-500' : 'bg-slate-700'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings?.notice_active ? 'left-6.5' : 'left-0.5'}`} />
              </button>
            </div>
            {settings?.notice_active && (
              <textarea
                value={settings?.notice_text || ''}
                onChange={e => handleUpdateSetting('notice_text', e.target.value)}
                placeholder="Notice message..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>
        </div>

        <button 
          onClick={handleSaveSettings}
          disabled={saving}
          className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Settings</>}
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl overflow-hidden">
        <h2 className="text-lg font-bold text-white mb-6">Recent Withdrawals</h2>
        
        {withdrawals.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No withdrawal requests.</p>
        ) : (
          <div className="space-y-4">
            {withdrawals.map(w => (
              <div key={w.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-mono text-slate-500">ID: {w.telegram_id}</span>
                    <h3 className="text-white font-medium capitalize mt-1 border border-slate-800 bg-slate-900 inline-block px-2 py-0.5 rounded text-sm mr-2">{w.method}</h3>
                    <span className="text-indigo-400 font-bold">{w.amount} coins</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${
                    w.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                    w.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {w.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-slate-400 mb-4 bg-slate-900 p-2 rounded">
                  {w.details}
                </div>
                
                {w.status === 'pending' && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleWithdrawalStatus(w.id, 'approved', w.telegram_id, w.amount)}
                      className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                    <button 
                      onClick={() => handleWithdrawalStatus(w.id, 'rejected', w.telegram_id, w.amount)}
                      className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <X className="w-4 h-4" /> Reject & Refund
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
