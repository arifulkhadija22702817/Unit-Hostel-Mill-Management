import React, { useState } from 'react';
import {
  Calendar,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  Lock,
  Clock,
  Check,
  X,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { MillMember, AttendanceData } from '../types';
import { UserRole } from './RoleAccessModal';
import { exportToExcel, triggerPrint } from '../utils/exportUtils';
import { canToggleOffForDate, getBangladeshDateString, getBangladeshTomorrowDateString } from '../utils/timeUtils';

interface TabAttendanceProps {
  userRole?: UserRole;
  currentMemberName?: string;
  onOpenRoleModal?: (tab?: 'login' | 'management' | 'logs' | 'settings') => void;
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
  autoCarryAttendance?: boolean;
  setAutoCarryAttendance?: (val: boolean) => void;
  guestCountPerDate: { [dateStr: string]: number };
  fixedMeal: number;
  totalMealValue: number;
  onGenerateSheet: () => void;
  onResetAttendance: () => void;
  onRequestConfirm: (message: string, onConfirm: () => void) => void;
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
  autoCarryAttendance = false,
  setAutoCarryAttendance,
  guestCountPerDate,
  fixedMeal,
  totalMealValue,
  onGenerateSheet,
  onResetAttendance,
  onRequestConfirm,
}) => {
  // Real-time Bangladesh timezone dates
  const todayDateStr = getBangladeshDateString();
  const tomorrowDateStr = getBangladeshTomorrowDateString();

  // Cell Click Handler (Strictly restricted to Admin and Editor roles)
  const handleCellClick = (memberName: string, dateStr: string, currentVal: boolean | undefined) => {
    // 1. Check if user is Admin or Editor
    if (userRole !== 'admin' && userRole !== 'editor') {
      alert('⚠️ মিলের উপস্থিতি/হাজিরা শুধুমাত্র এডমিন (Admin) এবং এডিটর (Editor) পরিবর্তন করতে পারবেন।\nএডিটর বা এডমিন হিসেবে লগইন করতে উপরের "ATM 3D পাঞ্চ" ব্যবহার করুন।');
      return;
    }

    // 2. Editor Check: time over restriction (Real BD Time: 12:00 AM past date or after 11:59:59 PM)
    if (userRole === 'editor') {
      if (!canToggleOffForDate(dateStr)) {
        alert(`⏰ "${dateStr}" তারিখের সময় (রাত ১১:৫৯:৫৯ PM) পার হয়ে গেছে!\n১২:০০ AM এর পর এডিটররা হাজিরা ON বা OFF কোনোটিই পরিবর্তন করতে পারবে না। শুধুমাত্র এডমিন (Admin) এটি আপডেট করতে পারবেন।`);
        return;
      }
    }

    const isPastOrTodayOrTomorrow = dateStr <= tomorrowDateStr;
    const isCurrentlyOn = currentVal === true;

    // 3. User requested prompt logic:
    // Off or Blank -> Turn ON option
    // On -> Turn OFF option
    if (!isCurrentlyOn) {
      // Currently OFF / Blank -> Prompt to turn ON
      const confirmMsg = (autoCarryAttendance && isPastOrTodayOrTomorrow)
        ? `🍽️ ${memberName} এর ${dateStr} তারিখের মিল "চালু (ON)" করতে চান?\n\n(🔄 রিয়েল টাইমজোন অনুযায়ী আগামীকাল (${tomorrowDateStr}) পর্যন্ত মিলটি স্বয়ংক্রিয়ভাবে চালু থাকবে)`
        : !isPastOrTodayOrTomorrow
          ? `🍽️ ${memberName} এর ${dateStr} তারিখের (ভবিষ্যতের দিন) মিল ম্যানুয়ালি "চালু (ON)" করতে চান? নিশ্চিত করুন।`
          : `🍽️ ${memberName} এর ${dateStr} তারিখের মিল "চালু (ON)" করতে চান? নিশ্চিত করুন।`;

      onRequestConfirm(confirmMsg, () => {
        setAttendanceData(prev => {
          const next = { ...prev };
          const memberData = { ...(next[memberName] || {}) };
          memberData[dateStr] = true;

          // If Auto-Carry is active and date is on/before tomorrow, propagate forward ONLY UP TO tomorrowDateStr
          if (autoCarryAttendance && isPastOrTodayOrTomorrow && dateRange.length > 0) {
            const currentIdx = dateRange.findIndex(d => d.toISOString().split('T')[0] === dateStr);
            if (currentIdx !== -1) {
              for (let i = currentIdx + 1; i < dateRange.length; i++) {
                const fDateStr = dateRange[i].toISOString().split('T')[0];
                if (fDateStr <= tomorrowDateStr) {
                  memberData[fDateStr] = true;
                }
              }
            }
          }

          next[memberName] = memberData;
          return next;
        });
      });
    } else {
      // Currently ON -> Prompt to turn OFF
      const confirmMsg = `🛑 ${memberName} এর ${dateStr} তারিখের মিল "বন্ধ (OFF)" করতে চান? নিশ্চিত করুন।`;

      onRequestConfirm(confirmMsg, () => {
        setAttendanceData(prev => ({
          ...prev,
          [memberName]: {
            ...(prev[memberName] || {}),
            [dateStr]: false,
          }
        }));
      });
    }
  };

  // Toggle Auto Carry Forward Switch
  const handleToggleAutoCarry = () => {
    if (!setAutoCarryAttendance) return;

    if (!autoCarryAttendance) {
      onRequestConfirm(
        `🔄 পূর্বের মিল রিয়েল টাইমজোন অনুযায়ী আগামীকাল (${tomorrowDateStr}) পর্যন্ত স্বয়ংক্রিয়ভাবে চালু (Auto-Forward) করতে চান?\n\n(আজকের উপস্থিতি শুধুমাত্র আগামীকাল ${tomorrowDateStr} পর্যন্ত স্বয়ংক্রিয়ভাবে চালু হবে। এর পরের তারিখগুলো ফাঁকা থাকবে এবং এডমিন/এডিটর প্রয়োজনে ম্যানুয়ালি অন/অফ করতে পারবেন)`,
        () => {
          setAutoCarryAttendance(true);
          // Apply forward propagation ONLY up to tomorrowDateStr
          if (dateRange.length > 1) {
            setAttendanceData(prev => {
              const next = { ...prev };
              attMembers.forEach(m => {
                const mData = { ...(next[m.name] || {}) };
                let isCarrying = false;
                dateRange.forEach(d => {
                  const dStr = d.toISOString().split('T')[0];
                  if (dStr <= tomorrowDateStr) {
                    if (mData[dStr] === true) {
                      isCarrying = true;
                    } else if (isCarrying) {
                      mData[dStr] = true;
                    }
                  }
                });
                next[m.name] = mData;
              });
              return next;
            });
          }
        }
      );
    } else {
      onRequestConfirm(
        '🔄 পূর্বের মিল স্বয়ংক্রিয়ভাবে চালু (Auto-Forward) বন্ধ করতে চান?\n\n(বন্ধ করলে বর্তমান ডাটা পরিবর্তন হবে না, কিন্তু পরবর্তীতে নতুন করে অটো-ফরওয়ার্ড হবে না)',
        () => {
          setAutoCarryAttendance(false);
        }
      );
    }
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
      ['অটো-ফরওয়ার্ড:', autoCarryAttendance ? `চালু (${tomorrowDateStr} পর্যন্ত)` : 'বন্ধ (OFF)'],
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
      let fine = 0;

      dateRange.forEach(date => {
        const dateStr = date.toISOString().split('T')[0];
        const rawVal = attendanceData[member.name]?.[dateStr];
        const isPastOrTodayOrTomorrow = dateStr <= tomorrowDateStr;

        if (rawVal === true) {
          row.push('✓');
          present++;
        } else if (isPastOrTodayOrTomorrow || rawVal === false) {
          row.push('✗');
          absent++;
        } else {
          row.push('-'); // Future blank
        }
      });

      fine = (fixedMeal > present && fineEnabled) ? (fixedMeal - present) : 0;
      row.push(present, absent, fine);
      rows.push(row);
    });

    exportToExcel(`হাজিরা_শীট_${attStartDate || 'report'}`, 'হাজিরা শীট', rows);
  };

  // Attendance Rate Calculation
  let totalPresentOverall = 0;
  let totalAbsentOverall = 0;
  let totalEvaluatedPossibleOverall = 0;

  attMembers.forEach(m => {
    dateRange.forEach(d => {
      const dateStr = d.toISOString().split('T')[0];
      const rawVal = attendanceData[m.name]?.[dateStr];
      const isPastOrTodayOrTomorrow = dateStr <= tomorrowDateStr;

      if (rawVal === true) {
        totalPresentOverall++;
        totalEvaluatedPossibleOverall++;
      } else if (isPastOrTodayOrTomorrow || rawVal === false) {
        totalAbsentOverall++;
        totalEvaluatedPossibleOverall++;
      }
    });
  });

  const attendanceRate = totalEvaluatedPossibleOverall > 0
    ? ((totalPresentOverall / totalEvaluatedPossibleOverall) * 100).toFixed(1)
    : '0';

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
            className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 h-9 cursor-pointer"
          >
            <Calendar className="w-4 h-4" /> শীট তৈরি করুন
          </button>
        </div>
      </div>

      {/* Control Panels: Fine Toggle, Auto-Forward Toggle & Total Meal Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Toggle 1: Fine Meal Toggle */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">⚠️ জরিমানা মিল গণনা</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              (ON = প্রেজেন্ট কম হলে জরিমানা ধরা হবে)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onRequestConfirm(
                fineEnabled ? 'জরিমানা মিল গণনা বন্ধ করতে চান? (OFF)' : 'জরিমানা মিল গণনা চালু করতে চান? (ON)',
                () => setFineEnabled(!fineEnabled)
              );
            }}
            className="flex items-center gap-2 cursor-pointer shrink-0"
            title="জরিমানা মিল গণনা চালু/বন্ধ"
          >
            {fineEnabled ? (
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1.5 rounded-full font-bold text-xs shadow-2xs">
                <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> ON
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200 px-2.5 py-1.5 rounded-full font-bold text-xs">
                <ToggleLeft className="w-5 h-5 text-rose-600 dark:text-rose-300" /> OFF
              </div>
            )}
          </button>
        </div>

        {/* Toggle 2: Auto-Carry Forward Toggle (Real time zone up to tomorrow) */}
        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5 pr-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${autoCarryAttendance ? 'text-emerald-500 animate-spin' : 'text-slate-400'}`} style={{ animationDuration: '4s' }} />
              পূর্বের মিল অটো চালু
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              (ON = রিয়েল টাইম অনুযায়ী আগামীকাল পর্যন্ত অটো অন)
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoCarry}
            className="flex items-center gap-2 cursor-pointer shrink-0"
            title="পূর্ববর্তী দিনের মিল আগামীকাল পর্যন্ত অটো চালুর টগল বাটন"
          >
            {autoCarryAttendance ? (
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-1.5 rounded-full font-bold text-xs shadow-2xs">
                <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> ON
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-full font-bold text-xs">
                <ToggleLeft className="w-5 h-5 text-slate-400 dark:text-slate-500" /> OFF
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-semibold">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-2 rounded-xl flex items-center justify-center gap-1.5">
          <span>📊</span>
          <span>খাবারের দিন: {dateRange.length} দিন</span>
        </div>
        <div className="bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 p-2 rounded-xl flex items-center justify-center gap-1.5">
          <span>📌</span>
          <span>ফিক্সড মিল: {fixedMeal}টি</span>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-2 rounded-xl flex items-center justify-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] font-bold">✓</span>
          <span>মিল চালু (ON)</span>
        </div>
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 p-2 rounded-xl flex items-center justify-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[9px] font-bold">✗</span>
          <span>মিল বন্ধ (OFF)</span>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 p-2 rounded-xl flex items-center justify-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-md border border-dashed border-slate-400 dark:border-slate-500 flex items-center justify-center text-[8px] font-bold text-slate-400">·</span>
          <span>ভবিষ্যতের দিন (ফাঁকা)</span>
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
                    const isToday = dateStr === todayDateStr;
                    const isTomorrow = dateStr === tomorrowDateStr;

                    return (
                      <th
                        key={dateStr}
                        className={`py-1.5 px-1 text-center border-b border-emerald-800 font-bold text-[10px] min-w-[34px] ${isToday
                          ? 'bg-amber-600 text-white ring-1 ring-amber-300'
                          : isTomorrow
                            ? 'bg-teal-900 text-emerald-200'
                            : isWeekend
                              ? 'bg-teal-800'
                              : ''
                          }`}
                        title={`${dateStr}${isToday ? ' (আজ)' : isTomorrow ? ' (আগামীকাল)' : ''}`}
                      >
                        <div>{day}/{month}</div>
                        <div className="text-[8px] opacity-80">
                          {isToday ? 'আজ' : isTomorrow ? 'কাল' : dayName}
                        </div>
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
                      className={`transition-colors ${isCurrentLoggedInMember
                        ? 'bg-sky-50/80 dark:bg-sky-950/50 font-medium ring-1 ring-inset ring-sky-400/60 dark:ring-sky-600/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                    >
                      <td className="py-2 px-2 text-center font-medium text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </td>
                      <td className={`py-2 px-3 sticky left-0 z-10 border-r border-slate-200 dark:border-slate-700 ${isCurrentLoggedInMember
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
                        const rawVal = attendanceData[member.name]?.[dateStr];
                        const isPastOrTodayOrTomorrow = dateStr <= tomorrowDateStr;
                        const isPresent = rawVal === true;
                        const isExplicitlyOff = rawVal === false;
                        const isBlank = !isPastOrTodayOrTomorrow && rawVal === undefined;
                        const isOff = isPastOrTodayOrTomorrow ? rawVal !== true : isExplicitlyOff;

                        if (isPresent) presentCount++;
                        else if (isOff) absentCount++;

                        const isTimeOver = !canToggleOffForDate(dateStr);
                        const canEditAttendance = userRole === 'admin' || (userRole === 'editor' && !isTimeOver);

                        return (
                          <td key={dateStr} className="py-1.5 px-0.5 text-center">
                            <button
                              type="button"
                              disabled={!canEditAttendance}
                              onClick={() => handleCellClick(member.name, dateStr, rawVal)}
                              className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded-lg flex items-center justify-center font-extrabold text-xs transition-all shadow-2xs ${isPresent
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs scale-105 active:scale-95 ring-1 ring-emerald-400/80 dark:ring-emerald-500/80'
                                : isOff
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/70 active:scale-95'
                                  : 'bg-slate-50 dark:bg-slate-900/40 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 active:scale-95'
                                } ${!canEditAttendance
                                  ? 'cursor-not-allowed opacity-60'
                                  : 'cursor-pointer hover:shadow-xs'
                                }`}
                              title={
                                userRole === 'editor' && isTimeOver
                                  ? `⏰ সময় শেষ (${dateStr})! রাত ১২:০০ AM পার হওয়ায় এডিটররা পরিবর্তন করতে পারবে না, শুধুমাত্র এডমিন আপডেট করতে পারবেন।`
                                  : !canEditAttendance
                                    ? `মিল হাজিরা এডিট করার ক্ষমতা শুধুমাত্র এডমিন ও এডিটরদের রয়েছে (${member.name}: ${isPresent ? 'চালু (✓)' : isOff ? 'বন্ধ (✗)' : 'ফাঁকা'})`
                                    : isPresent
                                      ? `${member.name}: ${dateStr} - মিল চালু আছে (✓)। ক্লিক করে "বন্ধ (OFF)" করুন`
                                      : isOff
                                        ? `${member.name}: ${dateStr} - মিল বন্ধ আছে (✗)। ক্লিক করে "চালু (ON)" করুন`
                                        : `${member.name}: ${dateStr} - ভবিষ্যতের ফাঁকা তারিখ। ক্লিক করে ম্যানুয়ালি "চালু (ON)" করুন`
                              }
                            >
                              {isPresent ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : isOff ? (
                                <X className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : (
                                <span className="text-[10px] text-slate-300 dark:text-slate-600 font-normal">·</span>
                              )}
                            </button>
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
                      if (attendanceData[m.name]?.[dateStr] === true) dayPresentCount++;
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
                        if (attendanceData[m.name]?.[ds] === true) present++;
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
          <ShieldAlert className="w-4 h-4 text-amber-600" /> সময় লক ও অটো-চালু নিয়ম (Real-Time Rules):
        </p>
        <p className="text-[11px]">
          ১. <strong>পূর্বের মিল অটো চালু:</strong> রিয়েল টাইমজোন (UTC+6) অনুযায়ী আজকের উপস্থিতি শুধুমাত্র আগামীকাল ({tomorrowDateStr}) পর্যন্ত স্বয়ংক্রিয়ভাবে চালু থাকবে। পরবর্তী ভবিষ্যতের তারিখগুলো ফাঁকা থাকবে যা এডমিন ও এডিটর প্রয়োজনে ম্যানুয়ালি অন/অফ করতে পারবেন।<br />
          ২. <strong>সময় লক:</strong> নির্ধারিত তারিখের রাত ১১:৫৯:৫৯ PM পর্যন্ত এডিটররা হাজিরা (ON / OFF) পরিবর্তন করতে পারবেন। রাত ১২:০০ AM পার হলে <strong>শুধুমাত্র এডমিন (Admin)</strong> হাজিরা আপডেট করতে পারবেন।
        </p>
      </div>

      {/* Action Buttons */}
      // TabAttendance.tsx - Action Buttons অংশ (লাইন ~730-740)

      // TabAttendance.tsx - Action Buttons অংশ (লাইন ~730-740)

      <div className="no-print grid grid-cols-3 gap-2">
        <button
          onClick={handleExportExcel}
          className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" /> Excel
        </button>

        <button
          onClick={triggerPrint}
          className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Printer className="w-4 h-4" /> PDF / Print
        </button>

        {/* রিসেট বাটন - শুধুমাত্র এডমিন */}
        {userRole === 'admin' && (
          <button
            onClick={() => onRequestConfirm('আপনি কি হাজিরা শীটের সব ডেটা রিসেট করতে চান?', onResetAttendance)}
            className="py-2.5 px-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> রিসেট
          </button>
        )}
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



