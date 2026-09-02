import { BazarRow } from '../types';

// Time utility functions based on Bangladesh Time (UTC+6)

export function getBangladeshTime(): Date {
  const now = new Date();
  // UTC+6 (Bangladesh Standard Time: 6 hours = 6 * 60 * 60 * 1000 ms)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (6 * 60 * 60 * 1000));
  return bdTime;
}

export function getBangladeshDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date());
  } catch (e) {
    const bdTime = getBangladeshTime();
    return bdTime.toISOString().split('T')[0];
  }
}

export function isDateEditableForEditor(dateStr: string): boolean {
  const currentDate = getBangladeshDateString();
  const bdTime = getBangladeshTime();

  if (dateStr > currentDate) return true; // Future date
  if (dateStr < currentDate) return false; // Past date (time over after 12:00 AM)

  // Current date: allowed until 11:59:59 PM today
  const hours = bdTime.getHours();
  const minutes = bdTime.getMinutes();
  const seconds = bdTime.getSeconds();

  if (hours < 23) return true;
  if (hours === 23 && minutes < 59) return true;
  if (hours === 23 && minutes === 59 && seconds <= 59) return true;
  return false;
}

export function canToggleOffForDate(dateStr: string): boolean {
  return isDateEditableForEditor(dateStr);
}

/**
 * Validates whether a general mess member is permitted to update attendance on a specific date.
 * Rule:
 * - On the day of attendance (12:00 AM to 09:59 PM): Permitted (hours 0 to 21).
 * - From 10:00 PM onwards on that day or on past days: Locked for members (only Admin & Editor allowed).
 */
export function isMemberAttendanceWindowOpen(dateStr: string): { allowed: boolean; reason?: string } {
  const currentDate = getBangladeshDateString();
  const bdTime = getBangladeshTime();

  if (dateStr < currentDate) {
    return {
      allowed: false,
      reason: `⚠️ "${dateStr}" তারিখটি অতীত হয়ে গেছে। অতীত তারিখের হাজিরা শুধুমাত্র এডমিন বা এডিটর পরিবর্তন করতে পারবেন।`
    };
  }

  if (dateStr === currentDate) {
    const hours = bdTime.getHours();
    if (hours >= 22) {
      return {
        allowed: false,
        reason: `⏰ রাত ১০:০০ PM পার হয়ে যাওয়ায় আজকের (${dateStr}) মিল হাজিরা আপডেট সময় শেষ!\n(সদস্যরা প্রতিদিন রাত ১২:০০ AM থেকে রাত ০৯:৫৯ PM পর্যন্ত হাজিরা পরিবর্তন করতে পারেন)। কোনো পরিবর্তনের প্রয়োজন হলে এডমিন বা এডিটরকে জানান।`
      };
    }
    return { allowed: true };
  }

  // Future dates (Allowed for members to pre-declare)
  return { allowed: true };
}

export function canRemoveDeposit(entryTimestamp?: string): boolean {
  if (!entryTimestamp) return true;
  const now = getBangladeshTime().getTime();
  const entry = new Date(entryTimestamp).getTime();
  if (isNaN(entry)) return true;
  const diff = now - entry;
  return diff < 3600000; // 1 hour = 3,600,000 ms
}

export function canUpdateBazarRow(row: BazarRow): boolean {
  const now = getBangladeshTime().getTime();
  
  // If explicitly updated before, check 24h limit from updatedAt
  if (row.updatedAt) {
    const updatedTime = new Date(row.updatedAt).getTime();
    if (!isNaN(updatedTime)) {
      return (now - updatedTime) < 86400000; // 24 hours in ms
    }
  }

  // If no data entered yet, editing is allowed
  if (!row.bigBazar && !row.smallBazar && !row.bigSignature && !row.smallSignature) {
    return true;
  }

  // If data exists but no updatedAt set, check row date
  if (row.date) {
    const rowDateTime = new Date(row.date).getTime();
    if (!isNaN(rowDateTime)) {
      return (now - rowDateTime) < 86400000;
    }
  }

  return true;
}

export function formatBnTime(dateObj?: Date): string {
  const date = dateObj || getBangladeshTime();
  return date.toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
