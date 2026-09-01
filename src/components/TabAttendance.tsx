import React, { useState } from 'react';
import { Calendar, FileSpreadsheet, Printer, RotateCcw, AlertCircle, CheckCircle2, ShieldAlert, ToggleLeft, ToggleRight, UserCheck, Lock, Clock } from 'lucide-react';
import { MillMember, AttendanceData } from '../types';
import { UserRole } from './RoleAccessModal';
import { exportToExcel, triggerPrint } from '../utils/exportUtils';
import { canToggleOffForDate } from '../utils/timeUtils';

interface TabAttendanceProps {
  userRole?: UserRole;
  currentMemberName?: string;
  onOpenRoleModal?: (tab?: 'login' | 'google_link' | 'management' | 'logs' | 'settings') => void;
  attStartDate: string;
  setAttStartDate: (s: string) => void;
  attEndDate: string;
  setAttEndDate: (e: string) => void;
  dateRange: Date[];
  setDateRange: (d: Date[]) => void;
  attendanceData: AttendanceData;
  setAttendanceData: React.Dispatch<React.SetStateAction<AttendanceData>>;
  attMembers: MillMember[];
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
  currentMemberName = '',
  onOpenRoleModal,
  attStartDate,
  setAttStartDate,
  attEndDate,
  setAttEndDate,
  dateRange,
  attendanceData,
  setAttendanceData,
  attMembers,
  fineEnabled,
  setFineEnabled,
  guestCountPerDate,
  fixedMeal,
  totalMealValue,
  onGenerateSheet,
  onResetAttendance,
  onRequestConfirm,
}) => {
  // Toggle Checkbox (Strictly restricted to Admin and Editor roles)
  const handleCheckboxChange = (memberName: string, dateStr: string, currentVal: boolean) => {
    // 1. Check if user is Admin or Editor
    if (userRole !== 'admin' && userRole !== 'editor') {
      if (onOpenRoleModal) {
        onOpenRoleModal('login');
      }
      alert('⚠️ মিলের উপস্থিতি/হাজিরা শুধুমাত্র এডমিন (Admin) এবং এডিটর (Editor) পরিবর্তন করতে পারবেন।\nসাধারণ সদস্যরা এটি এডিট করতে পারবেন না।');
      return;
    }

    // 2. Editor Check: past day toggle off restriction
    if (userRole === 'editor') {
      const newVal = !currentVal;
      if (!newVal && !canToggleOffForDate(dateStr)) {
        alert(`⏰ "${dateStr}" তারিখের রাত ১১:৫৯:৫৯ PM পার হয়ে গেছে!\n১২:০০ AM এর পর এডিটররা হাজিরা OFF করতে পারবে না। এডমিন এটি পরিবর্তন করতে পারবেন।`);
        return;
      }
    }

    // 3. Update attendance
    const newVal = !currentVal;
    setAttendanceData(prev => ({
      ...prev,
      [memberName]: {
        ...(prev[memberName] || {}),
        [dateStr]: newVal,
      }
    }));
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
        row.push(isPresent ? '✓' : '✗');
        if (isPresent) present++;
        else absent++;
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
        if (attendanceData[m.name][dateStr]) totalPresentOverall++;
        else totalAbsentOverall++;
      });
    }
  });

  const attendanceRate = totalPossibleOverall > 0 ? ((totalPresentOverall / totalPossibleOverall) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      {/* Print-only Header */}
      <div className="print-header">
        <h1>মেস হিসাব - মিল হাজিরার সম্পূর্ণ শীট</h1>
        <p>সময়কাল: {attStartDate || 'নির্ধারিত নয়'} হতে {attEndDate || 'নির্ধারিত নয়'} | মোট সদস্য: {attMembers.length} জন | মোট মিল সংখ্যা: {totalMealValue}</p>
      </div>

      {/* Member / Viewer Status Banner */}
      {userRole === 'member' && currentMemberName && (
        <div className="bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/60 dark:to-blue-950/60 border border-sky-300 dark:border-sky-700/60 p-3 rounded-xl flex items-center justify-between gap-3 text-xs text-sky-900 dark:text-sky-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              👤
            </div>
            <div>
              <p className="font-bold text-sm text-sky-950 dark:text-sky-100">
                স্বাগতম, {currentMemberName}! আপনি মেস সদস্য মোডে আছেন।
              </p>
              <p className="text-[11px] text-sky-800 dark:text-sky-300">
                আপনি মেসের সমস্ত মিল ও হাজিরা দেখতে পারবেন। মিল হাজিরা এডিট/পরিবর্তন করার ক্ষমতা শুধুমাত্র এডমিন ও এডিটরদের রয়েছে।
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <span className="inline-flex items-center gap-1 text-[11px] bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-200 px-2.5 py-1 rounded-lg font-bold">
              👁️ ভিউ মোড
            </span>
          </div>
        </div>
      )}

      {userRole === 'viewer' && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-3 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              👁️
            </div>
            <div>
              <p className="font-bold text-amber-950 dark:text-amber-100">
                আপনি ভিউয়ার মোডে আছেন
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                মেসের সমস্ত হিসাব দেখতে পারছেন। হাজিরা বা হিসাব এডিট করতে এডমিন অথবা এডিটর মোডে প্রবেশ করুন।
              </p>
            </div>
          </div>
          {onOpenRoleModal && (
            <button
              onClick={() => onOpenRoleModal('login')}
              className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 shrink-0"
            >
              🔑 লগইন / রোল পরিবর্তন
            </button>
          )}
        </div>
      )}

      {/* Date Range Generator */}
      <div className="no-print bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
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
          📊 মোট খাবারের দিন: {dateRange.length} দিন
        </div>
        <div className="bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 p-2 rounded-xl">
          📌 ফিক্সড মিল: {fixedMeal}টি
        </div>
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

                    return (
                      <th
                        key={dateStr}
                        className={`py-1.5 px-1 text-center border-b border-emerald-800 font-bold text-[10px] min-w-[32px] ${
                          isWeekend ? 'bg-teal-800' : ''
                        }`}
                        title={dateStr}
                      >
                        <div>{day}/{month}</div>
                        <div className="text-[8px] opacity-80">{dayName}</div>
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
                  const isCurrentLoggedInMember = userRole === 'member' && currentMemberName && member.name.trim().toLowerCase() === currentMemberName.trim().toLowerCase();

                  return (
                    <tr 
                      key={index} 
                      className={`transition-colors ${
                        isCurrentLoggedInMember 
                          ? 'bg-sky-50/80 dark:bg-sky-950/50 font-medium ring-1 ring-inset ring-sky-400/60 dark:ring-sky-600/60' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className={`py-2 px-3 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 ${
                        isCurrentLoggedInMember
                          ? 'bg-sky-100 dark:bg-sky-900/90 text-sky-950 dark:text-sky-100 font-bold'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold'
                      }`}>
                        <div className="flex items-center gap-1.5 justify-between">
                          <span>{member.name}</span>
                          {isCurrentLoggedInMember && (
                            <span className="text-[10px] bg-sky-600 text-white px-1.5 py-0.5 rounded-md font-extrabold shadow-xs">
                              আপনি
                            </span>
                          )}
                        </div>
                      </td>
                      {dateRange.map(date => {
                        const dateStr = date.toISOString().split('T')[0];
                        const isPresent = attendanceData[member.name]?.[dateStr] || false;

                        if (isPresent) presentCount++;
                        else absentCount++;

                        const canEditAttendance = userRole === 'admin' || userRole === 'editor';

                        return (
                          <td key={dateStr} className="py-2 px-1 text-center">
                            <input
                              type="checkbox"
                              checked={isPresent}
                              disabled={!canEditAttendance}
                              onChange={() => handleCheckboxChange(member.name, dateStr, isPresent)}
                              className={`w-4 h-4 rounded-full border-slate-300 dark:border-slate-600 transition-transform ${
                                !canEditAttendance
                                  ? 'cursor-not-allowed opacity-50 text-slate-400 accent-slate-400'
                                  : isCurrentLoggedInMember
                                  ? 'cursor-pointer text-sky-600 focus:ring-sky-500 accent-sky-600 scale-110'
                                  : 'cursor-pointer text-emerald-600 focus:ring-emerald-500 accent-emerald-600'
                              }`}
                              title={
                                !canEditAttendance
                                  ? `মিল হাজিরা এডিট করার ক্ষমতা শুধুমাত্র এডমিন ও এডিটরদের রয়েছে (${member.name}: ${isPresent ? 'উপস্থিত' : 'অনুপস্থিত'})`
                                  : `${member.name}: ${isPresent ? 'উপস্থিত (✓)' : 'অনুপস্থিত (✗)'} - ক্লিক করে পরিবর্তন করুন`
                              }
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
                        if (attendanceData[m.name]?.[ds]) present++;
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
      <div className="no-print bg-amber-50 dark:bg-amber-950/40 border-l-4 border-amber-500 p-2.5 rounded-lg text-xs text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
        <p className="font-bold flex items-center gap-1">
          <ShieldAlert className="w-4 h-4 text-amber-600" /> সময় লক নিয়ম (Time Lock Rule):
        </p>
        <p className="text-[11px]">
          যে তারিখে চেকবক্স ON করা হবে, সেই তারিখের বাংলাদেশ সময় রাত ১১:৫৯:৫৯ PM পর্যন্ত OFF করা যাবে। ১২:০০ AM এর পর আর OFF করা যাবে না।
        </p>
      </div>

      {/* Action Buttons */}
      <div className="no-print grid grid-cols-3 gap-2">
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

