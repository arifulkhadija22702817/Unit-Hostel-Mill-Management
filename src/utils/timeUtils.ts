import { BazarRow } from '../types';

// Time utility functions based on Bangladesh Time (UTC+6)

export function getBangladeshTime(): Date {
  const now = new Date();
  // Adjust time to UTC+6
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const bdTime = new Date(utc + (360000 * 6));
  return bdTime;
}

export function getBangladeshDateString(): string {
  const bdTime = getBangladeshTime();
  return bdTime.toISOString().split('T')[0];
}

export function canToggleOffForDate(dateStr: string): boolean {
  const bdTime = getBangladeshTime();
  const currentDate = bdTime.toISOString().split('T')[0];

  if (dateStr > currentDate) return true; // Future date
  if (dateStr < currentDate) return false; // Past date (12:00 AM of next day has passed)

  // Current date: allowed until 11:59:59 PM today
  const hours = bdTime.getHours();
  const minutes = bdTime.getMinutes();
  const seconds = bdTime.getSeconds();

  if (hours < 23) return true;
  if (hours === 23 && minutes < 59) return true;
  if (hours === 23 && minutes === 59 && seconds <= 59) return true;
  return false;
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
