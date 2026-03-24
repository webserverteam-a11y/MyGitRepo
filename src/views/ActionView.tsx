import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { Task, TimeEvent, ExecutionState, ReworkEntry, Comment } from '../types';
import {
  Play, Pause, Square, RotateCcw, ChevronDown, ChevronUp, Clock,
  CheckCircle2, ArrowRight, UserCircle, LayoutList, LayoutGrid, Plus,
  Upload, AlertTriangle, ExternalLink, MessageSquare, Pencil, Trash2, Send
} from 'lucide-react';
import { cn, formatDate, getDeptDelayedInfo } from '../utils';

// ── Google URL icon helper ──────────────────────────────────────────────────
function DocIcon({ url, className = 'w-4 h-4' }: { url: string; className?: string }) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('docs.google.com/spreadsheets')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="3" fill="#0F9D58" />
        <rect x="5" y="7" width="14" height="1.5" rx="0.75" fill="white" />
        <rect x="5" y="11" width="14" height="1.5" rx="0.75" fill="white" />
        <rect x="5" y="15" width="9" height="1.5" rx="0.75" fill="white" />
        <rect x="9" y="7" width="1.5" height="9.5" rx="0.75" fill="white" opacity="0.5" />
      </svg>
    );
  }
  if (u.includes('docs.google.com/document')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="3" fill="#4285F4" />
        <rect x="6" y="7" width="12" height="1.5" rx="0.75" fill="white" />
        <rect x="6" y="10.5" width="12" height="1.5" rx="0.75" fill="white" />
        <rect x="6" y="14" width="8" height="1.5" rx="0.75" fill="white" />
      </svg>
    );
  }
  if (u.includes('drive.google.com')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="3" fill="#FBBC04" />
        <path d="M12 5L18 16H6L12 5Z" fill="white" opacity="0.9" />
        <path d="M6 16L3 11L9 11L6 16Z" fill="white" opacity="0.7" />
      </svg>
    );
  }
  if (u.includes('docs.google.com/presentation')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="3" fill="#F4B400" />
        <rect x="5" y="6" width="14" height="12" rx="1.5" fill="white" opacity="0.9" />
        <circle cx="12" cy="12" r="3" fill="#F4B400" />
      </svg>
    );
  }
  // Generic link
  return <ExternalLink className={className} />;
}

