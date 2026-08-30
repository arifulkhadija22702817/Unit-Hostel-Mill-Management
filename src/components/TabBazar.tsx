import React from 'react';
import { ShoppingCart, Calendar, FileSpreadsheet, RotateCcw, Lock, Info, Check, X, ShieldCheck, UserCheck } from 'lucide-react';
import { BazarRow, MillMember } from '../types';
import { UserRole, ActiveEditorSession } from './RoleAccessModal';
import { exportToExcel } from '../utils/exportUtils';
import { canUpdateBazarRow } from '../utils/timeUtils';
import { PREDEFINED_MEMBERS } from '../constants';

interface TabBazarProps {
  userRole?: UserRole;
  currentSessionId?: string;
  activeEditors?: ActiveEditorSession[];
  members?: MillMember[];
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
  currentSessionId = '',
  activeEditors = [],
  members = [],
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

  // Determine current user's authenticated digital signature label
  const myEditor = activeEditors.find(e => e.id === currentSessionId);
  const mySignatureIdentity = userRole === 'admin' 
    ? 'এডমিন' 
    : (userRole === 'editor' && myEditor ? `${myEditor.name} (এডিটর)` : '');

  // Sorted unique list of member names for the signature dropdown
  const allMemberNames = React.useMemo(() => {
    const list = members.length > 0 ? members.map(m => m.name) : PREDEFINED_MEMBERS;
    return Array.from(new Set(list)).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [members]);

  // Prevent unwanted keys (minus, exponents, plus)
  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
  };

  // Update Big Bazar with strict validation
  const handleBigBazarChange = (index: number, valStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) {
      alert('⏰ বাজারে খরচের ডেটা ইনপুট/সেট করার ২৪ ঘন্টা পার হয়ে যাওয়ায় এডিটরদের জন্য তা পরিবর্তন বন্ধ!\nএডমিন পরিবর্তন করতে পারবেন।');
      return;
    }

    if (valStr.trim() === '') {
      setBazarData(prev => {
        const copy = [...prev];
        copy[index] = { 
          ...copy[index], 
          bigBazar: 0,
          updatedAt: new Date().toISOString()
        };
        return copy;
      });
      return;
    }

    const val = parseFloat(valStr);
    if (isNaN(val)) {
      alert('⚠️ শুধুমাত্র সঠিক সংখ্যা লিখুন!');
      return;
    }

    if (val < 0) {
      alert('⚠️ খরচের পরিমাণ ঋণাত্মক (Negative) হতে পারে না!');
      return;
    }

    if (val > 200000) {
      alert('⚠️ খরচের পরিমাণ ২,০০,০০০ টাকার বেশি হতে পারে না! সঠিক পরিমাণ দিন।');
      return;
    }

    const sanitized = Math.round(val * 100) / 100;
    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        bigBazar: sanitized,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
    if (onLogActivity) {
      onLogActivity(`বাজার হিসাব: ${row.date} তারিখের বড় বাজার ${sanitized} ৳ ইনপুট/আপডেট করা হয়েছে`);
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
    if (onLogActivity) {
      onLogActivity(
        sigStr 
          ? `বাজার হিসাব: ${row.date} তারিখের বড় বাজারে ডিজিটাল স্বাক্ষর যুক্ত (${sigStr})` 
          : `বাজার হিসাব: ${row.date} তারিখের বড় বাজারের স্বাক্ষর বাতিল`
      );
    }
  };

