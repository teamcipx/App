import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Loader2, Users, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Referrals() {
  const [loading, setLoading] = useState(true);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [botName, setBotName] = useState(import.meta.env.VITE_BOT_NAME || 'xnearnbot');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const telegramUser = WebApp?.initDataUnsafe?.user;
  const telegramId = telegramUser?.id || 7360769822; // Fallback for dev

  useEffect(() => {
    fetchData();
  }, [telegramId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: bData } = await supabase.from('tasks').select('url').eq('title', 'SYSTEM_BOT_USERNAME').single();
      if (bData && bData.url) setBotName(bData.url);

      const { data: refs } = await supabase.from('users').select('telegram_id, created_at').eq('referred_by', telegramId.toString()).order('created_at', { ascending: false });
      if (refs) {
        setReferredUsers(refs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = `https://t.me/${botName}?start=${telegramId}`;

  const shareText = `🎉 xN Coin-এ যোগ দিন এবং ফ্রিতে কয়েন আয় করুন!\n\nএই লিংকে ক্লিক করে এখনই ৫০০ কয়েন বোনাস পান:\n${referralLink}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-8 px-6 max-w-md mx-auto min-h-screen pb-32">
      <div className="flex flex-col mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Referrals</h1>
        <p className="text-slate-500 font-medium mt-1">Invite friends and earn 500 xNC</p>
      </div>

      <div className="bg-slate-950 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 mb-8">
        <span className="font-mono text-xs text-slate-400 truncate">{referralLink}</span>
        <button 
          onClick={copyLink}
          className={`p-3 rounded-xl transition-colors font-bold text-sm flex justify-center items-center gap-2 ${copied ? 'bg-[#038758] text-white' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
        >
          {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Referral Link</>}
        </button>
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-4">Referral History</h2>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>
      ) : referredUsers.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500">You haven't referred anyone yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {referredUsers.map((user, i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#038758]/10 rounded-full flex items-center justify-center font-bold text-[#038758]">
                  #{i + 1}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{user.telegram_id}</p>
                  <p className="text-xs text-slate-500">Joined {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-sm font-bold text-[#038758]">+500</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
