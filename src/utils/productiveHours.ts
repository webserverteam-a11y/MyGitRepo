import { Task, TimeEvent } from '../types';

/**
 * Core productive hours logic:
 *   productive = min(actual logged ms, est hours × 3600000)
 *   overrun    = max(0, actual logged ms - est hours × 3600000)
 *   No est set → all logged = productive, overrun = 0
 *   Rework time included in actual — cap handles it automatically
 */

// ── Raw ms from timeEvents (optionally within a date range) ──────────
export function calcTaskMs(
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
      // If range filtering, clip the interval
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

// ── Productive ms = min(actual, est) ─────────────────────────────────
export function calcTaskProductiveMs(
  timeEvents: TimeEvent[] | undefined,
  estHours: number,
  dateFrom?: string,
  dateTo?: string,
): number {
  const actualMs = calcTaskMs(timeEvents, dateFrom, dateTo);
  if (!estHours || estHours <= 0) return actualMs; // no est → all productive
  return Math.min(actualMs, estHours * 3600000);
}

// ── Overrun ms = max(0, actual − est) ────────────────────────────────
export function calcTaskOverrunMs(
  timeEvents: TimeEvent[] | undefined,
  estHours: number,
  dateFrom?: string,
  dateTo?: string,
): number {
  if (!estHours || estHours <= 0) return 0; // no est → no overrun
  const actualMs = calcTaskMs(timeEvents, dateFrom, dateTo);
  return Math.max(0, actualMs - estHours * 3600000);
}

// ── Get combined est hours for a task (all depts) ────────────────────
export function getTaskEstHours(t: Task): number {
  return (t.estHoursSEO || t.estHours || 0) + (t.estHoursContent || 0) + (t.estHoursWeb || 0);
}

// ── Owner-level aggregation (sum across tasks) ───────────────────────
export function calcOwnerProductiveHrs(
  tasks: Task[],
  owner: string,
  dateFrom?: string,
  dateTo?: string,
): number {
  let totalMs = 0;
  for (const t of tasks) {
    if (t.seoOwner !== owner && t.contentOwner !== owner && t.webOwner !== owner && t.assignedTo !== owner)
      continue;
    const est = getTaskEstHours(t);
    totalMs += calcTaskProductiveMs(t.timeEvents, est, dateFrom, dateTo);
  }
  return totalMs / 3600000;
}

export function calcOwnerOverrunHrs(
  tasks: Task[],
  owner: string,
  dateFrom?: string,
  dateTo?: string,
): number {
  let totalMs = 0;
  for (const t of tasks) {
    if (t.seoOwner !== owner && t.contentOwner !== owner && t.webOwner !== owner && t.assignedTo !== owner)
      continue;
    const est = getTaskEstHours(t);
    totalMs += calcTaskOverrunMs(t.timeEvents, est, dateFrom, dateTo);
  }
  return totalMs / 3600000;
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

export function msToHrs(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100;
}
