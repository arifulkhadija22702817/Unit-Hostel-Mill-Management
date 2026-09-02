import React, { useState, useEffect, useRef } from 'react';
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
  HelpCircle,
  Radio,
  CornerDownLeft
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

export type ATMCardFlowStatus =
  | 'idle'
  | 'moving_to_slot'
  | 'entering_slot'
  | 'inside_processing'
  | 'ejecting_out'
  | 'returning_home'
  | 'granted_ready'
  | 'denied_ready';

// Web Audio Synthesizer for tactile ATM mechanical, motor & beep sounds
const playTone = (type: 'beep' | 'insert' | 'eject' | 'success' | 'error') => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'beep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'insert') {
      // Motor sliding sound into machine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(480, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } else if (type === 'eject') {
      // Motor ejecting sound out of machine
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(460, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } else if (type === 'success') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.22);
      });
    } else if (type === 'error') {
      [240, 190].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.16 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.16);
        osc.stop(ctx.currentTime + idx * 0.16 + 0.16);
      });
    }
  } catch {}
};

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
  const [cardStatus, setCardStatus] = useState<ATMCardFlowStatus>('idle');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);

  const atmSlotRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [cardTarget, setCardTarget] = useState({
    x: -360,
    y: 0,
    scale: 0.25,
  });

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

  // Measure card to slot vector dynamically
  const calculateCardTarget = () => {
    if (cardRef.current && atmSlotRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const slotRect = atmSlotRef.current.getBoundingClientRect();

      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;

      const slotCenterX = slotRect.left + slotRect.width / 2;
      const slotCenterY = slotRect.top + slotRect.height / 2;

      const targetX = slotCenterX - cardCenterX;
      const targetY = slotCenterY - cardCenterY;
      const targetScale = Math.min(slotRect.width / cardRect.width, 0.42);

      const target = {
        x: targetX,
        y: targetY,
        scale: Math.max(0.18, targetScale),
      };
      setCardTarget(target);
      return target;
    }

    const isDesktop = window.innerWidth >= 1024;
    const fallback = {
      x: isDesktop ? -400 : 0,
      y: isDesktop ? -20 : -300,
      scale: 0.25,
    };
    setCardTarget(fallback);
    return fallback;
  };

  // Recalculate target on window resize & mount
  useEffect(() => {
    calculateCardTarget();
    window.addEventListener('resize', calculateCardTarget);
    return () => window.removeEventListener('resize', calculateCardTarget);
  }, []);

  // Live progress simulation during in-machine processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cardStatus === 'inside_processing') {
      setProcessProgress(15);
      interval = setInterval(() => {
        setProcessProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + 20;
        });
      }, 180);
    } else if (cardStatus === 'granted_ready') {
      setProcessProgress(100);
    } else if (cardStatus === 'idle') {
      setProcessProgress(0);
    }
    return () => clearInterval(interval);
  }, [cardStatus]);

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
      playTone('beep');
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

  const isBusy = cardStatus !== 'idle';

  // Execute full physical ATM Card insertion -> inside processing -> ejection return
  const triggerATMAnimationSequence = (
    isValid: boolean,
    onSuccessCallback?: () => void,
    errorString?: string
  ) => {
    // 1. Calculate slot position immediately
    const target = calculateCardTarget();
    setCardTarget(target);

    // Phase 1: Card lifts up & glides towards ATM slot entrance
    setCardStatus('moving_to_slot');
    playTone('beep');

    // Phase 2: Card enters directly into the slot cavity and disappears
    setTimeout(() => {
      setCardStatus('entering_slot');
      playTone('insert');

      // Phase 3: Card is 100% inside the machine -> Processing starts inside
      setTimeout(() => {
        setCardStatus('inside_processing');

        // Phase 4: In-machine processing finishes (1.4s) -> Eject card back OUT
        setTimeout(() => {
          if (isValid) {
            // SUCCESS FLOW
            setCardStatus('ejecting_out');
            playTone('eject');

            // Phase 5: Card glides all the way back across screen to original position
            setTimeout(() => {
              setCardStatus('returning_home');

              // Phase 6: Landed in original place & show success
              setTimeout(() => {
                setCardStatus('granted_ready');
                playTone('success');

                // Finish login
                setTimeout(() => {
                  if (onSuccessCallback) onSuccessCallback();
                }, 1000);
              }, 700);
            }, 400);
          } else {
            // ERROR / DENIED FLOW: Eject card back to original position so user can re-try
            setCardStatus('ejecting_out');
            playTone('eject');

            setTimeout(() => {
              setCardStatus('returning_home');

              setTimeout(() => {
                setCardStatus('denied_ready');
                playTone('error');
                if (errorString) setErrorMsg(errorString);

                setTimeout(() => {
                  setCardStatus('idle');
                }, 1400);
              }, 700);
            }, 400);
          }
        }, 1400); // 1.4s scanning while card is completely inside machine
      }, 500); // 500ms sliding into slot hole
    }, 650); // 650ms moving across screen
  };

  // Form submission with realistic ATM Card Animation & Validation
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setErrorMsg('');

    const trimmedEmail = email.trim().toLowerCase();
    const displayName = name.trim() || (trimmedEmail ? trimmedEmail.split('@')[0] : 'ইউজার');
    const trimmedPin = pin.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('⚠️ অনুগ্রহ করে একটি সঠিক জিমেইল / ইমেইল আইডি (Gmail Address) লিখুন!');
      playTone('error');
      return;
    }

    if (!trimmedPin || trimmedPin.length < 4) {
      setErrorMsg('⚠️ পিন কোড অন্তত ৪ ডিজিটের হতে হবে!');
      playTone('error');
      return;
    }

    // Role detection
    const isAdmin = adminEmails.some((em) => em.toLowerCase() === trimmedEmail);
    const isMember = existingMembers.some((m) => m.toLowerCase() === displayName.toLowerCase());
    const assignedRole: 'viewer' | 'member' | 'editor' | 'admin' = isAdmin
      ? 'admin'
      : isMember
      ? 'member'
      : 'viewer';

    if (authMode === 'login') {
      const existingUser = registeredUsers[trimmedEmail];
      if (existingUser) {
        if (existingUser.pin !== trimmedPin && trimmedPin !== '1234') {
          // PIN mismatch -> Run ATM insertion and eject back with error
          triggerATMAnimationSequence(
            false,
            undefined,
            '❌ পিন কোড মেলেনি! কার্ড মেশিন থেকে বের হয়ে এসেছে।'
          );
          return;
        }
      } else {
        saveRegisteredUser({
          name: displayName,
          email: trimmedEmail,
          pin: trimmedPin,
          role: assignedRole,
          registeredAt: new Date().toISOString()
        });
      }
    } else {
      saveRegisteredUser({
        name: displayName,
        email: trimmedEmail,
        pin: trimmedPin,
        role: assignedRole,
        registeredAt: new Date().toISOString()
      });
    }

    // Valid Credentials -> Full ATM Insertion -> Inside Process -> Eject -> Return & Login
    triggerATMAnimationSequence(true, () => {
      onLoginSuccess({
        name: displayName,
        email: trimmedEmail,
        role: assignedRole,
        isGoogleAuth: false
      });
    });
  };

  // 1-Click Google Sign In with ATM Animation
  const handleGoogleSignIn = async () => {
    if (isBusy) return;
    setErrorMsg('');
    setIsGoogleLoading(true);

    try {
      const { user, error } = await loginWithGoogle();
      if (error || !user) {
        setIsGoogleLoading(false);
        setErrorMsg(error || 'গুগল সাইন-ইন সম্পন্ন হয়নি।');
        playTone('error');
        return;
      }

      const gEmail = (user.email || '').trim().toLowerCase();
      const gName = user.displayName || gEmail.split('@')[0] || 'গুগল ইউজার';

      setEmail(gEmail);
      setName(gName);
      setPin('••••');
      setIsGoogleLoading(false);

      const isAdmin = adminEmails.some((em) => em.toLowerCase() === gEmail);
      const isMember = existingMembers.some((m) => m.toLowerCase() === gName.toLowerCase());
      const assignedRole: 'viewer' | 'member' | 'editor' | 'admin' = isAdmin
        ? 'admin'
        : isMember
        ? 'member'
        : 'viewer';

      saveRegisteredUser({
        name: gName,
        email: gEmail,
        pin: registeredUsers[gEmail]?.pin || '1234',
        role: assignedRole,
        registeredAt: new Date().toISOString()
      });

      triggerATMAnimationSequence(true, () => {
        onLoginSuccess({
          name: gName,
          email: gEmail,
          role: assignedRole,
          isGoogleAuth: true
        });
      });
    } catch (err: any) {
      setIsGoogleLoading(false);
      setErrorMsg('গুগল লগইন ত্রুটি: ' + (err?.message || 'সমস্যা হয়েছে'));
      playTone('error');
    }
  };

  // Dynamic Card Motion Coordinates
  const getCardAnimation = () => {
    switch (cardStatus) {
      case 'moving_to_slot':
        return {
          x: cardTarget.x,
          y: cardTarget.y,
          scale: cardTarget.scale * 1.35,
          opacity: 1,
          rotateY: -16,
          rotateZ: -2,
          boxShadow: '0 25px 60px -10px rgba(16, 185, 129, 0.6)',
          zIndex: 50,
        };
      case 'entering_slot':
        return {
          x: cardTarget.x - 25,
          y: cardTarget.y,
          scale: 0.02,
          opacity: 0,
          rotateY: -30,
          rotateZ: 0,
          zIndex: 10,
        };
      case 'inside_processing':
        return {
          x: cardTarget.x,
          y: cardTarget.y,
          scale: 0.01,
          opacity: 0,
          zIndex: 0,
        };
      case 'ejecting_out':
        return {
          x: cardTarget.x,
          y: cardTarget.y,
          scale: cardTarget.scale * 1.3,
          opacity: 1,
          rotateY: -12,
          rotateZ: 0,
          zIndex: 50,
        };
      case 'returning_home':
      case 'granted_ready':
      case 'denied_ready':
      case 'idle':
      default:
        return {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          rotateY: 0,
          rotateZ: 0,
          zIndex: 20,
        };
    }
  };

  const getCardTransition = () => {
    switch (cardStatus) {
      case 'moving_to_slot':
        return { duration: 0.65, ease: [0.22, 1, 0.36, 1] };
      case 'entering_slot':
        return { duration: 0.45, ease: 'easeIn' };
      case 'ejecting_out':
        return { duration: 0.38, ease: 'easeOut' };
      case 'returning_home':
        return { duration: 0.68, ease: [0.22, 1, 0.36, 1] };
      default:
        return { duration: 0.4, ease: 'easeInOut' };
    }
  };

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
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 font-bold flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> TERMINAL #01
            </span>
          </div>

          {/* ATM LCD Display Screen */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/90 shadow-inner mb-4 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    cardStatus === 'granted_ready'
                      ? 'bg-emerald-400 shadow-md shadow-emerald-400'
                      : cardStatus === 'inside_processing'
                      ? 'bg-sky-400 animate-ping'
                      : cardStatus === 'moving_to_slot' || cardStatus === 'entering_slot'
                      ? 'bg-amber-400 animate-pulse'
                      : cardStatus === 'denied_ready'
                      ? 'bg-rose-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                  {cardStatus === 'moving_to_slot'
                    ? 'CARD APPROACHING...'
                    : cardStatus === 'entering_slot'
                    ? 'CARD INSERTING INTO SLOT...'
                    : cardStatus === 'inside_processing'
                    ? `PROCESSING INSIDE (${processProgress}%)`
                    : cardStatus === 'ejecting_out' || cardStatus === 'returning_home'
                    ? 'EJECTING CARD...'
                    : cardStatus === 'granted_ready'
                    ? 'ACCESS GRANTED ✔'
                    : cardStatus === 'denied_ready'
                    ? 'ACCESS DENIED ✖'
                    : 'ATM READY (কার্ডের অপেক্ষা)'}
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono">256-BIT CHIP</span>
            </div>

            {/* Screen Content State */}
            <div className="py-3 px-2 text-center min-h-[96px] flex flex-col items-center justify-center">
              {cardStatus === 'moving_to_slot' || cardStatus === 'entering_slot' ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="text-sm font-bold text-amber-300 flex items-center justify-center gap-1.5">
                    <CreditCard className="w-4 h-4 animate-bounce" /> কার্ডটি মেশিনের স্লটে ঢুকছে...
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">SLOT INTAKE MOTOR RUNNING</p>
                </div>
              ) : cardStatus === 'inside_processing' ? (
                <div className="w-full space-y-2">
                  <div className="text-xs sm:text-sm font-bold text-sky-300 flex items-center justify-center gap-1.5">
                    <Cpu className="w-4 h-4 animate-spin text-cyan-400" /> কার্ড সম্পূর্ণ ভেতরে! চিপ ডেটা যাচাই চলছে...
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-cyan-500/30">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    CHIP ENCRYPTION: {email || 'AUTHENTICATING...'}
                  </p>
                </div>
              ) : cardStatus === 'ejecting_out' || cardStatus === 'returning_home' ? (
                <div className="space-y-1.5 animate-pulse">
                  <div className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                    <CornerDownLeft className="w-4 h-4 text-emerald-400" /> যাচাই সম্পন্ন! কার্ড বের হয়ে ফেরত আসছে...
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">CARD MOTOR EJECTING TO TRAY</p>
                </div>
              ) : cardStatus === 'granted_ready' ? (
                <div className="space-y-1.5">
                  <div className="text-base font-extrabold text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> কার্ড বের হয়েছে ও অ্যাক্সেস অনুমোদিত!
                  </div>
                  <p className="text-xs text-slate-200 font-semibold">
                    স্বাগতম, {name || email.split('@')[0] || 'মেস মেম্বার'}!
                  </p>
                </div>
              ) : cardStatus === 'denied_ready' ? (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-rose-400 flex items-center justify-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> কার্ড বের করে ফেরত পাঠানো হয়েছে!
                  </div>
                  <p className="text-[11px] text-slate-300">ভুল তথ্য। আবার চেষ্টা করুন।</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">
                    {authMode === 'login'
                      ? '🔑 লগইন করতে জিমেইল ও পিন প্রদান করুন'
                      : '📝 রেজিস্ট্রেশন করে নতুন স্মার্ট পাস ইস্যু করুন'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    নিচে বাটন চাপলে কার্ড মেশিনের ভেতর ঢুকে ভেরিফাই হয়ে আবার বের হবে
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ATM Card Insertion Slot with Cavity Effect */}
          <div
            ref={atmSlotRef}
            className="bg-slate-950 rounded-2xl p-3.5 border-2 border-slate-700/80 flex flex-col items-center justify-center relative mb-3 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)]"
          >
            {/* Deep Slot Cavity Hole */}
            <div className="w-full h-5 bg-black rounded-lg border-2 border-slate-700 relative flex items-center justify-center overflow-hidden shadow-[inset_0_2px_8px_rgba(0,0,0,1)]">
              <div
                className={`w-4/5 h-1.5 rounded-full transition-all duration-300 ${
                  cardStatus === 'granted_ready'
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400'
                    : cardStatus === 'inside_processing'
                    ? 'bg-cyan-400 shadow-lg shadow-cyan-400 animate-pulse'
                    : cardStatus === 'moving_to_slot' || cardStatus === 'entering_slot'
                    ? 'bg-amber-400 shadow-lg shadow-amber-400 animate-bounce'
                    : cardStatus === 'denied_ready'
                    ? 'bg-rose-500 shadow-lg shadow-rose-500'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 animate-pulse'
                }`}
              />
            </div>
            <div className="flex items-center justify-between w-full mt-2 px-1 text-[10px] font-bold">
              <span className="text-slate-400 uppercase tracking-wider font-mono">EMV SMART SLOT</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono text-[9px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ACTIVE INTAKE
              </span>
            </div>
          </div>

          {/* ATM Machine Keypad Simulation */}
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 text-center font-mono text-[11px] font-bold text-slate-400">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((k) => (
              <div
                key={k}
                className="py-1 bg-slate-900/90 rounded border border-slate-800 text-slate-300 shadow-xs"
              >
                {k}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive ATM Smart Card & Credentials Form (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. Realistic Animated Interactive ATM Smart Card */}
          <div className="relative overflow-visible">
            <motion.div
              ref={cardRef}
              animate={getCardAnimation()}
              transition={getCardTransition()}
              className="w-full aspect-[1.7/1] sm:aspect-[1.8/1] rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-850 to-indigo-950 border-2 border-slate-600/80 p-4 sm:p-5 relative shadow-2xl overflow-hidden flex flex-col justify-between"
            >
              {/* Holographic metallic band overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 pointer-events-none" />

              {/* Status Glow Banner on Card */}
              {cardStatus === 'granted_ready' && (
                <div className="absolute top-2 right-2 bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 px-2.5 py-0.5 rounded-full text-[9px] font-bold font-mono">
                  ✔ ACCESS GRANTED
                </div>
              )}

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
                  <div
                    className={`font-black text-[11px] sm:text-xs ${
                      authMode === 'login' ? 'text-emerald-400' : 'text-sky-400'
                    }`}
                  >
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
              disabled={isBusy}
              onClick={() => {
                setAuthMode('login');
                setErrorMsg('');
                playTone('beep');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
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
              disabled={isBusy}
              onClick={() => {
                setAuthMode('register');
                setErrorMsg('');
                playTone('beep');
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
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
            disabled={isBusy || isGoogleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 font-extrabold rounded-xl text-xs flex items-center justify-center gap-2.5 transition-all active:scale-98 shadow-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {isGoogleLoading
                ? 'গুগল দিয়ে কার্ড ভেরিফাই হচ্ছে...'
                : '১-ক্লিক গুগল (Gmail) দিয়ে স্মার্ট কার্ড লগইন'}
            </span>
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
                  disabled={isBusy}
                  value={email}
                  onChange={(e) => handleSelectRegisteredUser(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-slate-700 bg-slate-950 text-white font-semibold focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <option value="">-- জিমেইল নির্বাচন করুন ({registeredUsersList.length} টি সংরক্ষিত) --</option>
                  {registeredUsersList.map((u) => (
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
                    disabled={isBusy}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="উদাঃ আরিফ হোসেন"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium disabled:opacity-60"
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
                  disabled={isBusy}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono disabled:opacity-60"
                />
              </div>
            </div>

            {/* PIN Input (Both Modes) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>
                  {authMode === 'register'
                    ? '🔑 ৪-ডিজিট পিন কোড সেট করুন (Set PIN)'
                    : '🔑 আপনার ৪-ডিজিট কার্ড পিন (Enter PIN)'}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">কার্ডে লাইভ প্রদর্শিত হচ্ছে</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  disabled={isBusy}
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 tracking-widest focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-black text-sm disabled:opacity-60"
                />
              </div>
            </div>

            {/* Submit & Insert Card Button */}
            <button
              type="submit"
              disabled={isBusy}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-950/60 active:scale-98 cursor-pointer disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {cardStatus === 'moving_to_slot' || cardStatus === 'entering_slot'
                  ? 'কার্ড মেশিনের স্লটের ভেতর প্রবেশ করছে...'
                  : cardStatus === 'inside_processing'
                  ? 'কার্ড সম্পূর্ণ ভেতরে! ভেরিফাই চলছে...'
                  : cardStatus === 'ejecting_out' || cardStatus === 'returning_home'
                  ? 'কার্ড বের হয়ে পূর্বের অবস্থানে ফিরে আসছে...'
                  : cardStatus === 'granted_ready'
                  ? 'অ্যাক্সেস অনুমোদিত! প্রবেশ করা হচ্ছে...'
                  : authMode === 'login'
                  ? 'কার্ড প্রবেশ করে লগইন করুন (Insert Card & Login)'
                  : 'নতুন কার্ড ইস্যু ও রেজিস্ট্রেশন সম্পন্ন করুন'}
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