export function ActionView() {
  const { tasks, setTasks, adminOptions, currentUser, isAdmin } = useAppContext();

  // Apply user-based filtering
  const visibleTasks = useMemo(() => {
    if (!currentUser || isAdmin) return tasks;
    return tasks.filter(t => {
      if (currentUser.role === 'seo') return t.seoOwner === currentUser.ownerName;
      if (currentUser.role === 'content') return t.contentOwner === currentUser.ownerName;
      if (currentUser.role === 'web') return t.webOwner === currentUser.ownerName;
      return true;
    });
  }, [tasks, currentUser, isAdmin]);
  const [now, setNow] = useState(Date.now());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // End Task Modal
  const [endingTask, setEndingTask] = useState<Task | null>(null);
  const [handoffStep, setHandoffStep] = useState<'select_action' | 'configure_assignment'>('select_action');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignmentOwner, setAssignmentOwner] = useState('');
  const [assignmentEstHours, setAssignmentEstHours] = useState('');
  const [assignmentDocUrl, setAssignmentDocUrl] = useState('');

  // New Task Modal
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<Partial<Task>>({
    title: '', client: adminOptions.clients[0] || '',
    seoOwner: adminOptions.seoOwners[0] || '',
    currentOwner: 'SEO', executionState: 'Not Started',
    intakeDate: new Date().toISOString().split('T')[0],
  });

  // Edit Task Modal
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});

  // Rework Modal
  const [reworkingTask, setReworkingTask] = useState<Task | null>(null);
  const [reworkForm, setReworkForm] = useState({
    estHours: '', assignedDept: 'Content' as 'Content' | 'Web',
    assignedOwner: '', date: new Date().toISOString().split('T')[0],
  });

  // Comments
  const [commentTaskId, setCommentTaskId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  // Filters — default to today
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateFromFilter, setDateFromFilter] = useState(todayStr);
  const [dateToFilter, setDateToFilter] = useState(todayStr);
  const [clientFilter, setClientFilter] = useState('All');
  const [seoOwnerFilter, setSeoOwnerFilter] = useState('All');
  const [contentOwnerFilter, setContentOwnerFilter] = useState('All');
  const [webOwnerFilter, setWebOwnerFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeStateFilter, setActiveStateFilter] = useState<'All' | 'InProgress' | 'Rework' | 'QC' | 'Delayed' | 'Completed'>('All');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = useMemo(() => {
    return visibleTasks.filter(t => {
      // Use the relevant assigned date depending on current owner dept
      const taskDate = t.currentOwner === 'Content' ? (t.contentAssignedDate || t.intakeDate)
        : t.currentOwner === 'Web' ? (t.webAssignedDate || t.intakeDate)
        : t.intakeDate;
      if (dateFromFilter && taskDate < dateFromFilter) return false;
      if (dateToFilter && taskDate > dateToFilter) return false;
      if (clientFilter !== 'All' && t.client !== clientFilter) return false;
      if (seoOwnerFilter !== 'All' && t.seoOwner !== seoOwnerFilter) return false;
      if (contentOwnerFilter !== 'All' && t.contentOwner !== contentOwnerFilter) return false;
      if (webOwnerFilter !== 'All' && t.webOwner !== webOwnerFilter) return false;
      if (statusFilter !== 'All' && t.currentOwner !== statusFilter) return false;
      if (activeStateFilter === 'InProgress' && t.executionState !== 'In Progress') return false;
      if (activeStateFilter === 'Rework' && t.executionState !== 'Rework' && t.seoQcStatus !== 'Rework' && !(t.reworkEntries && t.reworkEntries.length > 0 && !t.reworkEntries[t.reworkEntries.length - 1].endTimestamp)) return false;
      if (activeStateFilter === 'Completed' && !t.isCompleted && t.executionState !== 'Ended') return false;
      if (activeStateFilter === 'QC' && t.seoQcStatus !== 'Pending QC' && t.seoQcStatus !== 'QC' && t.webStatus !== 'Pending QC') return false;
      if (activeStateFilter === 'Delayed') {
        const assignedDate = t.currentOwner === 'SEO' ? t.intakeDate : t.currentOwner === 'Content' ? t.contentAssignedDate : t.webAssignedDate;
        const est = t.currentOwner === 'SEO' ? (t.estHoursSEO || t.estHours || 0) : t.currentOwner === 'Content' ? (t.estHoursContent || 0) : (t.estHoursWeb || 0);
        const { isDelayed } = getDeptDelayedInfo(assignedDate || '', est, 0);
        if (!isDelayed) return false;
      }
      return true;
    });
  }, [visibleTasks, dateFromFilter, dateToFilter, clientFilter, seoOwnerFilter, contentOwnerFilter, webOwnerFilter, statusFilter, activeStateFilter]);

  const stats = useMemo(() => ({
    total: filteredTasks.length,
    inProgress: filteredTasks.filter(t => t.executionState === 'In Progress').length,
    rework: filteredTasks.filter(t =>
      t.executionState === 'Rework' ||
      t.seoQcStatus === 'Rework' ||
      (t.reworkEntries && t.reworkEntries.length > 0 && !t.reworkEntries[t.reworkEntries.length - 1].endTimestamp)
    ).length,
    completed: filteredTasks.filter(t => t.executionState === 'Ended' || t.isCompleted).length,
    qc: filteredTasks.filter(t => t.seoQcStatus === 'Pending QC' || t.seoQcStatus === 'QC' || t.webStatus === 'Pending QC').length,
    delayed: filteredTasks.filter(t => {
      const assignedDate = t.currentOwner === 'SEO' ? t.intakeDate : t.currentOwner === 'Content' ? t.contentAssignedDate : t.webAssignedDate;
      const est = t.currentOwner === 'SEO' ? (t.estHoursSEO || t.estHours || 0) : t.currentOwner === 'Content' ? (t.estHoursContent || 0) : (t.estHoursWeb || 0);
      const { isDelayed } = getDeptDelayedInfo(assignedDate || '', est, 0);
      return isDelayed;
    }).length,
  }), [filteredTasks]);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const sortedFilteredTasks = useMemo(() => {
    const getTaskDate = (t: Task) => t.currentOwner === 'Content' ? (t.contentAssignedDate || t.intakeDate)
      : t.currentOwner === 'Web' ? (t.webAssignedDate || t.intakeDate)
      : t.intakeDate;
    return [...filteredTasks].sort((a, b) => (getTaskDate(b) || '').localeCompare(getTaskDate(a) || ''));
  }, [filteredTasks]);

  const totalPages = Math.max(1, Math.ceil(sortedFilteredTasks.length / pageSize));
  const pagedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFilteredTasks.slice(start, start + pageSize);
  }, [sortedFilteredTasks, currentPage, pageSize]);

  React.useEffect(() => { setCurrentPage(1); }, [dateFromFilter, dateToFilter, clientFilter, seoOwnerFilter, contentOwnerFilter, webOwnerFilter, statusFilter, activeStateFilter, pageSize]);

  const exportFilteredCSV = () => {
    const headers = ['ID','Title','Client','SEO Stage','SEO Owner','Content Owner','Web Owner','Intake Date','Keyword','Volume','Monthly Rank','Cur Rank','Est SEO','Est Content','Est Web','Current Owner','Execution State','SEO QC Status','Target URL','Doc URL','Remarks'];
    const rows = sortedFilteredTasks.map(t => [
      t.id, `"${(t.title||'').replace(/"/g,'""')}"`, t.client, t.seoStage, t.seoOwner,
      t.contentOwner||'', t.webOwner||'', t.intakeDate,
      `"${(t.focusedKw||'').replace(/"/g,'""')}"`, t.volume||'',
      t.marRank||'', t.currentRank||'',
      t.estHoursSEO||t.estHours||0, t.estHoursContent||0, t.estHoursWeb||0,
      t.currentOwner, t.executionState||'Not Started', t.seoQcStatus,
      t.targetUrl||'', t.docUrl||'',
      `"${(t.remarks||'').replace(/"/g,'""')}"`
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-board-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getTaskTimes = (task: Task) => {
    let activeMs = 0, pauseMs = 0, reworkMs = 0;
    let lastStart = 0, lastPause = 0, lastRework = 0;
    let state = 'Not Started';
    (task.timeEvents || []).forEach(e => {
      const t = new Date(e.timestamp).getTime();
      if (e.type === 'start' || e.type === 'resume') {
        if (state === 'Paused' && lastPause) pauseMs += (t - lastPause);
        lastStart = t; state = 'In Progress';
      } else if (e.type === 'pause') {
        if (state === 'In Progress' && lastStart) activeMs += (t - lastStart);
        if (state === 'Rework' && lastRework) reworkMs += (t - lastRework);
        lastPause = t; state = 'Paused';
      } else if (e.type === 'rework_start') {
        if (state === 'Paused' && lastPause) pauseMs += (t - lastPause);
        if (state === 'In Progress' && lastStart) activeMs += (t - lastStart);
        lastRework = t; state = 'Rework';
      } else if (e.type === 'end') {
        if (state === 'In Progress' && lastStart) activeMs += (t - lastStart);
        if (state === 'Rework' && lastRework) reworkMs += (t - lastRework);
        state = 'Ended';
      }
    });
    if (task.executionState === 'In Progress' && lastStart) activeMs += (now - lastStart);
    if (task.executionState === 'Rework' && lastRework) reworkMs += (now - lastRework);
    if (task.executionState === 'Paused' && lastPause) pauseMs += (now - lastPause);
    return { activeMs, pauseMs, reworkMs };
  };

  const formatMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  const getOwnerName = (dept: string, task: Task) => {
    if (dept === 'SEO') return task.seoOwner || 'SEO';
    if (dept === 'Content') return task.contentOwner || 'Content';
    if (dept === 'Web') return task.webOwner || 'Web';
    return dept;
  };

  const logEvent = (taskId: string, type: TimeEvent['type'], newState: ExecutionState) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      const now = new Date().toISOString();
      const events = [...(t.timeEvents || [])];
      let updatedReworkEntries = t.reworkEntries ? [...t.reworkEntries] : undefined;

      if (type === 'start' || type === 'resume') {
        // Check if there's an open rework entry with no startTimestamp yet
        // (meaning: SEO assigned rework but assignee hasn't started yet)
        if (updatedReworkEntries && updatedReworkEntries.length > 0) {
          const latest = updatedReworkEntries[updatedReworkEntries.length - 1];
          if (!latest.startTimestamp || latest.startTimestamp === '') {
            // Stamp the rework start time NOW and log rework_start event
            updatedReworkEntries = [
              ...updatedReworkEntries.slice(0, -1),
              { ...latest, startTimestamp: now }
            ];
            events.push({ type: 'rework_start', timestamp: now, department: t.currentOwner, owner: currentUser?.ownerName || '' });
            // State becomes Rework (not In Progress) so timer tracks rework time
            return {
              ...t,
              executionState: 'Rework' as ExecutionState,
              timeEvents: events,
              reworkEntries: updatedReworkEntries,
            };
          }
        }
        // Normal start — no pending rework entry
        events.push({ type, timestamp: now, department: t.currentOwner, owner: currentUser?.ownerName || '' });
        return { ...t, executionState: newState, timeEvents: events, reworkEntries: updatedReworkEntries };
      }

      // Pause or End — close any open rework entry
      if ((type === 'pause' || type === 'end') && updatedReworkEntries && updatedReworkEntries.length > 0) {
        const latest = updatedReworkEntries[updatedReworkEntries.length - 1];
        if (latest.startTimestamp && !latest.endTimestamp) {
          const endMs = new Date(now).getTime();
          const startMs = new Date(latest.startTimestamp).getTime();
          updatedReworkEntries = [
            ...updatedReworkEntries.slice(0, -1),
            { ...latest, endTimestamp: now, durationMs: endMs - startMs }
          ];
        }
      }

      events.push({ type, timestamp: now, department: t.currentOwner, owner: currentUser?.ownerName || '' });
      return { ...t, executionState: newState, timeEvents: events, reworkEntries: updatedReworkEntries };
    }));
  };

  const handleActionSelect = (actionType: string) => {
    setSelectedAction(actionType);
    if (['assign_content', 'assign_web', 'qc_seo', 'qc_web'].includes(actionType)) {
      setHandoffStep('configure_assignment');
      setAssignmentDate(new Date().toISOString().split('T')[0]);
      setAssignmentEstHours('');
      setAssignmentDocUrl(endingTask?.docUrl || '');
      if (actionType === 'assign_content') setAssignmentOwner(adminOptions.contentOwners[0] || '');
      else if (actionType === 'assign_web' || actionType === 'qc_web') setAssignmentOwner(adminOptions.webOwners[0] || '');
      else if (actionType === 'qc_seo') setAssignmentOwner(endingTask?.seoOwner || adminOptions.seoOwners[0] || '');
    } else {
      executeHandoff(actionType, '', '', 0, '');
    }
  };

  const executeHandoff = (actionType: string, date: string, owner: string, estHrs = 0, docUrl = '') => {
    if (!endingTask) return;
    setTasks(prev => prev.map(t => {
      if (t.id !== endingTask.id) return t;
      const updated = { ...t };
      const nowTs = new Date().toISOString();
      updated.timeEvents = [...(t.timeEvents || []), { type: 'end' as TimeEvent['type'], timestamp: nowTs, department: t.currentOwner, owner: currentUser?.ownerName || '' }];
      if (docUrl) updated.docUrl = docUrl;
      // Close any open rework entry that has actually started
      if (t.reworkEntries && t.reworkEntries.length > 0) {
        const latest = t.reworkEntries[t.reworkEntries.length - 1];
        if (latest.startTimestamp && !latest.endTimestamp) {
          const endMs = new Date(nowTs).getTime();
          const startMs = new Date(latest.startTimestamp).getTime();
          updated.reworkEntries = [
            ...t.reworkEntries.slice(0, -1),
            { ...latest, endTimestamp: nowTs, durationMs: endMs - startMs }
          ];
        }
      }
      switch (actionType) {
        case 'assign_content': updated.currentOwner = 'Content'; updated.contentOwner = owner; updated.contentAssignedDate = date; updated.executionState = 'Not Started'; if (estHrs > 0) updated.estHoursContent = estHrs; break;
        case 'assign_web': updated.currentOwner = 'Web'; updated.webOwner = owner; updated.webAssignedDate = date; updated.executionState = 'Not Started'; if (estHrs > 0) updated.estHoursWeb = estHrs; break;
        case 'qc_seo': updated.currentOwner = 'SEO'; updated.seoOwner = owner; updated.executionState = 'Not Started'; updated.seoQcStatus = 'Pending QC';
          // Stamp today as the SEO intakeDate so it appears in SEO's date filters from today
          updated.intakeDate = nowTs.split('T')[0];
          break;
        case 'qc_web': updated.currentOwner = 'Web'; updated.webOwner = owner; updated.executionState = 'Not Started'; updated.webStatus = 'Pending QC'; break;
        case 'approve': updated.seoQcStatus = 'Approved'; updated.isCompleted = true; updated.currentOwner = 'Completed'; updated.executionState = 'Ended'; break;
        case 'rework': updated.seoQcStatus = 'Rework'; updated.executionState = 'Rework'; break;
        case 'close': updated.currentOwner = 'Completed'; updated.isCompleted = true; updated.executionState = 'Ended'; break;
      }
      return updated;
    }));
    setEndingTask(null); setHandoffStep('select_action'); setSelectedAction(null);
  };

  const openReworkModal = (task: Task) => {
    setReworkingTask(task);
    setReworkForm({ estHours: '', assignedDept: 'Content', assignedOwner: adminOptions.contentOwners[0] || '', date: new Date().toISOString().split('T')[0] });
  };

  const handleConfirmRework = () => {
    if (!reworkingTask) return;
    const times = getTaskTimes(reworkingTask);
    const hoursSpent = times.activeMs / 3600000;
    const reworkEst = parseFloat(reworkForm.estHours) || 0;
    const originalEst = reworkingTask.estHours || 0;
    const withinEstimate = originalEst > 0 && (hoursSpent + reworkEst) <= originalEst;

    // Create rework entry — startTimestamp is intentionally blank until assigned person clicks Start
    const newEntry: ReworkEntry = {
      id: `RW-${Date.now()}`,
      date: reworkForm.date,
      estHours: reworkEst,
      assignedDept: reworkForm.assignedDept,
      assignedOwner: reworkForm.assignedOwner,
      withinEstimate,
      hoursAlreadySpent: parseFloat(hoursSpent.toFixed(2)),
      startTimestamp: '', // will be set when assigned person clicks Start
    };

    setTasks(prev => prev.map(t => {
      if (t.id !== reworkingTask.id) return t;
      const events = [...(t.timeEvents || [])];
      // Auto-pause if still running — closes the SEO review time cleanly
      if (t.executionState === 'In Progress') {
        events.push({ type: 'pause', timestamp: new Date().toISOString(), department: t.currentOwner, owner: currentUser?.ownerName || '' });
      }
      // NOTE: NO rework_start event here — that happens when the assignee clicks Start Task
      return {
        ...t,
        executionState: 'Not Started', // assignee hasn't started yet
        currentOwner: reworkForm.assignedDept,
        seoQcStatus: 'Rework',
        ...(reworkForm.assignedDept === 'Content'
          ? { contentOwner: reworkForm.assignedOwner, contentAssignedDate: reworkForm.date }
          : { webOwner: reworkForm.assignedOwner, webAssignedDate: reworkForm.date }),
        reworkEntries: [...(t.reworkEntries || []), newEntry],
        timeEvents: events,
      };
    }));
    setReworkingTask(null);
  };

  const handleAddComment = (taskId: string) => {
    if (!commentText.trim() || !commentAuthor.trim()) return;
    const c: Comment = { id: `C-${Date.now()}`, author: commentAuthor, text: commentText, timestamp: new Date().toISOString() };
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: [...(t.comments || []), c] } : t));
    setCommentText(''); setCommentTaskId(null);
  };

  const handleCreateTask = () => {
    const today = new Date().toISOString().split('T')[0];
    const role = currentUser?.role || 'seo';
    const assignedDate = newTaskForm.contentAssignedDate || newTaskForm.webAssignedDate || newTaskForm.intakeDate || today;

    const newTask: Task = {
      id: `TASK-${Math.floor(Math.random() * 10000).toString().padStart(4,'0')}`,
      title: newTaskForm.title || 'Untitled Task',
      client: newTaskForm.client || adminOptions.clients[0],
      seoOwner: newTaskForm.seoOwner || adminOptions.seoOwners[0],
      seoStage: newTaskForm.seoStage || adminOptions.seoStages[0],
      isCompleted: false, seoQcStatus: 'Pending', contentStatus: 'Pending', webStatus: 'Pending',
      daysInStage: 0, estHours: 0, actualHours: 0, executionState: 'Not Started', timeEvents: [],
      // Role-specific fields
      currentOwner: role === 'content' ? 'Content' : role === 'web' ? 'Web' : 'SEO',
      // intakeDate: SEO sets it directly; Content/Web auto-set to their assigned date so task appears in SEO filters
      intakeDate: role === 'content' ? assignedDate : role === 'web' ? assignedDate : (newTaskForm.intakeDate || today),
      contentAssignedDate: role === 'content' ? assignedDate : '',
      contentOwner: role === 'content' ? (currentUser?.ownerName || '') : '',
      estHoursContent: role === 'content' ? (Number(newTaskForm.estHoursContent) || 0) : 0,
      webAssignedDate: role === 'web' ? assignedDate : '',
      webOwner: role === 'web' ? (currentUser?.ownerName || '') : '',
      estHoursWeb: role === 'web' ? (Number(newTaskForm.estHoursWeb) || 0) : 0,
      estHoursSEO: role === 'seo' ? (Number(newTaskForm.estHoursSEO) || 0) : 0,
      focusedKw: newTaskForm.focusedKw || '',
      targetUrl: newTaskForm.targetUrl || '',
      docUrl: newTaskForm.docUrl || '',
      remarks: newTaskForm.remarks || '',
    };
    setTasks(prev => [newTask, ...prev]);
    setIsNewTaskModalOpen(false);
    setNewTaskForm({ title: '', client: adminOptions.clients[0] || '', seoOwner: adminOptions.seoOwners[0] || '', seoStage: adminOptions.seoStages[0] || '', executionState: 'Not Started', intakeDate: today });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string; if (!text) return;
      const lines = text.split('\n').filter(l => l.trim()); if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const newTasks: Task[] = lines.slice(1).map((line, idx) => {
        const values = line.split(',').map(v => v.trim());
        const task: any = { id: `TASK-${Math.floor(Math.random() * 10000)}-${idx}`, isCompleted: false, seoQcStatus: 'Pending', contentStatus: 'Pending', webStatus: 'Pending', daysInStage: 0, estHours: 0, estHoursSEO: 0, estHoursContent: 0, estHoursWeb: 0, actualHours: 0, executionState: 'Not Started', timeEvents: [], currentOwner: 'SEO', contentAssignedDate: '', webAssignedDate: '' };
        headers.forEach((h, i) => {
          const v = values[i] || '';
          if (h.includes('title')) task.title = v;
          else if (h.includes('client')) task.client = v;
          else if (h.includes('seo owner')) task.seoOwner = v;
          else if (h.includes('intake')) task.intakeDate = v;
          else if (h.includes('stage')) task.seoStage = v;
        });
        if (!task.title) task.title = 'Untitled Task';
        if (!task.client) task.client = adminOptions.clients[0] || '';
        if (!task.seoOwner) task.seoOwner = adminOptions.seoOwners[0] || '';
        if (!task.seoStage) task.seoStage = adminOptions.seoStages[0] || '';
        if (!task.intakeDate) task.intakeDate = new Date().toISOString().split('T')[0];
        return task as Task;
      });
      setTasks(prev => [...newTasks, ...prev]);
    };
    reader.readAsText(file); e.target.value = '';
  };

  const openEditModal = (task: Task) => { setEditingTask(task); setEditForm({ ...task }); };
  const saveEdit = () => {
    if (!editingTask) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...editForm } : t));
    setEditingTask(null);
  };

  const deleteTask = (taskId: string) => {
    if (confirm('Delete this task?')) setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const deptColor = (dept: string) =>
    dept === 'SEO' ? 'bg-blue-100 text-blue-700' :
    dept === 'Content' ? 'bg-orange-100 text-orange-700' :
    dept === 'Web' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700';

  const stateColor = (s: string) =>
    s === 'In Progress' ? 'bg-green-100 text-green-700' :
    s === 'Paused' ? 'bg-amber-100 text-amber-700' :
    s === 'Rework' ? 'bg-purple-100 text-purple-700' :
    s === 'Ended' ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-500';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Action Board</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportFilteredCSV} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg" title={`Download ${sortedFilteredTasks.length} filtered tasks as CSV`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV ({sortedFilteredTasks.length})
            </button>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg cursor-pointer">
              <Upload className="w-4 h-4" /> Upload Tasks
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={() => setIsNewTaskModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" /> New Task
            </button>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button onClick={() => setViewMode('card')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'card' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={cn("p-1.5 rounded-md transition-colors", viewMode === 'list' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}><LayoutList className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">From Date</label><input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">To Date</label><input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">Client</label>
            <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="All">All Clients</option>{adminOptions.clients.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">SEO Owner</label>
            <select value={seoOwnerFilter} onChange={e => setSeoOwnerFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="All">All SEO Owners</option>{adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">Content Owner</label>
            <select value={contentOwnerFilter} onChange={e => setContentOwnerFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="All">All</option>{adminOptions.contentOwners.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">Web Owner</label>
            <select value={webOwnerFilter} onChange={e => setWebOwnerFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="All">All</option>{adminOptions.webOwners.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col"><label className="text-xs font-medium text-slate-500 mb-1">Department</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="All">All</option><option>SEO</option><option>Content</option><option>Web</option><option>Completed</option>
            </select>
          </div>
          {(dateFromFilter || dateToFilter || clientFilter !== 'All' || seoOwnerFilter !== 'All' || contentOwnerFilter !== 'All' || webOwnerFilter !== 'All' || statusFilter !== 'All') && (
            <div className="flex flex-col justify-end"><button onClick={() => { setDateFromFilter(todayStr); setDateToFilter(todayStr); setClientFilter('All'); setSeoOwnerFilter('All'); setContentOwnerFilter('All'); setWebOwnerFilter('All'); setStatusFilter('All'); setActiveStateFilter('All'); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-md bg-white">Reset to today</button></div>
          )}
        </div>
      </div>

      {/* Slim summary bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-400 mr-1">Summary:</span>
        <button
          onClick={() => setActiveStateFilter('All')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'All' ? "bg-slate-100 border-slate-400 ring-1 ring-slate-300" : "bg-slate-50 border-slate-200 hover:border-slate-300")}
        >
          <span className="text-slate-400">Total</span>
          <span className="font-bold text-slate-800">{stats.total}</span>
        </button>
        <button
          onClick={() => setActiveStateFilter(activeStateFilter === 'InProgress' ? 'All' : 'InProgress')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'InProgress' ? "bg-indigo-100 border-indigo-400 ring-1 ring-indigo-300" : "bg-indigo-50 border-indigo-100 hover:border-indigo-300")}
        >
          <span className="text-indigo-400">In Progress</span>
          <span className="font-bold text-indigo-900">{stats.inProgress}</span>
        </button>
        <button
          onClick={() => setActiveStateFilter(activeStateFilter === 'Rework' ? 'All' : 'Rework')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'Rework' ? "bg-purple-100 border-purple-400 ring-1 ring-purple-300" : "bg-purple-50 border-purple-100 hover:border-purple-300")}
        >
          <span className="text-purple-400">Rework</span>
          <span className="font-bold text-purple-900">{stats.rework}</span>
        </button>
        <button
          onClick={() => setActiveStateFilter(activeStateFilter === 'QC' ? 'All' : 'QC')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'QC' ? "bg-teal-100 border-teal-400 ring-1 ring-teal-300" : "bg-teal-50 border-teal-100 hover:border-teal-300")}
        >
          <span className="text-teal-500">QC Pending</span>
          <span className="font-bold text-teal-900">{stats.qc}</span>
        </button>
        <button
          onClick={() => setActiveStateFilter(activeStateFilter === 'Delayed' ? 'All' : 'Delayed')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'Delayed' ? "bg-red-100 border-red-400 ring-1 ring-red-300" : "bg-red-50 border-red-100 hover:border-red-300")}
        >
          <span className="text-red-400">Delayed</span>
          <span className="font-bold text-red-900">{stats.delayed}</span>
        </button>
        <button
          onClick={() => setActiveStateFilter(activeStateFilter === 'Completed' ? 'All' : 'Completed')}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border", activeStateFilter === 'Completed' ? "bg-emerald-100 border-emerald-400 ring-1 ring-emerald-300" : "bg-emerald-50 border-emerald-100 hover:border-emerald-300")}
        >
          <span className="text-emerald-500">Completed</span>
          <span className="font-bold text-emerald-900">{stats.completed}</span>
        </button>
        <span className="text-xs text-slate-300 ml-auto hidden sm:block">Click to filter</span>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === 'list' ? (
            /* ── LIST VIEW ── */
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left" style={{ fontSize: '12px' }}>
                <thead className="text-[10px] text-slate-400 uppercase bg-slate-50 border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 w-[22%]">Task</th>
                    <th className="px-3 py-2.5 w-[10%]">Client / Stage</th>
                    <th className="px-3 py-2.5 w-[14%]">Keyword</th>
                    <th className="px-3 py-2.5 w-[6%] text-right">Vol</th>
                    <th className="px-3 py-2.5 w-[7%] text-center">Ranks</th>
                    <th className="px-3 py-2.5 w-[11%]">Owners</th>
                    <th className="px-3 py-2.5 w-[10%]">Status</th>
                    <th className="px-3 py-2.5 w-[8%]">Time</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTasks.map(task => {
                    const times = getTaskTimes(task);
                    const isExpanded = expandedTaskId === task.id;
                    const assignedDate = task.currentOwner === 'SEO' ? task.intakeDate : task.currentOwner === 'Content' ? task.contentAssignedDate : task.webAssignedDate;
                    const estHours = task.currentOwner === 'SEO' ? (task.estHoursSEO || task.estHours || 0) : task.currentOwner === 'Content' ? (task.estHoursContent || 0) : (task.estHoursWeb || 0);
                    const delayInfo = getDeptDelayedInfo(assignedDate || '', estHours, times.activeMs);
                    const isDelayed = delayInfo.isDelayed;
                    const delayReason = delayInfo.reason;
                    const rankDiff = (task.marRank || 0) - (task.currentRank || 0);
                    const tooltipText = [
                      `ID: ${task.id}`, `Client: ${task.client}`, `Stage: ${task.seoStage}`,
                      `SEO Owner: ${task.seoOwner}`,
                      task.contentOwner ? `Content: ${task.contentOwner}` : null,
                      task.webOwner ? `Web: ${task.webOwner}` : null,
                      task.focusedKw ? `Keyword: ${task.focusedKw}` : null,
                      task.volume ? `Volume: ${task.volume.toLocaleString()}` : null,
                      task.marRank ? `Monthly Rank: ${task.marRank}` : null,
                      task.currentRank ? `Cur Rank: ${task.currentRank}` : null,
                      `Est SEO: ${task.estHoursSEO || task.estHours || 0}h`,
                      task.estHoursContent ? `Est Content: ${task.estHoursContent}h` : null,
                      task.estHoursWeb ? `Est Web: ${task.estHoursWeb}h` : null,
                      task.remarks ? `Remarks: ${task.remarks}` : null,
                    ].filter(Boolean).join('\n');
                    return (
                      <React.Fragment key={task.id}>
                        <tr className={cn(
                          "border-b border-slate-100 hover:brightness-95 align-top transition-all",
                          isDelayed ? "bg-red-50" :
                          task.executionState === 'Ended' || task.isCompleted ? "bg-emerald-50/40" :
                          task.executionState === 'Rework' ? "bg-purple-50/50" :
                          task.executionState === 'In Progress' ? "bg-indigo-50/40" :
                          task.executionState === 'Paused' ? "bg-amber-50/40" :
                          task.currentOwner === 'Content' ? "bg-orange-50/30" :
                          task.currentOwner === 'Web' ? "bg-emerald-50/30" :
                          "bg-white"
                        )} title={tooltipText}>
                          {/* Task */}
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-800 leading-snug break-words whitespace-normal" style={{ fontSize: '12px' }}>{task.title}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              <span className="text-slate-400" style={{ fontSize: '10px' }}>{task.id}</span>
                              <span className="text-slate-300" style={{ fontSize: '10px' }}>·</span>
                              <span className="text-slate-400" style={{ fontSize: '10px' }}>{task.currentOwner === 'Content' ? (task.contentAssignedDate || task.intakeDate) : task.currentOwner === 'Web' ? (task.webAssignedDate || task.intakeDate) : task.intakeDate}</span>
                              {task.docUrl && (
                                <a href={task.docUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 hover:underline"
                                  style={{ fontSize: '10px' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <DocIcon url={task.docUrl} className="w-3 h-3" />
                                  <span>Doc</span>
                                </a>
                              )}
                              {isDelayed && (
                                <span className="font-bold px-1 py-0.5 bg-red-100 text-red-600 rounded" style={{ fontSize: '9px' }}>
                                  Delayed{delayReason === 'calendar' ? ' (date)' : delayReason === 'overrun' ? ' (hrs)' : ' (both)'}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Client */}
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-700 break-words whitespace-normal">{task.client}</div>
                            <div className="text-slate-400 mt-0.5" style={{ fontSize: '10px' }}>{task.seoStage}</div>
                          </td>
                          {/* Keyword */}
                          <td className="px-3 py-2.5">
                            <div className="text-slate-700 break-words whitespace-normal leading-snug">{task.focusedKw || <span className="text-slate-300">—</span>}</div>
                            {task.targetUrl && (
                              <a href={task.targetUrl} target="_blank" rel="noreferrer"
                                className="text-indigo-400 hover:underline block truncate max-w-[130px] mt-0.5"
                                style={{ fontSize: '10px' }} title={task.targetUrl}
                              >↗ URL</a>
                            )}
                          </td>
                          {/* Vol */}
                          <td className="px-3 py-2.5 text-right text-slate-600 font-medium">
                            {task.volume ? task.volume.toLocaleString() : <span className="text-slate-300">—</span>}
                          </td>
                          {/* Ranks */}
                          <td className="px-3 py-2.5 text-center">
                            <div className="text-slate-500 space-y-0.5" style={{ fontSize: '11px' }}>
                              <div><span className="text-slate-300">Mar:</span> <span className="font-medium text-slate-600">{task.marRank || '—'}</span></div>
                              <div><span className="text-slate-300">Cur:</span> <span className="font-medium text-slate-600">{task.currentRank || '—'}</span></div>
                              {rankDiff !== 0 && (
                                <div className={cn("font-bold", rankDiff > 0 ? "text-emerald-500" : "text-red-400")} style={{ fontSize: '10px' }}>
                                  {rankDiff > 0 ? `▲${rankDiff}` : `▼${Math.abs(rankDiff)}`}
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Owners */}
                          <td className="px-3 py-2.5">
                            <div className="text-slate-600 space-y-0.5" style={{ fontSize: '11px' }}>
                              <div><span className="text-slate-400">SEO:</span> {task.seoOwner || '—'}</div>
                              {task.contentOwner && <div><span className="text-slate-400">Con:</span> {task.contentOwner}</div>}
                              {task.webOwner && <div><span className="text-slate-400">Web:</span> {task.webOwner}</div>}
                            </div>
                          </td>
                          {/* Status */}
                          <td className="px-3 py-2.5">
                            <span className={cn("font-bold px-2 py-0.5 rounded-md inline-block mb-1", deptColor(task.currentOwner))} style={{ fontSize: '10px' }}>{task.currentOwner}</span>
                            <br />
                            <span className={cn("font-bold px-2 py-0.5 rounded-md inline-block", stateColor(task.executionState || 'Not Started'))} style={{ fontSize: '10px' }}>{task.executionState || 'Not Started'}</span>
                            {(task.seoQcStatus === 'Pending QC' || task.seoQcStatus === 'QC') && (
                              <div className="mt-1">
                                <span className="font-bold px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded" style={{ fontSize: '9px' }}>QC Submitted</span>
                              </div>
                            )}
                          </td>
                          {/* Time */}
                          <td className="px-3 py-2.5 font-mono text-slate-700" style={{ fontSize: '11px' }}>{formatMs(times.activeMs)}</td>
                          {/* Actions */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-0.5 flex-wrap">
                              {(task.executionState === 'Not Started' || !task.executionState) && <button onClick={() => logEvent(task.id, 'start', 'In Progress')} className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md" title="Start"><Play className="w-3.5 h-3.5" /></button>}
                              {(task.executionState === 'In Progress' || task.executionState === 'Rework') && <>
                                <button onClick={() => logEvent(task.id, 'pause', 'Paused')} className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-md" title="Pause"><Pause className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEndingTask(task)} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md" title="End Task"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                              </>}
                              {task.executionState === 'Paused' && <>
                                <button onClick={() => logEvent(task.id, 'resume', 'In Progress')} className="p-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-md" title="Resume"><Play className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEndingTask(task)} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md" title="End Task"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                              </>}
                              {((task.executionState === 'Rework' && task.currentOwner === 'SEO') ||
                                (task.currentOwner === 'SEO' && (task.seoQcStatus === 'Pending QC' || task.seoQcStatus === 'QC') && (task.executionState === 'In Progress' || task.executionState === 'Paused'))) && (
                                <button onClick={() => openReworkModal(task)} className="p-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md" title="Raise Rework"><RotateCcw className="w-3.5 h-3.5" /></button>
                              )}
                              <button onClick={() => openEditModal(task)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-md" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteTask(task.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-400 rounded-md" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} className="p-1.5 text-slate-300 hover:text-slate-500">{isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50"><td colSpan={9} className="px-4 py-4 border-b border-slate-200">
                            <ExpandedContent task={task} times={times} formatMs={formatMs} getOwnerName={getOwnerName} commentTaskId={commentTaskId} setCommentTaskId={setCommentTaskId} commentText={commentText} setCommentText={setCommentText} commentAuthor={commentAuthor} setCommentAuthor={setCommentAuthor} handleAddComment={handleAddComment} />
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              {pagedTasks.length === 0 && sortedFilteredTasks.length === 0 && <div className="text-center py-12"><p className="text-slate-500">No tasks match the current filters.</p></div>}
            </div>
          ) : (
            /* ── CARD VIEW ── */
            <div className="grid grid-cols-1 gap-4">
              {pagedTasks.map(task => {
                const times = getTaskTimes(task);
                const isExpanded = expandedTaskId === task.id;
                const assignedDate = task.currentOwner === 'SEO' ? task.intakeDate : task.currentOwner === 'Content' ? task.contentAssignedDate : task.webAssignedDate;
                const estHours = task.currentOwner === 'SEO' ? (task.estHoursSEO || task.estHours || 0) : task.currentOwner === 'Content' ? (task.estHoursContent || 0) : (task.estHoursWeb || 0);
                const delayInfo = getDeptDelayedInfo(assignedDate || '', estHours, times.activeMs);
                const isDelayed = delayInfo.isDelayed;
                const delayReason = delayInfo.reason;
                const latestRework = task.reworkEntries?.[task.reworkEntries.length - 1];

                return (
                  <div key={task.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-md">{task.id}</span>
                            <span className={cn("text-xs font-bold px-2 py-1 rounded-md", deptColor(task.currentOwner))}>{task.currentOwner}</span>
                            <span className={cn("text-xs font-bold px-2 py-1 rounded-md", stateColor(task.executionState || 'Not Started'))}>{task.executionState || 'Not Started'}</span>
                            {isDelayed && (
                              <span className="text-xs font-bold px-2 py-1 bg-red-100 text-red-700 rounded-md flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {delayReason === 'calendar' ? 'Delayed (date)' : delayReason === 'overrun' ? 'Delayed (hrs)' : 'Delayed (date+hrs)'}
                              </span>
                            )}
                            {latestRework && (
                              <span className={cn("text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1", latestRework.withinEstimate ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                                {latestRework.withinEstimate ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {latestRework.withinEstimate ? 'Within Est.' : 'Over Est.'}
                              </span>
                            )}
                            {/* QC Submitted badge */}
                            {(task.seoQcStatus === 'Pending QC' || task.seoQcStatus === 'QC') && (
                              <span className="text-xs font-bold px-2 py-1 bg-teal-100 text-teal-800 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> QC Submitted
                              </span>
                            )}
                            {task.webStatus === 'Pending QC' && (
                              <span className="text-xs font-bold px-2 py-1 bg-teal-100 text-teal-800 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> QC → Web
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 leading-snug break-words whitespace-normal">{task.title}</h3>
                          <p className="text-sm text-slate-500">{task.client} · {task.seoStage}</p>
                          {task.docUrl && (
                            <a href={task.docUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-1 text-sm text-indigo-600 hover:underline">
                              <DocIcon url={task.docUrl} className="w-4 h-4" />
                              <span className="truncate max-w-[260px]">{task.docUrl}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-mono font-light text-slate-800 tracking-tight">{formatMs(times.activeMs)}</div>
                          <div className="text-xs text-slate-500 font-medium">Active Time</div>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-5 gap-3 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                        <div><p className="text-slate-500 font-medium mb-0.5">Keyword</p><p className="font-semibold text-slate-800 truncate" title={task.focusedKw}>{task.focusedKw || '-'}</p></div>
                        <div><p className="text-slate-500 font-medium mb-0.5">Volume</p><p className="font-semibold text-slate-800">{task.volume?.toLocaleString() || '-'}</p></div>
                        <div><p className="text-slate-500 font-medium mb-0.5">Monthly Rank</p><p className="font-semibold text-slate-800">{task.marRank || '-'}</p></div>
                        <div><p className="text-slate-500 font-medium mb-0.5">Cur Rank</p><p className="font-semibold text-slate-800">{task.currentRank || '-'}</p></div>
                        <div>
                          <p className="text-slate-500 font-medium mb-0.5">Est. Hours</p>
                          <div className="space-y-0.5">
                            {(task.estHoursSEO || task.estHours || 0) > 0 && <div className="flex items-center gap-1"><span className="text-blue-600">SEO:</span><span className="font-semibold">{task.estHoursSEO || task.estHours}h</span></div>}
                            {(task.estHoursContent || 0) > 0 && <div className="flex items-center gap-1"><span className="text-orange-600">Con:</span><span className="font-semibold">{task.estHoursContent}h</span></div>}
                            {(task.estHoursWeb || 0) > 0 && <div className="flex items-center gap-1"><span className="text-emerald-600">Web:</span><span className="font-semibold">{task.estHoursWeb}h</span></div>}
                          </div>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 flex-wrap">
                          {(task.executionState === 'Not Started' || !task.executionState) && <button onClick={() => logEvent(task.id, 'start', 'In Progress')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"><Play className="w-4 h-4" /> Start Task</button>}
                          {(task.executionState === 'In Progress' || task.executionState === 'Rework') && <>
                            <button onClick={() => logEvent(task.id, 'pause', 'Paused')} className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg"><Pause className="w-4 h-4" /> Pause</button>
                            <button onClick={() => setEndingTask(task)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"><CheckCircle2 className="w-4 h-4" /> End Task</button>
                          </>}
                          {task.executionState === 'Paused' && <>
                            <button onClick={() => logEvent(task.id, 'resume', 'In Progress')} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"><Play className="w-4 h-4" /> Resume</button>
                            <button onClick={() => setEndingTask(task)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg"><CheckCircle2 className="w-4 h-4" /> End Task</button>
                          </>}
                          {/* Raise Rework: show when SEO has a rework to assign, OR mid-review on QC submitted task */}
                          {((task.executionState === 'Rework' && task.currentOwner === 'SEO') ||
                            (task.currentOwner === 'SEO' && (task.seoQcStatus === 'Pending QC' || task.seoQcStatus === 'QC') && (task.executionState === 'In Progress' || task.executionState === 'Paused'))) && (
                            <button onClick={() => openReworkModal(task)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"><RotateCcw className="w-4 h-4" /> Raise Rework</button>
                          )}
                          {task.executionState === 'Ended' && <span className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 text-sm font-medium rounded-lg"><CheckCircle2 className="w-4 h-4" /> Ended</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditModal(task)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit task"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete task"><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => { setCommentTaskId(isExpanded && commentTaskId === task.id ? null : task.id); setExpandedTaskId(task.id); }} className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Comments">
                            <MessageSquare className="w-4 h-4" />
                            {(task.comments?.length || 0) > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-600 text-white text-[9px] rounded-full flex items-center justify-center">{task.comments!.length}</span>}
                          </button>
                          <button onClick={() => setExpandedTaskId(isExpanded ? null : task.id)} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors p-2">
                            <Clock className="w-4 h-4" />{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div className="bg-slate-50 border-t border-slate-200 p-5">
                        <ExpandedContent task={task} times={times} formatMs={formatMs} getOwnerName={getOwnerName} commentTaskId={commentTaskId} setCommentTaskId={setCommentTaskId} commentText={commentText} setCommentText={setCommentText} commentAuthor={commentAuthor} setCommentAuthor={setCommentAuthor} handleAddComment={handleAddComment} />
                      </div>
                    )}
                  </div>
                );
              })}
              {pagedTasks.length === 0 && sortedFilteredTasks.length === 0 && <div className="text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed"><p className="text-slate-500">No tasks match the current filters.</p></div>}
            </div>
          )}
        </div>
      </div>

      {/* ── PAGINATION ── */}
      {sortedFilteredTasks.length > 0 && (
        <div className="bg-white border-t border-slate-200 px-4 py-2.5 shrink-0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Showing {Math.min((currentPage - 1) * pageSize + 1, sortedFilteredTasks.length)}–{Math.min(currentPage * pageSize, sortedFilteredTasks.length)} of {sortedFilteredTasks.length}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Per page:</span>
              {[10, 25, 50, 100].map(n => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={cn("px-2 py-1 text-xs rounded-md border transition-colors",
                    pageSize === n ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}>{n}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-md hover:bg-slate-50">«</button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-md hover:bg-slate-50">‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && (p as number) - (arr[i-1] as number) > 1) acc.push('...');
                acc.push(p); return acc;
              }, [])
              .map((p, i) => p === '...' ? (
                <span key={`e${i}`} className="px-1.5 py-1 text-xs text-slate-400">…</span>
              ) : (
                <button key={p} onClick={() => setCurrentPage(p as number)}
                  className={cn("px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
                    currentPage === p ? "bg-indigo-600 text-white border-indigo-600" : "text-slate-500 border-slate-200 hover:bg-slate-50"
                  )}>{p}</button>
              ))}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-md hover:bg-slate-50">Next ›</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 rounded-md hover:bg-slate-50">»</button>
          </div>
        </div>
      )}

      {/* ── END TASK MODAL ── */}
      {endingTask && (
        <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">End Task</h3>
              <p className="text-sm text-slate-500 mt-1">{handoffStep === 'select_action' ? 'Where should this task go next?' : 'Configure Assignment'}</p>
            </div>
            <div className="p-6 space-y-3">
              {handoffStep === 'select_action' ? (
                <>
                  {endingTask.currentOwner === 'SEO' && <>
                    <ActionBtn icon={<UserCircle className="w-5 h-5"/>} color="orange" label="Assign to Content Team" sub="Pass to content writers" onClick={() => handleActionSelect('assign_content')} />
                    <ActionBtn icon={<UserCircle className="w-5 h-5"/>} color="emerald" label="Assign to Web Team" sub="Pass to developers" onClick={() => handleActionSelect('assign_web')} />
                    <ActionBtn icon={<CheckCircle2 className="w-5 h-5"/>} color="blue" label="Mark Approved" sub="Approve QC submission" onClick={() => handleActionSelect('approve')} />
                    <ActionBtn icon={<RotateCcw className="w-5 h-5"/>} color="purple" label="Mark Rework" sub="Send back for rework" onClick={() => handleActionSelect('rework')} />
                  </>}
                  {endingTask.currentOwner === 'Content' && <>
                    <ActionBtn icon={<UserCircle className="w-5 h-5"/>} color="emerald" label="Assign to Web Team" sub="Pass to developers" onClick={() => handleActionSelect('assign_web')} />
                    <ActionBtn icon={<CheckCircle2 className="w-5 h-5"/>} color="blue" label="QC Submit to SEO" sub="Send to SEO for review" onClick={() => handleActionSelect('qc_seo')} />
                  </>}
                  {endingTask.currentOwner === 'Web' && <>
                    <ActionBtn icon={<CheckCircle2 className="w-5 h-5"/>} color="blue" label="QC Submit to SEO" sub="Send to SEO for review" onClick={() => handleActionSelect('qc_seo')} />
                    <ActionBtn icon={<CheckCircle2 className="w-5 h-5"/>} color="emerald" label="QC Submit to Web Team" sub="Send for peer review" onClick={() => handleActionSelect('qc_web')} />
                  </>}
                  <ActionBtn icon={<Square className="w-5 h-5"/>} color="slate" label="Close Task (Bypass)" sub="Mark as completely finished" onClick={() => handleActionSelect('close')} />
                </>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assignment Date</label>
                    <input type="date" value={assignmentDate} onChange={e => setAssignmentDate(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  {(selectedAction === 'assign_content' || selectedAction === 'assign_web') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Est. Hours for {selectedAction === 'assign_content' ? 'Content' : 'Web'} Team</label>
                      <input type="number" min="0" step="0.5" placeholder="e.g. 3.5" value={assignmentEstHours} onChange={e => setAssignmentEstHours(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      <p className="text-xs text-slate-400 mt-1">Used to track delays</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Working Document <span className="text-slate-400 font-normal">(Google Sheet / Doc / URL)</span>
                    </label>
                    {endingTask?.docUrl && assignmentDocUrl === endingTask.docUrl && (
                      <div className="flex items-center gap-1.5 mb-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Carried over from SEO's working doc — team will use the same file
                      </div>
                    )}
                    <input type="url" placeholder="https://docs.google.com/..." value={assignmentDocUrl} onChange={e => setAssignmentDocUrl(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    {assignmentDocUrl && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-indigo-600">
                        <DocIcon url={assignmentDocUrl} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{assignmentDocUrl}</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-1">This link will be attached to the task and visible to the assigned team member</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                    <select value={assignmentOwner} onChange={e => setAssignmentOwner(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {selectedAction === 'assign_content' && adminOptions.contentOwners.map(o => <option key={o}>{o}</option>)}
                      {(selectedAction === 'assign_web' || selectedAction === 'qc_web') && adminOptions.webOwners.map(o => <option key={o}>{o}</option>)}
                      {selectedAction === 'qc_seo' && adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <button onClick={() => executeHandoff(selectedAction!, assignmentDate, assignmentOwner, parseFloat(assignmentEstHours) || 0, assignmentDocUrl)} className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700 mt-4">Confirm Assignment</button>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button onClick={() => { if (handoffStep === 'configure_assignment') setHandoffStep('select_action'); else setEndingTask(null); }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
                {handoffStep === 'configure_assignment' ? 'Back' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REWORK MODAL ── */}
      {reworkingTask && (() => {
        const times = getTaskTimes(reworkingTask);
        const hoursSpent = times.activeMs / 3600000;
        const originalEst = reworkingTask.estHours || 0;
        const reworkEst = parseFloat(reworkForm.estHours) || 0;
        const remaining = originalEst > 0 ? originalEst - hoursSpent : null;
        const wouldBeWithin = remaining !== null && reworkEst > 0 && reworkEst <= remaining;
        return (
          <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.5)" }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-1"><div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><RotateCcw className="w-5 h-5" /></div><h3 className="text-xl font-bold text-slate-900">Raise Rework</h3></div>
                <p className="text-sm text-slate-500 ml-12">{reworkingTask.title}</p>
              </div>
              <div className="px-6 pt-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex gap-6 text-sm">
                  <div><p className="text-xs text-slate-500 font-medium">Original Est.</p><p className="font-bold text-slate-800">{originalEst > 0 ? `${originalEst}h` : '—'}</p></div>
                  <div><p className="text-xs text-slate-500 font-medium">Time Spent</p><p className="font-bold text-slate-800">{hoursSpent.toFixed(2)}h</p></div>
                  <div><p className="text-xs text-slate-500 font-medium">Remaining</p><p className={cn("font-bold", remaining !== null && remaining < 0 ? "text-red-600" : "text-slate-800")}>{remaining !== null ? `${remaining.toFixed(2)}h` : '—'}</p></div>
                  {reworkEst > 0 && <div className="ml-auto flex items-center"><span className={cn("text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5", wouldBeWithin ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{wouldBeWithin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{wouldBeWithin ? 'Within Estimate' : 'Over Estimate'}</span></div>}
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Rework Date</label><input type="date" value={reworkForm.date} onChange={e => setReworkForm(f => ({...f, date: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500" /></div>
                <div><label className="block text-sm font-medium text-slate-700 mb-1">Est. Hours for Rework</label><input type="number" min="0" step="0.5" placeholder="e.g. 2.5" value={reworkForm.estHours} onChange={e => setReworkForm(f => ({...f, estHours: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500" /></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => setReworkForm(f => ({...f, assignedDept: 'Content', assignedOwner: adminOptions.contentOwners[0] || ''}))} className={cn("flex-1 py-2 text-sm font-medium rounded-lg border transition-colors", reworkForm.assignedDept === 'Content' ? "bg-orange-100 border-orange-400 text-orange-800" : "bg-white border-slate-300 text-slate-600")}>Content Team</button>
                    <button onClick={() => setReworkForm(f => ({...f, assignedDept: 'Web', assignedOwner: adminOptions.webOwners[0] || ''}))} className={cn("flex-1 py-2 text-sm font-medium rounded-lg border transition-colors", reworkForm.assignedDept === 'Web' ? "bg-emerald-100 border-emerald-400 text-emerald-800" : "bg-white border-slate-300 text-slate-600")}>Web Team</button>
                  </div>
                  <select value={reworkForm.assignedOwner} onChange={e => setReworkForm(f => ({...f, assignedOwner: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500">
                    {(reworkForm.assignedDept === 'Content' ? adminOptions.contentOwners : adminOptions.webOwners).map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between">
                <button onClick={() => setReworkingTask(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
                <button onClick={handleConfirmRework} disabled={!reworkForm.estHours || !reworkForm.assignedOwner} className="px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">Confirm Rework</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EDIT TASK MODAL ── */}
      {editingTask && (
        <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div><h3 className="text-xl font-bold text-slate-900">Edit Task</h3><p className="text-sm text-slate-500">{editingTask.id}</p></div>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {[
                { label: 'Title', field: 'title', type: 'text' },
                { label: 'Intake Date', field: 'intakeDate', type: 'date' },
                { label: 'Focused Keyword', field: 'focusedKw', type: 'text' },
                { label: 'Volume', field: 'volume', type: 'number' },
                { label: 'Monthly Rank', field: 'marRank', type: 'number' },
                { label: 'Current Rank', field: 'currentRank', type: 'number' },
                { label: 'Est. Hours (SEO)', field: 'estHoursSEO', type: 'number' },
                { label: 'Est. Hours (Content)', field: 'estHoursContent', type: 'number' },
                { label: 'Est. Hours (Web)', field: 'estHoursWeb', type: 'number' },
                { label: 'Target URL', field: 'targetUrl', type: 'url' },
                { label: 'Google Doc / Sheet URL', field: 'docUrl', type: 'url' },
                { label: 'Remarks', field: 'remarks', type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                  <input type={type} value={(editForm as any)[field] || ''} onChange={e => setEditForm(f => ({...f, [field]: type === 'number' ? Number(e.target.value) : e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  {field === 'docUrl' && (editForm as any).docUrl && <div className="flex items-center gap-2 mt-1 text-xs text-indigo-600"><DocIcon url={(editForm as any).docUrl} className="w-4 h-4" /><span className="truncate">{(editForm as any).docUrl}</span></div>}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                <select value={editForm.client || ''} onChange={e => setEditForm(f => ({...f, client: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {adminOptions.clients.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SEO Owner</label>
                <select value={editForm.seoOwner || ''} onChange={e => setEditForm(f => ({...f, seoOwner: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">SEO Stage</label>
                <select value={editForm.seoStage || ''} onChange={e => setEditForm(f => ({...f, seoStage: e.target.value}))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {adminOptions.seoStages.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between">
              <button onClick={() => setEditingTask(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
              <button onClick={saveEdit} className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW TASK MODAL ── */}
      {isNewTaskModalOpen && (() => {
        const role = currentUser?.role || 'seo';
        const isContent = role === 'content';
        const isWeb = role === 'web';
        const roleLabel = isContent ? 'Content' : isWeb ? 'Web' : 'SEO';
        const roleBtnColor = isContent ? 'bg-orange-500 hover:bg-orange-600' : isWeb ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700';
        const roleBadgeBg = isContent ? '#FAEEDA' : isWeb ? '#E1F5EE' : '#E6F1FB';
        const roleBadgeColor = isContent ? '#633806' : isWeb ? '#085041' : '#0C447C';
        const fld = (label: string, field: string, type = 'text', placeholder = '') => (
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
          <input type={type} value={(newTaskForm as any)[field] || ''} placeholder={placeholder}
            onChange={e => setNewTaskForm({...newTaskForm, [field]: type === 'number' ? Number(e.target.value) : e.target.value})}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
        );
        const drp = (label: string, field: string, options: string[]) => (
          <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
          <select value={(newTaskForm as any)[field] || ''} onChange={e => setNewTaskForm({...newTaskForm, [field]: e.target.value})}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {options.map(o => <option key={o}>{o}</option>)}
          </select></div>
        );
        return (
          <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.5)" }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background: roleBadgeBg, color: roleBadgeColor}}>{roleLabel}</span>
                <h3 className="text-base font-bold text-slate-900">Create New Task</h3>
                <p className="text-xs text-slate-400 ml-1">
                  {isContent ? '— your assigned date will auto-set as intake date' : isWeb ? '— your assigned date will auto-set as intake date' : ''}
                </p>
              </div>
              <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">
                {fld('Task Title ★', 'title', 'text', 'Enter task title...')}
                <div className="grid grid-cols-2 gap-3">
                  {drp('Client ★', 'client', adminOptions.clients)}
                  {drp('Stage ★', 'seoStage', adminOptions.seoStages)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {drp(isContent || isWeb ? 'SEO Owner ★ (QC reviewer)' : 'SEO Owner ★', 'seoOwner', adminOptions.seoOwners)}
                  {isContent && fld('Content Assigned Date ★', 'contentAssignedDate', 'date')}
                  {isWeb    && fld('Web Assigned Date ★', 'webAssignedDate', 'date')}
                  {!isContent && !isWeb && fld('Intake Date ★', 'intakeDate', 'date')}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {fld('Est. Hrs (SEO)', 'estHoursSEO', 'number', '0')}
                  {fld('Est. Hrs (Content)', 'estHoursContent', 'number', '0')}
                  {fld('Est. Hrs (Web)', 'estHoursWeb', 'number', '0')}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fld('Focused Keyword', 'focusedKw', 'text', 'e.g. inconel pipes')}
                  {fld('Target URL', 'targetUrl', 'url', 'https://...')}
                </div>
                {fld(isContent ? 'Canva / Doc URL' : isWeb ? 'Live / Doc URL' : 'Doc URL', 'docUrl', 'url', 'https://...')}
                <div><label className="block text-xs font-medium text-slate-600 mb-1">Remarks</label>
                  <textarea value={newTaskForm.remarks || ''} rows={2} placeholder="Optional notes..."
                    onChange={e => setNewTaskForm({...newTaskForm, remarks: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
                {(isContent || isWeb) && (
                  <div className="rounded-lg px-3 py-2 text-xs" style={{background: roleBadgeBg, color: roleBadgeColor}}>
                    Your assigned date will also be set as the SEO intake date so this task appears in all team reports and filters from day one. When you QC submit to SEO, today's date will update as the SEO intake date.
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t border-slate-100 flex gap-3 justify-end">
                <button onClick={() => setIsNewTaskModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
                <button onClick={handleCreateTask} disabled={!newTaskForm.title}
                  className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${roleBtnColor}`}>
                  Create {roleLabel} Task
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Small helper components ────────────────────────────────────────────────

function ActionBtn({ icon, color, label, sub, onClick }: { icon: React.ReactNode; color: string; label: string; sub: string; onClick: () => void }) {
  const colors: Record<string, string> = {
    orange: 'hover:border-orange-500 hover:bg-orange-50 group-hover:text-orange-900 bg-orange-100 text-orange-600',
    emerald: 'hover:border-emerald-500 hover:bg-emerald-50 group-hover:text-emerald-900 bg-emerald-100 text-emerald-600',
    blue: 'hover:border-blue-500 hover:bg-blue-50 group-hover:text-blue-900 bg-blue-100 text-blue-600',
    purple: 'hover:border-purple-500 hover:bg-purple-50 group-hover:text-purple-900 bg-purple-100 text-purple-600',
    slate: 'hover:border-slate-500 hover:bg-slate-50 group-hover:text-slate-900 bg-slate-100 text-slate-600',
  };
  const c = colors[color] || colors.slate;
  return (
    <button onClick={onClick} className={cn("w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 transition-colors group", c.split(' ').filter(x => x.startsWith('hover:')).join(' '))}>
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", c.split(' ').filter(x => !x.startsWith('hover:') && !x.startsWith('group-hover:')).join(' '))}>{icon}</div>
        <div className="text-left"><p className={cn("font-bold text-slate-900", c.split(' ').filter(x => x.startsWith('group-hover:')).join(' '))}>{label}</p><p className="text-xs text-slate-500">{sub}</p></div>
      </div>
      <ArrowRight className="w-5 h-5 text-slate-400" />
    </button>
  );
}

function ExpandedContent({ task, times, formatMs, getOwnerName, commentTaskId, setCommentTaskId, commentText, setCommentText, commentAuthor, setCommentAuthor, handleAddComment }: any) {
  return (
    <div>
      {/* Time summary */}
      <div className="flex gap-8 mb-4">
        <div><p className="text-xs text-slate-500 font-medium">Total Active</p><p className="text-lg font-mono text-slate-800">{formatMs(times.activeMs)}</p></div>
        <div><p className="text-xs text-slate-500 font-medium">Total Paused</p><p className="text-lg font-mono text-slate-800">{formatMs(times.pauseMs)}</p></div>
        <div><p className="text-xs text-slate-500 font-medium">Total Rework</p><p className="text-lg font-mono text-slate-800">{formatMs(times.reworkMs)}</p></div>
      </div>

      {/* Rework history */}
      {task.reworkEntries && task.reworkEntries.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Rework History ({task.reworkEntries.length} cycle{task.reworkEntries.length !== 1 ? 's' : ''})</p>
          <div className="space-y-2">
            {task.reworkEntries.map((rw: ReworkEntry, i: number) => {
              const isNotStarted = !rw.startTimestamp || rw.startTimestamp === '';
              const durMs = rw.durationMs || (rw.endTimestamp && rw.startTimestamp
                ? new Date(rw.endTimestamp).getTime() - new Date(rw.startTimestamp).getTime()
                : rw.startTimestamp ? Date.now() - new Date(rw.startTimestamp).getTime() : 0);
              const durH = Math.floor(durMs / 3600000);
              const durM = Math.floor((durMs % 3600000) / 60000);
              const durStr = durMs > 0 ? `${durH}h ${durM}m` : '—';
              const isOpen = !isNotStarted && !rw.endTimestamp;
              return (
                <div key={rw.id} className="bg-white border border-purple-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-700">Rework #{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1",
                        rw.assignedDept === 'Content' ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                      )}>{rw.assignedDept} · {rw.assignedOwner}</span>
                      <span className={cn("text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1",
                        rw.withinEstimate ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {rw.withinEstimate ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {rw.withinEstimate ? 'Within Est.' : 'Over Est.'}
                      </span>
                      {isNotStarted && <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">Awaiting start</span>}
                      {isOpen && <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" /> In progress</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div className="bg-purple-50 rounded-lg p-2">
                      <p className="text-purple-500 font-medium mb-0.5">Start time</p>
                      <p className="font-mono font-semibold text-purple-900">
                        {isNotStarted ? '— not started yet' : new Date(rw.startTimestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className={cn("rounded-lg p-2", isNotStarted ? "bg-slate-50" : isOpen ? "bg-amber-50" : "bg-purple-50")}>
                      <p className={cn("font-medium mb-0.5", isNotStarted ? "text-slate-400" : isOpen ? "text-amber-500" : "text-purple-500")}>End time</p>
                      <p className={cn("font-mono font-semibold", isNotStarted ? "text-slate-400" : isOpen ? "text-amber-700" : "text-purple-900")}>
                        {isNotStarted ? '—' : rw.endTimestamp ? new Date(rw.endTimestamp).toLocaleString() : '— still running'}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-slate-500 font-medium mb-0.5">Duration</p>
                      <p className="font-mono font-semibold text-slate-800">
                        {isNotStarted ? '—' : isOpen ? `${durStr} (live)` : durStr}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2">
                      <p className="text-slate-500 font-medium mb-0.5">Est. · Spent before</p>
                      <p className="font-semibold text-slate-800">{rw.estHours}h · {rw.hoursAlreadySpent}h</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Time log */}
      {task.timeEvents && task.timeEvents.length > 0 ? (
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Time Log</p>
          <table className="w-full text-sm text-left bg-white rounded-lg overflow-hidden border border-slate-200">
            <thead className="text-xs text-slate-500 uppercase bg-slate-100">
              <tr><th className="px-4 py-2">Event</th><th className="px-4 py-2">Department</th><th className="px-4 py-2">Owner</th><th className="px-4 py-2">Timestamp</th></tr>
            </thead>
            <tbody>
              {task.timeEvents.map((e: TimeEvent, i: number) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 font-medium capitalize text-slate-700">{e.type.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-slate-600">{e.department}</td>
                  <td className="px-4 py-2 text-slate-600 font-medium">{getOwnerName(e.department, task)}</td>
                  <td className="px-4 py-2 text-slate-500 font-mono text-xs">{new Date(e.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-slate-500 italic mb-4">No time logs yet.</p>}

      {/* Comments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase">Comments ({task.comments?.length || 0})</p>
          {commentTaskId !== task.id && <button onClick={() => setCommentTaskId(task.id)} className="text-xs text-indigo-600 hover:underline flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Add comment</button>}
        </div>
        {task.comments && task.comments.length > 0 && (
          <div className="space-y-2 mb-3">
            {task.comments.map((c: Comment) => (
              <div key={c.id} className="bg-white border border-slate-200 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-indigo-700">{c.author}</span>
                  <span className="text-[10px] text-slate-400">{new Date(c.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-700">{c.text}</p>
              </div>
            ))}
          </div>
        )}
        {commentTaskId === task.id && (
          <div className="bg-white border border-indigo-200 rounded-xl p-3 space-y-2">
            <input type="text" placeholder="Your name..." value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <textarea placeholder="Write a comment or question..." value={commentText} onChange={e => setCommentText(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCommentTaskId(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={() => handleAddComment(task.id)} disabled={!commentText.trim() || !commentAuthor.trim()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                <Send className="w-3 h-3" /> Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
