import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import WebApp from '@twa-dev/sdk';
import { CheckCircle, Clock, ExternalLink, ArrowLeft, Loader2, ListTodo, Upload, Award, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { AdsgramTask } from '@adsgram/react';

export default function Tasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [imgbbKeys, setImgbbKeys] = useState<string[]>([]);
  const [activeTaskTimer, setActiveTaskTimer] = useState<{
    id: string;
    timeLeft: number;
  } | null>(null);
  const [failedTasks, setFailedTasks] = useState<string[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [uploadingTask, setUploadingTask] = useState<string | null>(null);
  const [rewardAnim, setRewardAnim] = useState<{ amount: number } | null>(null);
  const navigate = useNavigate();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822; // Fallback for dev

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeTaskTimer && activeTaskTimer.timeLeft > 0) {
      timer = setTimeout(() => {
        setActiveTaskTimer({
          ...activeTaskTimer,
          timeLeft: activeTaskTimer.timeLeft - 1,
        });
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
        toast.error(
          `আপনি খুব দ্রুত ফিরে এসেছেন! পুরো সময় ওয়েবসাইটে থাকতে হবে।`,
        );
        setFailedTasks((prev) =>
          Array.from(new Set([...prev, activeTaskTimer.id])),
        );
        setActiveTaskTimer(null);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [activeTaskTimer]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const [{ data: user }, taskRes, utRes, imgbbData] = await Promise.all([
        supabase
          .from("users")
          .select("balance")
          .eq("telegram_id", telegramId)
          .single(),
        supabase
          .from("tasks")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase.from("user_tasks").select("*").eq("telegram_id", telegramId),
        supabase
          .from("tasks")
          .select("url")
          .eq("title", "SYSTEM_IMGBB_KEYS")
          .single(),
      ]);

      if (user) setUserBalance(user.balance);

      if (imgbbData.data && imgbbData.data.url) {
        setImgbbKeys(
          imgbbData.data.url.split(",").map((k: string) => k.trim()),
        );
      }

      // If tables don't exist yet, don't crash
      if (taskRes.error && taskRes.error.code === "PGRST205") {
        console.warn("Tasks table not created yet");
      } else if (taskRes.data) {
        setTasks(
          taskRes.data.filter((t: any) => t.title !== "SYSTEM_IMGBB_KEYS"),
        );
      }

      if (utRes.error && utRes.error.code === "PGRST205") {
        console.warn("User Tasks table not created yet");
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
    const ut = userTasks.find((ut) => ut.task_id === taskId);
    if (!ut) return true;

    // Check if 24 hours have passed
    const lastCompleted = new Date(ut.last_completed).getTime();
    const now = new Date().getTime();
    const hours24 = 24 * 60 * 60 * 1000;

    return now - lastCompleted >= hours24;
  };

  const getTaskStatus = (taskId: string) => {
    const ut = userTasks.find((ut) => ut.task_id === taskId);
    if (!ut) return { status: "available", timeRemaining: 0 };

    const lastCompleted = new Date(ut.last_completed).getTime();
    const now = new Date().getTime();
    const diff = now - lastCompleted;
    const hours24 = 24 * 60 * 60 * 1000;

    if (diff >= hours24) return { status: "available", timeRemaining: 0 };
    return { status: "cooldown", timeRemaining: hours24 - diff };
  };

  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleStartTask = (task: any) => {
    if (task.title.includes("[PLAYSTORE]")) {
      setSelectedTaskId(task.id);
      fileInputRef.current?.click();
      return;
    }

    if (task.title.toUpperCase().includes("ADSGRAM")) {
      const blockId = getAdsgramBlockId(task.url);
      if (typeof window !== "undefined" && (window as any).Adsgram) {
        const AdController = (window as any).Adsgram.init({ blockId: blockId });
        AdController.show()
          .then((result: any) => {
            handleCompleteTask(task.id);
          })
          .catch((err: any) => {
            console.error("Adsgram task error:", err);
            const errorDetail =
              err && err.description ? err.description : JSON.stringify(err);
            toast.error(`Ad Error: ${errorDetail}`);
          });
      } else {
        toast.error("Ads SDK not ready yet.");
      }
      return;
    }

    if (task.title.toUpperCase().includes("ONCLICKA")) {
      const spotId = task.url && /^\d+$/.test(task.url) ? task.url : '442749';
      if (typeof window !== "undefined" && (window as any).initCdTma) {
        (window as any).initCdTma({ id: spotId })
          .then((showFn: any) => {
            return showFn();
          })
          .then(() => {
            handleCompleteTask(task.id);
          })
          .catch((err: any) => {
            console.error("OnclickA task error:", err);
            toast.error(`Ad Error: Failed to show OnclickA ad`);
          });
      } else {
        toast.error("OnclickA SDK not ready yet.");
      }
      return;
    }

    // Open URL
    if (WebApp.openLink) {
      WebApp.openLink(task.url);
    } else {
      window.open(task.url, "_blank");
    }

    // Start Timer
    setActiveTaskTimer({ id: task.id, timeLeft: task.wait_time });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTaskId) return;

    if (imgbbKeys.length === 0) {
      toast.error("ইমেজ আপলোড কনফিগার করা নেই। অ্যাডমিনকে জানান।");
      return;
    }

    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    setUploadingTask(task.id);
    const formData = new FormData();
    formData.append("image", file);

    let success = false;
    let uploadedUrl = "";

    for (const key of imgbbKeys) {
      try {
        const response = await fetch(
          `https://api.imgbb.com/1/upload?key=${key}`,
          {
            method: "POST",
            body: formData,
          },
        );
        const data = await response.json();
        if (data.success) {
          success = true;
          uploadedUrl = data.data.url;
          break;
        }
      } catch (err) {
        console.error("ImgBB upload error with key:", key, err);
      }
    }

    if (!success) {
      toast.error("ইমেজ আপলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
      setUploadingTask(null);
      return;
    }

    // Insert into withdrawals for manual review
    try {
      await supabase.from("withdrawals").insert([
        {
          telegram_id: telegramId,
          method: "playstore_task",
          details: uploadedUrl,
          amount: task.reward,
        },
      ]);

      // Add to user tasks so it goes to "cooldown"
      await supabase.from("user_tasks").insert([
        {
          telegram_id: telegramId,
          task_id: task.id,
        },
      ]);

      toast.success(
        "স্ক্রিনশট আপলোড হয়েছে! আপনার রিওয়ার্ড রিভিউর জন্য পেন্ডিং আছে।",
      );
      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error("প্রমাণ জমা দিতে ব্যর্থ হয়েছে।");
    } finally {
      setUploadingTask(null);
      setSelectedTaskId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getAdsgramBlockId = (url: string) => {
    let blockId = "task-33103";
    if (url && !url.startsWith("http")) {
      blockId = url;
    } else if (url) {
      const parts = url.split("/");
      const lastPart = parts[parts.length - 1];
      if (
        lastPart &&
        (lastPart.startsWith("task-") ||
          lastPart.startsWith("int-") ||
          lastPart.match(/^\d+$/))
      ) {
        blockId = lastPart;
      }
    }
    
    return blockId;
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Update user_tasks table
      const existingUt = userTasks.find((ut) => ut.task_id === taskId);

      if (existingUt) {
        await supabase
          .from("user_tasks")
          .update({ last_completed: new Date().toISOString() })
          .eq("id", existingUt.id);
      } else {
        await supabase.from("user_tasks").insert([
          {
            telegram_id: telegramId,
            task_id: taskId,
          },
        ]);
      }

      // Add balance directly
      const newBalance = userBalance + task.reward;
      await supabase
        .from("users")
        .update({ balance: newBalance })
        .eq("telegram_id", telegramId);

      setUserBalance(newBalance);
      setRewardAnim({ amount: task.reward });

      setTimeout(() => {
        setRewardAnim(null);
      }, 3000);

      const duration = 2000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#038758", "#4ade80", "#fbbf24"],
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#038758", "#4ade80", "#fbbf24"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      fetchTasks();
    } catch (err) {
      console.error(err);
      toast.error("টাস্ক সম্পন্ন করতে ব্যর্থ হয়েছে।");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#038758]" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto pb-8 animate-in fade-in zoom-in-95 duration-300 bg-slate-50 min-h-screen">
      <div className="bg-white border-b border-slate-100 flex items-center justify-between p-4 sticky top-0 z-10 shadow-sm mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2.5 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800">
            ডেইলি টাস্ক
          </h1>
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleImageChange}
        style={{ display: "none" }}
      />

      <div className="space-y-4 px-4">
        {tasks.map((task) => {
          const { status, timeRemaining } = getTaskStatus(task.id);
          const isActive = activeTaskTimer?.id === task.id;
          const isFailed = failedTasks.includes(task.id);

          return (
            <div
              key={task.id}
              className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden"
            >
              {isActive && (
                <div className="absolute inset-0 bg-[#038758]/10 z-0 animate-pulse"></div>
              )}
              <div className="relative z-10 flex items-start gap-4">
                <div
                  className={`p-3 rounded-2xl border ${status === "available" ? "bg-[#038758]/10 text-[#038758] border-[#038758]/20" : "bg-slate-100 text-slate-500 border-slate-200"}`}
                >
                  {status === "available" ? (
                    <ListTodo className="w-6 h-6" />
                  ) : (
                    <Clock className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-slate-800 font-bold mb-1 leading-tight">
                    {task.title.replace("[PLAYSTORE]", "").trim()}
                  </h3>
                  <div className="flex items-center gap-3 text-sm mt-1">
                    <span className="text-[#038758] font-bold bg-[#038758]/10 px-2 py-0.5 rounded-lg border border-[#038758]/20">
                      +{task.reward} xNC
                    </span>
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {task.wait_time}s
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                {status === "available" ? (
                  isActive ? (
                    <button
                      disabled
                      className="w-full bg-slate-100 text-[#038758] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" /> চেকিং...{" "}
                      {activeTaskTimer.timeLeft}s
                    </button>
                  ) : uploadingTask === task.id ? (
                    <button
                      disabled
                      className="w-full bg-slate-100 text-[#038758] py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200"
                    >
                      <Loader2 className="w-5 h-5 animate-spin" /> আপলোড
                      হচ্ছে...
                    </button>
                  ) : (
                    task.title.toUpperCase().includes("ADSGRAM") && getAdsgramBlockId(task.url).startsWith('task-') ? (
                      <AdsgramTask 
                        className="w-full block"
                        blockId={getAdsgramBlockId(task.url)} 
                        onReward={() => handleCompleteTask(task.id)} 
                        onError={(e: any) => toast.error(`Ad Error: ${e.detail || 'Failed'}`)}
                      >
                         <span slot="reward" style={{display: 'none'}}>{task.reward}</span>
                         <div slot="button" className={`w-full ${isFailed ? "bg-amber-100 border border-amber-200 text-amber-600 hover:bg-amber-200" : "bg-[#038758] hover:bg-[#026b46] text-white"} py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-sm select-none`}>
                           টাস্ক শুরু করুন <ExternalLink className="w-5 h-5 pointer-events-none" />
                         </div>
                         <div slot="claim" className={`w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-sm select-none`}>
                           রিওয়ার্ড ক্লেইম করুন 
                         </div>
                         <div slot="done" className={`w-full bg-slate-100 text-slate-500 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200 pointer-events-none select-none`}>
                           সম্পন্ন <CheckCircle className="w-5 h-5" />
                         </div>
                      </AdsgramTask>
                    ) : (
                      <button
                        onClick={() => handleStartTask(task)}
                        className={`w-full ${isFailed ? "bg-amber-100 border border-amber-200 text-amber-600 hover:bg-amber-200" : "bg-[#038758] hover:bg-[#026b46] text-white"} py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] shadow-sm`}
                      >
                        {task.title.includes("[PLAYSTORE]")
                          ? "স্ক্রিনশট আপলোড করুন"
                          : task.title.toUpperCase().includes("ADSGRAM") || task.title.toUpperCase().includes("ONCLICKA")
                            ? "অ্যাড দেখুন"
                            : isFailed
                              ? "আবার শুরু করুন"
                              : "টাস্ক শুরু করুন"}
                        {task.title.includes("[PLAYSTORE]") ? (
                          <Upload className="w-5 h-5" />
                        ) : (
                          <ExternalLink className="w-5 h-5" />
                        )}
                      </button>
                    )
                  )
                ) : (
                  <button
                    disabled
                    className="w-full bg-slate-50 text-slate-500 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <CheckCircle className="w-5 h-5 text-[#038758]" /> সম্পন্ন
                    (ফিরে আসুন {formatTimeRemaining(timeRemaining)})
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {tasks.length === 0 && (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-3xl">
            <ListTodo className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">এখনও কোনো টাস্ক নেই।</p>
          </div>
        )}
      </div>

      {/* Prominent Task Success Overlay */}
      {rewardAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center animate-in zoom-in-75 slide-in-from-bottom-5 duration-500 ease-out">
            <div className="w-24 h-24 bg-[#038758]/10 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-[#038758] rounded-full animate-ping opacity-20"></div>
              <CheckCircle className="w-12 h-12 text-[#038758] drop-shadow-md z-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">
              টাস্ক সফল!
            </h2>
            <div className="flex items-center gap-2 bg-[#038758]/10 px-5 py-2 rounded-2xl border border-[#038758]/20 text-[#038758]">
              <Coins className="w-6 h-6" />
              <span className="text-2xl font-bold">+{rewardAnim.amount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
