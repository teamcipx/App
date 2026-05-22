import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Coins, Bell, Wallet, LogOut, Loader2, Play } from 'lucide-react';
import NoticeDialog from '../components/NoticeDialog';
import WithdrawDialog from '../components/WithdrawDialog';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 123456789; // Fallback for dev

  useEffect(() => {
    fetchData();
  }, [telegramId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').eq('id', 1).single();
      
      if (settingsError) {
        console.error('Error fetching settings:', settingsError);
      }
      
      if (settingsData) {
        setSettings(settingsData);
        if (settingsData.notice_active && settingsData.notice_text) {
          setShowNotice(true);
        }
      }

      // Fetch user
      const { data: userData, error: userError } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
      
      if (userData) {
        // Check if day changed to reset ad count
        const today = new Date().toISOString().split('T')[0];
        if (userData.last_ad_date !== today) {
          await supabase.from('users').update({ ads_watched_today: 0, last_ad_date: today }).eq('telegram_id', telegramId);
          userData.ads_watched_today = 0;
        }
        setUser(userData);
      } else {
        if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error fetching user:', userError);
        }
        
        // Create user
        const today = new Date().toISOString().split('T')[0];
        const newUser = { telegram_id: telegramId, balance: 0, ads_watched_today: 0, last_ad_date: today };
        const { error: insertError } = await supabase.from('users').insert([newUser]);
        if (insertError) {
           console.error('Error creating user:', insertError);
        }
        setUser(newUser);
      }
    } catch (err) {
      console.error('Unexpected error in fetchData:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!settings || !user) return;
    if (user.ads_watched_today >= settings.daily_ad_limit) {
      setErrorMsg('Daily ad limit reached. Come back tomorrow!');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    setAdLoading(true);
    setErrorMsg('');

    const rewardUser = async () => {
      try {
        const newBalance = user.balance + settings.coins_per_ad;
        const newWatched = user.ads_watched_today + 1;
        const today = new Date().toISOString().split('T')[0];
        
        await supabase.from('users').update({
          balance: newBalance,
          ads_watched_today: newWatched,
          last_ad_date: today
        }).eq('telegram_id', telegramId);
        
        setUser({ ...user, balance: newBalance, ads_watched_today: newWatched, last_ad_date: today });
        WebApp.showAlert(`You earned ${settings.coins_per_ad} coins!`);
      } catch (e) {
        console.error("Error updating reward:", e);
      } finally {
        setAdLoading(false);
      }
    };

    // Call Monetag Ad
    try {
      if (typeof window !== 'undefined' && (window as any).show_11042874) {
        const adResult = (window as any).show_11042874({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
          }
        });

        if (adResult && typeof adResult.then === 'function') {
          adResult.then(() => {
            rewardUser();
          }).catch((e: any) => {
            console.error("Ad promise error:", e);
            // Even if it fails, maybe they watched it partially or it was blocked, we'll just fail.
            setErrorMsg('Ad was skipped or failed to load.');
            setAdLoading(false);
          });
        } else {
          // No promise returned, just fallback to timeout
          setTimeout(() => {
            rewardUser();
          }, 4000);
        }
      } else {
        // Ads SDK not loaded, could be due to ad blocker.
        // We can just proceed to reward them to avoid confusing legit users with adblockers on mobile, or show error.
        // As per request "ad dekhar por coin ad hobe", if sdk blocked, we could just reward directly for now.
        rewardUser();
      }
    } catch (e) {
      console.error(e);
      setAdLoading(false);
      setErrorMsg('Error loading ad.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {settings?.notice_active && (
        <NoticeDialog 
          open={showNotice} 
          onClose={() => setShowNotice(false)} 
          text={settings?.notice_text || ''} 
        />
      )}
      
      <WithdrawDialog 
        open={showWithdraw} 
        onClose={() => setShowWithdraw(false)} 
        user={user}
        settings={settings}
        onSuccess={fetchData}
      />

      <div className="flex flex-col items-center pt-8 pb-12">
        <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)] mb-6">
          <Coins className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">xN Coin</h1>
        <p className="text-slate-400 font-mono text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          ID: {telegramId}
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 shadow-xl">
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-6">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Your Balance</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight text-white">{user?.balance || 0}</span>
              <span className="text-indigo-400 font-medium">xNC</span>
            </div>
          </div>
          <button 
            onClick={() => setShowWithdraw(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-2xl transition-colors active:scale-95"
          >
            <Wallet className="w-4 h-4" />
            <span>Withdraw</span>
          </button>
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-400">Daily Ads Watched:</span>
          <span className="font-mono bg-slate-950 px-2 py-0.5 rounded text-indigo-400">
            {user?.ads_watched_today || 0} / {settings?.daily_ad_limit || 0}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-2xl mb-6 text-sm text-center">
          {errorMsg}
        </div>
      )}

      <button
        disabled={adLoading || (user?.ads_watched_today >= settings?.daily_ad_limit)}
        onClick={handleWatchAd}
        className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
      >
        {adLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Play className="w-6 h-6" fill="currentColor" />
        )}
        <span>{adLoading ? 'Viewing Ad...' : 'Watch Ad & Earn'}</span>
      </button>

      {user?.telegram_id === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 123456789) && (
        <div className="mt-8 pt-6 border-t border-slate-900 text-center">
          <a href="/admin" className="text-slate-500 text-sm hover:text-slate-300">Admin Dashboard &rarr;</a>
        </div>
      )}
    </div>
  );
}
