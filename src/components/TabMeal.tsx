import React, { useState } from 'react';
import { Plus, FileSpreadsheet, Printer, RotateCcw, Save, Eye, Trash2, CheckSquare, Square, Info, Download, Database } from 'lucide-react';
import { MillMember, HistoryEntry } from '../types';
import { exportToExcel, triggerPrint } from '../utils/exportUtils';
import { formatBnTime } from '../utils/timeUtils';

interface TabMealProps {
  userRole?: string;
  millDate: string;
  setMillDate: (d: string) => void;
  millManager: string;
  setMillManager: (m: string) => void;
  millSmall: number;
  setMillSmall?: (val: number) => void;
  millBig: number;
  setMillBig?: (val: number) => void;
  millTotalMeals: number;
  millMembers: MillMember[];
  setMillMembers: React.Dispatch<React.SetStateAction<MillMember[]>>;
  fineEnabled: boolean;
  guestRate: number;
  historyList: HistoryEntry[];
  onSaveHistory: () => void;
  onResetMill: () => void;
  onRestoreHistorySnapshot?: (entry: HistoryEntry) => void;
  onDeleteHistoryEntry?: (index: number) => void;
  onClearAllHistory?: () => void;
  onRequestConfirm: (msg: string, action: () => void) => void;
}

