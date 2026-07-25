import React, { useState } from 'react';
import { Wallet, Plus, Trash2, FileSpreadsheet, RotateCcw, Clock, Lock, Check, AlertTriangle } from 'lucide-react';
import { MillMember, DepositDataMap } from '../types';
import { UserRole } from './RoleAccessModal';
import { MAX_DEPOSIT_ENTRIES } from '../constants';
import { exportToExcel } from '../utils/exportUtils';
import { canRemoveDeposit, getBangladeshTime, getBangladeshDateString } from '../utils/timeUtils';

interface TabDepositProps {
  userRole?: UserRole;
  depositData: DepositDataMap;
  setDepositData: React.Dispatch<React.SetStateAction<DepositDataMap>>;
  members: MillMember[];
  onResetDeposit: () => void;
  onRequestConfirm: (msg: string, action: () => void) => void;
  onLogActivity?: (details: string) => void;
}

export const TabDeposit: React.FC<TabDepositProps> = ({
  userRole = 'viewer',
  depositData,
  setDepositData,
  members,
  onResetDeposit,
  onRequestConfirm,
  onLogActivity,
}) => {
  // Deposit Form State
  const [selectedMember, setSelectedMember] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(getBangladeshDateString());

  // Extra/Loan Form State
  const [extraMember, setExtraMember] = useState('');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraMsg, setExtraMsg] = useState('');

  // Add Deposit
  const handleAddDeposit = () => {
    if (!selectedMember) {
      alert('⚠️ দয়া করে একটি সদস্য নির্বাচন করুন!');
      return;
    }
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('⚠️ দয়া করে একটি সঠিক জমার পরিমাণ লিখুন!');
      return;
    }
    if (!depositDate) {
      alert('⚠️ দয়া করে তারিখ নির্বাচন করুন!');
      return;
    }

    const currentEntries = depositData[selectedMember]?.entries || [];
    if (currentEntries.length >= MAX_DEPOSIT_ENTRIES) {
      alert(`⚠️ ${selectedMember} এর জন্য সর্বোচ্চ ${MAX_DEPOSIT_ENTRIES} বার জমা নেওয়া সম্ভব!`);
      return;
    }

    onRequestConfirm(
      `${selectedMember} এর ${amountNum} ৳ জমা দিতে চান? তারিখ: ${depositDate}`,
      () => {
        const now = getBangladeshTime();
        const timeStr = now.toLocaleTimeString('bn-BD', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        const timestamp = now.toISOString();

        setDepositData(prev => {
          const mData = prev[selectedMember] || { entries: [], total: 0, extra: 0 };
          const newEntries = [
            ...mData.entries,
            { amount: amountNum, date: depositDate, time: timeStr, timestamp }
          ];
          const newTotal = newEntries.reduce((acc, e) => acc + e.amount, 0);

          return {
            ...prev,
            [selectedMember]: {
              ...mData,
              entries: newEntries,
              total: newTotal,
            }
          };
        });

        setDepositAmount('');
        if (onLogActivity) {
          onLogActivity(`জমা হিসাব: "${selectedMember}" এর ${amountNum} ৳ জমা যুক্ত করা হয়েছে (তারিখ: ${depositDate})`);
        }
        alert(`✅ ${selectedMember} এর ${amountNum} টাকা জমা নেওয়া হয়েছে!`);
      }
    );
  };

  // Remove Deposit Entry
  const handleRemoveDepositEntry = (name: string, index: number) => {
    const entry = depositData[name]?.entries?.[index];
    if (!entry) return;

    if (userRole === 'editor' && !canRemoveDeposit(entry.timestamp)) {
      alert('⏰ জমা দেওয়ার ১ ঘণ্টা পার হয়ে যাওয়ায় এটি লক হয়ে গেছে!\nএডিটররা ১ ঘণ্টার পর আর রিমুভ করতে পারবে না। এডমিন পরিবর্তন করতে পারবেন।');
      return;
    }

    onRequestConfirm(`"${name}" এর ${index + 1} নম্বর জমাটি (${entry.amount} ৳) রিমুভ করবেন?`, () => {
      setDepositData(prev => {
        const mData = prev[name];
        if (!mData) return prev;
        const newEntries = mData.entries.filter((_, i) => i !== index);
        const newTotal = newEntries.reduce((acc, e) => acc + e.amount, 0);

        return {
          ...prev,
          [name]: {
            ...mData,
            entries: newEntries,
            total: newTotal,
          }
        };
        if (onLogActivity) {
          onLogActivity(`জমা হিসাব: "${name}" এর ${index + 1} নম্বর জমা (${entry.amount} ৳) রিমুভ করা হয়েছে`);
        }
      });
    });
  };

  // Add Extra / Loan
  const handleAddExtra = () => {
    if (!extraMember) {
      setExtraMsg('⚠️ সদস্য নির্বাচন করুন!');
      return;
    }
    const val = parseFloat(extraAmount);
    if (isNaN(val) || val <= 0) {
      setExtraMsg('⚠️ সঠিক টাকার পরিমাণ লিখুন!');
      return;
    }

    const currentExtra = depositData[extraMember]?.extra || 0;
    const newExtra = currentExtra + val;

    onRequestConfirm(
      `${extraMember} এর ধার/এক্সট্রা ${val} ৳ যোগ করতে চান? (বর্তমান: ${currentExtra} ৳, মোট হবে: ${newExtra} ৳)`,
      () => {
        setDepositData(prev => ({
          ...prev,
          [extraMember]: {
            ...(prev[extraMember] || { entries: [], total: 0, extra: 0 }),
            extra: newExtra,
          }
        }));

        setExtraAmount('');
        setExtraMsg(`✅ ${extraMember} এর ধার/এক্সট্রা ${val} ৳ যোগ করা হয়েছে!`);
        setTimeout(() => setExtraMsg(''), 4000);
      }
    );
  };

  // Remove Extra / Loan
  const handleRemoveExtra = () => {
    if (!extraMember) {
      setExtraMsg('⚠️ সদস্য নির্বাচন করুন!');
      return;
    }

    const currentExtra = depositData[extraMember]?.extra || 0;
    if (currentExtra <= 0) {
      setExtraMsg(`⚠️ ${extraMember} এর কোনো ধার/এক্সট্রা নেই!`);
      return;
    }

    const val = parseFloat(extraAmount);
    const removeVal = (!isNaN(val) && val > 0) ? val : currentExtra;

    if (removeVal > currentExtra) {
      setExtraMsg(`⚠️ ধার/এক্সট্রা (${currentExtra} ৳) থেকে বেশি রিমুভ করা যাবে না!`);
      return;
    }

    const newExtra = currentExtra - removeVal;

    onRequestConfirm(
      `${extraMember} এর ধার/এক্সট্রা থেকে ${removeVal} ৳ রিমুভ করতে চান? (অবশিষ্ট: ${newExtra} ৳)`,
      () => {
        setDepositData(prev => ({
          ...prev,
          [extraMember]: {
            ...(prev[extraMember] || { entries: [], total: 0, extra: 0 }),
            extra: newExtra,
          }
        }));

        setExtraAmount('');
        setExtraMsg(`✅ ${extraMember} এর ধার/এক্সট্রা থেকে ${removeVal} ৳ রিমুভ করা হয়েছে!`);
        setTimeout(() => setExtraMsg(''), 4000);
      }
    );
  };

  // Export Excel
  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      ['জমা ও ধার হিসাব রিপোর্ট'],
      ['তারিখ:', getBangladeshDateString()],
      [],
      ['ক্রমিক', 'নাম', 'জমা ১', 'জমা ২', 'জমা ৩', 'জমা ৪', 'জমা ৫', 'মোট জমা', 'ধার/এক্সট্রা']
    ];

    const sortedNames = Object.keys(depositData).sort();
    sortedNames.forEach((name, idx) => {
      const mData = depositData[name];
      const entries = mData.entries || [];
      let row: (string | number)[] = [idx + 1, name];

      for (let i = 0; i < MAX_DEPOSIT_ENTRIES; i++) {
        if (i < entries.length) {
          row.push(`${entries[i].amount} ৳ (${entries[i].date} ${entries[i].time})`);
        } else {
          row.push('-');
        }
      }

      row.push(mData.total || 0);
      row.push(mData.extra || 0);
      rows.push(row);
    });

    exportToExcel(`জমা_ধার_${getBangladeshDateString()}`, 'জমা ও ধার', rows);
  };

  // Total Summary
  const sortedMemberNames = Object.keys(depositData).sort();
  const grandTotalDepositSum = sortedMemberNames.reduce((acc, name) => acc + (depositData[name]?.total || 0), 0);

  return (
    <div className="space-y-4">
      {/* Deposit Input Card */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 border-b pb-2">
          <Wallet className="w-4 h-4 text-emerald-600" /> 💰 নতুন জমা যোগ করুন
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">👤 সদস্য নির্বাচন</label>
            <select
              value={selectedMember}
              onChange={e => setSelectedMember(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            >
              <option value="">-- নির্বাচন করুন --</option>
              {sortedMemberNames.map((name, idx) => {
                const count = depositData[name]?.entries?.length || 0;
                return (
                  <option key={name} value={name}>
                    {idx + 1}. {name} ({count}/{MAX_DEPOSIT_ENTRIES})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">💰 জমা টাকা (৳)</label>
            <input
              type="number"
              min="0"
              placeholder="টাকা"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">📅 তারিখ</label>
            <input
              type="date"
              value={depositDate}
              onChange={e => setDepositDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>

          <button
            onClick={handleAddDeposit}
            className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1 h-9"
          >
            <Plus className="w-4 h-4" /> জমা যোগ করুন
          </button>
        </div>
      </div>

      {/* Extra / Loan Input Card */}
      <div className="bg-rose-50/80 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-800 space-y-3">
        <h3 className="font-bold text-sm text-rose-800 dark:text-rose-200 flex items-center gap-1.5 border-b border-rose-200 dark:border-rose-800 pb-2">
          💰 ধার/এক্সট্রা খরচ ইনপুট
        </h3>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">👤 সদস্য নির্বাচন</label>
            <select
              value={extraMember}
              onChange={e => setExtraMember(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            >
              <option value="">-- নির্বাচন করুন --</option>
              {sortedMemberNames.map((name, idx) => {
                const ex = depositData[name]?.extra || 0;
                return (
                  <option key={name} value={name}>
                    {idx + 1}. {name} (বর্তমান: {ex} ৳)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">💰 ধার/এক্সট্রা টাকা (৳)</label>
            <input
              type="number"
              min="0"
              placeholder="টাকা"
              value={extraAmount}
              onChange={e => setExtraAmount(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleAddExtra}
              className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1 h-9"
            >
              <Plus className="w-4 h-4" /> সেট করুন
            </button>
            <button
              onClick={handleRemoveExtra}
              className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs active:scale-95 flex items-center justify-center gap-1 h-9"
            >
              <Trash2 className="w-4 h-4" /> রিমুভ
            </button>
          </div>
        </div>

        {extraMsg && (
          <p className="text-xs font-bold text-rose-800 dark:text-rose-200 bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 p-2 rounded-lg text-center">
            {extraMsg}
          </p>
        )}
      </div>

      {/* Rules Notice */}
      <div className="bg-sky-50 dark:bg-sky-950/40 border-l-4 border-sky-500 p-2.5 rounded-lg text-xs text-sky-900 dark:text-sky-200 leading-relaxed space-y-1">
        <p className="font-bold flex items-center gap-1">
          <Clock className="w-4 h-4 text-sky-600" /> জমা রিমুভ নিয়ম:
        </p>
        <p className="text-[11px]">
          জমা দেওয়ার ১ ঘন্টার মধ্যে রিমুভ করা যাবে। ১ ঘন্টা পার হয়ে গেলে পরিবর্তন লক হয়ে যাবে।
        </p>
      </div>

      {/* Deposit Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] relative">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold w-10">ক্রমিক</th>
                <th className="py-2 px-3 text-left border-b border-emerald-800 font-bold sticky left-0 bg-emerald-700 z-30 min-w-[100px]">
                  নাম
                </th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">জমা ১</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">জমা ২</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">জমা ৩</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">জমা ৪</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">জমা ৫</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-emerald-800">
                  মোট জমা
                </th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-rose-800">
                  ধার/এক্সট্রা
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {sortedMemberNames.map((name, idx) => {
                const mData = depositData[name] || { entries: [], total: 0, extra: 0 };
                const entries = mData.entries || [];

                return (
                  <tr key={name} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 font-semibold sticky left-0 z-10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                      {name}
                    </td>
                    {Array.from({ length: MAX_DEPOSIT_ENTRIES }).map((_, i) => {
                      if (i < entries.length) {
                        const entry = entries[i];
                        const canRem = userRole === 'admin' || (userRole === 'editor' && canRemoveDeposit(entry.timestamp));

                        return (
                          <td key={i} className="py-1.5 px-2 text-center border-r border-slate-100 dark:border-slate-700/50">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {entry.amount} ৳
                            </div>
                            <div className="text-[9px] text-slate-500 dark:text-slate-400">
                              {entry.date} {entry.time}
                            </div>
                            {canRem ? (
                              <button
                                onClick={() => handleRemoveDepositEntry(name, i)}
                                className="mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-200 rounded hover:bg-rose-200 dark:hover:bg-rose-900 transition-colors cursor-pointer"
                              >
                                ✕ রিমুভ
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-400 flex items-center justify-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> লকড
                              </span>
                            )}
                          </td>
                        );
                      }

                      return (
                        <td key={i} className="py-2 px-2 text-center text-slate-300 dark:text-slate-600">
                          -
                        </td>
                      );
                    })}
                    <td className="py-2 px-2 text-center font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                      {mData.total || 0} ৳
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-rose-600 dark:text-rose-300 text-sm">
                      {mData.extra || 0} ৳
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleExportExcel}
          className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>

        <button
          onClick={() => onRequestConfirm('আপনি কি জমা ও ধারের সব তথ্য রিসেট করতে চান?', onResetDeposit)}
          className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> রিসেট
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-1">
          💰 জমা ও ধার সারাংশ
        </h3>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট সদস্য:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sortedMemberNames.length} জন</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">সর্বমোট জমা:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">{grandTotalDepositSum} ৳</span>
          </div>
        </div>
      </div>
    </div>
  );
};
