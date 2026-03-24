import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { useAllOwners } from '../hooks/useAllOwners';
import { Task, DeptType } from '../types';
import { X, Plus, Pencil, ExternalLink, Check, ChevronDown, ChevronUp, Play, Clock, RotateCcw, AlertCircle } from 'lucide-react';
import { calcTaskOverrunMsLegacy as calcTaskOverrunMs, getTaskEstHours, msToHrs } from '../utils/productiveHours';

// ── Config ────────────────────────────────────────────────────────────────
const DEPT_CONFIG: Record<DeptType, { color:string; bg:string; border:string; icon:string }> = {
  'SEO':          { color:'#0C447C', bg:'#E6F1FB', border:'#B5D4F4', icon:'🔍' },
  'Social Media': { color:'#9D174D', bg:'#FDF2F8', border:'#FBCFE8', icon:'📱' },
  'Design':       { color:'#6D28D9', bg:'#F5F3FF', border:'#DDD6FE', icon:'🎨' },
  'Ads':          { color:'#92400E', bg:'#FFFBEB', border:'#FDE68A', icon:'📢' },
  'Web Dev':      { color:'#064E3B', bg:'#ECFDF5', border:'#A7F3D0', icon:'⚙' },
};
const STATUS_CONFIG: Record<string, { color:string; bg:string }> = {
  'Not Started':     { color:'#888780', bg:'#F1EFE8' },
  'In Progress':     { color:'#2563EB', bg:'#EFF6FF' },
  'Paused':          { color:'#D97706', bg:'#FFFBEB' },
  'Client Approval': { color:'#7C3AED', bg:'#F5F3FF' },
  'Rework':          { color:'#DC2626', bg:'#FEF2F2' },
  'Approved':        { color:'#059669', bg:'#ECFDF5' },
  'Completed':       { color:'#059669', bg:'#ECFDF5' },
  'Delayed':         { color:'#DC2626', bg:'#FEF2F2' },
};
const REMARKS_KEY = 'seo_workhub_remarks';
type TaskRemark = { id:string; taskId:string; author:string; text:string; timestamp:string; type:'note'|'rework'|'approval' };
function loadRemarks(): TaskRemark[] { try { return JSON.parse(localStorage.getItem(REMARKS_KEY)||'[]'); } catch { return []; } }
function saveRemarks(d: TaskRemark[]) { localStorage.setItem(REMARKS_KEY, JSON.stringify(d)); }

const NON_SEO_DEPTS: DeptType[] = ['Social Media','Design','Ads','Web Dev'];
// ── Doc icon detector ─────────────────────────────────────────────────────
function docIcon(url: string): { icon: string; label: string; color: string } {
  const u = (url||'').toLowerCase();
  if (u.includes('docs.google.com/spreadsheets') || u.includes('sheet')) return { icon:'📊', label:'Google Sheet', color:'#1a73e8' };
  if (u.includes('docs.google.com/document')) return { icon:'📄', label:'Google Doc', color:'#1a73e8' };
  if (u.includes('docs.google.com/presentation') || u.includes('slides')) return { icon:'📽', label:'Slides', color:'#fbbc04' };
  if (u.includes('drive.google.com') || u.includes('docs.google')) return { icon:'🗂', label:'Drive', color:'#1a73e8' };
  if (u.includes('.xlsx') || u.includes('.xls') || u.includes('excel')) return { icon:'📗', label:'Excel', color:'#217346' };
  if (u.includes('.docx') || u.includes('.doc')) return { icon:'📘', label:'Word', color:'#2b579a' };
  if (u.includes('.pptx') || u.includes('.ppt')) return { icon:'📙', label:'PowerPoint', color:'#d24726' };
  if (u.includes('.pdf')) return { icon:'📕', label:'PDF', color:'#e53e3e' };
  if (u.includes('notion')) return { icon:'◻', label:'Notion', color:'#000' };
  if (u.includes('figma')) return { icon:'🖼', label:'Figma', color:'#a259ff' };
  if (u.includes('canva')) return { icon:'🎨', label:'Canva', color:'#00c4cc' };
  return { icon:'🔗', label:'Link', color:'#185FA5' };
}

function DocLink({ url, label }: { url:string; label:string }) {
  const { icon, label: typeLabel, color } = docIcon(url);
  return (
    <a href={url} target="_blank" rel="noreferrer"
      style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:500, color, background:`${color}10`, border:`0.5px solid ${color}30`, textDecoration:'none', whiteSpace:'nowrap', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis' }}
      title={url}>
      <span style={{ fontSize:13 }}>{icon}</span>{label||typeLabel}
    </a>
  );
}

function StatusPill({ status }: { status:string }) {
  const s = STATUS_CONFIG[status] || { color:'#444', bg:'#F1F5F9' };
  return <span style={{ display:'inline-flex', padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600, color:s.color, background:s.bg, border:`1px solid ${s.color}30`, whiteSpace:'nowrap' }}>{status}</span>;
}
function DeptTag({ dept }: { dept:DeptType }) {
  const d = DEPT_CONFIG[dept];
  return <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, fontSize:10, fontWeight:500, color:d.color, background:d.bg, border:`1px solid ${d.border}`, whiteSpace:'nowrap' }}>{d.icon} {dept}</span>;
}

