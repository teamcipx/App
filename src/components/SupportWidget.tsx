import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [imgbbKeys, setImgbbKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    const fetchKeys = async () => {
      const { data } = await supabase.from('tasks').select('url').eq('title', 'SYSTEM_IMGBB_KEYS').single();
      if (data && data.url) {
        setImgbbKeys(data.url.split(',').map((k: string) => k.trim()));
      }
    };
    fetchKeys();
  }, []);

  useEffect(() => {
    // Subscribe to new messages globally so we can show notifications when widget is closed
    const channel = supabase
      .channel('support_messages_global')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: `telegram_id=eq.${telegramId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender === 'admin') {
           // If closed, show toast to ensure user knows
           if (!isOpen) {
             toast.success(`নতুন মেসেজ: ${payload.new.message.substring(0, 30)}...`);
           }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [telegramId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen, telegramId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imgbbKeys.length === 0) {
      toast.error('Image upload is not configured.');
      return;
    }

    setUploading(true);
    let uploadedUrl = null;
    
    const formData = new FormData();
    formData.append('image', file);
    
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

    // Check if chat is archived
    const { data: chatData } = await supabase.from('support_chats').select('status').eq('telegram_id', telegramId).single();
    
    if (chatData?.status !== 'archived') {
      await supabase.from('support_chats').upsert([{ 
        telegram_id: telegramId, 
        status: 'active',
        updated_at: new Date().toISOString()
      }], { onConflict: 'telegram_id' });
    }

    await supabase.from('support_messages').insert([{
      telegram_id: telegramId,
      sender: 'user',
      message: 'Attached Image',
      image_url: uploadedUrl
    }]);

    // Trigger timer for auto reply
    fetch('/api/support/user-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId })
    }).catch(console.error);

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    const text = newMessage;
    setNewMessage('');
    
    // Check if chat is archived
    const { data: chatData } = await supabase.from('support_chats').select('status').eq('telegram_id', telegramId).single();
    
    if (chatData?.status !== 'archived') {
      await supabase.from('support_chats').upsert([{ 
        telegram_id: telegramId, 
        status: 'active',
        updated_at: new Date().toISOString()
      }], { onConflict: 'telegram_id' });
    }

    await supabase.from('support_messages').insert([{
      telegram_id: telegramId,
      sender: 'user',
      message: text
    }]);

    // Trigger timer for auto reply
    fetch('/api/support/user-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId })
    }).catch(console.error);
  };

  if (telegramId === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822)) {
    return null; // Admins don't see this widget
  }

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 p-4 bg-[#038758] text-white rounded-full shadow-lg hover:bg-[#038758] transition-transform active:scale-95 z-50 flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-0 right-0 w-full sm:w-[350px] sm:bottom-6 sm:right-6 bg-slate-900 border-t sm:border border-slate-800 sm:rounded-2xl shadow-2xl flex flex-col z-50 h-[70vh] sm:h-[500px] animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 sm:rounded-t-2xl">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#038758]" />
                Support Chat
              </h3>
              <p className="text-xs text-slate-400 mt-1">We usually reply within a few hours.</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white p-2">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col bg-slate-950">
            {messages.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                <p className="text-slate-500 text-sm">Send us a message and we'll get back to you soon.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.sender === 'user' 
                  ? 'bg-[#038758] text-white rounded-br-sm' 
                  : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                }`}>
                  {msg.image_url && (
                    <img src={msg.image_url} alt="Attachment" className="max-w-full rounded-lg mb-2 object-cover" />
                  )}
                  <div>{msg.message}</div>
                  <div className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-white/70 text-right' : 'text-slate-400 text-left'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900 sm:rounded-b-2xl flex gap-2 items-center">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageChange} 
              className="hidden" 
            />
            <button 
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-slate-400 hover:text-[#038758] p-2 transition-colors"
            >
               {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
            </button>
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-slate-950 text-white border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#038758]"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="bg-[#038758] text-white p-2.5 rounded-xl hover:bg-[#038758] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
