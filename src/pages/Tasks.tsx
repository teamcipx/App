import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { CheckCircle, Clock, ExternalLink, ArrowLeft, Loader2, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function Tasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [activeTaskTimer, setActiveTaskTimer] = useState<{ id: string, timeLeft: number } | null>(null);
  const [failedTasks, setFailedTasks] = useState<string[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const navigate = useNavigate();

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822; // Fallback for dev

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTaskTimer && activeTaskTimer.timeLeft > 0) {
      timer = setTimeout(() => {
        setActiveTaskTimer({ ...activeTaskTimer, timeLeft: activeTaskTimer.timeLeft - 1 });
      }, 1000);
    } else if (activeTaskTimer && activeTaskTimer.timeLeft === 0) {
      handleCompleteTask(activeTaskTimer.id);
      setActiveTaskTimer(null);
    }
    return () => clearTimeout(timer);
  }, [activeTaskTimer]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && activeTaskTimer && activeTaskTimer.timeLeft > 1) {
        toast.error(`You returned too early! You must stay on the webpage for the full time.`);
        setFailedTasks(prev => Array.from(new Set([...prev, activeTaskTimer.id])));
        setActiveTaskTimer(null);
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeTaskTimer]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const [{ data: user }, taskRes, utRes] = await Promise.all([
        supabase.from('users').select('balance').eq('telegram_id', telegramId).single(),
        supabase.from('tasks').select('*').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('user_tasks').select('*').eq('telegram_id', telegramId)
      ]);

      if (user) setUserBalance(user.balance);
      
      // If tables don't exist yet, don't crash
      if (taskRes.error && taskRes.error.code === 'PGRST205') {
        console.warn('Tasks table not created yet');
      } else if (taskRes.data) {
        setTasks(taskRes.data);
      }

      if (utRes.error && utRes.error.code === 'PGRST205') {
         console.warn('User Tasks table not created yet');
      } else if (utRes.data) {
        setUserTasks(utRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isTaskAvailable = (taskId: string) => {
    const ut = userTasks.find(ut => ut.task_id === taskId);
    if (!ut) return true;
    
    // Check if 24 hours have passed
    const lastCompleted = new Date(ut.last_completed).getTime();
    const now = new Date().getTime();
    const hours24 = 24 * 60 * 60 * 1000;
    
    return now - lastCompleted >= hours24;
  };

  const getTaskStatus = (taskId: string) => {
    const ut = userTasks.find(ut => ut.task_id === taskId);
    if (!ut) return { status: 'available', timeRemaining: 0 };
    
    const lastCompleted = new Date(ut.last_completed).getTime();
    const now = new Date().getTime();
    const diff = now - lastCompleted;
    const hours24 = 24 * 60 * 60 * 1000;
    
    if (diff >= hours24) return { status: 'available', timeRemaining: 0 };
    return { status: 'cooldown', timeRemaining: hours24 - diff };
  };

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleStartTask = (task: any) => {
    // Open URL
    if (WebApp.openLink) {
      WebApp.openLink(task.url);
    } else {
      window.open(task.url, '_blank');
    }
    
    // Start Timer
    setActiveTaskTimer({ id: task.id, timeLeft: task.wait_time });
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Update user_tasks table
      const existingUt = userTasks.find(ut => ut.task_id === taskId);
      
      if (existingUt) {
         await supabase.from('user_tasks').update({ last_completed: new Date().toISOString() }).eq('id', existingUt.id);
      } else {
         await supabase.from('user_tasks').insert([{
           telegram_id: telegramId,
           task_id: taskId
         }]);
      }

      // Add balance
      const newBalance = userBalance + task.reward;
      await supabase.from('users').update({ balance: newBalance }).eq('telegram_id', telegramId);
      
      toast.success(`Task Completed! You earned ${task.reward} Coins.`);
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete task.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto pb-8 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6 pt-4">
        <button onClick={() => navigate('/')} className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-2xl font-bold text-white">Daily Tasks</h1>
      </div>

      <div className="space-y-4">
        {tasks.map(task => {
          const { status, timeRemaining } = getTaskStatus(task.id);
          const isActive = activeTaskTimer?.id === task.id;
          const isFailed = failedTasks.includes(task.id);

          return (
            <div key={task.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
               {isActive && (
                 <div className="absolute inset-0 bg-indigo-500/10 z-0 animate-pulse"></div>
               )}
               <div className="relative z-10 flex items-start gap-4">
                  <div className={`p-3 rounded-full ${status === 'available' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                    {status === 'available' ? <ListTodo className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold mb-1">{task.title}</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-indigo-400 font-bold">+{task.reward} Coins</span>
                      <span className="text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {task.wait_time}s limit</span>
                    </div>
                  </div>
               </div>
               
               <div className="relative z-10 mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  {status === 'available' ? (
                    isActive ? (
                      <button disabled className="w-full bg-slate-800 text-indigo-400 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Verifying... {activeTaskTimer.timeLeft}s
                      </button>
                    ) : (
                      <button onClick={() => handleStartTask(task)} className={`w-full ${isFailed ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'} text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98]`}>
                        {isFailed ? 'Resume Task' : 'Start Task'} <ExternalLink className="w-4 h-4" />
                      </button>
                    )
                  ) : (
                    <button disabled className="w-full bg-slate-950 text-slate-500 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" /> Done (Come back in {formatTimeRemaining(timeRemaining)})
                    </button>
                  )}
               </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl">
            <ListTodo className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No tasks available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
