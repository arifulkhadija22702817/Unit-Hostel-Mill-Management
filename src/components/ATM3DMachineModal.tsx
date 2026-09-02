import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Lock,
  Mail,
  User,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  Wifi,
  X,
  KeyRound,
  Eye,
  EyeOff,
  CornerDownLeft,
  Delete,
  Shield,
  Zap,
  RotateCcw,
  ArrowRight,
  Radio,
  Check,
  AlertTriangle
} from 'lucide-react';
import { ConfiguredEditor } from '../lib/firebase';

interface ATM3DMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: 'editor' | 'admin', editorInfo?: { name: string; email: string }) => void;
  configuredEditors: ConfiguredEditor[];
  adminPin: string;
  editorPin: string;
  adminEmails: string[];
  currentUserEmail?: string;
}

// Simple Web Audio Synthesizer for ATM tactile sound effects (zero external files required)
const playTone = (type: 'beep' | 'insert' | 'eject' | 'success' | 'error') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'beep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'insert') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'eject') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(500, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
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
      [220, 180].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.09, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.15);
      });
    }
  } catch {
    // Audio might be blocked before user interaction; ignore silently
  }
};

export const ATM3DMachineModal: React.FC<ATM3DMachineModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  configuredEditors = [],
  adminPin = '1234',
  adminEmails = [],
  currentUserEmail = '',
}) => {
  const [selectedRole, setSelectedRole] = useState<'editor' | 'admin'>('editor');
  const [emailInput, setEmailInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'inserting' | 'verifying' | 'granted' | 'denied'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('কার্ড পাশে অবস্থান করছে। তথ্য দিয়ে কার্ড প্রবেশ করান।');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cardTilt, setCardTilt] = useState({ x: 8, y: -12 });
  const [scanProgress, setScanProgress] = useState<number>(0);

  const machineSlotRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEmailInput('');
      setPinInput('');
      setStatus('idle');
      setStatusMessage('কার্ড পাশে প্রস্তুত আছে। আপনার জিমেইল ও পিন ইনপুট দিয়ে প্রবেশ করান।');
      setErrorMessage('');
      setShowPin(false);
      setScanProgress(0);
    }
  }, [isOpen]);

  // Scan progress ticker during 'verifying'
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'verifying') {
      setScanProgress(10);
      interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 95) return prev;
          return prev + 15;
        });
      }, 100);
    } else if (status === 'idle' || status === 'denied') {
      setScanProgress(0);
    } else if (status === 'granted') {
      setScanProgress(100);
    }
    return () => clearInterval(interval);
  }, [status]);

  if (!isOpen) return null;

  // Handle ATM Keypad button press
  const handleKeypadPress = (val: string) => {
    if (status === 'inserting' || status === 'verifying') return;
    playTone('beep');

    if (val === 'CLEAR') {
      setPinInput('');
      setErrorMessage('');
    } else if (val === 'BACK') {
      setPinInput(prev => prev.slice(0, -1));
      setErrorMessage('');
    } else if (val === 'ENTER') {
      handleCardInsert();
    } else {
      if (pinInput.length < 6) {
        setPinInput(prev => prev + val);
        setErrorMessage('');
      }
    }
  };

  // 3D Card Insertion & Security Verification
  const handleCardInsert = () => {
    if (status === 'inserting' || status === 'verifying' || status === 'granted') return;

    const email = emailInput.trim().toLowerCase();
    const pin = pinInput.trim();

    if (!email || !email.includes('@')) {
      setErrorMessage('⚠️ অনুগ্রহ করে আপনার বৈধ Gmail/Email লিখুন!');
      playTone('error');
      return;
    }

    if (!pin) {
      setErrorMessage('⚠️ অনুগ্রহ করে গোপন PIN কোড ইনপুট দিন!');
      playTone('error');
      return;
    }

    setErrorMessage('');
    setStatus('inserting');
    setStatusMessage('কার্ড ATM মেশিনের স্লটের দিকে অগ্রসর হচ্ছে ও প্রবেশ করছে...');
    playTone('insert');

    // Phase 1: Card travels from Side Position into the 3D Slot (800ms)
    setTimeout(() => {
      setStatus('verifying');
      setStatusMessage('স্লটে কার্ড লক হয়েছে। চিপ ডেটা ও ক্লাউড ভেরিফিকেশন চলছে...');

      // Phase 2: Verification check against Database (1200ms)
      setTimeout(() => {
        if (selectedRole === 'editor') {
          // Check if matches configured editors
          const matchedEditor = configuredEditors.find(
            ed => ed.email.trim().toLowerCase() === email
          );

          if (matchedEditor && matchedEditor.pin.trim() === pin) {
            // MATCH FOUND -> ACCESS GRANTED
            setStatus('granted');
            const editorName = matchedEditor.name || email.split('@')[0] || 'এডিটর';
            setStatusMessage(`✅ তথ্য মিলেছে! স্বাগতম এডিটর ${editorName}`);
            playTone('success');

            setTimeout(() => {
              onLoginSuccess('editor', { name: editorName, email });
              onClose();
            }, 1400);
          } else {
            // MATCH FAILED -> ACCESS DENIED & EJECT CARD
            setStatus('denied');
            playTone('error');

            if (configuredEditors.length > 0 && !matchedEditor) {
              setErrorMessage('❌ এই Gmail টি এডমিনের এডিটর তালিকায় নেই!');
              setStatusMessage('❌ তথ্য মেলেনি! অননুমোদিত জিমেইল। কার্ড বের করা হচ্ছে...');
            } else if (matchedEditor && matchedEditor.pin.trim() !== pin) {
              setErrorMessage('❌ এডিটর PIN কোডটি ভুল হয়েছে!');
              setStatusMessage('❌ ভুল PIN! কার্ড বের হয়ে আগের অবস্থানে ফিরে আসছে...');
            } else {
              setErrorMessage('❌ জিমেইল বা পিন ভুল। এডমিন দ্বারা এডিটর কনফিগার নিশ্চিত করুন।');
              setStatusMessage('❌ তথ্য মেলেনি! কার্ড বের করা হচ্ছে...');
            }

            // Phase 3: Smooth Ejection back to Side Position after short buzz
            setTimeout(() => {
              playTone('eject');
              setStatus('idle');
              setStatusMessage('কার্ড বের হয়ে পাশে ফেরত এসেছে। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।');
            }, 2000);
          }
        } else {
          // Admin Mode verification
          const effectiveAdminPin = adminPin || '1234';
          const isAdminEmail =
            adminEmails.length === 0 ||
            email === 'arifulkhadija22@gmail.com' ||
            adminEmails.some(ae => ae.trim().toLowerCase() === email);

          if (isAdminEmail && pin === effectiveAdminPin) {
            // MATCH FOUND -> ACCESS GRANTED
            setStatus('granted');
            setStatusMessage('✅ এডমিন তথ্য মিলেছে! সম্পূর্ণ অ্যাক্সেস অনুমোদিত!');
            playTone('success');

            setTimeout(() => {
              onLoginSuccess('admin', {
                name: 'এডমিন',
                email: email
              });
              onClose();
            }, 1400);
          } else {
            // MATCH FAILED -> ACCESS DENIED & EJECT CARD
            setStatus('denied');
            playTone('error');

            if (!isAdminEmail) {
              setErrorMessage('❌ এই Email টি Admin হিসেবে অনুমোদিত নয়!');
              setStatusMessage('❌ অননুমোদিত Admin Email! কার্ড বের করা হচ্ছে...');
            } else {
              setErrorMessage('❌ ভুল Admin PIN কোড!');
              setStatusMessage('❌ ভুল Admin PIN! কার্ড বের হয়ে ফেরত আসছে...');
            }

            // Phase 3: Smooth Ejection back to Side Position
            setTimeout(() => {
              playTone('eject');
              setStatus('idle');
              setStatusMessage('কার্ড বের হয়ে পাশে ফেরত এসেছে। সঠিক তথ্য দিন।');
            }, 2000);
          }
        }
      }, 1200);
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      {/* Perspective Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 25 }}
        className="relative w-full max-w-5xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-slate-700/80 rounded-3xl p-4 sm:p-6 shadow-[0_0_60px_rgba(0,0,0,0.9)] text-white my-auto overflow-hidden"
        style={{ perspective: '1600px' }}
      >
        {/* Ambient Top Glow */}
        <div className={`absolute top-0 left-1/4 right-1/4 h-1.5 rounded-full blur-xs transition-colors duration-500 ${
          status === 'granted' ? 'bg-emerald-400 shadow-[0_0_20px_#10b981]' :
          status === 'denied' ? 'bg-rose-500 shadow-[0_0_20px_#f43f5e]' :
          status === 'verifying' || status === 'inserting' ? 'bg-cyan-400 shadow-[0_0_20px_#22d3ee]' :
          'bg-indigo-500 shadow-[0_0_20px_#6366f1]'
        }`} />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/70 hover:bg-slate-700 rounded-xl transition-all z-30 cursor-pointer shadow-md"
          title="বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header: Title & Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3.5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  <span>3D ATM মেশিন ও স্মার্ট কার্ড সিকিউরিটি</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> 3D DUAL-STAGE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                পাশাপাশি ৩D কার্ড ও ATM স্লট — কার্ড পাঞ্চে স্লটে প্রবেশ ও স্বয়ংক্রিয় যাচাই
              </p>
            </div>
          </div>

            {/* Mode Selector Toggle */}
            <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold shadow-inner">
              <button
                type="button"
                disabled={status === 'inserting' || status === 'verifying'}
                onClick={() => {
                  setSelectedRole('editor');
                  setEmailInput('');
                  setPinInput('');
                  setErrorMessage('');
                  setStatus('idle');
                  setStatusMessage('এডিটর মোড নির্বাচিত। আপনার জিমেইল ও পিন লিখে কার্ড প্রবেশ করান।');
                  playTone('beep');
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedRole === 'editor'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>এডিটর লগইন (৩ জন)</span>
              </button>
              <button
                type="button"
                disabled={status === 'inserting' || status === 'verifying'}
                onClick={() => {
                  setSelectedRole('admin');
                  setEmailInput('');
                  setPinInput('');
                  setErrorMessage('');
                  setStatus('idle');
                  setStatusMessage('এডমিন মোড নির্বাচিত। এডমিন ইমেইল ও মাস্টার পিন লিখে কার্ড প্রবেশ করান।');
                  playTone('beep');
                }}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedRole === 'admin'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>এডমিন লগইন</span>
              </button>
            </div>
        </div>

        {/* SIDE-BY-SIDE 3D STAGE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch relative">

          {/* LEFT SIDE: 3D REALISTIC ATM MACHINE (5 Cols) */}
          <div className="lg:col-span-6 flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-slate-700/80 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_20px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
            
            {/* Top ATM Machine Bezel & Speaker Grille */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                <span className="font-mono text-[11px] font-black tracking-widest text-slate-300 uppercase">
                  MESS ATM TERMINAL #01
                </span>
              </div>
              {/* Speaker Grille dots */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((d) => (
                  <div key={d} className="w-1.5 h-1.5 rounded-full bg-slate-800 border border-slate-700" />
                ))}
              </div>
            </div>

            {/* ATM LCD MONITOR SCREEN (Cyberpunk / Terminal Style) */}
            <div className={`rounded-2xl p-3.5 border-2 transition-all duration-300 relative overflow-hidden ${
              status === 'granted'
                ? 'bg-emerald-950/80 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.3)] text-emerald-200'
                : status === 'denied'
                ? 'bg-rose-950/80 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.3)] text-rose-200'
                : status === 'verifying' || status === 'inserting'
                ? 'bg-cyan-950/80 border-cyan-500 shadow-[0_0_25px_rgba(34,211,238,0.3)] text-cyan-200'
                : 'bg-slate-950 border-slate-700 text-slate-200 shadow-inner'
            }`}>
              {/* Screen Scanlines Texture */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />

              <div className="relative z-10 space-y-2 font-mono">
                {/* LCD Header */}
                <div className="flex items-center justify-between text-[10px] pb-1 border-b border-white/10 text-slate-400">
                  <span>SYSTEM: SECURE_EMV</span>
                  <span>STATUS: {status.toUpperCase()}</span>
                </div>

                {/* Main LCD Message Display */}
                <div className="min-h-[64px] flex flex-col justify-center">
                  <div className="text-xs font-bold flex items-center gap-2">
                    {status === 'granted' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
                    ) : status === 'denied' ? (
                      <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                    ) : status === 'verifying' ? (
                      <Cpu className="w-5 h-5 text-cyan-400 shrink-0 animate-spin" />
                    ) : (
                      <Radio className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                    )}
                    <span className="font-sans leading-snug">{statusMessage}</span>
                  </div>

                  {/* Progress Bar when verifying */}
                  {(status === 'verifying' || status === 'inserting') && (
                    <div className="mt-2 w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-cyan-500/40">
                      <motion.div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  )}

                  {errorMessage && (
                    <div className="mt-1.5 text-[11px] font-sans font-bold text-rose-300 bg-rose-900/40 p-1.5 rounded-lg border border-rose-500/40">
                      {errorMessage}
                    </div>
                  )}
                </div>

                {/* LCD Footer Info */}
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/10 text-slate-400 font-sans">
                  <span>মোড: {selectedRole === 'editor' ? 'এডিটর প্যানেল' : 'মাস্টার এডমিন'}</span>
                  <span>PIN: {pinInput ? '•'.repeat(pinInput.length) : 'খালি'}</span>
                </div>
              </div>
            </div>

            {/* 3D CARD SLOT RECEPTACLE BEZEL (PHYSICAL TARGET APERTURE) */}
            <div
              ref={machineSlotRef}
              className="my-4 p-3 rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-700 shadow-[inset_0_4px_12px_rgba(0,0,0,0.9)] relative"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-300">
                  <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    status === 'granted' ? 'bg-emerald-400 shadow-[0_0_10px_#10b981] animate-ping' :
                    status === 'denied' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-ping' :
                    status === 'verifying' || status === 'inserting' ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse' :
                    'bg-amber-400 animate-pulse'
                  }`} />
                  <span>ATM কার্ড ইনসার্ট স্লট (CARD APERTURE)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">EMV 3.4 CHIP IN</span>
              </div>

              {/* Physical Aperture Mouth */}
              <div className="w-full h-8 bg-black rounded-xl border-2 border-slate-600 p-1 relative flex items-center justify-center overflow-hidden shadow-inner">
                {/* Glowing Laser Light Bar inside slot */}
                <div className={`w-full h-2 rounded transition-all duration-300 ${
                  status === 'granted' ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' :
                  status === 'denied' ? 'bg-rose-500 shadow-[0_0_15px_#f43f5e]' :
                  status === 'verifying' || status === 'inserting' ? 'bg-cyan-400 shadow-[0_0_15px_#22d3ee]' :
                  'bg-emerald-400/70 shadow-[0_0_10px_#34d399]'
                }`} />

                {/* Laser Sweep Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse pointer-events-none" />

                {/* Direction Arrows */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 pointer-events-none text-white/40 text-[9px] font-black tracking-widest uppercase">
                  <span>INSERT CARD HERE</span>
                  <ArrowRight className="w-3 h-3 text-cyan-400 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Tactile ATM Physical Keypad */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 shadow-inner space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
                <span>ATM কীপ্যাড (PIN PAD)</span>
                <span className="text-amber-400 font-mono">
                  {pinInput ? `${pinInput.length}/6 ডিজিট` : 'পিন টাইপ করুন'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono text-sm font-bold">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadPress(num)}
                    disabled={status === 'inserting' || status === 'verifying'}
                    className="py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-base border border-slate-700/60 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('CLEAR')}
                  disabled={status === 'inserting' || status === 'verifying'}
                  className="py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  disabled={status === 'inserting' || status === 'verifying'}
                  className="py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-base border border-slate-700/60 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('BACK')}
                  disabled={status === 'inserting' || status === 'verifying'}
                  className="py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom ATM Dispenser / Shutter Line */}
            <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
              <span className="flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3 text-emerald-400" /> ENCRYPTED HARDWARE
              </span>
              <span>BANGLADESH MESS SECURE</span>
            </div>
          </div>

          {/* RIGHT SIDE: 3D SMART CARD & INPUT CONTROLS (6 Cols) */}
          <div
            ref={cardContainerRef}
            className="lg:col-span-6 flex flex-col justify-between p-4 sm:p-5 rounded-3xl bg-slate-900/90 border border-slate-800 relative min-h-[460px] overflow-hidden"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>আপনার 3D স্মার্ট কার্ড (পাসওয়ার্ড কার্ড)</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                {status === 'idle' ? '🟢 প্রস্তুত (SIDE DOCK)' : status === 'inserting' ? '🔵 প্রবেশ করছে' : status === 'verifying' ? '🟡 যাচাইকরণ' : status === 'granted' ? '🟢 অনুমোদিত' : '🔴 প্রত্যাখ্যাত'}
              </span>
            </div>

            {/* 3D CARD CONTAINER WITH DYNAMIC ANIMATION INTO THE ATM SLOT */}
            <div
              className="relative w-full h-[200px] flex items-center justify-center my-2 select-none"
              style={{ perspective: '1600px', transformStyle: 'preserve-3d' }}
              onMouseMove={(e) => {
                if (status !== 'idle') return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                setCardTilt({ x: -y * 0.15, y: x * 0.15 });
              }}
              onMouseLeave={() => setCardTilt({ x: 8, y: -10 })}
            >
              {/* THE 3D SMART CARD ITSELF */}
              <motion.div
                animate={
                  status === 'idle'
                    ? {
                        x: 0,
                        y: 0,
                        z: 40,
                        scale: 1,
                        rotateX: cardTilt.x,
                        rotateY: cardTilt.y,
                        rotateZ: 0,
                        opacity: 1,
                      }
                    : status === 'inserting'
                    ? {
                        // Card moves from the front and enters directly into the ATM slot from the front aperture
                        x: -290,
                        y: -15,
                        z: -70,
                        scale: 0.68,
                        rotateX: 68,
                        rotateY: 0,
                        rotateZ: 0,
                        opacity: 0.95,
                      }
                    : status === 'verifying'
                    ? {
                        // Card is locked deep inside the slot
                        x: -290,
                        y: -15,
                        z: -110,
                        scale: 0.6,
                        rotateX: 70,
                        rotateY: 0,
                        rotateZ: 0,
                        opacity: 0.88,
                      }
                    : status === 'granted'
                    ? {
                        // Card fully accepted inside
                        x: -290,
                        y: -15,
                        z: -140,
                        scale: 0.55,
                        rotateX: 72,
                        rotateY: 0,
                        rotateZ: 0,
                        opacity: 0.7,
                      }
                    : {
                        // 'denied' -> card is ejected out to the front and glides back to original position
                        x: 0,
                        y: 0,
                        z: 40,
                        scale: 1,
                        rotateX: 8,
                        rotateY: -10,
                        rotateZ: 0,
                        opacity: 1,
                      }
                }
                transition={
                  status === 'denied'
                    ? { type: 'spring', stiffness: 260, damping: 20 }
                    : { duration: 0.8, ease: [0.25, 1, 0.5, 1] }
                }
                className={`w-full max-w-[320px] h-[180px] rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-between border transition-colors duration-500 ${
                  selectedRole === 'editor'
                    ? 'bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 border-emerald-500/50 text-emerald-100 shadow-emerald-950/70'
                    : 'bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-950 border-purple-500/50 text-purple-100 shadow-purple-950/70'
                }`}
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Holographic Refraction Foil Layer */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none opacity-60" />

                {/* Top Card Row: EMV Gold Chip & Contactless NFC */}
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    {/* Metallic Gold Chip */}
                    <div className="w-10 h-8 rounded-md bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-500 border border-amber-600 p-0.5 shadow-md flex flex-col justify-between">
                      <div className="w-full h-0.5 bg-amber-700/50" />
                      <div className="flex justify-between">
                        <div className="w-2.5 h-2.5 rounded-sm border border-amber-700/60" />
                        <div className="w-2.5 h-2.5 rounded-sm border border-amber-700/60" />
                      </div>
                      <div className="w-full h-0.5 bg-amber-700/50" />
                    </div>
                    <Wifi className="w-4 h-4 rotate-90 text-white/80" />
                  </div>

                  <span className="text-[10px] font-black tracking-widest uppercase bg-black/50 px-2.5 py-1 rounded-full border border-white/20 shadow-sm">
                    {selectedRole === 'editor' ? '💳 EDITOR PASS' : '👑 ADMIN MASTER'}
                  </span>
                </div>

                {/* Middle: Masked / Live PIN Code Display on Card */}
                <div className="my-1 relative z-10 bg-black/30 p-1.5 rounded-xl border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-white/70 font-bold mb-0.5">
                    <span>SECURITY PIN</span>
                    <span className="font-mono text-amber-300">
                      {selectedRole === 'editor' ? '3-EDITOR SLOT' : 'ADMIN PIN'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-base tracking-widest font-black text-amber-300 h-6">
                    {pinInput ? (
                      pinInput.split('').map((_, i) => (
                        <span key={i} className="inline-block w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_6px_#fcd34d]" />
                      ))
                    ) : (
                      <span className="text-xs text-white/40 tracking-normal font-sans">
                        পাসওয়ার্ড পিন ইনপুট দিন...
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Card Holder & Validity */}
                <div className="flex items-end justify-between relative z-10 text-[10px]">
                  <div>
                    <div className="text-[8px] uppercase tracking-wider text-white/60 font-bold">CARD HOLDER</div>
                    <div className="font-bold truncate max-w-[190px] text-white font-mono">
                      {emailInput ? (
                        emailInput
                      ) : (
                        <span className="text-white/40 italic font-sans text-[10px]">
                          {selectedRole === 'editor' ? 'আপনার অনুমোদিত Gmail লিখুন' : 'এডমিন Gmail লিখুন'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] uppercase tracking-wider text-white/60 font-bold">STATUS</div>
                    <div className="font-mono font-bold text-emerald-300 flex items-center gap-1">
                      <Check className="w-3 h-3" /> READY
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* INPUT FIELDS: GMAIL / EMAIL & PIN */}
            <div className="space-y-3 mt-2">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>{selectedRole === 'editor' ? 'এডিটর জিমেইল (Admin Approved Gmail)' : 'এডমিন ইমেইল (Admin Email)'}</span>
                  {selectedRole === 'editor' && configuredEditors.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-normal">
                      নিবন্ধিত: {configuredEditors.length} জন
                    </span>
                  )}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    disabled={status === 'inserting' || status === 'verifying'}
                    placeholder={selectedRole === 'editor' ? 'আপনার অনুমোদিত Gmail লিখুন (যেমন: user@gmail.com)' : 'এডমিন Gmail লিখুন (যেমন: admin@gmail.com)'}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono disabled:opacity-60"
                  />
                </div>
              </div>

              {/* PIN Code Direct Input (Optional quick typing) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>{selectedRole === 'editor' ? 'এডমিনের দেওয়া এডিটর পিন' : 'এডমিন গোপন পিন কোড'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPin ? 'লুকান' : 'দেখান'}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    disabled={status === 'inserting' || status === 'verifying'}
                    placeholder="পাসওয়ার্ড পিন (যেমন: 1234)"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-base tracking-widest text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* MAIN ACTION BUTTON: INSERT CARD & VERIFY */}
              <button
                type="button"
                onClick={handleCardInsert}
                disabled={status === 'inserting' || status === 'verifying' || status === 'granted'}
                className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                  selectedRole === 'editor'
                    ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-950/60'
                    : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-950/60'
                }`}
              >
                {status === 'inserting' || status === 'verifying' ? (
                  <>
                    <Cpu className="w-5 h-5 animate-spin" />
                    <span>কার্ড স্লটে প্রবেশ ও ডেটা যাচাই চলছে...</span>
                  </>
                ) : status === 'granted' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    <span>অ্যাক্সেস অনুমোদিত! প্রবেশ করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CornerDownLeft className="w-5 h-5" />
                    <span>কার্ড ATM মেশিনে প্রবেশ করান ও লগইন করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
