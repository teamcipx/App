import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { Users, Copy, ArrowLeft, Loader2, User, Wallet, Award, Star, Zap } from 'lucide-react';
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

  const shareText = `🎉 xN Coin-এ যোগ দিন এবং ফ্রিতে কয়েন আয় করুন!\n\nএই লিংকে ক্লিক করে এখনই ৫০০ কয়েন বোনাস পান:\n${referralLink}`;

  const copyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('🎉 xN Coin-এ যোগ দিন এবং ফ্রিতে কয়েন আয় করুন!\n\nএই লিংকে ক্লিক করে এখনই ৫০০ কয়েন বোনাস পান:')}`;
    window.open(tgUrl, '_blank');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>;
  }

  return (
    <div className="max-w-md mx-auto pt-6 px-4 bg-slate-50 min-h-screen pb-32 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/')} className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">অ্যাকাউন্ট ও রেফারেল</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 mb-6 shadow-xl text-center">
        <div className="w-20 h-20 bg-[#038758] rounded-full mx-auto flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.5)] mb-4">
          <User className="w-10 h-10 text-slate-800" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-1">{userName}</h2>
        <p className="text-slate-500 text-sm mb-1">Telegram ID</p>
        <p className="text-lg font-mono text-[#038758] mb-6">{telegramId}</p>

        <button
          onClick={() => navigate('/withdraw')}
          className="w-full bg-[#038758] hover:bg-[#026b46] text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors mb-6"
        >
          <Wallet className="w-5 h-5" />
          উত্তোলন করুন
        </button>

        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-6">
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">সর্বমোট রেফারেল</p>
            <p className="text-2xl font-bold tracking-tight text-slate-800">{referrals}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">রেফারেল বোনাস</p>
            <p className="text-2xl font-bold tracking-tight text-[#038758]">500 <span className="text-sm">xNC</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-[#038758]" /> 
          আপনার অর্জনসমূহ
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          {(() => {
            let cs = { totalAdsWatched: 0, totalWithdrawals: 0 };
            try {
              if (user?.last_ad_date) {
                cs = { ...cs, ...JSON.parse(user.last_ad_date) };
              }
            } catch(e) {}
            
            const badges = [
              {
                id: '10_ads',
                title: 'Starter',
                desc: '10 Ads Watched',
                icon: <Star className="w-6 h-6" />,
                unlocked: cs.totalAdsWatched >= 10,
                color: 'from-blue-400 to-blue-600'
              },
              {
                id: '100_ads',
                title: 'Power User',
                desc: '100 Ads Watched',
                icon: <Zap className="w-6 h-6" />,
                unlocked: cs.totalAdsWatched >= 100,
                color: 'from-purple-400 to-purple-600'
              },
              {
                id: 'first_withdraw',
                title: 'First Payout',
                desc: 'Cash Out 1x',
                icon: <Wallet className="w-6 h-6" />,
                unlocked: cs.totalWithdrawals >= 1,
                color: 'from-amber-400 to-amber-600'
              },
              {
                id: '10_refs',
                title: 'Influencer',
                desc: '10 Referrals',
                icon: <Users className="w-6 h-6" />,
                unlocked: referrals >= 10,
                color: 'from-emerald-400 to-emerald-600'
              }
            ];

            return badges.map(b => (
              <div 
                key={b.id} 
                className={`border rounded-2xl p-4 flex flex-col items-center text-center transition-all ${
                  b.unlocked 
                    ? 'border-[#038758]/30 bg-[#038758]/5 shadow-sm' 
                    : 'border-slate-200 bg-slate-50 opacity-60 grayscale'
                }`}
              >
                <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center text-white bg-gradient-to-br ${b.color}`}>
                  {b.icon}
                </div>
                <h3 className="font-bold text-slate-800 text-sm mb-1">{b.title}</h3>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{b.desc}</p>
                {b.unlocked && <div className="mt-2 bg-[#038758] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">UNLOCKED</div>}
              </div>
            ));
          })()}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl mb-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">বন্ধুদের আমন্ত্রণ জানান</h2>
        <p className="text-slate-500 text-sm mb-6">
          আপনার বন্ধুদের সাথে লিংক শেয়ার করুন। আপনারা দুজনেই ৫০০ কয়েন পাবেন! তাছাড়া তারা উত্তোলন করলে আপনি ১০% কমিশন পাবেন।
        </p>

        <div className="bg-slate-950 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4">
          <span className="font-mono text-xs text-slate-600 truncate">{referralLink}</span>
          <div className="flex gap-2">
            <button 
              onClick={copyLink}
              className={`flex-1 p-3 rounded-xl transition-colors font-bold text-sm flex justify-center items-center gap-2 ${copied ? 'bg-green-500/20 text-green-600' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
            >
              {copied ? 'কপি হয়েছে!' : <><Copy className="w-4 h-4" /> লিংক কপি করুন</>}
            </button>
            <button 
              onClick={shareTelegram}
              className="flex-1 p-3 rounded-xl transition-colors font-bold text-sm flex justify-center items-center gap-2 bg-[#0088cc] text-white hover:bg-[#0077b3]"
            >
              টেলিগ্রামে শেয়ার করুন
            </button>
          </div>
        </div>
      </div>

      {referredUsers.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-800 mb-4">আপনার রেফারেলসমূহ</h2>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {referredUsers.map((ref, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-slate-600">ID: {ref.telegram_id}</p>
                  <p className="text-xs text-slate-500 mt-1">Joined: {new Date(ref.created_at).toLocaleDateString()}</p>
                </div>
                <div className="bg-[#038758]/10 text-[#038758] text-xs font-bold px-2 py-1 rounded-lg">
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
