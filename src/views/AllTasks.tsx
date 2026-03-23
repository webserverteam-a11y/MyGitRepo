import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Task } from '../types';
import { useAppContext } from '../context/AppContext';
import { useAllOwners } from '../hooks/useAllOwners';
import { getDeptDelayedInfo } from '../utils';
import { Pencil, X, ChevronUp, ChevronDown } from 'lucide-react';

type SortKey = 'intakeDate' | 'title' | 'client' | 'seoOwner' | 'estHours' | 'actualHours' | 'status';

const NEON: Record<string, { color: string; bg: string; glow: string }> = {
  'Not Started':  { color: '#888780', bg: '#F1EFE8', glow: 'none' },
  'In Progress':  { color: '#2563EB', bg: '#EFF6FF', glow: '0 0 6px #60A5FA50' },
  'Paused':       { color: '#D97706', bg: '#FFFBEB', glow: '0 0 6px #FCD34D40' },
  'Rework':       { color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 6px #A78BFA40' },
  'Completed':    { color: '#059669', bg: '#ECFDF5', glow: '0 0 6px #34D39940' },
  'QC Submitted': { color: '#0891B2', bg: '#ECFEFF', glow: '0 0 6px #22D3EE40' },
  'Delayed':      { color: '#DC2626', bg: '#FEF2F2', glow: '0 0 6px #F8717140' },
  'Approved':     { color: '#059669', bg: '#ECFDF5', glow: 'none' },
};

function NeonPill({ label }: { label: string }) {
  const s = NEON[label] || NEON['Not Started'];
  return <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, color:s.color, background:s.bg, border:`1px solid ${s.color}40`, boxShadow:s.glow, whiteSpace:'nowrap' }}>{label}</span>;
}

function getTaskStatus(t: Task): string {
  if (t.isCompleted || t.executionState === 'Ended') return 'Completed';
  if (t.executionState === 'In Progress') return 'In Progress';
  if (t.executionState === 'Paused') return 'Paused';
  if (t.executionState === 'Rework') return 'Rework';
  if (t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC') return 'QC Submitted';
  return 'Not Started';
}

function getQuickDateRange(key: string): { from: string; to: string } {
  const now = new Date();
  const pad = (d: Date) => d.toISOString().split('T')[0];
  if (key === 'today') return { from: pad(now), to: pad(now) };
  if (key === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7));
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    return { from: pad(mon), to: pad(sun) };
  }
  if (key === 'month') {
    return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, to: pad(new Date(now.getFullYear(), now.getMonth()+1, 0)) };
  }
  if (key === 'quarter') {
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
    const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3+3, 0);
    return { from: pad(qStart), to: pad(qEnd) };
  }
  return { from: '', to: '' };
}

