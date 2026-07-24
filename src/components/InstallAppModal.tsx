import React, { useState, useEffect } from 'react';
import { Smartphone, Laptop, Download, Upload, Share2, Check, Copy, HelpCircle, X, HardDrive, ShieldCheck, Monitor } from 'lucide-react';

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
  const [activeInstructionTab, setActiveInstructionTab] = useState<'pc' | 'mobile'>('pc');

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
      alert('⚠️ ব্রাউজারের অ্যাড্রেস বারের (URL Bar) ডানপাশে থাকা Install (💻) আইকনে ক্লিক করুন অথবা ব্রাউজার মেনু (⋮) থেকে "Install app" বা "Create shortcut" সিলেক্ট করুন।');
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
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4 my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-md border-2 border-emerald-500/50 flex items-center justify-center shrink-0">
              <img src="/mess_app_icon.jpg" alt="মেস হিসাব" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                পিসি ও মোবাইলে ইনস্টল করুন
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                কম্পিউটার (Windows/Mac) ও ফোনে আলাদা অ্যাপ হিসেবে চালান
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action 1: One Click Install Button */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200 text-sm">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              সরাসরি অ্যাপ হিসেবে যুক্ত করুন
            </div>
            {deferredPrompt ? (
              <span className="text-[11px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                এক ক্লিকে ইনস্টল রেডি
              </span>
            ) : (
              <span className="text-[11px] bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                PWA সাপোর্টেড
              </span>
            )}
          </div>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-200/90 leading-relaxed">
            কোনো ডাউনলোড ফাইল ছাড়াই PC / ল্যাপটপ এবং মোবাইলে শর্টকাট ডেস্কটপ অ্যাপ বানিয়ে অফলাইনে ও ফুলস্ক্রিনে চালাতে পারবেন।
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              onClick={handleNativeInstall}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" /> এক ক্লিকে ইনস্টল করুন
            </button>
            <button
              onClick={handleCopyLink}
              className="py-2.5 px-3.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100 text-xs font-bold rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'লিংক কপি হয়েছে!' : 'লিংক কপি'}
            </button>
          </div>
        </div>

        {/* Detailed Instructions with PC & Mobile Tabs */}
        <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-amber-500" /> কীভাবে ইনস্টল করবেন?
            </span>
            <div className="flex bg-slate-200/80 dark:bg-slate-700 p-0.5 rounded-lg text-[11px] font-bold">
              <button
                onClick={() => setActiveInstructionTab('pc')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  activeInstructionTab === 'pc'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" /> PC / কম্পিউটার
              </button>
              <button
                onClick={() => setActiveInstructionTab('mobile')}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                  activeInstructionTab === 'mobile'
                    ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> মোবাইল
              </button>
            </div>
          </div>

          {activeInstructionTab === 'pc' ? (
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-1 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1">
                  💻 উপায় ১: ব্রাউজার অ্যাড্রেস বার থেকে (Chrome / Edge / Brave)
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  আপনার পিসির গুগল ক্রোম বা এজ ব্রাউজারের উপরে অ্যাড্রেস বারের (যেখানে ওয়েবসাইট লিংক লেখা থাকে) ডানপাশে <strong>Install (💻 / ⬇️)</strong> একটি আইকন দেখতে পাবেন। সেখানে ক্লিক করে <strong>Install</strong> এ চাপুন।
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1">
                  ⚙️ উপায় ২: ব্রাউজার মেনু (⋮) থেকে
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  ব্রাউজারের উপরে ডানদিকের <strong>থ্রি-ডট (⋮)</strong> মেনু ক্লিক করুন &rarr; <strong>"Save and share"</strong> &rarr; <strong>"Install Mess Management..."</strong> বা <strong>"Create shortcut"</strong> (Open as window সিলেক্ট রাখুন)। আপনার পিসির ডেস্কটপে আলাদা অ্যাপ হিসেবে আইকন সেভ হয়ে যাবে!
                </p>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 pt-1 animate-fadeIn">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-1">
                  📱 অ্যান্ড্রয়েড (Google Chrome):
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  ব্রাউজারের উপরে ডানদিকে <strong>থ্রি-ডট (⋮)</strong> মেনুতে ট্যাপ করুন &rarr; <strong>"Install app"</strong> বা <strong>"Add to Home screen"</strong> এ চাপুন।
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-slate-900 dark:text-white mb-1">
                  🍎 আইফোন / আইপ্যাড (Safari):
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  সাফারি ব্রাউজারের নিচের <strong>Share (শেয়ার)</strong> আইকনে ট্যাপ করুন &rarr; স্ক্রোল করে <strong>"Add to Home Screen"</strong> বেছে নিন।
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action 2: Backup & Restore */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2.5 bg-white dark:bg-slate-900">
          <div className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-sky-500" /> মেস হিসাবের অফলাইন ডাটা ব্যাকআপ ও রিস্টোর
          </div>

          {restoreMessage && (
            <div className={`p-2 rounded-lg text-xs font-semibold text-center ${restoreMessage.includes('✅') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'}`}>
              {restoreMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              onClick={handleBackupDownload}
              className="py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> ব্যাকআপ ফাইল ডাউনলোড
            </button>

            <label className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700">
              <Upload className="w-3.5 h-3.5 text-sky-500" /> ব্যাকআপ রিস্টোর
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="text-center pt-1">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
};