export const TabMeal: React.FC<TabMealProps> = ({
  userRole,
  millDate,
  setMillDate,
  millManager,
  setMillManager,
  millSmall,
  setMillSmall,
  millBig,
  setMillBig,
  millTotalMeals,
  millMembers,
  setMillMembers,
  fineEnabled,
  guestRate,
  historyList,
  onSaveHistory,
  onResetMill,
  onRestoreHistorySnapshot,
  onDeleteHistoryEntry,
  onClearAllHistory,
  onRequestConfirm,
}) => {
  const [showHistoryData, setShowHistoryData] = useState(false);

  // Meal Rate Calculation
  const totalExpenseSum = millSmall + millBig;
  const effectiveMeals = millTotalMeals > 0 ? millTotalMeals : 1;
  const mealRate = totalExpenseSum / effectiveMeals;

  // Add Member
  const handleAddMember = () => {
    const name = prompt('নতুন সদস্যের নাম লিখুন:');
    if (name && name.trim()) {
      setMillMembers(prev => [
        ...prev,
        {
          name: name.trim(),
          fineMeals: 0,
          presentMeals: 0,
          presentExtra: 0,
          guestMeals: 0,
          deposit: 0,
          paid: false,
        }
      ]);
    }
  };

  // Edit Name
  const handleEditName = (index: number) => {
    const currentName = millMembers[index].name;
    const val = prompt('নাম পরিবর্তন করুন:', currentName);
    if (val && val.trim()) {
      setMillMembers(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], name: val.trim() };
        return copy;
      });
    }
  };

  // Toggle Paid status
  const handleTogglePaid = (index: number) => {
    const member = millMembers[index];
    const newStatus = !member.paid;
    const actionLabel = newStatus ? 'পরিশোধিত (Paid)' : 'বকেয়া (Due)';

    onRequestConfirm(`${member.name} এর স্ট্যাটাস "${actionLabel}" করতে চান?`, () => {
      setMillMembers(prev => {
        const copy = [...prev];
        copy[index] = { ...copy[index], paid: newStatus };
        return copy;
      });
    });
  };

  // Delete Member
  const handleDeleteMember = (index: number) => {
    const member = millMembers[index];
    onRequestConfirm(`আপনি কি নিশ্চিত "${member.name}" কে তালিকা থেকে মুছে ফেলতে চান?`, () => {
      setMillMembers(prev => prev.filter((_, i) => i !== index));
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    const rows: (string | number)[][] = [
      ['মিলের হিসাব রিপোর্ট'],
      ['তারিখ:', millDate || '-'],
      ['ম্যানেজার:', millManager || '-'],
      ['ছোট বাজার (৳):', millSmall],
      ['বড় বাজার (৳):', millBig],
      ['মোট মিল:', millTotalMeals],
      ['মিল রেট (৳):', mealRate.toFixed(2)],
      ['গেস্ট রেট (৳):', guestRate],
      ['জরিমানা গণনা:', fineEnabled ? 'চালু (ON)' : 'বন্ধ (OFF)'],
      [],
      ['ক্রমিক', 'নাম', 'জরিমানা', 'প্রেজেন্ট', 'ধার/এক্সট্রা', 'গেস্ট', 'মোট মিল', 'জমা', 'ব্যয়', 'ফেরত', 'পাবে', 'স্ট্যাটাস']
    ];

    millMembers.forEach((m, idx) => {
      const fine = fineEnabled ? m.fineMeals : 0;
      const totalMeal = m.presentMeals + fine;
      const expense = (totalMeal * mealRate) + (m.guestMeals * guestRate) + m.presentExtra;
      const returnAmt = Math.max(0, m.deposit - expense);
      const managerGets = Math.max(0, expense - m.deposit);

      rows.push([
        idx + 1,
        m.name,
        fine,
        m.presentMeals,
        m.presentExtra,
        m.guestMeals,
        totalMeal,
        m.deposit,
        expense.toFixed(2),
        returnAmt.toFixed(2),
        managerGets.toFixed(2),
        m.paid ? 'পরিশোধিত' : 'বকেয়া'
      ]);
    });

    exportToExcel(`মিল_হিসাব_${millDate || 'report'}`, 'মিলের হিসাব', rows);
  };

  // Compute Totals
  let totalPresentCount = 0;
  let totalFineCount = 0;
  let totalGuestCount = 0;
  let totalDepositSum = 0;
  let totalExpenseSumAll = 0;
  let totalReturnSum = 0;
  let totalManagerSum = 0;
  let paidCount = 0;
  let dueCount = 0;

  millMembers.forEach(m => {
    const fine = fineEnabled ? m.fineMeals : 0;
    const totalMeal = m.presentMeals + fine;
    const expense = (totalMeal * mealRate) + (m.guestMeals * guestRate) + m.presentExtra;
    const returnAmt = Math.max(0, m.deposit - expense);
    const managerGets = Math.max(0, expense - m.deposit);

    totalPresentCount += m.presentMeals;
    totalFineCount += fine;
    totalGuestCount += m.guestMeals;
    totalDepositSum += m.deposit;
    totalExpenseSumAll += expense;
    totalReturnSum += returnAmt;
    totalManagerSum += managerGets;

    if (m.paid) paidCount++;
    else dueCount++;
  });

  return (
    <div className="space-y-4">
      {/* Print-only Header */}
      <div className="print-header">
        <h1>মেস হিসাব - মিলের সম্পূর্ণ হিসাব রিপোর্ট</h1>
        <p>তারিখ: {millDate || 'নির্ধারিত নয়'} | ম্যানেজার: {millManager || 'নির্ধারিত নয়'} | মিল রেট: {mealRate.toFixed(2)} ৳ | মোট মিল: {millTotalMeals}</p>
        <p>ছোট বাজার: {millSmall} ৳ | বড় বাজার: {millBig} ৳ | সর্বমোট বাজার: {totalExpenseSum} ৳</p>
      </div>

      {/* Top Input Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">📅 তারিখ</label>
          <input
            type="date"
            value={millDate}
            onChange={e => setMillDate(e.target.value)}
            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">👤 ম্যানেজার</label>
          <input
            type="text"
            placeholder="নাম"
            value={millManager}
            onChange={e => setMillManager(e.target.value)}
            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">🛒 ছোট বাজার (৳)</label>
          <input
            type="number"
            value={millSmall || ''}
            placeholder="0"
            onChange={e => {
              if (setMillSmall) setMillSmall(parseFloat(e.target.value) || 0);
            }}
            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">🛒 বড় বাজার (৳)</label>
          <input
            type="number"
            value={millBig || ''}
            placeholder="0"
            onChange={e => {
              if (setMillBig) setMillBig(parseFloat(e.target.value) || 0);
            }}
            className="w-full text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">🍚 ব্যয়িত মোট মিল</label>
          <input
            type="number"
            readOnly
            value={millTotalMeals}
            className="w-full text-xs p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold cursor-not-allowed"
          />
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 shadow-xs text-center flex flex-col justify-center">
          <label className="block text-[10px] font-bold text-emerald-800 dark:text-emerald-300">💰 মিল রেট</label>
          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {mealRate.toFixed(2)} ৳
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="no-print bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 text-blue-900 dark:text-blue-200 text-xs p-2.5 rounded-lg flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-600 shrink-0" />
        <span>
          💡 <strong>নোট:</strong> "ছোট বাজার" ও "বড় বাজার" সরাসরি পরিবর্তন করতে পারেন অথবা বাজার শীট থেকে স্বয়ংক্রিয়ভাবে যুক্ত করতে পারেন।
        </span>
      </div>

      {/* Meal Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] relative">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold w-10">ক্রমিক</th>
                <th className="py-2 px-3 text-left border-b border-emerald-800 font-bold sticky left-0 bg-emerald-700 z-30 min-w-[100px]">
                  নাম
                </th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-black/10">জরিমানা</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-black/10">প্রেজেন্ট</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-black/10">ধার/এক্সট্রা</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-black/10">গেস্ট</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">মোট মিল</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-black/10">জমা</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">ব্যয় (৳)</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">ফেরত (৳)</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">পাবে (৳)</th>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold">স্ট্যাটাস</th>
                <th className="no-print py-2 px-1 text-center border-b border-emerald-800 font-bold w-8">🗑️</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {millMembers.map((member, index) => {
                const fine = fineEnabled ? member.fineMeals : 0;
                const totalMeal = member.presentMeals + fine;
                const expense = (totalMeal * mealRate) + (member.guestMeals * guestRate) + member.presentExtra;
                const returnAmt = Math.max(0, member.deposit - expense);
                const managerGets = Math.max(0, expense - member.deposit);

                const hasReturn = returnAmt > 0;
                const hasDues = managerGets > 0;

                return (
                  <tr
                    key={index}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </td>
                    <td
                      onClick={() => handleEditName(index)}
                      className={`py-2 px-3 font-semibold sticky left-0 z-10 cursor-pointer hover:underline border-r border-slate-200 dark:border-slate-700 ${
                        hasReturn
                          ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200'
                          : hasDues
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-200'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                      }`}
                      title="নাম পরিবর্তন করতে ক্লিক করুন"
                    >
                      {member.name}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 dark:bg-slate-900/50 text-amber-600 dark:text-amber-400 font-medium">
                      {fine}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-medium">
                      {member.presentMeals}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-medium">
                      {member.presentExtra} ৳
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-medium">
                      {member.guestMeals}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-900 dark:text-white">
                      {totalMeal}
                    </td>
                    <td className="py-2 px-2 text-center bg-slate-50 dark:bg-slate-900/50 font-bold text-emerald-600 dark:text-emerald-400">
                      {member.deposit} ৳
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-800 dark:text-slate-200">
                      {expense.toFixed(2)}
                    </td>
                    <td className={`py-2 px-2 text-center font-extrabold ${returnAmt > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {returnAmt > 0 ? `${returnAmt.toFixed(2)} ৳` : '0.00'}
                    </td>
                    <td className={`py-2 px-2 text-center font-extrabold ${managerGets > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-slate-400'}`}>
                      {managerGets > 0 ? `${managerGets.toFixed(2)} ৳` : '0.00'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <button
                        onClick={() => handleTogglePaid(index)}
                        className={`p-1 px-2 rounded-md transition-all text-xs font-bold ${
                          member.paid
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100'
                        }`}
                        title={member.paid ? 'পরিশোধিত (Paid) - পরিবর্তন করতে ক্লিক করুন' : 'বকেয়া (Due) - পরিবর্তন করতে ক্লিক করুন'}
                      >
                        {member.paid ? 'পরিশোধিত' : 'বকেয়া'}
                      </button>
                    </td>
                    <td className="no-print py-2 px-1 text-center">
                      <button
                        onClick={() => handleDeleteMember(index)}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                        title="সদস্য মুছুন"
                      >
                        <Trash2 className="w-3.5 h-3.5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={handleAddMember}
          className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> নতুন সদস্য
        </button>

        <button
          onClick={handleExportExcel}
          className="py-2.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>

        <button
          onClick={triggerPrint}
          className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <Printer className="w-4 h-4" /> PDF / Print
        </button>

        <button
          onClick={() => onRequestConfirm('আপনি কি মিলের হিসাবের সব তথ্য রিসেট করতে চান?', onResetMill)}
          className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> রিসেট
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
          📊 মেস মোট সারাংশ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">মোট সদস্য:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{millMembers.length} জন</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">প্রেজেন্ট মিল:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{totalPresentCount}টি</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">জরিমানা মিল:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">{totalFineCount}টি</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">গেস্ট মিল:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{totalGuestCount}টি</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">মোট জমা:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalDepositSum.toFixed(2)} ৳</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">মোট ব্যয়:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{totalExpenseSumAll.toFixed(2)} ৳</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">পরিশোধিত:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{paidCount} জন</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">বকেয়া:</span>
            <span className="font-bold text-rose-600 dark:text-rose-300">{dueCount} জন</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">মোট ফেরত:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{totalReturnSum.toFixed(2)} ৳</span>
          </div>
          <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400">ম্যানেজার পাবে:</span>
            <span className="font-bold text-rose-600 dark:text-rose-300">{totalManagerSum.toFixed(2)} ৳</span>
          </div>
        </div>
      </div>

      {/* History Section */}
      <div className="bg-sky-50 dark:bg-sky-950/40 p-4 rounded-xl border border-sky-200 dark:border-sky-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-sky-900 dark:text-sky-300 flex items-center gap-1.5">
              📜 মেস হিসাবের ইতিহাস (Database History Records)
            </h3>
            <p className="text-[11px] text-sky-700 dark:text-sky-400">
              রিসেটের সময়ে সব ডাটা ডাটাবেসে সেভ থাকে। এডমিন যেকোনো সময় পূববর্তী সেভ/রিসেট ডাটা ইমপোর্ট বা রিস্টোর করতে পারবে।
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onSaveHistory}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" /> ম্যানুয়াল সেভ
            </button>
            <button
              onClick={() => setShowHistoryData(!showHistoryData)}
              className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" /> {showHistoryData ? 'হাইড করুন' : `হিস্টোরি দেখুন (${historyList.length})`}
            </button>
            {userRole === 'admin' && onClearAllHistory && historyList.length > 0 && (
              <button
                onClick={() => onRequestConfirm('আপনি কি ডাটাবেসের সমস্ত সেভ করা ইতিহাস মুছে ফেলতে চান?', onClearAllHistory)}
                className="py-1.5 px-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-[11px] transition-all flex items-center gap-1"
                title="শুধুমাত্র এডমিন ডাটাবেস হিস্টোরি রিসেট করতে পারবেন"
              >
                <Trash2 className="w-3.5 h-3.5" /> ডাটাবেস হিস্টোরি রিসেট
              </button>
            )}
          </div>
        </div>

        {showHistoryData && (
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-sky-200 dark:border-sky-800 max-h-96 overflow-y-auto text-xs font-mono space-y-4 text-slate-800 dark:text-slate-200">
            {historyList.length === 0 ? (
              <p className="text-center py-6 text-slate-400 italic font-sans">
                ⏳ এখনো কোনো হিস্টোরি সেভ বা অটো-আর্কাইভ করা হয়নি।
              </p>
            ) : (
              historyList.map((item, idx) => (
                <div key={item.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-xs">
                        📌 রেকর্ড #{historyList.length - idx}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                        {item.resetType || 'ম্যানুয়াল সেভ'}
                      </span>
                      {item.resetByRole && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                          item.resetByRole === 'admin'
                            ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200'
                            : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                        }`}>
                          {item.resetByRole === 'admin' ? 'এডমিন' : 'এডিটর'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatBnTime(new Date(item.timestamp))}
                      </span>

                      {/* Restore / Import Button for Admin */}
                      {onRestoreHistorySnapshot && (
                        <button
                          onClick={() => {
                            if (userRole !== 'admin') {
                              alert('⚠️ শুধুমাত্র এডমিন ডাটাবেস থেকে পুরানো হিসাব রিস্টোর বা ইমপোর্ট করতে পারবেন!');
                            } else {
                              onRequestConfirm('আপনি কি ডাটাবেসের এই ঐতিহাসিক রেকর্ডটি রিস্টোর করে স্ক্রিনে ইমপোর্ট করতে চান?', () => {
                                onRestoreHistorySnapshot(item);
                              });
                            }
                          }}
                          className={`py-1 px-2 rounded text-[11px] font-bold flex items-center gap-1 transition-all ${
                            userRole === 'admin'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                          }`}
                          title={userRole === 'admin' ? 'এই রেকর্ডটি বর্তমানে ইমপোর্ট / রিস্টোর করুন' : 'শুধুমাত্র এডমিন ইমপোর্ট করতে পারবেন'}
                        >
                          <Download className="w-3 h-3" /> ইমপোর্ট / রিস্টোর
                        </button>
                      )}

                      {/* Delete Snapshot for Admin */}
                      {userRole === 'admin' && onDeleteHistoryEntry && (
                        <button
                          onClick={() => onRequestConfirm('আপনি কি এই নির্দিষ্ট ইতিহাস রেকর্ডটি ডাটাবেস থেকে মুছে ফেলতে চান?', () => onDeleteHistoryEntry(idx))}
                          className="p-1 text-rose-600 hover:text-rose-800 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 rounded transition-colors"
                          title="রেকর্ড মুছুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <pre className="text-[11px] font-sans bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {item.data}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
