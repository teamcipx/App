import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function Spin() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  const prizes = [10, 50, 100, 20, 150, 5, 200, 30];

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
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

  const handleSpin = async () => {
    if (!user || spinning) return;
    
    if (user.customState.spinsToday >= 4) {
      toast.error('আপনি আজকের মতো সব স্পিন লিমিট শেষ করেছেন।');
      return;
    }

    const now = Date.now();
    const timeSinceLastSpin = now - (user.customState.lastSpinTime || 0);
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    
    if (timeSinceLastSpin < TWO_HOURS && user.customState.spinsToday > 0) {
      const msLeft = TWO_HOURS - timeSinceLastSpin;
      const minsLeft = Math.ceil(msLeft / (1000 * 60));
      toast.error(`দয়া করে আবার স্পিন করতে ${minsLeft} মিনিট অপেক্ষা করুন।`);
      return;
    }

    setSpinning(true);

    const randomIdx = Math.floor(Math.random() * prizes.length);
    const reward = prizes[randomIdx];
    
    // Calculate rotation
    const baseRot = rotation + 360 * 5; // 5 full spins
    const segmentAngle = 360 / prizes.length;
    // Align so the selected prize is at the top (0 degrees)
    // Actually just a visual approximation
    const finalRot = baseRot + (360 - (segmentAngle * randomIdx));
    
    setRotation(finalRot);

    setTimeout(async () => {
       const newBalance = user.balance + reward;
       const newState = {
         ...user.customState,
         spinsToday: user.customState.spinsToday + 1,
         lastSpinTime: now
       };

       await supabase.from('users').update({
         balance: newBalance,
         last_ad_date: JSON.stringify(newState)
       }).eq('telegram_id', telegramId);

       setUser({ ...user, balance: newBalance, customState: newState });
       toast.success(`আপনি ${reward} পয়েন্ট জিতেছেন!`);
       setSpinning(false);
    }, 4000);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>;

  const spinsLeft = 4 - (user?.customState?.spinsToday || 0);
  const nextSpinReady = (Date.now() - (user?.customState?.lastSpinTime || 0)) >= 2 * 60 * 60 * 1000 || user?.customState?.spinsToday === 0;

  return (
    <div className="max-w-md mx-auto relative bg-slate-50 min-h-screen flex flex-col pt-8 pb-8">
      <div className="flex items-center justify-between mb-8 pt-2 px-4">
        <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[#038758] font-bold shadow-sm">
          {user?.balance || 0} xNC
        </div>
      </div>

      <div className="text-center mb-10 px-4">
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2">ডেইলি স্পিন</h1>
        <p className="text-slate-500 text-sm">স্পিন করে জিতুন ২০০ কয়েন পর্যন্ত।</p>
        <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
           <span className="bg-[#038758]/10 border border-[#038758]/20 px-3 py-1.5 rounded-lg text-[#038758]">স্পিন বাকি: <span className="font-bold">{spinsLeft}</span></span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center -mt-10">
        <div className="relative w-72 h-72">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-red-500 z-10 filter drop-shadow-md"></div>
          
          {/* Wheel */}
          <div 
            className="w-full h-full rounded-full border-4 border-slate-800 shadow-2xl relative overflow-hidden transition-transform duration-[4000ms] ease-[cubic-bezier(0.1,0.7,0.1,1)]"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
             {prizes.map((prize, i) => {
               const angle = (360 / prizes.length) * i;
               return (
                 <div
                   key={i}
                   className="absolute w-full h-full flex items-start justify-center origin-center pt-6"
                   style={{ 
                     transform: `rotate(${angle}deg)`,
                     backgroundColor: i % 2 === 0 ? '#4f46e5' : '#312e81',
                     clipPath: 'polygon(50% 50%, 0% -100%, 100% -100%)'
                   }}
                 >
                   <span className="text-xl font-bold text-white drop-shadow-md origin-center -rotate-90 block mt-4 mr-2">{prize}</span>
                 </div>
               );
             })}
             {/* Center pin */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-white border-4 border-[#038758] rounded-full z-10 shadow-lg"></div>
          </div>
        </div>

        <button 
          disabled={spinning || spinsLeft === 0 || (!nextSpinReady && spinsLeft > 0)}
          onClick={handleSpin}
          className="mt-12 bg-[#038758] hover:bg-[#026b46] mx-4 w-[calc(100%-2rem)] sm:w-auto px-16 text-white py-4 rounded-3xl font-extrabold flex items-center justify-center gap-3 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-lg"
        >
          {spinning ? 'ঘুরছে...' : spinsLeft === 0 ? 'স্পিন শেষ' : !nextSpinReady ? '২ ঘণ্টা অপেক্ষা করুন' : 'স্পিন করুন'}
        </button>
      </div>
    </div>
  );
}
