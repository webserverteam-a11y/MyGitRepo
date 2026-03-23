import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { Task } from '../types';
import { cn, getDeptDelayedInfo } from '../utils';
import { getTaskEstHours } from '../utils/productiveHours';
import { X, Play, Pause, CheckCircle2, Pencil, Save, ChevronDown, ChevronUp } from 'lucide-react';

type ExecutionState = 'Not Started' | 'In Progress' | 'Paused' | 'Rework' | 'Ended';
const TARGET_H = 8;

// Calculate actual hours from timeEvents
function calcActualHours(events: any[]): number {
  let ms = 0; let lastStart: number | null = null;
  for (const e of (events||[])) {
    const ts = new Date(e.timestamp).getTime();
    if (e.type==='start'||e.type==='resume'||e.type==='rework_start') lastStart = ts;
    else if ((e.type==='pause'||e.type==='end') && lastStart) { ms += ts - lastStart; lastStart = null; }
  }
  return Math.round((ms/3600000)*100)/100;
}
function fmtHrs(h: number) { return h > 0 ? h.toFixed(1) : '—'; }

// Neon status colors
const NEON: Record<string, { color: string; bg: string; glow: string }> = {
  'Not Started':  { color: '#888780', bg: '#F1EFE8', glow: 'none' },
  'In Progress':  { color: '#2563EB', bg: '#EFF6FF', glow: '0 0 8px #60A5FA60' },
  'Paused':       { color: '#D97706', bg: '#FFFBEB', glow: '0 0 8px #FCD34D50' },
  'Rework':       { color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 8px #A78BFA60' },
  'Ended':        { color: '#059669', bg: '#ECFDF5', glow: '0 0 8px #34D39960' },
  'QC Submitted': { color: '#0891B2', bg: '#ECFEFF', glow: '0 0 8px #22D3EE60' },
  'Pending QC':   { color: '#0891B2', bg: '#ECFEFF', glow: '0 0 8px #22D3EE60' },
  'Delayed':      { color: '#DC2626', bg: '#FEF2F2', glow: '0 0 8px #F8717160' },
  'Approved':     { color: '#059669', bg: '#ECFDF5', glow: '0 0 8px #34D39960' },
  'Assigned':     { color: '#2563EB', bg: '#EFF6FF', glow: '0 0 8px #60A5FA60' },
};

function NeonBadge({ label, size = 'sm' }: { label: string; size?: 'xs' | 'sm' }) {
  const s = NEON[label] || { color: '#444441', bg: '#F1EFE8', glow: 'none' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: size === 'xs' ? '1px 6px' : '3px 9px',
      borderRadius: 99, fontSize: size === 'xs' ? 9 : 10, fontWeight: 600,
      color: s.color, background: s.bg,
      border: `1px solid ${s.color}40`,
      boxShadow: s.glow, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 500, color, background: bg, whiteSpace: 'nowrap' }}>{label}</span>;
}

// Clickable capsule for filter strip
function Capsule({ label, count, active, color, bg, glow, onClick }: { label: string; count: number; active: boolean; color: string; bg: string; glow: string; onClick: () => void; key?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
      borderRadius: 99, fontSize: 11, fontWeight: 500, cursor: 'pointer',
      color: active ? '#fff' : color,
      background: active ? color : bg,
      border: `1px solid ${color}${active ? 'ff' : '60'}`,
      boxShadow: active ? glow : 'none',
      transition: 'all .15s', whiteSpace: 'nowrap',
    }}>
      {label}
      <span style={{ fontWeight: 700, fontSize: 12, background: active ? 'rgba(255,255,255,0.3)' : color + '20', padding: '0 5px', borderRadius: 8 }}>{count}</span>
    </button>
  );
}