export function AllTasks({ tasks }: { tasks: Task[] }) {
  const { adminOptions, currentUser, isAdmin, setTasks } = useAppContext();
  const allOwnersList = useAllOwners();
  const todayStr = new Date().toISOString().split('T')[0];

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeChip, setActiveChip] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState(() => !isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All');
  const [stageFilter, setStageFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeStatus, setActiveStatus] = useState<string | null>(null);

  // Table state
  const [sortKey, setSortKey] = useState<SortKey>('intakeDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showInsights, setShowInsights] = useState(true);

  const handleChip = (key: string) => {
    const r = getQuickDateRange(key);
    setDateFrom(r.from); setDateTo(r.to);
    setActiveChip(key); setPage(1);
  };

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };

  const isDelayed = (t: Task) => {
    if (t.isCompleted) return false;
    const ad = t.currentOwner === 'Content' ? t.contentAssignedDate : t.currentOwner === 'Web' ? t.webAssignedDate : t.intakeDate;
    const est = t.currentOwner === 'Content' ? (t.estHoursContent||0) : t.currentOwner === 'Web' ? (t.estHoursWeb||0) : (t.estHoursSEO||t.estHours||0);
    return getDeptDelayedInfo(ad||'', est, 0).isDelayed;
  };

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      const inRange = (d?: string) => d && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
      if ((dateFrom || dateTo) && !inRange(t.intakeDate) && !inRange(t.contentAssignedDate) && !inRange(t.webAssignedDate)) return false;
      if (clientFilter !== 'All' && t.client !== clientFilter) return false;
      if (ownerFilter !== 'All' && t.seoOwner !== ownerFilter && t.contentOwner !== ownerFilter && t.webOwner !== ownerFilter) return false;
      if (stageFilter !== 'All' && t.seoStage !== stageFilter) return false;
      if (deptFilter !== 'All' && t.currentOwner !== deptFilter) return false;
      if (statusFilter !== 'All') {
        const s = getTaskStatus(t);
        if (statusFilter === 'Delayed') { if (!isDelayed(t)) return false; }
        else if (s !== statusFilter) return false;
      }
      if (activeStatus) {
        if (activeStatus === 'Delayed' && !isDelayed(t)) return false;
        else if (activeStatus !== 'Delayed' && getTaskStatus(t) !== activeStatus) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.client.toLowerCase().includes(q) && !(t.focusedKw||'').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tasks, dateFrom, dateTo, clientFilter, ownerFilter, stageFilter, deptFilter, statusFilter, activeStatus, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'intakeDate') { av = a.intakeDate; bv = b.intakeDate; }
      else if (sortKey === 'title') { av = a.title; bv = b.title; }
      else if (sortKey === 'client') { av = a.client; bv = b.client; }
      else if (sortKey === 'seoOwner') { av = a.seoOwner; bv = b.seoOwner; }
      else if (sortKey === 'estHours') { av = a.estHoursSEO||a.estHours||0; bv = b.estHoursSEO||b.estHours||0; }
      else if (sortKey === 'actualHours') { av = a.actualHours||0; bv = b.actualHours||0; }
      else { av = getTaskStatus(a); bv = getTaskStatus(b); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const paginated = sorted.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  // Summary counts
  const counts = useMemo(() => ({
    total: filtered.length,
    inProgress: filtered.filter(t => getTaskStatus(t) === 'In Progress').length,
    delayed: filtered.filter(t => isDelayed(t)).length,
    qc: filtered.filter(t => getTaskStatus(t) === 'QC Submitted').length,
    rework: filtered.filter(t => getTaskStatus(t) === 'Rework').length,
    completed: filtered.filter(t => getTaskStatus(t) === 'Completed').length,
    notStarted: filtered.filter(t => getTaskStatus(t) === 'Not Started').length,
    paused: filtered.filter(t => getTaskStatus(t) === 'Paused').length,
  }), [filtered]);

  // Admin insight pills
  const insights = useMemo(() => {
    if (!isAdmin) return [];
    const pills: { icon: string; text: string; color: string; bg: string; glow: string }[] = [];
    const allDelayed = tasks.filter(t => isDelayed(t));
    if (allDelayed.length > 0) {
      const byOwner: Record<string, number> = {};
      allDelayed.forEach(t => { byOwner[t.seoOwner] = (byOwner[t.seoOwner]||0)+1; });
      const top = Object.entries(byOwner).sort((a,b) => b[1]-a[1])[0];
      pills.push({ icon:'⚠', text:`${allDelayed.length} delayed — ${top[0]} has most (${top[1]})`, color:'#DC2626', bg:'#FEF2F2', glow:'0 0 6px #F8717130' });
    }
    const qcTasks = tasks.filter(t => t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC');
    if (qcTasks.length > 0) {
      const byContent: Record<string,number> = {};
      qcTasks.forEach(t => { if (t.contentOwner) byContent[t.contentOwner] = (byContent[t.contentOwner]||0)+1; });
      const detail = Object.entries(byContent).map(([k,v])=>`${k} (${v})`).join(', ');
      pills.push({ icon:'⊙', text:`${qcTasks.length} QC waiting${detail ? ' — '+detail : ''}`, color:'#0891B2', bg:'#ECFEFF', glow:'0 0 6px #22D3EE30' });
    }
    const reworkOpen = tasks.filter(t => t.executionState === 'Rework' || t.seoQcStatus === 'Rework');
    if (reworkOpen.length > 0) pills.push({ icon:'↺', text:`${reworkOpen.length} rework open`, color:'#7C3AED', bg:'#F5F3FF', glow:'0 0 6px #A78BFA30' });
    const total = tasks.length; const done = tasks.filter(t=>t.isCompleted).length;
    if (total > 0) pills.push({ icon:'✓', text:`${done}/${total} completed (${Math.round(done/total*100)}% rate)`, color:'#059669', bg:'#ECFDF5', glow:'0 0 6px #34D39930' });
    const noKw = tasks.filter(t => !t.focusedKw && !t.isCompleted).length;
    if (noKw > 0) pills.push({ icon:'⊘', text:`${noKw} tasks missing keyword`, color:'#888780', bg:'#F1EFE8', glow:'none' });
    const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate()-3);
    const stale = tasks.filter(t => (!t.executionState||t.executionState==='Not Started') && !t.isCompleted && t.intakeDate <= twoDaysAgo.toISOString().split('T')[0]).length;
    if (stale > 0) pills.push({ icon:'🕐', text:`${stale} tasks not started in 3+ days`, color:'#D97706', bg:'#FFFBEB', glow:'none' });
    const withHrs = tasks.filter(t => t.actualHours && (t.estHoursSEO||t.estHours));
    if (withHrs.length > 0) {
      const avg = withHrs.reduce((s,t) => s + (t.actualHours||0)/(t.estHoursSEO||t.estHours||1), 0) / withHrs.length;
      pills.push({ icon:'📊', text:`Avg actual vs est: ${avg.toFixed(1)}×${avg>1?' over':' under'}`, color:'#2563EB', bg:'#EFF6FF', glow:'none' });
    }
    return pills;
  }, [tasks, isAdmin]);

  const TH = ({ children, sk, style = {} }: { children: React.ReactNode; sk?: SortKey; style?: React.CSSProperties }) => (
    <th onClick={sk ? () => handleSort(sk) : undefined}
      style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', padding:'7px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', whiteSpace:'nowrap', textAlign:'left', cursor: sk ? 'pointer' : 'default', userSelect:'none', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)', ...style }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
        {children}
        {sk && sortKey === sk && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </span>
    </th>
  );
  const TD = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <td style={{ fontSize:11, padding:'7px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', verticalAlign:'middle', ...style }}>{children}</td>
  );

  const exportCSV = () => {
    const h = ['Task ID','Intake Date','Title','Client','Stage','SEO Owner','Con. Owner','Con. Status','Web Owner','Web Status','Est Hrs','Actual Hrs','Current Owner','Status'];
    const rows = sorted.map(t => [t.id, t.intakeDate, `"${t.title.replace(/"/g,'""')}"`, t.client, t.seoStage, t.seoOwner, t.contentOwner||'', t.contentStatus||'', t.webOwner||'', t.webStatus||'', t.estHoursSEO||t.estHours||'', t.actualHours||'', t.currentOwner, getTaskStatus(t)].join(','));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[h.join(','), ...rows].join('\n')], {type:'text/csv'}));
    a.download = `all-tasks-${dateFrom||'all'}.csv`; a.click();
  };

  const QUICK_CHIPS = [
    { key:'today', label:'Today' }, { key:'week', label:'This week' },
    { key:'month', label:'This month' }, { key:'quarter', label:'This quarter' },
    { key:'', label:'All time' },
  ];

  const STATUS_CHIPS = [
    { key:'In Progress', count: counts.inProgress, color:'#2563EB', bg:'#EFF6FF', glow:'0 0 6px #60A5FA50' },
    { key:'Not Started', count: counts.notStarted, color:'#888780', bg:'#F1EFE8', glow:'none' },
    { key:'Paused', count: counts.paused, color:'#D97706', bg:'#FFFBEB', glow:'0 0 6px #FCD34D40' },
    { key:'QC Submitted', count: counts.qc, color:'#0891B2', bg:'#ECFEFF', glow:'0 0 6px #22D3EE40' },
    { key:'Rework', count: counts.rework, color:'#7C3AED', bg:'#F5F3FF', glow:'0 0 6px #A78BFA40' },
    { key:'Delayed', count: counts.delayed, color:'#DC2626', bg:'#FEF2F2', glow:'0 0 6px #F8717140' },
    { key:'Completed', count: counts.completed, color:'#059669', bg:'#ECFDF5', glow:'0 0 6px #34D39940' },
  ].filter(c => c.count > 0);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">All Tasks</h2>
        <button onClick={exportCSV} style={{ fontSize:11, padding:'6px 14px', borderRadius:8, border:'0.5px solid #05966960', color:'#059669', background:'#ECFDF5', cursor:'pointer', fontWeight:500 }}>↓ Export CSV</button>
      </div>

      {/* Summary bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:8 }}>
        {[
          { label:'Total', value: counts.total, color:'#444441' },
          { label:'In Progress', value: counts.inProgress, color:'#2563EB', glow:'0 0 8px #60A5FA40' },
          { label:'Delayed', value: counts.delayed, color:'#DC2626', glow:'0 0 8px #F8717140' },
          { label:'QC Pending', value: counts.qc, color:'#0891B2', glow:'0 0 8px #22D3EE40' },
          { label:'Rework', value: counts.rework, color:'#7C3AED', glow:'0 0 8px #A78BFA40' },
          { label:'Completed', value: counts.completed, color:'#059669', glow:'0 0 8px #34D39940' },
        ].map(s => (
          <div key={s.label} onClick={() => setActiveStatus(activeStatus === s.label ? null : s.label)}
            style={{ background:'var(--color-background-primary)', border:`0.5px solid var(--color-border-tertiary)`, borderRadius:10, padding:'10px 8px', textAlign:'center', cursor:'pointer', boxShadow: activeStatus === s.label ? (s as any).glow || 'none' : 'none', borderColor: activeStatus === s.label ? s.color : undefined, transition:'all .15s' }}
            className="hover:brightness-95">
            <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:600, marginBottom:3 }}>{s.label}</p>
            <p style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Admin insights */}
      {isAdmin && insights.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 shadow-sm">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em' }}>Admin insights</span>
            <button onClick={() => setShowInsights(s => !s)} style={{ fontSize:10, color:'var(--color-text-tertiary)', background:'none', border:'none', cursor:'pointer' }}>{showInsights ? '▲ collapse' : '▼ expand'}</button>
          </div>
          {showInsights && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {insights.map((p, i) => (
                <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:p.color, background:p.bg, border:`1px solid ${p.color}40`, boxShadow:p.glow }}>
                  {p.icon} {p.text}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-zinc-200 rounded-xl px-4 py-4 shadow-sm space-y-3">
        {/* Date range row */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)', fontWeight:500 }}>DATE:</span>
            {QUICK_CHIPS.map(c => (
              <button key={c.key} onClick={() => { handleChip(c.key); }} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color: activeChip === c.key ? '#fff' : 'var(--color-text-secondary)', background: activeChip === c.key ? '#2563EB' : 'var(--color-background-secondary)', border:`0.5px solid ${activeChip===c.key?'#2563EB':'var(--color-border-secondary)'}`, boxShadow: activeChip===c.key ? '0 0 8px #60A5FA50' : 'none', transition:'all .15s' }}>{c.label}</button>
            ))}
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)', margin:'0 4px' }}>Custom:</span>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActiveChip('custom'); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>to</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActiveChip('custom'); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
        </div>

        {/* Other filters row */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
          <input type="text" placeholder="🔍 Search task, client, keyword..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex:2, minWidth:160, fontSize:12, border:'0.5px solid var(--color-border-secondary)', borderRadius:8, padding:'6px 10px', background:'var(--color-background-primary)', color:'var(--color-text-primary)' }} />
          {[
            ['Client', clientFilter, setClientFilter, ['All', ...adminOptions.clients]],
            ['SEO Owner', ownerFilter, setOwnerFilter, ['All', ...allOwnersList]],
            ['Stage', stageFilter, setStageFilter, ['All', ...adminOptions.seoStages]],
            ['Department', deptFilter, setDeptFilter, ['All', 'SEO', 'Content', 'Web']],
            ['Status', statusFilter, setStatusFilter, ['All', 'Not Started', 'In Progress', 'Paused', 'QC Submitted', 'Rework', 'Completed', 'Delayed']],
          ].map(([label, val, set, opts]: any) => (
            <div key={label as string} style={{ flex:1, minWidth:110 }}>
              <label style={{ display:'block', fontSize:9, color:'var(--color-text-tertiary)', fontWeight:600, textTransform:'uppercase', marginBottom:3 }}>{label as string}</label>
              <select value={val as string} onChange={e => { (set as any)(e.target.value); setPage(1); }}
                className="w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {(opts as string[]).map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(dateFrom || dateTo || clientFilter !== 'All' || ownerFilter !== 'All' || stageFilter !== 'All' || deptFilter !== 'All' || statusFilter !== 'All' || activeStatus || search) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setClientFilter('All'); setOwnerFilter(!isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All'); setStageFilter('All'); setDeptFilter('All'); setStatusFilter('All'); setActiveStatus(null); setSearch(''); setActiveChip(''); setPage(1); }}
              className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-red-400 hover:bg-red-50 self-end">Reset all</button>
          )}
        </div>

        {/* Status quick chips */}
        {STATUS_CHIPS.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontWeight:600, textTransform:'uppercase', marginRight:4 }}>Quick filter:</span>
            {STATUS_CHIPS.map(c => (
              <button key={c.key} onClick={() => { setActiveStatus(activeStatus === c.key ? null : c.key); setPage(1); }}
                style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99, fontSize:10, fontWeight:500, cursor:'pointer', color: activeStatus===c.key ? '#fff' : c.color, background: activeStatus===c.key ? c.color : c.bg, border:`1px solid ${c.color}40`, boxShadow: activeStatus===c.key ? c.glow : 'none', transition:'all .15s' }}>
                {c.key} <span style={{ fontWeight:700, fontSize:11 }}>{c.count}</span>
              </button>
            ))}
            {(activeStatus || statusFilter !== 'All') && (
              <button onClick={() => { setActiveStatus(null); setStatusFilter('All'); }} style={{ fontSize:10, color:'#DC2626', background:'none', border:'none', cursor:'pointer' }}>clear ×</button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)', flexWrap:'wrap', gap:8 }}>
          <span style={{ fontSize:10, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em' }}>
            {sorted.length} tasks{activeStatus ? ` · ${activeStatus}` : ''}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>Per page:</span>
            {[10,25,50,100].map(n => (
              <button key={n} onClick={() => { setPerPage(n); setPage(1); }} style={{ padding:'2px 8px', borderRadius:6, fontSize:10, fontWeight:500, border:`0.5px solid ${perPage===n?'#2563EB':'var(--color-border-secondary)'}`, color:perPage===n?'#2563EB':'var(--color-text-secondary)', background:perPage===n?'#EFF6FF':'transparent', cursor:'pointer', boxShadow:perPage===n?'0 0 6px #60A5FA40':'none' }}>{n}</button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto" style={{ maxHeight: 520 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1050 }}>
            <thead style={{ position:'sticky', top:0, zIndex:10 }}>
              <tr>
                <TH>ID</TH>
                <TH sk="intakeDate">Intake Date</TH>
                <TH sk="title" style={{ minWidth:180 }}>Task</TH>
                <TH sk="client">Client</TH>
                <TH>Stage</TH>
                <TH sk="seoOwner">SEO Owner</TH>
                <TH sk="estHours">Est Hrs</TH>
                <TH style={{ background:'#FAEEDA20', color:'#633806' }}>Con. Owner</TH>
                <TH style={{ background:'#FAEEDA20', color:'#633806' }}>Con. Status</TH>
                <TH style={{ background:'#E1F5EE20', color:'#085041' }}>Web Owner</TH>
                <TH style={{ background:'#E1F5EE20', color:'#085041' }}>Web Status</TH>
                <TH sk="actualHours">Actual Hrs</TH>
                <TH>Curr. Owner</TH>
                <TH sk="status">Status</TH>
                <TH>Edit</TH>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={15} style={{ padding:24, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:12, fontStyle:'italic' }}>No tasks match the current filters</td></tr>
              ) : paginated.map(task => {
                const status = getTaskStatus(task);
                const delayed = isDelayed(task);
                const rowBg = delayed ? '#FEF2F210' : 'transparent';
                const deptColor = task.currentOwner === 'Content' ? '#633806' : task.currentOwner === 'Web' ? '#085041' : '#0C447C';
                const deptBg = task.currentOwner === 'Content' ? '#FAEEDA' : task.currentOwner === 'Web' ? '#E1F5EE' : '#E6F1FB';
                return (
                  <tr key={task.id} style={{ background: rowBg }} className="hover:brightness-95 transition-all">
                    <TD><span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--color-text-tertiary)' }}>{task.id}</span></TD>
                    <TD><span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{task.intakeDate}</span></TD>
                    <TD>
                      <div style={{ fontWeight:500, color:'var(--color-text-primary)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={task.title}>{task.title}</div>
                      {delayed && <span style={{ fontSize:9, color:'#DC2626' }}>Delayed</span>}
                    </TD>
                    <TD>{task.client}</TD>
                    <TD>{task.seoStage}</TD>
                    <TD>{task.seoOwner}</TD>
                    <TD style={{ textAlign:'center' }}>{task.estHoursSEO || task.estHours || '—'}</TD>
                    <TD style={{ background:'#FAEEDA08' }}><span style={{ fontSize:10, color:'#BA7517' }}>{task.contentOwner || '—'}</span></TD>
                    <TD style={{ background:'#FAEEDA08' }}>
                      {task.contentStatus ? <NeonPill label={task.contentStatus === 'Pending QC' || task.contentStatus === 'QC' ? 'QC Submitted' : task.contentStatus} /> : <span style={{ color:'var(--color-text-tertiary)' }}>—</span>}
                    </TD>
                    <TD style={{ background:'#E1F5EE08' }}><span style={{ fontSize:10, color:'#1D9E75' }}>{task.webOwner || '—'}</span></TD>
                    <TD style={{ background:'#E1F5EE08' }}>
                      {task.webStatus ? <NeonPill label={task.webStatus === 'Pending QC' ? 'QC Submitted' : task.webStatus} /> : <span style={{ color:'var(--color-text-tertiary)' }}>—</span>}
                    </TD>
                    <TD style={{ textAlign:'center' }}>{task.actualHours || '—'}</TD>
                    <TD><span style={{ fontSize:10, fontWeight:500, padding:'2px 7px', borderRadius:99, color:deptColor, background:deptBg }}>{task.currentOwner}</span></TD>
                    <TD><NeonPill label={delayed ? 'Delayed' : status} /></TD>
                    <TD>
                      <button onClick={() => setEditingTask(task)} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3, background:'transparent' }}>
                        <Pencil size={10} /> Edit
                      </button>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (() => {
          const pages: (number|'...')[] = [];
          if (totalPages <= 7) { for (let i=1;i<=totalPages;i++) pages.push(i); }
          else {
            pages.push(1);
            if (page > 3) pages.push('...');
            for (let i=Math.max(2,page-1); i<=Math.min(totalPages-1,page+1); i++) pages.push(i);
            if (page < totalPages-2) pages.push('...');
            pages.push(totalPages);
          }
          return (
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'10px 14px', borderTop:'0.5px solid var(--color-border-tertiary)', flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color:'var(--color-text-tertiary)', marginRight:6 }}>
                {(page-1)*perPage+1}–{Math.min(page*perPage, sorted.length)} of {sorted.length}
              </span>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color: page===1 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>‹</button>
              {pages.map((p,i) => p==='...'
                ? <span key={`e${i}`} style={{ fontSize:11, color:'var(--color-text-tertiary)', padding:'0 2px' }}>…</span>
                : <button key={p} onClick={() => setPage(p as number)} style={{ width:28, height:28, borderRadius:6, border:`0.5px solid ${page===p?'#2563EB':'var(--color-border-secondary)'}`, fontSize:11, fontWeight:500, cursor:'pointer', background:page===p?'#2563EB':'transparent', color:page===p?'#fff':'var(--color-text-secondary)', boxShadow:page===p?'0 0 8px #60A5FA60':'none' }}>{p}</button>
              )}
              <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color: page===totalPages ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>›</button>
            </div>
          );
        })()}
      </div>

      {/* Edit modal */}
      {editingTask && (
        <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Edit Task</h3>
              <button onClick={() => setEditingTask(null)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {([['Title','title'],['Client','client'],['Stage','seoStage'],['SEO Owner','seoOwner'],['Content Owner','contentOwner'],['Web Owner','webOwner'],['Current Owner','currentOwner'],['Target URL','targetUrl'],['Doc URL','docUrl'],['Keyword','focusedKw'],['Remarks','remarks']] as [string,keyof Task][]).map(([label, field]) => (
                <div key={field}>
                  <label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
                  {['client','seoStage','seoOwner','contentOwner','webOwner','currentOwner'].includes(field) ? (
                    <select value={(editingTask as any)[field] || ''} onChange={e => setEditingTask((t:any) => ({...t,[field]:e.target.value}))}
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
                      {field === 'client' && adminOptions.clients.map(o => <option key={o}>{o}</option>)}
                      {field === 'seoStage' && adminOptions.seoStages.map(o => <option key={o}>{o}</option>)}
                      {field === 'seoOwner' && adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
                      {field === 'contentOwner' && ['', ...adminOptions.contentOwners].map(o => <option key={o}>{o}</option>)}
                      {field === 'webOwner' && ['', ...adminOptions.webOwners].map(o => <option key={o}>{o}</option>)}
                      {field === 'currentOwner' && ['SEO','Content','Web'].map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={(editingTask as any)[field] || ''} onChange={e => setEditingTask((t:any) => ({...t,[field]:e.target.value}))}
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  )}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-3">
                {[['Est SEO Hrs','estHoursSEO'],['Est Con Hrs','estHoursContent'],['Est Web Hrs','estHoursWeb']].map(([label,field]) => (
                  <div key={field}>
                    <label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
                    <input type="number" value={(editingTask as any)[field] || ''} onChange={e => setEditingTask((t:any) => ({...t,[field]:Number(e.target.value)}))}
                      className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 flex gap-3 justify-end">
              <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-xs font-medium text-zinc-600">Cancel</button>
              <button onClick={() => { setTasks(prev => prev.map(t => t.id === editingTask.id ? {...t, ...editingTask} : t)); setEditingTask(null); }}
                className="px-5 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
