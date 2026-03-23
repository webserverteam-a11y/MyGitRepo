import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isToday(dateString: string) {
  if (!dateString) return false;
  // Use local date for "today" to match user expectations
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return dateString === `${year}-${month}-${day}`;
}

export function formatDate(dateString: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).replace(/ /g, '-');
}

/** Add N working days (Mon–Fri) to a date string, returns a Date */
export function addWorkingDays(dateStr: string, days: number): Date {
  const date = new Date(dateStr + 'T00:00:00');
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return date;
}

/**
 * Calculate deadline for a dept assignment.
 * estHours > 0: deadline = assignedDate + ceil(estHours/7.5) working days (assigned day = day 1)
 * estHours = 0: fallback = assignedDate + 2 working days
 */
export function getDeptDeadline(assignedDate: string, estHours: number): Date | null {
  if (!assignedDate) return null;
  const workingDays = estHours > 0 ? Math.ceil(estHours / 7.5) : 2;
  const deadline = new Date(assignedDate + 'T00:00:00');
  let daysToAdd = workingDays - 1; // assigned day = day 1
  while (daysToAdd > 0) {
    deadline.setDate(deadline.getDate() + 1);
    const dow = deadline.getDay();
    if (dow !== 0 && dow !== 6) daysToAdd--;
  }
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

/**
 * Returns delayed info for a dept.
 * Checks: calendar overdue AND/OR time overrun.
 */
export function getDeptDelayedInfo(
  assignedDate: string,
  estHours: number,
  activeMs: number
): { isDelayed: boolean; reason: 'calendar' | 'overrun' | 'both' | null; deadlineDate: Date | null } {
  const deadline = getDeptDeadline(assignedDate, estHours);
  const now = new Date();
  const calendarDelayed = deadline !== null && now > deadline;
  const timeOverrun = estHours > 0 && activeMs / 3600000 > estHours;
  if (calendarDelayed && timeOverrun) return { isDelayed: true, reason: 'both', deadlineDate: deadline };
  if (calendarDelayed) return { isDelayed: true, reason: 'calendar', deadlineDate: deadline };
  if (timeOverrun) return { isDelayed: true, reason: 'overrun', deadlineDate: deadline };
  return { isDelayed: false, reason: null, deadlineDate: deadline };
}

// Returns all unique owner names from the users array (primary source of truth)
// Falls back to adminOptions lists for any not linked to a user account
export function getAllOwners(users: import('./types').AppUser[], adminOptions: import('./types').AdminOptions): string[] {
  const fromUsers = users
    .filter(u => u.role !== 'admin' && u.ownerName?.trim())
    .map(u => u.ownerName.trim());
  const fromLists = [
    ...adminOptions.seoOwners,
    ...adminOptions.contentOwners,
    ...adminOptions.webOwners,
  ];
  return Array.from(new Set([...fromUsers, ...fromLists])).filter(Boolean);
}
