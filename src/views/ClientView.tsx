import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Task } from '../types';
import { getDeptDelayedInfo } from '../utils';
import { X, ExternalLink, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

type SortKey = 'intakeDate' | 'title' | 'actualHours' | 'days';

const NEON: Record<string, { color: string; bg: string }> = {
  'Not Started':   { color: '#888780', bg: '#F1EFE8' },
  'In Progress':   { color: '#2563EB', bg: '#EFF6FF' },
  'Paused':        { color: '#D97706', bg: '#FFFBEB' },
  'Rework':        { color: '#7C3AED', bg: '#F5F3FF' },
  'QC Submitted':  { color: '#0891B2', bg: '#ECFEFF' },
  'Approved':      { color: '#059669', bg: '#ECFDF5' },
  'Completed':     { color: '#059669', bg: '#ECFDF5' },
  'Assigned':      { color: '#2563EB', bg: '#EFF6FF' },
  'Indexed':       { color: '#059669', bg: '#ECFDF5' },
  'Live':          { color: '#059669', bg: '#ECFDF5' },
  'Pending':       { color: '#888780', bg: '#F1EFE8' },
  'Delayed':       { color: '#DC2626', bg: '#FEF2F2' },
  'Todo':          { color: '#888780', bg: '#F1EFE8' },
  'On going':      { color: '#2563EB', bg: '#EFF6FF' },
};
function NeonPill({ label, size = 'sm' }: { label: string; size?: 'xs'|'sm' }) {
  const s = NEON[label] || { color: '#444', bg: '#F1EFE8' };
  return <span style={{ display:'inline-flex', padding: size==='xs' ? '1px 6px' : '2px 8px', borderRadius:99, fontSize:10, fontWeight:600, color:s.color, background:s.bg, border:`1px solid ${s.color}30`, whiteSpace:'nowrap' }}>{label}</span>;
}

function getMonthChips() {
  const now = new Date();
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const chips = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    chips.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, from: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, to: new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().split('T')[0] });
  }
  const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3, 1);
  const qEnd = new Date(now.getFullYear(), Math.floor(now.getMonth()/3)*3+3, 0);
  chips.push({ label: `Q${Math.floor(now.getMonth()/3)+1} ${now.getFullYear()}`, from: qStart.toISOString().split('T')[0], to: qEnd.toISOString().split('T')[0] });
  chips.push({ label: 'All time', from: '', to: '' });
  return chips;
}

