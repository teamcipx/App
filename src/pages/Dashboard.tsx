import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Coins, Bell, Wallet, LogOut, Loader2, Play, UserCircle } from 'lucide-react';
import NoticeDialog from '../components/NoticeDialog';
import WithdrawDialog from '../components/WithdrawDialog';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822; // Fallback for dev
  const urlParams = new URLSearchParams(window.location.search);
  const startParam = WebApp?.initDataUnsafe?.start_param || urlParams.get('startapp') || urlParams.get('tgWebAppStartParam');


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    fetchData();
  }, [telegramId]);

  const fetchData = async () => {
    setLoading(true);
    let hasError = false;
    try {
      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase.from('settings').select('*').eq('id', 1).single();
      
      if (settingsError) {
        console.error('Error fetching settings:', settingsError);
        hasError = true;
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
          hasError = true;
        }
        
        // Create user
        const today = new Date().toISOString().split('T')[0];
        let initialBalance = 0;
        let referredBy = null;

        // Has referral?
        if (startParam && startParam !== telegramId.toString()) {
          const referrerId = Number(startParam);
          if (!isNaN(referrerId)) {
            const { data: referrer, error: refErr } = await supabase.from('users').select('*').eq('telegram_id', referrerId).single();
            if (referrer) {
               // Referrer gets 500
               await supabase.from('users').update({ balance: referrer.balance + 500 }).eq('telegram_id', referrerId);
               initialBalance = 500; // New user gets 500
               referredBy = referrerId;
            }
          }
        }

        const newUser: any = { 
          telegram_id: telegramId, 
          balance: initialBalance, 
          ads_watched_today: 0, 
          last_ad_date: today 
        };
        
        if (referredBy) {
          newUser.referred_by = referredBy;
        }

        let { error: insertError } = await supabase.from('users').insert([newUser]);
        
        if (insertError) {
           console.error('Error creating user (might be missing referred_by column?):', insertError);
           // Retry without referred_by
           if (newUser.referred_by !== undefined) {
             delete newUser.referred_by;
             const retryRes = await supabase.from('users').insert([newUser]);
             insertError = retryRes.error;
           }
        }
        
        if (insertError && insertError.code !== '23505') { // 23505 is unique violation
          console.error('Error creating user:', insertError);
          hasError = true;
        } else {
          // If it was a duplicate key error, fetch the user again
          if (insertError && insertError.code === '23505') {
            const { data: existingUser } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
            if (existingUser) setUser(existingUser);
            insertError = null;
          }
        }

        if (!insertError && !user) {
          setUser(newUser);
        }
      }
      
      if (hasError) {
        setErrorMsg('Database connection error. Make sure you have executed the new SQL query in Supabase and disabled RLS.');
      }
    } catch (err) {
      console.error('Unexpected error in fetchData:', err);
      setErrorMsg('Unexpected database error.');
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    if (!settings || !user || adLoading || cooldown > 0) return;
    if (user.is_banned) {
      setErrorMsg('You are banned.');
      return;
    }
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
        setCooldown(20); // 20 seconds cooldown
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
    <div className="p-4 max-w-lg mx-auto relative">
      <button 
        onClick={() => navigate('/account')}
        className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-300 hover:text-white transition-colors"
      >
        <UserCircle className="w-6 h-6" />
      </button>

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
      
      {user?.is_banned && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-3xl mb-6 text-center">
          <h2 className="text-red-400 font-bold mb-1">Account Banned</h2>
          <p className="text-red-400/80 text-sm">Your account has been suspended for violating our terms of service.</p>
        </div>
      )}

      {!user?.is_banned && (
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
      )}

      {!user?.is_banned && errorMsg && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-2xl mb-6 text-sm text-center">
          {errorMsg}
        </div>
      )}

      {!user?.is_banned && (
        <div className="space-y-4">
          <button
            disabled={adLoading || cooldown > 0 || (user?.ads_watched_today >= settings?.daily_ad_limit)}
            onClick={handleWatchAd}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/25"
          >
            {adLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6" fill="currentColor" />
            )}
            <span>
              {adLoading 
                ? 'Viewing Ad...' 
                : cooldown > 0 
                  ? `Wait ${cooldown}s` 
                  : 'Watch Ad & Earn'}
            </span>
          </button>

          <button
            onClick={() => navigate('/tasks')}
            className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white p-4 rounded-3xl font-bold flex items-center justify-between transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-lg">Daily Tasks</span>
            </div>
            <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-lg">Earn Extra</span>
          </button>
        </div>
      )}

      {user?.telegram_id === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822) && (
        <div className="mt-8 pt-6 border-t border-slate-900 text-center">
          <button onClick={() => navigate('/admin')} className="text-slate-500 text-sm hover:text-slate-300">Admin Dashboard &rarr;</button>
        </div>
      )}
    </div>
  );
}
