import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { Task } from '../types';
import { Pencil, X, Upload, Check, Plus } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────
interface HistoricalKw {
  id: string;
  source: 'historical' | 'upload';
  date: string;
  client: string;
  seoOwner: string;
  taskTitle: string;
  focusedKw: string;
  volume: number;
  marRank?: number;
  currentRank?: number;
  targetUrl?: string;
}

const STORAGE_KEY = 'seo_historical_kw';

function loadHistorical(): HistoricalKw[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveHistorical(data: HistoricalKw[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Helper ───────────────────────────────────────────────────────────────
function NeonPill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, color, background:bg, border:`1px solid ${color}30`, whiteSpace:'nowrap' }}>{label}</span>;
}

function deltaLabel(marRank?: number, curRank?: number) {
  if (!marRank || !curRank) return null;
  const diff = marRank - curRank;
  if (diff > 0) return <NeonPill label={`▲ ${diff}`} color="#27500A" bg="#EAF3DE" />;
  if (diff < 0) return <NeonPill label={`▼ ${Math.abs(diff)}`} color="#791F1F" bg="#FCEBEB" />;
  return <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>—</span>;
}

function positionBand(rank?: number): string {
  if (!rank) return 'Unranked';
  if (rank <= 3) return 'Pos 1–3';
  if (rank <= 10) return 'Pos 4–10';
  if (rank <= 20) return 'Pos 11–20';
  if (rank <= 50) return 'Pos 21–50';
  return 'Pos 51+';
}

