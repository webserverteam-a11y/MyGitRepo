import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAllOwners } from '../hooks/useAllOwners';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import {
  calcTaskRawMs, calcTaskOwnerMs, calcOwnerEstHrs,
  calcTaskProductiveMs, calcTaskOverrunMs, calcOwnerTotals,
  getOwnerDeptLabel, getTaskEstHours, fmtMs, fmtH, msToHrs,
} from '../utils/productiveHours';

const TARGET_H = 8;
const STORAGE_KEY = 'seo_leave_records';

type LeaveType = 'full' | 'half' | 'holiday';
interface LeaveRecord { id: string; owner: string; date: string; type: LeaveType; note?: string; }
type DateChip = 'today' | 'week' | 'month' | 'custom';

function loadLeave(): LeaveRecord[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
function saveLeave(d: LeaveRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function pad2(n: number) { return String(n).padStart(2, '0'); }
function isWeekend(ds: string) { const d = new Date(ds); return d.getDay() === 0 || d.getDay() === 6; }
function dayLabel(ds: string) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(ds).getDay()]; }
function getDateRange(from: string, to: string): string[] {
  const dates: string[] = []; let d = new Date(from); const end = new Date(to);
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  return dates;
}
function getWeekRange(ref: string) {
  const d = new Date(ref); const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] };
}
function getMonthRange(ref: string) {
  const d = new Date(ref);
  return { from: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`, to: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] };
}
function weekBuckets(dates: string[]): { label: string; from: string; to: string; dates: string[] }[] {
  const buckets: { label: string; from: string; to: string; dates: string[] }[] = [];
  let idx = 0;
  while (idx < dates.length) {
    const start = dates[idx];
    const wEnd = idx + 6 < dates.length ? dates[idx + 6] : dates[dates.length - 1];
    const chunk = dates.slice(idx, idx + 7);
    buckets.push({ label: `W${buckets.length + 1} ${start.slice(5)}–${wEnd.slice(5)}`, from: start, to: wEnd, dates: chunk });
    idx += 7;
  }
  return buckets;
}

// Owner day ms helper — uses the new owner-aware logic
function getOwnerDayMs(tasks: any[], owner: string, ds: string): number {
  let total = 0;
  for (const t of tasks) {
    if (t.seoOwner !== owner && t.contentOwner !== owner && t.webOwner !== owner && t.assignedTo !== owner) continue;
    total += calcTaskOwnerMs(t, owner, ds, ds);
  }
  return total;
}

function getOwnerDayProductiveMs(tasks: any[], owner: string, ds: string): number {
  let total = 0;
  for (const t of tasks) {
    if (t.seoOwner !== owner && t.contentOwner !== owner && t.webOwner !== owner && t.assignedTo !== owner) continue;
    total += calcTaskProductiveMs(t, owner, ds, ds);
  }
  return total;
}

export function Timesheet() {
  const { tasks, currentUser, isAdmin } = useAppContext();
  const todayStr = new Date().toISOString().split('T')[0];

  const [leave, setLeave] = useState<LeaveRecord[]>(loadLeave);
  const updateLeave = (d: LeaveRecord[]) => { setLeave(d); saveLeave(d); };

  // ── Filters ──
  const [activeChip, setActiveChip] = useState<DateChip>('today');
  const [refDate, setRefDate] = useState(todayStr);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [ownerFilter, setOwnerFilter] = useState(() => !isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All');
  const [activeTab, setActiveTab] = useState<'timesheet' | 'overview' | 'leave'>('timesheet');
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [newLeave, setNewLeave] = useState({ owner: currentUser?.ownerName || '', date: todayStr, type: 'full' as LeaveType, note: '' });

  useEffect(() => {
    if (activeChip === 'today') { setDateFrom(todayStr); setDateTo(todayStr); }
    else if (activeChip === 'week') { const r = getWeekRange(refDate); setDateFrom(r.from); setDateTo(r.to); }
    else if (activeChip === 'month') { const r = getMonthRange(refDate); setDateFrom(r.from); setDateTo(r.to); }
  }, [activeChip, refDate, todayStr]);

  const allOwners = useAllOwners();
  const visibleOwners = ownerFilter === 'All' ? allOwners : [ownerFilter];
  const allDates = useMemo(() => getDateRange(dateFrom, dateTo), [dateFrom, dateTo]);
  const dayCount = allDates.length;
  const useWeekCols = dayCount > 14;
  const weeks = useMemo(() => useWeekCols ? weekBuckets(allDates) : [], [useWeekCols, allDates]);

  // ── Working days / leave helpers ──
  const getWorkingDays = (owner: string) => {
    return allDates.filter(ds => !isWeekend(ds)).map(ds => {
      const lv = leave.find(l => l.owner === owner && l.date === ds);
      const holiday = leave.find(l => l.type === 'holiday' && l.date === ds);
      const leaveType = holiday ? 'holiday' as LeaveType : lv?.type || null;
      const effectiveHrs = leaveType === 'full' || leaveType === 'holiday' ? 0 : leaveType === 'half' ? TARGET_H / 2 : TARGET_H;
      return { date: ds, effectiveHrs, leaveType };
    });
  };

  const isLeaveDay = (owner: string, ds: string) => {
    return leave.some(l => (l.owner === owner || l.type === 'holiday') && l.date === ds);
  };
  const getLeaveType = (owner: string, ds: string): LeaveType | null => {
    const holiday = leave.find(l => l.type === 'holiday' && l.date === ds);
    if (holiday) return 'holiday';
    const lv = leave.find(l => l.owner === owner && l.date === ds);
    return lv?.type || null;
  };

  const ownerSummary = (owner: string) => {
    const workDays = getWorkingDays(owner);
    const targetHrs = workDays.reduce((s, d) => s + d.effectiveHrs, 0);
    const totals = calcOwnerTotals(tasks, owner, dateFrom, dateTo);
    const loggedHrs = totals.loggedMs / 3600000;
    const productiveHrs = totals.productiveMs / 3600000;
    const overrunHrs = totals.overrunMs / 3600000;
    const shortfall = Math.max(0, targetHrs - productiveHrs);
    const leaveDays = workDays.filter(d => d.leaveType !== null).length;
    const pct = targetHrs > 0 ? Math.round(productiveHrs / targetHrs * 100) : 0;
    const daysLogged = workDays.filter(d => getOwnerDayMs(tasks, owner, d.date) > 0).length;
    const maxDay = workDays.reduce((max, d) => { const h = getOwnerDayMs(tasks, owner, d.date) / 3600000; return h > max.h ? { h, date: d.date } : max; }, { h: 0, date: '' });
    return { targetHrs, loggedHrs, productiveHrs, overrunHrs, shortfall, leaveDays, workDays: workDays.length, pct, daysLogged, maxDay };
  };

  const cellColor = (productive: number, expected: number, isLeave: boolean, isWknd: boolean) => {
    if (isLeave) return { bg: '#E1F5EE', color: '#085041' };
    if (isWknd) return { bg: '#F8F9FA', color: '#888780' };
    if (expected === 0) return { bg: '#F1EFE8', color: '#888780' };
    if (productive === 0) return { bg: 'transparent', color: '#ccc' };
    const pct = productive / expected;
    if (pct >= 1) return { bg: '#EAF3DE', color: '#27500A' };
    if (pct >= 0.75) return { bg: '#FAEEDA', color: '#633806' };
    if (pct >= 0.5) return { bg: '#FFF3E0', color: '#E65100' };
    return { bg: '#FCEBEB', color: '#791F1F' };
  };

  const toggleCollapse = (owner: string) =>
    setCollapsedOwners(prev => { const n = new Set(prev); n.has(owner) ? n.delete(owner) : n.add(owner); return n; });
  const collapseAll = () => setCollapsedOwners(new Set(visibleOwners));
  const expandAll = () => setCollapsedOwners(new Set());

  const toggleWeek = (label: string) =>
    setExpandedWeeks(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });

  // ── Owner tasks in range ──
  const getOwnerTasks = (owner: string) =>
    tasks.filter(t => (t.seoOwner === owner || t.contentOwner === owner || t.webOwner === owner || t.assignedTo === owner) &&
      (t.timeEvents || []).some((e: any) => { const ds = e.timestamp.split('T')[0]; return ds >= dateFrom && ds <= dateTo; }));

  // ── Export CSV ──
  const exportCSV = () => {
    const header = ['Owner', 'Period', 'Day', 'Logged Hrs', 'Productive Hrs', 'Overrun Hrs', 'Est Hrs', 'Target Hrs', 'Shortfall Hrs', 'Leave Type', 'Task', 'Client', 'Dept'];
    const rows: string[] = [];
    visibleOwners.forEach(owner => {
      const ownerTasks = getOwnerTasks(owner);
      const workDays = getWorkingDays(owner);
      if (useWeekCols) {
        weeks.forEach(wk => {
          ownerTasks.forEach(t => {
            const estH = calcOwnerEstHrs(t, owner);
            const logged = msToHrs(calcTaskOwnerMs(t, owner, wk.from, wk.to));
            const prod = msToHrs(calcTaskProductiveMs(t, owner, wk.from, wk.to));
            const over = msToHrs(calcTaskOverrunMs(t, owner, wk.from, wk.to));
            if (logged > 0) {
              rows.push([owner, `${wk.from} to ${wk.to}`, '', logged.toFixed(2), prod.toFixed(2), over.toFixed(2), estH.toFixed(2), '', '', '', `"${t.title.replace(/"/g, '""')}"`, t.client, getOwnerDeptLabel(t, owner)].join(','));
            }
          });
        });
      } else {
        allDates.forEach(ds => {
          const wd = workDays.find(w => w.date === ds);
          ownerTasks.forEach(t => {
            const estH = calcOwnerEstHrs(t, owner);
            const logged = msToHrs(calcTaskOwnerMs(t, owner, ds, ds));
            const prod = msToHrs(calcTaskProductiveMs(t, owner, ds, ds));
            const over = msToHrs(calcTaskOverrunMs(t, owner, ds, ds));
            if (logged > 0) {
              rows.push([owner, ds, dayLabel(ds), logged.toFixed(2), prod.toFixed(2), over.toFixed(2), estH.toFixed(2), (wd?.effectiveHrs || 0).toString(), '', wd?.leaveType || '', `"${t.title.replace(/"/g, '""')}"`, t.client, getOwnerDeptLabel(t, owner)].join(','));
            }
          });
        });
      }
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' }));
    a.download = `timesheet-${dateFrom}-${dateTo}.csv`; a.click();
  };

  // ── Capsule data for Today chip ──
  const capsuleData = useMemo(() => {
    if (activeChip !== 'today') return [];
    return allOwners.map(owner => {
      const prodMs = getOwnerDayProductiveMs(tasks, owner, todayStr);
      const prodH = prodMs / 3600000;
      const lv = getLeaveType(owner, todayStr);
      const pct = TARGET_H > 0 ? Math.round(prodH / TARGET_H * 100) : 0;
      return { owner, prodH, pct, isLeave: !!lv };
    });
  }, [activeChip, tasks, allOwners, todayStr, leave]);

  const capsuleBorder = (pct: number, isLeave: boolean) => {
    if (isLeave) return '#14B8A6';
    if (pct >= 100) return '#059669';
    if (pct >= 50) return '#D97706';
    return '#DC2626';
  };

  // ── Table column rendering helpers ──
  const renderDayHeader = (ds: string) => {
    const isToday = ds === todayStr; const isWknd = isWeekend(ds);
    return (
      <th key={ds} style={{ fontSize: 9, fontWeight: 500, padding: '6px 4px', background: isToday ? '#E6F1FB' : isWknd ? '#F8F8F6' : 'var(--color-background-secondary)', color: isToday ? '#0C447C' : isWknd ? '#B4B2A9' : 'var(--color-text-tertiary)', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', minWidth: 52, whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: isToday ? 600 : 400 }}>{dayLabel(ds)}</div>
        <div style={{ fontSize: 8 }}>{ds.slice(5)}</div>
      </th>
    );
  };

  const renderWeekHeader = (wk: { label: string }) => {
    const isExp = expandedWeeks.has(wk.label);
    return (
      <th key={wk.label} onClick={() => toggleWeek(wk.label)} style={{ fontSize: 9, fontWeight: 500, padding: '6px 4px', background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', minWidth: 60, whiteSpace: 'nowrap', cursor: 'pointer' }}>
        <span style={{ fontSize: 8 }}>{isExp ? '▼' : '▶'}</span> {wk.label}
      </th>
    );
  };

  // ── Shared filter bar ──
  const FilterBar = () => (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '10px 14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Range:</span>
        {(['today', 'week', 'month', 'custom'] as DateChip[]).map(v => (
          <button key={v} onClick={() => { setActiveChip(v); if (v !== 'custom') setRefDate(todayStr); }}
            style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: 'pointer', color: activeChip === v ? '#fff' : 'var(--color-text-secondary)', background: activeChip === v ? '#1E2D8B' : 'var(--color-background-secondary)', border: `0.5px solid ${activeChip === v ? '#1E2D8B' : 'var(--color-border-secondary)'}`, transition: 'all .15s' }}>
            {v === 'today' ? 'Today' : v === 'week' ? 'This Week' : v === 'month' ? 'This Month' : 'Custom'}
          </button>
        ))}
        {(activeChip === 'week' || activeChip === 'month') && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button onClick={() => { const d = new Date(refDate); d.setDate(d.getDate() - (activeChip === 'week' ? 7 : 30)); setRefDate(d.toISOString().split('T')[0]); }}
              style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: 12, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-secondary)' }}>‹</button>
            <button onClick={() => setRefDate(todayStr)}
              style={{ padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: 10, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-secondary)' }}>Today</button>
            <button onClick={() => { const d = new Date(refDate); d.setDate(d.getDate() + (activeChip === 'week' ? 7 : 30)); setRefDate(d.toISOString().split('T')[0]); }}
              style={{ width: 26, height: 26, borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: 12, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-secondary)' }}>›</button>
          </div>
        )}
        {activeChip === 'custom' && (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
          </div>
        )}
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>
          {dateFrom === dateTo ? dateFrom : `${dateFrom} – ${dateTo}`}
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginLeft: 8 }}>Owner:</span>
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} disabled={!isAdmin}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 disabled:opacity-60">
          {isAdmin && <option value="All">All owners</option>}
          {allOwners.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );

  // ── Today capsule strip ──
  const CapsuleStrip = () => {
    if (activeChip !== 'today') return null;
    return (
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0' }}>
        <button onClick={() => setOwnerFilter('All')}
          style={{ padding: '6px 14px', borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0, color: ownerFilter === 'All' ? '#1E2D8B' : 'var(--color-text-secondary)', background: ownerFilter === 'All' ? '#E6F1FB' : 'var(--color-background-secondary)', border: `1.5px solid ${ownerFilter === 'All' ? '#1E2D8B' : 'var(--color-border-secondary)'}` }}>All</button>
        {capsuleData.map(c => {
          const bc = capsuleBorder(c.pct, c.isLeave);
          const isActive = ownerFilter === c.owner;
          return (
            <button key={c.owner} onClick={() => setOwnerFilter(c.owner)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0, border: `1.5px solid ${isActive ? '#1E2D8B' : bc}`, background: isActive ? '#E6F1FB' : 'var(--color-background-primary)', color: 'var(--color-text-primary)', transition: 'all .15s' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#0C447C', flexShrink: 0 }}>{c.owner.slice(0, 2).toUpperCase()}</span>
              <span>{c.owner}</span>
              {c.isLeave ? (
                <span style={{ fontSize: 10, color: '#14B8A6', fontWeight: 600 }}>Leave</span>
              ) : (
                <>
                  <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{fmtH(c.prodH)} / {TARGET_H}h</span>
                  <span style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', display: 'inline-block', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${Math.min(100, c.pct)}%`, background: bc, borderRadius: 2 }} />
                  </span>
                  <span style={{ fontSize: 10, color: bc, fontWeight: 600 }}>{c.pct}%</span>
                  {c.pct >= 100 && <span style={{ color: '#059669', fontSize: 11 }}>✓</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // ── Render day/week cells for owner row ──
  const renderOwnerCells = (owner: string) => {
    if (useWeekCols) {
      return weeks.map(wk => {
        const isExp = expandedWeeks.has(wk.label);
        const prodMs = wk.dates.reduce((s, ds) => s + getOwnerDayProductiveMs(tasks, owner, ds), 0);
        const prodH = prodMs / 3600000;
        const wdDates = wk.dates.filter(ds => !isWeekend(ds));
        const expected = wdDates.reduce((s, ds) => {
          const lv = getLeaveType(owner, ds);
          return s + (lv === 'full' || lv === 'holiday' ? 0 : lv === 'half' ? TARGET_H / 2 : TARGET_H);
        }, 0);
        const cc = cellColor(prodH, expected, false, false);
        const cells = [
          <td key={wk.label} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', background: cc.bg, color: cc.color, fontSize: 10, fontWeight: 500, minWidth: 60, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleWeek(wk.label); }}>
            {prodH > 0 ? fmtH(prodH) : '—'}
          </td>
        ];
        if (isExp) {
          wk.dates.forEach(ds => {
            const dayProdH = getOwnerDayProductiveMs(tasks, owner, ds) / 3600000;
            const isWknd = isWeekend(ds); const lv = getLeaveType(owner, ds);
            const dayExpected = isWknd ? 0 : lv === 'full' || lv === 'holiday' ? 0 : lv === 'half' ? TARGET_H / 2 : TARGET_H;
            const dcc = cellColor(dayProdH, dayExpected, !!lv, isWknd);
            cells.push(
              <td key={ds} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', background: dcc.bg, color: dcc.color, fontSize: 10, fontWeight: 500, minWidth: 52 }}>
                {lv ? <span style={{ fontSize: 8, fontWeight: 600 }}>{lv === 'full' ? 'Leave' : lv === 'half' ? '½ Day' : 'Holiday'}</span> : dayProdH > 0 ? fmtH(dayProdH) : isWknd ? '' : '—'}
              </td>
            );
          });
        }
        return cells;
      }).flat();
    }
    return allDates.map(ds => {
      const dayProdH = getOwnerDayProductiveMs(tasks, owner, ds) / 3600000;
      const isWknd = isWeekend(ds); const lv = getLeaveType(owner, ds);
      const dayExpected = isWknd ? 0 : lv === 'full' || lv === 'holiday' ? 0 : lv === 'half' ? TARGET_H / 2 : TARGET_H;
      const cc = cellColor(dayProdH, dayExpected, !!lv, isWknd);
      return (
        <td key={ds} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', background: cc.bg, color: cc.color, fontSize: 10, fontWeight: 500, minWidth: 52 }}>
          {lv ? <span style={{ fontSize: 8, fontWeight: 600 }}>{lv === 'full' ? 'Leave' : lv === 'half' ? '½ Day' : 'Holiday'}</span> : dayProdH > 0 ? fmtH(dayProdH) : isWknd ? '' : '—'}
        </td>
      );
    });
  };

  // ── Render day/week cells for task row ──
  const renderTaskCells = (task: any, owner: string) => {
    if (useWeekCols) {
      return weeks.map(wk => {
        const isExp = expandedWeeks.has(wk.label);
        const wkMs = calcTaskOwnerMs(task, owner, wk.from, wk.to);
        const dept = getOwnerDeptLabel(task, owner);
        const deptColor = { SEO: '#185FA5', Content: '#BA7517', Web: '#1D9E75' }[dept] || '#9D174D';
        const cells = [
          <td key={wk.label} style={{ textAlign: 'center', padding: '5px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', fontSize: 10, color: wkMs > 0 ? deptColor : 'var(--color-text-tertiary)', minWidth: 60 }}>
            {wkMs > 0 ? fmtMs(wkMs) : '—'}
          </td>
        ];
        if (isExp) {
          wk.dates.forEach(ds => {
            const dayMs = calcTaskOwnerMs(task, owner, ds, ds);
            cells.push(
              <td key={ds} style={{ textAlign: 'center', padding: '5px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', fontSize: 10, color: dayMs > 0 ? deptColor : 'var(--color-text-tertiary)', background: isWeekend(ds) ? '#F8F8F6' : 'transparent', minWidth: 52 }}>
                {dayMs > 0 ? fmtMs(dayMs) : '—'}
              </td>
            );
          });
        }
        return cells;
      }).flat();
    }
    return allDates.map(ds => {
      const dayMs = calcTaskOwnerMs(task, owner, ds, ds);
      const dept = getOwnerDeptLabel(task, owner);
      const deptColor = { SEO: '#185FA5', Content: '#BA7517', Web: '#1D9E75' }[dept] || '#9D174D';
      return (
        <td key={ds} style={{ textAlign: 'center', padding: '5px 4px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid var(--color-border-tertiary)', fontSize: 10, color: dayMs > 0 ? deptColor : 'var(--color-text-tertiary)', background: isWeekend(ds) ? '#F8F8F6' : 'transparent', minWidth: 52 }}>
          {dayMs > 0 ? fmtMs(dayMs) : '—'}
        </td>
      );
    });
  };

  // ── Column count for table ──
  const getColCount = () => {
    let cols = useWeekCols ? weeks.length : allDates.length;
    // Add expanded week sub-columns
    if (useWeekCols) {
      weeks.forEach(wk => { if (expandedWeeks.has(wk.label)) cols += wk.dates.length; });
    }
    return cols;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--color-text-primary)' }}>Timesheet</h2>
        <button onClick={exportCSV} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '0.5px solid #3B6D1140', color: '#27500A', background: '#EAF3DE', cursor: 'pointer' }}>↓ Export CSV</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--color-background-secondary)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {([['timesheet', 'Timesheet'], ['overview', 'Overview & Insights'], ['leave', 'Leave & Holidays']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', color: activeTab === k ? '#1E2D8B' : 'var(--color-text-secondary)', background: activeTab === k ? 'var(--color-background-primary)' : 'transparent', border: 'none', transition: 'all .15s' }}>{l}</button>
        ))}
      </div>

      <FilterBar />
      <CapsuleStrip />

      {/* ══════════ TIMESHEET TAB ══════════ */}
      {activeTab === 'timesheet' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Tasks:</span>
              <button onClick={expandAll} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', color: '#185FA5', background: '#E6F1FB', cursor: 'pointer' }}>▼ Expand all</button>
              <button onClick={collapseAll} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-secondary)', background: 'transparent', cursor: 'pointer' }}>▶ Collapse all</button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
              {[['#EAF3DE', '#27500A', '≥100%'], ['#FAEEDA', '#633806', '75–99%'], ['#FFF3E0', '#E65100', '50–74%'], ['#FCEBEB', '#791F1F', '<50%'], ['#E1F5EE', '#085041', 'Leave'], ['#F8F9FA', '#888780', 'Weekend']].map(([bg, c, l]) => (
                <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `0.5px solid ${c}40`, display: 'inline-block' }} /> {l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: 600 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 + getColCount() * 58 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                  <tr>
                    <th style={{ fontSize: 10, fontWeight: 500, padding: '8px 12px', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', textAlign: 'left', borderBottom: '0.5px solid var(--color-border-tertiary)', minWidth: 220, position: 'sticky', left: 0, zIndex: 6 }}>Owner / Task</th>
                    {useWeekCols ? weeks.map(wk => {
                      const isExp = expandedWeeks.has(wk.label);
                      return [
                        renderWeekHeader(wk),
                        ...(isExp ? wk.dates.map(ds => renderDayHeader(ds)) : [])
                      ];
                    }).flat() : allDates.map(ds => renderDayHeader(ds))}
                    <th style={{ fontSize: 9, fontWeight: 600, padding: '6px 8px', background: '#E6F1FB', color: '#0C447C', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', minWidth: 60, whiteSpace: 'nowrap' }}>Logged</th>
                    <th style={{ fontSize: 9, fontWeight: 600, padding: '6px 8px', background: '#E1F5EE', color: '#085041', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #9FE1CB', minWidth: 66, whiteSpace: 'nowrap' }}>Productive</th>
                    <th style={{ fontSize: 9, fontWeight: 600, padding: '6px 8px', background: '#FCEBEB', color: '#791F1F', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1', minWidth: 60, whiteSpace: 'nowrap' }}>Overrun</th>
                    <th style={{ fontSize: 9, fontWeight: 600, padding: '6px 8px', background: '#E6F1FB', color: '#0C447C', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', minWidth: 60, whiteSpace: 'nowrap' }}>Target</th>
                    <th style={{ fontSize: 9, fontWeight: 600, padding: '6px 8px', background: '#FCEBEB', color: '#791F1F', textAlign: 'center', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1', minWidth: 70, whiteSpace: 'nowrap' }}>Shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOwners.map(owner => {
                    const { targetHrs, loggedHrs, productiveHrs, overrunHrs, shortfall, leaveDays } = ownerSummary(owner);
                    const ownerTasks = getOwnerTasks(owner);
                    const isCollapsed = collapsedOwners.has(owner);
                    return (
                      <React.Fragment key={owner}>
                        {/* Owner row */}
                        <tr style={{ background: '#E6F1FB15', cursor: 'pointer' }} onClick={() => toggleCollapse(owner)}>
                          <td style={{ fontSize: 12, fontWeight: 600, color: '#185FA5', padding: '8px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', position: 'sticky', left: 0, background: '#EBF4FE', zIndex: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: '#185FA5', transition: 'transform .15s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                              {owner}
                              {leaveDays > 0 && <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 99, color: '#085041', background: '#E1F5EE' }}>{leaveDays}d leave</span>}
                              <span style={{ fontSize: 9, color: '#185FA5', fontWeight: 400, opacity: .7 }}>{ownerTasks.length} task{ownerTasks.length !== 1 ? 's' : ''}</span>
                            </div>
                          </td>
                          {renderOwnerCells(owner)}
                          <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', fontSize: 11, fontWeight: 600, color: '#0C447C', background: '#E6F1FB20' }}>{fmtH(loggedHrs)}</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #9FE1CB', fontSize: 11, fontWeight: 600, color: '#085041', background: '#E1F5EE20' }}>{fmtH(productiveHrs)}</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1', fontSize: 11, fontWeight: 600, color: overrunHrs > 0.01 ? '#DC2626' : '#059669', background: overrunHrs > 0.01 ? '#FEF2F220' : 'transparent' }}>
                            {overrunHrs > 0.01 ? `+${fmtH(overrunHrs)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', fontSize: 11, color: 'var(--color-text-secondary)', background: '#E6F1FB20' }}>{fmtH(targetHrs)}</td>
                          <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1', fontSize: 11, fontWeight: 600, color: shortfall > 0.05 ? '#DC2626' : '#059669', background: shortfall > 0.05 ? '#FEF2F220' : '#ECFDF520' }}>
                            {shortfall > 0.05 ? `-${fmtH(shortfall)}` : '✓'}
                          </td>
                        </tr>
                        {/* Task rows */}
                        {!isCollapsed && ownerTasks.map(task => {
                          const loggedMs = calcTaskOwnerMs(task, owner, dateFrom, dateTo);
                          if (loggedMs === 0) return null;
                          const dept = getOwnerDeptLabel(task, owner);
                          const deptColor = { SEO: '#185FA5', Content: '#BA7517', Web: '#1D9E75', 'Social Media': '#9D174D', Design: '#7C3AED', Ads: '#EA580C', 'Web Dev': '#0891B2' }[dept] || '#9D174D';
                          const deptBg = { SEO: '#E6F1FB', Content: '#FAEEDA', Web: '#E1F5EE', 'Social Media': '#FDF2F8', Design: '#F5F3FF', Ads: '#FFF7ED', 'Web Dev': '#ECFEFF' }[dept] || '#FDF2F8';
                          const estH = calcOwnerEstHrs(task, owner);
                          const tProdMs = calcTaskProductiveMs(task, owner, dateFrom, dateTo);
                          const tOverMs = calcTaskOverrunMs(task, owner, dateFrom, dateTo);
                          return (
                            <tr key={task.id} className="hover:brightness-95">
                              <td style={{ fontSize: 11, padding: '5px 12px 5px 28px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)', position: 'sticky', left: 0, background: 'var(--color-background-primary)', zIndex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 99, color: deptColor, background: deptBg, flexShrink: 0 }}>{dept}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }} title={task.title}>{task.title}</span>
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginTop: 1 }}>{task.client} · {task.id}{estH > 0 ? ` · Est ${fmtH(estH)}` : ''}</div>
                              </td>
                              {renderTaskCells(task, owner)}
                              <td style={{ textAlign: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', fontSize: 10, fontWeight: 500, color: '#0C447C' }}>{fmtMs(loggedMs)}</td>
                              <td style={{ textAlign: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #9FE1CB', fontSize: 10, fontWeight: 500, color: '#085041' }}>{fmtMs(tProdMs)}</td>
                              <td style={{ textAlign: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1', fontSize: 10, fontWeight: 500, color: tOverMs > 0 ? '#DC2626' : 'var(--color-text-tertiary)' }}>
                                {estH <= 0 ? <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 99, background: '#F3F4F6', color: '#9CA3AF' }}>no est</span> : tOverMs > 0 ? <span style={{ padding: '1px 6px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626', border: '1px solid #DC262630' }}>+{fmtMs(tOverMs)}</span> : <span style={{ color: '#059669' }}>✓</span>}
                              </td>
                              <td style={{ textAlign: 'center', padding: '5px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #B5D4F4', fontSize: 10, color: 'var(--color-text-tertiary)' }}>{estH > 0 ? `${estH}h` : '—'}</td>
                              <td style={{ padding: '5px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', borderLeft: '0.5px solid #F7C1C1' }} />
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════ OVERVIEW & INSIGHTS TAB ══════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {(() => {
            const allData = allOwners.map(o => ({ owner: o, ...ownerSummary(o) }));
            const belowTarget = allData.filter(o => o.shortfall > 0.1);
            const onTrack = allData.filter(o => o.shortfall <= 0.1 && o.productiveHrs > 0);
            const noTime = allData.filter(o => o.loggedHrs === 0);
            const hasOverrun = allData.filter(o => o.overrunHrs > 0.01);
            const totalProductive = allData.reduce((s, o) => s + o.productiveHrs, 0);
            const totalOverrun = allData.reduce((s, o) => s + o.overrunHrs, 0);
            const totalTarget = allData.reduce((s, o) => s + o.targetHrs, 0);
            const totalShortfall = allData.reduce((s, o) => s + o.shortfall, 0);
            const teamCapacityH = allOwners.length * allData[0]?.workDays * TARGET_H;
            const utilPct = teamCapacityH > 0 ? Math.round(totalProductive / teamCapacityH * 100) : 0;
            return (
              <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Period insights — {dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#0C447C', background: '#E6F1FB', border: '1px solid #185FA540' }}>
                    Team capacity: {fmtH(teamCapacityH)} · Utilisation: {utilPct}%
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#085041', background: '#E1F5EE', border: '1px solid #05966940' }}>
                    ✓ {fmtH(totalProductive)} productive of {fmtH(totalTarget)} target
                  </span>
                  {totalOverrun > 0.01 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: totalOverrun > 1 ? '#DC2626' : '#D97706', background: totalOverrun > 1 ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${totalOverrun > 1 ? '#DC262640' : '#D9770640'}` }}>
                    ⚠ {fmtH(totalOverrun)} total overrun {hasOverrun.length > 0 && `(${hasOverrun.map(o => o.owner).join(', ')})`}
                  </span>}
                  {totalShortfall > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#791F1F', background: '#FCEBEB', border: '1px solid #DC262640' }}>
                    ↓ {fmtH(totalShortfall)} total shortfall {belowTarget.filter(o => o.shortfall > 1).length > 0 && `(${belowTarget.filter(o => o.shortfall > 1).map(o => o.owner).join(', ')})`}
                  </span>}
                  {onTrack.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#059669', background: '#ECFDF5', border: '1px solid #05966940' }}>
                    ✓ {onTrack.length} on track: {onTrack.map(o => o.owner).join(', ')}
                  </span>}
                  {noTime.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: '#888780', background: '#F1EFE8', border: '1px solid #88878040' }}>
                    ⊘ No time logged: {noTime.map(o => o.owner).join(', ')}
                  </span>}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
            {visibleOwners.map(owner => {
              const { targetHrs, loggedHrs, productiveHrs, overrunHrs, shortfall, leaveDays, workDays, pct, daysLogged, maxDay } = ownerSummary(owner);
              const hasShortfall = shortfall > 1;
              const hasOverrun = overrunHrs > 0.01;
              const prodPct = targetHrs > 0 ? Math.round(productiveHrs / targetHrs * 100) : 0;
              const barColor = prodPct >= 100 ? '#059669' : prodPct >= 75 ? '#639922' : prodPct >= 50 ? '#BA7517' : '#DC2626';
              const ownerTasks = getOwnerTasks(owner);
              const borderColor = hasShortfall ? '#DC262640' : hasOverrun ? '#D9770640' : 'var(--color-border-tertiary)';
              return (
                <div key={owner} style={{ background: 'var(--color-background-primary)', border: `1px solid ${borderColor}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#0C447C', flexShrink: 0 }}>{owner.slice(0, 2).toUpperCase()}</div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{owner}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {leaveDays > 0 && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, color: '#085041', background: '#E1F5EE' }}>{leaveDays}d leave</span>}
                      {hasOverrun && <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 99, color: '#DC2626', background: '#FEF2F2' }}>overrun</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 600, color: hasShortfall ? '#DC2626' : '#059669', lineHeight: 1 }}>{fmtH(productiveHrs)}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>productive / {fmtH(targetHrs)} target</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, prodPct)}%`, background: barColor, borderRadius: 3, transition: 'width .3s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#E6F1FB', color: '#0C447C' }}>{fmtH(loggedHrs)} logged</span>
                      {overrunHrs > 0.01 && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: '#FEF2F2', color: '#DC2626' }}>+{fmtH(overrunHrs)} overrun</span>}
                      {shortfall > 0.05 ? <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: '#FCEBEB', color: '#DC2626' }}>Shortfall: {fmtH(shortfall)}</span> : productiveHrs > 0 && <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, background: '#ECFDF5', color: '#059669' }}>✓ On track</span>}
                    </div>
                  </div>
                  {ownerTasks.length > 0 && (
                    <div style={{ borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 8 }}>
                      <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>Tasks logged</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {ownerTasks.slice(0, 4).map(t => {
                          const dept = getOwnerDeptLabel(t, owner);
                          const dc = { SEO: { c: '#185FA5', bg: '#E6F1FB' }, Content: { c: '#BA7517', bg: '#FAEEDA' }, Web: { c: '#1D9E75', bg: '#E1F5EE' }, 'Social Media': { c: '#9D174D', bg: '#FDF2F8' }, Design: { c: '#7C3AED', bg: '#F5F3FF' }, Ads: { c: '#EA580C', bg: '#FFF7ED' }, 'Web Dev': { c: '#0891B2', bg: '#ECFEFF' } }[dept] || { c: '#9D174D', bg: '#FDF2F8' };
                          const tProdMs = calcTaskProductiveMs(t, owner, dateFrom, dateTo);
                          const tOverMs = calcTaskOverrunMs(t, owner, dateFrom, dateTo);
                          return (
                            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                              <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 99, color: dc.c, background: dc.bg, flexShrink: 0 }}>{dept}</span>
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>{t.title}</span>
                              <span style={{ fontWeight: 500, color: '#0C447C', flexShrink: 0 }}>{fmtMs(tProdMs)}</span>
                              {tOverMs > 0 && <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 99, color: '#DC2626', background: '#FEF2F2', flexShrink: 0 }}>exceeded</span>}
                            </div>
                          );
                        })}
                        {ownerTasks.length > 4 && <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>+{ownerTasks.length - 4} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ LEAVE TAB ══════════ */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>Leave & Holiday records</p>
            <button onClick={() => setShowAddLeave(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '0.5px solid #185FA540', color: '#0C447C', background: '#E6F1FB', cursor: 'pointer' }}>+ Add leave</button>
          </div>
          {showAddLeave && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 12 }}>Add leave or holiday</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                {isAdmin && (
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 3 }}>Owner</label>
                    <select value={newLeave.owner} onChange={e => setNewLeave(l => ({ ...l, owner: e.target.value }))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
                      <option value="All (Holiday)">All (Holiday)</option>
                      {allOwners.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 3 }}>Date</label>
                  <input type="date" value={newLeave.date} onChange={e => setNewLeave(l => ({ ...l, date: e.target.value }))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 3 }}>Type</label>
                  <select value={newLeave.type} onChange={e => setNewLeave(l => ({ ...l, type: e.target.value as LeaveType }))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
                    <option value="full">Full day leave</option>
                    <option value="half">Half day</option>
                    <option value="holiday">Public holiday</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--color-text-tertiary)', display: 'block', marginBottom: 3 }}>Note</label>
                  <input type="text" value={newLeave.note} onChange={e => setNewLeave(l => ({ ...l, note: e.target.value }))} placeholder="e.g. Holi, Sick leave" className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={() => { const entry: LeaveRecord = { id: `lv_${Date.now()}`, ...newLeave }; updateLeave([...leave, entry]); setShowAddLeave(false); }} style={{ padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 500, border: '0.5px solid #3B6D1140', color: '#27500A', background: '#EAF3DE', cursor: 'pointer' }}>Save</button>
                <button onClick={() => setShowAddLeave(false)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-secondary)', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Owner', 'Date', 'Day', 'Type', 'Note', ''].map(h => (
                    <th key={h} style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', textAlign: 'left', background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leave.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>No leave records yet</td></tr>
                ) : [...leave].sort((a, b) => b.date.localeCompare(a.date)).map(l => (
                  <tr key={l.id} className="hover:brightness-95">
                    <td style={{ fontSize: 12, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{l.owner}</td>
                    <td style={{ fontSize: 11, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' }}>{l.date}</td>
                    <td style={{ fontSize: 11, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-tertiary)' }}>{dayLabel(l.date)}</td>
                    <td style={{ fontSize: 11, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 99, color: l.type === 'full' ? '#0C447C' : l.type === 'half' ? '#633806' : '#085041', background: l.type === 'full' ? '#E6F1FB' : l.type === 'half' ? '#FAEEDA' : '#E1F5EE' }}>
                        {l.type === 'full' ? 'Full day' : l.type === 'half' ? 'Half day' : 'Public holiday'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' }}>{l.note || '—'}</td>
                    <td style={{ padding: '7px 12px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                      <button onClick={() => updateLeave(leave.filter(r => r.id !== l.id))} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '0.5px solid #F09595', color: '#791F1F', background: '#FCEBEB', cursor: 'pointer' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background: 'var(--color-background-secondary)', borderRadius: 8, padding: '8px 14px', fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Full day = 0h expected · Half day = 4h expected · Public holiday applies to all owners
          </div>
        </div>
      )}
    </div>
  );
}
