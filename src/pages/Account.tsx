import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Users, Copy, ArrowLeft, Loader2, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Account() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [referrals, setReferrals] = useState(0);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const telegramUser = WebApp?.initDataUnsafe?.user;
  const telegramId = telegramUser?.id || 7360769822; // Fallback for dev
  const userName = telegramUser ? `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim() : 'Guest User';
  const botName = import.meta.env.VITE_BOT_NAME || 'xnearnbot'; // Make sure this env var exists or fallback
  
  useEffect(() => {
    fetchData();
  }, [telegramId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
      if (userData) {
        setUser(userData);
      }
      
      // Get referrals list
      const { data: refs } = await supabase.from('users').select('telegram_id, created_at').eq('referred_by', telegramId).order('created_at', { ascending: false });
      
      if (refs) {
        setReferredUsers(refs);
        setReferrals(refs.length);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = `https://t.me/${botName}?start=${telegramId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/')} className="p-2 bg-slate-900 rounded-full text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">Account & Referrals</h1>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 shadow-xl text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)] mb-4">
          <User className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">{userName}</h2>
        <p className="text-slate-400 text-sm mb-1">Telegram ID</p>
        <p className="text-lg font-mono text-indigo-400 mb-6">{telegramId}</p>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6">
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Total Referrals</p>
            <p className="text-2xl font-bold tracking-tight text-white">{referrals}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs font-medium mb-1">Reward Per Invite</p>
            <p className="text-2xl font-bold tracking-tight text-indigo-400">500 <span className="text-sm">xNC</span></p>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Invite Friends</h2>
        <p className="text-slate-400 text-sm mb-6">
          Share your referral link with your friends. You both will get 500 Coins! Plus, you'll earn 10% commission when they withdraw.
        </p>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <span className="font-mono text-xs text-slate-300 truncate">{referralLink}</span>
          <button 
            onClick={copyLink}
            className={`p-2 rounded-xl transition-colors shrink-0 ${copied ? 'bg-green-500/20 text-green-400' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
          >
            {copied ? <span className="text-xs font-bold px-2">Copied!</span> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {referredUsers.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4">Your Referrals</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {referredUsers.map((ref, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-slate-300">ID: {ref.telegram_id}</p>
                  <p className="text-xs text-slate-500 mt-1">Joined: {new Date(ref.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-2 py-1 rounded-lg">
                  +500
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
