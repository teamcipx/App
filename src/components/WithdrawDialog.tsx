import React, { useState } from 'react';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';

const METHODS = [
  { id: 'bkash', name: 'bKash' },
  { id: 'nagad', name: 'Nagad' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'binance', name: 'Binance' },
];

export default function WithdrawDialog({ 
  open, 
  onClose, 
  user,
  settings,
  onSuccess
}: { 
  open: boolean, 
  onClose: () => void, 
  user: any,
  settings: any,
  onSuccess: () => void
}) {
  const [method, setMethod] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amt = parseInt(amount);
    
    if (!method || !details || !amt) {
      setError('Please fill in all fields');
      return;
    }
    
    if (amt < settings.min_withdraw) {
      setError(`Minimum withdrawal is ${settings.min_withdraw} coins`);
      return;
    }
    
    if (amt > user.balance) {
      setError('Insufficient balance');
      return;
    }

    setLoading(true);
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

      onSuccess();
      onClose();
    } catch (e) {
      setError('Failed to submit withdrawal request.');
    }
    setLoading(false);
  };

  const calculatedValue = parseInt(amount) * (settings?.coin_rate || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-50/80 backdrop-blur-sm">
      <div className="bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Withdraw Funds</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 bg-slate-800 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-500 mb-2">Select Method</label>
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`py-3 px-4 rounded-xl font-medium transition-colors border ${
                    method === m.id 
                    ? 'bg-[#038758] border-[#038758] text-slate-800 shadow-[0_0_15px_rgba(79,70,229,0.3)]' 
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-500 mb-2">Withdraw Amount (Coins)</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder={`Min ${settings?.min_withdraw || 0}`}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#038758] font-mono"
              />
              <button 
                type="button" 
                onClick={() => setAmount(user.balance.toString())}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-[#038758]/10 text-[#038758] px-2 py-1 rounded font-medium hover:bg-[#038758]/20"
              >
                MAX
              </button>
            </div>
            {amount && !isNaN(parseInt(amount)) && (
              <p className="text-xs text-[#038758] mt-2 font-mono flex items-center gap-1">
                You will receive ~ {calculatedValue.toFixed(2)} USD
              </p>
            )}
            <p className="text-xs text-slate-500 mt-2 font-medium">1 USD = 121 ৳</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-500 mb-2">Account Details</label>
            <input
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={method === 'binance' ? "Binance Pay ID / Email" : "Phone Number"}
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
            disabled={loading}
            className="w-full bg-[#038758] hover:bg-[#026b46] text-white disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                Confirm Withdraw <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
