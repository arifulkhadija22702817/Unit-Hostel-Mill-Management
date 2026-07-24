import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, X, Check, Eye, EyeOff, Users, LogOut, AlertTriangle, ShieldAlert, UserCheck, UserX, Ban, Unlock, Clock, Inbox, Trash2, Search } from 'lucide-react';
import { EditorAccessRequest, UserSessionLog } from '../types';

export type UserRole = 'admin' | 'editor' | 'viewer';

export interface ActiveEditorSession {
  id: string;
  name: string;
  joinedAt: string;
}

interface RoleAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  currentSessionId: string;
  adminPin: string;
  editorPin: string;
  activeEditors: ActiveEditorSession[];
  editorRequests: EditorAccessRequest[];
  blockedUsers: string[];
  sessionLogs?: UserSessionLog[];
  initialTab?: 'login' | 'management' | 'logs' | 'settings';
  onLoginAdmin: () => void;
  onDirectEditorLogin?: (name: string, pin: string) => void;
  onRequestEditorAccess: (editorName: string) => void;
  onApproveEditorRequest: (requestId: string) => void;
  onRejectEditorRequest: (requestId: string) => void;
  onRemoveEditor: (editorId: string) => void;
  onBlockUser: (userName: string) => void;
  onUnblockUser: (userName: string) => void;
  onSwitchToViewer: () => void;
  onChangeAdminPin: (newPin: string) => void;
  onChangeEditorPin: (newPin: string) => void;
  onClearActiveEditors: () => void;
  onClearSessionLogs?: () => void;
}