// ── Main Component ────────────────────────────────────────────────────────
export function KeywordReporting() {
  const { tasks, setTasks, adminOptions } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);

  // Historical/uploaded keyword records
  const [historical, setHistorical] = useState<HistoricalKw[]>(loadHistorical);
  const updateHistorical = (data: HistoricalKw[]) => { setHistorical(data); saveHistorical(data); };

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState('All');
  const [rankFilter, setRankFilter] = useState('All'); // 'All' | 'Improved' | 'Dropped' | 'Top 10' | 'Unranked' | 'No URL'
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<'date'|'curRank'|'volume'|'delta'>('date');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null); // "task:TASKID" or "hist:histId"
  const [editBuf, setEditBuf] = useState<Record<string, any>>({});

  // Upload state
  const [uploadPreview, setUploadPreview] = useState<HistoricalKw[] | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRow, setNewRow] = useState({ date: new Date().toISOString().split('T')[0], client: adminOptions.clients[0]||'', seoOwner: adminOptions.seoOwners[0]||'', taskTitle: '', focusedKw: '', volume: '', marRank: '', currentRank: '', targetUrl: '' });

  // Build unified rows from tasks + historical
  type KwRow = { id: string; source: 'task'|'historical'|'upload'; taskId?: string; date: string; client: string; seoOwner: string; taskTitle: string; focusedKw: string; volume?: number; marRank?: number; currentRank?: number; targetUrl?: string; };

  const taskRows: KwRow[] = useMemo(() => tasks.filter(t => t.focusedKw).map(t => ({
    id: `task:${t.id}`, source: 'task', taskId: t.id,
    date: t.intakeDate, client: t.client, seoOwner: t.seoOwner,
    taskTitle: t.title, focusedKw: t.focusedKw||'', volume: t.volume,
    marRank: t.marRank, currentRank: t.currentRank, targetUrl: t.targetUrl,
  })), [tasks]);

  const histRows: KwRow[] = historical.map(h => ({
    id: `hist:${h.id}`, source: h.source as any,
    date: h.date, client: h.client, seoOwner: h.seoOwner,
    taskTitle: h.taskTitle, focusedKw: h.focusedKw, volume: h.volume,
    marRank: h.marRank, currentRank: h.currentRank, targetUrl: h.targetUrl,
  }));

  const allRows: KwRow[] = [...taskRows, ...histRows];

  const filtered = useMemo(() => {
    let rows = allRows.filter(r => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (clientFilter !== 'All' && r.client !== clientFilter) return false;
      if (ownerFilter !== 'All' && r.seoOwner !== ownerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.focusedKw.toLowerCase().includes(q) && !r.client.toLowerCase().includes(q) && !r.taskTitle.toLowerCase().includes(q)) return false;
      }
      if (rankFilter === 'Improved' && (!r.marRank || !r.currentRank || r.currentRank >= r.marRank)) return false;
      if (rankFilter === 'Dropped' && (!r.marRank || !r.currentRank || r.currentRank <= r.marRank)) return false;
      if (rankFilter === 'Top 10' && (!r.currentRank || r.currentRank > 10)) return false;
      if (rankFilter === 'Unranked' && r.currentRank) return false;
      if (rankFilter === 'No URL' && r.targetUrl) return false;
      return true;
    });

    rows.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'date') { av = a.date; bv = b.date; }
      else if (sortKey === 'curRank') { av = a.currentRank||999; bv = b.currentRank||999; }
      else if (sortKey === 'volume') { av = a.volume||0; bv = b.volume||0; }
      else { av = (a.marRank&&a.currentRank) ? a.marRank-a.currentRank : -999; bv = (b.marRank&&b.currentRank) ? b.marRank-b.currentRank : -999; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [allRows, dateFrom, dateTo, clientFilter, ownerFilter, search, rankFilter, sortKey, sortDir]);

  const paginated = filtered.slice((page-1)*perPage, page*perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  // KPI counts
  const improved = allRows.filter(r => r.marRank && r.currentRank && r.currentRank < r.marRank).length;
  const dropped = allRows.filter(r => r.marRank && r.currentRank && r.currentRank > r.marRank).length;
  const top3 = allRows.filter(r => r.currentRank && r.currentRank <= 3).length;
  const top10 = allRows.filter(r => r.currentRank && r.currentRank <= 10).length;
  const unranked = allRows.filter(r => !r.currentRank).length;
  const bestMover = [...allRows].filter(r => r.marRank && r.currentRank && r.currentRank < r.marRank).sort((a,b) => (b.marRank!-b.currentRank!) - (a.marRank!-a.currentRank!))[0];

  // Position distribution
  const posDist = useMemo(() => {
    const m: Record<string,number> = { 'Pos 1–3':0, 'Pos 4–10':0, 'Pos 11–20':0, 'Pos 21–50':0, 'Unranked':0 };
    allRows.forEach(r => { const b = positionBand(r.currentRank); if (m[b]!==undefined) m[b]++; else m['Unranked']++; });
    return m;
  }, [allRows]);

  // Inline edit helpers
  const startEdit = (row: KwRow) => {
    setEditingId(row.id);
    setEditBuf({ date: row.date, client: row.client, seoOwner: row.seoOwner, taskTitle: row.taskTitle, focusedKw: row.focusedKw, volume: row.volume||'', marRank: row.marRank||'', currentRank: row.currentRank||'', targetUrl: row.targetUrl||'' });
  };

  const saveEdit = (row: KwRow) => {
    if (row.source === 'task' && row.taskId) {
      setTasks(prev => prev.map(t => t.id === row.taskId ? { ...t, focusedKw: editBuf.focusedKw, volume: Number(editBuf.volume)||t.volume, marRank: Number(editBuf.marRank)||t.marRank, currentRank: Number(editBuf.currentRank)||t.currentRank, targetUrl: editBuf.targetUrl||t.targetUrl } : t));
    } else {
      const histId = row.id.replace('hist:', '');
      const updated = historical.map(h => h.id === histId ? { ...h, date: editBuf.date, client: editBuf.client, seoOwner: editBuf.seoOwner, taskTitle: editBuf.taskTitle, focusedKw: editBuf.focusedKw, volume: Number(editBuf.volume)||0, marRank: Number(editBuf.marRank)||undefined, currentRank: Number(editBuf.currentRank)||undefined, targetUrl: editBuf.targetUrl||'' } : h);
      updateHistorical(updated);
    }
    setEditingId(null);
  };

  const deleteRow = (row: KwRow) => {
    if (row.source === 'historical' || row.source === 'upload') {
      const histId = row.id.replace('hist:', '');
      updateHistorical(historical.filter(h => h.id !== histId));
    }
  };

  // CSV Upload parser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { setUploadError('File appears empty or has no data rows'); return; }
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g,''));
      const getIdx = (...names: string[]) => { for (const n of names) { const i = headers.findIndex(h => h.includes(n)); if (i >= 0) return i; } return -1; };
      const iDate = getIdx('date','intake'); const iClient = getIdx('client'); const iKw = getIdx('keyword','kw','focused');
      const iVol = getIdx('volume','vol'); const iMar = getIdx('monthly rank','monthly','mar_rank','marrank');
      const iCur = getIdx('cur rank','current rank','cur_rank','currank'); const iUrl = getIdx('url','target');
      const iOwner = getIdx('owner','seo owner'); const iTitle = getIdx('task','title');
      if (iClient < 0 || iKw < 0) { setUploadError('CSV must have at least "Client" and "Keyword" columns'); return; }
      const rows: HistoricalKw[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g,''));
        const client = iClient >= 0 ? cols[iClient] : '';
        const kw = iKw >= 0 ? cols[iKw] : '';
        if (!client || !kw) continue;
        rows.push({
          id: `hist_${Date.now()}_${i}`,
          source: 'upload',
          date: iDate >= 0 ? cols[iDate] : new Date().toISOString().split('T')[0],
          client, seoOwner: iOwner >= 0 ? cols[iOwner] : '',
          taskTitle: iTitle >= 0 ? cols[iTitle] : '',
          focusedKw: kw,
          volume: iVol >= 0 ? Number(cols[iVol]?.replace(/[^0-9.]/g,''))||0 : 0,
          marRank: iMar >= 0 ? Number(cols[iMar])||undefined : undefined,
          currentRank: iCur >= 0 ? Number(cols[iCur])||undefined : undefined,
          targetUrl: iUrl >= 0 ? cols[iUrl] : '',
        });
      }
      if (rows.length === 0) { setUploadError('No valid rows found. Check column names.'); return; }
      setUploadPreview(rows);
    };
    reader.readAsText(file);
  };

  const confirmUpload = () => {
    if (!uploadPreview) return;
    updateHistorical([...historical, ...uploadPreview]);
    setUploadPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addManualRow = () => {
    if (!newRow.focusedKw || !newRow.client) return;
    const entry: HistoricalKw = {
      id: `hist_manual_${Date.now()}`,
      source: 'historical',
      date: newRow.date, client: newRow.client, seoOwner: newRow.seoOwner,
      taskTitle: newRow.taskTitle, focusedKw: newRow.focusedKw,
      volume: Number(newRow.volume)||0,
      marRank: Number(newRow.marRank)||undefined,
      currentRank: Number(newRow.currentRank)||undefined,
      targetUrl: newRow.targetUrl,
    };
    updateHistorical([...historical, entry]);
    setShowAddModal(false);
    setNewRow({ date: new Date().toISOString().split('T')[0], client: adminOptions.clients[0]||'', seoOwner: adminOptions.seoOwners[0]||'', taskTitle: '', focusedKw: '', volume: '', marRank: '', currentRank: '', targetUrl: '' });
  };

  const exportCSV = () => {
    const h = ['Date','Client','SEO Owner','Task','Keyword','Volume','Monthly Rank','Cur Rank','Delta','Target URL','Source'];
    const rows = filtered.map(r => {
      const diff = r.marRank && r.currentRank ? r.marRank - r.currentRank : '';
      return [r.date, r.client, r.seoOwner, `"${r.taskTitle.replace(/"/g,'""')}"`, `"${r.focusedKw.replace(/"/g,'""')}"`, r.volume||'', r.marRank||'', r.currentRank||'', diff ? (Number(diff)>0?`+${diff}`:String(diff)) : '', r.targetUrl||'', r.source].join(',');
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([[h.join(','),...rows].join('\n')],{type:'text/csv'}));
    a.download = `keywords-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  const handleSort = (k: typeof sortKey) => { if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortKey(k); setSortDir('asc'); } setPage(1); };

  const SortTH = ({ children, sk, style={} }: { children: React.ReactNode; sk?: typeof sortKey; style?: React.CSSProperties }) => (
    <th onClick={sk ? () => handleSort(sk) : undefined}
      style={{ fontSize:9, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em', padding:'6px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', whiteSpace:'nowrap', textAlign:'left', cursor:sk?'pointer':'default', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)', userSelect:'none', ...style }}>
      {children}{sk && sortKey===sk && (sortDir==='asc'?' ▲':' ▼')}
    </th>
  );
  const TD = ({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <td style={{ fontSize:11, padding:'6px 9px', borderBottom:'0.5px solid var(--color-border-tertiary)', verticalAlign:'middle', color:'var(--color-text-secondary)', ...style }}>{children}</td>
  );
  const inp = (field: string, type='text', placeholder='') => (
    <input type={type} value={editBuf[field]||''} placeholder={placeholder}
      onChange={e => setEditBuf(b => ({...b, [field]: e.target.value}))}
      style={{ width:'100%', fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:4, padding:'2px 5px', background:'var(--color-background-primary)', color:'var(--color-text-primary)' }} />
  );

  return (
    <div className="space-y-3">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontSize:18, fontWeight:500, color:'var(--color-text-primary)' }}>Keyword Reporting</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowAddModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'var(--color-background-primary)', cursor:'pointer' }}>
            <Plus size={13} /> Add keyword
          </button>
          <button onClick={() => {
            const h = 'Date,Client,SEO Owner,Task,Keyword,Volume,Monthly Rank,Cur Rank,Target URL\n2026-01-15,KPSol,Imran,Inconel Page Opt,Inconel 825 pipes,1200,45,38,https://kpsol.com/inconel';
            const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([h],{type:'text/csv'})); a.download='keyword-upload-template.csv'; a.click();
          }} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'var(--color-background-primary)', cursor:'pointer' }}>
            ↓ Template
          </button>
          <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #185FA540', color:'#0C447C', background:'#E6F1FB', cursor:'pointer' }}>
            <Upload size={13} /> Upload CSV
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display:'none' }} />
          </label>
          <button onClick={exportCSV} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Upload preview */}
      {uploadPreview && (
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid #185FA540', borderRadius:10, padding:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, fontWeight:500, color:'#0C447C' }}>Upload preview — {uploadPreview.length} rows found</span>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={confirmUpload} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:7, fontSize:11, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}><Check size={12}/>Confirm import</button>
              <button onClick={() => { setUploadPreview(null); if (fileRef.current) fileRef.current.value=''; }} style={{ padding:'5px 10px', borderRadius:7, fontSize:11, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
          <div style={{ fontSize:10, color:'var(--color-text-tertiary)', marginBottom:6 }}>First 5 rows:</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {uploadPreview.slice(0,5).map((r,i) => (
              <div key={i} style={{ background:'var(--color-background-secondary)', borderRadius:6, padding:'4px 8px', fontSize:10, color:'var(--color-text-secondary)' }}>
                {r.client} · {r.focusedKw} · {r.date}
              </div>
            ))}
          </div>
        </div>
      )}
      {uploadError && <div style={{ padding:'8px 12px', borderRadius:8, background:'#FCEBEB', color:'#791F1F', fontSize:12 }}>{uploadError}</div>}

      {/* ── ALL STATS + INSIGHTS in one compact capsule strip ── */}
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'8px 12px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
          {/* Stat capsules */}
          {[
            { l:'Total KWs', v: allRows.length, c:'#444441', bg:'#F1EFE8' },
            { l:'Pos 1–3', v: top3, c:'#27500A', bg:'#EAF3DE' },
            { l:'Pos 4–10', v: top10-top3, c:'#0C447C', bg:'#E6F1FB' },
            { l:'Improved', v: improved, c:'#27500A', bg:'#EAF3DE' },
            { l:'Dropped', v: dropped, c:'#791F1F', bg:'#FCEBEB' },
            { l:'Unranked', v: unranked, c:'#888780', bg:'#F1EFE8' },
          ].map(s => (
            <span key={s.l} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:99, fontSize:12, fontWeight:500, color:s.c, background:s.bg, border:`1px solid ${s.c}30`, whiteSpace:'nowrap' }}>
              <span style={{ fontSize:10, fontWeight:400, opacity:.8 }}>{s.l}</span>
              <strong style={{ fontSize:15, fontWeight:600 }}>{s.v}</strong>
            </span>
          ))}

          {/* Position mini-bars */}
          <span style={{ width:'0.5px', height:28, background:'var(--color-border-tertiary)', margin:'0 4px', display:'inline-block' }} />
          {[['1–3','#27500A'],['4–10','#0C447C'],['11–20','#854F0B'],['21–50','#534AB7']].map(([l,c]) => (
            <span key={l} title={`Pos ${l}: ${posDist[`Pos ${l}`]||0}`} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 0', cursor:'default' }}>
              <span style={{ width:Math.max(4, Math.round(((posDist[`Pos ${l}`]||0)/Math.max(1,allRows.length))*56)), height:6, borderRadius:3, background:c, display:'inline-block', minWidth:4 }} />
              <span style={{ fontSize:9, color:c, fontWeight:500 }}>{posDist[`Pos ${l}`]||0}</span>
            </span>
          ))}

          {/* Insight capsules */}
          <span style={{ width:'0.5px', height:28, background:'var(--color-border-tertiary)', margin:'0 4px', display:'inline-block' }} />
          {bestMover && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#633806', background:'#FAEEDA', border:'1px solid #854F0B30', whiteSpace:'nowrap' }}>🔥 Best: {bestMover.focusedKw} (+{(bestMover.marRank||0)-(bestMover.currentRank||0)})</span>}
          {improved > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#27500A', background:'#EAF3DE', border:'1px solid #3B6D1130', whiteSpace:'nowrap' }}>▲ {improved} moved up this period</span>}
          {dropped > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#791F1F', background:'#FCEBEB', border:'1px solid #A32D2D30', whiteSpace:'nowrap' }}>▼ {dropped} dropped — review needed</span>}
          {top3 > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#27500A', background:'#EAF3DE', border:'1px solid #3B6D1130', whiteSpace:'nowrap' }}>🏆 {top3} in top 3 positions</span>}
          {top10 > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#085041', background:'#E1F5EE', border:'1px solid #0F6E5630', whiteSpace:'nowrap' }}>📄 {top10} on page 1 (≤10)</span>}
          {unranked > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#888780', background:'#F1EFE8', border:'1px solid #88878030', whiteSpace:'nowrap' }}>⊘ {unranked} not yet ranked</span>}
          {(() => { const noUrl = allRows.filter(r => !r.targetUrl).length; return noUrl > 0 ? <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#DC2626', background:'#FEF2F2', border:'1px solid #DC262630', whiteSpace:'nowrap' }}>🔗 {noUrl} missing target URL</span> : null; })()}
          {historical.length > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'5px 11px', borderRadius:99, fontSize:11, fontWeight:500, color:'#3C3489', background:'#EEEDFE', border:'1px solid #534AB730', whiteSpace:'nowrap' }}>📊 {historical.length} historical records</span>}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
          <div style={{ flex:2, minWidth:140, display:'flex', alignItems:'center', gap:6, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'5px 9px' }}>
            <span style={{ fontSize:12, color:'var(--color-text-tertiary)' }}>🔍</span>
            <input type="text" placeholder="Search keyword, client, task..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ flex:1, fontSize:11, border:'none', background:'transparent', color:'var(--color-text-primary)', outline:'none' }} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>–</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" />
          </div>
          <select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
            <option value="All">All Clients</option>
            {adminOptions.clients.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setPage(1); }} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
            <option value="All">All Owners</option>
            {adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em', marginRight:4 }}>Quick:</span>
          {[['All','var(--color-text-secondary)','var(--color-background-secondary)'],['Improved','#27500A','#EAF3DE'],['Dropped','#791F1F','#FCEBEB'],['Top 10','#0C447C','#E6F1FB'],['Unranked','#444441','#F1EFE8'],['No URL','#633806','#FAEEDA']].map(([k,c,bg]) => (
            <button key={k} onClick={() => { setRankFilter(k); setPage(1); }}
              style={{ padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:500, cursor:'pointer', color:rankFilter===k?'#fff':c, background:rankFilter===k?c:bg, border:`0.5px solid ${c}40`, transition:'all .15s' }}>{k}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)', flexWrap:'wrap', gap:6 }}>
          <span style={{ fontSize:10, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em' }}>
            {filtered.length} keywords · showing {Math.min((page-1)*perPage+1, filtered.length)}–{Math.min(page*perPage, filtered.length)}
          </span>
          <div style={{ display:'flex', gap:4, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'var(--color-text-tertiary)' }}>Per page:</span>
            {[10,25,50,100].map(n => (
              <button key={n} onClick={() => { setPerPage(n); setPage(1); }} style={{ padding:'2px 7px', borderRadius:5, fontSize:9, fontWeight:500, border:`0.5px solid ${perPage===n?'#185FA5':'var(--color-border-secondary)'}`, color:perPage===n?'#0C447C':'var(--color-text-secondary)', background:perPage===n?'#E6F1FB':'transparent', cursor:'pointer' }}>{n}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX:'auto', maxHeight:680 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:860 }}>
            <thead style={{ position:'sticky', top:0, zIndex:10 }}>
              <tr>
                <SortTH sk="date">Date</SortTH>
                <SortTH>Client</SortTH>
                <SortTH>SEO Owner</SortTH>
                <SortTH style={{ minWidth:150 }}>Task</SortTH>
                <SortTH style={{ minWidth:160 }}>Keyword</SortTH>
                <SortTH sk="volume" style={{ textAlign:'center' }}>Volume</SortTH>
                <SortTH style={{ textAlign:'center' }}>Monthly Rank</SortTH>
                <SortTH sk="curRank" style={{ textAlign:'center' }}>Cur rank</SortTH>
                <SortTH sk="delta" style={{ textAlign:'center' }}>Delta</SortTH>
                <SortTH>Target URL</SortTH>
                <SortTH>Source</SortTH>
                <SortTH>Edit</SortTH>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={12} style={{ padding:24, textAlign:'center', color:'var(--color-text-tertiary)', fontSize:12, fontStyle:'italic' }}>No keyword data matches filters</td></tr>
              ) : paginated.map(row => {
                const isEditing = editingId === row.id;
                const diff = row.marRank && row.currentRank ? row.marRank - row.currentRank : null;
                return (
                  <tr key={row.id} style={{ background: diff !== null && diff < 0 ? '#FCEBEB10' : 'transparent' }} className="hover:brightness-95">
                    <TD>{isEditing ? inp('date','date') : <span style={{ fontSize:10, color:'var(--color-text-tertiary)' }}>{row.date}</span>}</TD>
                    <TD>{isEditing ? (
                      <select value={editBuf.client||''} onChange={e => setEditBuf(b=>({...b,client:e.target.value}))} style={{ fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:4, padding:'2px 4px' }}>
                        {adminOptions.clients.map(c => <option key={c}>{c}</option>)}
                      </select>
                    ) : <span style={{ fontWeight:500, color:'var(--color-text-primary)' }}>{row.client}</span>}</TD>
                    <TD>{isEditing ? (
                      <select value={editBuf.seoOwner||''} onChange={e => setEditBuf(b=>({...b,seoOwner:e.target.value}))} style={{ fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:4, padding:'2px 4px' }}>
                        {adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : row.seoOwner}</TD>
                    <TD style={{ maxWidth:160 }}>{isEditing ? inp('taskTitle') : <span style={{ display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:10, color:'var(--color-text-secondary)' }} title={row.taskTitle}>{row.taskTitle||'—'}</span>}</TD>
                    <TD>{isEditing ? inp('focusedKw') : <span style={{ fontWeight:500, color:'var(--color-text-primary)' }}>{row.focusedKw}</span>}</TD>
                    <TD style={{ textAlign:'center' }}>{isEditing ? inp('volume','number') : row.volume?.toLocaleString()||'—'}</TD>
                    <TD style={{ textAlign:'center', color:'var(--color-text-tertiary)' }}>{isEditing ? inp('marRank','number') : row.marRank||'—'}</TD>
                    <TD style={{ textAlign:'center', fontWeight:500, color: diff !== null ? (diff > 0 ? '#27500A' : '#791F1F') : 'var(--color-text-secondary)' }}>
                      {isEditing ? inp('currentRank','number') : row.currentRank||'—'}
                    </TD>
                    <TD style={{ textAlign:'center' }}>{isEditing ? null : deltaLabel(row.marRank, row.currentRank) || '—'}</TD>
                    <TD>{isEditing ? inp('targetUrl','url') : row.targetUrl ? <a href={row.targetUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#185FA5', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:120 }}>{row.targetUrl.replace('https://','').slice(0,30)}</a> : <span style={{ fontSize:10, color: '#DC2626' }}>Missing</span>}</TD>
                    <TD>
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, fontWeight:500, color: row.source==='task'?'#0C447C':row.source==='upload'?'#3C3489':'#633806', background: row.source==='task'?'#E6F1FB':row.source==='upload'?'#EEEDFE':'#FAEEDA' }}>
                        {row.source === 'task' ? 'Live' : row.source === 'upload' ? 'Uploaded' : 'Historical'}
                      </span>
                    </TD>
                    <TD>
                      {isEditing ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => saveEdit(row)} style={{ padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{ padding:'2px 7px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={() => startEdit(row)} style={{ padding:'3px 7px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3 }}>
                            <Pencil size={10} /> Edit
                          </button>
                          {row.source !== 'task' && (
                            <button onClick={() => deleteRow(row)} style={{ padding:'3px 6px', borderRadius:5, fontSize:10, border:'0.5px solid #A32D2D30', color:'#791F1F', background:'#FCEBEB', cursor:'pointer' }}>
                              <X size={10}/>
                            </button>
                          )}
                        </div>
                      )}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display:'flex', alignItems:'center', gap:4, padding:'10px 14px', borderTop:'0.5px solid var(--color-border-tertiary)', flexWrap:'wrap' }}>
            <span style={{ fontSize:10, color:'var(--color-text-tertiary)', marginRight:6 }}>{(page-1)*perPage+1}–{Math.min(page*perPage, filtered.length)} of {filtered.length}</span>
            <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ width:26, height:26, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>‹</button>
            {(() => {
              const pages: (number|'...')[] = [];
              if (totalPages <= 7) { for(let i=1;i<=totalPages;i++) pages.push(i); }
              else { pages.push(1); if(page>3) pages.push('...'); for(let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i); if(page<totalPages-2) pages.push('...'); pages.push(totalPages); }
              return pages.map((p,i) => p==='...' ? <span key={`e${i}`} style={{fontSize:11,color:'var(--color-text-tertiary)',padding:'0 2px'}}>…</span> : <button key={p} onClick={()=>setPage(p as number)} style={{width:26,height:26,borderRadius:6,border:`0.5px solid ${page===p?'#185FA5':'var(--color-border-secondary)'}`,fontSize:10,fontWeight:500,cursor:'pointer',background:page===p?'#185FA5':'transparent',color:page===p?'#fff':'var(--color-text-secondary)'}}>{p}</button>);
            })()}
            <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ width:26, height:26, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color:'var(--color-text-secondary)' }}>›</button>
          </div>
        )}
      </div>

      {/* Add manual row modal */}
      {showAddModal && (
        <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Add keyword entry</h3>
              <button onClick={() => setShowAddModal(false)}><X size={16} className="text-zinc-400" /></button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {[['Date','date','date'],['Task title','taskTitle','text'],['Keyword ★','focusedKw','text'],['Target URL','targetUrl','url']].map(([label,field,type]) => (
                <div key={field}><label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
                  <input type={type} value={(newRow as any)[field]||''} onChange={e => setNewRow(r=>({...r,[field]:e.target.value}))} className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-medium text-zinc-500 mb-1">Client ★</label>
                  <select value={newRow.client} onChange={e => setNewRow(r=>({...r,client:e.target.value}))} className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs">
                    {adminOptions.clients.map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <div><label className="block text-[10px] font-medium text-zinc-500 mb-1">SEO Owner</label>
                  <select value={newRow.seoOwner} onChange={e => setNewRow(r=>({...r,seoOwner:e.target.value}))} className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs">
                    {adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[['Volume','volume'],['Monthly Rank','marRank'],['Cur Rank','currentRank']].map(([label,field]) => (
                  <div key={field}><label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
                    <input type="number" value={(newRow as any)[field]||''} onChange={e => setNewRow(r=>({...r,[field]:e.target.value}))} className="w-full border border-zinc-200 rounded-lg px-2 py-1.5 text-xs" /></div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-zinc-100 flex gap-3 justify-end">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs text-zinc-600">Cancel</button>
              <button onClick={addManualRow} disabled={!newRow.focusedKw || !newRow.client} className="px-5 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Add entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
