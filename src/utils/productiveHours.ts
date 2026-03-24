import { Task, TimeEvent } from '../types';

// ── Raw ms from timeEvents (optionally within a date range) ──────────
export function calcTaskRawMs(
  timeEvents: TimeEvent[] | undefined,
  dateFrom?: string,
  dateTo?: string,
): number {
  if (!timeEvents || timeEvents.length === 0) return 0;
  let ms = 0;
  let lastStart: number | null = null;
  for (const e of timeEvents) {
    const ts = new Date(e.timestamp).getTime();
    if (e.type === 'start' || e.type === 'resume' || e.type === 'rework_start') {
      lastStart = ts;
    } else if ((e.type === 'pause' || e.type === 'end') && lastStart !== null) {
      if (dateFrom || dateTo) {
        const rangeStart = dateFrom ? new Date(dateFrom).getTime() : 0;
        const rangeEnd = dateTo ? new Date(dateTo + 'T23:59:59.999Z').getTime() : Infinity;
        const clampedStart = Math.max(lastStart, rangeStart);
        const clampedEnd = Math.min(ts, rangeEnd);
        if (clampedEnd > clampedStart) ms += clampedEnd - clampedStart;
      } else {
        ms += ts - lastStart;
      }
      lastStart = null;
    }
  }
  return ms;
}

// Keep old name as alias for backward compat
export const calcTaskMs = calcTaskRawMs;

// ── Legacy wrappers (old signature: timeEvents, estHours) ────────────
export function calcTaskProductiveMsLegacy(
  timeEvents: TimeEvent[] | undefined,
  estHours: number,
  dateFrom?: string,
  dateTo?: string,
): number {
  const actualMs = calcTaskRawMs(timeEvents, dateFrom, dateTo);
  if (!estHours || estHours <= 0) return actualMs;
  return Math.min(actualMs, estHours * 3600000);
}

export function calcTaskOverrunMsLegacy(
  timeEvents: TimeEvent[] | undefined,
  estHours: number,
  dateFrom?: string,
  dateTo?: string,
): number {
  if (!estHours || estHours <= 0) return 0;
  const actualMs = calcTaskRawMs(timeEvents, dateFrom, dateTo);
  return Math.max(0, actualMs - estHours * 3600000);
}

// ── Owner-specific ms (uses owner stamp if available, falls back to role match) ──
export function calcTaskOwnerMs(
  task: Task,
  ownerName: string,
  dateFrom?: string,
  dateTo?: string,
): number {
  const events = task.timeEvents || [];
  if (events.length === 0) return 0;

  const hasOwnerStamp = events.some(e => !!e.owner);

  if (hasOwnerStamp) {
    const ownerEvents = events.filter(e => e.owner === ownerName);
    return calcTaskRawMs(ownerEvents, dateFrom, dateTo);
  }

  // Fallback for old un-stamped events: if owner matches any role field → all time
  if (
    task.seoOwner === ownerName ||
    task.contentOwner === ownerName ||
    task.webOwner === ownerName ||
    task.assignedTo === ownerName
  ) {
    return calcTaskRawMs(events, dateFrom, dateTo);
  }
  return 0;
}

// ── Owner-specific est hours ─────────────────────────────────────────
export function calcOwnerEstHrs(task: Task, ownerName: string): number {
  if (task.deptType && task.deptType !== 'SEO') return task.estHours || 0;
  if (task.contentOwner === ownerName) return task.estHoursContent || 0;
  if (task.webOwner === ownerName) return task.estHoursWeb || 0;
  if (task.seoOwner === ownerName) return task.estHoursSEO || task.estHours || 0;
  return task.estHours || 0;
}

// ── Productive ms = min(owner ms, est ms) ────────────────────────────
export function calcTaskProductiveMs(
  task: Task,
  ownerName: string,
  dateFrom?: string,
  dateTo?: string,
): number {
  const ownerMs = calcTaskOwnerMs(task, ownerName, dateFrom, dateTo);
  const estMs = calcOwnerEstHrs(task, ownerName) * 3600000;
  if (estMs <= 0) return ownerMs;
  return Math.min(ownerMs, estMs);
}

// ── Overrun ms = max(0, owner ms − est ms) ───────────────────────────
export function calcTaskOverrunMs(
  task: Task,
  ownerName: string,
  dateFrom?: string,
  dateTo?: string,
): number {
  const ownerMs = calcTaskOwnerMs(task, ownerName, dateFrom, dateTo);
  const estMs = calcOwnerEstHrs(task, ownerName) * 3600000;
  if (estMs <= 0) return 0;
  return Math.max(0, ownerMs - estMs);
}

// ── Get combined est hours for a task (all depts) — legacy compat ────
export function getTaskEstHours(t: Task): number {
  return (t.estHoursSEO || t.estHours || 0) + (t.estHoursContent || 0) + (t.estHoursWeb || 0);
}

// ── Owner totals across tasks ────────────────────────────────────────
export function calcOwnerTotals(
  tasks: Task[],
  ownerName: string,
  dateFrom?: string,
  dateTo?: string,
): { loggedMs: number; productiveMs: number; overrunMs: number } {
  let loggedMs = 0, productiveMs = 0, overrunMs = 0;
  for (const t of tasks) {
    if (
      t.seoOwner !== ownerName &&
      t.contentOwner !== ownerName &&
      t.webOwner !== ownerName &&
      t.assignedTo !== ownerName
    ) continue;
    loggedMs += calcTaskOwnerMs(t, ownerName, dateFrom, dateTo);
    productiveMs += calcTaskProductiveMs(t, ownerName, dateFrom, dateTo);
    overrunMs += calcTaskOverrunMs(t, ownerName, dateFrom, dateTo);
  }
  return { loggedMs, productiveMs, overrunMs };
}

// Backward compat wrappers
export function calcOwnerProductiveHrs(tasks: Task[], owner: string, dateFrom?: string, dateTo?: string): number {
  return calcOwnerTotals(tasks, owner, dateFrom, dateTo).productiveMs / 3600000;
}
export function calcOwnerOverrunHrs(tasks: Task[], owner: string, dateFrom?: string, dateTo?: string): number {
  return calcOwnerTotals(tasks, owner, dateFrom, dateTo).overrunMs / 3600000;
}

// ── Dept label for an owner on a task ────────────────────────────────
export function getOwnerDeptLabel(task: Task, ownerName: string): string {
  if (task.deptType && task.deptType !== 'SEO') return task.deptType;
  if (task.contentOwner === ownerName) return 'Content';
  if (task.webOwner === ownerName) return 'Web';
  return 'SEO';
}

// ── Formatting helpers ───────────────────────────────────────────────
export function fmtMs(ms: number): string {
  if (!ms || ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function fmtH(h: number): string {
  if (!h || h < 0.01) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return hh > 0 ? `${hh}h ${String(mm).padStart(2, '0')}m` : `${mm}m`;
}

export function fmtHrs(h: number): string { return fmtH(h); }

export function msToHrs(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100;
}