export const RoleAccessModal: React.FC<RoleAccessModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  currentSessionId,
  adminPin,
  editorPin,
  activeEditors = [],
  editorRequests = [],
  blockedUsers = [],
  sessionLogs = [],
  initialTab = 'login',
  onLoginAdmin,
  onDirectEditorLogin,
  onRequestEditorAccess,
  onApproveEditorRequest,
  onRejectEditorRequest,
  onRemoveEditor,
  onBlockUser,
  onUnblockUser,
  onSwitchToViewer,
  onChangeAdminPin,
  onChangeEditorPin,
  onClearActiveEditors,
  onClearSessionLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'management' | 'logs' | 'settings'>(initialTab);
  const [selectedTargetRole, setSelectedTargetRole] = useState<'admin' | 'editor'>('editor');

  // Log search & category filter
  const [logCategory, setLogCategory] = useState<'all' | 'update' | 'auth' | 'reset'>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      if (currentRole !== 'admin' && (initialTab === 'settings' || initialTab === 'management')) {
        setActiveTab('login');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialTab, currentRole]);
  
  // Input states
  const [pinInput, setPinInput] = useState<string>('');
  const [editorNameInput, setEditorNameInput] = useState<string>('');
  const [manualBlockInput, setManualBlockInput] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Pin Change states
  const [pinChangeType, setPinChangeType] = useState<'admin' | 'editor'>('admin');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  if (!isOpen) return null;

  const maxEditors = 3;
  const currentEditorCount = activeEditors.length;
  const isSlotsFull = currentEditorCount >= maxEditors;
  const myEditorSession = activeEditors.find(e => e.id === currentSessionId);
  const pendingRequests = editorRequests.filter(r => r.status === 'pending');
  const myPendingRequest = editorRequests.find(r => r.id === currentSessionId && r.status === 'pending');
  const myRejectedRequest = editorRequests.find(r => r.id === currentSessionId && r.status === 'rejected');

  const filteredLogs = sessionLogs.filter(log => {
    if (logCategory === 'update' && log.action !== 'update') return false;
    if (logCategory === 'auth' && !['login', 'logout', 'approved', 'rejected', 'removed'].includes(log.action)) return false;
    if (logCategory === 'reset' && log.action !== 'reset') return false;

    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const nameMatch = log.name.toLowerCase().includes(q);
      const detailMatch = log.details?.toLowerCase().includes(q);
      return nameMatch || detailMatch;
    }
    return true;
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (selectedTargetRole === 'admin') {
      const effectiveAdminPin = adminPin || '1234';
      if (pinInput.trim() === effectiveAdminPin) {
        onLoginAdmin();
        setPinInput('');
        onClose();
      } else {
        setErrorMsg('❌ ভুল এডমিন পিন কোড! আবার চেষ্টা করুন (ডিফল্ট: 1234)');
      }
    } else if (selectedTargetRole === 'editor') {
      const trimmedName = editorNameInput.trim();
      const effectiveEditorPin = editorPin || '5678';

      if (!trimmedName) {
        setErrorMsg('⚠️ দয়া করে আপনার ইউজার নেম / নাম লিখুন!');
        return;
      }

      // Check if user is blocked
      if (blockedUsers.includes(trimmedName) || blockedUsers.includes(currentSessionId)) {
        setErrorMsg(`⚠️ "${trimmedName}" কে এডমিন কর্তৃক ব্লক করা হয়েছে! আপনি এডিটর অ্যাক্সেস পাবেন না।`);
        return;
      }

      if (pinInput.trim() !== effectiveEditorPin) {
        setErrorMsg('❌ ভুল এডিটর পাসওয়ার্ড! সঠিক পাসওয়ার্ড দিয়ে চেষ্টা করুন।');
        return;
      }

      if (isSlotsFull) {
        setErrorMsg(`⚠️ দুঃখিত, ইতোমধ্যে সর্বোচ্চ ৩ জন এডিটর সক্রিয় আছেন!`);
        return;
      }

      // Request Editor Access Flow - Admin confirmation required
      onRequestEditorAccess(trimmedName);
      setSuccessMsg(`✅ পাসওয়ার্ড সঠিক হয়েছে! "${trimmedName}" নামে এডমিনের কাছে অনুমোদনের রিকোয়েস্ট পাঠানো হয়েছে। এডমিন একসেপ্ট করলে আপনি স্বয়ংক্রিয়ভাবে এডিটর অ্যাক্সেস পেয়ে যাবেন।`);
      setPinInput('');
      setEditorNameInput('');
    }
  };

  const handlePinChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPin.trim().length < 4) {
      setErrorMsg('⚠️ পিন কোড অন্তত ৪ ডিজিটের হতে হবে!');
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMsg('⚠️ নতুন পিন এবং কনফার্ম পিন মেলেনি!');
      return;
    }

    if (pinChangeType === 'admin') {
      onChangeAdminPin(newPin.trim());
      setSuccessMsg('✅ এডমিন পিন কোড পরিবর্তন সফল হয়েছে!');
    } else {
      onChangeEditorPin(newPin.trim());
      setSuccessMsg('✅ এডিটর পিন কোড পরিবর্তন সফল হয়েছে!');
    }

    setNewPin('');
    setConfirmPin('');
  };

  const handleManualBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBlockInput.trim()) return;
    onBlockUser(manualBlockInput.trim());
    setSuccessMsg(`✅ "${manualBlockInput.trim()}" কে ব্লক করা হয়েছে।`);
    setManualBlockInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl">
            {currentRole === 'admin' ? '👑' : currentRole === 'editor' ? '✏️' : '👁️'}
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">
              ব্যবহারকারী রোল ও অ্যাক্সেস
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              বর্তমান মোড: <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {currentRole === 'admin' ? '👑 এডমিন (পূর্ণ নিয়ন্ত্রণ)' : currentRole === 'editor' ? `✏️ এডিটর (${myEditorSession?.name || 'সক্রিয়'})` : '👁️ ভিউয়ার (শুধু দেখা যাবে)'}
              </span>
            </p>
          </div>
        </div>

        {/* Active Role Status Summary Banner */}
        <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Users className="w-4 h-4 text-emerald-500" />
              এডিটর স্লট স্থিতি:
            </span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${isSlotsFull ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'}`}>
              {currentEditorCount}/{maxEditors} জন যুক্ত
            </span>
          </div>

          {activeEditors.length > 0 ? (
            <div className="pt-1 flex flex-wrap gap-1">
              {activeEditors.map((ed, idx) => (
                <span key={ed.id || idx} className="px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-[11px] font-medium flex items-center gap-1">
                  ✏️ {ed.name}
                  {ed.id === currentSessionId && <span className="text-[9px] text-emerald-600 font-bold">(আপনি)</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              বর্তমানে কোনো এডিটর স্লট বুকড নেই (সর্বোচ্চ ৩ জন যুক্ত হতে পারবেন)।
            </p>
          )}
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-medium flex items-center gap-1.5">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Pending / Rejected Request Alert Banners */}
        {myPendingRequest && (
          <div className="mb-3 p-3 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-600 animate-spin" />
              <span>এডমিন অনুমোদনের অপেক্ষায় আছে...</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              আপনার নাম: <span className="font-bold text-slate-900 dark:text-white">"{myPendingRequest.name}"</span>। আপনার পাসওয়ার্ড সঠিক হয়েছে এবং রিকোয়েস্টটি এডমিনের কাছে পাঠানো আছে। এডমিন একসেপ্ট করলে সাথে সাথে এডিটর অ্যাক্সেস পেয়ে যাবেন।
            </p>
          </div>
        )}

        {myRejectedRequest && (
          <div className="mb-3 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>আগের রিকোয়েস্টটি বাতিল করা হয়েছিল</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              এডমিন কর্তৃক আপনার পূর্বের রিকোয়েস্টটি রিজেক্ট করা হয়েছিল। আবার নতুন করে নাম ও সঠিক পাসওয়ার্ড দিয়ে অনুমোদনের রিকোয়েস্ট পাঠাতে পারেন।
            </p>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('login')}
            className={`py-2 px-3 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            🔑 মোড পরিবর্তন / রিকোয়েস্ট
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span>📜 অ্যাক্টিভিটি ও আপডেট হিস্ট্রি</span>
            {sessionLogs.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full text-[10px] font-extrabold">
                {sessionLogs.length}
              </span>
            )}
          </button>

          {currentRole === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('management')}
                className={`py-2 px-3 border-b-2 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === 'management'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span>📥 এডিটর ও রিকোয়েস্ট কন্ট্রোল</span>
                {pendingRequests.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] animate-pulse">
                    {pendingRequests.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`py-2 px-3 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                ⚙️ এডমিন পিন পরিবর্তন
              </button>
            </>
          )}
        </div>

        {activeTab === 'login' ? (
          <div className="space-y-4">
            {/* Active User Switch Button if already logged in */}
            {currentRole !== 'viewer' && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    আপনি এখন {currentRole === 'admin' ? 'এডমিন' : 'এডিটর'} মোডে আছেন
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    লগআউট করলে ভিউয়ার (Read-only) মোডে চলে যাবেন।
                  </span>
                </div>
                <button
                  onClick={onSwitchToViewer}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  লগআউট
                </button>
              </div>
            )}

            {/* Default Password Info Notice */}
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs space-y-1 shadow-xs">
              <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>প্রাথমিক ডিফল্ট পাসওয়ার্ড:</span>
              </div>
              <p className="text-[11px] text-indigo-800 dark:text-indigo-300 leading-relaxed">
                • এডমিন পাসওয়ার্ড: <code className="bg-indigo-100 dark:bg-indigo-900/80 px-1.5 py-0.5 rounded font-bold font-mono">1234</code><br />
                • এডিটর পাসওয়ার্ড: <code className="bg-indigo-100 dark:bg-indigo-900/80 px-1.5 py-0.5 rounded font-bold font-mono">5678</code><br />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                  (শুধুমাত্র এডমিন প্যানেল থেকে এই পাসওয়ার্ড পরিবর্তন করতে পারবেন। এডমিন পরিবর্তন করলে এই ডিফল্ট পাসওয়ার্ডটি আর কাজ করবে না)
                </span>
              </p>
            </div>

            {/* Role Selectors */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                কোন মোডে সাইন ইন করতে চান?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTargetRole('editor')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedTargetRole === 'editor'
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1 text-slate-800 dark:text-slate-100">
                    <span>✏️ এডিটর মোড</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    নাম ও পাসওয়ার্ড দিয়ে এডমিনের কাছে রিকোয়েস্ট পাঠান (সর্বোচ্চ ৩ জন)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTargetRole('admin')}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedTargetRole === 'admin'
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs flex items-center gap-1 text-slate-800 dark:text-slate-100">
                    <span>👑 এডমিন মোড</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    এডমিন পিন দিয়ে সম্পূর্ণ এক্সেস ও অনুমোদন পরিচালনা করুন
                  </p>
                </button>
              </div>
            </div>

            {/* Login / Request Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {selectedTargetRole === 'editor' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    👤 আপনার ইউজার নেম / নাম:
                  </label>
                  <input
                    type="text"
                    value={editorNameInput}
                    onChange={(e) => setEditorNameInput(e.target.value)}
                    placeholder="আপনার ইউজার নেম দিন"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  🔑 {selectedTargetRole === 'admin' ? 'এডমিন পাসওয়ার্ড দিন:' : 'এডিটর পাসওয়ার্ড:'}
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder={selectedTargetRole === 'admin' ? 'এডমিন পাসওয়ার্ড দিন' : 'এডিটর পাসওয়ার্ড দিন'}
                    className="w-full px-3 py-2 pl-9 pr-10 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Key className="w-4 h-4" />
                <span>
                  {selectedTargetRole === 'admin' ? 'এডমিন মোড অ্যাক্টিভ করুন' : 'এডমিনের কাছে এডিটর রিকোয়েস্ট পাঠান'}
                </span>
              </button>
            </form>

            {/* Viewer Option */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
              <button
                type="button"
                onClick={() => {
                  onSwitchToViewer();
                  onClose();
                }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline font-medium cursor-pointer"
              >
                👁️ সাধারণ সদস্য হিসেবে শুধু ডাটা দেখতে চান? (ভিউয়ার মোড)
              </button>
            </div>
          </div>
        ) : activeTab === 'management' ? (
          /* Admin Requests & Editor Management Tab */
          <div className="space-y-4 text-xs">
            
            {/* 1. Pending Editor Requests */}
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
              <h4 className="font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Inbox className="w-4 h-4 text-amber-600" />
                  মুলতুবি এডিটর রিকোয়েস্ট ({pendingRequests.length}):
                </span>
                {pendingRequests.length > 0 && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-normal">
                    অনুমোদন দিলে এডিটর স্লটে যুক্ত হবে
                  </span>
                )}
              </h4>

              {pendingRequests.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 py-1">
                  বর্তমানে নতুন কোনো এডিটর এক্সেস রিকোয়েস্ট পেন্ডিং নেই।
                </p>
              ) : (
                <div className="space-y-2 pt-1">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-amber-200 dark:border-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100 block">
                          👤 {req.name}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {req.requestedAt ? new Date(req.requestedAt).toLocaleTimeString('bn-BD') : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          onClick={() => {
                            onApproveEditorRequest(req.id);
                            setSuccessMsg(`✅ "${req.name}" কে এডিটর হিসেবে অনুমোদন করা হয়েছে!`);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          অনুমোদন
                        </button>

                        <button
                          onClick={() => {
                            onRejectEditorRequest(req.id);
                            setErrorMsg(`❌ "${req.name}" এর রিকোয়েস্টটি বাতিল করা হয়েছে।`);
                          }}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          বাতিল
                        </button>

                        <button
                          onClick={() => {
                            onBlockUser(req.name);
                            setErrorMsg(`🚫 "${req.name}" কে ব্লক করা হয়েছে।`);
                          }}
                          className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          ব্লক
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Currently Active Editors */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4 text-emerald-500" />
                  সক্রিয় এডিটর তালিকা ({activeEditors.length}/{maxEditors}):
                </span>
              </h4>

              {activeEditors.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 py-1">
                  বর্তমানে কোনো সক্রিয় এডিটর নেই।
                </p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {activeEditors.map((ed) => (
                    <div key={ed.id} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100 text-xs">
                        ✏️ {ed.name}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            onRemoveEditor(ed.id);
                            setSuccessMsg(`✅ "${ed.name}" কে এডিটর স্লট থেকে রিমুভ করা হয়েছে।`);
                          }}
                          className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200 rounded text-[11px] font-bold cursor-pointer transition-all active:scale-95"
                        >
                          রিমুভ
                        </button>

                        <button
                          onClick={() => {
                            onBlockUser(ed.name);
                            setErrorMsg(`🚫 "${ed.name}" কে ব্লক ও রিমুভ করা হয়েছে।`);
                          }}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer transition-all active:scale-95 flex items-center gap-0.5"
                        >
                          <Ban className="w-3 h-3" />
                          ব্লক
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeEditors.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClearActiveEditors();
                    setSuccessMsg('✅ সকল এডিটর স্লট ক্লিয়ার করা হয়েছে!');
                  }}
                  className="mt-2 w-full py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg font-bold text-xs cursor-pointer transition-all"
                >
                  🗑️ সকল এডিটরকে একসাথে সাইন-আউট করান
                </button>
              )}
            </div>

            {/* 3. Blocked Users Management */}
            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl space-y-2">
              <h4 className="font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1">
                <Ban className="w-4 h-4 text-rose-600" />
                ব্লকড ইউজার তালিকা ({blockedUsers.length}):
              </h4>

              {blockedUsers.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 py-1">
                  বর্তমানে কোনো ইউজার ব্লকড নেই।
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {blockedUsers.map((name) => (
                    <span key={name} className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      🚫 {name}
                      <button
                        onClick={() => {
                          onUnblockUser(name);
                          setSuccessMsg(`✅ "${name}" কে আনব্লক করা হয়েছে।`);
                        }}
                        className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-600 rounded cursor-pointer"
                        title="আনব্লক করুন"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Manual Block Input */}
              <form onSubmit={handleManualBlockSubmit} className="pt-2 flex gap-1.5">
                <input
                  type="text"
                  value={manualBlockInput}
                  onChange={(e) => setManualBlockInput(e.target.value)}
                  placeholder="ব্লক করার জন্য ইউজার নেম লিখুন..."
                  className="flex-1 px-3 py-1.5 border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 rounded-lg text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  ব্লক করুন
                </button>
              </form>
            </div>
          </div>
        ) : activeTab === 'logs' ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>লাইভ অ্যাক্টিভিটি ও আপডেট লগ ({filteredLogs.length}/{sessionLogs.length})</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  এডমিন ও এডিটরদের করা প্রতিটি পরিবর্তন ও লগইন তথ্য এখানে রিয়েল-টাইমে আপডেট হয়
                </p>
              </div>

              {sessionLogs.length > 0 && onClearSessionLogs && currentRole === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    onClearSessionLogs();
                    setSuccessMsg('✅ সকল অ্যাক্টিভিটি হিস্ট্রি ক্লিয়ার করা হয়েছে!');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ক্লিয়ার অল লগস
                </button>
              )}
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col xs:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="নাম বা বিবরণ দিয়ে খুঁজুন..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl text-xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <div className="flex gap-1 overflow-x-auto text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLogCategory('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    logCategory === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  সকল ({sessionLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLogCategory('update')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    logCategory === 'update'
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  ✏️ আপডেট
                </button>
                <button
                  type="button"
                  onClick={() => setLogCategory('auth')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    logCategory === 'auth'
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  🔑 লগইন/আউট
                </button>
                <button
                  type="button"
                  onClick={() => setLogCategory('reset')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    logCategory === 'reset'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  ⚠️ রিসেট
                </button>
              </div>
            </div>

            {/* Log List */}
            {filteredLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <Clock className="w-6 h-6 mx-auto mb-1 text-slate-300 dark:text-slate-600" />
                <p>কোনো অ্যাক্টিভিটি হিস্ট্রি রেকর্ড পাওয়া যায়নি</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {filteredLogs.map((log) => {
                  const dateFormatted = log.timestamp ? new Date(log.timestamp).toLocaleString('bn-BD', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }) : '';

                  const getActionBadge = (action: string) => {
                    switch (action) {
                      case 'login':
                        return { text: '🟢 লগইন', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300' };
                      case 'logout':
                        return { text: '🔴 লগআউট', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300' };
                      case 'approved':
                        return { text: '✅ অনুমোদন প্রাপ্ত', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300' };
                      case 'rejected':
                        return { text: '🚫 রিকোয়েস্ট বাতিল', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300' };
                      case 'removed':
                        return { text: '🗑️ স্লট রিমুভড', cls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300' };
                      case 'update':
                        return { text: '✏️ ডেটা আপডেট', cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300' };
                      case 'reset':
                        return { text: '⚠️ রিসেট', cls: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300 border-fuchsia-300' };
                      default:
                        return { text: action, cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300' };
                    }
                  };

                  const badge = getActionBadge(log.action);

                  return (
                    <div
                      key={log.id}
                      className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {log.name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold border border-slate-200 dark:border-slate-700">
                            {log.role === 'admin' ? '👑 এডমিন' : log.role === 'editor' ? '✏️ এডিটর' : '👁️ ভিউয়ার'}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded border text-[10px] font-extrabold ${badge.cls}`}>
                            {badge.text}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {dateFormatted}
                        </span>
                      </div>

                      {log.details && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                          {log.details}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Admin Settings Tab (PIN Change) - Strictly Admin Only */
          <div className="space-y-4">
            {currentRole !== 'admin' ? (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 font-bold text-center">
                ⚠️ পাসওয়ার্ড সেট ও পরিবর্তনের অনুমতি শুধুমাত্র এডমিন মোডে রয়েছে।
              </div>
            ) : (
              <form onSubmit={handlePinChangeSubmit} className="space-y-3 p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  পাসওয়ার্ড সেট / পরিবর্তন (শুধুমাত্র এডমিন):
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  এখান থেকে এডমিন ও এডিটর পাসওয়ার্ড সেট করতে পারবেন। নতুন পাসওয়ার্ড সেভ করার সাথে সাথে ডিফল্ট পাসওয়ার্ড (1234 / 5678) বাতিল হয়ে যাবে এবং নতুন পাসওয়ার্ড কার্যকর হবে।
                </p>

                <div className="flex gap-2 text-xs font-bold pt-1">
                  <label className="flex-1 flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input
                      type="radio"
                      name="pintype"
                      checked={pinChangeType === 'admin'}
                      onChange={() => setPinChangeType('admin')}
                    />
                    <span>👑 এডমিন পাসওয়ার্ড</span>
                  </label>
                  <label className="flex-1 flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <input
                      type="radio"
                      name="pintype"
                      checked={pinChangeType === 'editor'}
                      onChange={() => setPinChangeType('editor')}
                    />
                    <span>✏️ এডিটর পাসওয়ার্ড</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    নতুন {pinChangeType === 'admin' ? 'এডমিন' : 'এডিটর'} পাসওয়ার্ড:
                  </label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder={`নতুন ${pinChangeType === 'admin' ? 'এডমিন' : 'এডিটর'} পাসওয়ার্ড দিন`}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    পাসওয়ার্ড কনফার্ম করুন:
                  </label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="পুনরায় পাসওয়ার্ডটি লিখুন"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95"
                >
                  পাসওয়ার্ড পরিবর্তন করুন
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
