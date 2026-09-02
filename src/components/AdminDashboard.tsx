import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Users, 
  UserX, 
  LogOut, 
  Key, 
  Edit3, 
  Trash2, 
  Plus, 
  Check, 
  AlertTriangle, 
  Activity, 
  Lock, 
  Eye, 
  CheckCircle2, 
  Clock, 
  UserMinus,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ConfiguredEditor } from '../lib/firebase';
import { ActiveEditorSession } from './RoleAccessModal';
import { UserSessionLog } from '../types';

interface AdminDashboardProps {
  adminPin: string;
  onUpdateAdminPin: (newPin: string) => void;
  configuredEditors: ConfiguredEditor[];
  onSaveConfiguredEditors: (editors: ConfiguredEditor[]) => void;
  activeEditors: ActiveEditorSession[];
  onForceLogoutEditor: (editorId: string) => void;
  onForceLogoutAllEditors?: () => void;
  blockedUsers?: string[];
  onBlockEditorName?: (name: string) => void;
  onUnblockUser?: (name: string) => void;
  sessionLogs: UserSessionLog[];
  onAdminLogout: () => void;
  onViewMessData?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminPin,
  onUpdateAdminPin,
  configuredEditors,
  onSaveConfiguredEditors,
  activeEditors,
  onForceLogoutEditor,
  onForceLogoutAllEditors,
  blockedUsers = [],
  onBlockEditorName,
  onUnblockUser,
  sessionLogs,
  onAdminLogout,
  onViewMessData,
}) => {
  const [activeTab, setActiveTab] = useState<'editors' | 'active' | 'pin' | 'logs'>('editors');

  // Configured Editor Form State
  const [editorName, setEditorName] = useState('');
  const [editorEmail, setEditorEmail] = useState('');
  const [editorPin, setEditorPin] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Admin PIN Change Form
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);

  // Block user form
  const [blockNameInput, setBlockNameInput] = useState('');

  // Alerts
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => {
      setMsg(null);
    }, 4000);
  };

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    const name = editorName.trim();
    const email = editorEmail.trim().toLowerCase();
    const pin = editorPin.trim();

    if (!name) {
      showNotification('error', '⚠️ অনুগ্রহ করে এডিটরের নাম লিখুন!');
      return;
    }
    if (!email || !email.includes('@')) {
      showNotification('error', '⚠️ অনুগ্রহ করে সঠিক জিমেইল (Gmail) আইডি লিখুন!');
      return;
    }
    if (!pin || pin.length < 4) {
      showNotification('error', '⚠️ অনুগ্রহ করে অন্তত ৪-সংখ্যার গোপনীয় পিন কোড দিন!');
      return;
    }

    const updated = [...configuredEditors];

    if (editingIndex !== null && editingIndex >= 0 && editingIndex < updated.length) {
      updated[editingIndex] = { name, email, pin };
      onSaveConfiguredEditors(updated);
      showNotification('success', `✅ এডিটর "${name}" এর জিমেইল ও পিন সফলভাবে আপডেট করা হয়েছে!`);
    } else {
      if (updated.length >= 3) {
        showNotification('error', '⚠️ সর্বোচ্চ ৩ জন এডিটর কনফিগার করা সম্ভব! নতুন যোগ করতে আগের কোনো এডিটর মুছে ফেলুন।');
        return;
      }
      const isDuplicate = updated.some(ed => ed.email.toLowerCase() === email);
      if (isDuplicate) {
        showNotification('error', '⚠️ এই জিমেইলটি ইতোমধ্যে অন্য এডিটরের জন্য সেট করা আছে!');
        return;
      }
      updated.push({ name, email, pin });
      onSaveConfiguredEditors(updated);
      showNotification('success', `✅ নতুন এডিটর "${name}" সফলভাবে যুক্ত করা হয়েছে!`);
    }

    setEditorName('');
    setEditorEmail('');
    setEditorPin('');
    setEditingIndex(null);
  };

  const handleDeleteEditor = (idx: number) => {
    const target = configuredEditors[idx];
    const updated = configuredEditors.filter((_, i) => i !== idx);
    onSaveConfiguredEditors(updated);
    showNotification('success', `🗑️ এডিটর "${target?.name || ''}" কে তালিকা থেকে মুছে ফেলা হয়েছে।`);
    if (editingIndex === idx) {
      setEditorName('');
      setEditorEmail('');
      setEditorPin('');
      setEditingIndex(null);
    }
  };

  const handleUpdatePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAdminPin = adminPin || '1234';

    if (currentPinInput !== effectiveAdminPin) {
      showNotification('error', '❌ বর্তমান এডমিন পিনটি ভুল হয়েছে!');
      return;
    }
    if (!newPinInput || newPinInput.length < 4) {
      showNotification('error', '⚠️ নতুন পিন অন্তত ৪ সংখ্যার হতে হবে!');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      showNotification('error', '⚠️ নতুন পিন ও কনফার্ম পিন মিলছে না!');
      return;
    }

    onUpdateAdminPin(newPinInput);
    showNotification('success', '🎉 এডমিন মাস্টার পিন কোড সফলভাবে পরিবর্তন করা হয়েছে!');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  const handleBlockUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockNameInput.trim()) return;
    if (onBlockEditorName) {
      onBlockEditorName(blockNameInput.trim());
      showNotification('success', `🚫 ইউজার/এডিটর "${blockNameInput.trim()}" কে সফলভাবে ব্লক করা হয়েছে!`);
      setBlockNameInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Top Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-purple-900 to-slate-900 border-2 border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shadow-amber-400/30 shrink-0">
              👑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-amber-200">
                  এডমিন কন্ট্রোল প্যানেল
                </h1>
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                এখান থেকে এডিটরদের Gmail ও পিন নির্ধারণ করুন, সেশন ব্লক/লগআউট করুন এবং এডমিন সিকিউরিটি নিয়ন্ত্রণ করুন।
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 self-start md:self-auto">
            {onViewMessData && (
              <button
                type="button"
                onClick={onViewMessData}
                className="w-full px-5 py-3.5 bg-slate-800/90 hover:bg-slate-700 text-slate-100 font-extrabold text-base rounded-xl border border-emerald-400 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-md"
                >
                <Eye className="w-5 h-5 text-cyan-400" />
                <span>মেস হিসাব ও হাজিরা শিট দেখুন</span>
              </button>
            )}

            <button
              type="button"
              onClick={onAdminLogout}
              className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-900/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>এডমিন লগআউট (Exit to View Mode)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notification toast */}
      {msg && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 shadow-md transition-all ${
            msg.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-500/20 border-rose-500/40 text-rose-900 dark:text-rose-200'
          }`}
        >
          {msg.type === 'success' ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Admin Nav Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('editors')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'editors'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>৩ জন এডিটর কনফিগারেশন (Gmail & PIN)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
            {configuredEditors.length}/৩
          </span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'active'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <UserX className="w-4 h-4" />
          <span>সক্রিয় এডিটর ও ব্লক কন্ট্রোল</span>
          {activeEditors.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-bold animate-pulse">
              {activeEditors.length} জন লাইভ
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('pin')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'pin'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>এডমিন মাস্টার পিন পরিবর্তন</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'logs'
              ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>অ্যাক্টিভিটি ও সিকিউরিটি লগ</span>
        </button>
      </div>

      {/* TAB 1: 3 EDITORS GMAIL & PIN SETUP */}
      {activeTab === 'editors' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Editor Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800/80 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
                  {editingIndex !== null ? '✏️' : '➕'}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    {editingIndex !== null ? 'এডিটর তথ্য সম্পাদনা করুন' : 'নতুন এডিটর যোগ করুন'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    এডমিন নির্ধারিত Gmail ও PIN দিয়ে এডিটর লগইন করবে
                  </p>
                </div>
              </div>
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingIndex(null);
                    setEditorName('');
                    setEditorEmail('');
                    setEditorPin('');
                  }}
                  className="text-xs text-rose-500 hover:underline font-bold"
                >
                  বাতিল
                </button>
              )}
            </div>

            <form onSubmit={handleSaveEditor} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ১. এডিটরের নাম:
                </label>
                <input
                  type="text"
                  value={editorName}
                  onChange={(e) => setEditorName(e.target.value)}
                  placeholder="যেমন: আরিফ / রাকিব"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ২. অনুমোদিত জিমেইল আইডি (Gmail Address):
                </label>
                <input
                  type="email"
                  value={editorEmail}
                  onChange={(e) => setEditorEmail(e.target.value)}
                  placeholder="editor@gmail.com"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  * ৩D ATM কার্ডে এডিটরকে এই নির্দিষ্ট জিমেইল দিয়ে পাঞ্চ করতে হবে।
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ৩. এডিটরের গোপনীয় পিন কোড (Password/PIN):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={editorPin}
                  onChange={(e) => setEditorPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="যেমন: 5678 (৪-৬ ডিজিট)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                  * এই পিন কোডটি এডিটরকে দিন। সে এটি দিয়ে এডিটর মোড আনলক করবে।
                </span>
              </div>

              <button
                type="submit"
                disabled={configuredEditors.length >= 3 && editingIndex === null}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingIndex !== null ? 'এডিটর তথ্য আপডেট করুন' : '➕ এডিটর কনফিগার করুন ও সংরক্ষণ করুন'}
                </span>
              </button>
            </form>
          </div>

          {/* Right Column: List of 3 Editors */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>👥 নির্ধারিত এডিটর তালিকা</span>
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-mono font-bold">
                    {configuredEditors.length} / ৩ জন
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  নিচের ৩ জন এডিটর ছাড়া অন্য কেউ এডিট বা পরিবর্তনের সুযোগ পাবে না
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {configuredEditors.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <span className="text-3xl">👥</span>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    এখনও কোনো এডিটর যুক্ত করা হয়নি!
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    বাম পাশের ফর্ম থেকে সর্বোচ্চ ৩ জন এডিটরের নাম, জিমেইল ও পিন সেট করে দিন।
                  </p>
                </div>
              ) : (
                configuredEditors.map((ed, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 dark:bg-slate-800/70 border-2 border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-emerald-400 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            👤 {ed.name}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-md text-[10px] font-mono font-bold">
                            PIN: {ed.pin}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                          <span>📧 {ed.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setEditorName(ed.name);
                          setEditorEmail(ed.email);
                          setEditorPin(ed.pin);
                          setEditingIndex(idx);
                        }}
                        className="px-3 py-1.5 bg-sky-100 hover:bg-sky-200 text-sky-800 dark:bg-sky-950 dark:text-sky-300 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>এডিট</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEditor(idx)}
                        className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>মুছুন</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Helper Card */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <span className="text-base shrink-0">💡</span>
              <p className="text-[11px] leading-relaxed">
                <strong>কিভাবে এডিটর লগইন করবে?</strong> এডিটররা ওয়েবসাইটে ঢুকে ৩D ATM কার্ডের ভেতর তাদের এডমিন-সেট করা জিমেইল এবং পিন ইনপুট দিয়ে পাঞ্চ করবে। তথ্য মিলে গেলেই তারা এডিটর হিসেবে মেসের হাজিরা ও হিসাব পরিবর্তন করতে পারবে।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACTIVE SESSIONS & BLOCK CONTROL */}
      {activeTab === 'active' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Active Live Editors */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>⚡ বর্তমানে লাইভ এডিটর সেশন</span>
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 rounded-full text-xs font-bold">
                    {activeEditors.length} জন সক্রিয়
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  যেকোনো সময় অনাকাঙ্ক্ষিত এডিটরকে সঙ্গে সঙ্গে ফোর্স লগআউট করে বের করে দিন
                </p>
              </div>

              {activeEditors.length > 1 && onForceLogoutAllEditors && (
                <button
                  type="button"
                  onClick={onForceLogoutAllEditors}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  সবাইকে লগআউট করুন
                </button>
              )}
            </div>

            <div className="space-y-3">
              {activeEditors.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <span className="text-3xl">💤</span>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    বর্তমানে কোনো এডিটর অনলাইন সেশনে নেই।
                  </p>
                </div>
              ) : (
                activeEditors.map((ed) => (
                  <div
                    key={ed.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-purple-200 dark:border-purple-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <div>
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>👤 {ed.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({ed.id.slice(0, 8)})</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          লগইন সময়: {new Date(ed.joinedAt).toLocaleTimeString('bn-BD')}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onForceLogoutEditor(ed.id)}
                      className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl flex items-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>ফোর্স লগআউট</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Block Control Column */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-500" />
                <span>ইউজার / এডিটর ব্লক লিস্ট</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                নির্দিষ্ট কোনো নাম বা ডিভাইসকে এডিটর রিকোয়েস্ট দেওয়া থেকে ব্লক করুন
              </p>
            </div>

            {/* Block Input Form */}
            {onBlockEditorName && (
              <form onSubmit={handleBlockUserSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={blockNameInput}
                  onChange={(e) => setBlockNameInput(e.target.value)}
                  placeholder="ব্লক করার নাম বা জিমেইল"
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  🚫 ব্লক করুন
                </button>
              </form>
            )}

            {/* Blocked List */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {blockedUsers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-4">
                  কোনো ইউজার বর্তমানে ব্লক লিস্টে নেই।
                </p>
              ) : (
                blockedUsers.map((blockedName, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-rose-900 dark:text-rose-200">
                      🚫 {blockedName}
                    </span>
                    {onUnblockUser && (
                      <button
                        type="button"
                        onClick={() => onUnblockUser(blockedName)}
                        className="text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                      >
                        আনব্লক করুন
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN MASTER PIN CHANGE */}
      {activeTab === 'pin' && (
        <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-800/80 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-lg">
              🔑
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                এডমিন মাস্টার পিন পরিবর্তন (Admin PIN)
              </h3>
              <p className="text-xs text-slate-500">
                এই মাস্টার পিন দিয়ে এডমিন মোড এবং সকল কনফিগারেশন আনলক করা হয়।
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdatePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                বর্তমান এডমিন পিন কোড:
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                maxLength={6}
                value={currentPinInput}
                onChange={(e) => setCurrentPinInput(e.target.value)}
                placeholder="বর্তমান পিন দিন (ডিফল্ট: 1234)"
                className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  নতুন এডমিন পিন (New PIN):
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="যেমন: 4321"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  নতুন পিন নিশ্চিত করুন:
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="পুনরায় নতুন পিন দিন"
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs font-mono font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPin}
                  onChange={(e) => setShowPin(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>পিন কোড দৃশ্যমান করুন</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/30 transition-all active:scale-95 cursor-pointer"
            >
              🎉 এডমিন পিন আপডেট করুন
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-500" />
                <span>রিয়েলটাইম অ্যাক্টিভিটি ও সিকিউরিটি লগ</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                কে কখন লগইন করেছে, ডাটা আপডেট করেছে বা পাসওয়ার্ড পরিবর্তন করেছে তার বিস্তারিত রেকর্ড
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              মোট: {sessionLogs.length} টি রেকর্ড
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {sessionLogs.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-8">
                এখনও কোনো লগ রেকর্ড নেই।
              </p>
            ) : (
              sessionLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">
                      {log.action === 'login' ? '🔑' : log.action === 'logout' ? '🚪' : log.action === 'update' ? '✏️' : '⚙️'}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-100">
                        {log.name} <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">{log.role}</span>
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {log.details}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0 self-end sm:self-auto">
                    {new Date(log.timestamp).toLocaleString('bn-BD')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