function fmtMs(ms: number) {
  if (!ms || ms < 0) return '0m';
  const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
  return h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${m}m`;
}

// ── Time history panel ─────────────────────────────────────────────────────
function calcActualHours(events: any[]): number {
  let ms = 0; let lastStart: number | null = null;
  for (const e of (events||[])) {
    const ts = new Date(e.timestamp).getTime();
    if (e.type==='start'||e.type==='resume'||e.type==='rework_start') lastStart = ts;
    else if ((e.type==='pause'||e.type==='end') && lastStart) { ms += ts - lastStart; lastStart = null; }
  }
  return Math.round((ms/3600000)*100)/100;
}

function TimeHistoryPanel({ task, onClose, onRework, onApprove, remarks, onAddRemark, onDeleteRemark, currentUser }: { task:Task; onClose:()=>void; onRework:(note:string)=>void; onApprove:()=>void; remarks:TaskRemark[]; onAddRemark:(text:string,type:TaskRemark['type'])=>void; onDeleteRemark:(id:string)=>void; currentUser:any }) {
  const [reworkNote, setReworkNote] = useState('');
  const [showRework, setShowRework] = useState(false);

  const events = task.timeEvents || [];
  const totalMs = events.reduce((acc, e, i, arr) => {
    if (e.type === 'start' || e.type === 'resume' || e.type === 'rework_start') {
      const next = arr.slice(i+1).find(n => n.type === 'pause' || n.type === 'end');
      if (next) return acc + new Date(next.timestamp).getTime() - new Date(e.timestamp).getTime();
    }
    return acc;
  }, 0);

  const eventLabel: Record<string, { label:string; color:string }> = {
    start:        { label:'Started',         color:'#2563EB' },
    resume:       { label:'Resumed',         color:'#2563EB' },
    pause:        { label:'Paused',          color:'#D97706' },
    end:          { label:'Submitted / Ended', color:'#059669' },
    rework_start: { label:'Rework started',  color:'#DC2626' },
  };

  const reworkEntries = task.reworkEntries || [];

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, width:'100vw', height:'100vh', zIndex:2147483647, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.55)' }}>
      <div style={{ background:'#ffffff', borderRadius:16, width:'100%', maxWidth:500, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.35)', position:'relative', zIndex:2147483647 }}>
        <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', gap:8 }}>
          <Clock size={15} style={{ color:'#185FA5' }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:500, color:'#111827' }}>{task.title}</div>
            <div style={{ fontSize:10, color:'#9ca3af' }}>{task.client} · {task.deptType}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}><X size={16}/></button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 18px' }}>

          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              { l:'Total logged', v:fmtMs(totalMs), c:'#185FA5' },
              { l:'Est hours', v:`${task.estHours||0}h`, c:'#111827' },
              { l:'Rework count', v:String(reworkEntries.length), c:reworkEntries.length>0?'#DC2626':'#9ca3af' },
            ].map(s => (
              <div key={s.l} style={{ background:'#f8f9fa', borderRadius:8, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', marginBottom:3 }}>{s.l}</div>
                <div style={{ fontSize:16, fontWeight:600, color:s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
            {(task.executionState === 'Client Approval') && (
              <>
                <button onClick={onApprove} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:500, border:'0.5px solid #05966960', color:'#059669', background:'#ECFDF5', cursor:'pointer' }}>
                  <Check size={12}/> Mark Approved
                </button>
                <button onClick={() => setShowRework(s=>!s)} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:500, border:'0.5px solid #DC262660', color:'#DC2626', background:'#FEF2F2', cursor:'pointer' }}>
                  <RotateCcw size={12}/> Send Rework
                </button>
              </>
            )}
          </div>

          {/* Rework input */}
          {showRework && (
            <div style={{ background:'#FEF2F2', border:'0.5px solid #DC262640', borderRadius:8, padding:10, marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:500, color:'#DC2626', marginBottom:6 }}>Rework note (what needs fixing)</div>
              <textarea rows={2} value={reworkNote} onChange={e=>setReworkNote(e.target.value)} placeholder="e.g. Caption needs update, change CTA colour..." style={{ width:'100%', fontSize:11, border:'0.5px solid #DC262640', borderRadius:6, padding:'6px 8px', resize:'none', background:'#ffffff' }} />
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <button onClick={() => { onRework(reworkNote); setShowRework(false); setReworkNote(''); }} style={{ padding:'4px 12px', borderRadius:6, fontSize:11, fontWeight:500, border:'none', color:'#fff', background:'#DC2626', cursor:'pointer' }}>Send Rework</button>
                <button onClick={() => setShowRework(false)} style={{ padding:'4px 10px', borderRadius:6, fontSize:11, border:'0.5px solid var(--color-border-secondary)', color:'#4b5563', background:'transparent', cursor:'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Rework entries */}
          {reworkEntries.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 }}>Rework history</div>
              {reworkEntries.map((r,i) => (
                <div key={r.id} style={{ background:'#FEF2F210', border:'0.5px solid #DC262630', borderRadius:7, padding:'7px 10px', marginBottom:5, fontSize:11 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontWeight:500, color:'#DC2626' }}>Rework #{i+1}</span>
                    <span style={{ color:'#9ca3af', fontSize:10 }}>{r.date}</span>
                  </div>
                  {r.startTimestamp && <div style={{ fontSize:10, color:'#9ca3af' }}>Started: {new Date(r.startTimestamp).toLocaleString()}</div>}
                  {r.endTimestamp && <div style={{ fontSize:10, color:'#9ca3af' }}>Ended: {new Date(r.endTimestamp).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Time events */}
          <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:6 }}>Time log</div>
          {events.length === 0 ? (
            <div style={{ fontSize:11, color:'#9ca3af', fontStyle:'italic', padding:'10px 0' }}>No time events recorded yet</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {[...events].reverse().map((e,i) => {
                const ev = eventLabel[e.type] || { label:e.type, color:'#888' };
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', borderRadius:6, background:'#f8f9fa' }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:ev.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, fontWeight:500, color:ev.color, width:120 }}>{ev.label}</span>
                    <span style={{ fontSize:10, color:'#9ca3af' }}>{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remarks thread */}
          <RemarkThread taskId={task.id} remarks={remarks} onAdd={onAddRemark} onDelete={onDeleteRemark} currentUser={currentUser}/>
        </div>
      </div>
    </div>
  );
}

function RemarkThread({ taskId, remarks, onAdd, onDelete, currentUser }: { taskId:string; remarks:TaskRemark[]; onAdd:(text:string,type:TaskRemark['type'])=>void; onDelete:(id:string)=>void; currentUser:any }) {
  const [text, setText] = React.useState('');
  const taskRemarks = remarks.filter(r=>r.taskId===taskId);
  const typeColor: Record<string,{c:string;bg:string}> = {
    note:     { c:'#185FA5', bg:'#E6F1FB' },
    rework:   { c:'#DC2626', bg:'#FEF2F2' },
    approval: { c:'#059669', bg:'#ECFDF5' },
  };
  return (
    <div style={{ marginTop:14 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:8 }}>Remarks ({taskRemarks.length})</div>
      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={2} placeholder="Add a remark, note, or feedback..." style={{ flex:1, fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'6px 9px', resize:'none', background:'#ffffff', color:'#111827' }}/>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          <button onClick={()=>{onAdd(text,'note');setText('');}} disabled={!text.trim()} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:500, border:'0.5px solid #185FA540', color:'#185FA5', background:'#E6F1FB', cursor:'pointer', opacity:text.trim()?1:.4 }}>Note</button>
          <button onClick={()=>{onAdd(text,'approval');setText('');}} disabled={!text.trim()} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:500, border:'0.5px solid #05966940', color:'#059669', background:'#ECFDF5', cursor:'pointer', opacity:text.trim()?1:.4 }}>Approved</button>
          <button onClick={()=>{onAdd(text,'rework');setText('');}} disabled={!text.trim()} style={{ padding:'5px 10px', borderRadius:6, fontSize:10, fontWeight:500, border:'0.5px solid #DC262640', color:'#DC2626', background:'#FEF2F2', cursor:'pointer', opacity:text.trim()?1:.4 }}>Rework</button>
        </div>
      </div>
      {taskRemarks.length === 0
        ? <div style={{ fontSize:11, color:'#9ca3af', fontStyle:'italic' }}>No remarks yet</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {taskRemarks.map(r => {
              const tc = typeColor[r.type]||typeColor.note;
              return (
                <div key={r.id} style={{ padding:'8px 10px', borderRadius:8, background:'#f8f9fa', borderLeft:`3px solid ${tc.c}` }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:'#111827' }}>{r.author}</span>
                      <span style={{ fontSize:9, padding:'1px 6px', borderRadius:99, fontWeight:500, color:tc.c, background:tc.bg }}>{r.type}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:9, color:'#9ca3af' }}>{new Date(r.timestamp).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                      {(currentUser?.role==='admin'||currentUser?.name===r.author) && <button onClick={()=>onDelete(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:10, padding:0 }}>✕</button>}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#4b5563', lineHeight:1.5 }}>{r.text}</div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function WorkHub() {
  const { tasks, setTasks, adminOptions, currentUser, isAdmin, users } = useAppContext();
  const today = new Date().toISOString().split('T')[0];

  // Date range — default today
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [activeChip, setActiveChip] = useState('today');

  // Filters
  const [deptFilter, setDeptFilter] = useState<DeptType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState(() => !isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [remarks, setRemarks] = useState<TaskRemark[]>(loadRemarks);
  const addRemark = (taskId:string, text:string, type:TaskRemark['type']='note') => {
    if (!text.trim()) return;
    const entry: TaskRemark = { id:`rm_${Date.now()}`, taskId, author:currentUser?.name||'Admin', text:text.trim(), timestamp:new Date().toISOString(), type };
    const updated = [entry, ...remarks];
    setRemarks(updated); saveRemarks(updated);
  };
  const deleteRemark = (id:string) => { const u = remarks.filter(r=>r.id!==id); setRemarks(u); saveRemarks(u); };
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const getRange = (key: string) => {
    const n = new Date();
    const pad = (d: Date) => d.toISOString().split('T')[0];
    if (key === 'today') return { from: pad(n), to: pad(n) };
    if (key === 'week') {
      const mon = new Date(n); mon.setDate(n.getDate()-((n.getDay()+6)%7));
      return { from: pad(mon), to: pad(new Date(mon.getTime()+6*86400000)) };
    }
    if (key === 'month') return { from: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`, to: pad(new Date(n.getFullYear(),n.getMonth()+1,0)) };
    return { from:'', to:'' };
  };

  const setChip = (key: string) => {
    const r = getRange(key);
    setDateFrom(r.from); setDateTo(r.to); setActiveChip(key); setPage(1);
  };

  const workTasks = useMemo(() => tasks.filter(t => t.deptType && t.deptType !== 'SEO'), [tasks]);

  const filtered = useMemo(() => workTasks.filter(t => {
    if (dateFrom || dateTo) {
      const d = t.intakeDate || '';
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
    if (deptFilter !== 'All' && t.deptType !== deptFilter) return false;
    if (clientFilter !== 'All' && t.client !== clientFilter) return false;
    if (ownerFilter !== 'All' && t.assignedTo !== ownerFilter && t.seoOwner !== ownerFilter) return false;
    if (statusFilter !== 'All') {
      const s = t.isCompleted ? 'Completed' : (t.executionState || 'Not Started');
      if (s !== statusFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.client.toLowerCase().includes(q) && !(t.taskType||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [workTasks, dateFrom, dateTo, deptFilter, clientFilter, ownerFilter, statusFilter, search]);

  const paginated = filtered.slice((page-1)*perPage, page*perPage);

  const statusCounts = useMemo(() => {
    const m: Record<string,number> = {};
    filtered.forEach(t => { const s = t.isCompleted?'Completed':(t.executionState||'Not Started'); m[s]=(m[s]||0)+1; });
    return m;
  }, [filtered]);

  // Dept-aware insights
  const insights = useMemo(() => {
    // Scope to active dept filter OR all
    const scope = deptFilter === 'All' ? workTasks : workTasks.filter(t => t.deptType === deptFilter);
    const pills: {icon:string;text:string;color:string;bg:string}[] = [];
    const delayed = scope.filter(t => t.dueDate && t.dueDate < today && !t.isCompleted);
    if (delayed.length > 0) pills.push({ icon:'⚠', text:`${delayed.length} past due date`, color:'#DC2626', bg:'#FEF2F2' });
    const clientApproval = scope.filter(t => t.executionState==='Client Approval');
    if (clientApproval.length > 0) pills.push({ icon:'⏳', text:`${clientApproval.length} awaiting client approval`, color:'#7C3AED', bg:'#F5F3FF' });
    const rework = scope.filter(t => t.executionState==='Rework');
    if (rework.length > 0) pills.push({ icon:'↺', text:`${rework.length} rework`, color:'#DC2626', bg:'#FEF2F2' });
    const inProg = scope.filter(t => t.executionState==='In Progress');
    if (inProg.length > 0) pills.push({ icon:'▶', text:`${inProg.length} in progress`, color:'#2563EB', bg:'#EFF6FF' });
    // dept-specific
    if (deptFilter === 'All') {
      NON_SEO_DEPTS.forEach(dept => {
        const count = workTasks.filter(t => t.deptType===dept && !t.isCompleted).length;
        if (count > 0) { const d = DEPT_CONFIG[dept]; pills.push({ icon:d.icon, text:`${dept}: ${count} open`, color:d.color, bg:d.bg }); }
      });
    } else {
      // Social: platform breakdown
      if (deptFilter === 'Social Media') {
        const platforms: Record<string,number> = {};
        scope.forEach(t => { if(t.platform) platforms[t.platform]=(platforms[t.platform]||0)+1; });
        Object.entries(platforms).slice(0,3).forEach(([p,n]) => pills.push({ icon:'📌', text:`${p}: ${n}`, color:'#9D174D', bg:'#FDF2F8' }));
      }
      if (deptFilter === 'Ads') {
        const totalBudget = scope.reduce((s,t) => s+(t.adBudget||0), 0);
        if (totalBudget > 0) pills.push({ icon:'💰', text:`₹${totalBudget.toLocaleString()} total budget`, color:'#92400E', bg:'#FFFBEB' });
      }
    }
    const done = scope.filter(t => t.isCompleted).length;
    if (done > 0) pills.push({ icon:'✓', text:`${done} completed`, color:'#059669', bg:'#ECFDF5' });
    const noDeliverable = scope.filter(t => t.isCompleted && !t.deliverableUrl).length;
    if (noDeliverable > 0) pills.push({ icon:'🔗', text:`${noDeliverable} missing deliverable`, color:'#D97706', bg:'#FFFBEB' });
    return pills;
  }, [workTasks, deptFilter, today]);

  // Time actions
  const timeAction = (taskId: string, type: string, newState: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const now = new Date().toISOString();
      return { ...t, executionState: newState as any, isCompleted: newState==='Completed'||newState==='Approved',
        timeEvents: [...(t.timeEvents||[]), { type:type as any, timestamp:now, department:t.deptType||'Work', owner: currentUser?.ownerName || '' }] };
    }));
  };

  const sendRework = (taskId: string, note: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const now = new Date().toISOString();
      const entry = { id:`rw_${Date.now()}`, date:today, estHours:0, assignedDept:'Content' as any, assignedOwner:'', withinEstimate:true, hoursAlreadySpent:0, startTimestamp:now };
      return { ...t, executionState:'Rework', isCompleted:false,
        reworkEntries:[...(t.reworkEntries||[]), entry],
        timeEvents:[...(t.timeEvents||[]), { type:'rework_start' as any, timestamp:now, department:t.deptType||'Work', owner: currentUser?.ownerName || '' }],
        remarks: note ? `${t.remarks?t.remarks+'\n':''}Rework: ${note}` : t.remarks };
    }));
    if (historyTask?.id === taskId) setHistoryTask(prev => tasks.find(t=>t.id===taskId)||null);
  };

  const approveTask = (taskId: string) => {
    timeAction(taskId, 'end', 'Approved');
    setHistoryTask(null);
  };

  // Form — dynamic: pulls from ALL users so any new user appears automatically
  const allOwners = useAllOwners();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleBulkImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g,''));
      const get = (...names: string[]) => { for (const n of names) { const i = headers.findIndex(h=>h.includes(n)); if(i>=0) return i; } return -1; };
      const iTitle=get('task','title'); const iClient=get('client'); const iDept=get('dept');
      const iType=get('type','task type'); const iAssigned=get('assigned','owner');
      const iDate=get('date'); const iDue=get('due'); const iPlatform=get('platform');
      const iEst=get('est'); const iDoc=get('doc','brief'); const iDeliverable=get('deliverable');
      const iRemarks=get('remarks','note');
      const newTasks: Task[] = [];
      for (let i=1; i<lines.length; i++) {
        const cols = lines[i].split(',').map(c=>c.trim().replace(/^"|"$/g,''));
        const title = iTitle>=0 ? cols[iTitle] : '';
        const client = iClient>=0 ? cols[iClient] : adminOptions.clients[0]||'';
        if (!title) continue;
        const deptRaw = (iDept>=0 ? cols[iDept] : 'Social Media').trim();
        const dept = NON_SEO_DEPTS.find(d=>d.toLowerCase()===deptRaw.toLowerCase()) || 'Social Media' as DeptType;
        const assignedTo = iAssigned>=0 ? cols[iAssigned] : currentUser?.ownerName||'';
        newTasks.push({
          id: `WH-\${Date.now()}-\${i}`, title, client,
          seoOwner: assignedTo, seoStage: iType>=0?cols[iType]:'', currentOwner: assignedTo,
          isCompleted:false, seoQcStatus:'Pending', contentStatus:'', webStatus:'',
          intakeDate: iDate>=0&&cols[iDate] ? cols[iDate] : today,
          contentAssignedDate:'', webAssignedDate:'', daysInStage:0,
          estHours: iEst>=0 ? Number(cols[iEst])||0 : 0,
          estHoursSEO:0, estHoursContent:0, estHoursWeb:0, actualHours:0,
          executionState:'Not Started', timeEvents:[],
          deptType:dept, taskType:iType>=0?cols[iType]:'',
          platform:iPlatform>=0?cols[iPlatform]:'',
          docUrl:iDoc>=0?cols[iDoc]:'', deliverableUrl:iDeliverable>=0?cols[iDeliverable]:'',
          remarks:iRemarks>=0?cols[iRemarks]:'',
          dueDate:iDue>=0?cols[iDue]:'', assignedTo,
        });
      }
      if (newTasks.length > 0) {
        setTasks(prev => [...newTasks, ...prev]);
        setImportMsg(`✓ Imported \${newTasks.length} tasks`);
        setTimeout(()=>setImportMsg(''), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportCSV = () => {
    const h = ['Date','Dept','Task Type','Title','Client','Assigned To','Due Date','Status','Est Hrs','Actual Hrs','Platform','Doc URL','Deliverable URL','Remarks'];
    const rows = filtered.map(t => [
      t.intakeDate, t.deptType||'', t.taskType||'',
      `"\${(t.title||'').replace(/"/g,'""')}"`,
      t.client, t.assignedTo||t.seoOwner||'', t.dueDate||'',
      t.isCompleted?'Completed':(t.executionState||'Not Started'),
      t.estHours||'', t.actualHours||'', t.platform||'',
      t.docUrl||'', t.deliverableUrl||'',
      `"\${(t.remarks||'').replace(/"/g,'""')}"`
    ].join(','));
    const csv = [h.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `workhub-\${dateFrom||'all'}.csv`; a.click();
  };

  const [importMsg, setImportMsg] = React.useState('');

  const EMPTY_FORM = () => ({
    deptType: 'Social Media' as DeptType, taskType:'', platform:'', client:adminOptions.clients[0]||'',
    assignedTo:currentUser?.ownerName||allOwners[0]||'', title:'', intakeDate:today, dueDate:'',
    estHours:0, deliverableUrl:'', docUrl:'', remarks:'', adBudget:0,
  });
  const [form, setForm] = useState(EMPTY_FORM());
  const taskTypesForDept = (dept:DeptType): string[] => {
    if (dept==='Social Media') return adminOptions.socialTaskTypes||[];
    if (dept==='Design') return adminOptions.designTaskTypes||[];
    if (dept==='Ads') return adminOptions.adsTaskTypes||[];
    if (dept==='Web Dev') return adminOptions.webDevTaskTypes||[];
    return [];
  };
  const saveTask = () => {
    if (!form.title.trim()) return;
    if (editingTask) {
      setTasks(prev => prev.map(t => t.id===editingTask.id ? {...t,...form,seoOwner:form.assignedTo} : t));
      setEditingTask(null);
    } else {
      const newTask: Task = {
        id:`WH-${Date.now()}`, title:form.title, client:form.client, seoOwner:form.assignedTo,
        seoStage:form.taskType, currentOwner:form.assignedTo, isCompleted:false,
        seoQcStatus:'Pending', contentStatus:'', webStatus:'', intakeDate:form.intakeDate,
        contentAssignedDate:'', webAssignedDate:'', daysInStage:0, estHours:form.estHours,
        estHoursSEO:form.estHours, estHoursContent:0, estHoursWeb:0, actualHours:0,
        executionState:'Not Started', timeEvents:[],
        deptType:form.deptType, taskType:form.taskType, platform:form.platform,
        deliverableUrl:form.deliverableUrl, docUrl:form.docUrl, remarks:form.remarks,
        dueDate:form.dueDate, assignedTo:form.assignedTo, adBudget:form.adBudget||undefined,
      };
      setTasks(prev => [newTask,...prev]);
    }
    setShowAdd(false); setForm(EMPTY_FORM());
  };
  const openEdit = (t: Task) => {
    setEditingTask(t);
    setForm({ deptType:t.deptType||'Social Media', taskType:t.taskType||'', platform:t.platform||'', client:t.client, assignedTo:t.assignedTo||t.seoOwner||'', title:t.title, intakeDate:t.intakeDate, dueDate:t.dueDate||'', estHours:t.estHours||0, deliverableUrl:t.deliverableUrl||'', docUrl:t.docUrl||'', remarks:t.remarks||'', adBudget:t.adBudget||0 });
    setShowAdd(true);
  };

  const inp = (label:string, field:string, type='text', placeholder='') => (
    <div>
      <label style={{ display:'block', fontSize:10, color:'#6b7280', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>{label}</label>
      <input type={type} value={(form as any)[field]||''} placeholder={placeholder}
        onChange={e => setForm(f=>({...f,[field]:type==='number'?Number(e.target.value):e.target.value}))}
        style={{ width:'100%', fontSize:11, border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 9px', background:'#fff', color:'#1a1a1a' }} />
    </div>
  );
  const sel = (label:string, field:string, opts:string[]) => (
    <div>
      <label style={{ display:'block', fontSize:10, color:'#6b7280', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>{label}</label>
      <select value={(form as any)[field]||''} onChange={e => setForm(f=>({...f,[field]:e.target.value}))}
        style={{ width:'100%', fontSize:11, border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 9px', background:'#fff', color:'#1a1a1a' }}>
        {opts.map(o=><option key={o}>{o}</option>)}
      </select>
    </div>
  );
  const dc = DEPT_CONFIG[form.deptType]||DEPT_CONFIG['Social Media'];

  return (
    <div className="space-y-4">

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:500, color:'#111827' }}>Work Hub</h2>
          <p style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Social Media · Design · Ads · Web Dev tasks</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <label style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #217346', color:'#217346', background:'#F0FFF4', cursor:'pointer' }}>
            📥 Import Excel/CSV
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkImport} style={{ display:'none' }} />
          </label>
          <button onClick={exportCSV} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>↓ Export CSV</button>
          <button onClick={()=>{setEditingTask(null);setForm(EMPTY_FORM());setShowAdd(true);}}
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, fontSize:12, fontWeight:500, border:'none', color:'#fff', background:'#1E2D8B', cursor:'pointer' }}>
            <Plus size={14}/> Add Task
          </button>
        </div>
      </div>

      {/* Import success + template hint */}
      {importMsg && <div style={{ padding:'8px 14px', borderRadius:8, background:'#EAF3DE', color:'#27500A', fontSize:12, fontWeight:500 }}>{importMsg}</div>}
      <div style={{ background:'#f8f9fa', borderRadius:8, padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ fontSize:10, color:'#4b5563' }}>Excel/CSV columns: <code style={{ fontSize:9, background:'#ffffff', padding:'1px 4px', borderRadius:3 }}>Date, Dept, Task Type, Title, Client, Assigned To, Due Date, Est Hrs, Platform, Doc URL, Deliverable URL, Remarks</code></span>
        <button onClick={()=>{
          const h='Date,Dept,Task Type,Title,Client,Assigned To,Due Date,Est Hrs,Platform,Doc URL,Deliverable URL,Remarks\n2026-03-22,Social Media,Reel,JadeAlloys Product Reel,JadeAlloys,Aman,2026-03-25,2,Instagram,,https://drive.google.com/...,Client brief attached';
          const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([h],{type:'text/csv'}));a.download='workhub-template.csv';a.click();
        }} style={{ fontSize:9, padding:'2px 9px', borderRadius:5, border:'0.5px solid var(--color-border-secondary)', color:'#4b5563', background:'#ffffff', cursor:'pointer', whiteSpace:'nowrap' }}>↓ Download template</button>
      </div>

      {/* Date range + dept filters */}
      <div style={{ background:'#ffffff', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, alignItems:'center', marginBottom:8 }}>
          <span style={{ fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em' }}>Date:</span>
          {[['today','Today'],['week','This Week'],['month','This Month'],['all','All Time']].map(([k,l]) => (
            <button key={k} onClick={()=>setChip(k)} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color:activeChip===k?'#fff':'#4b5563', background:activeChip===k?'#1E2D8B':'#f8f9fa', border:`0.5px solid ${activeChip===k?'#1E2D8B':'#e5e7eb'}`, transition:'all .15s' }}>{l}</button>
          ))}
          <span style={{ fontSize:10, color:'#9ca3af', margin:'0 2px' }}>Custom:</span>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setActiveChip('custom');setPage(1);}} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
          <span style={{ fontSize:10, color:'#9ca3af' }}>–</span>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setActiveChip('custom');setPage(1);}} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700"/>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button onClick={()=>{setDeptFilter('All');setPage(1);}} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', border:'0.5px solid var(--color-border-secondary)', color:deptFilter==='All'?'#fff':'#4b5563', background:deptFilter==='All'?'#1E2D8B':'transparent' }}>All ({workTasks.length})</button>
          {NON_SEO_DEPTS.map(dept => {
            const d = DEPT_CONFIG[dept]; const count = workTasks.filter(t=>t.deptType===dept).length;
            return <button key={dept} onClick={()=>{setDeptFilter(dept);setPage(1);}} style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', border:`1px solid ${deptFilter===dept?d.color:d.border}`, color:deptFilter===dept?'#fff':d.color, background:deptFilter===dept?d.color:d.bg }}>{d.icon} {dept}{count>0?` (${count})`:''}</button>;
          })}
        </div>
      </div>

      {/* Insights — dept aware */}
      {insights.length > 0 && (
        <div style={{ background:'#ffffff', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:insightsOpen?8:0 }}>
            <span style={{ fontSize:9, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.05em' }}>
              {deptFilter === 'All' ? 'All dept insights' : `${DEPT_CONFIG[deptFilter].icon} ${deptFilter} insights`}
            </span>
            <button onClick={()=>setInsightsOpen(o=>!o)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>{insightsOpen?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
          </div>
          {insightsOpen && <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {insights.map((p,i)=><span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, color:p.color, background:p.bg, border:`1px solid ${p.color}40`, whiteSpace:'nowrap' }}>{p.icon} {p.text}</span>)}
          </div>}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ background:'#ffffff', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:8 }}>
          <div style={{ flex:2, minWidth:140, display:'flex', alignItems:'center', gap:6, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'5px 9px' }}>
            <span style={{ fontSize:12, color:'#9ca3af' }}>🔍</span>
            <input type="text" placeholder="Search task, client, type..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} style={{ flex:1, fontSize:11, border:'none', background:'transparent', color:'#111827', outline:'none' }} />
          </div>
          <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)} style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'5px 9px' }}>
            <option value="All">All Clients</option>
            {adminOptions.clients.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)} style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'5px 9px' }}>
            <option value="All">All Owners</option>
            {allOwners.map(o=><option key={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:9, fontWeight:500, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.04em', marginRight:4 }}>Status:</span>
          {['All','Not Started','In Progress','Client Approval','Rework','Approved','Completed'].map(s => {
            const sc = STATUS_CONFIG[s]||{color:'#4b5563',bg:'#f8f9fa'};
            const count = s==='All'?filtered.length:(statusCounts[s]||0);
            return <button key={s} onClick={()=>{setStatusFilter(s);setPage(1);}} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, fontSize:10, fontWeight:500, cursor:'pointer', color:statusFilter===s?'#fff':sc.color, background:statusFilter===s?sc.color:sc.bg, border:`0.5px solid ${sc.color}40` }}>{s}{` (${count})`}</button>;
          })}
        </div>
      </div>

      {/* List view */}
      {(true) && (
        <div style={{ background:'#ffffff', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'8px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:10, fontWeight:500, color:'#9ca3af', textTransform:'uppercase' }}>{filtered.length} tasks</span>
            {(dateFrom===today&&dateTo===today) && <span style={{ fontSize:10, color:'#185FA5' }}>Showing today · <button onClick={()=>setChip('all')} style={{ background:'none', border:'none', color:'#185FA5', cursor:'pointer', fontSize:10, textDecoration:'underline' }}>Show all</button></span>}
          </div>
          <div style={{ overflowX:'auto', maxHeight:580 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:920 }}>
              <thead style={{ position:'sticky', top:0, zIndex:2 }}>
                <tr>
                  {['Date','Task','Dept','Type','Client','Assigned','Due','Status','Est h','Act h','Overrun','Doc / Brief','Deliverable','Timer','History'].map(h=>(
                    <th key={h} style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em', padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'left', background:'#f8f9fa', color:'#9ca3af', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length===0 ? (
                  <tr><td colSpan={15} style={{ padding:24, textAlign:'center', fontSize:12, color:'#9ca3af', fontStyle:'italic' }}>
                    No tasks for this period. <button onClick={()=>setChip('all')} style={{ color:'#185FA5', background:'none', border:'none', cursor:'pointer', fontSize:12, textDecoration:'underline' }}>Show all time</button>
                  </td></tr>
                ) : paginated.map(t => {
                  const isPastDue = t.dueDate && t.dueDate<today && !t.isCompleted;
                  const status = t.isCompleted?'Completed':(t.executionState||'Not Started');
                  const d = DEPT_CONFIG[t.deptType as DeptType]||DEPT_CONFIG['Social Media'];
                  return (
                    <tr key={t.id} style={{ background:isPastDue?'#FEF2F210':'transparent' }} className="hover:brightness-95">
                      <td style={{ fontSize:10, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'#9ca3af', whiteSpace:'nowrap' }}>{t.intakeDate}</td>
                      <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', maxWidth:160 }}>
                        <div style={{ fontWeight:500, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.title}>{t.title}</div>
                        {t.remarks && <div style={{ fontSize:9, color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.remarks}>{t.remarks}</div>}
                      </td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}><DeptTag dept={(t.deptType||'Social Media') as DeptType}/></td>
                      <td style={{ fontSize:10, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:d.color, whiteSpace:'nowrap' }}>{t.taskType||'—'}</td>
                      <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontWeight:500, color:'#111827', whiteSpace:'nowrap' }}>{t.client}</td>
                      <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'#4b5563', whiteSpace:'nowrap' }}>{t.assignedTo||t.seoOwner||'—'}</td>
                      <td style={{ fontSize:10, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:isPastDue?'#DC2626':'#4b5563', fontWeight:isPastDue?500:400, whiteSpace:'nowrap' }}>{t.dueDate||'—'}{isPastDue&&' ⚠'}</td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}><StatusPill status={status}/></td>
                      <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'center' }}>{t.estHours||'—'}</td>
                      {(() => { const logged = calcActualHours(t.timeEvents||[]); const over = logged>(t.estHours||0)&&(t.estHours||0)>0; return <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'center', color:over?'#DC2626':'#4b5563', fontWeight:over?500:400 }}>{logged>0?fmtMs(logged*3600000):'—'}</td>; })()}
                      {(() => { const estH = getTaskEstHours(t); const ovH = msToHrs(calcTaskOverrunMs(t.timeEvents||[], estH)); return <td style={{ fontSize:11, padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'center' }}>{estH === 0 ? <span style={{ fontSize:9, color:'#9ca3af' }}>—<span style={{ fontSize:8, display:'block', color:'#9ca3af' }}>no est</span></span> : ovH > 0 ? <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:99, color:'#DC2626', background:'#FEF2F2' }}>+{ovH.toFixed(1)}h</span> : <span style={{ color:'#9ca3af' }}>—</span>}</td>; })()}
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        {t.docUrl ? <DocLink url={t.docUrl} label="Brief"/> : <span style={{ fontSize:10, color:'#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        {t.deliverableUrl ? <DocLink url={t.deliverableUrl} label="Deliverable"/> : <button onClick={()=>openEdit(t)} style={{ fontSize:9, color:'#D97706', background:'#FFFBEB', border:'0.5px dashed #FDE68A', borderRadius:5, padding:'2px 7px', cursor:'pointer' }}>+ Add</button>}
                      </td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        <div style={{ display:'flex', gap:3 }}>
                          {status==='Not Started' && <button onClick={()=>timeAction(t.id,'start','In Progress')} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'0.5px solid #2563EB60', color:'#2563EB', background:'#EFF6FF', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:2 }}><Play size={9}/>Start</button>}
                          {status==='In Progress' && <button onClick={()=>timeAction(t.id,'end','Client Approval')} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'0.5px solid #7C3AED60', color:'#7C3AED', background:'#F5F3FF', cursor:'pointer' }}>Submit</button>}
                          {status==='Paused' && <button onClick={()=>timeAction(t.id,'resume','In Progress')} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'0.5px solid #2563EB60', color:'#2563EB', background:'#EFF6FF', cursor:'pointer' }}>Resume</button>}
                          {status==='Rework' && <button onClick={()=>timeAction(t.id,'rework_start','In Progress')} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'0.5px solid #DC262660', color:'#DC2626', background:'#FEF2F2', cursor:'pointer' }}>Fix</button>}
                          {status==='Client Approval' && <button onClick={()=>approveTask(t.id)} style={{ fontSize:9, padding:'2px 6px', borderRadius:5, border:'0.5px solid #05966960', color:'#059669', background:'#ECFDF5', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:2 }}><Check size={9}/>Approve</button>}
                        </div>
                      </td>
                      <td style={{ padding:'6px 8px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        <button onClick={()=>setHistoryTask(t)} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, border:'0.5px solid var(--color-border-secondary)', color:'#185FA5', background:'#E6F1FB', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:2 }}><Clock size={9}/>Log</button>
                        <button onClick={()=>openEdit(t)} style={{ fontSize:9, padding:'2px 5px', borderRadius:5, border:'0.5px solid var(--color-border-secondary)', color:'#4b5563', background:'transparent', cursor:'pointer', marginLeft:3 }}><Pencil size={9}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(() => {
            const totalPages = Math.ceil(filtered.length / perPage);
            if (filtered.length === 0) return null;
            const pages: (number|'...')[] = [];
            if (totalPages <= 7) { for(let i=1;i<=totalPages;i++) pages.push(i); }
            else { pages.push(1); if(page>3) pages.push('...'); for(let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) pages.push(i); if(page<totalPages-2) pages.push('...'); pages.push(totalPages); }
            return (
              <div style={{ display:'flex', alignItems:'center', gap:4, padding:'10px 14px', borderTop:'0.5px solid var(--color-border-tertiary)', flexWrap:'wrap' }}>
                <span style={{ fontSize:10, color:'#9ca3af', marginRight:6 }}>{(page-1)*perPage+1}–{Math.min(page*perPage,filtered.length)} of {filtered.length}</span>
                <span style={{ fontSize:9, color:'#9ca3af', marginLeft:8 }}>Per page:</span>
                {[10,25,50].map(n=><button key={n} onClick={()=>{setPerPage(n);setPage(1);}} style={{padding:'2px 7px',borderRadius:5,fontSize:9,fontWeight:500,border:`0.5px solid ${perPage===n?'#1E2D8B':'#e5e7eb'}`,color:perPage===n?'#1E2D8B':'#4b5563',background:perPage===n?'#E6F1FB':'transparent',cursor:'pointer'}}>{n}</button>)}
                <div style={{ display:'flex', gap:3, marginLeft:8 }}>
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{width:26,height:26,borderRadius:6,border:'0.5px solid var(--color-border-secondary)',fontSize:12,cursor:'pointer',background:'transparent',color:'#4b5563'}}>‹</button>
                  {pages.map((p,i)=>p==='...'?<span key={`e${i}`} style={{fontSize:11,color:'#9ca3af',padding:'0 2px',lineHeight:'26px'}}>…</span>:<button key={p} onClick={()=>setPage(p as number)} style={{width:26,height:26,borderRadius:6,border:`0.5px solid ${page===p?'#1E2D8B':'#e5e7eb'}`,fontSize:10,fontWeight:500,cursor:'pointer',background:page===p?'#1E2D8B':'transparent',color:page===p?'#fff':'#4b5563'}}>{p}</button>)}
                  <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{width:26,height:26,borderRadius:6,border:'0.5px solid var(--color-border-secondary)',fontSize:12,cursor:'pointer',background:'transparent',color:'#4b5563'}}>›</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Time history modal */}
      {historyTask && createPortal(
        <TimeHistoryPanel
          task={historyTask}
          onClose={()=>setHistoryTask(null)}
          onRework={(note)=>sendRework(historyTask.id, note)}
          onApprove={()=>approveTask(historyTask.id)}
          remarks={remarks}
          onAddRemark={(text,type)=>addRemark(historyTask.id,text,type)}
          onDeleteRemark={deleteRemark}
          currentUser={currentUser}
        />
      , document.body)}

      {/* Add/Edit modal */}
      {showAdd && createPortal(
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, width:'100vw', height:'100vh', zIndex:2147483647, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.5)' }}>
          <div style={{ background:'#ffffff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.35)', position:'relative', zIndex:2147483647 }}>
            <div style={{ padding:'14px 18px', borderBottom:'0.5px solid var(--color-border-tertiary)', display:'flex', alignItems:'center', gap:8, background:dc.bg }}>
              <DeptTag dept={form.deptType}/>
              <h3 style={{ fontSize:14, fontWeight:500, color:dc.color }}>{editingTask?'Edit Task':'Add Task'}</h3>
              <button onClick={()=>setShowAdd(false)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:dc.color }}><X size={16}/></button>
            </div>
            <div style={{ padding:'16px 18px', flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, background:'#fff' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {sel('Dept Type ★','deptType',NON_SEO_DEPTS)}
                {sel('Task Type','taskType',taskTypesForDept(form.deptType))}
              </div>
              {inp('Task Title ★','title','text','e.g. Instagram Reel — product showcase')}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {sel('Client ★','client',adminOptions.clients)}
                {sel('Assigned To ★','assignedTo',allOwners)}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {inp('Date ★','intakeDate','date')}
                {inp('Due Date','dueDate','date')}
                {sel('Platform','platform',['',  ...(adminOptions.platforms||[])])}
              </div>
              <div style={{ display:'grid', gridTemplateColumns: form.deptType==='Ads'?'1fr 1fr':'1fr', gap:10 }}>
                {inp('Est. Hours','estHours','number','0')}
                {form.deptType==='Ads' && inp('Ad Budget (₹)','adBudget','number','0')}
              </div>
              <div style={{ padding:'6px 10px', borderRadius:7, background:'#f8f9fa', fontSize:10, color:'#6b7280' }}>
                Actual hours are auto-calculated from time logs (Start/Pause/End actions)
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#6b7280', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>Doc / Brief URL <span style={{ fontSize:9, opacity:.7 }}>(Google Sheet, Doc, Drive, Notion...)</span></label>
                <input type="url" value={form.docUrl||''} onChange={e=>setForm(f=>({...f,docUrl:e.target.value}))} placeholder="https://docs.google.com/..." style={{ width:'100%', fontSize:11, border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 9px', background:'#fff', color:'#1a1a1a' }} />
                {form.docUrl && <div style={{ marginTop:5 }}><DocLink url={form.docUrl} label="Preview"/></div>}
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#6b7280', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>Deliverable URL <span style={{ fontSize:9, opacity:.7 }}>(live link after task done)</span></label>
                <input type="url" value={form.deliverableUrl||''} onChange={e=>setForm(f=>({...f,deliverableUrl:e.target.value}))} placeholder="https://..." style={{ width:'100%', fontSize:11, border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 9px', background:'#fff', color:'#1a1a1a' }} />
                {form.deliverableUrl && <div style={{ marginTop:5 }}><DocLink url={form.deliverableUrl} label="Preview"/></div>}
              </div>
              <div>
                <label style={{ display:'block', fontSize:10, color:'#6b7280', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>Remarks / Brief</label>
                <textarea value={form.remarks||''} rows={2} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} placeholder="Optional brief or notes..." style={{ width:'100%', fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:7, padding:'6px 9px', resize:'vertical', background:'#fff', color:'#1a1a1a' }} />
              </div>
            </div>
            <div style={{ padding:'12px 18px', borderTop:'1px solid #f0f0f0', display:'flex', gap:8, justifyContent:'flex-end', background:'#fff' }}>
              <button onClick={()=>setShowAdd(false)} style={{ padding:'7px 14px', borderRadius:8, fontSize:12, border:'0.5px solid var(--color-border-secondary)', color:'#4b5563', background:'transparent', cursor:'pointer' }}>Cancel</button>
              <button onClick={saveTask} disabled={!form.title.trim()} style={{ padding:'7px 18px', borderRadius:8, fontSize:12, fontWeight:500, border:'none', color:'#fff', background:dc.color, cursor:'pointer', opacity:form.title.trim()?1:.5 }}>{editingTask?'Save Changes':'Add Task'}</button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
