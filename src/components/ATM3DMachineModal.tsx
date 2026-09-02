import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard,
  Lock,
  Mail,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  X,
  KeyRound,
  Eye,
  EyeOff,
  CornerDownLeft,
  Delete,
  Shield,
  Radio,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ConfiguredEditor } from '../lib/firebase';
import { ThreeATMScene, ATMAnimationStatus } from './ThreeATMScene';

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

// Web Audio Synthesizer for tactile ATM mechanical & beep sounds
const playTone = (type: 'beep' | 'insert' | 'eject' | 'success' | 'error') => {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Mechanical sliding motor sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(460, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
    } else if (type === 'eject') {
      // Motor ejecting sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.55);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.55);
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
  } catch {
    // Audio context may be blocked before interaction; ignore safely
  }
};

export const ATM3DMachineModal: React.FC<ATM3DMachineModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  configuredEditors = [],
  adminPin = '1234',
  adminEmails = [],
}) => {
  const [selectedRole, setSelectedRole] = useState<'editor' | 'admin'>('editor');
  const [emailInput, setEmailInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [showKeypad, setShowKeypad] = useState<boolean>(false);
  const [status, setStatus] = useState<ATMAnimationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('কার্ডে আপনার জিমেইল ও পিন দিয়ে প্রবেশ করান');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setEmailInput('');
      setPinInput('');
      setStatus('idle');
      setStatusMessage('কার্ডে আপনার জিমেইল ও পিন দিয়ে প্রবেশ করান');
      setErrorMessage('');
      setShowPin(false);
      setShowKeypad(false);
      setScanProgress(0);
    }
  }, [isOpen]);

  // Scan progress bar animation (ONLY when card is completely inside in verifying status)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'verifying') {
      setScanProgress(10);
      interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 95) return prev;
          return prev + 15;
        });
      }, 120);
    } else if (status === 'idle' || status === 'denied') {
      setScanProgress(0);
    } else if (status === 'granted') {
      setScanProgress(100);
    }
    return () => clearInterval(interval);
  }, [status]);

  if (!isOpen) return null;

  const isBusy = status === 'aligning' || status === 'inserting' || status === 'verifying' || status === 'ejecting';

  // Handle ATM Keypad button press
  const handleKeypadPress = (val: string) => {
    if (isBusy) return;
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

  // Card Insertion & Physical In-Machine Verification Flow
  const handleCardInsert = () => {
    if (isBusy || status === 'granted') return;

    const email = emailInput.trim().toLowerCase();
    const pin = pinInput.trim();

    if (!email) {
      setErrorMessage('অনুগ্রহ করে জিমেইল (Gmail) লিখুন!');
      playTone('error');
      return;
    }

    if (!pin) {
      setErrorMessage('অনুগ্রহ করে গোপন PIN কোডটি দিন!');
      playTone('error');
      return;
    }

    setErrorMessage('');

    // PHASE 1: Card lifts and moves to ATM Slot Entrance
    setStatus('aligning');
    setStatusMessage('কার্ডটি 3D স্পেসে ঘুরে ATM স্লটের মুখে সারিবদ্ধ হচ্ছে...');
    playTone('beep');

    // PHASE 2: Card physically drives and slides INTO the slot throat
    setTimeout(() => {
      setStatus('inserting');
      setStatusMessage('কার্ডটি সরাসরি ATM মেশিনের স্লটের ভেতরে প্রবেশ করছে...');
      playTone('insert');

      // PHASE 3: Card is now 100% INSIDE the machine -> ONLY NOW START PROCESSING & SCANNING!
      setTimeout(() => {
        setStatus('verifying');
        setStatusMessage('🔒 কার্ড মেশিনের ভেতরে সুরক্ষিত! চিপ স্ক্যান ও ক্লাউড ডাটাবেজ যাচাই চলছে...');

        // PHASE 4: Verification Check after scanning inside
        setTimeout(() => {
          if (selectedRole === 'editor') {
            const matchedEditor = configuredEditors.find(
              ed => ed.email && ed.email.trim().toLowerCase() === email
            );

            if (matchedEditor && matchedEditor.pin.trim() === pin) {
              // MATCH FOUND -> EJECT CARD & GRANT ACCESS
              const editorName = matchedEditor.name || email.split('@')[0] || 'এডিটর';
              setStatus('ejecting');
              setStatusMessage(`✔ তথ্য যাচাই সম্পন্ন! কার্ড বের হচ্ছে — স্বাগতম এডিটর ${editorName}`);
              playTone('eject');

              setTimeout(() => {
                setStatus('granted');
                playTone('success');
                setStatusMessage(`✅ স্বাগতম এডিটর ${editorName}! সিস্টেমে প্রবেশ করা হচ্ছে...`);
              }, 450);

              setTimeout(() => {
                onLoginSuccess('editor', { name: editorName, email });
                onClose();
              }, 2200);
            } else {
              // MATCH FAILED -> EJECT CARD OUT & SHOW ERROR
              setStatus('ejecting');
              playTone('eject');

              setTimeout(() => {
                setStatus('denied');
                playTone('error');

                if (configuredEditors.length > 0 && !matchedEditor) {
                  setErrorMessage('❌ এই Gmail টি এডমিনের এডিটর তালিকায় নিবন্ধিত নেই!');
                  setStatusMessage('❌ অননুমোদিত জিমেইল! কার্ড মেশিন থেকে বের হয়ে এসেছে।');
                } else if (matchedEditor && matchedEditor.pin.trim() !== pin) {
                  setErrorMessage('❌ এডিটর PIN কোডটি ভুল হয়েছে!');
                  setStatusMessage('❌ ভুল PIN! কার্ড মেশিন থেকে বের হয়ে এসেছে।');
                } else {
                  setErrorMessage('❌ জিমেইল বা পিন ভুল হয়েছে। এডমিন দ্বারা এডিটর নিশ্চিত করুন।');
                  setStatusMessage('❌ তথ্য মেলেনি! কার্ড মেশিন থেকে বের হয়ে ফেরত এসেছে।');
                }
              }, 450);

              // Return to idle after ejection animation
              setTimeout(() => {
                setStatus('idle');
                setStatusMessage('কার্ড ফেরত এসেছে। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।');
              }, 2400);
            }
          } else {
            // Admin Mode verification
            const effectiveAdminPin = adminPin || '1234';
            const isAdminEmail =
              adminEmails.length === 0 ||
              adminEmails.some(ae => ae.trim().toLowerCase() === email);

            if (isAdminEmail && pin === effectiveAdminPin) {
              // MATCH FOUND -> ADMIN GRANTED & EJECT
              setStatus('ejecting');
              setStatusMessage('✔ অ্যাডমিন তথ্য যাচাই সম্পন্ন! কার্ড বের হচ্ছে...');
              playTone('eject');

              setTimeout(() => {
                setStatus('granted');
                playTone('success');
                setStatusMessage('✅ সম্পূর্ণ অ্যাডমিন অ্যাক্সেস অনুমোদিত! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে...');
              }, 450);

              setTimeout(() => {
                onLoginSuccess('admin', {
                  name: email.split('@')[0] || 'অ্যাডমিন',
                  email: email
                });
                onClose();
              }, 2200);
            } else {
              // MATCH FAILED -> DENIED & EJECT
              setStatus('ejecting');
              playTone('eject');

              setTimeout(() => {
                setStatus('denied');
                playTone('error');

                if (!isAdminEmail) {
                  setErrorMessage('❌ এই Email টি Admin হিসেবে অনুমোদিত নয়!');
                  setStatusMessage('❌ অননুমোদিত Admin Email! কার্ড মেশিন থেকে বের হয়ে এসেছে।');
                } else {
                  setErrorMessage('❌ ভুল Admin PIN কোড!');
                  setStatusMessage('❌ ভুল Admin PIN! কার্ড বের হয়ে পূর্বের অবস্থানে ফিরে এসেছে।');
                }
              }, 450);

              setTimeout(() => {
                setStatus('idle');
                setStatusMessage('কার্ড বের হয়ে ফেরত এসেছে। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।');
              }, 2400);
            }
          }
        }, 1500); // 1.5s scanning while card is completely inside machine
      }, 750); // 750ms intake movement
    }, 600); // 600ms aligning movement
  };

  // Tactile ATM Keypad
  const renderKeypad = () => {
    return (
      <div className="bg-slate-950 p-2.5 sm:p-3 rounded-2xl border border-slate-800 shadow-inner space-y-1.5">
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-bold text-slate-400 px-1">
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
              className="py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-sm sm:text-base border border-slate-700/60 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleKeypadPress('CLEAR')}
            disabled={status === 'inserting' || status === 'verifying'}
            className="py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/40 text-amber-300 text-[10px] sm:text-xs font-bold border border-amber-500/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            disabled={status === 'inserting' || status === 'verifying'}
            className="py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 text-white font-mono text-sm sm:text-base border border-slate-700/60 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('BACK')}
            disabled={status === 'inserting' || status === 'verifying'}
            className="py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-300 text-[10px] sm:text-xs font-bold border border-rose-500/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Delete className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        className="relative w-full max-w-5xl max-h-[96vh] overflow-y-auto bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-slate-700/80 rounded-3xl p-3.5 sm:p-5 shadow-[0_0_60px_rgba(0,0,0,0.9)] text-white my-auto custom-scrollbar"
      >
        {/* Glowing Top Ambient Line */}
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
          className="absolute top-3 right-3 p-1.5 sm:p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-all z-30 cursor-pointer shadow-md"
          title="বন্ধ করুন"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3 mb-3 pr-8 sm:pr-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>3D Three.js ATM মেশিন ও স্মার্ট কার্ড</span>
                </h2>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-2 h-2 animate-pulse" /> 3D WEBGL ENGINE
                </span>
              </div>
              
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 text-[11px] sm:text-xs font-bold shadow-inner self-start sm:self-auto">
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
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedRole === 'editor'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>এডিটর (৩ জন)</span>
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
              className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedRole === 'admin'
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>এডমিন</span>
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* TRUE THREE.JS 3D WEBGL SCENE (ATM MACHINE + SMART CARD) */}
        {/* ---------------------------------------------------- */}
        <div className="mb-3.5">
          <ThreeATMScene
            status={status}
            selectedRole={selectedRole}
            emailInput={emailInput}
            pinInput={pinInput}
            scanProgress={scanProgress}
            statusMessage={statusMessage}
            isMobile={isMobile}
          />
        </div>

        {/* ---------------------------------------------------- */}
        {/* BOTTOM SECTION: INPUTS FORM & ATM KEYPAD */}
        {/* ---------------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-900/80 p-3.5 sm:p-4 rounded-3xl border border-slate-800">
          {/* Inputs Column */}
          <div className="md:col-span-7 space-y-3">
            {/* Email Input */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>{selectedRole === 'editor' ? 'এডিটর জিমেইল (Approved Gmail)' : 'এডমিন ইমেইল (Admin Email)'}</span>
                {selectedRole === 'editor' && configuredEditors.length > 0 && (
                  <span className="text-[10px] text-emerald-400 font-normal">
                    নিবন্ধিত এডিটর: {configuredEditors.length} জন
                  </span>
                )}
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  disabled={status === 'inserting' || status === 'verifying'}
                  placeholder={selectedRole === 'editor' ? 'আপনার Gmail লিখুন (যেমন: user@gmail.com)' : 'এডমিন Gmail লিখুন (যেমন: admin@gmail.com)'}
                  className="w-full pl-8 pr-3 py-2 sm:py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-green-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono disabled:opacity-60"
                />
              </div>
            </div>

            {/* PIN Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] sm:text-xs font-bold text-slate-300 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  <span>{selectedRole === 'editor' ? 'এডিটর পিন কোড' : 'এডমিন সিক্রেট পিন'}</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKeypad(!showKeypad)}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer font-bold"
                  >
                    <span>কীপ্যাড</span>
                    {showKeypad ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPin ? 'লুকান' : 'দেখান'}</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  disabled={status === 'inserting' || status === 'verifying'}
                  placeholder="সিক্রেট পিন দিন"
                  className="w-full px-3 py-2 sm:py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-center text-sm sm:text-base tracking-widest text-green-400 font-mono font-bold focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* Collapsible Keypad for Mobile / Compact view */}
            {showKeypad && (
              <div className="pt-1 md:hidden">
                {renderKeypad()}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="text-[11px] sm:text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 p-2.5 rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* MAIN ACTION BUTTON: INSERT CARD INTO MACHINE & LOGIN */}
            <button
              type="button"
              onClick={handleCardInsert}
              disabled={status === 'inserting' || status === 'verifying' || status === 'granted'}
              className={`w-full py-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 ${
                selectedRole === 'editor'
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-emerald-950/60'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-purple-950/60'
              }`}
            >
              {status === 'inserting' || status === 'verifying' ? (
                <>
                  <Cpu className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span>3D কার্ড মেশিনে প্রবেশ ও ভেরিফিকেশন চলছে...</span>
                </>
              ) : status === 'granted' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300" />
                  <span>অ্যাক্সেস অনুমোদিত! প্রবেশ করা হচ্ছে...</span>
                </>
              ) : (
                <>
                  <CornerDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>কার্ড ATM মেশিনে প্রবেশ করান ও লগইন করুন</span>
                </>
              )}
            </button>
          </div>

          {/* Keypad Column for Desktop / Tablets */}
          <div className="hidden md:flex md:col-span-5 flex-col justify-between">
            {renderKeypad()}
            <div className="mt-2 text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" /> SECURE ATM ENCRYPTION
              </span>
              <span>256-BIT EMV AUTH</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
