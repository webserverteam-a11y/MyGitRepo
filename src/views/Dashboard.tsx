import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAllOwners } from '../hooks/useAllOwners';
import { Task } from '../types';
import { getDeptDelayedInfo } from '../utils';
import { Pencil, Check, X, ExternalLink, ChevronDown, ChevronUp, Plus } from 'lucide-react';

import { calcOwnerProductiveHrs, calcOwnerOverrunHrs } from '../utils/productiveHours';

const BRAND = '#1E2D8B';

function calcActualHours(events: any[]): number {
  let ms = 0; let lastStart: number | null = null;
  for (const e of (events||[])) {
    const ts = new Date(e.timestamp).getTime();
    if (e.type==='start'||e.type==='resume'||e.type==='rework_start') lastStart = ts;
    else if ((e.type==='pause'||e.type==='end') && lastStart) { ms += ts - lastStart; lastStart = null; }
  }
  return Math.round((ms/3600000)*100)/100;
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CLIENT_CONFIG_KEY = 'seo_client_config';

interface ClientConfig {
  monthlyHours: Record<string, number>; // key: "YYYY-MM"
  strategyUrl?: string;
  notes?: string;
}
type ClientConfigMap = Record<string, ClientConfig>; // key: clientName

function loadConfig(): ClientConfigMap { try { return JSON.parse(localStorage.getItem(CLIENT_CONFIG_KEY)||'{}'); } catch { return {}; } }
function saveConfig(d: ClientConfigMap) { localStorage.setItem(CLIENT_CONFIG_KEY, JSON.stringify(d)); }

function NeonPill({ label, color, bg, glow = 'none' }: { label: string; color: string; bg: string; glow?: string }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:500, color, background:bg, border:`1px solid ${color}30`, boxShadow:glow, whiteSpace:'nowrap' }}>{label}</span>;
}

function pad2(n:number){return String(n).padStart(2,'0');}

