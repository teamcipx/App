import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, Users, Check, X, Loader2, Save, Send, Ban, MessageSquare, Inbox, Archive } from 'lucide-react';
import WebApp from '@twa-dev/sdk';
import { toast } from 'sonner';

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [adminReply, setAdminReply] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastBtnText, setBroadcastBtnText] = useState('');
  const [broadcastBtnUrl, setBroadcastBtnUrl] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'broadcast' | 'withdraw' | 'tasks' | 'support'>('settings');

  const [chatFilter, setChatFilter] = useState<'active' | 'all'>('active');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;
  const adminId = Number(import.meta.env.VITE_ADMIN_TELEGRAM_ID || 7360769822);

  useEffect(() => {
    if (telegramId !== adminId) {
      alert('Access Denied');
      return;
    }
    fetchData();
  }, [telegramId]);

  const [imgbbKey, setImgbbKey] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: s, error: sErr } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (sErr) console.error('Error fetching settings:', sErr);
      if (s) setSettings(s);

      const { data: imgData } = await supabase.from('tasks').select('url').eq('title', 'SYSTEM_IMGBB_KEYS').single();
      if (imgData) setImgbbKey(imgData.url);

      // Fetch withdrawals
      const { data: w, error: wErr } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(50);
      if (wErr) console.error('Error fetching withdrawals:', wErr);
      if (w) setWithdrawals(w);

      // Fetch users
      const { data: u, error: uErr } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100);
      if (uErr) console.error('Error fetching users:', uErr);
      if (u) setUsers(u);

      // Fetch tasks
      const taskRes = await supabase.from('tasks').select('*').order('created_at', { ascending: false });
      if (taskRes.error) {
        if (taskRes.error.code !== 'PGRST205') console.error('Error fetching tasks:', taskRes.error);
      } else if (taskRes.data) {
        setTasks(taskRes.data);
      }

      // Fetch chats
      const chatsRes = await supabase.from('support_chats').select('*').order('updated_at', { ascending: false });
      if (chatsRes.error && chatsRes.error.code !== 'PGRST205') console.error('Error fetching chats:', chatsRes.error);
      if (chatsRes.data) setSupportChats(chatsRes.data);

    } catch (err) {
      console.error('Unexpected error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChat) {
      fetchMessages(selectedChat.telegram_id);
      
      const channel = supabase
        .channel('admin_support_messages')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `telegram_id=eq.${selectedChat.telegram_id}`
        }, (payload) => {
          setSupportMessages(prev => [...prev, payload.new]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedChat]);

  const fetchMessages = async (chatId: number) => {
    const { data } = await supabase.from('support_messages').select('*').eq('telegram_id', chatId).order('created_at', { ascending: true });
    if (data) {
      setSupportMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReply.trim() || !selectedChat) return;

    const text = adminReply;
    setAdminReply('');

    await supabase.from('support_messages').insert([{
      telegram_id: selectedChat.telegram_id,
      sender: 'admin',
      message: text
    }]);

    await supabase.from('support_chats').update({ updated_at: new Date().toISOString() }).eq('telegram_id', selectedChat.telegram_id);
  };

  const handleChatAction = async (chatId: number, status: string) => {
    await supabase.from('support_chats').update({ status }).eq('telegram_id', chatId);
    fetchData(); // Refresh list
    if (selectedChat?.telegram_id === chatId && status === 'archived') {
      setSelectedChat(null);
    }
  };


  const handleUpdateSetting = (field: string, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    await supabase.from('settings').update(settings).eq('id', 1);
    
    const { data } = await supabase.from('tasks').select('id').eq('title', 'SYSTEM_IMGBB_KEYS').single();
    if (data) {
      await supabase.from('tasks').update({ url: imgbbKey }).eq('id', data.id);
    } else {
      await supabase.from('tasks').insert([{ title: 'SYSTEM_IMGBB_KEYS', url: imgbbKey, reward: 0, wait_time: 0, is_active: false }]);
    }
    
    setSaving(false);
    toast.success('Settings saved successfully!');
  };

  const handleWithdrawalStatus = async (id: string, status: string, user_telegram_id: number, amount: number, method: string) => {
    await supabase.from('withdrawals').update({ status }).eq('id', id);
    
    if (method === 'playstore_task') {
      if (status === 'completed') {
        const { data: user } = await supabase.from('users').select('balance').eq('telegram_id', user_telegram_id).single();
        if (user) {
          await supabase.from('users').update({ balance: user.balance + amount }).eq('telegram_id', user_telegram_id);
        }
      }
    } else {
      // If rejected, refund balance
      if (status === 'rejected') {
        const { data: user } = await supabase.from('users').select('balance').eq('telegram_id', user_telegram_id).single();
        if (user) {
          await supabase.from('users').update({ balance: user.balance + amount }).eq('telegram_id', user_telegram_id);
        }
      }
    }
    
    fetchData();
  };

  const handleToggleBan = async (user_telegram_id: number, currentStatus: boolean) => {
    if (confirm(currentStatus ? 'Unban this user?' : 'Ban this user?')) {
      await supabase.from('users').update({ is_banned: !currentStatus }).eq('telegram_id', user_telegram_id);
      fetchData();
    }
  };

  const [newTask, setNewTask] = useState({ title: '', url: '', reward: 80, wait_time: 30 });
  
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.url) return WebApp.showAlert('Title and URL required');
    await supabase.from('tasks').insert([newTask]);
    setNewTask({ title: '', url: '', reward: 80, wait_time: 30 });
    fetchData();
    WebApp.showAlert('Task created!');
  };

  const handleToggleTask = async (id: string, currentStatus: boolean) => {
    await supabase.from('tasks').update({ is_active: !currentStatus }).eq('id', id);
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    if (confirm('Delete this task?')) {
      await supabase.from('tasks').delete().eq('id', id);
      fetchData();
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setSendingBroadcast(true);
    
    try {
      // Get all user telegram IDs
      const { data: allUsers } = await supabase.from('users').select('telegram_id');
      if (!allUsers) return;
      
      const ids = allUsers.map(u => u.telegram_id);
      
      const response = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: broadcastMsg,
          users: ids,
          adminId: telegramId,
          buttonText: broadcastBtnText,
          buttonUrl: broadcastBtnUrl
        }),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        WebApp.showAlert(`Message sent to ${result.successCount} users. Failed: ${result.failCount}`);
        setBroadcastMsg('');
        setBroadcastBtnText('');
        setBroadcastBtnUrl('');
      } else {
        WebApp.showAlert(`Failed: ${result.error || 'Server error'} (Status: ${response.status})`);
      }
    } catch (err: any) {
      console.error(err);
      WebApp.showAlert(`Error sending broadcast: ${err.message}`);
    } finally {
      setSendingBroadcast(false);
    }
  };

  if (telegramId !== adminId) {
    return <div className="p-8 text-center text-red-400">Unauthorized</div>;
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6 pt-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-indigo-500" /> Admin Panel
        </h1>
        <a href="/" className="text-sm font-medium text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg">Back to App</a>
      </div>

      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-none">
        <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Settings</button>
        <button onClick={() => setActiveTab('support')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'support' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 flex items-center gap-1'}`}>Inbox {supportChats.filter(c => c.status === 'active').length > 0 && <span className="w-2 h-2 rounded-full bg-red-500"></span>}</button>
        <button onClick={() => setActiveTab('tasks')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'tasks' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Tasks</button>
        <button onClick={() => setActiveTab('withdraw')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'withdraw' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Withdrawals</button>
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Users ({users.length}+)</button>
        <button onClick={() => setActiveTab('broadcast')} className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium ${activeTab === 'broadcast' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'}`}>Broadcast</button>
      </div>

      {activeTab === 'support' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl animate-in fade-in zoom-in-95 duration-200">
          {!selectedChat ? (
            <div className="p-0">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-indigo-400" /> Support Inbox
                </h2>
                <select 
                  value={chatFilter} 
                  onChange={(e) => setChatFilter(e.target.value as 'active' | 'all')}
                  className="bg-slate-950 border border-slate-800 text-sm text-slate-300 rounded-lg px-2 py-1 outline-none"
                >
                  <option value="active">Active Only</option>
                  <option value="all">All Chats</option>
                </select>
              </div>
              <div className="divide-y divide-slate-800/50">
                {supportChats.filter(c => chatFilter === 'all' || c.status === 'active').length === 0 ? (
                  <p className="p-6 text-center text-slate-500">No {chatFilter === 'active' ? 'active' : ''} chats found.</p>
                ) : (
                  supportChats.filter(c => chatFilter === 'all' || c.status === 'active').map(c => (
                    <div key={c.telegram_id} className={`p-4 flex gap-4 hover:bg-slate-800/50 transition-colors ${c.status === 'archived' ? 'opacity-50' : ''}`}>
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setSelectedChat(c)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{c.telegram_id}</span>
                          <span className="text-xs text-slate-500">{new Date(c.updated_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>{c.status}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                         {c.status === 'active' && (
                           <button onClick={() => handleChatAction(c.telegram_id, 'marked')} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors" title="Mark as Done">
                             <Check className="w-4 h-4" />
                           </button>
                         )}
                         <button onClick={() => handleChatAction(c.telegram_id, 'archived')} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Archive">
                           <Archive className="w-4 h-4" />
                         </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-[600px] bg-slate-950">
              <div className="p-4 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="font-bold text-white">Chat #{selectedChat.telegram_id}</h3>
                    <span className="text-xs text-indigo-400">{selectedChat.status}</span>
                  </div>
                </div>
                <button onClick={() => handleChatAction(selectedChat.telegram_id, 'marked')} className="text-sm border border-slate-700 hover:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-300 transition-colors">Mark Done</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {supportMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${msg.sender === 'admin' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                      {msg.image_url && (
                        <div className="mb-2">
                          <img src={msg.image_url} alt="Attachment" className="max-w-full rounded-lg object-cover cursor-pointer hover:opacity-90" onClick={() => window.open(msg.image_url, '_blank')} />
                        </div>
                      )}
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleAdminReply} className="p-4 border-t border-slate-800 bg-slate-900 flex gap-2">
                <input 
                  type="text"
                  value={adminReply}
                  onChange={e => setAdminReply(e.target.value)}
                  placeholder="Type reply..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="submit" 
                  disabled={!adminReply.trim()}
                  className="px-5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-lg font-bold text-white mb-6">App Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Daily Ad Limit</label>
              <input 
                type="number"
                value={settings?.daily_ad_limit || ''}
                onChange={e => handleUpdateSetting('daily_ad_limit', parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Coins Per Ad</label>
              <input 
                type="number"
                value={settings?.coins_per_ad || ''}
                onChange={e => handleUpdateSetting('coins_per_ad', parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Min Withdraw Amount</label>
              <input 
                type="number"
                value={settings?.min_withdraw || ''}
                onChange={e => handleUpdateSetting('min_withdraw', parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Coin to Currency Rate</label>
              <input 
                type="number"
                step="0.0001"
                value={settings?.coin_rate || ''}
                onChange={e => handleUpdateSetting('coin_rate', parseFloat(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            
            <div className="pt-4 mt-4 border-t border-slate-800">
              <label className="block text-sm font-medium text-slate-400 mb-1">ImgBB API Keys (comma separated)</label>
              <input 
                type="text" 
                value={imgbbKey} 
                onChange={(e) => setImgbbKey(e.target.value)} 
                placeholder="key1,key2"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500" 
              />
            </div>
            
            <div className="pt-4 mt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium text-slate-400">Enable Popup Notice</label>
                <button 
                  onClick={() => handleUpdateSetting('notice_active', !settings?.notice_active)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings?.notice_active ? 'bg-indigo-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${settings?.notice_active ? 'left-6.5' : 'left-0.5'}`} />
                </button>
              </div>
              {settings?.notice_active && (
                <textarea
                  value={settings?.notice_text || ''}
                  onChange={e => handleUpdateSetting('notice_text', e.target.value)}
                  placeholder="Notice message..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>
          </div>

          <button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Settings</>}
          </button>
        </div>
      )}

      {activeTab === 'withdraw' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-lg font-bold text-white mb-6">Recent Withdrawals</h2>
          
          {withdrawals.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No withdrawal requests.</p>
          ) : (
            <div className="space-y-4">
              {withdrawals.map(w => (
                <div key={w.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-xs font-mono text-slate-500">ID: {w.telegram_id}</span>
                      <h3 className="text-white font-medium capitalize mt-1 border border-slate-800 bg-slate-900 inline-block px-2 py-0.5 rounded text-sm mr-2">{w.method}</h3>
                      <span className="text-indigo-400 font-bold">{w.amount} coins</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      w.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                      w.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {w.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-slate-400 mb-4 bg-slate-900 p-2 rounded break-all">
                    {w.method === 'playstore_task' ? (
                      <div>
                        <p className="mb-2 text-indigo-400 font-medium">Screenshot Proof:</p>
                        {w.details.startsWith('http') ? (
                          <a href={w.details} target="_blank" rel="noreferrer">
                            <img src={w.details} alt="proof" className="max-w-full h-32 object-cover rounded-lg border border-slate-700" />
                          </a>
                        ) : (
                           w.details
                        )}
                      </div>
                    ) : (
                      w.details
                    )}
                  </div>
                  
                  {w.status === 'pending' && (
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleWithdrawalStatus(w.id, 'completed', w.telegram_id, w.amount, w.method)}
                        className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <Check className="w-4 h-4" /> Approve
                      </button>
                      <button 
                        onClick={() => handleWithdrawalStatus(w.id, 'rejected', w.telegram_id, w.amount, w.method)}
                        className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" /> Reject {w.method === 'playstore_task' ? '' : '& Refund'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-lg font-bold text-white mb-6">Manage Tasks</h2>
          
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-300">Add New Task</h3>
            <input type="text" placeholder="Task Title (e.g. Visit our sponsor)" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm" />
            <input type="url" placeholder="URL Link" value={newTask.url} onChange={e => setNewTask({...newTask, url: e.target.value})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm" />
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Reward Coins</label>
                <input type="number" value={newTask.reward} onChange={e => setNewTask({...newTask, reward: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Wait Time (sec)</label>
                <input type="number" value={newTask.wait_time} onChange={e => setNewTask({...newTask, wait_time: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-white text-sm" />
              </div>
            </div>
            <button onClick={handleCreateTask} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-medium text-sm">Create Task</button>
          </div>

          <div className="space-y-3">
            {tasks.map(t => (
              <div key={t.id} className={`border p-4 rounded-xl flex items-center justify-between ${t.is_active ? 'bg-slate-950 border-slate-800' : 'bg-slate-950/50 border-slate-800/50 opacity-60'}`}>
                <div className="truncate pr-4 flex-1">
                  <div className="text-white font-medium truncate">{t.title}</div>
                  <div className="text-slate-400 text-xs mt-1 truncate">{t.url}</div>
                  <div className="flex gap-3 mt-2 text-xs font-mono">
                    <span className="text-indigo-400">+{t.reward} Coins</span>
                    <span className="text-slate-500">{t.wait_time}s wait</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => handleToggleTask(t.id, t.is_active)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-white hover:bg-slate-700">
                    {t.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDeleteTask(t.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20">
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {tasks.length === 0 && <p className="text-center text-slate-500 py-4 text-sm">No tasks created yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-lg font-bold text-white mb-6">Recent Users</h2>
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.telegram_id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm font-mono text-slate-400">ID: {u.telegram_id}</div>
                  <div className="text-indigo-400 font-bold mt-1 max-w-[200px] truncate">{u.balance} Coins</div>
                  {u.is_banned && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded mt-1 inline-block">BANNED</span>}
                </div>
                <button
                  onClick={() => handleToggleBan(u.telegram_id, u.is_banned)}
                  className={`p-2 rounded-lg transition-colors ${u.is_banned ? 'bg-slate-800 text-green-400 hover:bg-slate-700' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}
                  title={u.is_banned ? 'Unban User' : 'Ban User'}
                >
                  <Ban className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <h2 className="text-lg font-bold text-white mb-2">Broadcast Message</h2>
          <p className="text-sm text-slate-400 mb-6">Send a promotional SMS to all users in Telegram.</p>
          
          <textarea
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type your promotional message here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white resize-none focus:outline-none focus:border-indigo-500 min-h-[150px] mb-4"
          />

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">Button Text (Optional)</label>
              <input 
                type="text"
                value={broadcastBtnText}
                onChange={e => setBroadcastBtnText(e.target.value)}
                placeholder="e.g. Open App"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">Button Link (Optional)</label>
              <input 
                type="text"
                value={broadcastBtnUrl}
                onChange={e => setBroadcastBtnUrl(e.target.value)}
                placeholder="e.g. https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          
          <button 
            onClick={handleSendBroadcast}
            disabled={sendingBroadcast || !broadcastMsg.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            {sendingBroadcast ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Send to All Users</>}
          </button>
        </div>
      )}

    </div>
  );
}
