import React, { useState } from 'react';
import { Users, Plus, Trash2, FileSpreadsheet, Printer, RotateCcw, Check, Clock, AlertTriangle } from 'lucide-react';
import { MillMember, GuestData } from '../types';
import { UserRole } from './RoleAccessModal';
import { MAX_GUEST_DAYS } from '../constants';
import { exportToExcel, triggerPrint } from '../utils/exportUtils';
import { canToggleOffForDate } from '../utils/timeUtils';

interface TabGuestProps {
  userRole?: UserRole;
  guestRate: number;
  setGuestRate: (rate: number) => void;
  guestDateList: string[];
  setGuestDateList: React.Dispatch<React.SetStateAction<string[]>>;
  guestMembers: MillMember[];
  guestData: GuestData;
  setGuestData: React.Dispatch<React.SetStateAction<GuestData>>;
  dateRange: Date[];
  onResetGuest: () => void;
  onRequestConfirm: (msg: string, action: () => void) => void;
}

export const TabGuest: React.FC<TabGuestProps> = ({
  userRole = 'viewer',
  guestRate,
  setGuestRate,
  guestDateList,
  setGuestDateList,
  guestMembers,
  guestData,
  setGuestData,
  dateRange,
  onResetGuest,
  onRequestConfirm,
}) => {
  const [inputRate, setInputRate] = useState<string>(guestRate.toString());
  const [inputGuestDate, setInputGuestDate] = useState<string>('');

  // Set Guest Rate
  const handleSetGuestRate = () => {
    const val = parseFloat(inputRate);
    if (isNaN(val) || val < 0) {
      alert('⚠️ দয়া করে একটি সঠিক টাকার পরিমাণ লিখুন!');
      return;
    }
    onRequestConfirm(`গেস্ট মিল রেট ${val} ৳ সেট করতে চান?`, () => {
      setGuestRate(val);
      alert(`✅ গেস্ট মিল রেট ${val} ৳ সেট করা হয়েছে!`);
    });
  };

  // Add Guest Date
  const handleAddGuestDate = () => {
    if (!inputGuestDate) {
      alert('⚠️ দয়া করে একটি তারিখ নির্বাচন করুন!');
      return;
    }

    if (dateRange.length > 0) {
      const existsInSheet = dateRange.some(d => d.toISOString().split('T')[0] === inputGuestDate);
      if (!existsInSheet) {
        alert(`⚠️ "${inputGuestDate}" তারিখটি হাজিরা শীটের রেঞ্জে নেই!`);
        return;
      }
    }

    if (guestDateList.includes(inputGuestDate)) {
      alert(`⚠️ "${inputGuestDate}" তারিখটি আগেই যোগ করা হয়েছে!`);
      return;
    }

    if (guestDateList.length >= MAX_GUEST_DAYS) {
      alert(`⚠️ সর্বোচ্চ ${MAX_GUEST_DAYS} দিন গেস্ট মিল যোগ করা যায়!`);
      return;
    }

    setGuestDateList(prev => [...prev, inputGuestDate].sort());
    setInputGuestDate('');
  };

  // Remove Guest Date
  const handleRemoveGuestDate = () => {
    if (guestDateList.length === 0) {
      alert('⚠️ কোনো তারিখ যোগ করা হয়নি!');
      return;
    }

    const dateListStr = guestDateList.map((d, i) => `${i + 1}. ${d}`).join('\n');
    const choice = prompt(`📅 যোগকৃত তারিখসমূহ:\n${dateListStr}\n\nমুছতে একটি তারিখের নম্বর লিখুন (১-${guestDateList.length}):`);
    if (choice === null) return;

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= guestDateList.length) {
      alert('⚠️ ভুল ইনপুট!');
      return;
    }

    const dateToRemove = guestDateList[idx];
    setGuestDateList(prev => prev.filter(d => d !== dateToRemove));
  };

  // Toggle Guest Checkbox
  const handleCheckboxChange = (memberName: string, dateStr: string, currentVal: boolean) => {
    const newVal = !currentVal;

    if (!newVal) {
      // Time lock rule applies ONLY to Editor. Admin can ALWAYS update.
      if (userRole === 'editor' && !canToggleOffForDate(dateStr)) {
        alert(`⏰ "${dateStr}" তারিখের রাত ১১:৫৯:৫৯ PM পার হয়ে গেছে!\n১২:০০ AM এর পর এডিটররা গেস্ট মিল OFF করতে পারবে না। এডমিন এটি পরিবর্তন করতে পারবেন।`);
        return;
      }

      onRequestConfirm(`${memberName} - ${dateStr} তারিখে গেস্ট OFF করতে চান?`, () => {
        setGuestData(prev => ({
          ...prev,
          [memberName]: {
            ...(prev[memberName] || {}),
            [dateStr]: false,
          }
        }));
      });
    } else {
      setGuestData(prev => ({
        ...prev,
        [memberName]: {
          ...(prev[memberName] || {}),
          [dateStr]: true,
        }
      }));
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    if (guestDateList.length === 0) {
      alert('⚠️ প্রথমে তারিখ যোগ করুন!');
      return;
    }

    let totalGuestMeals = 0;
    guestMembers.forEach(m => {
      guestDateList.forEach(d => {
        if (guestData[m.name]?.[d]) totalGuestMeals++;
      });
    });

    const rows: (string | number)[][] = [
      ['গেস্ট মিল শীট রিপোর্ট'],
      ['মোট গেস্ট সদস্য:', guestMembers.length],
      ['মোট গেস্ট মিল:', totalGuestMeals],
      ['গেস্ট রেট (৳):', guestRate],
      ['মোট খরচ (৳):', (totalGuestMeals * guestRate).toFixed(2)],
      [],
    ];

    let header = ['ক্রমিক', 'নাম'];
    guestDateList.forEach(d => header.push(d));
    header.push('মোট গেস্ট মিল');
    rows.push(header);

    guestMembers.forEach((m, idx) => {
      let row: (string | number)[] = [idx + 1, m.name];
      let count = 0;
      guestDateList.forEach(d => {
        const checked = guestData[m.name]?.[d] || false;
        row.push(checked ? '✓' : '✗');
        if (checked) count++;
      });
      row.push(count);
      rows.push(row);
    });

    exportToExcel(`গেস্ট_মিল_${new Date().toISOString().split('T')[0]}`, 'গেস্ট মিল', rows);
  };

  // Total Summary Calculations
  let totalAllGuestMeals = 0;
  guestMembers.forEach(m => {
    guestDateList.forEach(d => {
      if (guestData[m.name]?.[d]) totalAllGuestMeals++;
    });
  });

  return (
    <div className="space-y-4">
      {/* Rate Setting Card */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base flex items-center gap-1.5">
              <Users className="w-5 h-5" /> 🍽️ গেস্ট মিল রেট সেটিং
            </h3>
            <p className="text-xs text-amber-100">প্রতি গেস্ট মিলের খরচ নির্ধারণ করুন</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={inputRate}
              onChange={e => setInputRate(e.target.value)}
              placeholder="টাকা"
              className="w-28 text-sm p-2 rounded-lg bg-white text-slate-800 font-bold text-center focus:ring-2 focus:ring-amber-300"
            />
            <button
              onClick={handleSetGuestRate}
              className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition-all shadow-sm active:scale-95 flex items-center gap-1"
            >
              <Check className="w-4 h-4 text-amber-400" /> রেট সেট করুন
            </button>
          </div>
        </div>
      </div>

      {/* Date Picker Section */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">📅 তারিখ:</label>
          <input
            type="date"
            value={inputGuestDate}
            onChange={e => setInputGuestDate(e.target.value)}
            className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-1"
          />
          <button
            onClick={handleAddGuestDate}
            className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-all shadow-xs shrink-0 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> তারিখ যোগ করুন
          </button>
          
        </div>

        <div className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 p-2 rounded-lg text-center border border-amber-200 dark:border-amber-800">
          🗓️ সক্রিয় দিন: {guestDateList.length}/{MAX_GUEST_DAYS}টি (সর্বোচ্চ {MAX_GUEST_DAYS} দিন)
        </div>
      </div>

      {/* Time Lock Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          ⏰ <strong>নিয়ম:</strong> যে তারিখে গেস্ট চেক করা হবে, রাত ১১:৫৯:৫৯ PM পর্যন্ত OFF করা যাবে। ১২:০০ AM এর পর লক হয়ে যাবে।
        </span>
      </div>

      {/* Guest Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh] relative">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gradient-to-r from-amber-600 to-orange-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2 px-2 text-center border-b border-amber-800 font-bold w-10">ক্রমিক</th>
                <th className="py-2 px-3 text-left border-b border-amber-800 font-bold sticky left-0 bg-amber-700 z-30 min-w-[100px]">
                  নাম
                </th>
                {guestDateList.length === 0 ? (
                  <th className="py-2 px-4 text-center border-b border-amber-800 font-bold bg-amber-800">
                    📅 "তারিখ নির্বাচন" থেকে গেস্ট দিন যোগ করুন
                  </th>
                ) : (
                  guestDateList.map(dateStr => (
                    <th key={dateStr} className="py-2 px-2 text-center border-b border-amber-800 font-bold min-w-[45px]">
                      {dateStr.split('-').slice(1).reverse().join('/')}
                    </th>
                  ))
                )}
                {guestDateList.length > 0 && (
                  <th className="py-2 px-2 text-center border-b border-amber-800 font-bold bg-amber-900 min-w-[60px]">
                    🍽️ মোট গেস্ট
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {guestDateList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    ⏳ গেস্ট মিল ইনপুট দিতে "তারিখ নির্বাচন" থেকে তারিখ যোগ করুন
                  </td>
                </tr>
              ) : (
                guestMembers.map((member, index) => {
                  let totalGuestCount = 0;

                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold sticky left-0 z-10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                        {member.name}
                      </td>
                      {guestDateList.map(dateStr => {
                        const isChecked = guestData[member.name]?.[dateStr] || false;
                        if (isChecked) totalGuestCount++;

                        return (
                          <td key={dateStr} className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(member.name, dateStr, isChecked)}
                              className="w-4 h-4 rounded-full border-slate-300 dark:border-slate-600 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                            />
                          </td>
                        );
                      })}
                      <td className="py-2 px-2 text-center font-extrabold text-amber-600 dark:text-amber-400">
                        {totalGuestCount}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total Row */}
            {guestDateList.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                <tr>
                  <td className="py-2 px-2 text-center text-slate-500">📊</td>
                  <td className="py-2 px-3 sticky left-0 bg-slate-100 dark:bg-slate-900 z-10 border-r text-amber-700 dark:text-amber-400">
                    মোট গেস্ট মিল
                  </td>
                  {guestDateList.map(dateStr => {
                    let dayGuestSum = 0;
                    guestMembers.forEach(m => {
                      if (guestData[m.name]?.[dateStr]) dayGuestSum++;
                    });
                    return (
                      <td key={dateStr} className="py-2 px-2 text-center text-amber-700 dark:text-amber-300 font-extrabold">
                        {dayGuestSum}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-amber-700 dark:text-amber-300 font-black text-sm">
                    {totalAllGuestMeals}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleExportExcel}
          className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
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
          onClick={() => onRequestConfirm('আপনি কি গেস্ট মিলের সব তথ্য রিসেট করতে চান?', onResetGuest)}
          className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> রিসেট
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200 dark:border-amber-800 text-xs space-y-2">
        <h3 className="font-bold text-amber-900 dark:text-amber-200 text-sm border-b border-amber-200 dark:border-amber-800 pb-1">
          📊 গেস্ট মিলের মোট সারাংশ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div>
            <span className="text-amber-800/70 dark:text-amber-300/70 block">মোট সদস্য:</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{guestMembers.length} জন</span>
          </div>
          <div>
            <span className="text-amber-800/70 dark:text-amber-300/70 block">মোট গেস্ট মিল:</span>
            <span className="font-bold text-amber-700 dark:text-amber-300 text-sm">{totalAllGuestMeals}টি</span>
          </div>
          <div>
            <span className="text-amber-800/70 dark:text-amber-300/70 block">গেস্ট মিল রেট:</span>
            <span className="font-bold text-slate-900 dark:text-white text-sm">{guestRate} ৳</span>
          </div>
          <div>
            <span className="text-amber-800/70 dark:text-amber-300/70 block">মোট গেস্ট খরচ:</span>
            <span className="font-extrabold text-amber-700 dark:text-amber-300 text-sm">
              {(totalAllGuestMeals * guestRate).toFixed(2)} ৳
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
