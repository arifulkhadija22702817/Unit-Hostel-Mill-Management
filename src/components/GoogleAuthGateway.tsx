import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  LogIn, 
  ShieldCheck, 
  UtensilsCrossed, 
  Sparkles, 
  Eye, 
  CreditCard, 
  CheckCircle2, 
  Lock, 
  ArrowRight,
  Shield,
  Zap,
  Users
} from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';

interface GoogleAuthGatewayProps {
  onLoginGoogleSuccess: (userData: { email: string; name: string; isGoogle: boolean }) => void;
}

export const GoogleAuthGateway: React.FC<GoogleAuthGatewayProps> = ({
  onLoginGoogleSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const { user, error } = await loginWithGoogle();
      if (error || !user) {
        setErrorMsg(error || 'গুগল সাইন-ইন বাতিল বা ব্যর্থ হয়েছে।');
        return;
      }
      const email = user.email || '';
      const name = user.displayName || email.split('@')[0] || 'ইউজার';
      onLoginGoogleSuccess({ email, name, isGoogle: true });
    } catch (err: any) {
      setErrorMsg('গুগল লগইনে সমস্যা হয়েছে: ' + (err?.message || 'অনুগ্রহ করে আবার চেষ্টা করুন'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-y-auto">
      {/* Background Animated Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-auto"
      >
        {/* Top Header & App Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 mb-3.5">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <UtensilsCrossed className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>স্মার্ট মেস পোর্টাল</span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            স্মার্ট মেস ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
            স্বাগতম! মেসে প্রবেশ করতে নিচের গুগল সাইন-ইন ব্যবহার করুন (সরাসরি ভিউ মোডে প্রবেশ করবেন)।
          </p>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300">
            <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>সরাসরি ভিউ মোড</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-300">
            <CreditCard className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>৩D ATM সিকিউরিটি</span>
          </div>
        </div>

        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium text-center"
          >
            {errorMsg}
          </motion.div>
        )}

        {/* Main Action: Google One-Click Login */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full relative group overflow-hidden py-4 px-4 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all duration-200 shadow-xl shadow-slate-950/40 active:scale-[0.98] cursor-pointer disabled:opacity-70"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span>গুগল অথেনটিকেশন হচ্ছে...</span>
              </div>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>গুগল অ্যাকাউন্ট দিয়ে প্রবেশ করুন</span>
              </>
            )}
          </button>
        </div>

        {/* Informative Footer Note */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>এডমিন ও এডিটর মোডে যেতে ভেতরে ৩D ATM কার্ড স্লট থাকবে</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
