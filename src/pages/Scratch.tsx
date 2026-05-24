import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function Scratch() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [scratched, setScratched] = useState(false);
  const [currentReward, setCurrentReward] = useState<number | null>(null);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const { data } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
      if (data) {
        let customState = { date: '', spinsToday: 0, lastSpinTime: 0, scratchesToday: 0 };
        try {
          if (data.last_ad_date.startsWith('{')) {
            customState = JSON.parse(data.last_ad_date);
          }
        } catch(e) {}
        data.customState = customState;
        setUser(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScratch = async () => {
    if (!user || scratched) return;
    
    if (user.customState.scratchesToday >= 5) {
      toast.error('You reached your daily limit of 5 scratch cards.');
      return;
    }

    // 60% chance between 10 and 99, 40% chance between 100 and 200
    let reward;
    if (Math.random() < 0.60) {
      reward = Math.floor(Math.random() * (99 - 10 + 1)) + 10;
    } else {
      reward = Math.floor(Math.random() * (200 - 100 + 1)) + 100;
    }
    
    setCurrentReward(reward);
    setScratched(true);
    
    const newBalance = user.balance + reward;
    const newState = {
      ...user.customState,
      scratchesToday: user.customState.scratchesToday + 1
    };

    await supabase.from('users').update({
      balance: newBalance,
      last_ad_date: JSON.stringify(newState)
    }).eq('telegram_id', telegramId);

    setUser({ ...user, balance: newBalance, customState: newState });
    toast.success(`You won ${reward} coins!`);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>;

  const scratchesLeft = 5 - (user?.customState?.scratchesToday || 0);

  return (
    <div className="max-w-md mx-auto relative bg-slate-50 min-h-screen flex flex-col pt-8 pb-8">
      <div className="flex items-center justify-between mb-8 pt-2 px-4">
        <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[#038758] font-bold flex items-center gap-2 shadow-sm">
          <Star className="w-4 h-4" /> {user?.balance || 0}
        </div>
      </div>

      <div className="text-center mb-10 px-4">
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">স্ক্র্যাচ কার্ড</h1>
        <p className="text-slate-500 text-sm">ঘষে জিতে নিন ২০০ কয়েন পর্যন্ত।</p>
        <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
           <span className="bg-[#038758]/10 border border-[#038758]/20 px-3 py-1.5 rounded-lg text-[#038758]">কার্ড বাকি: <span className="font-bold">{scratchesLeft}</span></span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center -mt-10 px-4">
        <div 
          onClick={handleScratch}
          className={`relative w-full max-w-[280px] h-48 rounded-2xl overflow-hidden cursor-pointer shadow-md transition-all duration-500 ${scratched ? '' : 'hover:scale-105 active:scale-95'}`}
        >
          {/* Back of Card (Result) */}
          <div className="absolute inset-0 bg-white border-2 border-amber-400 flex flex-col items-center justify-center">
            {scratched ? (
              <div className="animate-in zoom-in spin-in-2 duration-500 flex flex-col items-center">
                <span className="text-5xl font-black text-amber-500 mb-2">+{currentReward}</span>
                <span className="text-slate-400 font-bold uppercase tracking-widest text-sm">কয়েন জিতেছেন</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center opacity-20">
                 <Star className="w-16 h-16 text-slate-500 mb-2" />
                 <span className="font-bold text-slate-500">?</span>
              </div>
            )}
          </div>
          
          {/* Front of Card (Coating to scratch off) */}
          <div 
            className={`absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center transition-all duration-700 origin-center pointer-events-none ${scratched ? 'opacity-0 scale-150 rotate-12' : 'opacity-100 scale-100'}`}
          >
            <div className="text-center">
              <Star className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-slate-600 font-black tracking-widest text-xl opacity-80 mix-blend-overlay">ঘষুন</p>
            </div>
            
            {/* Texture overlay */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-black mix-blend-overlay"></div>
          </div>
        </div>

        {scratched && scratchesLeft > 0 && (
          <button 
            onClick={() => { setScratched(false); setCurrentReward(null); }}
            className="mt-12 text-[#038758] font-bold px-6 py-3 bg-[#038758]/10 rounded-xl transition-colors hover:bg-[#038758]/20"
          >
            পরবর্তী কার্ড &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
