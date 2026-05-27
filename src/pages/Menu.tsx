import React from "react";
import { Link } from "react-router-dom";
import {
  User,
  Trophy,
  History,
  Star,
  Search as Dices,
  Gift,
  ArrowRight,
} from "lucide-react";
import WebApp from "@twa-dev/sdk";

export default function Menu() {
  const telegramId = WebApp?.initDataUnsafe?.user?.id || 7360769822;

  // Let's assume admin if 7360769822 for show in menu
  const isAdmin = telegramId.toString() === "7360769822";

  const menuItems = [
    {
      name: "আমার প্রোফাইল",
      path: "/account",
      icon: User,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      name: "লিডারবোর্ড",
      path: "/leaderboard",
      icon: Trophy,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      name: "উইথড্র হিস্ট্রি",
      path: "/history",
      icon: History,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      name: "রিভিউ",
      path: "/reviews",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
    },
    {
      name: "স্পিন করুন",
      path: "/spin",
      icon: Dices,
      color: "text-pink-500",
      bg: "bg-pink-50",
    },
    {
      name: "স্ক্র্যাচ কার্ড",
      path: "/scratch",
      icon: Gift,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="p-4 relative min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">
          মেনু
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {menuItems.map((item, idx) => (
          <Link
            key={idx}
            to={item.path}
            className="bg-white border text-center border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm transition-transform active:scale-95"
          >
            <div
              className={`w-12 h-12 rounded-full ${item.bg} ${item.color} flex items-center justify-center mb-3`}
            >
              <item.icon className="w-6 h-6" />
            </div>
            <span className="text-slate-700 font-bold text-sm tracking-tight">
              {item.name}
            </span>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Link
          to="/admin"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-transform active:scale-95"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-red-700 font-bold">অ্যাডমিন প্যানেল</h2>
              <p className="text-red-500 text-xs">Manage your application</p>
            </div>
          </div>
          <ArrowRight className="text-red-400 w-5 h-5" />
        </Link>
      )}
    </div>
  );
}
