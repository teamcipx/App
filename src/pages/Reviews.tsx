import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { ArrowLeft, Loader2, MessageSquare, Image as ImageIcon, Send, X, CheckCircle, BadgeCheck } from 'lucide-react';
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
    <div className="p-4 max-w-lg mx-auto relative min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6 pt-2">
        <button onClick={() => navigate('/')} className="p-2 bg-slate-900 border border-slate-800 rounded-full text-slate-300 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <MessageSquare className="w-4 h-4" /> Write Review
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Payment Proofs & Reviews</h1>
        <p className="text-slate-400 text-sm">See what other users are saying about xN Coin!</p>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-500">
              No reviews yet. Be the first to share your experience!
            </div>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-400">
                    {review.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      {review.name}
                      {review.name.toLowerCase() === 'admin' && (
                        <BadgeCheck className="w-4 h-4 text-blue-400" />
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(review.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="text-slate-300 text-sm mb-3 whitespace-pre-wrap">{review.text}</p>
                {review.image_url && (
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    <img src={review.image_url} alt="Review attachment" className="w-full h-auto object-cover max-h-64" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <h3 className="font-bold text-white">Write a Review</h3>
              <button disabled={uploading} onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 flex flex-col overflow-y-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-1">Your Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder={isAdmin ? "Name (Admin can fake)" : (WebApp?.initDataUnsafe?.user?.first_name || 'Anonymous')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-400 mb-1">Your Experience</label>
                <textarea 
                  required
                  value={newReview} 
                  onChange={(e) => setNewReview(e.target.value)} 
                  placeholder="Tell us what you think..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 h-28 resize-none"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-400 mb-2">Attach Payment Proof (Optional)</label>
                
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover" />
                    <button 
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full bg-slate-950 border border-slate-800 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors"
                  >
                     <ImageIcon className="w-6 h-6 mb-2 opacity-50" />
                     <span className="text-sm font-medium">Upload Image</span>
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
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
              >
                {uploading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
                ) : (
                  <><Send className="w-5 h-5" /> Post Review</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
