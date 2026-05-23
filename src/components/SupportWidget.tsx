import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';

export default function SupportWidget() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  useEffect(() => {
    fetchMessages();
    // Subscribe to new messages
    const channel = supabase
      .channel('support_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: `telegram_id=eq.${telegramId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [telegramId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('telegram_id', telegramId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
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
  };

  if (telegramId === Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822)) {
    return null; // Admins don't see this widget
  }

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col h-[400px]">
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Support Chat
          </h3>
          <p className="text-xs text-slate-400 mt-1">We usually reply within a few hours.</p>
        </div>
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
              ? 'bg-indigo-600 text-white rounded-br-sm' 
              : 'bg-slate-800 text-slate-200 rounded-bl-sm'
            }`}>
              {msg.message}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-slate-900 flex gap-2">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-slate-950 text-white border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim()}
          className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
