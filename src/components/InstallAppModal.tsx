import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Upload, Share2, Check, Copy, HelpCircle, X, HardDrive, ShieldCheck } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  allAppData: any;
  onRestoreData: (restoredData: any) => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  allAppData,
  onRestoreData,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert('⚠️ আপনার ব্রাউজারে সরাসরি "Add to Home Screen" ফিচারটি সক্রিয় করতে মেনু (⋮) আইকনে ক্লিক করে "Install app" বা "Add to Home Screen" অপশন বেছে নিন।');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleBackupDownload = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allAppData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mess_management_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          onRestoreData(parsed);
          setRestoreMessage('✅ ডাটা সফলভাবে রিস্টোর হয়েছে!');
          setTimeout(() => setRestoreMessage(''), 4000);
        } catch (error) {
          setRestoreMessage('❌ ব্যাকআপ ফাইলটি সঠিক নয়!');
          setTimeout(() => setRestoreMessage(''), 4000);
        }
      };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md bg-emerald-600 p-0.5 flex items-center justify-center">
              <img src="/icon.svg" alt="মেস হিসাব" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                ফোন অ্যাপ হিসেবে চালান
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                মোবাইলে ইনস্টল করুন ও ডাটা ব্যাকআপ নিন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action 1: Install PWA */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              মোবাইল ইনস্টল (PWA App)
            </div>
            {deferredPrompt && (
              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium animate-pulse">
                রেডি
              </span>
            )}
          </div>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-200/90 leading-relaxed">
            কোনো প্লে-স্টোর ছাড়াই সরাসরি আপনার মোবাইলের হোম-স্ক্রিনে অ্যাপ আইকন বানিয়ে অফলাইনে চালাতে পারবেন।
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={handleNativeInstall}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> মোবাইলে ইনস্টল করুন
            </button>
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'লিংক কপি হয়েছে!' : 'লিংক কপি করুন'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-500" /> অ্যান্ড্রয়েড ও আইফোনে কীভাবে ইনস্টল করবেন?
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[11px] leading-normal text-slate-600 dark:text-slate-300">
            <li><strong>অ্যান্ড্রয়েড (Google Chrome):</strong> ব্রাউজারের উপরে ডানদিকে <strong>থ্রি-ডট (⋮)</strong> মেনুতে ট্যাপ করুন &rarr; <strong>"Install app"</strong> বা <strong>"Add to Home screen"</strong> চাপুন।</li>
            <li><strong>আইফোন (Safari):</strong> নিচের <strong>Share (শেয়ার)</strong> আইকনে ট্যাপ করুন &rarr; <strong>"Add to Home Screen"</strong> বেছে নিন।</li>
          </ul>
        </div>

        {/* Action 2: Backup & Restore */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 bg-white dark:bg-slate-900">
          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-500" /> ডাটা ব্যাকআপ ও রিস্টোর
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ফোনের মেমোরিতে মেসের সব হিসাব ফাইল ব্যাকআপ রাখুন অথবা আগের ফাইল আপলোড করে হিসাব রিস্টোর করুন।
          </p>

          {restoreMessage && (
            <div className={`p-2 rounded-lg text-xs font-semibold text-center ${restoreMessage.includes('✅') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'}`}>
              {restoreMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleBackupDownload}
              className="py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" /> ডাটা ব্যাকআপ
            </button>

            <label className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700">
              <Upload className="w-4 h-4 text-sky-500" /> ব্যাকআপ রিস্টোর
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
