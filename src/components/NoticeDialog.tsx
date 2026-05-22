import React from 'react';
import { Bell, X } from 'lucide-react';

export default function NoticeDialog({ open, onClose, text }: { open: boolean, onClose: () => void, text: string }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-6 flex flex-col items-center justify-center text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
          <Bell className="w-12 h-12 mb-3 drop-shadow-md" />
          <h2 className="text-xl font-bold">Important Notice</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-300 leading-relaxed text-center">
            {text}
          </p>
          <button 
            onClick={onClose}
            className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 rounded-2xl transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