// Section table component — reusable for SEO/Content/Web/Done
interface SectionTableProps {
  title: string; subtitle: string; count: number;
  color: string; bg: string; border: string;
  tasks: Task[]; columns: React.ReactNode; renderRow: (t: Task) => React.ReactNode;
  defaultExpanded?: boolean;
  page: number; perPage: number; onPage: (n: number) => void; onPerPage: (n: number) => void;
  sortKey: SortKey; sortDir: 'asc'|'desc'; onSort: (k: SortKey) => void;
}
function SectionTable({ title, subtitle, count, color, bg, border, tasks, columns, renderRow, defaultExpanded = true, page, perPage, onPage, onPerPage, sortKey, sortDir, onSort }: SectionTableProps) {
  const [open, setOpen] = useState(defaultExpanded);
  const paginated = tasks.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(tasks.length / perPage);

  const SortTH = ({ children, sk, style = {} }: { children: React.ReactNode; sk?: SortKey; style?: React.CSSProperties }) => (
    <th onClick={sk ? () => onSort(sk) : undefined}
      style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', padding:'6px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', whiteSpace:'nowrap', textAlign:'left', cursor: sk?'pointer':'default', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)', userSelect:'none', ...style }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{children}{sk && sortKey===sk && (sortDir==='asc' ? <ChevronUp size={9}/> : <ChevronDown size={9}/>)}</span>
    </th>
  );

  return (
    <div style={{ border:`0.5px solid ${border}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
      <button onClick={() => setOpen(o => !o)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:bg, border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, color }}>{title}</span>
          <span style={{ fontSize:11, color:`${color}99` }}>{subtitle}</span>
          <span style={{ fontSize:14, fontWeight:700, color, background:`${color}20`, padding:'1px 8px', borderRadius:99 }}>{count}</span>
        </div>
        {open ? <ChevronUp size={14} color={color} /> : <ChevronDown size={14} color={color} />}
      </button>
      {open && (
        <>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', background:'var(--color-background-secondary)' }}>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>Showing {Math.min(page*perPage, tasks.length)} of {tasks.length}</span>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <span style={{ fontSize:9, color:'var(--color-text-tertiary)' }}>Per page:</span>
              {[10,25,50].map(n => (
                <button key={n} onClick={() => { onPerPage(n); onPage(1); }} style={{ padding:'1px 6px', borderRadius:5, fontSize:9, fontWeight:500, border:`0.5px solid ${perPage===n?color:'var(--color-border-secondary)'}`, color:perPage===n?color:'var(--color-text-secondary)', background:perPage===n?`${color}15`:'transparent', cursor:'pointer' }}>{n}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:600 }}>
              <thead><tr>{columns}</tr></thead>
              <tbody>
                {paginated.length === 0
                  ? <tr><td colSpan={15} style={{ padding:'16px', textAlign:'center', fontSize:11, color:'var(--color-text-tertiary)', fontStyle:'italic' }}>No tasks in this section</td></tr>
                  : paginated.map(t => renderRow(t) as React.ReactElement)
                }
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 12px', borderTop:'0.5px solid var(--color-border-tertiary)', background:'var(--color-background-secondary)', flexWrap:'wrap' }}>
              <span style={{ fontSize:9, color:'var(--color-text-tertiary)', marginRight:4 }}>{(page-1)*perPage+1}–{Math.min(page*perPage, tasks.length)} of {tasks.length}</span>
              <button onClick={() => onPage(Math.max(1,page-1))} disabled={page===1} style={{ width:24, height:24, borderRadius:5, border:'0.5px solid var(--color-border-secondary)', fontSize:11, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>‹</button>
              {Array.from({length:totalPages}, (_,i)=>i+1).slice(Math.max(0,page-3), Math.min(totalPages,page+2)).map(p => (
                <button key={p} onClick={() => onPage(p)} style={{ width:24, height:24, borderRadius:5, border:`0.5px solid ${page===p?color:'var(--color-border-secondary)'}`, fontSize:10, fontWeight:500, cursor:'pointer', background:page===p?color:'transparent', color:page===p?'#fff':'var(--color-text-secondary)' }}>{p}</button>
              ))}
              <button onClick={() => onPage(Math.min(totalPages,page+1))} disabled={page===totalPages} style={{ width:24, height:24, borderRadius:5, border:'0.5px solid var(--color-border-secondary)', fontSize:11, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ClientView({ tasks }: { tasks: Task[] }) {
  const { adminOptions, currentUser, isAdmin } = useAppContext();
  const clients = useMemo(() => Array.from(new Set(tasks.map(t => t.client))).sort(), [tasks]);
  const [selectedClient, setSelectedClient] = useState<string>(clients[0] || '');

  // Date filters
  const monthChips = useMemo(() => getMonthChips(), []);
  const [activeChip, setActiveChip] = useState('All time');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const handleChip = (chip: { label:string; from:string; to:string }) => {
    setActiveChip(chip.label); setDateFrom(chip.from); setDateTo(chip.to);
  };

  // Other filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');

  // Section sort/page state
  const [seoPage, setSeoPage] = useState(1); const [seoPP, setSeoPP] = useState(10);
  const [conPage, setConPage] = useState(1); const [conPP, setConPP] = useState(10);
  const [webPage, setWebPage] = useState(1); const [webPP, setWebPP] = useState(10);
  const [donePage, setDonePage] = useState(1); const [donePP, setDonePP] = useState(10);
  const [seoSort, setSeoSort] = useState<SortKey>('intakeDate'); const [seoDirr, setSeoDir] = useState<'asc'|'desc'>('desc');
  const [conSort, setConSort] = useState<SortKey>('intakeDate'); const [conDir, setConDir] = useState<'asc'|'desc'>('desc');
  const [webSort, setWebSort] = useState<SortKey>('intakeDate'); const [webDir, setWebDir] = useState<'asc'|'desc'>('desc');
  const [doneSort, setDoneSort] = useState<SortKey>('intakeDate'); const [doneDir, setDoneDir] = useState<'asc'|'desc'>('desc');

  const handleSort = (setter: React.Dispatch<React.SetStateAction<SortKey>>, dirSetter: React.Dispatch<React.SetStateAction<'asc'|'desc'>>, current: SortKey, dir: 'asc'|'desc', key: SortKey) => {
    if (current === key) dirSetter(dir === 'asc' ? 'desc' : 'asc'); else { setter(key); dirSetter('asc'); }
  };

  const isDelayed = (t: Task) => {
    if (t.isCompleted) return false;
    const ad = t.currentOwner === 'Content' ? t.contentAssignedDate : t.currentOwner === 'Web' ? t.webAssignedDate : t.intakeDate;
    const est = t.currentOwner === 'Content' ? (t.estHoursContent||0) : t.currentOwner === 'Web' ? (t.estHoursWeb||0) : (t.estHoursSEO||t.estHours||0);
    return getDeptDelayedInfo(ad||'', est, 0).isDelayed;
  };

  const sortTasks = (list: Task[], sk: SortKey, dir: 'asc'|'desc') =>
    [...list].sort((a, b) => {
      let av: any, bv: any;
      if (sk === 'intakeDate') { av = a.intakeDate; bv = b.intakeDate; }
      else if (sk === 'title') { av = a.title; bv = b.title; }
      else if (sk === 'actualHours') { av = a.actualHours||0; bv = b.actualHours||0; }
      else { av = a.daysInStage||0; bv = b.daysInStage||0; }
      if (av < bv) return dir==='asc' ? -1 : 1;
      if (av > bv) return dir==='asc' ? 1 : -1;
      return 0;
    });

  const clientTasks = useMemo(() => tasks.filter(t => {
    if (t.client !== selectedClient) return false;
    const inRange = (d?: string) => d && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    if ((dateFrom || dateTo) && !inRange(t.intakeDate) && !inRange(t.contentAssignedDate) && !inRange(t.webAssignedDate)) return false;
    if (ownerFilter !== 'All' && t.seoOwner !== ownerFilter) return false;
    if (stageFilter !== 'All' && t.seoStage !== stageFilter) return false;
    if (statusFilter === 'Completed' && !t.isCompleted) return false;
    if (statusFilter === 'In Progress' && t.executionState !== 'In Progress') return false;
    if (statusFilter === 'Delayed' && !isDelayed(t)) return false;
    return true;
  }), [tasks, selectedClient, dateFrom, dateTo, ownerFilter, stageFilter, statusFilter]);

  const seoTasks = sortTasks(clientTasks.filter(t => !t.isCompleted && (t.currentOwner === 'SEO' || !t.currentOwner)), seoSort, seoDirr);
  const contentTasks = sortTasks(clientTasks.filter(t => !t.isCompleted && t.currentOwner === 'Content'), conSort, conDir);
  const webTasks = sortTasks(clientTasks.filter(t => !t.isCompleted && t.currentOwner === 'Web'), webSort, webDir);
  const doneTasks = sortTasks(clientTasks.filter(t => t.isCompleted || t.executionState === 'Ended'), doneSort, doneDir);
  const kwTasks = clientTasks.filter(t => t.focusedKw);

  const total = clientTasks.length;
  const completed = doneTasks.length;
  const inProgress = clientTasks.filter(t => t.executionState === 'In Progress').length;
  const delayed = clientTasks.filter(t => isDelayed(t)).length;
  const estHrsLeft = clientTasks.filter(t => !t.isCompleted).reduce((s,t) => s + (t.estHoursSEO||t.estHours||0) + (t.estHoursContent||0) + (t.estHoursWeb||0), 0);
  const actualHrs = clientTasks.reduce((s,t) => s + (t.actualHours||0), 0);
  const estTotal = clientTasks.reduce((s,t) => s + (t.estHoursSEO||t.estHours||0) + (t.estHoursContent||0) + (t.estHoursWeb||0), 0);
  const healthScore = total > 0 ? Math.max(0, Math.round(((completed - delayed)/total)*100)) : 0;
  const healthColor = healthScore >= 70 ? '#059669' : healthScore >= 40 ? '#D97706' : '#DC2626';

  // Stage mix
  const stageMix = useMemo(() => {
    const m: Record<string,number> = {};
    clientTasks.forEach(t => { m[t.seoStage] = (m[t.seoStage]||0)+1; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6);
  }, [clientTasks]);

  const TD = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <td style={{ fontSize:11, padding:'6px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', verticalAlign:'middle', color:'var(--color-text-secondary)', ...style }}>{children}</td>
  );

  // Export CSV (client-safe)
  const exportCSV = () => {
    const h = ['Date','Task','Stage','SEO Owner','Keyword','Volume','Monthly Rank','Cur Rank','Rank Change','Status','Target URL','Remarks'];
    const rows = clientTasks.map(t => {
      const diff = t.marRank && t.currentRank ? t.marRank - t.currentRank : '';
      return [t.intakeDate, `"${t.title.replace(/"/g,'""')}"`, t.seoStage, t.seoOwner, t.focusedKw||'', t.volume||'', t.marRank||'', t.currentRank||'', diff ? (Number(diff)>0?`+${diff}`:String(diff)) : '', t.isCompleted?'Completed':t.executionState||'Not Started', t.targetUrl||'', `"${(t.remarks||'').replace(/"/g,'""')}"`].join(',');
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[h.join(','),...rows].join('\n')],{type:'text/csv'}));
    a.download = `${selectedClient}-${activeChip.replace(' ','-')}.csv`; a.click();
  };

  const exportPDF = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><style>body{font-family:Arial;padding:32px;max-width:900px;margin:0 auto}h1{font-size:20px;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:20px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}.kpi{border:1px solid #e5e5e5;border-radius:8px;padding:10px;text-align:center}.kpi-l{font-size:9px;color:#888;text-transform:uppercase;margin-bottom:3px}.kpi-v{font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px}th{background:#f5f5f5;padding:6px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:10px}td{padding:5px 8px;border-bottom:1px solid #eee}h3{font-size:13px;margin:16px 0 6px;padding:6px 10px;border-radius:4px}.seo{background:#E6F1FB;color:#0C447C}.con{background:#FAEEDA;color:#633806}.web{background:#E1F5EE;color:#085041}.done{background:#EAF3DE;color:#27500A}.footer{margin-top:32px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:10px}</style></head><body>
    <h1>${selectedClient} — SEO Report</h1>
    <div class="sub">Period: ${activeChip} · Generated: ${new Date().toLocaleDateString('en-GB')}</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-l">Total</div><div class="kpi-v">${total}</div></div>
      <div class="kpi"><div class="kpi-l">Completed</div><div class="kpi-v" style="color:#059669">${completed}</div></div>
      <div class="kpi"><div class="kpi-l">In Progress</div><div class="kpi-v" style="color:#2563EB">${inProgress}</div></div>
      <div class="kpi"><div class="kpi-l">Est Hrs</div><div class="kpi-v">${estTotal.toFixed(1)}h</div></div>
    </div>
    ${seoTasks.length > 0 ? `<h3 class="seo">SEO Tasks (${seoTasks.length})</h3><table><thead><tr><th>Task</th><th>Stage</th><th>SEO Owner</th><th>Days</th><th>Est Hrs</th><th>Remarks</th></tr></thead><tbody>${seoTasks.map(t=>`<tr><td>${t.title}</td><td>${t.seoStage}</td><td>${t.seoOwner}</td><td>${t.daysInStage||0}</td><td>${t.estHoursSEO||t.estHours||'—'}</td><td>${t.remarks||'—'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${contentTasks.length > 0 ? `<h3 class="con">Content Tasks (${contentTasks.length})</h3><table><thead><tr><th>Task</th><th>SEO Owner</th><th>Content Owner</th><th>Status</th><th>Est Hrs</th><th>Actual Hrs</th></tr></thead><tbody>${contentTasks.map(t=>`<tr><td>${t.title}</td><td>${t.seoOwner}</td><td>${t.contentOwner||'—'}</td><td>${t.contentStatus||'—'}</td><td>${t.estHoursContent||'—'}</td><td>${t.actualHours||'—'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${webTasks.length > 0 ? `<h3 class="web">Web Tasks (${webTasks.length})</h3><table><thead><tr><th>Task</th><th>SEO Owner</th><th>Web Owner</th><th>Status</th><th>Target URL</th><th>Est Hrs</th><th>Actual Hrs</th></tr></thead><tbody>${webTasks.map(t=>`<tr><td>${t.title}</td><td>${t.seoOwner}</td><td>${t.webOwner||'—'}</td><td>${t.webStatus||'—'}</td><td>${t.targetUrl||'—'}</td><td>${t.estHoursWeb||'—'}</td><td>${t.actualHours||'—'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${doneTasks.length > 0 ? `<h3 class="done">Completed Tasks (${doneTasks.length})</h3><table><thead><tr><th>Task</th><th>SEO Owner</th><th>Keyword</th><th>Volume</th><th>Monthly Rank</th><th>Cur Rank</th><th>Actual Hrs</th><th>Target URL</th></tr></thead><tbody>${doneTasks.map(t=>`<tr><td>${t.title}</td><td>${t.seoOwner}</td><td>${t.focusedKw||'—'}</td><td>${t.volume||'—'}</td><td>${t.marRank||'—'}</td><td>${t.currentRank||'—'}</td><td>${t.actualHours||'—'}</td><td>${t.targetUrl||'—'}</td></tr>`).join('')}</tbody></table>` : ''}
    <div class="footer">Generated by SEO PM Dashboard · ${selectedClient} · Confidential</div>
    </body></html>`); w.document.close(); setTimeout(() => w.print(), 500);
  };

  return (
    <div className="space-y-4">

      {/* Client header */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div style={{ width:44, height:44, borderRadius:'50%', background:'#E6F1FB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#185FA5', flexShrink:0 }}>
              {selectedClient.slice(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:10, color:'var(--color-text-tertiary)', marginBottom:4 }}>Select client</div>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                className="text-sm font-semibold text-zinc-900 border border-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white min-w-[200px]">
                {clients.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-xs text-zinc-400 mt-1">SEO Owner: {clientTasks[0]?.seoOwner || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div style={{ textAlign:'center', padding:'8px 16px', background:'var(--color-background-secondary)', borderRadius:10 }}>
              <p style={{ fontSize:10, color:'var(--color-text-tertiary)', marginBottom:2 }}>Health score</p>
              <p style={{ fontSize:24, fontWeight:700, color:healthColor }}>{healthScore}<span style={{ fontSize:11, color:'var(--color-text-tertiary)'}}>/100</span></p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, background:'#ECFDF5', color:'#27500A' }}>{completed} completed</span>
              {delayed > 0 && <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, background:'#FEF2F2', color:'#791F1F' }}>{delayed} delayed</span>}
              <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, background:'#EFF6FF', color:'#0C447C' }}>{inProgress} in progress</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-zinc-200 rounded-xl px-4 py-4 shadow-sm space-y-3">
        {/* Month chips + custom date */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center' }}>
          {monthChips.map(chip => (
            <button key={chip.label} onClick={() => handleChip(chip)}
              style={{ padding:'4px 11px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color: activeChip===chip.label ? '#fff' : 'var(--color-text-secondary)', background: activeChip===chip.label ? '#2563EB' : 'var(--color-background-secondary)', border:`0.5px solid ${activeChip===chip.label?'#2563EB':'var(--color-border-secondary)'}`, boxShadow: activeChip===chip.label ? '0 0 8px #60A5FA50' : 'none', transition:'all .15s' }}>{chip.label}</button>
          ))}
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)', margin:'0 4px' }}>Custom:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setActiveChip('custom'); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>to</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setActiveChip('custom'); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
        </div>
        {/* Status + Stage + Owner filters */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)', fontWeight:500 }}>Status:</span>
          {['All','Completed','In Progress','Delayed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color: statusFilter===s ? '#fff' : 'var(--color-text-secondary)', background: statusFilter===s ? '#2563EB' : 'var(--color-background-secondary)', border:`0.5px solid ${statusFilter===s?'#2563EB':'var(--color-border-secondary)'}`, transition:'all .15s' }}>{s}</button>
          ))}
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)', fontWeight:500, marginLeft:8 }}>Stage:</span>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
            <option value="All">All stages</option>
            {adminOptions.seoStages.map(s => <option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)', fontWeight:500 }}>Owner:</span>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
            <option value="All">All owners</option>
            {adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* KPI strip — like Google Sheet header */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,minmax(0,1fr))', gap:8 }}>
        {[
          { label:'Total tasks', value:total, color:'#444' },
          { label:'Completed', value:completed, color:'#059669' },
          { label:'SEO (incl. blank)', value:seoTasks.length, color:'#2563EB' },
          { label:'Content', value:contentTasks.length, color:'#D97706' },
          { label:'Web', value:webTasks.length, color:'#1D9E75' },
          { label:'Est Hrs', value:`${estTotal.toFixed(1)}h`, color:'#444' },
          { label:'Actual Hrs', value:`${actualHrs.toFixed(1)}h`, color:'#444' },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 8px', textAlign:'center' }}>
            <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:600, marginBottom:3 }}>{s.label}</p>
            <p style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Stage mix bar */}
      {stageMix.length > 0 && (
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em', marginRight:4 }}>Stage mix →</span>
            {stageMix.map(([stage, count]) => (
              <span key={stage} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:500, background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', border:'0.5px solid var(--color-border-secondary)' }}>
                {stage}: <strong style={{ color:'var(--color-text-primary)' }}>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SEO Tasks table */}
      <SectionTable
        title="SEO Tasks" subtitle={`Current Owner = SEO or blank`} count={seoTasks.length}
        color="#185FA5" bg="#E6F1FB50" border="#B5D4F4"
        tasks={seoTasks} page={seoPage} perPage={seoPP} onPage={setSeoPage} onPerPage={setSeoPP}
        sortKey={seoSort} sortDir={seoDirr} onSort={(k) => handleSort(setSeoSort, setSeoDir, seoSort, seoDirr, k)}
        columns={<>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Task</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>SEO Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Stage</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>QC Status</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Curr. Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Days</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Est Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Actual</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap', borderBottom:'0.5px solid #B5D4F4' }}>Remarks</th>
        </>}
        renderRow={(t) => (
          <tr key={t.id} style={{ background: isDelayed(t) ? '#FEF2F210' : 'transparent' }} className="hover:brightness-95">
            <TD><div style={{ fontWeight:500, color:'var(--color-text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}{t.docUrl && <a href={t.docUrl} target="_blank" rel="noreferrer" style={{ marginLeft:5, color:'#185FA5' }}><ExternalLink size={10}/></a>}</div></TD>
            <TD>{t.seoOwner}</TD><TD>{t.seoStage}</TD>
            <TD>{t.seoQcStatus ? <NeonPill label={t.seoQcStatus==='Pending QC'||t.seoQcStatus==='QC'?'QC Submitted':t.seoQcStatus} size="xs"/> : '—'}</TD>
            <TD><span style={{ fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:99, color:'#0C447C', background:'#E6F1FB' }}>{t.currentOwner||'SEO'}</span></TD>
            <TD style={{ textAlign:'center', color: (t.daysInStage||0)>3 ? '#DC2626' : 'var(--color-text-secondary)' }}>{t.daysInStage||0}</TD>
            <TD style={{ textAlign:'center' }}>{t.estHoursSEO||t.estHours||'—'}</TD>
            <TD style={{ textAlign:'center' }}>{t.actualHours||'—'}</TD>
            <TD style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.remarks||'—'}</TD>
          </tr>
        )}
      />

      {/* Content Tasks table */}
      <SectionTable
        title="Content Tasks" subtitle="Current Owner = Content" count={contentTasks.length}
        color="#B45309" bg="#FFFBEB50" border="#FCD34D"
        tasks={contentTasks} page={conPage} perPage={conPP} onPage={setConPage} onPerPage={setConPP}
        sortKey={conSort} sortDir={conDir} onSort={(k) => handleSort(setConSort, setConDir, conSort, conDir, k)}
        columns={<>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Task</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>SEO Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Content Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Content Status</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Curr. Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Days</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Est Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Actual Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#FAEEDA', color:'#633806', whiteSpace:'nowrap', borderBottom:'0.5px solid #FAC775' }}>Remarks</th>
        </>}
        renderRow={(t) => (
          <tr key={t.id} className="hover:brightness-95">
            <TD><div style={{ fontWeight:500, color:'var(--color-text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}</div></TD>
            <TD>{t.seoOwner}</TD><TD style={{ color:'#B45309' }}>{t.contentOwner||'—'}</TD>
            <TD>{t.contentStatus ? <NeonPill label={t.contentStatus==='Pending QC'||t.contentStatus==='QC'?'QC Submitted':t.contentStatus} size="xs"/> : '—'}</TD>
            <TD><span style={{ fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:99, color:'#633806', background:'#FAEEDA' }}>Content</span></TD>
            <TD style={{ textAlign:'center' }}>{t.daysInStage||0}</TD>
            <TD style={{ textAlign:'center' }}>{t.estHoursContent||'—'}</TD>
            <TD style={{ textAlign:'center' }}>{t.actualHours||'—'}</TD>
            <TD style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.remarks||'—'}</TD>
          </tr>
        )}
      />

      {/* Web Tasks table */}
      <SectionTable
        title="Web Tasks" subtitle="Current Owner = Web" count={webTasks.length}
        color="#065F46" bg="#ECFDF550" border="#6EE7B7"
        tasks={webTasks} page={webPage} perPage={webPP} onPage={setWebPage} onPerPage={setWebPP}
        sortKey={webSort} sortDir={webDir} onSort={(k) => handleSort(setWebSort, setWebDir, webSort, webDir, k)}
        columns={<>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Task</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>SEO Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Web Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Web Status</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Days</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Est Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Actual Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#E1F5EE', color:'#085041', whiteSpace:'nowrap', borderBottom:'0.5px solid #9FE1CB' }}>Target URL</th>
        </>}
        renderRow={(t) => (
          <tr key={t.id} style={{ background: (t.daysInStage||0) > 0 && !t.targetUrl ? '#FFFBEB20' : 'transparent' }} className="hover:brightness-95">
            <TD><div style={{ fontWeight:500, color:'var(--color-text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}</div></TD>
            <TD>{t.seoOwner}</TD><TD style={{ color:'#065F46' }}>{t.webOwner||'—'}</TD>
            <TD>{t.webStatus ? <NeonPill label={t.webStatus==='Pending QC'?'QC Submitted':t.webStatus} size="xs"/> : '—'}</TD>
            <TD style={{ textAlign:'center', color:(t.daysInStage||0)>3?'#DC2626':'var(--color-text-secondary)' }}>{t.daysInStage||0}</TD>
            <TD style={{ textAlign:'center' }}>{t.estHoursWeb||'—'}</TD>
            <TD style={{ textAlign:'center' }}>{t.actualHours||'—'}</TD>
            <TD>{t.targetUrl ? <a href={t.targetUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#185FA5', display:'flex', alignItems:'center', gap:3, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}><ExternalLink size={10}/>{t.targetUrl}</a> : <span style={{ color:'#DC2626', fontSize:10 }}>Missing</span>}</TD>
          </tr>
        )}
      />

      {/* Completed Tasks — includes keyword data */}
      <SectionTable
        title="Completed Tasks" subtitle="Includes keyword ranking updates" count={doneTasks.length}
        color="#065F46" bg="#ECFDF550" border="#6EE7B7"
        tasks={doneTasks} page={donePage} perPage={donePP} onPage={setDonePage} onPerPage={setDonePP}
        defaultExpanded={false}
        sortKey={doneSort} sortDir={doneDir} onSort={(k) => handleSort(setDoneSort, setDoneDir, doneSort, doneDir, k)}
        columns={<>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Task</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>SEO Owner</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Web Status</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Actual Hrs</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Focused KW</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Volume</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Cur Rank</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Monthly Rank</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>% Change</th>
          <th style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', padding:'6px 9px', background:'#EAF3DE', color:'#27500A', whiteSpace:'nowrap', borderBottom:'0.5px solid #C0DD97' }}>Target URL</th>
        </>}
        renderRow={(t) => {
          const diff = t.marRank && t.currentRank ? t.marRank - t.currentRank : null;
          return (
            <tr key={t.id} className="hover:brightness-95">
              <TD><div style={{ fontWeight:500, color:'var(--color-text-primary)', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}</div></TD>
              <TD>{t.seoOwner}</TD>
              <TD>{t.webStatus ? <NeonPill label={t.webStatus} size="xs"/> : '—'}</TD>
              <TD style={{ textAlign:'center' }}>{t.actualHours||'—'}</TD>
              <TD style={{ maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.focusedKw||'—'}</TD>
              <TD style={{ textAlign:'center' }}>{t.volume?.toLocaleString()||'—'}</TD>
              <TD style={{ textAlign:'center' }}>{t.currentRank||'—'}</TD>
              <TD style={{ textAlign:'center' }}>{t.marRank||'—'}</TD>
              <TD style={{ textAlign:'center' }}>
                {diff !== null ? <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:99, color:diff>0?'#059669':'#DC2626', background:diff>0?'#ECFDF5':'#FEF2F2', border:`1px solid ${diff>0?'#05966930':'#DC262630'}` }}>{diff>0?`▲${diff}`:`▼${Math.abs(diff)}`}</span> : '—'}
              </TD>
              <TD>{t.targetUrl ? <a href={t.targetUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#185FA5', display:'flex', alignItems:'center', gap:3 }}><ExternalLink size={10}/>{t.targetUrl.replace('https://','').slice(0,30)}</a> : '—'}</TD>
            </tr>
          );
        }}
      />

      {/* Export section */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
        <p style={{ fontSize:10, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>Export client report — {activeChip}</p>
        <div style={{ background:'var(--color-background-secondary)', borderRadius:8, padding:12, marginBottom:12, fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.8, fontFamily:'var(--font-mono)' }}>
          Hi {selectedClient} team,{'\n\n'}
          SEO Update — {activeChip}:{'\n'}
          Completed: {completed} | In Progress: {inProgress} | QC Pending: {clientTasks.filter(t=>t.seoQcStatus==='Pending QC'||t.seoQcStatus==='QC').length}{'\n'}
          {kwTasks.filter(t=>t.marRank&&t.currentRank&&t.currentRank<t.marRank).length > 0 && `Keywords improving: ${kwTasks.filter(t=>t.marRank&&t.currentRank&&t.currentRank<t.marRank).map(t=>t.focusedKw).slice(0,3).join(', ')}`}
          {delayed > 0 && `\nDelayed: ${delayed} task${delayed>1?'s':''} being prioritised`}{'\n\n'}
          Regards, {clientTasks[0]?.seoOwner || 'SEO Team'}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={exportCSV} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #9FE1CB', color:'#065F46', background:'#ECFDF5', cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            Google Sheet (CSV)
          </button>
          <button onClick={exportPDF} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #FCA5A5', color:'#991B1B', background:'#FEF2F2', cursor:'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Download PDF
          </button>
          <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>CSV hides: est hours, time logs, doc URLs, owner names</span>
        </div>
      </div>
    </div>
  );
}
