import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAllOwners } from '../hooks/useAllOwners';
import { ChevronDown, ChevronUp, ChevronRight, X } from 'lucide-react';

const TARGET_H = 8;
const STORAGE_KEY = 'seo_leave_records';

type LeaveType = 'full' | 'half' | 'holiday';
interface LeaveRecord { id: string; owner: string; date: string; type: LeaveType; note?: string; }

function loadLeave(): LeaveRecord[] { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }
function saveLeave(d: LeaveRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

function pad2(n: number) { return String(n).padStart(2,'0'); }
function fmtMs(ms: number) {
  if (!ms || ms < 0) return '—';
  const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
}
function fmtH(h: number) {
  if (!h) return '—';
  const hh = Math.floor(h), mm = Math.round((h-hh)*60);
  return hh > 0 ? `${hh}h ${pad2(mm)}m` : `${mm}m`;
}
function isWeekend(ds: string) { const d = new Date(ds); return d.getDay()===0||d.getDay()===6; }
function dayLabel(ds: string) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(ds).getDay()]; }

function getDateRange(from: string, to: string): string[] {
  const dates: string[] = []; let d = new Date(from); const end = new Date(to);
  while (d <= end) { dates.push(d.toISOString().split('T')[0]); d.setDate(d.getDate()+1); }
  return dates;
}
function getWeekRange(ref: string) {
  const d = new Date(ref); const mon = new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
  const sun = new Date(mon); sun.setDate(mon.getDate()+6);
  return { from: mon.toISOString().split('T')[0], to: sun.toISOString().split('T')[0] };
}
function getMonthRange(ref: string) {
  const d = new Date(ref);
  return { from: `${d.getFullYear()}-${pad2(d.getMonth()+1)}-01`, to: new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().split('T')[0] };
}

