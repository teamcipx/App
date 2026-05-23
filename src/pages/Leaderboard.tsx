import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Trophy, Users, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';

export default function Leaderboard() {
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<any[]>([]);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
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

  return (
    <div className="p-4 max-w-lg mx-auto relative min-h-screen">
      <div className="flex items-center gap-3 mb-8 pt-2">
        <button 
          onClick={() => navigate('/')}
          className="p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Referral Leaderboard
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
           <div className="p-6 text-center border-b border-slate-800 bg-slate-900/50">
             <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-3" />
             <h2 className="text-xl font-bold text-white">Top Referrers</h2>
             <p className="text-sm text-slate-400 mt-1">Invite friends to climb the leaderboard!</p>
           </div>
           
           <div className="divide-y divide-slate-800/50">
             {leaders.length === 0 ? (
               <div className="p-8 text-center text-slate-500">
                 No referrals yet. Be the first!
               </div>
             ) : (
               leaders.map((leader, index) => (
                 <div key={leader.id} className={`p-4 flex items-center gap-4 ${leader.id === telegramId ? 'bg-indigo-500/10' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      index === 1 ? 'bg-slate-400/20 text-slate-300' :
                      index === 2 ? 'bg-amber-700/20 text-amber-600' :
                      'bg-slate-800 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1">
                      <p className="font-bold text-white flex items-center gap-2">
                        {leader.id === telegramId ? 'You' : `User ${leader.id.toString().slice(0, 4)}...`}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1.5 rounded-xl">
                      <Users className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-indigo-400">{leader.count}</span>
                    </div>
                 </div>
               ))
             )}
           </div>
        </div>
      )}
    </div>
  );
}
