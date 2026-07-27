import React, { useState } from 'react';
import { ShoppingCart, Calendar, FileSpreadsheet, RotateCcw, Lock, Info, Check } from 'lucide-react';
import { BazarRow } from '../types';
import { UserRole } from './RoleAccessModal';
import { exportToExcel } from '../utils/exportUtils';
import { canUpdateBazarRow } from '../utils/timeUtils';

interface TabBazarProps {
  userRole?: UserRole;
  bazarStartDate: string;
  setBazarStartDate: (s: string) => void;
  bazarEndDate: string;
  setBazarEndDate: (e: string) => void;
  bazarData: BazarRow[];
  setBazarData: React.Dispatch<React.SetStateAction<BazarRow[]>>;
  onGenerateBazarSheet: () => void;
  onResetBazar: () => void;
  onRequestConfirm: (msg: string, action: () => void) => void;
  onLogActivity?: (details: string) => void;
}

export const TabBazar: React.FC<TabBazarProps> = ({
  userRole = 'viewer',
  bazarStartDate,
  setBazarStartDate,
  bazarEndDate,
  setBazarEndDate,
  bazarData,
  setBazarData,
  onGenerateBazarSheet,
  onResetBazar,
  onRequestConfirm,
  onLogActivity,
}) => {
  const isRowEditable = (row: BazarRow): boolean => {
    if (userRole === 'admin') return true;
    if (userRole === 'editor') return canUpdateBazarRow(row);
    return false;
  };

  // Update Big Bazar
  const handleBigBazarChange = (index: number, valStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) {
      alert('⏰ বাজারে খরচের ডেটা ইনপুট/সেট করার ২৪ ঘন্টা পার হয়ে যাওয়ায় এডিটরদের জন্য তা পরিবর্তন বন্ধ!\nএডমিন পরিবর্তন করতে পারবেন।');
      return;
    }

    const val = parseFloat(valStr) || 0;
    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        bigBazar: val,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
    if (onLogActivity) {
      onLogActivity(`বাজার হিসাব: ${row.date} তারিখের বড় বাজার ${val} ৳ ইন্পুট/আপডেট করা হয়েছে`);
    }
  };

  // Update Big Signature
  const handleBigSigChange = (index: number, sigStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) return;

    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        bigSignature: sigStr,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
  };

  // Update Small Bazar
  const handleSmallBazarChange = (index: number, valStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) {
      alert('⏰ বাজারে খরচের ডেটা ইনপুট/সেট করার ২৪ ঘন্টা পার হয়ে যাওয়ায় এডিটরদের জন্য তা পরিবর্তন বন্ধ!\nএডমিন পরিবর্তন করতে পারবেন।');
      return;
    }

    const val = parseFloat(valStr) || 0;
    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        smallBazar: val,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
    if (onLogActivity) {
      onLogActivity(`বাজার হিসাব: ${row.date} তারিখের ছোট বাজার ${val} ৳ ইন্পুট/আপডেট করা হয়েছে`);
    }
  };

  // Update Small Signature
  const handleSmallSigChange = (index: number, sigStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) return;

    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        smallSignature: sigStr,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    if (bazarData.length === 0) {
      alert('⚠️ প্রথমে বাজার শীট তৈরি করুন!');
      return;
    }

    const rows: (string | number)[][] = [
      ['বাজার হিসাব রিপোর্ট'],
      ['শুরুর তারিখ:', bazarStartDate || '-'],
      ['শেষের তারিখ:', bazarEndDate || '-'],
      [],
      ['ক্রমিক নং', 'তারিখ', 'বড় বাজার (৳)', 'স্বাক্ষর (বড়)', 'ছোট বাজার (৳)', 'স্বাক্ষর (ছোট)']
    ];

    let totalBig = 0;
    let totalSmall = 0;

    bazarData.forEach((row, i) => {
      totalBig += row.bigBazar || 0;
      totalSmall += row.smallBazar || 0;
      rows.push([
        i + 1,
        row.date,
        row.bigBazar || 0,
        row.bigSignature || '',
        row.smallBazar || 0,
        row.smallSignature || ''
      ]);
    });

    rows.push([]);
    rows.push(['সারাংশ']);
    rows.push(['মোট বড় বাজার (৳):', totalBig]);
    rows.push(['মোট ছোট বাজার (৳):', totalSmall]);
    rows.push(['সর্বমোট বাজার (৳):', totalBig + totalSmall]);

    exportToExcel(`বাজার_হিসাব_${bazarStartDate || 'report'}`, 'বাজার হিসাব', rows);
  };

  // Total Summaries
  let grandTotalBigBazar = 0;
  let grandTotalSmallBazar = 0;

  bazarData.forEach(row => {
    grandTotalBigBazar += row.bigBazar || 0;
    grandTotalSmallBazar += row.smallBazar || 0;
  });

  return (
    <div className="space-y-4">
      {/* Print-only Header */}
      <div className="print-header">
        <h1>মেস হিসাব - বাজারের সম্পূর্ণ খতিয়ান রিপোর্ট</h1>
        <p>সময়কাল: {bazarStartDate || 'নির্ধারিত নয়'} হতে {bazarEndDate || 'নির্ধারিত নয়'}</p>
        <p>মোট বড় বাজার: {grandTotalBigBazar} ৳ | মোট ছোট বাজার: {grandTotalSmallBazar} ৳ | সর্বমোট বাজার: {grandTotalBigBazar + grandTotalSmallBazar} ৳</p>
      </div>

      {/* Date Range Selector */}
      <div className="no-print bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">📅 শুরুর তারিখ</label>
            <input
              type="date"
              value={bazarStartDate}
              onChange={e => setBazarStartDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">📅 শেষের তারিখ</label>
            <input
              type="date"
              value={bazarEndDate}
              onChange={e => setBazarEndDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={onGenerateBazarSheet}
            className="py-2 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 h-9"
          >
            <Calendar className="w-4 h-4" /> বাজার শীট তৈরি করুন
          </button>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="no-print bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          ⏰ <strong>বাজার আপডেট লক:</strong> বাজারে খরচের ডেটা ইনপুট বা সেট করার ২৪ ঘন্টা পর আর পরিবর্তন করা যাবে না।
        </span>
      </div>

      {/* Bazar Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] relative">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead className="bg-gradient-to-r from-sky-600 to-blue-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2 px-2 text-center border-b border-sky-800 font-bold w-12">ক্রমিক</th>
                <th className="py-2 px-3 text-left border-b border-sky-800 font-bold sticky left-0 bg-sky-700 z-30 min-w-[100px]">
                  তারিখ
                </th>
                <th className="py-2 px-3 text-center border-b border-sky-800 font-bold bg-sky-800">
                  বড় বাজার (৳)
                </th>
                <th className="py-2 px-3 text-center border-b border-sky-800 font-bold">
                  স্বাক্ষর (বড় বাজার)
                </th>
                <th className="py-2 px-3 text-center border-b border-sky-800 font-bold bg-sky-800">
                  ছোট বাজার (৳)
                </th>
                <th className="py-2 px-3 text-center border-b border-sky-800 font-bold">
                  স্বাক্ষর (ছোট বাজার)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {bazarData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    ⏳ বাজার হিসাব শুরু করতে "বাজার শীট তৈরি" চাপুন
                  </td>
                </tr>
              ) : (
                bazarData.map((row, index) => {
                  const editable = isRowEditable(row);

                  return (
                    <tr key={row.date} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold sticky left-0 z-10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                        {row.date}
                      </td>

                      {/* Big Bazar Input */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          placeholder="টাকা"
                          disabled={!editable}
                          defaultValue={row.bigBazar || ''}
                          onBlur={e => handleBigBazarChange(index, e.target.value)}
                          className={`w-full text-center text-xs p-1.5 rounded-lg border font-bold ${
                            editable
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-700 dark:text-sky-400 focus:ring-2 focus:ring-sky-500'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Big Signature */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="text"
                          placeholder="স্বাক্ষর"
                          disabled={!editable}
                          value={row.bigSignature || ''}
                          onChange={e => handleBigSigChange(index, e.target.value)}
                          className="w-full text-center text-xs p-1.5 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
                        />
                      </td>

                      {/* Small Bazar Input */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          placeholder="টাকা"
                          disabled={!editable}
                          defaultValue={row.smallBazar || ''}
                          onBlur={e => handleSmallBazarChange(index, e.target.value)}
                          className={`w-full text-center text-xs p-1.5 rounded-lg border font-bold ${
                            editable
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-700 dark:text-sky-400 focus:ring-2 focus:ring-sky-500'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Small Signature */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="text"
                          placeholder="স্বাক্ষর"
                          disabled={!editable}
                          value={row.smallSignature || ''}
                          onChange={e => handleSmallSigChange(index, e.target.value)}
                          className="w-full text-center text-xs p-1.5 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto transfer info */}
      <div className="no-print bg-sky-50 dark:bg-sky-950/40 border-l-4 border-sky-500 text-sky-900 dark:text-sky-200 text-xs p-2.5 rounded-lg flex items-center gap-2">
        <Info className="w-4 h-4 text-sky-600 shrink-0" />
        <span>
          🔄 <strong>অটো ট্রান্সফার:</strong> বাজারের খরচ এন্ট্রি দেওয়ার সাথে সাথে মিলের হিসাব পৃষ্ঠায় ছোট ও বড় বাজারের মোট যোগফল যুক্ত হয়।
        </span>
      </div>

      {/* Action Buttons */}
      <div className="no-print grid grid-cols-2 gap-2">
        <button
          onClick={handleExportExcel}
          className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>

        <button
          onClick={() => onRequestConfirm('আপনি কি বাজার হিসাবের সব ডেটা রিসেট করতে চান?', onResetBazar)}
          className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> রিসেট
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-1">
          🛒 বাজারের মোট খরচ সারাংশ
        </h3>
        <div className="grid grid-cols-3 gap-3 pt-1">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট বড় বাজার:</span>
            <span className="font-bold text-sky-700 dark:text-sky-400 text-sm">{grandTotalBigBazar.toFixed(2)} ৳</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট ছোট বাজার:</span>
            <span className="font-bold text-sky-700 dark:text-sky-400 text-sm">{grandTotalSmallBazar.toFixed(2)} ৳</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">সর্বমোট বাজার খরচ:</span>
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
              {(grandTotalBigBazar + grandTotalSmallBazar).toFixed(2)} ৳
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
