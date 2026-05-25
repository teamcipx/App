import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft, Loader2, Wallet, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const METHODS = [
  { id: 'nagad', name: 'Nagad' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'bkash', name: 'bKash' },
  { id: 'binance', name: 'Binance' },
];

export default function Withdraw() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [referrals, setReferrals] = useState(0);

  const [method, setMethod] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: dbUser } = await supabase.from('users').select('*').eq('telegram_id', telegramId).single();
      if (dbUser) setUser(dbUser);
      
      const { data: dbSettings } = await supabase.from('settings').select('*').single();
      if (dbSettings) setSettings(dbSettings);

      const { data: refs } = await supabase.from('users').select('telegram_id').eq('referred_by', telegramId);
      if (refs) setReferrals(refs.length);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (referrals < 5) {
      toast.error('উত্তোলন করতে হলে সর্বনিম্ন ৫টি রেফারেল থাকতে হবে।');
      setError('উত্তোলন করতে হলে সর্বনিম্ন ৫টি রেফারেল থাকতে হবে।');
      return;
    }

    const amt = parseInt(amount);
    
    if (!method || !details || !amt) {
      toast.error('অনুগ্রহ করে সব তথ্য দিন');
      setError('অনুগ্রহ করে সব তথ্য দিন');
      return;
    }
    
    if (amt < (settings?.min_withdraw || 0)) {
      toast.error(`সর্বনিন্ম উত্তোলন ${settings?.min_withdraw} coins`);
      setError(`সর্বনিন্ম উত্তোলন ${settings.min_withdraw} coins`);
      return;
    }
    
    if (amt > user.balance) {
      toast.error('পর্যাপ্ত ব্যালেন্স নেই');
      setError('পর্যাপ্ত ব্যালেন্স নেই');
      return;
    }

    setSubmitting(true);
    try {
      // Create request
      await supabase.from('withdrawals').insert([{
        telegram_id: user.telegram_id,
        method,
        details,
        amount: amt,
      }]);
      
      // Deduct balance
      await supabase.from('users')
        .update({ balance: user.balance - amt })
        .eq('telegram_id', user.telegram_id);
      
      // Give 10% to referrer if exists
      if (user.referred_by) {
        const commission = Math.floor(amt * 0.10);
        if (commission > 0) {
          try {
            const { data: referrer, error: refErr } = await supabase.from('users').select('balance').eq('telegram_id', user.referred_by).single();
            if (referrer) {
              await supabase.from('users').update({ balance: referrer.balance + commission }).eq('telegram_id', user.referred_by);
            }
          } catch(e) {
             console.error('Commission error', e);
          }
        }
      }

      toast.success('উত্তোলনের অনুরোধ গ্রহণ করা হয়েছে!');
      navigate('/');
    } catch (e) {
      toast.error('উত্তোলনের অনুরোধ পাঠাতে ব্যর্থ হয়েছে।');
      setError('উত্তোলনের অনুরোধ পাঠাতে ব্যর্থ হয়েছে।');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#038758]" /></div>;
  }

  const calculatedValue = parseInt(amount || '0') * (settings?.coin_rate || 0);

  return (
    <div className="max-w-md mx-auto pt-6 px-4 bg-slate-50 min-h-screen pb-32 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-800">ফান্ড উত্তোলন</h1>
      </div>

      <div className="bg-[#038758] rounded-[24px] p-6 text-white shadow-md relative overflow-hidden mb-6">
        <p className="text-emerald-100/90 text-[15px] font-medium mb-1">মোট ব্যালেন্স</p>
        <div className="flex items-center gap-1">
          <span className="text-5xl font-bold tracking-tight">{(user?.balance || 0).toFixed(2)}</span>
          <span className="text-2xl font-bold mt-3">xNC</span>
        </div>
      </div>

      {referrals < 5 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-6 text-sm flex items-start gap-3">
          <div className="text-xl">⚠️</div>
          <div>
            উত্তোলন করার জন্য আপনার কমপক্ষে <strong>৫টি রেফারেল</strong> থাকতে হবে।<br/>
            <span className="text-amber-700 mt-1 inline-block">বর্তমানে আছে: {referrals}টি</span>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xl mb-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-500 mb-2">পেমেন্ট মেথড নির্বাচন করুন</label>
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`py-3 px-4 rounded-xl font-medium transition-colors border ${
                    method === m.id 
                    ? 'bg-[#038758]/10 border-[#038758] text-[#038758] shadow-sm' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-500 mb-2">উত্তোলনের পরিমাণ (কয়েন)</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`সর্বনিন্ম ${settings?.min_withdraw || 0}`}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#038758] font-mono"
              />
              <button 
                type="button" 
                onClick={() => setAmount(user?.balance?.toString() || '0')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-[#038758]/10 text-[#038758] px-2 py-1 rounded font-medium hover:bg-[#038758]/20"
              >
                MAX
              </button>
            </div>
            {amount && !isNaN(parseInt(amount)) && (
              <p className="text-xs text-[#038758] mt-2 font-mono flex items-center gap-1">
                আপনি পাবেন ~ {calculatedValue.toFixed(2)} USD
              </p>
            )}
            <p className="text-xs text-slate-500 mt-2 font-medium">1 USD = 121 ৳</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-500 mb-2">অ্যাকাউন্ট নম্বর / বিস্তারিত</label>
            <input
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={method === 'binance' ? "Binance Pay ID / Email" : "ফোন নম্বর"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#038758]"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || referrals < 5}
            className="w-full bg-[#038758] hover:bg-[#026b46] text-white disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                উত্তোলন নিশ্চিত করুন <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
