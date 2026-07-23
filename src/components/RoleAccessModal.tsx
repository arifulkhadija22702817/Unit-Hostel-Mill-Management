import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, X, Check, Eye, EyeOff, Users, LogOut, AlertTriangle, ShieldAlert, UserCheck, UserX, Ban, Unlock, Clock, Inbox } from 'lucide-react';
import { EditorAccessRequest } from '../types';

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
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'management' | 'settings'>('login');
  const [selectedTargetRole, setSelectedTargetRole] = useState<'admin' | 'editor'>('editor');
  
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
        setErrorMsg('⚠️ দয়া করে আপনার নাম লিখুন!');
        return;
      }

      // Check if user is blocked
      if (blockedUsers.includes(trimmedName) || blockedUsers.includes(currentSessionId)) {
        setErrorMsg(`⚠️ "${trimmedName}" কে এডমিন কর্তৃক ব্লক করা হয়েছে! আপনি এডিটর অ্যাক্সেস পাবেন না।`);
        return;
      }

      if (pinInput.trim() !== effectiveEditorPin) {
        setErrorMsg('❌ ভুল এডিটর পিন কোড! (ডিফল্ট এডিটর পাসওয়ার্ড)');
        return;
      }

      if (isSlotsFull) {
        setErrorMsg(`⚠️ দুঃখিত, ইতোমধ্যে সর্বোচ্চ ৩ জন এডিটর সক্রিয় আছেন!`);
        return;
      }

      if (onDirectEditorLogin) {
        onDirectEditorLogin(trimmedName, effectiveEditorPin);
        setSuccessMsg(`✅ স্বাগতম ${trimmedName}! আপনার এডিটর সেসন সফলভাবে সেভ করা হয়েছে।`);
        setPinInput('');
        setEditorNameInput('');
        onClose();
        return;
      }

      // Fallback request flow
      onRequestEditorAccess(trimmedName);
      setSuccessMsg(`✅ আপনার অ্যাক্সেস রিকোয়েস্ট এডমিনের কাছে পাঠানো হয়েছে!`);
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
        ) : (
          /* Admin Settings Tab (PIN Change) */
          <div className="space-y-4">
            <form onSubmit={handlePinChangeSubmit} className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                পিন কোড সেট/পরিবর্তন:
              </h4>

              <div className="flex gap-2 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="pintype"
                    checked={pinChangeType === 'admin'}
                    onChange={() => setPinChangeType('admin')}
                  />
                  <span>👑 এডমিন পিন</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="pintype"
                    checked={pinChangeType === 'editor'}
                    onChange={() => setPinChangeType('editor')}
                  />
                  <span>✏️ এডিটর পিন</span>
                </label>
              </div>

              <div>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder={`নতুন ${pinChangeType === 'admin' ? 'এডমিন' : 'এডিটর'} পিন (৪ ডিজিট)`}
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <div>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="কনফার্ম করুন"
                  className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                পিন সেভ করুন
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
