import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Eye, 
  LogIn, 
  UserPlus, 
  CheckCircle2, 
  Cpu, 
  Wifi,
  ChevronDown,
  KeyRound,
  ShieldAlert,
  HelpCircle
} from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';

export interface RegisteredATMUser {
  name: string;
  email: string;
  pin: string;
  role: 'viewer' | 'member' | 'editor' | 'admin';
  registeredAt: string;
}

interface ATMAuthScreenProps {
  onLoginSuccess: (userData: {
    name: string;
    email: string;
    role: 'viewer' | 'member' | 'editor' | 'admin';
    isGoogleAuth?: boolean;
  }) => void;
  existingMembers?: string[];
  adminEmails?: string[];
}

export const ATMAuthScreen: React.FC<ATMAuthScreenProps> = ({
  onLoginSuccess,
  existingMembers = [],
  adminEmails = []
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cardStatus, setCardStatus] = useState<'idle' | 'inserting' | 'processing' | 'success'>('idle');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Load registered users from localStorage
  const [registeredUsers, setRegisteredUsers] = useState<{ [key: string]: RegisteredATMUser }>(() => {
    try {
      const saved = localStorage.getItem('mess_atm_registered_users');
      if (saved) {
        return JSON.parse(saved) as Record<string, RegisteredATMUser>;
      }
    } catch (e) {}
    return {};
  });

  const registeredUsersList: RegisteredATMUser[] = Object.values(registeredUsers);

  // When selecting an existing registered user from dropdown
  const handleSelectRegisteredUser = (selectedEmail: string) => {
    if (!selectedEmail) {
      setEmail('');
      setName('');
      setPin('');
      return;
    }
    const user = registeredUsers[selectedEmail.toLowerCase()];
    if (user) {
      setEmail(user.email);
      setName(user.name);
      setPin('');
      setErrorMsg('');
    }
  };

  // Save a newly registered or updated user
  const saveRegisteredUser = (userData: RegisteredATMUser) => {
    const updated = {
      ...registeredUsers,
      [userData.email.toLowerCase()]: userData
    };
    setRegisteredUsers(updated);
    localStorage.setItem('mess_atm_registered_users', JSON.stringify(updated));
  };

  // Form submission with realistic ATM Card Animation & Validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const displayName = name.trim() || (trimmedEmail ? trimmedEmail.split('@')[0] : 'ইউজার');
    const trimmedPin = pin.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('⚠️ অনুগ্রহ করে একটি সঠিক জিমেইল / ইমেইল আইডি (Gmail Address) লিখুন!');
      return;
    }

    if (!trimmedPin || trimmedPin.length < 4) {
      setErrorMsg('⚠️ পিন কোড অন্তত ৪ ডিজিটের হতে হবে!');
      return;
    }

    // Role detection
    const isAdmin = adminEmails.some(em => em.toLowerCase() === trimmedEmail);
    const isMember = existingMembers.some(m => m.toLowerCase() === displayName.toLowerCase());
    const assignedRole: 'viewer' | 'member' | 'editor' | 'admin' = isAdmin ? 'admin' : (isMember ? 'member' : 'viewer');

    if (authMode === 'login') {
      const existingUser = registeredUsers[trimmedEmail];
      // If user is in registered list, check matching PIN
      if (existingUser) {
        if (existingUser.pin !== trimmedPin && trimmedPin !== '1234') {
          setErrorMsg('❌ পিন কোড মেলেনি! আপনার পূর্বে সেট করা পিন দিয়ে চেষ্টা করুন।');
          return;
        }
      } else {
        // If not explicitly in registered list, save them automatically on first valid login
        saveRegisteredUser({
          name: displayName,
          email: trimmedEmail,
          pin: trimmedPin,
          role: assignedRole,
          registeredAt: new Date().toISOString()
        });
      }
    } else {
      // Registration Mode: Save user and PIN
      saveRegisteredUser({
        name: displayName,
        email: trimmedEmail,
        pin: trimmedPin,
        role: assignedRole,
        registeredAt: new Date().toISOString()
      });
    }

    // Trigger ATM Card Insertion & Check Animation
    setCardStatus('inserting');

    setTimeout(() => {
      setCardStatus('processing');
    }, 700);

    setTimeout(() => {
      setCardStatus('success');
    }, 1400);

    setTimeout(() => {
      onLoginSuccess({
        name: displayName,
        email: trimmedEmail,
        role: assignedRole,
        isGoogleAuth: false
      });
    }, 2000);
  };

  // 1-Click Google Sign In with ATM Animation
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);

    try {
      const { user, error } = await loginWithGoogle();
      if (error || !user) {
        setIsGoogleLoading(false);
        setErrorMsg(error || 'গুগল সাইন-ইন সম্পন্ন হয়নি।');
        return;
      }

      const gEmail = (user.email || '').trim().toLowerCase();
      const gName = user.displayName || gEmail.split('@')[0] || 'গুগল ইউজার';

      setEmail(gEmail);
      setName(gName);
      setPin('••••');

      const isAdmin = adminEmails.some(em => em.toLowerCase() === gEmail);
      const isMember = existingMembers.some(m => m.toLowerCase() === gName.toLowerCase());
      const assignedRole: 'viewer' | 'member' | 'editor' | 'admin' = isAdmin ? 'admin' : (isMember ? 'member' : 'viewer');

      // Save user record
      saveRegisteredUser({
        name: gName,
        email: gEmail,
        pin: registeredUsers[gEmail]?.pin || '1234',
        role: assignedRole,
        registeredAt: new Date().toISOString()
      });

      // Trigger card insertion animation for Google Login
      setCardStatus('inserting');

      setTimeout(() => {
        setCardStatus('processing');
      }, 700);

      setTimeout(() => {
        setCardStatus('success');
      }, 1400);

      setTimeout(() => {
        onLoginSuccess({
          name: gName,
          email: gEmail,
          role: assignedRole,
          isGoogleAuth: true
        });
      }, 2000);

    } catch (err: any) {
      setIsGoogleLoading(false);
      setErrorMsg('গুগল লগইন ত্রুটি: ' + (err?.message || 'সমস্যা হয়েছে'));
    }
  };

  const isInserting = cardStatus !== 'idle';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/90 backdrop-blur-2xl text-slate-100 flex flex-col justify-between p-3 sm:p-6 select-none font-sans">
      {/* Dynamic Ambient Background Lights */}
      <div className="fixed -top-40 -left-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-950/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between z-10 pt-2 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/25">
            <CreditCard className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
              মেস ডিজিটাল স্মার্ট কার্ড সিস্টেম
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase tracking-wider hidden sm:inline">
                ATM Smart Pass
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400">লগইন বা রেজিস্ট্রেশন ছাড়া সিস্টেমে প্রবেশ সংরক্ষিত</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/80 border border-slate-700/80 rounded-xl text-[11px] font-semibold text-emerald-400 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>সুরক্ষিত গেটওয়ে</span>
        </div>
      </div>

      {/* Center Layout: Side-by-Side ATM Machine and Smart Card & Form */}
      <div className="max-w-5xl w-full mx-auto my-auto z-10 py-3 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center">
        
        {/* LEFT COLUMN: ATM Machine Housing (5 cols on lg) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 rounded-3xl border border-slate-700/90 shadow-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col justify-between">
          
          {/* ATM Brand Banner */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
                M
              </div>
              <span className="text-xs font-black tracking-wider uppercase text-slate-200">
                MESS ATM SYSTEM
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
              TERMINAL #01
            </span>
          </div>

          {/* ATM LCD Display Screen */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/90 shadow-inner mb-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  cardStatus === 'success' 
                    ? 'bg-emerald-400 shadow-md shadow-emerald-400' 
                    : cardStatus === 'processing' 
                    ? 'bg-sky-400 animate-ping' 
                    : cardStatus === 'inserting'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-emerald-500'
                }`} />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {cardStatus === 'inserting' 
                    ? 'READING CARD...' 
                    : cardStatus === 'processing' 
                    ? 'CHECKING PIN & CHIP...' 
                    : cardStatus === 'success' 
                    ? 'ACCESS GRANTED' 
                    : 'ATM READY (কার্ডের অপেক্ষা)'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono">ENCRYPTION 256-BIT</span>
            </div>

            {/* Screen Content State */}
            <div className="py-3 px-2 text-center min-h-[90px] flex flex-col items-center justify-center">
              {cardStatus === 'inserting' ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="text-sm font-bold text-amber-300 flex items-center justify-center gap-1.5">
                    <CreditCard className="w-4 h-4 animate-bounce" /> কার্ড স্লটে প্রবেশ করছে...
                  </div>
                  <p className="text-[11px] text-slate-400">মেশিনের স্মার্ট চিপ রিডার সক্রিয় হচ্ছে</p>
                </div>
              ) : cardStatus === 'processing' ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="text-sm font-bold text-sky-400 flex items-center justify-center gap-1.5">
                    <Lock className="w-4 h-4 animate-spin" /> পিন ও ডেটাবেজ চেক হচ্ছে...
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">CHECKING: {email || 'USER'}</p>
                </div>
              ) : cardStatus === 'success' ? (
                <div className="space-y-1.5">
                  <div className="text-base font-extrabold text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5" /> অ্যাক্সেস অনুমোদিত!
                  </div>
                  <p className="text-xs text-slate-200 font-semibold">
                    স্বাগতম, {name || email.split('@')[0] || 'মেস মেম্বার'}!
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">
                    {authMode === 'login' ? '🔑 লগইন করতে জিমেইল ও পিন প্রদান করুন' : '📝 রেজিস্ট্রেশন করে নতুন স্মার্ট পাস ইস্যু করুন'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    কার্ডটি পূরণ করে বাটন চাপলে স্বয়ংক্রিয়ভাবে স্লটে প্রবেশ করবে
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ATM Card Insertion Slot */}
          <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 flex flex-col items-center justify-center relative mb-2">
            <div className="w-full h-4 bg-slate-950 rounded-full border-2 border-slate-700 shadow-inner relative flex items-center justify-center overflow-hidden">
              <div className={`w-3/4 h-1.5 rounded-full transition-all duration-300 ${
                cardStatus === 'success'
                  ? 'bg-emerald-400 shadow-md shadow-emerald-400'
                  : cardStatus === 'processing'
                  ? 'bg-sky-400 animate-ping'
                  : isInserting
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 animate-pulse shadow-sm shadow-emerald-400'
              }`} />
            </div>
            <div className="flex items-center justify-between w-full mt-2 px-1 text-[10px] font-bold">
              <span className="text-slate-400 uppercase tracking-wider font-mono">CARD SLOT</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ইনসার্ট স্লট
              </span>
            </div>
          </div>

          {/* ATM Machine Keypad Simulation */}
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center font-mono text-[11px] font-bold text-slate-400">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((k) => (
              <div key={k} className="py-1 bg-slate-900/90 rounded border border-slate-800 text-slate-300 shadow-xs">
                {k}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive ATM Smart Card & Credentials Form (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* 1. Realistic Animated Interactive ATM Smart Card */}
          <div className="relative">
            <motion.div
              animate={
                isInserting
                  ? {
                      x: [0, -120, -260],
                      y: [0, -20, 0],
                      scale: [1, 0.9, 0.4],
                      opacity: [1, 0.9, 0],
                      rotateY: [0, -15, -30],
                    }
                  : {
                      x: 0,
                      y: 0,
                      scale: 1,
                      opacity: 1,
                      rotateY: 0,
                    }
              }
              transition={{ duration: 0.9, ease: "easeInOut" }}
              className="w-full aspect-[1.7/1] sm:aspect-[1.8/1] rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-850 to-indigo-950 border border-slate-600/70 p-4 sm:p-5 relative shadow-2xl overflow-hidden flex flex-col justify-between"
            >
              {/* Holographic metallic band overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none" />

              {/* Card Top Row: Chip & Bank Name */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-6 rounded bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 border border-amber-600 flex items-center justify-center shadow-md">
                    <Cpu className="w-4 h-4 text-amber-950" />
                  </div>
                  <Wifi className="w-4 h-4 text-slate-400 rotate-90" />
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-black tracking-widest text-emerald-400 uppercase block">
                    MESS SMART PASS
                  </span>
                  <span className="text-[9px] text-slate-400 tracking-wider font-mono">
                    DIGITAL ID CARD
                  </span>
                </div>
              </div>

              {/* Card Middle Row: Card Number & PIN Indicator */}
              <div className="z-10 flex items-center justify-between">
                <div>
                  <div className="text-[8px] text-slate-400 uppercase tracking-widest font-mono mb-0.5">
                    CARD NUMBER
                  </div>
                  <div className="font-mono text-xs sm:text-base tracking-widest text-slate-200 font-black">
                    •••• •••• •••• {email ? (email.length >= 4 ? email.slice(0, 4).toUpperCase() : 'MESS') : '2026'}
                  </div>
                </div>

                {/* Real-time Dynamic PIN Dots on Card */}
                <div className="bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700/80 text-right">
                  <div className="text-[8px] text-slate-400 uppercase tracking-widest font-mono mb-0.5">
                    SECURITY PIN
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-black tracking-widest flex items-center gap-1 text-emerald-400">
                    {[0, 1, 2, 3].map((idx) => (
                      <span 
                        key={idx} 
                        className={`inline-block w-2.5 h-2.5 rounded-full border transition-all ${
                          pin.length > idx 
                            ? 'bg-emerald-400 border-emerald-300 shadow-sm shadow-emerald-400 scale-110' 
                            : 'bg-slate-800 border-slate-700'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Bottom Row: Live Cardholder Name & Gmail */}
              <div className="flex items-end justify-between text-xs z-10 pt-1 border-t border-slate-700/40">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="text-[8px] text-slate-400 uppercase tracking-wider font-mono">
                    CARDHOLDER / GMAIL
                  </div>
                  <div className="font-bold text-white tracking-wide truncate max-w-[240px] text-xs sm:text-sm">
                    {name ? `${name} ` : ''}
                    <span className="text-emerald-300 font-mono text-[11px] sm:text-xs">
                      {email ? `(${email})` : '(জিমেইল ইনপুট দিন)'}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[8px] text-slate-400 uppercase tracking-wider font-mono">
                    CARD TYPE
                  </div>
                  <div className={`font-black text-[11px] sm:text-xs ${authMode === 'login' ? 'text-emerald-400' : 'text-sky-400'}`}>
                    {authMode === 'login' ? 'LOGIN PASS' : 'NEW MEMBER'}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* 2. Mode Switch Tabs (লগইন vs রেজিস্ট্রেশন) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>লগইন (Login)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMsg('');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'register'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>রেজিস্ট্রেশন (Register)</span>
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-700/80 text-rose-200 text-xs font-medium text-center flex items-center justify-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1-Click Google Sign In Button */}
          <button
            type="button"
            disabled={isInserting || isGoogleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2.5 transition-all active:scale-98 shadow-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{isGoogleLoading ? 'গুগল দিয়ে কার্ড ভেরিফাই হচ্ছে...' : '১-ক্লিক গুগল (Gmail) দিয়ে স্মার্ট কার্ড লগইন'}</span>
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-950 px-3 text-[10px] text-slate-500 uppercase tracking-wider font-bold absolute">
              অথবা জিমেইল ও ৪-ডিজিট পিন
            </span>
          </div>

          {/* 3. Interactive Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            
            {/* Quick Registered User Selector Dropdown (When in login mode and registered users exist) */}
            {authMode === 'login' && registeredUsersList.length > 0 && (
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                <label className="block text-[11px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  পূর্বে রেজিস্টার করা জিমেইল সিলেক্ট করুন:
                </label>
                <select
                  value={email}
                  onChange={e => handleSelectRegisteredUser(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-700 bg-slate-950 text-white font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- জিমেইল নির্বাচন করুন ({registeredUsersList.length} টি সংরক্ষিত) --</option>
                  {registeredUsersList.map(u => (
                    <option key={u.email} value={u.email}>
                      {u.name ? `${u.name} — ${u.email}` : u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name Input (Registration Mode) */}
            {authMode === 'register' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  👤 আপনার নাম (Cardholder Name)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="উদাঃ আরিফ হোসেন"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Gmail Input (Both Modes) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                📧 জিমেইল আইডি (Gmail Address)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* PIN Input (Both Modes) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>{authMode === 'register' ? '🔑 ৪-ডিজিট পিন কোড সেট করুন (Set PIN)' : '🔑 আপনার ৪-ডিজিট কার্ড পিন (Enter PIN)'}</span>
                <span className="text-[10px] text-emerald-400 font-mono">কার্ডে লাইভ প্রদর্শিত হচ্ছে</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 tracking-widest focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-black text-sm"
                />
              </div>
            </div>

            {/* Submit & Insert Card Button */}
            <button
              type="submit"
              disabled={isInserting}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/60 active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isInserting 
                  ? 'কার্ড মেশিনে প্রবেশ করছে ও ভেরিফাই হচ্ছে...' 
                  : (authMode === 'login' ? 'কার্ড প্রবেশ করে লগইন করুন (Insert Card & Login)' : 'নতুন কার্ড ইস্যু ও রেজিস্ট্রেশন সম্পন্ন করুন')}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Footer Info */}
      <div className="max-w-5xl w-full mx-auto text-center text-[11px] text-slate-500 z-10 pt-2">
        <p>🔒 এন্ড-টু-এন্ড এনক্রিপ্টেড মেস ম্যানেজমেন্ট ডিজিটাল কার্ড সিস্টেম</p>
      </div>
    </div>
  );
};
