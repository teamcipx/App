import React, { useState } from 'react';
import { X, Gift, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function PromoDialog({ 
  isOpen, 
  onClose,
  onSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSuccess: (amount: number) => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    try {
      const upperCode = code.trim().toUpperCase();

      // Check if code exists and is active
      const { data: promoData, error: promoErr } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', upperCode)
        .eq('is_active', true)
        .single();
      
      if (promoErr || !promoData) {
        toast.error('ভুল বা মেয়াদোত্তীর্ণ প্রোমো কোড!');
        setLoading(false);
        return;
      }

      if (promoData.current_uses >= promoData.max_uses) {
        toast.error('এই প্রোমো কোডটির ব্যবহার শেষ হয়ে গেছে!');
        setLoading(false);
        return;
      }

      // Check if user already used it
      const { data: userPromoData } = await supabase
        .from('user_promos')
        .select('id')
        .eq('telegram_id', telegramId)
        .eq('promo_id', promoData.id)
        .single();

      if (userPromoData) {
        toast.error('আপনি ইতিমধ্যে এই প্রোমো কোডটি ব্যবহার করেছেন!');
        setLoading(false);
        return;
      }

      // Record usage and give reward
      const { error: insertErr } = await supabase
        .from('user_promos')
        .insert([{ telegram_id: telegramId, promo_id: promoData.id }]);

      if (insertErr) {
        toast.error('দয়া করে আবার চেষ্টা করুন।');
        setLoading(false);
        return;
      }

      // Increment uses in promo_codes table
      await supabase
        .from('promo_codes')
        .update({ current_uses: promoData.current_uses + 1 })
        .eq('id', promoData.id);

      // Add balance to user
      const { data: userRes } = await supabase
        .from('users')
        .select('balance')
        .eq('telegram_id', telegramId)
        .single();
      
      if (userRes) {
        await supabase
          .from('users')
          .update({ balance: userRes.balance + promoData.reward })
          .eq('telegram_id', telegramId);
        
        onSuccess(promoData.reward);
        toast.success(`অভিনন্দন! আপনি ${promoData.reward} পয়েন্ট পেয়েছেন।`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      toast.error('কোড ক্লেইম করতে ব্যর্থ হয়েছে!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-500 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-800 p-1.5 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-6 mt-2">
          <div className="w-16 h-16 bg-[#038758]/10 text-[#038758] rounded-full flex items-center justify-center mb-4 border border-[#038758]/20 shadow-inner">
            <Gift className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center">প্রোমো কোড ব্যবহার করুন</h2>
          <p className="text-slate-400 text-sm mt-1">আপনার প্রোমো কোড এখানে দিন ও রিওয়ার্ড জিতুন</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="কোড লিখুন..."
              className="w-full bg-slate-950 border border-slate-700/50 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-[#038758] text-center font-bold tracking-wider uppercase text-lg shadow-inner"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="w-full bg-gradient-to-r from-[#038758] to-[#038758] hover:from-[#038758] hover:to-[#038758] text-white font-bold py-3.5 rounded-2xl transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'ক্লেইম করুন'}
          </button>
        </form>
      </div>
    </div>
  );
}
