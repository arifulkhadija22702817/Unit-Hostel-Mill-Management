import React, { useState } from 'react';
import { Calendar, FileSpreadsheet, Printer, RotateCcw, AlertCircle, Ban, CheckCircle2, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { MillMember, AttendanceData, MealOffDay } from '../types';
import { UserRole } from './RoleAccessModal';
import { exportToExcel, triggerPrint } from '../utils/exportUtils';
import { canToggleOffForDate } from '../utils/timeUtils';

interface TabAttendanceProps {
  userRole?: UserRole;
  attStartDate: string;
  setAttStartDate: (s: string) => void;
  attEndDate: string;
  setAttEndDate: (e: string) => void;
  dateRange: Date[];
  setDateRange: (d: Date[]) => void;
  attendanceData: AttendanceData;
  setAttendanceData: React.Dispatch<React.SetStateAction<AttendanceData>>;
  attMembers: MillMember[];
  mealOffDays: MealOffDay[];
  setMealOffDays: React.Dispatch<React.SetStateAction<MealOffDay[]>>;
  fineEnabled: boolean;
  setFineEnabled: (val: boolean) => void;
  guestCountPerDate: { [dateStr: string]: number };
  fixedMeal: number;
  totalMealValue: number;
  onGenerateSheet: () => void;
  onResetAttendance: () => void;
  onRequestConfirm: (msg: string, action: () => void) => void;
}

export const TabAttendance: React.FC<TabAttendanceProps> = ({
  userRole = 'viewer',
  attStartDate,
  setAttStartDate,
  attEndDate,
  setAttEndDate,
  dateRange,
  attendanceData,
  setAttendanceData,
  attMembers,
  mealOffDays,
  setMealOffDays,
  fineEnabled,
  setFineEnabled,
  guestCountPerDate,
  fixedMeal,
  totalMealValue,
  onGenerateSheet,
  onResetAttendance,
  onRequestConfirm,
}) => {
  const [mealOffInputDate, setMealOffInputDate] = useState('');
  const [removeOffSelectDate, setRemoveOffSelectDate] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Toggle Checkbox
  const handleCheckboxChange = (memberName: string, dateStr: string, currentVal: boolean) => {
    const newVal = !currentVal;

    if (!newVal) {
      // Trying to turn OFF
      // Time lock rule applies ONLY to Editor. Admin can ALWAYS update.
      if (userRole === 'editor' && !canToggleOffForDate(dateStr)) {
        alert(`⏰ "${dateStr}" তারিখের রাত ১১:৫৯:৫৯ PM পার হয়ে গেছে!\n১২:০০ AM এর পর এডিটররা হাজিরা OFF করতে পারবে না। এডমিন এটি পরিবর্তন করতে পারবেন।`);
        return;
      }

      onRequestConfirm(`${memberName} - ${dateStr} তারিখে হাজিরা OFF করতে চান?`, () => {
        setAttendanceData(prev => ({
          ...prev,
          [memberName]: {
            ...(prev[memberName] || {}),
            [dateStr]: false,
          }
        }));
      });
    } else {
      // Turning ON
      setAttendanceData(prev => ({
        ...prev,
        [memberName]: {
          ...(prev[memberName] || {}),
          [dateStr]: true,
        }
      }));
    }
  };

  // Add Meal Off Day
  const handleAddMealOffDay = () => {
    if (!mealOffInputDate) {
      alert('⚠️ দয়া করে একটি তারিখ নির্বাচন করুন!');
      return;
    }
    const existsInSheet = dateRange.some(d => d.toISOString().split('T')[0] === mealOffInputDate);
    if (!existsInSheet) {
      alert(`⚠️ "${mealOffInputDate}" তারিখটি বর্তমানে তৈরি করা শীটে নেই!`);
      return;
    }

    const alreadyOff = mealOffDays.some(d => d.date === mealOffInputDate);
    onRequestConfirm(
      alreadyOff
        ? `⚠️ "${mealOffInputDate}" তারিখটি আগেই Meal Off করা হয়েছে। আবার সেট করতে চান?`
        : `"${mealOffInputDate}" তারিখকে Meal Off Day হিসেবে ঘোষণা করতে চান?`,
      () => {
        let memberCount = 0;
        setAttendanceData(prev => {
          const updated = { ...prev };
          attMembers.forEach(m => {
            if (!updated[m.name]) updated[m.name] = {};
            updated[m.name][mealOffInputDate] = false;
            memberCount++;
          });
          return updated;
        });

        setMealOffDays(prev => [
          ...prev.filter(d => d.date !== mealOffInputDate),
          { date: mealOffInputDate, members: memberCount, timestamp: new Date().toISOString() }
        ]);

        setStatusMsg(`✅ ${mealOffInputDate} তারিখে Meal Off সফলভাবে সেট করা হয়েছে!`);
        setTimeout(() => setStatusMsg(''), 4000);
      }
    );
  };

  // Remove Meal Off Day
  const handleRemoveMealOffDay = () => {
    if (!removeOffSelectDate) {
      alert('⚠️ দয়া করে একটি Off Day নির্বাচন করুন!');
      return;
    }

    onRequestConfirm(`"${removeOffSelectDate}" তারিখের Off Day রিমুভ করবেন?`, () => {
      setMealOffDays(prev => prev.filter(d => d.date !== removeOffSelectDate));
      setRemoveOffSelectDate('');
      setStatusMsg(`✅ "${removeOffSelectDate}" তারিখের Off Day সফলভাবে রিমুভ করা হয়েছে!`);
      setTimeout(() => setStatusMsg(''), 4000);
    });
  };

  // Excel Export
  const handleExportExcel = () => {
    if (dateRange.length === 0) {
      alert('⚠️ প্রথমে শীট তৈরি করুন!');
      return;
    }

    const rows: (string | number)[][] = [
      ['হাজিরা শীট রিপোর্ট'],
      ['শুরুর তারিখ:', attStartDate || '-'],
      ['শেষের তারিখ:', attEndDate || '-'],
      ['মোট সদস্য:', attMembers.length],
      ['মোট দিন:', dateRange.length],
      ['Meal Off Days:', mealOffDays.map(d => d.date).join(', ') || 'কোনোটি নেই'],
      ['Fixed Meal:', fixedMeal],
      ['Total Meal:', totalMealValue],
      ['জরিমানা গণনা:', fineEnabled ? 'চালু (ON)' : 'বন্ধ (OFF)'],
      [],
    ];

    let header = ['ক্রমিক', 'নাম'];
    dateRange.forEach(date => header.push(date.toISOString().split('T')[0]));
    header.push('প্রেজেন্ট', 'অনুপস্থিত', 'জরিমানা');
    rows.push(header);

    attMembers.forEach((member, idx) => {
      let row: (string | number)[] = [idx + 1, member.name];
      let present = 0;
      let absent = 0;

      dateRange.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        const isPresent = attendanceData[member.name]?.[dateStr] || false;
        const isOffDay = mealOffDays.some(d => d.date === dateStr);

        row.push(isOffDay ? 'Off' : isPresent ? '✓' : '✗');
        if (!isOffDay) {
          if (isPresent) present++;
          else absent++;
        }
      });

      const fine = (fixedMeal > present && fineEnabled) ? (fixedMeal - present) : 0;
      row.push(present, absent, fine);
      rows.push(row);
    });

    exportToExcel(`হাজিরা_শীট_${attStartDate || 'report'}`, 'হাজিরা শীট', rows);
  };

  // Attendance Rate Calculation
  let totalPresentOverall = 0;
  let totalAbsentOverall = 0;
  let totalPossibleOverall = attMembers.length * dateRange.length;

  attMembers.forEach(m => {
    if (attendanceData[m.name]) {
      dateRange.forEach(d => {
        const dateStr = d.toISOString().split('T')[0];
        const isOffDay = mealOffDays.some(off => off.date === dateStr);
        if (!isOffDay) {
          if (attendanceData[m.name][dateStr]) totalPresentOverall++;
          else totalAbsentOverall++;
        }
      });
    }
  });

  const attendanceRate = totalPossibleOverall > 0 ? ((totalPresentOverall / totalPossibleOverall) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {/* Date Range Generator */}
      <div className="bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">📅 শুরুর তারিখ</label>
            <input
              type="date"
              value={attStartDate}
              onChange={e => setAttStartDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">📅 শেষের তারিখ</label>
            <input
              type="date"
              value={attEndDate}
              onChange={e => setAttEndDate(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={onGenerateSheet}
            className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 h-9"
          >
            <Calendar className="w-4 h-4" /> শীট তৈরি করুন
          </button>
        </div>
      </div>

      {/* Fine Meal Toggle & Total Meal Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Toggle */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">⚠️ জরিমানা মিল গণনা</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              (ON = প্রেজেন্ট কম হলে জরিমানা ধরা হবে, OFF = ধরা হবে না)
            </span>
          </div>
          <button
            onClick={() => {
              onRequestConfirm(
                fineEnabled ? 'জরিমানা মিল গণনা বন্ধ করতে চান? (OFF)' : 'জরিমানা মিল গণনা চালু করতে চান? (ON)',
                () => setFineEnabled(!fineEnabled)
              );
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            {fineEnabled ? (
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-3 py-1.5 rounded-full font-bold text-xs">
                <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> ON
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 px-3 py-1.5 rounded-full font-bold text-xs">
                <ToggleLeft className="w-5 h-5 text-rose-600 dark:text-rose-300" /> OFF
              </div>
            )}
          </button>
        </div>

        {/* Total Meal Display Badge */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3 rounded-xl shadow-xs flex items-center justify-between">
          <span className="text-xs font-bold">📊 মোট খাবার (Total Meal)</span>
          <span className="text-xl font-extrabold bg-white/20 px-3 py-1 rounded-lg backdrop-blur-xs">
            {totalMealValue} <span className="text-xs font-normal">টি মিল</span>
          </span>
        </div>
      </div>

      {/* Info badges */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs font-semibold">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-2 rounded-xl">
          📊 মোট খাবারের দিন: {dateRange.length - mealOffDays.length} দিন
        </div>
        <div className="bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 p-2 rounded-xl">
          📌 ফিক্সড মিল: {fixedMeal}টি
        </div>
      </div>

      {/* Meal Off Day controls */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-xl space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 shrink-0">🍽️ Meal Off:</span>
            <input
              type="date"
              value={mealOffInputDate}
              onChange={e => setMealOffInputDate(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-1"
            />
            <button
              onClick={handleAddMealOffDay}
              className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all shrink-0"
            >
              Meal Off Day
            </button>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <select
              value={removeOffSelectDate}
              onChange={e => setRemoveOffSelectDate(e.target.value)}
              className="text-xs p-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex-1"
            >
              <option value="">-- Remove Off Day --</option>
              {mealOffDays.map(d => (
                <option key={d.date} value={d.date}>
                  {d.date} ({d.members} জন)
                </option>
              ))}
            </select>
            <button
              onClick={handleRemoveMealOffDay}
              className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all shrink-0"
            >
              Remove
            </button>
          </div>
        </div>

        {statusMsg && (
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 p-1.5 rounded-lg text-center">
            {statusMsg}
          </p>
        )}
      </div>

      {/* Attendance Sheet Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] relative">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white sticky top-0 z-20">
              <tr>
                <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold w-10">ক্রমিক</th>
                <th className="py-2 px-3 text-left border-b border-emerald-800 font-bold sticky left-0 bg-emerald-700 z-30 min-w-[100px]">
                  নাম
                </th>
                {dateRange.length === 0 ? (
                  <th className="py-2 px-4 text-center border-b border-emerald-800 font-bold bg-amber-600">
                    📅 তারিখ নির্বাচন করে শীট তৈরি করুন
                  </th>
                ) : (
                  dateRange.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const day = date.getDate();
                    const month = date.getMonth() + 1;
                    const dayName = date.toLocaleDateString('bn-BD', { weekday: 'short' });
                    const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                    const isOffDay = mealOffDays.some(d => d.date === dateStr);

                    return (
                      <th
                        key={dateStr}
                        className={`py-1.5 px-1 text-center border-b border-emerald-800 font-bold text-[10px] min-w-[32px] ${
                          isOffDay ? 'bg-amber-600 text-white' : isWeekend ? 'bg-teal-800' : ''
                        }`}
                        title={dateStr}
                      >
                        <div>{day}/{month}</div>
                        <div className="text-[8px] opacity-80">{dayName}</div>
                        {isOffDay && <span className="text-[7px] bg-amber-800 px-0.5 rounded block">Off</span>}
                      </th>
                    );
                  })
                )}
                {dateRange.length > 0 && (
                  <>
                    <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-emerald-800 min-w-[50px]">
                      প্রেজেন্ট
                    </th>
                    <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-rose-800 min-w-[50px]">
                      অনুপস্থিত
                    </th>
                    <th className="py-2 px-2 text-center border-b border-emerald-800 font-bold bg-amber-800 min-w-[50px]">
                      জরিমানা
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {dateRange.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    ⏳ শীট তৈরি করতে উপরের শুরুর ও শেষের তারিখ নির্বাচন করুন
                  </td>
                </tr>
              ) : (
                attMembers.map((member, index) => {
                  let presentCount = 0;
                  let absentCount = 0;

                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold sticky left-0 z-10 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-r border-slate-200 dark:border-slate-700">
                        {member.name}
                      </td>
                      {dateRange.map(date => {
                        const dateStr = date.toISOString().split('T')[0];
                        const isPresent = attendanceData[member.name]?.[dateStr] || false;
                        const isOffDay = mealOffDays.some(d => d.date === dateStr);

                        if (!isOffDay) {
                          if (isPresent) presentCount++;
                          else absentCount++;
                        }

                        if (isOffDay) {
                          return (
                            <td key={dateStr} className="py-2 px-1 text-center bg-amber-50 dark:bg-amber-950/50">
                              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Off</span>
                            </td>
                          );
                        }

                        return (
                          <td key={dateStr} className="py-2 px-1 text-center">
                            <input
                              type="checkbox"
                              checked={isPresent}
                              onChange={() => handleCheckboxChange(member.name, dateStr, isPresent)}
                              className="w-4 h-4 rounded-full border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                            />
                          </td>
                        );
                      })}
                      {(() => {
                        const fine = (fixedMeal > presentCount && fineEnabled) ? (fixedMeal - presentCount) : 0;
                        return (
                          <>
                            <td className="py-2 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                              {presentCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-rose-600 dark:text-rose-300">
                              {absentCount}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-amber-600 dark:text-amber-400">
                              {fine}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Total Row */}
            {dateRange.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                <tr>
                  <td className="py-2 px-2 text-center text-slate-500">📊</td>
                  <td className="py-2 px-3 sticky left-0 bg-slate-100 dark:bg-slate-900 z-10 border-r text-emerald-700 dark:text-emerald-400">
                    মোট উপস্থিতি
                  </td>
                  {dateRange.map(date => {
                    const dateStr = date.toISOString().split('T')[0];
                    const isOffDay = mealOffDays.some(d => d.date === dateStr);

                    if (isOffDay) {
                      return (
                        <td key={dateStr} className="py-2 px-1 text-center text-amber-600 text-[10px]">
                          Off
                        </td>
                      );
                    }

                    let dayPresentCount = 0;
                    attMembers.forEach(m => {
                      if (attendanceData[m.name]?.[dateStr]) dayPresentCount++;
                    });
                    const guestCount = guestCountPerDate[dateStr] || 0;
                    const totalSum = dayPresentCount + guestCount;
                    const displayText = guestCount > 0 ? `${dayPresentCount}+${guestCount}` : `${totalSum}`;

                    return (
                      <td
                        key={dateStr}
                        className="py-2 px-1 text-center font-extrabold text-emerald-700 dark:text-emerald-300 text-[11px]"
                        title={`উপস্থিতি: ${dayPresentCount}, গেস্ট: ${guestCount}`}
                      >
                        {displayText}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-emerald-600 dark:text-emerald-400">{totalPresentOverall}</td>
                  <td className="py-2 px-2 text-center text-rose-600 dark:text-rose-300 font-bold">{totalAbsentOverall}</td>
                  <td className="py-2 px-2 text-center text-amber-600 dark:text-amber-400">
                    {attMembers.reduce((acc, m) => {
                      let present = 0;
                      dateRange.forEach(d => {
                        const ds = d.toISOString().split('T')[0];
                        if (!mealOffDays.some(off => off.date === ds)) {
                          if (attendanceData[m.name]?.[ds]) present++;
                        }
                      });
                      const f = (fixedMeal > present && fineEnabled) ? (fixedMeal - present) : 0;
                      return acc + f;
                    }, 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
        <p className="font-bold flex items-center gap-1">
          <ShieldAlert className="w-4 h-4 text-amber-600" /> সময় লক নিয়ম (Time Lock Rule):
        </p>
        <p className="text-[11px]">
          যে তারিখে চেকবক্স ON করা হবে, সেই তারিখের বাংলাদেশ সময় রাত ১১:৫৯:৫৯ PM পর্যন্ত OFF করা যাবে। ১২:০০ AM এর পর আর OFF করা যাবে না।
        </p>
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
          onClick={() => onRequestConfirm('আপনি কি হাজিরা শীটের সব ডেটা রিসেট করতে চান?', onResetAttendance)}
          className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" /> রিসেট
        </button>
      </div>

      {/* Summary Box */}
      <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b pb-1">
          📊 হাজিরা সারাংশ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট সদস্য:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{attMembers.length} জন</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট দিন:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{dateRange.length} দিন</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">মোট উপস্থিতি:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{totalPresentOverall}টি</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">উপস্থিতির হার:</span>
            <span className="font-bold text-sky-600 dark:text-sky-400 text-sm">{attendanceRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
