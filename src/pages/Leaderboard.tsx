import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, Users, Loader2, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [userReferrals, setUserReferrals] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;
  const TARGET_REFERRALS = 30;
  const BONUS_COINS = 10000;

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const { data: currentUser } = await supabase.from('users').select('last_ad_date').eq('telegram_id', telegramId).single();
      
      let customState = { date: '', spinsToday: 0, lastSpinTime: 0, scratchesToday: 0, referralBonusClaimed: false };
      if (currentUser?.last_ad_date) {
        try {
           if (currentUser.last_ad_date.startsWith('{')) {
             customState = { ...customState, ...JSON.parse(currentUser.last_ad_date) };
           }
        } catch(e) {}
      }
      setHasClaimed(customState.referralBonusClaimed);

      // 1. Fetch all users to calculate referrals locally
      const { data, error } = await supabase.from('users').select('telegram_id, referred_by');
      if (error) throw error;
      
      if (!data) return;

      const refCounts: Record<number, number> = {};
      
      data.forEach(user => {
        if (user.referred_by) {
          refCounts[user.referred_by] = (refCounts[user.referred_by] || 0) + 1;
        }
      });

      setUserReferrals(refCounts[telegramId] || 0);

      // 2. Sort to get top
      const sorted = Object.entries(refCounts)
        .map(([id, count]) => ({ id: Number(id), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      setLeaders(sorted);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async () => {
    if (userReferrals < TARGET_REFERRALS) {
      toast.error(`You need ${TARGET_REFERRALS} referrals to claim this bonus!`);
      return;
    }
    
    if (hasClaimed) {
       toast.error('Bonus already claimed!');
       return;
    }

    setClaiming(true);
    try {
       const { data: user } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
       if (!user) throw new Error('User not found');
       
       let customState = { date: '', spinsToday: 0, lastSpinTime: 0, scratchesToday: 0, referralBonusClaimed: false };
       try {
         if (user.last_ad_date.startsWith('{')) {
           customState = { ...customState, ...JSON.parse(user.last_ad_date) };
         }
       } catch(e) {}
       
       customState.referralBonusClaimed = true;
       
       await supabase.from('users').update({
         balance: user.balance + BONUS_COINS,
         last_ad_date: JSON.stringify(customState)
       }).eq('telegram_id', telegramId);
       
       setHasClaimed(true);
       toast.success(`Congratulations! You claimed ${BONUS_COINS} coins!`);
    } catch(err) {
       console.error(err);
       toast.error('Failed to claim bonus.');
    } finally {
       setClaiming(false);
    }
  };

  const progressPercentage = Math.min((userReferrals / TARGET_REFERRALS) * 100, 100);

  return (
    <div className="max-w-md mx-auto pt-6 px-4 bg-slate-50 min-h-screen pb-32 animate-in relative min-h-screen">
      <div className="flex items-center gap-3 mb-6 pt-2">
        <button 
          onClick={() => navigate('/')}
          className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          রেফারেল লিডারবোর্ড
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>
      ) : (
        <>
          {/* Target Progress Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Gift className="w-24 h-24 text-[#038758]" />
             </div>
             
             <div className="relative z-10">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <Gift className="w-5 h-5 text-[#038758]" />
                 সুপার বোনাস
               </h3>
               <p className="text-sm text-slate-500 mt-1">
                 আকর্ষণীয় <span className="text-amber-500 font-bold">{BONUS_COINS.toLocaleString()} কয়েন</span> বোনাস পেতে {TARGET_REFERRALS} জন বন্ধুকে আমন্ত্রণ জানান!
               </p>
               
               <div className="mt-5">
                 <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                   <span>{userReferrals} টি রেফারেল</span>
                   <span>লক্ষ্য {TARGET_REFERRALS} টি</span>
                 </div>
                 <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-5">
                   <div 
                     className="h-full bg-gradient-to-r from-[#038758] to-[#038758] transition-all duration-1000 ease-out"
                     style={{ width: `${progressPercentage}%` }}
                   />
                 </div>
                 
                 <button 
                   onClick={handleClaimBonus}
                   disabled={userReferrals < TARGET_REFERRALS || hasClaimed || claiming}
                   className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
                     hasClaimed 
                       ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                       : userReferrals >= TARGET_REFERRALS
                         ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-800 shadow-lg shadow-orange-500/25'
                         : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                   }`}
                 >
                   {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {hasClaimed ? 'বোনাস সংগ্রহ করা হয়েছে!' : userReferrals >= TARGET_REFERRALS ? 'এখনই বোনাস সংগ্রহ করুন' : `আরও ${TARGET_REFERRALS - userReferrals} টি রেফারেল প্রয়োজন`}
                 </button>
               </div>
             </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl">
             <div className="p-6 text-center border-b border-slate-200 bg-slate-50">
               <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
               <h2 className="text-xl font-bold text-slate-800">শীর্ষ রেফারার</h2>
               <p className="text-sm text-slate-500 mt-1">লিডারবোর্ডে উপরে উঠতে বন্ধুদের আমন্ত্রণ জানান!</p>
             </div>
             
             <div className="divide-y divide-slate-800/50">
               {leaders.length === 0 ? (
                 <div className="p-8 text-center text-slate-500">
                   এখনো কোনো রেফারেল নেই। আপনিই প্রথম হোন!
                 </div>
               ) : (
                 leaders.map((leader, index) => (
                   <div key={leader.id} className={`p-4 flex items-center gap-4 ${leader.id === telegramId ? 'bg-[#038758]/10' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-slate-400/20 text-slate-600' :
                        index === 2 ? 'bg-amber-700/20 text-amber-600' :
                        'bg-slate-800 text-slate-500'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 flex items-center gap-2">
                          {leader.id === telegramId ? 'আপনি' : `User ${leader.id.toString().slice(0, 4)}...`}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-1.5 bg-[#038758]/10 px-3 py-1.5 rounded-xl">
                        <Users className="w-4 h-4 text-[#038758]" />
                        <span className="font-bold text-[#038758]">{leader.count}</span>
                      </div>
                   </div>
                 ))
               )}
             </div>
          </div>
        </>
      )}
    </div>
  );
}