export function Timesheet() {
  const { tasks, adminOptions, currentUser, isAdmin, users } = useAppContext();
  const todayStr = new Date().toISOString().split('T')[0];

  const [leave, setLeave] = useState<LeaveRecord[]>(loadLeave);
  const updateLeave = (d: LeaveRecord[]) => { setLeave(d); saveLeave(d); };

  // ── Filters ──
  const [view, setView] = useState<'week'|'month'|'custom'>('week');
  const [refDate, setRefDate] = useState(todayStr);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [ownerFilter, setOwnerFilter] = useState(() => !isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All');
  const [activeTab, setActiveTab] = useState<'timesheet'|'overview'|'leave'>('timesheet');
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(new Set()); // task rows hidden
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [newLeave, setNewLeave] = useState({ owner: currentUser?.ownerName||adminOptions.seoOwners[0]||'', date: todayStr, type: 'full' as LeaveType, note: '' });

  useEffect(() => {
    if (view === 'week') { const r = getWeekRange(refDate); setDateFrom(r.from); setDateTo(r.to); }
    else if (view === 'month') { const r = getMonthRange(refDate); setDateFrom(r.from); setDateTo(r.to); }
  }, [view, refDate]);

  const allOwners = useAllOwners();
  const visibleOwners = ownerFilter === 'All' ? allOwners : [ownerFilter];
  const visibleDates = getDateRange(dateFrom, dateTo).slice(0, 35);

  // ── Data helpers ──
  const getTaskDayMs = (t: any, ds: string): number => {
    const dayEvents = (t.timeEvents||[]).filter((e: any) => e.timestamp.startsWith(ds));
    let ms = 0, ls: number|null = null;
    for (const e of dayEvents) {
      const ts = new Date(e.timestamp).getTime();
      if (e.type==='start'||e.type==='resume'||e.type==='rework_start') ls = ts;
      else if ((e.type==='pause'||e.type==='end') && ls) { ms += ts-ls; ls = null; }
    }
    return ms;
  };

  const getOwnerDayHrs = (owner: string, ds: string): number => {
    return tasks.filter(t => t.seoOwner===owner||t.contentOwner===owner||t.webOwner===owner||t.assignedTo===owner)
      .reduce((s, t) => s + getTaskDayMs(t, ds), 0) / 3600000;
  };

  const getOwnerRangeHrs = (owner: string): number => {
    return visibleDates.reduce((s, ds) => s + getOwnerDayHrs(owner, ds), 0);
  };

  const getWorkingDays = (owner: string) => {
    return visibleDates.filter(ds => !isWeekend(ds)).map(ds => {
      const lv = leave.find(l => l.owner===owner && l.date===ds);
      const holiday = leave.find(l => l.type==='holiday' && l.date===ds);
      const leaveType = holiday ? 'holiday' as LeaveType : lv?.type || null;
      const effectiveHrs = leaveType==='full'||leaveType==='holiday' ? 0 : leaveType==='half' ? TARGET_H/2 : TARGET_H;
      return { date: ds, effectiveHrs, leaveType };
    });
  };

  const ownerSummary = (owner: string) => {
    const workDays = getWorkingDays(owner);
    const targetHrs = workDays.reduce((s, d) => s + d.effectiveHrs, 0);
    const loggedHrs = getOwnerRangeHrs(owner);
    const shortfall = Math.max(0, targetHrs - loggedHrs);
    const leaveDays = workDays.filter(d => d.leaveType !== null).length;
    const pct = targetHrs > 0 ? Math.round(loggedHrs/targetHrs*100) : 0;
    // per-day breakdown for insights
    const daysLogged = workDays.filter(d => getOwnerDayHrs(owner, d.date) > 0).length;
    const maxDay = workDays.reduce((max, d) => { const h = getOwnerDayHrs(owner, d.date); return h > max.h ? {h, date:d.date} : max; }, {h:0, date:''});
    return { targetHrs, loggedHrs, shortfall, leaveDays, workDays: workDays.length, pct, daysLogged, maxDay };
  };

  const cellColor = (logged: number, expected: number, isLeave: boolean) => {
    if (isLeave) return { bg:'#E1F5EE', color:'#085041' };
    if (expected === 0) return { bg:'#F1EFE8', color:'#888780' };
    if (logged === 0) return { bg:'transparent', color:'#ccc' };
    const pct = logged/expected;
    if (pct >= 1) return { bg:'#E1F5EE', color:'#085041' };
    if (pct >= 0.75) return { bg:'#EAF3DE', color:'#27500A' };
    if (pct >= 0.5) return { bg:'#FAEEDA', color:'#633806' };
    return { bg:'#FCEBEB', color:'#791F1F' };
  };

  const toggleCollapse = (owner: string) =>
    setCollapsedOwners(prev => { const n = new Set(prev); n.has(owner) ? n.delete(owner) : n.add(owner); return n; });

  const collapseAll = () => setCollapsedOwners(new Set(visibleOwners));
  const expandAll = () => setCollapsedOwners(new Set());

  const exportCSV = () => {
    const header = ['Owner','Date','Day','Logged Hrs','Target Hrs','Shortfall','Leave'];
    const rows: string[] = [];
    visibleOwners.forEach(owner => {
      getWorkingDays(owner).forEach(wd => {
        const logged = getOwnerDayHrs(owner, wd.date);
        rows.push([owner, wd.date, dayLabel(wd.date), logged.toFixed(2), wd.effectiveHrs, Math.max(0,wd.effectiveHrs-logged).toFixed(2), wd.leaveType||''].join(','));
      });
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[header.join(','),...rows].join('\n')],{type:'text/csv'}));
    a.download = `timesheet-${dateFrom}-${dateTo}.csv`; a.click();
  };

  // ── Shared filter bar ──
  const FilterBar = () => (
    <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:9, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em' }}>View:</span>
        {(['week','month','custom'] as const).map(v => (
          <button key={v} onClick={() => { setView(v); if(v!=='custom') setRefDate(todayStr); }}
            style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color:view===v?'#fff':'var(--color-text-secondary)', background:view===v?'#1E2D8B':'var(--color-background-secondary)', border:`0.5px solid ${view===v?'#1E2D8B':'var(--color-border-secondary)'}`, transition:'all .15s' }}>
            {v==='week'?'This Week':v==='month'?'This Month':'Custom'}
          </button>
        ))}
        {view !== 'custom' ? (
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <button onClick={() => { const d=new Date(refDate); d.setDate(d.getDate()-(view==='week'?7:30)); setRefDate(d.toISOString().split('T')[0]); }}
              style={{ width:26, height:26, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>‹</button>
            <button onClick={() => setRefDate(todayStr)}
              style={{ padding:'3px 8px', borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:10, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>Today</button>
            <button onClick={() => { const d=new Date(refDate); d.setDate(d.getDate()+(view==='week'?7:30)); setRefDate(d.toISOString().split('T')[0]); }}
              style={{ width:26, height:26, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>›</button>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)', marginLeft:4 }}>{dateFrom} – {dateTo}</span>
          </div>
        ) : (
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>–</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
          </div>
        )}
        <span style={{ fontSize:9, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em', marginLeft:8 }}>Owner:</span>
        <select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} disabled={!isAdmin}
          className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 disabled:opacity-60">
          {isAdmin && <option value="All">All owners</option>}
          {allOwners.map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)' }}>Timesheet</h2>
        <button onClick={exportCSV} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>↓ Export CSV</button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'var(--color-background-secondary)', padding:4, borderRadius:10, width:'fit-content' }}>
        {([['timesheet','Timesheet'],['overview','Overview & Insights'],['leave','Leave & Holidays']] as const).map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k)}
            style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', color:activeTab===k?'#1E2D8B':'var(--color-text-secondary)', background:activeTab===k?'var(--color-background-primary)':'transparent', border:'none', transition:'all .15s' }}>{l}</button>
        ))}
      </div>

      {/* Filter bar — all tabs */}
      <FilterBar />

      {/* ══════════ TIMESHEET TAB ══════════ */}
      {activeTab==='timesheet' && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:10, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em' }}>Tasks:</span>
              <button onClick={expandAll} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'0.5px solid var(--color-border-secondary)', color:'#185FA5', background:'#E6F1FB', cursor:'pointer' }}>▼ Expand all</button>
              <button onClick={collapseAll} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>▶ Collapse all</button>
            </div>
            {/* Colour legend */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', fontSize:10, color:'var(--color-text-tertiary)' }}>
              {[['#E1F5EE','#085041','≥100%'],['#EAF3DE','#27500A','75–99%'],['#FAEEDA','#633806','50–74%'],['#FCEBEB','#791F1F','<50%'],['#E1F5EE','#085041','Leave']].map(([bg,c,l]) => (
                <span key={l} style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:bg, border:`0.5px solid ${c}40`, display:'inline-block' }}/>  {l}
                </span>
              ))}
            </div>
          </div>

          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
            <div style={{ overflowX:'auto', maxHeight:600 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth: 400 + visibleDates.length*58 }}>
                <thead style={{ position:'sticky', top:0, zIndex:5 }}>
                  <tr>
                    <th style={{ fontSize:10, fontWeight:500, padding:'8px 12px', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', textAlign:'left', borderBottom:'0.5px solid var(--color-border-tertiary)', minWidth:220, position:'sticky', left:0, zIndex:6 }}>Owner / Task</th>
                    {visibleDates.map(ds => {
                      const isToday = ds===todayStr; const isWknd = isWeekend(ds);
                      return (
                        <th key={ds} style={{ fontSize:9, fontWeight:500, padding:'6px 4px', background:isToday?'#E6F1FB':isWknd?'#F8F8F6':'var(--color-background-secondary)', color:isToday?'#0C447C':isWknd?'#B4B2A9':'var(--color-text-tertiary)', textAlign:'center', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid var(--color-border-tertiary)', minWidth:52, whiteSpace:'nowrap' }}>
                          <div style={{ fontWeight:isToday?600:400 }}>{dayLabel(ds)}</div>
                          <div style={{ fontSize:8 }}>{ds.slice(5)}</div>
                        </th>
                      );
                    })}
                    <th style={{ fontSize:9, fontWeight:600, padding:'6px 8px', background:'#E6F1FB', color:'#0C447C', textAlign:'center', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', minWidth:60, whiteSpace:'nowrap' }}>Total</th>
                    <th style={{ fontSize:9, fontWeight:600, padding:'6px 8px', background:'#E6F1FB', color:'#0C447C', textAlign:'center', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', minWidth:60, whiteSpace:'nowrap' }}>Target</th>
                    <th style={{ fontSize:9, fontWeight:600, padding:'6px 8px', background:'#FCEBEB', color:'#791F1F', textAlign:'center', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #F7C1C1', minWidth:70, whiteSpace:'nowrap' }}>Shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOwners.map(owner => {
                    const workDays = getWorkingDays(owner);
                    const { targetHrs, loggedHrs, shortfall } = ownerSummary(owner);
                    const ownerTasks = tasks.filter(t => (t.seoOwner===owner||t.contentOwner===owner||t.webOwner===owner||t.assignedTo===owner) && (t.timeEvents||[]).some((e:any) => {
                      const ds = e.timestamp.split('T')[0]; return ds>=dateFrom && ds<=dateTo;
                    }));
                    const isCollapsed = collapsedOwners.has(owner);
                    return (
                      <React.Fragment key={owner}>
                        {/* Owner row */}
                        <tr style={{ background:'#E6F1FB15', cursor:'pointer' }} onClick={()=>toggleCollapse(owner)}>
                          <td style={{ fontSize:12, fontWeight:600, color:'#185FA5', padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', position:'sticky', left:0, background:'#EBF4FE', zIndex:2 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:10, color:'#185FA5', transition:'transform .15s', display:'inline-block', transform:isCollapsed?'rotate(-90deg)':'rotate(0deg)' }}>▼</span>
                              {owner}
                              <span style={{ fontSize:9, color:'#185FA5', fontWeight:400, opacity:.7 }}>{ownerTasks.length} task{ownerTasks.length!==1?'s':''}</span>
                            </div>
                          </td>
                          {visibleDates.map(ds => {
                            const wd = workDays.find(w=>w.date===ds);
                            const isWknd = isWeekend(ds); const lv = wd?.leaveType;
                            const logged = getOwnerDayHrs(owner, ds);
                            const expected = wd?.effectiveHrs ?? (isWknd?0:TARGET_H);
                            const cc = cellColor(logged, expected, !!lv);
                            return (
                              <td key={ds} style={{ textAlign:'center', padding:'6px 4px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid var(--color-border-tertiary)', background:isWknd?'#F8F8F6':cc.bg, color:cc.color, fontSize:10, fontWeight:500, minWidth:52 }}>
                                {lv ? <span style={{ fontSize:8, fontWeight:600 }}>{lv==='full'?'Leave':lv==='half'?'½ Day':'Holiday'}</span> : logged>0 ? fmtH(logged) : (isWknd?'':'')}
                              </td>
                            );
                          })}
                          <td style={{ textAlign:'center', padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', fontSize:11, fontWeight:600, color:'#0C447C', background:'#E6F1FB20' }}>{fmtH(loggedHrs)}</td>
                          <td style={{ textAlign:'center', padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', fontSize:11, color:'var(--color-text-secondary)', background:'#E6F1FB20' }}>{fmtH(targetHrs)}</td>
                          <td style={{ textAlign:'center', padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #F7C1C1', fontSize:11, fontWeight:600, color:shortfall>0?'#DC2626':'#059669', background:shortfall>0?'#FEF2F220':'#ECFDF520' }}>
                            {shortfall>0.05 ? `-${fmtH(shortfall)}` : '✓'}
                          </td>
                        </tr>
                        {/* Task rows — collapsed by default toggle */}
                        {!isCollapsed && ownerTasks.map(task => {
                          const taskTotalMs = visibleDates.reduce((s, ds) => s + getTaskDayMs(task, ds), 0);
                          if (taskTotalMs === 0) return null;
                          const dept = task.seoOwner===owner?'SEO':task.contentOwner===owner?'Con':task.webOwner===owner?'Web':'Hub';
                          const deptColor = dept==='SEO'?'#185FA5':dept==='Con'?'#BA7517':dept==='Web'?'#1D9E75':'#9D174D';
                          const deptBg = dept==='SEO'?'#E6F1FB':dept==='Con'?'#FAEEDA':dept==='Web'?'#E1F5EE':'#FDF2F8';
                          return (
                            <tr key={task.id} className="hover:brightness-95">
                              <td style={{ fontSize:11, padding:'5px 12px 5px 28px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'var(--color-text-secondary)', position:'sticky', left:0, background:'var(--color-background-primary)', zIndex:1 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                  <span style={{ fontSize:9, fontWeight:600, padding:'1px 5px', borderRadius:99, color:deptColor, background:deptBg, flexShrink:0 }}>{dept}</span>
                                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:150 }} title={task.title}>{task.title}</span>
                                </div>
                                <div style={{ fontSize:9, color:'var(--color-text-tertiary)', marginTop:1 }}>{task.client} · {task.id} · Est: {task.estHoursSEO||task.estHours||0}h</div>
                              </td>
                              {visibleDates.map(ds => {
                                const dayMs = getTaskDayMs(task, ds);
                                return (
                                  <td key={ds} style={{ textAlign:'center', padding:'5px 4px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid var(--color-border-tertiary)', fontSize:10, color:dayMs>0?deptColor:'var(--color-text-tertiary)', background:isWeekend(ds)?'#F8F8F6':'transparent', minWidth:52 }}>
                                    {dayMs > 0 ? fmtMs(dayMs) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ textAlign:'center', padding:'5px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', fontSize:10, fontWeight:500, color:'#0C447C' }}>{fmtMs(taskTotalMs)}</td>
                              <td style={{ textAlign:'center', padding:'5px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #B5D4F4', fontSize:10, color:'var(--color-text-tertiary)' }}>{task.estHoursSEO||task.estHours||0}h</td>
                              <td style={{ padding:'5px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', borderLeft:'0.5px solid #F7C1C1' }}/>
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
      {activeTab==='overview' && (
        <div className="space-y-4">
          {/* Summary insight pills */}
          {(() => {
            const allData = allOwners.map(o => ({ owner:o, ...ownerSummary(o) }));
            const belowTarget = allData.filter(o => o.shortfall > 0.1);
            const onTrack = allData.filter(o => o.shortfall <= 0.1 && o.loggedHrs > 0);
            const noTime = allData.filter(o => o.loggedHrs === 0);
            const totalLogged = allData.reduce((s,o)=>s+o.loggedHrs,0);
            const totalTarget = allData.reduce((s,o)=>s+o.targetHrs,0);
            const totalShortfall = allData.reduce((s,o)=>s+o.shortfall,0);
            return (
              <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
                <p style={{ fontSize:9, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Period insights — {dateFrom} to {dateTo}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#0C447C', background:'#E6F1FB', border:'1px solid #185FA540' }}>
                    🕐 {fmtH(totalLogged)} logged of {fmtH(totalTarget)} target
                  </span>
                  {totalShortfall > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#791F1F', background:'#FCEBEB', border:'1px solid #DC262640' }}>
                    ⚠ {fmtH(totalShortfall)} total shortfall
                  </span>}
                  {belowTarget.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#DC2626', background:'#FEF2F2', border:'1px solid #DC262640' }}>
                    ↓ {belowTarget.length} below target: {belowTarget.map(o=>o.owner).join(', ')}
                  </span>}
                  {onTrack.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#059669', background:'#ECFDF5', border:'1px solid #05966940' }}>
                    ✓ {onTrack.length} on track: {onTrack.map(o=>o.owner).join(', ')}
                  </span>}
                  {noTime.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#888780', background:'#F1EFE8', border:'1px solid #88878040' }}>
                    ⊘ No time logged: {noTime.map(o=>o.owner).join(', ')}
                  </span>}
                </div>
              </div>
            );
          })()}

          {/* Owner cards grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
            {visibleOwners.map(owner => {
              const { targetHrs, loggedHrs, shortfall, leaveDays, workDays, pct, daysLogged, maxDay } = ownerSummary(owner);
              const hasShortfall = shortfall > 0.1;
              const barColor = pct>=100?'#059669':pct>=75?'#639922':pct>=50?'#BA7517':'#DC2626';
              const ownerTasks = tasks.filter(t => (t.seoOwner===owner||t.contentOwner===owner||t.webOwner===owner||t.assignedTo===owner) && (t.timeEvents||[]).some((e:any) => { const ds=e.timestamp.split('T')[0]; return ds>=dateFrom&&ds<=dateTo; }));
              return (
                <div key={owner} style={{ background:'var(--color-background-primary)', border:`1px solid ${hasShortfall?'#DC262640':'var(--color-border-tertiary)'}`, borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                  {/* Name + leave badge */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'#E6F1FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#0C447C', flexShrink:0 }}>
                        {owner.slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontSize:14, fontWeight:500, color:'var(--color-text-primary)' }}>{owner}</span>
                    </div>
                    {leaveDays > 0 && <span style={{ fontSize:9, fontWeight:600, padding:'2px 7px', borderRadius:99, color:'#085041', background:'#E1F5EE' }}>{leaveDays}d leave</span>}
                  </div>

                  {/* Logged vs target */}
                  <div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:22, fontWeight:600, color:hasShortfall?'#DC2626':'#059669', lineHeight:1 }}>{fmtH(loggedHrs)}</span>
                      <span style={{ fontSize:11, color:'var(--color-text-tertiary)' }}>/ {fmtH(targetHrs)} target</span>
                    </div>
                    <div style={{ height:5, background:'var(--color-background-secondary)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                      <div style={{ height:'100%', width:`${Math.min(100,pct)}%`, background:barColor, borderRadius:3, transition:'width .3s' }} />
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{pct}% utilised</span>
                      <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{workDays} working days</span>
                      {hasShortfall && <span style={{ fontSize:10, fontWeight:500, color:'#DC2626' }}>Shortfall: {fmtH(shortfall)}</span>}
                    </div>
                  </div>

                  {/* Insight pills */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    <span style={{ fontSize:9, fontWeight:500, padding:'2px 7px', borderRadius:99, color:'#0C447C', background:'#E6F1FB' }}>{daysLogged}/{workDays} days logged</span>
                    {ownerTasks.length > 0 && <span style={{ fontSize:9, fontWeight:500, padding:'2px 7px', borderRadius:99, color:'#7C3AED', background:'#F5F3FF' }}>{ownerTasks.length} task{ownerTasks.length!==1?'s':''}</span>}
                    {maxDay.h > 0 && <span style={{ fontSize:9, fontWeight:500, padding:'2px 7px', borderRadius:99, color:'#065F46', background:'#ECFDF5' }}>Best day: {fmtH(maxDay.h)} on {maxDay.date.slice(5)}</span>}
                    {!hasShortfall && loggedHrs > 0 && <span style={{ fontSize:9, fontWeight:500, padding:'2px 7px', borderRadius:99, color:'#059669', background:'#ECFDF5' }}>✓ On track</span>}
                  </div>

                  {/* Task list inside card */}
                  {ownerTasks.length > 0 && (
                    <div style={{ borderTop:'0.5px solid var(--color-border-tertiary)', paddingTop:8 }}>
                      <p style={{ fontSize:9, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:5 }}>Tasks logged</p>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {ownerTasks.slice(0,4).map(t => {
                          const ms = visibleDates.reduce((s,ds)=>s+getTaskDayMs(t,ds),0);
                          const dept = t.seoOwner===owner?'SEO':t.contentOwner===owner?'Con':t.webOwner===owner?'Web':'Hub';
                          const dc = {SEO:{c:'#185FA5',bg:'#E6F1FB'},Con:{c:'#BA7517',bg:'#FAEEDA'},Web:{c:'#1D9E75',bg:'#E1F5EE'},Hub:{c:'#9D174D',bg:'#FDF2F8'}}[dept];
                          return (
                            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10 }}>
                              <span style={{ fontSize:8, fontWeight:600, padding:'1px 4px', borderRadius:99, color:dc?.c, background:dc?.bg, flexShrink:0 }}>{dept}</span>
                              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--color-text-secondary)' }}>{t.title}</span>
                              <span style={{ fontWeight:500, color:'#0C447C', flexShrink:0 }}>{fmtMs(ms)}</span>
                            </div>
                          );
                        })}
                        {ownerTasks.length > 4 && <span style={{ fontSize:9, color:'var(--color-text-tertiary)' }}>+{ownerTasks.length-4} more</span>}
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
      {activeTab==='leave' && (
        <div className="space-y-4">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:13, fontWeight:500, color:'var(--color-text-primary)' }}>Leave & Holiday records</p>
            <button onClick={()=>setShowAddLeave(true)} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #185FA540', color:'#0C447C', background:'#E6F1FB', cursor:'pointer' }}>+ Add leave</button>
          </div>
          {showAddLeave && (
            <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:16 }}>
              <p style={{ fontSize:12, fontWeight:500, color:'var(--color-text-primary)', marginBottom:12 }}>Add leave or holiday</p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:10 }}>
                {isAdmin && (
                  <div>
                    <label style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:3 }}>Owner</label>
                    <select value={newLeave.owner} onChange={e=>setNewLeave(l=>({...l,owner:e.target.value}))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
                      <option value="All (Holiday)">All (Holiday)</option>
                      {allOwners.map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:3 }}>Date</label>
                  <input type="date" value={newLeave.date} onChange={e=>setNewLeave(l=>({...l,date:e.target.value}))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
                </div>
                <div>
                  <label style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:3 }}>Type</label>
                  <select value={newLeave.type} onChange={e=>setNewLeave(l=>({...l,type:e.target.value as LeaveType}))} className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5">
                    <option value="full">Full day leave</option>
                    <option value="half">Half day</option>
                    <option value="holiday">Public holiday</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, color:'var(--color-text-tertiary)', display:'block', marginBottom:3 }}>Note</label>
                  <input type="text" value={newLeave.note} onChange={e=>setNewLeave(l=>({...l,note:e.target.value}))} placeholder="e.g. Holi, Sick leave" className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5"/>
                </div>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:10 }}>
                <button onClick={()=>{ const entry: LeaveRecord={id:`lv_${Date.now()}`,...newLeave}; updateLeave([...leave,entry]); setShowAddLeave(false); }} style={{ padding:'5px 14px', borderRadius:7, fontSize:11, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>Save</button>
                <button onClick={()=>setShowAddLeave(false)} style={{ padding:'5px 12px', borderRadius:7, fontSize:11, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Owner','Date','Day','Type','Note',''].map(h=>(
                    <th key={h} style={{ fontSize:9, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em', padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'left', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leave.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--color-text-tertiary)', fontStyle:'italic' }}>No leave records yet</td></tr>
                ) : [...leave].sort((a,b)=>b.date.localeCompare(a.date)).map(l => (
                  <tr key={l.id} className="hover:brightness-95">
                    <td style={{ fontSize:12, padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontWeight:500, color:'var(--color-text-primary)' }}>{l.owner}</td>
                    <td style={{ fontSize:11, padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'var(--color-text-secondary)' }}>{l.date}</td>
                    <td style={{ fontSize:11, padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'var(--color-text-tertiary)' }}>{dayLabel(l.date)}</td>
                    <td style={{ fontSize:11, padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                      <span style={{ fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:99, color:l.type==='full'?'#0C447C':l.type==='half'?'#633806':'#085041', background:l.type==='full'?'#E6F1FB':l.type==='half'?'#FAEEDA':'#E1F5EE' }}>
                        {l.type==='full'?'Full day':l.type==='half'?'Half day':'Public holiday'}
                      </span>
                    </td>
                    <td style={{ fontSize:11, padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'var(--color-text-secondary)' }}>{l.note||'—'}</td>
                    <td style={{ padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                      <button onClick={()=>updateLeave(leave.filter(r=>r.id!==l.id))} style={{ fontSize:10, padding:'2px 7px', borderRadius:5, border:'0.5px solid #F09595', color:'#791F1F', background:'#FCEBEB', cursor:'pointer' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ background:'var(--color-background-secondary)', borderRadius:8, padding:'8px 14px', fontSize:11, color:'var(--color-text-secondary)' }}>
            Full day = 0h expected · Half day = 4h expected · Public holiday applies to all owners
          </div>
        </div>
      )}
    </div>
  );
}
