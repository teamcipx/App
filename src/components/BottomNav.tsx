import { Link, useLocation } from "react-router-dom";
import {
  Home,
  ListTodo,
  History,
  Trophy,
  User,
  Wallet,
  Menu as MenuIcon,
} from "lucide-react";

export default function BottomNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  // Don't show bottom nav on admin page
  if (currentPath.startsWith("/admin")) {
    return null;
  }

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/tasks", label: "Tasks", icon: ListTodo },
    { path: "/withdraw", label: "Withdraw", icon: Wallet },
    { path: "/menu", label: "Menu", icon: MenuIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 pb-safe z-40">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center w-16 py-1 gap-1 transition-colors ${
                isActive
                  ? "text-[#038758]"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-colors ${isActive ? "bg-[#038758]/10" : ""}`}
              >
                <item.icon
                  className={`w-5 h-5 ${isActive ? "fill-current" : "fill-transparent"}`}
                />
              </div>
              <span
                className={`text-[10px] font-bold ${isActive ? "text-[#038758]" : "text-slate-500"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
