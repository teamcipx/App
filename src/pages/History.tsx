import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { History as HistoryIcon, ArrowLeft, Loader2, ListTodo, Wallet, Clock, CheckCircle, XCircle, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function History() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'earnings'>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any[]>([]);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const wRes = await supabase.from('withdrawals').select('*').eq('telegram_id', telegramId).order('created_at', { ascending: false });
      if (wRes.data && !wRes.error) setWithdrawals(wRes.data);

      const utRes = await supabase.from('user_tasks').select('id, last_completed, tasks(title, reward)').eq('telegram_id', telegramId).order('last_completed', { ascending: false });
      const adRes = await supabase.from('ad_history').select('*').eq('telegram_id', telegramId).order('created_at', { ascending: false });
      
      let allEarnings: any[] = [];
      
      if (utRes.data && !utRes.error) {
         const formattedTasks = utRes.data.map(t => ({
           id: `task_${t.id}`,
           title: (t.tasks as any)?.title || 'Unknown Task',
           reward: (t.tasks as any)?.reward || 0,
           date: t.last_completed,
           type: 'task'
         }));
         allEarnings = [...allEarnings, ...formattedTasks];
      }

      if (adRes.data && !adRes.error) {
         const formattedAds = adRes.data.map(a => ({
           id: `ad_${a.id}`,
           title: 'Watched Ad',
           reward: a.reward_amount,
           date: a.created_at,
           type: 'ad'
         }));
         allEarnings = [...allEarnings, ...formattedAds];
      }

      // Sort by date descending
      allEarnings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEarnings(allEarnings);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button onClick={() => navigate('/')} className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HistoryIcon className="w-6 h-6 text-indigo-400" /> History
        </h1>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-6">
        <button 
          onClick={() => setActiveTab('withdrawals')}
          className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === 'withdrawals' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <Wallet className="w-4 h-4" /> Withdrawals
        </button>
        <button 
          onClick={() => setActiveTab('earnings')}
          className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-colors ${activeTab === 'earnings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
        >
          <ListTodo className="w-4 h-4" /> Task Earnings
        </button>
      </div>

      <div className="space-y-4">
        {activeTab === 'withdrawals' && (
          <>
            {withdrawals.length === 0 && (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl">
                <Wallet className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No withdrawals yet.</p>
              </div>
            )}
            {withdrawals.map(w => (
              <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                 <div>
                    <p className="text-white font-bold">{w.amount} Coins</p>
                    <p className="text-slate-500 text-xs mt-1">{new Date(w.created_at).toLocaleString()}</p>
                    <p className="text-slate-400 text-xs mt-1 break-all">To: {w.withdrawal_address}</p>
                 </div>
                 <div className="text-right">
                    {w.status === 'pending' && <span className="flex items-center gap-1 text-yellow-500 text-xs font-bold bg-yellow-500/10 px-2 py-1 rounded-lg"><Clock className="w-3 h-3"/> Pending</span>}
                    {w.status === 'approved' && <span className="flex items-center gap-1 text-green-500 text-xs font-bold bg-green-500/10 px-2 py-1 rounded-lg"><CheckCircle className="w-3 h-3"/> Approved</span>}
                    {w.status === 'rejected' && <span className="flex items-center gap-1 text-red-500 text-xs font-bold bg-red-500/10 px-2 py-1 rounded-lg"><XCircle className="w-3 h-3"/> Rejected</span>}
                 </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'earnings' && (
          <>
            {earnings.length === 0 && (
              <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl">
                <ListTodo className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">No earnings yet.</p>
              </div>
            )}
            {earnings.map(earn => {
              return (
                <div key={earn.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center justify-between">
                   <div className="flex-1">
                      <p className="text-white font-bold flex items-center gap-2">
                        {earn.type === 'ad' ? (
                          <Play className="w-4 h-4 text-purple-400"/>
                        ) : (
                          <ListTodo className="w-4 h-4 text-indigo-400"/>
                        )}
                        {earn.title}
                      </p>
                      <p className="text-slate-500 text-xs mt-1">{new Date(earn.date).toLocaleString()}</p>
                   </div>
                   <div className="text-right">
                      <span className="text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded-lg">+{earn.reward} Coins</span>
                   </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