  // Update Small Bazar with strict validation
  const handleSmallBazarChange = (index: number, valStr: string) => {
    const row = bazarData[index];
    if (!isRowEditable(row)) {
      alert('⏰ বাজারে খরচের ডেটা ইনপুট/সেট করার ২৪ ঘন্টা পার হয়ে যাওয়ায় এডিটরদের জন্য তা পরিবর্তন বন্ধ!\nএডমিন পরিবর্তন করতে পারবেন।');
      return;
    }

    if (valStr.trim() === '') {
      setBazarData(prev => {
        const copy = [...prev];
        copy[index] = { 
          ...copy[index], 
          smallBazar: 0,
          updatedAt: new Date().toISOString()
        };
        return copy;
      });
      return;
    }

    const val = parseFloat(valStr);
    if (isNaN(val)) {
      alert('⚠️ শুধুমাত্র সঠিক সংখ্যা লিখুন!');
      return;
    }

    if (val < 0) {
      alert('⚠️ খরচের পরিমাণ ঋণাত্মক (Negative) হতে পারে না!');
      return;
    }

    if (val > 200000) {
      alert('⚠️ খরচের পরিমাণ ২,০০,০০০ টাকার বেশি হতে পারে না! সঠিক পরিমাণ দিন।');
      return;
    }

    const sanitized = Math.round(val * 100) / 100;
    setBazarData(prev => {
      const copy = [...prev];
      copy[index] = { 
        ...copy[index], 
        smallBazar: sanitized,
        updatedAt: new Date().toISOString()
      };
      return copy;
    });
    if (onLogActivity) {
      onLogActivity(`বাজার হিসাব: ${row.date} তারিখের ছোট বাজার ${sanitized} ৳ ইনপুট/আপডেট করা হয়েছে`);
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
    if (onLogActivity) {
      onLogActivity(
        sigStr 
          ? `বাজার হিসাব: ${row.date} তারিখের ছোট বাজারে ডিজিটাল স্বাক্ষর যুক্ত (${sigStr})` 
          : `বাজার হিসাব: ${row.date} তারিখের ছোট বাজারের স্বাক্ষর বাতিল`
      );
    }
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
      <div className="no-print bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            ⏰ <strong>বাজার আপডেট লক:</strong> খরচের ডেটা ইনপুট করার ২৪ ঘন্টা পর আর পরিবর্তন করা যাবে না।
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>ডিজিটাল স্বাক্ষর নিরাপত্তা সক্রিয়</span>
        </div>
      </div>

      {/* Bazar Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] relative">
          <table className="w-full text-xs border-collapse min-w-[700px]">
            <thead className="bg-gradient-to-r from-sky-600 to-blue-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2.5 px-2 text-center border-b border-sky-800 font-bold w-12">ক্রমিক</th>
                <th className="py-2.5 px-3 text-left border-b border-sky-800 font-bold sticky left-0 bg-sky-700 z-30 min-w-[95px]">
                  তারিখ
                </th>
                <th className="py-2.5 px-3 text-center border-b border-sky-800 font-bold bg-sky-800 min-w-[100px]">
                  বড় বাজার (৳)
                </th>
                <th className="py-2.5 px-3 text-center border-b border-sky-800 font-bold min-w-[150px]">
                  স্বাক্ষর (বড় বাজার)
                </th>
                <th className="py-2.5 px-3 text-center border-b border-sky-800 font-bold bg-sky-800 min-w-[100px]">
                  ছোট বাজার (৳)
                </th>
                <th className="py-2.5 px-3 text-center border-b border-sky-800 font-bold min-w-[150px]">
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

                      {/* Big Bazar Input with Validation */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="200000"
                          step="any"
                          placeholder="0"
                          disabled={!editable}
                          value={row.bigBazar !== undefined && row.bigBazar > 0 ? row.bigBazar : ''}
                          onKeyDown={handleNumberKeyDown}
                          onChange={e => handleBigBazarChange(index, e.target.value)}
                          className={`w-full text-center text-xs p-1.5 rounded-lg border font-bold ${
                            editable
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-700 dark:text-sky-400 focus:ring-2 focus:ring-sky-500'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Big Signature - Digital Selector / Verified Badge */}
                      <td className="py-2 px-3 text-center">
                        {row.bigSignature ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs max-w-[160px] truncate"
                              title={`স্বাক্ষরিত: ${row.bigSignature}`}
                            >
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{row.bigSignature}</span>
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => handleBigSigChange(index, '')}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="স্বাক্ষর মুছুন"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : editable ? (
                          <select
                            value=""
                            onChange={e => {
                              if (e.target.value) handleBigSigChange(index, e.target.value);
                            }}
                            className="w-full text-center text-[11px] py-1 px-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer shadow-2xs"
                          >
                            <option value="">✍️ স্বাক্ষর নির্বাচন</option>
                            {mySignatureIdentity && (
                              <option value={mySignatureIdentity} className="font-bold text-emerald-600">
                                ⚡ আমার স্বাক্ষর ({mySignatureIdentity})
                              </option>
                            )}
                            <optgroup label="কর্তৃপক্ষ / এডিটর">
                              <option value="এডমিন">⭐ এডমিন</option>
                              {activeEditors.map(ed => (
                                <option key={ed.id} value={`${ed.name} (এডিটর)`}>
                                  ✏️ {ed.name} (এডিটর)
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="মেস সদস্যবৃন্দ">
                              {allMemberNames.map(name => (
                                <option key={name} value={name}>
                                  👤 {name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Small Bazar Input with Validation */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="number"
                          min="0"
                          max="200000"
                          step="any"
                          placeholder="0"
                          disabled={!editable}
                          value={row.smallBazar !== undefined && row.smallBazar > 0 ? row.smallBazar : ''}
                          onKeyDown={handleNumberKeyDown}
                          onChange={e => handleSmallBazarChange(index, e.target.value)}
                          className={`w-full text-center text-xs p-1.5 rounded-lg border font-bold ${
                            editable
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-sky-700 dark:text-sky-400 focus:ring-2 focus:ring-sky-500'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50 text-slate-400 cursor-not-allowed'
                          }`}
                        />
                      </td>

                      {/* Small Signature - Digital Selector / Verified Badge */}
                      <td className="py-2 px-3 text-center">
                        {row.smallSignature ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs max-w-[160px] truncate"
                              title={`স্বাক্ষরিত: ${row.smallSignature}`}
                            >
                              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span className="truncate">{row.smallSignature}</span>
                            </span>
                            {editable && (
                              <button
                                type="button"
                                onClick={() => handleSmallSigChange(index, '')}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="স্বাক্ষর মুছুন"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : editable ? (
                          <select
                            value=""
                            onChange={e => {
                              if (e.target.value) handleSmallSigChange(index, e.target.value);
                            }}
                            className="w-full text-center text-[11px] py-1 px-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-sky-500 font-medium cursor-pointer shadow-2xs"
                          >
                            <option value="">✍️ স্বাক্ষর নির্বাচন</option>
                            {mySignatureIdentity && (
                              <option value={mySignatureIdentity} className="font-bold text-emerald-600">
                                ⚡ আমার স্বাক্ষর ({mySignatureIdentity})
                              </option>
                            )}
                            <optgroup label="কর্তৃপক্ষ / এডিটর">
                              <option value="এডমিন">⭐ এডমিন</option>
                              {activeEditors.map(ed => (
                                <option key={ed.id} value={`${ed.name} (এডিটর)`}>
                                  ✏️ {ed.name} (এডিটর)
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="মেস সদস্যবৃন্দ">
                              {allMemberNames.map(name => (
                                <option key={name} value={name}>
                                  👤 {name}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
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

