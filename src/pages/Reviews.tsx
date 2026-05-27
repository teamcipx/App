import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft, Loader2, MessageSquare, Image as ImageIcon, Send, X, BadgeCheck, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Reviews() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newReview, setNewReview] = useState('');
  const [newName, setNewName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [imgbbKeys, setImgbbKeys] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const navigate = useNavigate();
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;
  const isAdmin = telegramId === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822);

  useEffect(() => {
    fetchReviews();
    
    const channel = supabase.channel('reviews_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, () => {
        fetchReviews();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [telegramId, isAdmin]);

  const fetchReviews = async () => {
    try {
      const [revRes, imgRes] = await Promise.all([
        supabase.from('reviews').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('url').eq('title', 'SYSTEM_IMGBB_KEYS').single()
      ]);

      if (imgRes.data && imgRes.data.url) {
        setImgbbKeys(imgRes.data.url.split(',').map((k: string) => k.trim()));
      }

      if (revRes.data) {
        // Users can see their own post + all admin posts
        // Admins can see all posts
        let visibleReviews = revRes.data;
        if (!isAdmin) {
          visibleReviews = revRes.data.filter(r => r.telegram_id === telegramId || r.is_admin_post);
        }
        
        // Shuffle the reviews
        visibleReviews = visibleReviews.sort(() => Math.random() - 0.5);
        
        setReviews(visibleReviews);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.trim()) return;

    if (imgbbKeys.length === 0 && selectedImage) {
      toast.error('Image upload is not configured.');
      return;
    }

    setUploading(true);
    let uploadedUrl = null;

    if (selectedImage) {
      const formData = new FormData();
      formData.append('image', selectedImage);
      
      let success = false;
      for (const key of imgbbKeys) {
        try {
          const response = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          if (data.success) {
            success = true;
            uploadedUrl = data.data.url;
            break;
          }
        } catch (err) {
          console.error('ImgBB upload error with key:', key, err);
        }
      }

      if (!success) {
        toast.error('Failed to upload image.');
        setUploading(false);
        return;
      }
    }

    let finalName = newName.trim();
    if (!finalName) {
      finalName = WebApp?.initDataUnsafe?.user?.first_name || 'Anonymous';
    }

    try {
      await supabase.from('reviews').insert([{
        telegram_id: telegramId,
        name: finalName,
        text: newReview.trim(),
        image_url: uploadedUrl,
        is_admin_post: isAdmin
      }]);
      
      toast.success('Review posted successfully!');
      setShowModal(false);
      setNewReview('');
      setNewName('');
      removeImage();
    } catch(err) {
      console.error(err);
      toast.error('Failed to post review.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto relative min-h-screen flex flex-col pt-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/')} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-[#038758] hover:bg-[#026c46] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-md shadow-[#038758]/20 transition-transform active:scale-95"
        >
          <MessageSquare className="w-4 h-4" /> রিভিউ দিন
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-2">রিভিউ এবং প্রুফ</h1>
        <div className="flex items-center justify-between">
          <p className="text-slate-500 font-medium">আমাদের ইউজারদের মতামতগুলো দেখুন</p>
          {!loading && (
            <div className="bg-emerald-100/80 border border-emerald-200 text-[#038758] px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              {reviews.length} রিভিউ
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#038758]" />
        </div>
      ) : (
        <div className="space-y-5 pb-[100px]">
          {reviews.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-10 text-center flex flex-col items-center shadow-sm">
              <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium text-lg">এখনও কোন রিভিউ নেই।</p>
              <p className="text-slate-400 text-sm mt-1">আপনিই প্রথম রিভিউ দিন!</p>
              <button 
                onClick={() => setShowModal(true)} 
                className="mt-6 text-[#038758] font-bold text-sm bg-emerald-50 px-5 py-2 rounded-full border border-emerald-100"
              >
                রিভিউ লিখুন
              </button>
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-full pointer-events-none opacity-50" />
                
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-[#038758] to-emerald-400 rounded-full flex items-center justify-center font-bold text-white shadow-md shadow-[#038758]/20 text-lg">
                    {review.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5 text-[15px]">
                      {review.name}
                      {review.name.toLowerCase() === 'admin' && (
                        <BadgeCheck className="w-4 h-4 text-[#038758] shrink-0" />
                      )}
                    </p>
                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                           <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {new Date(review.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 mb-4">
                  <p className="text-slate-600 text-[15px] leading-relaxed whitespace-pre-wrap">{review.text}</p>
                </div>
                
                {review.image_url && (
                  <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative group cursor-pointer" onClick={() => WebApp.openLink(review.image_url)}>
                    <img 
                      src={review.image_url} 
                      alt="Payment proof" 
                      className="w-full h-auto object-cover max-h-56 group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0">
          <div 
            className="absolute inset-0" 
            onClick={() => !uploading && setShowModal(false)}
          />
          <div className="bg-white p-6 pb-8 border border-slate-200 rounded-[32px] sm:rounded-3xl w-full max-w-md shadow-2xl relative animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">রিভিউ লিখুন</h3>
              <button 
                disabled={uploading} 
                onClick={() => setShowModal(false)} 
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {isAdmin && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Reviewer Name (Admin Only)</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)} 
                    placeholder="E.g. Rakib (Admin can fake)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#038758] focus:border-transparent transition-all placeholder:text-slate-400"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">আপনার মতামত</label>
                <textarea 
                  required
                  value={newReview} 
                  onChange={(e) => setNewReview(e.target.value)} 
                  placeholder="আমাদের অ্যাপ সম্পর্কে আপনার অভিজ্ঞতা কেমন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#038758] focus:border-transparent transition-all placeholder:text-slate-400 h-32 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">পেমেন্ট প্রুফ (যদি থাকে)</label>
                
                {imagePreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group">
                    <img src={imagePreview} alt="Preview" className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <button 
                         type="button"
                         onClick={removeImage}
                         className="p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                       >
                         <X className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-50 border-2 border-slate-200 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-[#038758] hover:border-[#038758] hover:bg-emerald-50 transition-all"
                  >
                     <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                       <ImageIcon className="w-5 h-5 text-slate-400" />
                     </div>
                     <span className="font-semibold text-sm">ছবি আপলোড করুন</span>
                     <span className="text-xs text-slate-400 mt-1">পেমেন্ট স্ক্রিনশট বা প্রুফ</span>
                  </button>
                )}
                
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                  className="hidden" 
                />
              </div>

              <button 
                type="submit" 
                disabled={!newReview.trim() || uploading}
                className="w-full mt-2 bg-[#038758] hover:bg-[#026c46] disabled:opacity-50 disabled:hover:bg-[#038758] disabled:cursor-not-allowed text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-lg shadow-[#038758]/20"
              >
                {uploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> আপলোড হচ্ছে...</>
                ) : (
                  <><Send className="w-5 h-5 -ml-1" /> সাবমিট করুন</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
