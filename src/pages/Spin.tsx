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
      toast.error('You reached your daily limit of 4 spins.');
      return;
    }

    const now = Date.now();
    const timeSinceLastSpin = now - (user.customState.lastSpinTime || 0);
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    
    if (timeSinceLastSpin < TWO_HOURS && user.customState.spinsToday > 0) {
      const msLeft = TWO_HOURS - timeSinceLastSpin;
      const minsLeft = Math.ceil(msLeft / (1000 * 60));
      toast.error(`Please wait ${minsLeft} minutes before spinning again.`);
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
       toast.success(`You won ${reward} coins!`);
       setSpinning(false);
    }, 4000);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

  const spinsLeft = 4 - (user?.customState?.spinsToday || 0);
  const nextSpinReady = (Date.now() - (user?.customState?.lastSpinTime || 0)) >= 2 * 60 * 60 * 1000 || user?.customState?.spinsToday === 0;

  return (
    <div className="p-4 max-w-lg mx-auto relative min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-8 pt-2">
        <button onClick={() => navigate('/')} className="p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-indigo-400 font-bold">
          {user?.balance || 0} xNC
        </div>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">Daily Spin</h1>
        <p className="text-slate-400 text-sm">Spin to win up to 200 coins.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
           <span className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">Spins Left: <span className="text-white">{spinsLeft}</span></span>
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
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-slate-900 border-2 border-indigo-400 rounded-full z-10 shadow-lg"></div>
          </div>
        </div>

        <button 
          disabled={spinning || spinsLeft === 0 || (!nextSpinReady && spinsLeft > 0)}
          onClick={handleSpin}
          className="mt-12 bg-indigo-600 w-full sm:w-auto px-16 hover:bg-indigo-500 text-white p-4 rounded-3xl font-bold flex items-center justify-center gap-3 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
        >
          {spinning ? 'Spinning...' : spinsLeft === 0 ? 'No Spins Left' : !nextSpinReady ? 'Wait 2 Hours' : 'SPIN NOW'}
        </button>
      </div>
    </div>
  );
}
