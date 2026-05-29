import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Coins, Bell, Wallet, LogOut, Loader2, Play, UserCircle, History as HistoryIcon, Trophy, MessageSquare, Gift } from 'lucide-react';
import NoticeDialog from '../components/NoticeDialog';
import PromoDialog from '../components/PromoDialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [adReady, setAdReady] = useState(false);
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
    const checkAd = setInterval(() => {
      if (typeof window !== 'undefined' && typeof (window as any).Adsgram !== 'undefined') {
        setAdReady(true);
        clearInterval(checkAd);
      }
    }, 1000);

    return () => {
      clearInterval(checkAd);
    }
  }, []);

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
        // Parse custom user state
        let customState = { date: '', spinsToday: 0, lastSpinTime: 0, scratchesToday: 0 };
        try {
          if (userData.last_ad_date.startsWith('{')) {
            customState = JSON.parse(userData.last_ad_date);
          } else {
            customState.date = userData.last_ad_date;
          }
        } catch(e) {}

        const today = new Date().toISOString().split('T')[0];
        let needsUpdate = false;
        
        if (customState.date !== today) {
          customState.date = today;
          customState.spinsToday = 0;
          customState.scratchesToday = 0;
          userData.ads_watched_today = 0;
          needsUpdate = true;
        }

        userData.customState = customState;

        if (needsUpdate) {
          await supabase.from('users').update({ 
            ads_watched_today: 0, 
            last_ad_date: JSON.stringify(customState) 
          }).eq('telegram_id', telegramId);
        }
        setUser(userData);
      } else {
        if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
          console.error('Error fetching user:', userError);
          hasError = true;
        }
        
        // Create user
        const today = new Date().toISOString().split('T')[0];
        const newCustomState = { date: today, spinsToday: 0, lastSpinTime: 0, scratchesToday: 0 };
        let initialBalance = 0;
        let referredBy = null;

        // Has referral?
        if (startParam && startParam !== telegramId.toString()) {
          const referrerId = Number(startParam);
          if (!isNaN(referrerId)) {
            const { data: referrer, error: refErr } = await supabase.from('users').select('*').eq('telegram_id', referrerId).single();
            if (referrer) {
               await supabase.from('users').update({ balance: referrer.balance + 500 }).eq('telegram_id', referrerId);
               initialBalance = 500; 
               referredBy = referrerId;
            }
          }
        }

        const newUser: any = { 
          telegram_id: telegramId, 
          balance: initialBalance, 
          ads_watched_today: 0, 
          last_ad_date: JSON.stringify(newCustomState) 
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
        
        const stateToSave = { ...user.customState };
        stateToSave.totalAdsWatched = (stateToSave.totalAdsWatched || 0) + 1;
        
        // Update user balance
        await supabase.from('users').update({
          balance: newBalance,
          ads_watched_today: newWatched,
          last_ad_date: JSON.stringify(stateToSave)
        }).eq('telegram_id', telegramId);
        
        // Log ad history (ignore errors if table doesn't exist yet)
        try {
          await supabase.from('ad_history').insert([{
            telegram_id: telegramId,
            reward_amount: settings.coins_per_ad
          }]);
        } catch (adErr) {
          console.error("Ad history logging failed:", adErr);
        }

        setUser({ ...user, balance: newBalance, ads_watched_today: newWatched, customState: stateToSave });

        setCooldown(20); // 20 seconds cooldown
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        toast.success(`You earned ${settings.coins_per_ad} coins!`);

        // 10% chance to ask user to click ad
        if (Math.random() < 0.1) {
          setTimeout(() => {
            WebApp.showAlert('বিজ্ঞাপনটিতে ক্লিক করুন! এতে আপনার বোনাস বৃদ্ধি পাবে।');
          }, 1000);
        }

      } catch (e) {
        console.error("Error updating reward:", e);
      } finally {
        setAdLoading(false);
      }
    };

    const showAdsgramAd = () => {
      if (typeof window !== 'undefined' && (window as any).Adsgram) {
        const AdController = (window as any).Adsgram.init({ blockId: "int-33047" });
        AdController.show().then((result: any) => {
          // User watched ad
          rewardUser();
        }).catch((err: any) => {
          console.error("Ad promise error:", err);
          const errorDetail = err && err.description ? err.description : JSON.stringify(err);
          setErrorMsg(`Ad Error: ${errorDetail}`);
          setAdLoading(false);
          setCooldown(5); // Small penalty cooldown
        });
      } else {
        // Ads SDK not loaded
        setAdLoading(false);
        setCooldown(20);
        toast('Alternative Ad opened! Reward in 20 seconds.', { icon: '⏳' });
        setTimeout(() => {
          rewardUser();
        }, 20000);
      }
    };

    try {
      const isOnclickA = Math.random() < 0.5;
      
      if (isOnclickA) {
        
        const playAd = (showFn: any) => {
          showFn()
            .then(() => rewardUser())
            .catch((err: any) => {
              console.error("OnclickA task error:", err);
              // Fallback to Adsgram if OnclickA fails
              showAdsgramAd();
             });
        };

        if ((window as any).showOnclickABase) {
          playAd((window as any).showOnclickABase);
        } else if (typeof window !== "undefined" && (window as any).initCdTma) {
          (window as any).initCdTma({ id: '442749' })
            .then((showFn: any) => {
              (window as any).showOnclickABase = showFn;
              playAd(showFn);
            })
            .catch((err: any) => {
              console.error("OnclickA init error:", err);
              showAdsgramAd();
            });
        } else {
          showAdsgramAd();
        }
      } else {
        showAdsgramAd();
      }
    } catch (e) {
      console.error(e);
      setAdLoading(false);
      setErrorMsg('Error loading ad.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#038758]/100" /></div>;
  }

  return (
    <div className="max-w-md mx-auto relative bg-slate-50 min-h-screen pb-6">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-center py-2.5 border-b border-slate-50">
           <div className="flex items-center gap-2">
             <img src="https://i.ibb.co.com/ksH3BGtD/received-844524062067024.jpg" alt="Logo" className="w-6 h-6 object-contain rounded-full" />
             <span className="font-extrabold text-slate-800 text-lg tracking-tight">xN Coin</span>
           </div>
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              {WebApp?.initDataUnsafe?.user?.photo_url ? (
                <img src={WebApp.initDataUnsafe.user.photo_url} alt="DP" className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm" />
              ) : (
                <div className="w-12 h-12 bg-[#038758]/10 text-[#038758] rounded-full flex items-center justify-center font-bold text-xl shadow-sm border border-[#038758]/20">
                  {(WebApp?.initDataUnsafe?.user?.first_name || 'U')[0]}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#038758] border-2 border-white rounded-full"></span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-1">
                {WebApp?.initDataUnsafe?.user?.first_name || 'My Name'}
                <svg className="w-5 h-5 text-[#038758]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.8 14.8L6.4 13l1.4-1.4 2.4 2.4 6.4-6.4 1.4 1.4-7.8 7.8z" />
                </svg>
              </h1>
            </div>
          </div>
          <button 
            onClick={() => setShowNotice(true)}
            className="p-2 text-slate-500 hover:text-[#038758] hover:bg-[#038758]/10 rounded-full transition-colors relative"
          >
            <Bell className="w-6 h-6" />
            {settings?.notice_active && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <NoticeDialog 
          open={showNotice} 
          onClose={() => setShowNotice(false)} 
          text={settings?.notice_text || ''} 
        />

        <PromoDialog
          isOpen={showPromo}
          onClose={() => setShowPromo(false)}
          onSuccess={fetchData}
        />
        
        {user?.is_banned && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl text-center">
            <h2 className="font-bold mb-1">Account Banned</h2>
            <p className="text-sm border-t border-red-200 pt-2 mt-2">Your account has been suspended.</p>
          </div>
        )}

        {!user?.is_banned && (
          <div className="bg-[#038758] rounded-[24px] p-6 text-white shadow-md relative overflow-hidden">
            <p className="text-emerald-100/90 text-[15px] font-medium mb-1">মোট ব্যালেন্স</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-5xl font-bold tracking-tight">{(user?.balance || 0).toFixed(2)}</span>
                <span className="text-2xl font-bold mt-3">xNC</span>
              </div>
              <button
                onClick={() => navigate('/withdraw')}
                className="bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-full font-bold text-sm backdrop-blur-sm transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>
        )}

        {!user?.is_banned && errorMsg && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl text-sm text-center">
            {errorMsg}
          </div>
        )}

        {!user?.is_banned && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2 px-2">
              <div className="flex justify-between items-center">
                 <span className="text-slate-600 font-medium text-sm">আজকের প্রগ্রেস</span>
                 <span className="text-sm font-bold text-[#038758]">
                   {user?.ads_watched_today || 0} / {settings?.daily_ad_limit || 0}
                 </span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                 <motion.div 
                   className="h-full bg-[#038758]"
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(100, ((user?.ads_watched_today || 0) / (settings?.daily_ad_limit || 1)) * 100)}%` }}
                   transition={{ duration: 1, ease: 'easeOut' }}
                 />
              </div>
            </div>
            
            <button
              disabled={!adReady || adLoading || cooldown > 0 || (user?.ads_watched_today >= settings?.daily_ad_limit)}
              onClick={handleWatchAd}
            className="w-full bg-[#038758] hover:bg-[#026b46] text-white disabled:opacity-50 disabled:cursor-not-allowed p-4 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-md"
          >
            {(!adReady || adLoading) ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Play className="w-6 h-6" fill="currentColor" />
            )}
            <span className="text-lg">
              {!adReady 
                ? 'অ্যাড লোড হচ্ছে...' 
                : adLoading 
                  ? 'অ্যাড দেখা হচ্ছে...' 
                  : cooldown > 0 
                    ? `অপেক্ষা করুন ${cooldown}s` 
                    : 'অ্যাড দেখুন ও আয় করুন'}
            </span>
          </button>

          <button
            onClick={() => navigate('/tasks')}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 p-4 rounded-3xl font-bold flex items-center justify-between transition-all active:scale-[0.98] shadow-sm"
          >
            <div className="flex items-center gap-3">
               <div className="p-2.5 bg-[#038758]/20 text-[#038758] rounded-xl">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <span className="text-lg text-slate-800">ডেইলি টাস্ক</span>
            </div>
            <span className="bg-[#038758]/10 border border-[#038758]/20 text-[#038758] text-xs px-3 py-1.5 rounded-lg">আরও আয় করুন</span>
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/spin')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 p-5 rounded-3xl font-bold flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
            >
              <div className="p-4 bg-slate-50 border border-slate-100 text-[#038758] rounded-2xl">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </div>
              <span className="text-sm">স্পিন হুইল</span>
            </button>
            <button
              onClick={() => navigate('/scratch')}
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 p-5 rounded-3xl font-bold flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-sm"
            >
              <div className="p-4 bg-slate-50 border border-slate-100 text-[#038758] rounded-2xl">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </div>
              <span className="text-sm">স্ক্র্যাচ কার্ড</span>
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Footer links */}
      <div className="mt-6 gap-3 grid grid-cols-2 px-4">
        <button 
          onClick={() => setShowPromo(true)}
          className="w-full bg-[#038758]/10 border border-[#038758]/20 hover:bg-[#038758]/20 text-[#038758] p-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98]"
        >
          <Gift className="w-5 h-5 text-[#038758]" />
          <span className="text-xs">প্রোমো কোড</span>
        </button>

        <button 
          onClick={() => navigate('/reviews')}
          className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 p-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-sm"
        >
          <MessageSquare className="w-5 h-5 text-[#038758]" />
          <span className="text-xs">পেমেন্ট প্রুফ</span>
        </button>

        <a 
          href="https://t.me/xncoinofficial" 
          target="_blank" 
          rel="noreferrer"
          className="w-full bg-[#038758]/10 border border-[#038758]/20 hover:bg-[#038758]/20 text-[#038758] p-3 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a5.96 5.96 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.892-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
          <span className="text-xs">টেলিগ্রাম চ্যানেল</span>
        </a>
        
        <button 
          onClick={() => {}}
          className="w-full bg-slate-100 border border-slate-200 text-slate-400 p-3 rounded-2xl font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-not-allowed"
        >
          <svg className="w-5 h-5 opacity-50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="text-xs">ফেসবুক পেজ (শীঘ্রই)</span>
        </button>
      </div>

      <div className="mt-4 px-4">
        <button 
          className="w-full relative overflow-hidden bg-red-50 border border-red-200 p-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
        >
           <Play className="w-5 h-5 text-red-500 relative z-10" />
           <span className="text-red-600 relative z-10 text-sm">কিভাবে কাজ করবেন <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded ml-1 text-red-600 border border-red-200">শীঘ্রই</span></span>
        </button>
      </div>

      {user?.telegram_id === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822) && (
        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <button onClick={() => navigate('/admin')} className="text-slate-500 text-sm hover:text-slate-700">Admin Dashboard &rarr;</button>
        </div>
      )}
    </div>
  );
}
