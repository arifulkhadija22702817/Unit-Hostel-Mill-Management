import React, { useState } from 'react';
import { Utensils, ClipboardCheck, Users, Wallet, ShoppingCart, Palette, ChevronDown, Check, History, LogOut, CreditCard } from 'lucide-react';
import { ThemeType } from '../types';

import { UserRole } from './RoleAccessModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentTheme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  currentRole: UserRole;
  currentMemberName?: string;

  onOpenRoleModal: (tab?: 'login' | 'management' | 'logs' | 'settings') => void;
  onOpenATMModal?: () => void;
  onLogout?: () => void;
  isRealtimeSynced: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTheme,
  setTheme,
  currentRole,
  currentMemberName,
  onOpenRoleModal,
  onOpenATMModal,
  onLogout,
  isRealtimeSynced,
}) => {
  const tabs = [
    { id: 'mill', label: 'মিলের হিসাব', shortLabel: 'মিল', icon: Utensils },
    { id: 'attendance', label: 'হাজিরা শীট', shortLabel: 'হাজিরা', icon: ClipboardCheck },
    { id: 'guest', label: 'গেস্ট মিল', shortLabel: 'গেস্ট', icon: Users },
    { id: 'deposit', label: 'জমা ও ধার', shortLabel: 'জমা', icon: Wallet },
    { id: 'bazar', label: 'বাজার হিসাব', shortLabel: 'বাজার', icon: ShoppingCart },
  ];

  const themes: { id: ThemeType; label: string; colorClass: string }[] = [
    { id: 'light', label: 'লাইট', colorClass: 'bg-emerald-500' },
    { id: 'dark', label: 'ক্লাসিক ডার্ক', colorClass: 'bg-slate-900 border border-slate-600' },
    { id: 'dark-purple', label: 'ডার্ক + পার্পল', colorClass: 'bg-purple-950 border border-purple-500' },
    { id: 'dark-green', label: 'ডার্ক + গ্রিন', colorClass: 'bg-emerald-950 border border-emerald-500' },
    { id: 'blue', label: 'ব্লু', colorClass: 'bg-blue-600' },
    { id: 'green', label: 'গ্রিন', colorClass: 'bg-green-600' },
    { id: 'purple', label: 'পার্পল', colorClass: 'bg-purple-600' },
    { id: 'pink', label: 'পিংক', colorClass: 'bg-gradient-to-r from-fuchsia-500 to-pink-500' },
  ];

  const headerGradientMap: { [key in ThemeType]: string } = {
    light: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700',
    dark: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800',
    'dark-purple': 'bg-gradient-to-r from-purple-950 via-slate-950 to-purple-950 border-b border-purple-900',
    'dark-green': 'bg-gradient-to-r from-emerald-950 via-slate-950 to-emerald-950 border-b border-emerald-900',
    blue: 'bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900',
    green: 'bg-gradient-to-r from-emerald-700 via-green-700 to-teal-800',
    purple: 'bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900',
    pink: 'bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600',
  };

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const activeThemeObj = themes.find(t => t.id === currentTheme) || themes[0];

  return (
    <>
      {/* Top Header */}
      <header className={`sticky top-0 z-40 text-white shadow-md transition-all duration-300 ${headerGradientMap[currentTheme]}`}>
        <div className="max-w-7xl mx-auto px-3 py-2.5 sm:px-4 flex items-center justify-between gap-2">
          
          {/* Logo & App Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-md flex items-center justify-center bg-emerald-700/80 ring-2 ring-white/40 shrink-0">
              <img 
                src="/icon-192.png" 
                alt="মেস হিসাব" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/icon.svg';
                }}
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight drop-shadow-xs flex items-center gap-1">
                মিল ম্যানেজমেন্ট
              </h1>
              
            </div>
          </div>

          {/* Right Header Controls: Admin, Realtime Badge, Install App & Theme Selector */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Realtime Badge */}
            <div
              className={`hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${
                isRealtimeSynced
                  ? 'bg-emerald-950/60 text-emerald-200 border-emerald-400/40'
                  : 'bg-amber-950/60 text-amber-200 border-amber-400/40 animate-pulse'
              }`}
              title={isRealtimeSynced ? 'রিয়েলটাইম ফায়ারবেস ডেটাবেজ যুক্ত আছে' : 'সংযোগ তৈরি করা হচ্ছে...'}
            >
              <span className={`w-2 h-2 rounded-full ${isRealtimeSynced ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              <span>{isRealtimeSynced ? 'লাইভ' : 'কানেক্ট হচ্ছে...'}</span>
            </div>

            {/* 3D ATM Card Launcher Button - Primary way to unlock Editor/Admin */}
            {onOpenATMModal && (
              <button
                type="button"
                onClick={onOpenATMModal}
                className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold px-2.5 sm:px-3 py-1.5 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer ring-1 ring-cyan-300/40"
                title="৩D ATM কার্ড ও পিন দিয়ে এডিটর/এডমিন মোডে প্রবেশ করুন"
              >
                <CreditCard className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black whitespace-nowrap">ATM 3D পাঞ্চ</span>
              </button>
            )}

            {/* Current Role Badge (Only opens role modal if authenticated as admin or editor) */}
            {currentRole !== 'viewer' ? (
              <button
                onClick={() => onOpenRoleModal('login')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-xs cursor-pointer active:scale-95 relative ${
                  currentRole === 'admin'
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-200'
                    : currentRole === 'editor'
                    ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 ring-2 ring-emerald-200'
                    : 'bg-sky-400 text-slate-950 hover:bg-sky-300 ring-2 ring-sky-200'
                }`}
                title="ব্যবহারকারী ভূমিকা"
              >
                <span className="text-xs sm:text-sm">
                  {currentRole === 'admin' ? '👑' : currentRole === 'editor' ? '✏️' : '👤'}
                </span>
                <span className="text-[11px] sm:text-xs font-extrabold whitespace-nowrap max-w-[80px] sm:max-w-[120px] truncate">
                  {currentRole === 'admin'
                    ? 'এডমিন প্যানেল'
                    : currentRole === 'editor'
                    ? (currentMemberName || 'এডিটর')
                    : (currentMemberName || 'সদস্য')}
                </span>
              </button>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                <span>👁️</span>
                <span>ভিউ মোড</span>
              </span>
            )}

            {/* Logout / Exit Role Button (Only shown when user is logged in: admin, editor, member) */}
            {onLogout && currentRole !== 'viewer' && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black px-2.5 sm:px-3 py-1.5 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer ring-2 ring-white/40"
                title="লগআউট করে ভিউ মোডে ফিরে যান"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] sm:text-xs font-black tracking-wide">লগআউট</span>
              </button>
            )}

            {/* Activity History Button */}
            <button
              onClick={() => onOpenRoleModal('logs')}
              className="flex items-center gap-1 bg-black/20 hover:bg-black/40 text-white font-bold px-2 py-1.5 sm:px-2.5 rounded-xl text-xs backdrop-blur-md border border-white/20 transition-all active:scale-95 cursor-pointer shadow-xs"
              title="লাইভ আপডেট ও অ্যাক্টিভিটি হিস্ট্রি দেখুন"
            >
              <History className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="text-[11px] font-bold">হিস্ট্রি</span>
            </button>

            {/* Dropdown Theme Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center gap-1 bg-black/30 hover:bg-black/50 text-white font-bold p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95"
                title="থিম পরিবর্তন করুন"
              >
                <Palette className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className={`w-2.5 h-2.5 rounded-full ${activeThemeObj.colorClass} shrink-0`} />
                <span className="hidden md:inline text-[11px] font-semibold">{activeThemeObj.label}</span>
                <ChevronDown className={`w-3 h-3 text-white/80 transition-transform ${isThemeOpen ? 'rotate-180' : ''} shrink-0`} />
              </button>

              {isThemeOpen && (
                <>
                  {/* Backdrop overlay for closing */}
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsThemeOpen(false)} 
                  />
                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-1.5 w-44 sm:w-48 max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 mb-1">
                      <span>থিম নির্বাচন করুন</span>
                      <Palette className="w-3 h-3 text-emerald-500" />
                    </div>
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTheme(t.id);
                          setIsThemeOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                          currentTheme === t.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full shadow-xs ${t.colorClass}`} />
                          <span>{t.label}</span>
                        </div>
                        {currentTheme === t.id && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Desktop / Tablet Tab Navigation Bar */}
        <div className="hidden md:flex max-w-7xl mx-auto px-4 gap-1 border-t border-white/10 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-xl transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-emerald-400 shadow-sm border-t-2 border-emerald-500'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Bottom Floating Mobile Tab Bar (Tabs Only: Mill, Attendance, Guest, Deposit, Bazar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-lg px-1 py-1.5 flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 scale-105'
                  : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
              <span className="text-[10px] tracking-tight">{tab.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};