function statusBadge(status?: string) {
  if (!status) return null;
  const label = status === 'Pending QC' || status === 'QC' ? 'QC Submitted' : status;
  return <NeonBadge label={label} size="xs" />;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

// Inline edit modal for all roles
function EditTaskModal({ task, onSave, onClose }: { task: Task; onSave: (updated: Partial<Task>) => void; onClose: () => void }) {
  const { adminOptions } = useAppContext();
  const [form, setForm] = useState<Partial<Task>>({ ...task });
  const f = (label: string, field: keyof Task, type = 'text') => (
    <div>
      <label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
      <input type={type} value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  );
  const d = (label: string, field: keyof Task, opts: string[]) => (
    <div>
      <label className="block text-[10px] font-medium text-zinc-500 mb-1">{label}</label>
      <select value={(form as any)[field] || ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        className="w-full border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
        {opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-semibold text-zinc-900">Edit Task</h3>
          <button onClick={onClose}><X size={16} className="text-zinc-400" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {f('Task Title', 'title')}
          <div className="grid grid-cols-2 gap-3">
            {d('Client', 'client', adminOptions.clients)}
            {d('Stage', 'seoStage', adminOptions.seoStages)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {d('SEO Owner', 'seoOwner', adminOptions.seoOwners)}
            {d('Content Owner', 'contentOwner', ['—', ...adminOptions.contentOwners])}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {d('Web Owner', 'webOwner', ['—', ...adminOptions.webOwners])}
            {d('Current Owner', 'currentOwner', ['SEO', 'Content', 'Web'])}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {f('Est Hrs (SEO)', 'estHoursSEO', 'number')}
            {f('Est Hrs (Content)', 'estHoursContent', 'number')}
            {f('Est Hrs (Web)', 'estHoursWeb', 'number')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {f('Content Assigned Date', 'contentAssignedDate', 'date')}
            {f('Web Assigned Date', 'webAssignedDate', 'date')}
          </div>
          {f('Target URL', 'targetUrl', 'url')}
          {f('Doc URL', 'docUrl', 'url')}
          {f('Focused Keyword', 'focusedKw')}
          <div className="grid grid-cols-2 gap-3">
            {f('Volume', 'volume', 'number')}
            <div>
              <label className="block text-[10px] font-medium text-zinc-500 mb-1">Actual Hours (auto)</label>
              <div className="w-full border border-zinc-100 rounded-lg px-2.5 py-1.5 text-xs bg-zinc-50 text-zinc-500">{fmtHrs(calcActualHours(task.timeEvents || []))}</div>
            </div>
          </div>
          {f('Remarks', 'remarks')}
        </div>
        <div className="px-5 py-4 border-t border-zinc-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900">Cancel</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-5 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// Drag-and-drop Kanban with time actions on each card
function KanbanView({ tasks, onEdit, onMove, onTimeAction }: {
  tasks: Task[];
  onEdit: (t: Task) => void;
  onMove: (taskId: string, newState: string) => void;
  onTimeAction: (taskId: string, type: string, newState: ExecutionState) => void;
}) {
  const cols = [
    { key: 'Not Started', label: 'Not Started', color: '#888780', bg: '#F1EFE840', border: '#D3D1C7', glow: 'none' },
    { key: 'In Progress', label: 'In Progress', color: '#2563EB', bg: '#EFF6FF60', border: '#93C5FD', glow: '0 0 12px #60A5FA40' },
    { key: 'Paused',      label: 'Paused',      color: '#D97706', bg: '#FFFBEB60', border: '#FCD34D', glow: '0 0 12px #FCD34D40' },
    { key: 'Rework',      label: 'Rework',      color: '#7C3AED', bg: '#F5F3FF60', border: '#C4B5FD', glow: '0 0 12px #A78BFA40' },
    { key: 'Ended',       label: 'Completed',   color: '#059669', bg: '#ECFDF560', border: '#6EE7B7', glow: '0 0 12px #34D39940' },
  ];

  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const dragId = React.useRef<string | null>(null);
  const getTaskState = (t: Task) => t.isCompleted ? 'Ended' : (t.executionState || 'Not Started');
  const tasksByState = (key: string) => tasks.filter(t => getTaskState(t) === key);

  return (
    <div>
      <p style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 10 }}>Drag cards between columns · use Start/Pause/End buttons on each card</p>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {cols.map(col => {
          const colTasks = tasksByState(col.key);
          const isOver = dragOver === col.key;
          return (
            <div key={col.key}
              style={{ minWidth: 190, flex: 1, border: `1px solid ${isOver ? col.color : col.border}`, borderRadius: 12, padding: 10, background: isOver ? col.bg.replace('60','90') : col.bg, boxShadow: isOver ? col.glow : 'none', transition: 'all .15s' }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); if (dragId.current) onMove(dragId.current, col.key); dragId.current = null; setDragOver(null); }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: col.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{col.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: col.color, background: col.border + '50', padding: '1px 8px', borderRadius: 99, boxShadow: col.glow }}>{colTasks.length}</span>
              </div>

              {/* Cards */}
              {colTasks.map(t => {
                const state = getTaskState(t);
                const isRunning = state === 'In Progress' || state === 'Rework';
                return (
                  <div key={t.id}
                    draggable
                    onDragStart={() => { dragId.current = t.id; }}
                    style={{ background: 'var(--color-background-primary)', border: `1px solid ${col.border}`, borderRadius: 9, padding: '9px 10px', marginBottom: 7, cursor: 'grab', userSelect: 'none', boxShadow: isRunning ? col.glow : 'none' }}
                  >
                    {/* Title + edit */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</div>
                      <button onClick={() => onEdit(t)} style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, border: `0.5px solid ${col.border}`, color: col.color, cursor: 'pointer', flexShrink: 0, background: 'transparent' }}>✎</button>
                    </div>

                    {/* Client + stage */}
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>{t.client} · {t.seoStage}</div>

                    {/* Live timer */}
                    {isRunning && <KanbanTimer timeEvents={t.timeEvents || []} state={t.executionState} estHours={getTaskEstHours(t)} />}

                    {/* Last event */}
                    {t.timeEvents && t.timeEvents.length > 0 && !isRunning && (
                      <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
                        Last: {t.timeEvents[t.timeEvents.length - 1].type.replace('_', ' ')} · {new Date(t.timeEvents[t.timeEvents.length - 1].timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}

                    {/* Time action buttons */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                      {(state === 'Not Started' || state === 'Paused') && (
                        <button onClick={() => onTimeAction(t.id, 'start', 'In Progress')}
                          style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 6, border: `1px solid #2563EB60`, color: '#2563EB', background: '#EFF6FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, boxShadow: '0 0 6px #60A5FA40' }}>
                          <Play size={10} /> {state === 'Paused' ? 'Resume' : 'Start'}
                        </button>
                      )}
                      {state === 'In Progress' && (
                        <>
                          <button onClick={() => onTimeAction(t.id, 'pause', 'Paused')}
                            style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 6, border: '1px solid #D97706 60', color: '#D97706', background: '#FFFBEB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, boxShadow: '0 0 6px #FCD34D40' }}>
                            <Pause size={10} /> Pause
                          </button>
                          <button onClick={() => onTimeAction(t.id, 'end', 'Ended')}
                            style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 6, border: '1px solid #05966960', color: '#059669', background: '#ECFDF5', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, boxShadow: '0 0 6px #34D39940' }}>
                            <CheckCircle2 size={10} /> End
                          </button>
                        </>
                      )}
                      {state === 'Rework' && (
                        <button onClick={() => onTimeAction(t.id, 'start', 'Rework')}
                          style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: '4px 0', borderRadius: 6, border: '1px solid #7C3AED60', color: '#7C3AED', background: '#F5F3FF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, boxShadow: '0 0 6px #A78BFA40' }}>
                          <Play size={10} /> Start Rework
                        </button>
                      )}
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {t.contentOwner && <Badge label={`Con: ${t.contentOwner}`} color="#B45309" bg="#FFFBEB" />}
                      {t.webOwner && <Badge label={`Web: ${t.webOwner}`} color="#065F46" bg="#ECFDF5" />}
                      {(t.estHoursSEO || t.estHours) ? <Badge label={`${t.estHoursSEO || t.estHours}h`} color="#555" bg="#F3F4F6" /> : null}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--color-text-tertiary)', marginTop: 5, opacity: 0.5 }}>⠿ drag to move</div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div style={{ fontSize: 10, color: isOver ? col.color : 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px 0', fontStyle: isOver ? 'normal' : 'italic', fontWeight: isOver ? 600 : 400, border: `1.5px dashed ${isOver ? col.color : col.border}`, borderRadius: 8, boxShadow: isOver ? col.glow : 'none', transition: 'all .15s' }}>
                  {isOver ? '⊕ Drop here' : 'Empty'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Live timer shown on in-progress kanban cards
function KanbanTimer({ timeEvents, state, estHours }: { timeEvents: any[]; state: string; estHours: number }) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let activeMs = 0;
  let lastStart: number | null = null;
  for (const e of timeEvents) {
    const ts = new Date(e.timestamp).getTime();
    if (e.type === 'start' || e.type === 'resume' || e.type === 'rework_start') lastStart = ts;
    else if ((e.type === 'pause' || e.type === 'end') && lastStart) { activeMs += ts - lastStart; lastStart = null; }
  }
  if (lastStart && (state === 'In Progress' || state === 'Rework')) activeMs += now - lastStart;

  const h = Math.floor(activeMs / 3600000);
  const m = Math.floor((activeMs % 3600000) / 60000);
  const s = Math.floor((activeMs % 60000) / 1000);
  const fmt = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const estMs = estHours * 3600000;
  const atLimit = estHours > 0 && activeMs >= estMs;
  const overBy = estHours > 0 ? activeMs - estMs : 0;
  const overBadge = overBy >= 15 * 60000; // 15 min threshold

  return (
    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5, flexWrap:'wrap' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: state === 'Rework' ? '#7F77DD' : '#185FA5', animation: 'pulse 1.5s infinite' }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: state === 'Rework' ? '#3C3489' : '#0C447C' }}>{fmt}</span>
      {estHours > 0 && <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>/ {estHours}h est</span>}
      {!estHours && <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>active</span>}
      {atLimit && !overBadge && <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 6px', borderRadius: 99, color: '#D97706', background: '#FFFBEB', border: '1px solid #D9770640' }}>At limit</span>}
      {overBadge && <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 6px', borderRadius: 99, color: '#DC2626', background: '#FEF2F2', border: '1px solid #DC262640' }}>Over est +{Math.floor(overBy/3600000)}h{Math.floor((overBy%3600000)/60000)}m</span>}
    </div>
  );
}

export function TodayTasks({ tasks: propTasks }: { tasks: Task[] }) {
  const { tasks, setTasks, adminOptions, currentUser, isAdmin } = useAppContext();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  const role = currentUser?.role || 'seo';
  const isSEO = role === 'seo' || isAdmin;
  const isContent = role === 'content';
  const isWeb = role === 'web';

  const [dateFrom, setDateFrom] = useState(isAdmin ? todayStr : '');
  const [dateTo, setDateTo] = useState(isAdmin ? todayStr : '');
  const [clientFilter, setClientFilter] = useState('All');
  const [ownerFilter, setOwnerFilter] = useState(() => !isAdmin && currentUser?.ownerName ? currentUser.ownerName : 'All');
  const [stageFilter, setStageFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(isAdmin);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedKw, setExpandedKw] = useState(false);
  const [activeCapsule, setActiveCapsule] = useState<string | null>(null); // capsule filter
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const isToday = isAdmin ? (dateFrom === todayStr && dateTo === todayStr) : (!dateFrom && !dateTo);

  // Inline edit for actual hours / target url
  const [inlineEdits, setInlineEdits] = useState<Record<string, Partial<Task>>>({});
  const getInline = (id: string, field: keyof Task, fallback: any) => (inlineEdits[id]?.[field] !== undefined ? inlineEdits[id][field] : fallback) as any;
  const setInline = (id: string, field: keyof Task, val: any) => setInlineEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  const saveInline = (id: string) => {
    if (!inlineEdits[id]) return;
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...inlineEdits[id] } : t));
    setInlineEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const filtered = useMemo(() => propTasks.filter(t => {
    const hasDateFilter = dateFrom || dateTo;
    if (hasDateFilter) {
      const inRange = (d?: string) => d && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
      if (!inRange(t.intakeDate) && !inRange(t.contentAssignedDate) && !inRange(t.webAssignedDate)) return false;
    }
    if (clientFilter !== 'All' && t.client !== clientFilter) return false;
    if (stageFilter !== 'All' && t.seoStage !== stageFilter) return false;
    if (ownerFilter !== 'All') {
      if (!isAdmin && currentUser?.ownerName) {
        // Non-admin: always filter to themselves
        if (role === 'seo' && t.seoOwner !== currentUser.ownerName) return false;
        if (role === 'content' && t.contentOwner !== currentUser.ownerName) return false;
        if (role === 'web' && t.webOwner !== currentUser.ownerName) return false;
      }
    }
    return true;
  }), [propTasks, dateFrom, dateTo, clientFilter, ownerFilter, stageFilter, isAdmin, currentUser, role]);

  const saveEdit = (updated: Partial<Task>) => {
    if (!editingTask) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...updated } : t));
    setEditingTask(null);
  };

  const handleKanbanMove = (taskId: string, newState: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const now = new Date().toISOString();
      const isCompleted = newState === 'Ended';
      const events = [...(t.timeEvents || [])];
      let updatedReworkEntries = t.reworkEntries ? [...t.reworkEntries] : undefined;
      const prevState = t.executionState || 'Not Started';
      if (newState === 'In Progress' && prevState !== 'In Progress') {
        if (updatedReworkEntries && updatedReworkEntries.length > 0) {
          const latest = updatedReworkEntries[updatedReworkEntries.length - 1];
          if (!latest.startTimestamp || latest.startTimestamp === '') {
            updatedReworkEntries = [...updatedReworkEntries.slice(0, -1), { ...latest, startTimestamp: now }];
            events.push({ type: 'rework_start' as any, timestamp: now, department: t.currentOwner });
            return { ...t, executionState: 'Rework' as any, isCompleted: false, timeEvents: events, reworkEntries: updatedReworkEntries };
          }
        }
        events.push({ type: prevState === 'Paused' ? 'resume' : 'start' as any, timestamp: now, department: t.currentOwner });
      } else if (newState === 'Paused' && prevState === 'In Progress') {
        events.push({ type: 'pause' as any, timestamp: now, department: t.currentOwner });
      } else if (newState === 'Ended') {
        if (updatedReworkEntries && updatedReworkEntries.length > 0) {
          const latest = updatedReworkEntries[updatedReworkEntries.length - 1];
          if (latest.startTimestamp && !latest.endTimestamp) {
            const durationMs = new Date(now).getTime() - new Date(latest.startTimestamp).getTime();
            updatedReworkEntries = [...updatedReworkEntries.slice(0, -1), { ...latest, endTimestamp: now, durationMs }];
          }
        }
        events.push({ type: 'end' as any, timestamp: now, department: t.currentOwner });
      }
      return { ...t, executionState: newState as any, isCompleted, timeEvents: events, reworkEntries: updatedReworkEntries };
    }));
  };

  const handleTimeAction = (taskId: string, type: string, newState: ExecutionState) => {
    handleKanbanMove(taskId, newState);
  };

  const delayed = useMemo(() => filtered.filter(t => {
    if (t.isCompleted) return false;
    const ad = t.currentOwner === 'SEO' ? t.intakeDate : t.currentOwner === 'Content' ? t.contentAssignedDate : t.webAssignedDate;
    const est = t.currentOwner === 'SEO' ? (t.estHoursSEO || t.estHours || 0) : t.currentOwner === 'Content' ? (t.estHoursContent || 0) : (t.estHoursWeb || 0);
    return getDeptDelayedInfo(ad || '', est, 0).isDelayed;
  }), [filtered]);
  const inProgress = useMemo(() => filtered.filter(t => t.executionState === 'In Progress'), [filtered]);
  const completed = useMemo(() => filtered.filter(t => t.isCompleted || t.executionState === 'Ended'), [filtered]);
  const qcPending = useMemo(() => filtered.filter(t => t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC'), [filtered]);

  const reworkTasks = filtered.filter(t => t.executionState === 'Rework' || t.seoQcStatus === 'Rework' || (t.reworkEntries && t.reworkEntries.length > 0 && !t.reworkEntries[t.reworkEntries.length-1]?.endTimestamp));
  const notStarted = filtered.filter(t => !t.isCompleted && (!t.executionState || t.executionState === 'Not Started'));
  const paused = filtered.filter(t => t.executionState === 'Paused');

  // Capsule-filtered view (on top of all other filters)
  const capsuleFiltered = useMemo(() => {
    if (!activeCapsule) return filtered;
    if (activeCapsule === 'In Progress') return inProgress;
    if (activeCapsule === 'Not Started') return notStarted;
    if (activeCapsule === 'Paused') return paused;
    if (activeCapsule === 'Rework') return reworkTasks;
    if (activeCapsule === 'QC Submitted') return qcPending;
    if (activeCapsule === 'Delayed') return delayed;
    if (activeCapsule === 'Completed') return completed;
    return filtered;
  }, [filtered, activeCapsule, inProgress, notStarted, paused, reworkTasks, qcPending, delayed, completed]);

  // Owner capacity for insights
  const myOwnerName = currentUser?.ownerName || '';
  const myAssignedHrs = useMemo(() => {
    return propTasks.filter(t => t.seoOwner === myOwnerName && !t.isCompleted)
      .reduce((s, t) => s + (t.estHoursSEO || t.estHours || 0), 0);
  }, [propTasks, myOwnerName]);
  const myBalanceHrs = Math.max(0, TARGET_H - myAssignedHrs);

  // CAPSULE DEFINITIONS
  const CAPSULES = [
    { key: 'All', label: 'All', count: filtered.length, color: '#555', bg: '#F3F4F6', glow: 'none' },
    { key: 'In Progress', label: 'In Progress', count: inProgress.length, color: '#2563EB', bg: '#EFF6FF', glow: '0 0 8px #60A5FA60' },
    { key: 'Not Started', label: 'Not Started', count: notStarted.length, color: '#888780', bg: '#F1EFE8', glow: 'none' },
    { key: 'Paused', label: 'Paused', count: paused.length, color: '#D97706', bg: '#FFFBEB', glow: '0 0 8px #FCD34D50' },
    { key: 'Rework', label: 'Rework', count: reworkTasks.length, color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 8px #A78BFA60' },
    { key: 'QC Submitted', label: 'QC Submitted', count: qcPending.length, color: '#0891B2', bg: '#ECFEFF', glow: '0 0 8px #22D3EE60' },
    { key: 'Delayed', label: 'Delayed', count: delayed.length, color: '#DC2626', bg: '#FEF2F2', glow: '0 0 8px #F8717160' },
    { key: 'Completed', label: 'Completed', count: completed.length, color: '#059669', bg: '#ECFDF5', glow: '0 0 8px #34D39960' },
  ];

  // ── ROLE-AWARE INSIGHT PILLS ──
  const insightPills = useMemo(() => {
    const pills: { icon: string; text: string; color: string; bg: string; glow: string }[] = [];
    const myName = currentUser?.ownerName || '';

    if (isSEO) {
      // Delayed tasks
      if (delayed.length > 0)
        pills.push({ icon: '⚠', text: `${delayed.length} task${delayed.length>1?'s':''} delayed — ${delayed.slice(0,2).map(t=>t.title).join(', ')}${delayed.length>2?` +${delayed.length-2} more`:''}`, color: '#DC2626', bg: '#FEF2F2', glow: '0 0 6px #F8717140' });

      // QC waiting
      const qcWaiting = filtered.filter(t => t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC');
      if (qcWaiting.length > 0)
        pills.push({ icon: '⊙', text: `${qcWaiting.length} QC waiting for review — ${qcWaiting.slice(0,2).map(t=>`${t.title} (${t.contentOwner||t.webOwner||'?'})`).join(', ')}`, color: '#0891B2', bg: '#ECFEFF', glow: '0 0 6px #22D3EE40' });

      // Rework not started
      const reworkNotStarted = reworkTasks.filter(t => !t.executionState || t.executionState === 'Not Started' || (t.reworkEntries && t.reworkEntries.length > 0 && !t.reworkEntries[t.reworkEntries.length-1].startTimestamp));
      if (reworkNotStarted.length > 0)
        pills.push({ icon: '↺', text: `${reworkNotStarted.length} rework not started yet — ${reworkNotStarted.slice(0,2).map(t=>t.webOwner||t.contentOwner||'?').join(', ')}`, color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 6px #A78BFA40' });

      // My capacity
      if (myName && myBalanceHrs >= 2)
        pills.push({ icon: '⏱', text: `${myName} — ${myBalanceHrs.toFixed(1)}h free today`, color: '#D97706', bg: '#FFFBEB', glow: 'none' });

      // Active timers
      const running = filtered.filter(t => t.executionState === 'In Progress');
      if (running.length > 0)
        pills.push({ icon: '▶', text: `${running.length} task${running.length>1?'s':''} running now — ${running.slice(0,2).map(t=>t.seoOwner).join(', ')}`, color: '#2563EB', bg: '#EFF6FF', glow: '0 0 6px #60A5FA40' });

      // Completions this week
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      const weekStartStr = weekStart.toISOString().split('T')[0];
      const doneThisWeek = propTasks.filter(t => (t.isCompleted || t.executionState === 'Ended') && t.intakeDate >= weekStartStr).length;
      if (doneThisWeek > 0)
        pills.push({ icon: '✓', text: `${doneThisWeek} task${doneThisWeek>1?'s':''} completed this week`, color: '#059669', bg: '#ECFDF5', glow: '0 0 6px #34D39940' });

      // Missing keywords
      const noKw = filtered.filter(t => !t.focusedKw && !t.isCompleted).length;
      if (noKw > 0)
        pills.push({ icon: '⊘', text: `${noKw} task${noKw>1?'s':''} missing keyword data`, color: '#888780', bg: '#F1EFE8', glow: 'none' });

      // Rank improvements
      const improved = propTasks.filter(t => t.marRank && t.currentRank && t.currentRank < t.marRank).length;
      if (improved > 0)
        pills.push({ icon: '⤴', text: `${improved} keyword${improved>1?'s':''} improved in rank`, color: '#0891B2', bg: '#ECFEFF', glow: '0 0 6px #22D3EE30' });

      // Admin only: stale team tasks (not started 2+ days)
      if (isAdmin) {
        const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate()-2);
        const staleStr = twoDaysAgo.toISOString().split('T')[0];
        const stale = propTasks.filter(t => (!t.executionState || t.executionState==='Not Started') && !t.isCompleted && t.intakeDate <= staleStr);
        if (stale.length > 0)
          pills.push({ icon: '🕐', text: `${stale.length} task${stale.length>1?'s':''} not started in 2+ days`, color: '#DC2626', bg: '#FEF2F2', glow: '0 0 6px #F8717130' });
      }
    }

    if (isContent) {
      // Their tasks
      const myTasks = propTasks.filter(t => t.contentOwner === myName && !t.isCompleted);
      if (myTasks.length > 0)
        pills.push({ icon: '📋', text: `${myTasks.length} task${myTasks.length>1?'s':''} in your queue`, color: '#D97706', bg: '#FFFBEB', glow: 'none' });

      // QC submitted — waiting for SEO
      const submitted = propTasks.filter(t => t.contentOwner === myName && (t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC'));
      if (submitted.length > 0)
        pills.push({ icon: '⊙', text: `${submitted.length} submitted — waiting for SEO review`, color: '#0891B2', bg: '#ECFEFF', glow: '0 0 6px #22D3EE40' });

      // Approved by SEO
      const approved = propTasks.filter(t => t.contentOwner === myName && t.contentStatus === 'Approved');
      if (approved.length > 0)
        pills.push({ icon: '✓', text: `${approved.length} approved by SEO`, color: '#059669', bg: '#ECFDF5', glow: '0 0 6px #34D39930' });

      // Rework sent back to them
      const myRework = propTasks.filter(t => t.contentOwner === myName && (t.executionState === 'Rework' || t.seoQcStatus === 'Rework'));
      if (myRework.length > 0)
        pills.push({ icon: '↺', text: `${myRework.length} rework sent back to you`, color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 6px #A78BFA40' });

      // Currently active
      const running = propTasks.filter(t => t.contentOwner === myName && t.executionState === 'In Progress');
      if (running.length > 0)
        pills.push({ icon: '▶', text: `${running.length} task${running.length>1?'s':''} running now`, color: '#2563EB', bg: '#EFF6FF', glow: '0 0 6px #60A5FA40' });

      // Missing actual hours (done but no hours logged)
      const noHrs = propTasks.filter(t => t.contentOwner === myName && t.isCompleted && !t.actualHours).length;
      if (noHrs > 0)
        pills.push({ icon: '⊘', text: `${noHrs} completed task${noHrs>1?'s':''} missing actual hours`, color: '#DC2626', bg: '#FEF2F2', glow: 'none' });

      if (pills.length === 0)
        pills.push({ icon: '✓', text: 'All clear — no pending actions', color: '#059669', bg: '#ECFDF5', glow: '0 0 6px #34D39930' });
    }

    if (isWeb) {
      const myTasks = propTasks.filter(t => t.webOwner === myName && !t.isCompleted);
      if (myTasks.length > 0)
        pills.push({ icon: '📋', text: `${myTasks.length} task${myTasks.length>1?'s':''} in your queue`, color: '#1D9E75', bg: '#ECFDF5', glow: 'none' });

      const noUrl = propTasks.filter(t => t.webOwner === myName && t.isCompleted && !t.targetUrl).length;
      if (noUrl > 0)
        pills.push({ icon: '🔗', text: `${noUrl} task${noUrl>1?'s':''} missing target URL`, color: '#DC2626', bg: '#FEF2F2', glow: '0 0 6px #F8717130' });

      const submitted = propTasks.filter(t => t.webOwner === myName && t.webStatus === 'Pending QC');
      if (submitted.length > 0)
        pills.push({ icon: '⊙', text: `${submitted.length} submitted — waiting for SEO`, color: '#0891B2', bg: '#ECFEFF', glow: '0 0 6px #22D3EE40' });

      const myRework = propTasks.filter(t => t.webOwner === myName && (t.executionState === 'Rework' || t.webStatus === 'Rework'));
      if (myRework.length > 0)
        pills.push({ icon: '↺', text: `${myRework.length} rework sent back to you`, color: '#7C3AED', bg: '#F5F3FF', glow: '0 0 6px #A78BFA40' });

      const running = propTasks.filter(t => t.webOwner === myName && t.executionState === 'In Progress');
      if (running.length > 0)
        pills.push({ icon: '▶', text: `${running.length} task${running.length>1?'s':''} running now`, color: '#2563EB', bg: '#EFF6FF', glow: '0 0 6px #60A5FA40' });

      if (pills.length === 0)
        pills.push({ icon: '✓', text: 'All clear — no pending actions', color: '#059669', bg: '#ECFDF5', glow: '0 0 6px #34D39930' });
    }

    return pills;
  }, [isSEO, isContent, isWeb, filtered, delayed, qcPending, reworkTasks, inProgress, completed, myAssignedHrs, myBalanceHrs, propTasks, isAdmin, currentUser]);

  // th helper
  const TH = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <th style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap', textAlign: 'left', ...style }}>{children}</th>
  );
  const TD = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <td style={{ fontSize: 11, padding: '6px 8px', borderBottom: '0.5px solid var(--color-border-tertiary)', verticalAlign: 'middle', ...style }}>{children}</td>
  );

  const roleAccentColor = isContent ? '#BA7517' : isWeb ? '#1D9E75' : '#185FA5';
  const roleAccentBg = isContent ? '#FAEEDA' : isWeb ? '#E1F5EE' : '#E6F1FB';

  const exportCSV = () => {
    const headers = ['Intake Date','Task','Client','Stage','SEO Owner','Current Owner',
      ...(isSEO ? ['Content Owner','Content Status','SEO QC','Est Content Hrs','Actual Hrs','Web Owner','Web Status','Est Web Hrs','Target URL'] : []),
      ...(isContent ? ['Content Status','SEO QC Status','Est Content Hrs','Actual Hours'] : []),
      ...(isWeb ? ['Web Status','Est Web Hrs','Target URL','Actual Hours'] : []),
    ];
    const rows = filtered.map(t => [
      t.intakeDate, `"${t.title.replace(/"/g,'""')}"`, t.client, t.seoStage, t.seoOwner, t.currentOwner,
      ...(isSEO ? [t.contentOwner||'', t.contentStatus||'', t.seoQcStatus||'', t.estHoursContent||'', t.actualHours||'', t.webOwner||'', t.webStatus||'', t.estHoursWeb||'', t.targetUrl||''] : []),
      ...(isContent ? [t.contentStatus||'', t.seoQcStatus||'', t.estHoursContent||'', t.actualHours||''] : []),
      ...(isWeb ? [t.webStatus||'', t.estHoursWeb||'', t.targetUrl||'', t.actualHours||''] : []),
    ].join(','));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' }));
    a.download = `tasks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {editingTask && <EditTaskModal task={editingTask} onSave={saveEdit} onClose={() => setEditingTask(null)} />}

      {/* Greeting */}
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{getGreeting()}{currentUser?.name ? `, ${currentUser.name}` : ''}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{todayDate} · {filtered.length} tasks · {completed.length} completed · {inProgress.length} in progress</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {delayed.length > 0 && <Badge label={`${delayed.length} delayed`} color="#791F1F" bg="#FCEBEB" />}
            {qcPending.length > 0 && isSEO && <Badge label={`${qcPending.length} QC pending`} color="#085041" bg="#E1F5EE" />}
            <button onClick={exportCSV} className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50">Export CSV</button>
            {isAdmin && <button onClick={() => setShowFilters(f => !f)} className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-zinc-500 hover:bg-zinc-50">{showFilters ? 'Hide' : 'Filters'}</button>}
            {isSEO && (
              <div className="flex bg-zinc-100 p-1 rounded-lg gap-0.5">
                <button onClick={() => setViewMode('list')} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors', viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500')}>List</button>
                <button onClick={() => setViewMode('kanban')} className={cn('px-2.5 py-1 text-xs rounded-md transition-colors', viewMode === 'kanban' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500')}>Kanban</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters (admin only) */}
      {showFilters && (
        <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 shadow-sm">
          <div className="flex flex-wrap gap-3 items-end">
            {[['From', dateFrom, setDateFrom], ['To', dateTo, setDateTo]].map(([label, val, set]: any) => (
              <div key={label}><label className="block text-[10px] text-zinc-400 mb-1">{label}</label>
                <input type="date" value={val} onChange={e => set(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700" /></div>
            ))}
            <div><label className="block text-[10px] text-zinc-400 mb-1">Client</label>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                <option value="All">All clients</option>{adminOptions.clients.map(c => <option key={c}>{c}</option>)}
              </select></div>
            <div><label className="block text-[10px] text-zinc-400 mb-1">Stage</label>
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="text-xs border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-700">
                <option value="All">All stages</option>{adminOptions.seoStages.map(s => <option key={s}>{s}</option>)}
              </select></div>
            {!isToday && <button onClick={() => { setDateFrom(isAdmin ? todayStr : ''); setDateTo(isAdmin ? todayStr : ''); setClientFilter('All'); setStageFilter('All'); }}
              className="text-xs px-3 py-1.5 border border-zinc-200 rounded-lg text-red-400 hover:bg-red-50 self-end">Reset</button>}
          </div>
        </div>
      )}

      {/* ── CAPSULE FILTER STRIP ── */}
      <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 shadow-sm">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginRight: 2, fontWeight: 500 }}>FILTER:</span>
          {(CAPSULES.filter(c => c.count > 0 || c.key === 'All') as any[]).map(({ key, ...c }: any) => (
            <Capsule key={key} label={c.label} count={c.count} active={activeCapsule === key || (!activeCapsule && key === 'All')}
              color={c.color} bg={c.bg} glow={c.glow}
              onClick={() => { setActiveCapsule(key === 'All' ? null : (activeCapsule === key ? null : key)); setPage(1); }} />
          ))}
          {activeCapsule && (
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>
              Showing {capsuleFiltered.length} task{capsuleFiltered.length !== 1 ? 's' : ''} — <button onClick={() => setActiveCapsule(null)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10 }}>clear ×</button>
            </span>
          )}
        </div>
      </div>

      {/* ── INSIGHT PILLS ── */}
      {insightPills.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3 shadow-sm">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Today's insights</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {insightPills.map((p, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 99, fontSize: 11, fontWeight: 500, color: p.color, background: p.bg, border: `1px solid ${p.color}40`, boxShadow: p.glow, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 12 }}>{p.icon}</span> {p.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── KANBAN ── */}
      {isSEO && viewMode === 'kanban' && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
          <KanbanView tasks={capsuleFiltered} onEdit={setEditingTask} onMove={handleKanbanMove} onTimeAction={handleTimeAction} />
        </div>
      )}

      {/* Main table */}
      {viewMode === 'list' && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 flex-wrap gap-2">
            <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {isSEO ? 'SEO' : isContent ? 'Content' : 'Web'} task tracker — showing {Math.min(page * perPage, capsuleFiltered.length)} of {capsuleFiltered.length}{activeCapsule ? ` · ${activeCapsule}` : ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>Per page:</span>
              {[10, 25, 50].map(n => (
                <button key={n} onClick={() => { setPerPage(n); setPage(1); }} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 500, border: `0.5px solid ${perPage===n ? '#2563EB' : 'var(--color-border-secondary)'}`, color: perPage===n ? '#2563EB' : 'var(--color-text-secondary)', background: perPage===n ? '#EFF6FF' : 'transparent', cursor: 'pointer', boxShadow: perPage===n ? '0 0 6px #60A5FA40' : 'none' }}>{n}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 480 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSEO ? 1100 : 700 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                {isSEO ? (
                  <tr>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C' }}>Intake Date</TH>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C', minWidth: 200 }}>Task</TH>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C' }}>Client</TH>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C' }}>Stage</TH>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C' }}>SEO Owner</TH>
                    <TH style={{ background: '#E6F1FB', color: '#0C447C' }}>Est SEO</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Con. Date</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Con. Owner</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Con. Status</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Web Date</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Web Owner</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Web Status</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Target URL</TH>
                    <TH style={{ background: '#EAF3DE', color: '#27500A' }}>Current Owner</TH>
                    <TH style={{ background: 'var(--color-background-secondary)' }}>Edit</TH>
                  </tr>
                ) : isContent ? (
                  <tr>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Con. Assigned</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806', minWidth: 200 }}>Task</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Client</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Stage</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>SEO Owner</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Con. Status</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>SEO QC Status</TH>
                    <TH style={{ background: '#BA7517', color: '#fff' }}>Est Hrs ✎</TH>
                    <TH style={{ background: '#FAEEDA', color: '#633806' }}>Actual Hrs</TH>
                    <TH style={{ background: 'var(--color-background-secondary)' }}>Edit</TH>
                  </tr>
                ) : (
                  <tr>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Web Assigned</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041', minWidth: 200 }}>Task</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Client</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Stage</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>SEO Owner</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Web Status</TH>
                    <TH style={{ background: '#1D9E75', color: '#fff' }}>Est Hrs ✎</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Target URL ✎</TH>
                    <TH style={{ background: '#E1F5EE', color: '#085041' }}>Actual Hrs</TH>
                    <TH style={{ background: 'var(--color-background-secondary)' }}>Edit</TH>
                  </tr>
                )}
              </thead>
              <tbody>
                {capsuleFiltered.length === 0 ? (
                  <tr><td colSpan={20} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 12, fontStyle: 'italic' }}>No tasks match current filters</td></tr>
                ) : capsuleFiltered.slice((page-1)*perPage, page*perPage).map(task => {
                  const isDelayedRow = delayed.some(d => d.id === task.id);
                  const taskState = task.isCompleted ? 'Ended' : (task.executionState || 'Not Started');
                  const isReworkRow = taskState === 'Rework' || task.seoQcStatus === 'Rework';
                  const isQCRow = task.seoQcStatus === 'Pending QC' || task.seoQcStatus === 'QC' || task.webStatus === 'Pending QC';
                  const isPausedRow = taskState === 'Paused';
                  const isRunningRow = taskState === 'In Progress';
                  const isDoneRow = task.isCompleted || taskState === 'Ended';

                  // Capsule-aware row highlight — neon tint matching the active filter
                  const rowBg = activeCapsule === 'Delayed' && isDelayedRow ? '#FEF2F2'
                    : activeCapsule === 'Rework' && isReworkRow ? '#F5F3FF'
                    : activeCapsule === 'QC Submitted' && isQCRow ? '#ECFEFF'
                    : activeCapsule === 'In Progress' && isRunningRow ? '#EFF6FF'
                    : activeCapsule === 'Paused' && isPausedRow ? '#FFFBEB'
                    : activeCapsule === 'Completed' && isDoneRow ? '#ECFDF5'
                    : isDelayedRow ? '#FEF2F250'  // always tint delayed rows lightly
                    : 'transparent';

                  // Left border accent per state
                  const rowBorderLeft = isDelayedRow ? '3px solid #DC2626'
                    : isReworkRow ? '3px solid #7C3AED'
                    : isQCRow ? '3px solid #0891B2'
                    : isRunningRow ? '3px solid #2563EB'
                    : isPausedRow ? '3px solid #D97706'
                    : isDoneRow ? '3px solid #059669'
                    : 'none';

                  const hasInlineEdit = !!inlineEdits[task.id];

                  const EditBtn = () => (
                    <button onClick={() => setEditingTask(task)} style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, border: '0.5px solid var(--color-border-secondary)', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Pencil size={11} /> Edit
                    </button>
                  );

                  if (isSEO) return (
                    <tr key={task.id} style={{ background: rowBg, borderLeft: rowBorderLeft }} className="hover:brightness-95 transition-all">
                      <TD><span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{task.intakeDate}</span></TD>
                      <TD>
                        <div style={{ fontWeight: 500, color: 'var(--color-text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.title}>{task.title}</div>
                        {isDelayedRow && <Badge label="Delayed" color="#791F1F" bg="#FCEBEB" />}
                      </TD>
                      <TD>{task.client}</TD>
                      <TD>{task.seoStage}</TD>
                      <TD>{task.seoOwner}</TD>
                      <TD style={{ textAlign: 'center' }}>{task.estHoursSEO || task.estHours || '—'}</TD>
                      <TD style={{ background: '#FAEEDA10' }}><span style={{ fontSize: 10, color: '#BA7517' }}>{task.contentAssignedDate || '—'}</span></TD>
                      <TD style={{ background: '#FAEEDA10' }}><span style={{ fontSize: 10, color: '#BA7517' }}>{task.contentOwner || '—'}</span></TD>
                      <TD style={{ background: '#FAEEDA10' }}>{statusBadge(task.contentStatus)}</TD>
                      <TD style={{ background: '#E1F5EE10' }}><span style={{ fontSize: 10, color: '#1D9E75' }}>{task.webAssignedDate || '—'}</span></TD>
                      <TD style={{ background: '#E1F5EE10' }}><span style={{ fontSize: 10, color: '#085041' }}>{task.webOwner || '—'}</span></TD>
                      <TD style={{ background: '#E1F5EE10' }}>{statusBadge(task.webStatus)}</TD>
                      <TD style={{ background: '#E1F5EE10' }}><a href={task.targetUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: '#185FA5', maxWidth: 120, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.targetUrl || '—'}</a></TD>
                      <TD><Badge label={task.currentOwner} color={task.currentOwner === 'Content' ? '#633806' : task.currentOwner === 'Web' ? '#085041' : '#0C447C'} bg={task.currentOwner === 'Content' ? '#FAEEDA' : task.currentOwner === 'Web' ? '#E1F5EE' : '#E6F1FB'} /></TD>
                      <TD><EditBtn /></TD>
                    </tr>
                  );

                  if (isContent) return (
                    <tr key={task.id} style={{ background: rowBg, borderLeft: rowBorderLeft }} className="hover:brightness-95 transition-all">
                      <TD style={{ background: '#FAEEDA10' }}><span style={{ fontSize: 10, color: '#BA7517' }}>{task.contentAssignedDate || '—'}</span></TD>
                      <TD><div style={{ fontWeight: 500, color: 'var(--color-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.title}>{task.title}</div></TD>
                      <TD>{task.client}</TD>
                      <TD>{task.seoStage}</TD>
                      <TD>{task.seoOwner}</TD>
                      <TD>{statusBadge(task.contentStatus)}</TD>
                      <TD>{statusBadge(task.seoQcStatus)}</TD>
                      <TD style={{ background: '#FAEEDA30' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" value={getInline(task.id, 'estHoursContent', task.estHoursContent || '')} onChange={e => setInline(task.id, 'estHoursContent', Number(e.target.value))}
                            style={{ width: 50, fontSize: 11, border: '0.5px solid #FAC775', borderRadius: 5, padding: '2px 5px', background: '#FAEEDA50' }} />
                          {hasInlineEdit && <button onClick={() => saveInline(task.id)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, background: '#BA7517', color: '#fff', cursor: 'pointer', border: 'none' }}>Save</button>}
                        </div>
                      </TD>
                      <TD style={{ textAlign: 'center', fontSize: 11, color: '#6b7280' }}>{fmtHrs(calcActualHours(task.timeEvents || []))}</TD>
                      <TD><EditBtn /></TD>
                    </tr>
                  );

                  // Web
                  return (
                    <tr key={task.id} style={{ background: rowBg, borderLeft: rowBorderLeft }} className="hover:brightness-95 transition-all">
                      <TD style={{ background: '#E1F5EE10' }}><span style={{ fontSize: 10, color: '#1D9E75' }}>{task.webAssignedDate || '—'}</span></TD>
                      <TD><div style={{ fontWeight: 500, color: 'var(--color-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.title}>{task.title}</div></TD>
                      <TD>{task.client}</TD>
                      <TD>{task.seoStage}</TD>
                      <TD>{task.seoOwner}</TD>
                      <TD>{statusBadge(task.webStatus)}</TD>
                      <TD style={{ background: '#E1F5EE30' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" value={getInline(task.id, 'estHoursWeb', task.estHoursWeb || '')} onChange={e => setInline(task.id, 'estHoursWeb', Number(e.target.value))}
                            style={{ width: 50, fontSize: 11, border: '0.5px solid #9FE1CB', borderRadius: 5, padding: '2px 5px', background: '#E1F5EE50' }} />
                          {hasInlineEdit && <button onClick={() => saveInline(task.id)} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, background: '#1D9E75', color: '#fff', cursor: 'pointer', border: 'none' }}>Save</button>}
                        </div>
                      </TD>
                      <TD style={{ background: '#E1F5EE30' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="text" value={getInline(task.id, 'targetUrl', task.targetUrl || '')} onChange={e => setInline(task.id, 'targetUrl', e.target.value)}
                            placeholder="Add URL..." style={{ width: 120, fontSize: 10, border: '0.5px solid #9FE1CB', borderRadius: 5, padding: '2px 5px', background: '#E1F5EE50' }} />
                        </div>
                      </TD>
                      <TD style={{ textAlign: 'center', fontSize: 11, color: '#6b7280' }}>{fmtHrs(calcActualHours(task.timeEvents || []))}</TD>
                      <TD><EditBtn /></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {capsuleFiltered.length > perPage && (() => {
            const totalPages = Math.ceil(capsuleFiltered.length / perPage);
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 14px', borderTop: '0.5px solid var(--color-border-tertiary)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginRight: 6 }}>
                  {(page-1)*perPage+1}–{Math.min(page*perPage, capsuleFiltered.length)} of {capsuleFiltered.length}
                </span>
                <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color: page===1 ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>‹</button>
                {pages.map((p,i) => p === '...'
                  ? <span key={`e${i}`} style={{ fontSize:11, color:'var(--color-text-tertiary)', padding:'0 2px' }}>…</span>
                  : <button key={p} onClick={() => setPage(p as number)} style={{ width:28, height:28, borderRadius:6, border:`0.5px solid ${page===p?'#2563EB':'var(--color-border-secondary)'}`, fontSize:11, fontWeight:500, cursor:'pointer', background: page===p?'#2563EB':'transparent', color: page===p?'#fff':'var(--color-text-secondary)', boxShadow: page===p?'0 0 8px #60A5FA60':'none' }}>{p}</button>
                )}
                <button onClick={() => setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} style={{ width:28, height:28, borderRadius:6, border:'0.5px solid var(--color-border-secondary)', fontSize:12, cursor:'pointer', background:'transparent', color: page===totalPages ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)' }}>›</button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Keyword table (SEO only) */}
      {isSEO && filtered.some(t => t.focusedKw) && (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          <button onClick={() => setExpandedKw(e => !e)} className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
            <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Keyword ranking — {filtered.filter(t => t.focusedKw).length} keywords</p>
            {expandedKw ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
          </button>
          {expandedKw && (
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <TH>Intake Date</TH>
                    <TH>Task</TH>
                    <TH>Client</TH>
                    <TH>SEO Owner</TH>
                    <TH>Keyword</TH>
                    <TH style={{ textAlign: 'center' }}>Volume</TH>
                    <TH style={{ textAlign: 'center' }}>Monthly Rank</TH>
                    <TH style={{ textAlign: 'center' }}>Current Rank</TH>
                    <TH style={{ textAlign: 'center' }}>Difference</TH>
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter(t => t.focusedKw).map(task => {
                    const diff = task.marRank && task.currentRank ? task.marRank - task.currentRank : null;
                    return (
                      <tr key={task.id} className="hover:bg-zinc-50">
                        <TD><span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{task.intakeDate}</span></TD>
                        <TD><span style={{ fontWeight: 500, color: 'var(--color-text-primary)', fontSize: 11, maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.title}>{task.title}</span></TD>
                        <TD>{task.client}</TD>
                        <TD>{task.seoOwner}</TD>
                        <TD style={{ maxWidth: 160 }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.focusedKw}>{task.focusedKw}</span></TD>
                        <TD style={{ textAlign: 'center' }}>{task.volume?.toLocaleString() || '—'}</TD>
                        <TD style={{ textAlign: 'center' }}>{task.marRank || '—'}</TD>
                        <TD style={{ textAlign: 'center' }}>{task.currentRank || '—'}</TD>
                        <TD style={{ textAlign: 'center' }}>
                          {diff !== null ? (
                            <Badge label={diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${Math.abs(diff)}` : '—'} color={diff > 0 ? '#27500A' : diff < 0 ? '#791F1F' : '#444441'} bg={diff > 0 ? '#EAF3DE' : diff < 0 ? '#FCEBEB' : '#F1EFE8'} />
                          ) : '—'}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