function getMonthKey(d=new Date()){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`; }
function prevMonthKey(mk:string){ const [y,m]=mk.split('-').map(Number); const d=new Date(y,m-2,1); return getMonthKey(d); }

function isDelayed(t: Task){
  if(t.isCompleted) return false;
  const ad=t.currentOwner==='Content'?t.contentAssignedDate:t.currentOwner==='Web'?t.webAssignedDate:t.intakeDate;
  const est=t.currentOwner==='Content'?(t.estHoursContent||0):t.currentOwner==='Web'?(t.estHoursWeb||0):(t.estHoursSEO||t.estHours||0);
  return getDeptDelayedInfo(ad||'',est,0).isDelayed;
}

export function Dashboard({ tasks: propTasks }: { tasks: Task[] }) {
  const { tasks, adminOptions, currentUser, isAdmin, users } = useAppContext();
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentMonth = getMonthKey(now);
  const prevMonth = prevMonthKey(currentMonth);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [clientConfigs, setClientConfigs] = useState<ClientConfigMap>(loadConfig);
  const updateConfigs = (d: ClientConfigMap) => { setClientConfigs(d); saveConfig(d); };

  // Editing state for client row
  const [editingClient, setEditingClient] = useState<string|null>(null);
  const [editBuf, setEditBuf] = useState<{ hours: string; url: string; notes: string }>({ hours:'', url:'', notes:'' });
  const [expandedClient, setExpandedClient] = useState<string|null>(null);
  const [showInsights, setShowInsights] = useState(true);

  const myTasks = useMemo(() => {
    if (!currentUser || isAdmin) return tasks;
    if (currentUser.role==='seo') return tasks.filter(t=>t.seoOwner===currentUser.ownerName);
    if (currentUser.role==='content') return tasks.filter(t=>t.contentOwner===currentUser.ownerName);
    if (currentUser.role==='web') return tasks.filter(t=>t.webOwner===currentUser.ownerName);
    return tasks;
  }, [tasks, currentUser, isAdmin]);

  // Month filter for tasks
  const monthTasks = useMemo(() => myTasks.filter(t => {
    const d = t.intakeDate||'';
    return d.startsWith(selectedMonth);
  }), [myTasks, selectedMonth]);

  // KPIs (from all tasks, not month-filtered)
  const totalTasks = myTasks.length;
  const completed = myTasks.filter(t=>t.isCompleted||t.executionState==='Ended').length;
  const inProgress = myTasks.filter(t=>t.executionState==='In Progress').length;
  const delayed = myTasks.filter(t=>isDelayed(t)).length;
  const qcPending = myTasks.filter(t=>t.seoQcStatus==='Pending QC'||t.seoQcStatus==='QC').length;
  const rework = myTasks.filter(t=>t.executionState==='Rework'||t.seoQcStatus==='Rework'||(t.reworkEntries&&t.reworkEntries.length>0&&!t.reworkEntries[t.reworkEntries.length-1]?.endTimestamp)).length;
  const completionPct = totalTasks>0 ? Math.round(completed/totalTasks*100) : 0;

  // Client table data
  const clients = useMemo(() => adminOptions.clients.sort(), [adminOptions.clients]);

  const clientData = useMemo(() => clients.map(client => {
    const allClientTasks = myTasks.filter(t=>t.client===client);
    const monthClientTasks = allClientTasks.filter(t=>(t.intakeDate||'').startsWith(selectedMonth));
    const totalEst = monthClientTasks.reduce((s,t)=>(s+(t.estHoursSEO||t.estHours||0)+(t.estHoursContent||0)+(t.estHoursWeb||0)),0);
    const totalActual = monthClientTasks.reduce((s,t)=>s+calcActualHours(t.timeEvents||[]),0);
    const totalTasks = monthClientTasks.length;
    const done = monthClientTasks.filter(t=>t.isCompleted).length;
    const pending = monthClientTasks.filter(t=>!t.isCompleted).length;
    const qc = monthClientTasks.filter(t=>t.seoQcStatus==='Pending QC'||t.seoQcStatus==='QC').length;
    const rw = monthClientTasks.filter(t=>t.executionState==='Rework').length;
    const seoOwners = [...new Set(monthClientTasks.map(t=>t.seoOwner).filter(Boolean))];

    // Stage breakdown
    const stageMap: Record<string,number> = {};
    monthClientTasks.forEach(t=>{ stageMap[t.seoStage]=(stageMap[t.seoStage]||0)+1; });
    const stageBreakdown = Object.entries(stageMap).sort((a,b)=>b[1]-a[1]);

    // Monthly budget from config
    const config = clientConfigs[client] || {};
    const budgetHrs = config.monthlyHours?.[selectedMonth] || 0;
    const hrsRemaining = budgetHrs > 0 ? budgetHrs - totalActual : null;
    const utilPct = budgetHrs > 0 ? Math.round((totalActual/budgetHrs)*100) : null;

    // Prev month comparison
    const prevMonthTasks = allClientTasks.filter(t=>(t.intakeDate||'').startsWith(prevMonth));
    const prevActual = prevMonthTasks.reduce((s,t)=>s+calcActualHours(t.timeEvents||[]),0);

    return { client, allClientTasks, monthClientTasks, totalTasks, done, pending, qc, rw, seoOwners, totalEst, totalActual, prevActual, stageBreakdown, budgetHrs, hrsRemaining, utilPct, config };
  }), [clients, myTasks, selectedMonth, prevMonth, clientConfigs]);

  // Owner workload for today
  const ownerWorkload = useMemo(() => {
    const allOwners = (() => {
      const fromUsers = users.filter(u => u.role!=='admin' && u.ownerName?.trim()).map(u => u.ownerName.trim());
      const fromLists = [...adminOptions.seoOwners, ...adminOptions.contentOwners, ...adminOptions.webOwners];
      return Array.from(new Set([...fromUsers, ...fromLists])).filter(Boolean);
    })();
    return allOwners.map(name => {
      const productive = calcOwnerProductiveHrs(myTasks, name, todayStr, todayStr);
      const overrun = calcOwnerOverrunHrs(myTasks, name, todayStr, todayStr);
      const pct = Math.min(100, Math.round(productive/8*100));
      const color = overrun > 0 ? '#DC2626' : pct>=50 ? '#059669' : pct > 0 ? '#185FA5' : '#888780';
      const taskCount = myTasks.filter(t=>!t.isCompleted&&(t.seoOwner===name||t.contentOwner===name||t.webOwner===name)).length;
      return { name, productive, overrun, pct, color, taskCount };
    });
  }, [myTasks, adminOptions, users, todayStr]);

  // Insight pills
  const insights = useMemo(() => {
    const pills: { icon:string; text:string; color:string; bg:string; glow:string }[] = [];
    if (delayed>0) pills.push({ icon:'⚠', text:`${delayed} task${delayed>1?'s':''} delayed`, color:'#DC2626', bg:'#FEF2F2', glow:'0 0 6px #F8717140' });
    if (qcPending>0) pills.push({ icon:'⊙', text:`${qcPending} QC waiting for review`, color:'#0891B2', bg:'#ECFEFF', glow:'0 0 6px #22D3EE40' });
    if (rework>0) pills.push({ icon:'↺', text:`${rework} rework open`, color:'#7C3AED', bg:'#F5F3FF', glow:'0 0 6px #A78BFA40' });
    const over = clientData.filter(c=>c.utilPct!==null&&c.utilPct>100);
    if (over.length>0) pills.push({ icon:'📊', text:`${over.length} client${over.length>1?'s':''} over budget — ${over.slice(0,2).map(c=>c.client).join(', ')}`, color:'#DC2626', bg:'#FEF2F2', glow:'none' });
    const under = ownerWorkload.filter(o=>o.productive===0);
    if (under.length>0) pills.push({ icon:'⏱', text:`${under.map(o=>o.name).join(', ')} — no tasks assigned today`, color:'#D97706', bg:'#FFFBEB', glow:'none' });
    const noStrategy = clientData.filter(c=>c.monthClientTasks.length>0&&!c.config.strategyUrl);
    if (noStrategy.length>0) pills.push({ icon:'📄', text:`${noStrategy.length} active client${noStrategy.length>1?'s':''} missing strategy doc`, color:'#888780', bg:'#F1EFE8', glow:'none' });
    const improved = myTasks.filter(t=>t.marRank&&t.currentRank&&t.currentRank<t.marRank).length;
    if (improved>0) pills.push({ icon:'⤴', text:`${improved} keywords improved`, color:'#27500A', bg:'#EAF3DE', glow:'0 0 6px #34D39930' });
    if (completionPct>0) pills.push({ icon:'✓', text:`${completionPct}% tasks completed overall`, color:'#059669', bg:'#ECFDF5', glow:'0 0 6px #34D39930' });
    return pills;
  }, [delayed, qcPending, rework, clientData, ownerWorkload, myTasks, completionPct]);

  // Month chips
  const monthChips = useMemo(() => {
    const chips = [];
    for (let i=4; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      chips.push({ key: getMonthKey(d), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
    }
    return chips;
  }, []);

  const saveClientEdit = (client: string) => {
    const prev = clientConfigs[client] || {};
    const updated: ClientConfigMap = {
      ...clientConfigs,
      [client]: {
        ...prev,
        monthlyHours: { ...(prev.monthlyHours||{}), [selectedMonth]: Number(editBuf.hours)||0 },
        strategyUrl: editBuf.url || prev.strategyUrl,
        notes: editBuf.notes || prev.notes,
      }
    };
    updateConfigs(updated);
    setEditingClient(null);
  };

  const TH = ({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <th style={{ fontSize:9, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em', padding:'6px 10px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'left', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)', whiteSpace:'nowrap', ...style }}>{children}</th>
  );
  const TD = ({ children, style={} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <td style={{ fontSize:11, padding:'6px 10px', borderBottom:'0.5px solid var(--color-border-tertiary)', verticalAlign:'middle', color:'var(--color-text-secondary)', ...style }}>{children}</td>
  );

  return (
    <div className="space-y-4">

      {/* Header + month selector */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:500, color:BRAND }}>Dashboard</h2>
          <p style={{ fontSize:11, color:'var(--color-text-tertiary)', marginTop:2 }}>{isAdmin ? 'All owners · all clients' : currentUser?.name} · {todayStr}</p>
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {monthChips.map(c => (
            <button key={c.key} onClick={() => setSelectedMonth(c.key)}
              style={{ padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, cursor:'pointer', color:selectedMonth===c.key?'#fff':'var(--color-text-secondary)', background:selectedMonth===c.key?BRAND:'var(--color-background-secondary)', border:`0.5px solid ${selectedMonth===c.key?BRAND:'var(--color-border-secondary)'}`, transition:'all .15s' }}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,minmax(0,1fr))', gap:8 }}>
        {[
          { l:'Total tasks', v:totalTasks, c:'var(--color-text-primary)' },
          { l:'Completed', v:completed, c:'#059669', sub:`${completionPct}%` },
          { l:'In Progress', v:inProgress, c:'#2563EB' },
          { l:'Delayed', v:delayed, c:delayed>0?'#DC2626':'var(--color-text-primary)' },
          { l:'QC Pending', v:qcPending, c:'#0891B2' },
          { l:'Rework', v:rework, c:rework>0?'#7C3AED':'var(--color-text-primary)' },
        ].map(s => (
          <div key={s.l} style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 10px', textAlign:'center' }}>
            <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:500, marginBottom:3 }}>{s.l}</p>
            <p style={{ fontSize:22, fontWeight:500, color:s.c }}>{s.v}</p>
            {(s as any).sub && <p style={{ fontSize:9, color:s.c, marginTop:1 }}>{(s as any).sub}</p>}
          </div>
        ))}
      </div>

      {/* Insight pills */}
      {insights.length > 0 && (
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:9, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em' }}>Insights</span>
            <button onClick={() => setShowInsights(s=>!s)} style={{ fontSize:9, color:'var(--color-text-tertiary)', background:'none', border:'none', cursor:'pointer' }}>{showInsights ? '▲ collapse' : '▼ expand'}</button>
          </div>
          {showInsights && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {insights.map((p,i) => (
                <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:99, fontSize:11, fontWeight:500, color:p.color, background:p.bg, border:`1px solid ${p.color}30`, boxShadow:p.glow }}>
                  {p.icon} {p.text}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Owner workload (slim) */}
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
        <p style={{ fontSize:9, fontWeight:500, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:8 }}>Owner workload — today (productive / 8h)</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
          {ownerWorkload.map(o => (
            <div key={o.name} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:`${o.color}20`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color:o.color, flexShrink:0 }}>
                {o.name.slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, fontWeight:500, color:'var(--color-text-primary)' }}>{o.name}</span>
                  <span style={{ fontSize:10, color:o.color }}>{o.productive.toFixed(1)}h productive{o.overrun>0.01?` · ${o.overrun.toFixed(1)}h overrun`:''}</span>
                </div>
                <div style={{ height:4, background:'var(--color-background-secondary)', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${o.pct}%`, background:o.color, borderRadius:2 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client hours table — the main section */}
      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
          <div>
            <p style={{ fontSize:12, fontWeight:500, color:'var(--color-text-primary)' }}>Actual hours by client — {monthChips.find(c=>c.key===selectedMonth)?.label}</p>
            <p style={{ fontSize:10, color:'var(--color-text-tertiary)', marginTop:2 }}>Click Edit to set monthly budget hours + strategy doc. Hrs Remaining = Budget − Actual.</p>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <TH style={{ minWidth:130 }}>Client</TH>
                <TH>SEO Owner(s)</TH>
                <TH style={{ textAlign:'center' }}>Tasks</TH>
                <TH style={{ textAlign:'center' }}>Est Hrs</TH>
                <TH style={{ textAlign:'center' }}>Actual Hrs</TH>
                <TH style={{ background:'#E6F1FB20', color:'#0C447C', textAlign:'center' }}>Budget Hrs</TH>
                <TH style={{ background:'#E6F1FB20', color:'#0C447C', textAlign:'center' }}>Remaining</TH>
                <TH style={{ background:'#E6F1FB20', color:'#0C447C', textAlign:'center' }}>% Used</TH>
                <TH style={{ textAlign:'center' }}>Pending</TH>
                <TH style={{ textAlign:'center' }}>Done</TH>
                <TH style={{ textAlign:'center' }}>QC</TH>
                <TH style={{ textAlign:'center' }}>Rework</TH>
                <TH>Stage Mix</TH>
                <TH>Strategy</TH>
                <TH>Edit</TH>
              </tr>
            </thead>
            <tbody>
              {clientData.map(row => {
                const isEditing = editingClient === row.client;
                const isOver = row.utilPct !== null && row.utilPct > 100;
                const isExpanded = expandedClient === row.client;
                return (
                  <React.Fragment key={row.client}>
                    <tr style={{ background: isOver ? '#FEF2F210' : 'transparent' }} className="hover:brightness-95">
                      <TD>
                        <div style={{ fontWeight:500, color:'var(--color-text-primary)', display:'flex', alignItems:'center', gap:5 }}>
                          <button onClick={() => setExpandedClient(isExpanded ? null : row.client)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--color-text-tertiary)', padding:0 }}>
                            {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                          </button>
                          {row.client}
                        </div>
                      </TD>
                      <TD style={{ fontSize:10 }}>{row.seoOwners.join(', ')||'—'}</TD>
                      <TD style={{ textAlign:'center' }}>{row.monthClientTasks.length}</TD>
                      <TD style={{ textAlign:'center' }}>{row.totalEst.toFixed(1)}</TD>
                      <TD style={{ textAlign:'center', fontWeight:500, color:'var(--color-text-primary)' }}>{row.totalActual.toFixed(2)}</TD>

                      {/* Budget hrs — editable */}
                      <TD style={{ background:'#E6F1FB08', textAlign:'center' }}>
                        {isEditing ? (
                          <input type="number" value={editBuf.hours} onChange={e=>setEditBuf(b=>({...b,hours:e.target.value}))}
                            style={{ width:60, fontSize:11, border:'0.5px solid #185FA5', borderRadius:4, padding:'2px 5px', textAlign:'center' }} />
                        ) : <span style={{ fontWeight:500, color:'#0C447C' }}>{row.budgetHrs > 0 ? row.budgetHrs : <span style={{ color:'var(--color-text-tertiary)', fontStyle:'italic' }}>Set</span>}</span>}
                      </TD>

                      {/* Remaining */}
                      <TD style={{ background:'#E6F1FB08', textAlign:'center', fontWeight:500, color: row.hrsRemaining !== null ? (row.hrsRemaining < 0 ? '#DC2626' : '#059669') : 'var(--color-text-tertiary)' }}>
                        {row.hrsRemaining !== null ? (row.hrsRemaining < 0 ? `${row.hrsRemaining.toFixed(2)}` : `+${row.hrsRemaining.toFixed(2)}`) : '—'}
                      </TD>

                      {/* % Used */}
                      <TD style={{ background:'#E6F1FB08', textAlign:'center' }}>
                        {row.utilPct !== null ? (
                          <span style={{ fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:99, color:isOver?'#791F1F':'#27500A', background:isOver?'#FCEBEB':'#EAF3DE', border:`1px solid ${isOver?'#E24B4A30':'#3B6D1130'}` }}>
                            {row.utilPct}%
                          </span>
                        ) : '—'}
                      </TD>

                      <TD style={{ textAlign:'center', color: row.pending>0?'var(--color-text-secondary)':'var(--color-text-tertiary)' }}>{row.pending||'—'}</TD>
                      <TD style={{ textAlign:'center', color:'#059669' }}>{row.done||'—'}</TD>
                      <TD style={{ textAlign:'center', color:row.qc>0?'#0891B2':'var(--color-text-tertiary)' }}>{row.qc||'—'}</TD>
                      <TD style={{ textAlign:'center', color:row.rw>0?'#7C3AED':'var(--color-text-tertiary)' }}>{row.rw||'—'}</TD>

                      {/* Stage mix */}
                      <TD style={{ fontSize:10, maxWidth:200 }}>
                        <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {row.stageBreakdown.slice(0,4).map(([s,n])=>`${s}: ${n}`).join(' | ')||'—'}
                        </div>
                      </TD>

                      {/* Strategy URL */}
                      <TD>
                        {isEditing ? (
                          <input type="url" value={editBuf.url} onChange={e=>setEditBuf(b=>({...b,url:e.target.value}))}
                            placeholder="https://docs.google.com/..." style={{ width:120, fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:4, padding:'2px 5px' }} />
                        ) : row.config.strategyUrl ? (
                          <a href={row.config.strategyUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'#185FA5', display:'flex', alignItems:'center', gap:3 }}>
                            <ExternalLink size={11}/> Doc
                          </a>
                        ) : <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontStyle:'italic' }}>Add URL</span>}
                      </TD>

                      {/* Edit */}
                      <TD>
                        {isEditing ? (
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => saveClientEdit(row.client)} style={{ padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>
                              <Check size={10}/>
                            </button>
                            <button onClick={() => setEditingClient(null)} style={{ padding:'2px 6px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>
                              <X size={10}/>
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingClient(row.client); setEditBuf({ hours: String(row.budgetHrs||''), url: row.config.strategyUrl||'', notes: row.config.notes||'' }); }}
                            style={{ padding:'3px 7px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3 }}>
                            <Pencil size={10}/> Edit
                          </button>
                        )}
                      </TD>
                    </tr>

                    {/* Expanded row — prev month comparison + notes */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={15} style={{ padding:'8px 14px 12px 36px', borderBottom:'0.5px solid var(--color-border-tertiary)', background:'var(--color-background-secondary)' }}>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                            <div>
                              <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:500, marginBottom:4 }}>vs prev month ({prevMonth})</p>
                              <div style={{ display:'flex', gap:8 }}>
                                <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>Actual: <strong>{row.prevActual.toFixed(1)}h</strong></span>
                                {row.prevActual > 0 && row.totalActual > 0 && (
                                  <span style={{ fontSize:11, color:row.totalActual>row.prevActual?'#059669':'#DC2626' }}>
                                    {row.totalActual>row.prevActual?`+${(row.totalActual-row.prevActual).toFixed(1)}h`:`${(row.totalActual-row.prevActual).toFixed(1)}h`}
                                  </span>
                                )}
                              </div>
                            </div>
                            {row.config.notes && (
                              <div>
                                <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:500, marginBottom:4 }}>Notes</p>
                                <p style={{ fontSize:11, color:'var(--color-text-secondary)' }}>{row.config.notes}</p>
                              </div>
                            )}
                            <div>
                              <p style={{ fontSize:9, color:'var(--color-text-tertiary)', textTransform:'uppercase', fontWeight:500, marginBottom:4 }}>All tasks in {selectedMonth}</p>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                                {row.stageBreakdown.map(([s,n]) => (
                                  <span key={s} style={{ fontSize:10, padding:'2px 7px', borderRadius:99, background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)' }}>{s}: {n}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                          {editingClient !== row.client && (
                            <div style={{ marginTop:8 }}>
                              <button onClick={() => { setEditingClient(row.client); setEditBuf({ hours:String(row.budgetHrs||''), url:row.config.strategyUrl||'', notes:row.config.notes||'' }); }}
                                style={{ fontSize:10, padding:'3px 10px', borderRadius:6, border:`0.5px solid ${BRAND}40`, color:BRAND, background:`${BRAND}10`, cursor:'pointer' }}>
                                + Edit budget hours, strategy URL & notes for {selectedMonth}
                              </button>
                            </div>
                          )}
                          {editingClient === row.client && (
                            <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                              <div>
                                <label style={{ fontSize:9, color:'var(--color-text-tertiary)', display:'block', marginBottom:2 }}>Notes</label>
                                <input value={editBuf.notes} onChange={e=>setEditBuf(b=>({...b,notes:e.target.value}))} placeholder="Strategy notes..." style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'4px 8px', width:240, background:'var(--color-background-primary)' }} />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Totals row */}
              <tr style={{ background:'var(--color-background-secondary)', fontWeight:500 }}>
                <TD style={{ fontWeight:700, color:'var(--color-text-primary)' }}>TOTAL</TD>
                <TD><span></span></TD>
                <TD style={{ textAlign:'center', fontWeight:700 }}>{clientData.reduce((s,c)=>s+c.monthClientTasks.length,0)}</TD>
                <TD style={{ textAlign:'center', fontWeight:700 }}>{clientData.reduce((s,c)=>s+c.totalEst,0).toFixed(1)}</TD>
                <TD style={{ textAlign:'center', fontWeight:700, color:BRAND }}>{clientData.reduce((s,c)=>s+c.totalActual,0).toFixed(2)}</TD>
                <TD style={{ textAlign:'center', background:'#E6F1FB20', fontWeight:700, color:'#0C447C' }}>{clientData.reduce((s,c)=>s+c.budgetHrs,0)}</TD>
                <TD style={{ textAlign:'center', background:'#E6F1FB20', fontWeight:700, color:(() => { const r=clientData.reduce((s,c)=>s+(c.hrsRemaining||0),0); return r<0?'#DC2626':'#059669'; })() }}>
                  {(() => { const r=clientData.reduce((s,c)=>s+(c.hrsRemaining||0),0); return r!==0?(r<0?r.toFixed(2):`+${r.toFixed(2)}`):'-'; })()}
                </TD>
                <TD style={{ textAlign:'center', background:'#E6F1FB20' }}>
                  {(() => { const b=clientData.reduce((s,c)=>s+c.budgetHrs,0); const a=clientData.reduce((s,c)=>s+c.totalActual,0); return b>0 ? `${Math.round(a/b*100)}%` : '—'; })()}
                </TD>
                <TD style={{ textAlign:'center' }}>{clientData.reduce((s,c)=>s+c.pending,0)||'—'}</TD>
                <TD style={{ textAlign:'center', color:'#059669', fontWeight:700 }}>{clientData.reduce((s,c)=>s+c.done,0)||'—'}</TD>
                <TD style={{ textAlign:'center', color:'#0891B2' }}>{clientData.reduce((s,c)=>s+c.qc,0)||'—'}</TD>
                <TD style={{ textAlign:'center', color:'#7C3AED' }}>{clientData.reduce((s,c)=>s+c.rw,0)||'—'}</TD>
                <td colSpan={3} style={{ padding:"6px 10px", borderBottom:"0.5px solid var(--color-border-tertiary)" }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
