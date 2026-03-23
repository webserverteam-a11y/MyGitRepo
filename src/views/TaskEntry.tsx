import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { Task } from '../types';
import { Plus, Upload, Trash2, CheckSquare, Square, Download, History, X, RotateCcw, Eye } from 'lucide-react';
import { cn } from '../utils';

interface UploadRecord {
  id: string;
  uploadedBy: string;
  timestamp: string;
  taskCount: number;
  taskIds: string[];
}

// Confirmation modal
function ConfirmModal({ message, detail, confirmLabel, confirmColor, onConfirm, onCancel }: {
  message: string; detail?: string; confirmLabel: string;
  confirmColor: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:2147483647, display:"flex", alignItems:"center", justifyContent:"center", padding:16, background:"rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <p className="font-bold text-zinc-900 text-base mb-2">{message}</p>
        {detail && <p className="text-sm text-zinc-500 mb-6">{detail}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className={cn("px-4 py-2 text-sm font-medium text-white rounded-lg", confirmColor)}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function TaskEntry() {
  const { tasks, setTasks, adminOptions } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [seoOwnerFilter, setSeoOwnerFilter] = useState('All');

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Undo
  const [undoSnapshot, setUndoSnapshot] = useState<Task[] | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [undoMessage, setUndoMessage] = useState('');

  // Upload history
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  // Confirmation dialog
  const [confirm, setConfirm] = useState<null | {
    message: string; detail?: string; confirmLabel: string;
    confirmColor: string; onConfirm: () => void;
  }>(null);

  // Pending upload data (awaiting confirmation)
  const [pendingUpload, setPendingUpload] = useState<{ tasks: Task[]; uploaderName: string } | null>(null);
  const [uploaderName, setUploaderName] = useState('');
  const [showUploaderInput, setShowUploaderInput] = useState(false);
  const [pendingCsvTasks, setPendingCsvTasks] = useState<Task[]>([]);

  const createEmptyTask = (): Task => ({
    id: `T-${Math.floor(Math.random() * 10000)}`,
    intakeDate: new Date().toISOString().split('T')[0],
    title: '', client: '', seoOwner: '', seoStage: '',
    seoQcStatus: 'Pending', focusedKw: '', volume: 0, marRank: 0, currentRank: 0,
    estHours: 0, estHoursSEO: 0, estHoursContent: 0, estHoursWeb: 0, actualHours: 0,
    contentAssignedDate: '', contentOwner: '', contentStatus: '',
    webAssignedDate: '', webOwner: '', targetUrl: '', webStatus: '',
    currentOwner: 'SEO', daysInStage: 0, remarks: '',
    isCompleted: false, executionState: 'Not Started', timeEvents: [],
  });

  const [newTask, setNewTask] = useState<Task>(createEmptyTask());

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (dateFrom && t.intakeDate < dateFrom) return false;
      if (dateTo && t.intakeDate > dateTo) return false;
      if (clientFilter !== 'All' && t.client !== clientFilter) return false;
      if (seoOwnerFilter !== 'All' && t.seoOwner !== seoOwnerFilter) return false;
      return true;
    });
  }, [tasks, dateFrom, dateTo, clientFilter, seoOwnerFilter]);

  const allFilteredSelected = filteredTasks.length > 0 && filteredTasks.every(t => selectedIds.has(t.id));

  // Undo helpers
  const saveSnapshot = (msg: string) => {
    setUndoSnapshot([...tasks]);
    setUndoMessage(msg);
    if (undoTimer) clearTimeout(undoTimer);
    const t = setTimeout(() => { setUndoSnapshot(null); setUndoMessage(''); }, 30000);
    setUndoTimer(t);
  };

  const handleUndo = () => {
    setConfirm({
      message: 'Undo last action?',
      detail: `This will revert: "${undoMessage}". This cannot be undone again.`,
      confirmLabel: 'Yes, undo',
      confirmColor: 'bg-amber-600 hover:bg-amber-700',
      onConfirm: () => {
        if (undoSnapshot) { setTasks(undoSnapshot); setUndoSnapshot(null); setUndoMessage(''); }
        setConfirm(null);
      }
    });
  };

  // CSV template download
  const downloadTemplate = () => {
    const headers = [
      'intakeDate','title','client','seoOwner','seoStage','seoQcStatus',
      'focusedKw','volume','marRank','currentRank',
      'estHoursSEO','estHoursContent','estHoursWeb',
      'contentAssignedDate','contentOwner','contentStatus',
      'webAssignedDate','webOwner','targetUrl','docUrl','webStatus',
      'currentOwner','daysInStage','remarks'
    ];
    const example = [
      new Date().toISOString().split('T')[0],
      'Example Task Title','Client Name','SEO Owner Name','On Page','Pending',
      'example keyword','1500','15','12',
      '2','3','4',
      '','','',
      '','','https://example.com','https://docs.google.com/spreadsheets/...','Pending',
      'SEO','0','Optional remarks here'
    ];
    const csv = headers.join(',') + '\n' + example.join(',');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'task-entry-template.csv'; a.click();
  };

  // CSV upload flow
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { alert('CSV must have a header row and at least one data row.'); return; }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
      const newTasks: Task[] = lines.slice(1).map((line, idx) => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const get = (key: string) => { const i = headers.indexOf(key); return i >= 0 ? vals[i] || '' : ''; };
        const task: Task = {
          ...createEmptyTask(),
          id: `T-${Math.floor(Math.random() * 100000)}-${idx}`,
          intakeDate: get('intakedate') || new Date().toISOString().split('T')[0],
          title: get('title') || 'Untitled Task',
          client: get('client') || adminOptions.clients[0] || '',
          seoOwner: get('seoowner') || adminOptions.seoOwners[0] || '',
          seoStage: get('seostage') || adminOptions.seoStages[0] || '',
          seoQcStatus: get('seoqcstatus') || 'Pending',
          focusedKw: get('focusedkw'),
          volume: Number(get('volume')) || 0,
          marRank: Number(get('marrank')) || 0,
          currentRank: Number(get('currentrank')) || 0,
          estHours: Number(get('esthourseo')) || 0,
          estHoursSEO: Number(get('esthourseo')) || 0,
          estHoursContent: Number(get('esthourscontent')) || 0,
          estHoursWeb: Number(get('estHoursweb')) || Number(get('esthoursWeb')) || 0,
          contentAssignedDate: get('contentassigneddate'),
          contentOwner: get('contentowner'),
          contentStatus: get('contentstatus'),
          webAssignedDate: get('webassigneddate'),
          webOwner: get('webowner'),
          targetUrl: get('targeturl'),
          docUrl: get('docurl'),
          webStatus: get('webstatus'),
          currentOwner: get('currentowner') || 'SEO',
          daysInStage: Number(get('daysinstage')) || 0,
          remarks: get('remarks'),
        };
        return task;
      });
      setPendingCsvTasks(newTasks);
      setShowUploaderInput(true);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmUpload = () => {
    if (!uploaderName.trim()) { alert('Please enter your name before uploading.'); return; }
    setConfirm({
      message: `Upload ${pendingCsvTasks.length} tasks?`,
      detail: `Uploaded by: ${uploaderName}. These tasks will be added to the top of the list. You can undo this action for 30 seconds.`,
      confirmLabel: 'Yes, upload',
      confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
      onConfirm: () => {
        saveSnapshot(`CSV upload of ${pendingCsvTasks.length} tasks by ${uploaderName}`);
        const record: UploadRecord = {
          id: `UPL-${Date.now()}`,
          uploadedBy: uploaderName,
          timestamp: new Date().toLocaleString(),
          taskCount: pendingCsvTasks.length,
          taskIds: pendingCsvTasks.map(t => t.id),
        };
        setTasks(prev => [...pendingCsvTasks, ...prev]);
        setUploadHistory(prev => [record, ...prev]);
        setPendingCsvTasks([]);
        setShowUploaderInput(false);
        setUploaderName('');
        setConfirm(null);
      }
    });
  };

  const cancelUpload = () => {
    setConfirm({
      message: 'Cancel this upload?',
      detail: 'The parsed tasks will be discarded. No changes will be made.',
      confirmLabel: 'Yes, discard',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        setPendingCsvTasks([]);
        setShowUploaderInput(false);
        setUploaderName('');
        setConfirm(null);
      }
    });
  };

  // Bulk delete
  const bulkDelete = () => {
    setConfirm({
      message: `Delete ${selectedIds.size} task${selectedIds.size !== 1 ? 's' : ''}?`,
      detail: 'This will permanently remove the selected tasks. You can undo this for 30 seconds.',
      confirmLabel: 'Yes, delete',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        saveSnapshot(`Bulk delete of ${selectedIds.size} tasks`);
        setTasks(prev => prev.filter(t => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
        setConfirm(null);
      }
    });
  };

  const deleteTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    setConfirm({
      message: 'Delete this task?',
      detail: `"${task?.title || id}" will be removed. You can undo this for 30 seconds.`,
      confirmLabel: 'Yes, delete',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        saveSnapshot(`Deleted task: ${task?.title || id}`);
        setTasks(prev => prev.filter(t => t.id !== id));
        setConfirm(null);
      }
    });
  };

  const removeBatch = (record: UploadRecord) => {
    setConfirm({
      message: `Remove batch "${record.uploadedBy}" (${record.taskCount} tasks)?`,
      detail: `Uploaded ${record.timestamp}. All ${record.taskCount} tasks from this upload will be deleted. You can undo for 30 seconds.`,
      confirmLabel: 'Yes, remove batch',
      confirmColor: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        saveSnapshot(`Removed batch upload by ${record.uploadedBy}`);
        setTasks(prev => prev.filter(t => !record.taskIds.includes(t.id)));
        setUploadHistory(prev => prev.filter(r => r.id !== record.id));
        setConfirm(null);
      }
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(prev => { const next = new Set(prev); filteredTasks.forEach(t => next.delete(t.id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); filteredTasks.forEach(t => next.add(t.id)); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleAddRow = () => {
    if (!newTask.title) { alert('Please enter a task title'); return; }
    saveSnapshot('Added new task row');
    setTasks(prev => [newTask, ...prev]);
    setNewTask(createEmptyTask());
  };

  const updateTask = (id: string, field: keyof Task, value: any) => {
    setTasks(prev => prev.map(t => { if (t.id !== id) return t; const u = { ...t, [field]: value }; if (field === 'currentOwner') u.isCompleted = value === 'Completed'; return u; }));
  };

  const sel = (value: string, options: string[], onChange: (v: string) => void) => (
    <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 p-1 text-sm min-w-[120px]">
      <option value="">-- Select --</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const inp = (value: any, type: string, onChange: (v: any) => void, minW = 'min-w-[100px]') => (
    <input type={type} value={value || ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} className={cn("w-full bg-transparent border-none focus:ring-0 p-1 text-sm", minW)} />
  );

  const th = (label: string, extra = '') => <th className={cn("px-2 py-3 font-medium whitespace-nowrap", extra)}>{label}</th>;

  // CSV columns in the table (no duplicates)
  const COLS = [
    { label: 'Intake Date', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.intakeDate,'date',v=>setNewTask({...newTask,intakeDate:v})) : inp(t.intakeDate,'date',v=>updateTask(t.id,'intakeDate',v)) },
    { label: 'Title', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.title,'text',v=>setNewTask({...newTask,title:v}),'min-w-[200px]') : inp(t.title,'text',v=>updateTask(t.id,'title',v),'min-w-[200px]') },
    { label: 'Client', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.client,adminOptions.clients,v=>setNewTask({...newTask,client:v})) : sel(t.client,adminOptions.clients,v=>updateTask(t.id,'client',v)) },
    { label: 'SEO Owner', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.seoOwner,adminOptions.seoOwners,v=>setNewTask({...newTask,seoOwner:v})) : sel(t.seoOwner,adminOptions.seoOwners,v=>updateTask(t.id,'seoOwner',v)) },
    { label: 'SEO Stage', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.seoStage,adminOptions.seoStages,v=>setNewTask({...newTask,seoStage:v})) : sel(t.seoStage,adminOptions.seoStages,v=>updateTask(t.id,'seoStage',v)) },
    { label: 'SEO QC Status', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.seoQcStatus,adminOptions.seoQcStatuses,v=>setNewTask({...newTask,seoQcStatus:v})) : sel(t.seoQcStatus,adminOptions.seoQcStatuses,v=>updateTask(t.id,'seoQcStatus',v)) },
    { label: 'Focused KW', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.focusedKw,'text',v=>setNewTask({...newTask,focusedKw:v})) : inp(t.focusedKw,'text',v=>updateTask(t.id,'focusedKw',v)) },
    { label: 'Volume', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.volume,'number',v=>setNewTask({...newTask,volume:v}),'min-w-[70px]') : inp(t.volume,'number',v=>updateTask(t.id,'volume',v),'min-w-[70px]') },
    { label: 'Monthly Rank', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.marRank,'number',v=>setNewTask({...newTask,marRank:v}),'min-w-[70px]') : inp(t.marRank,'number',v=>updateTask(t.id,'marRank',v),'min-w-[70px]') },
    { label: 'Cur Rank', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.currentRank,'number',v=>setNewTask({...newTask,currentRank:v}),'min-w-[70px]') : inp(t.currentRank,'number',v=>updateTask(t.id,'currentRank',v),'min-w-[70px]') },
    { label: 'Δ Rank', render: (t: Task, isNew?: boolean) => <span className="text-center block text-zinc-500 font-medium">{isNew ? (newTask.marRank||0)-(newTask.currentRank||0) : (t.marRank||0)-(t.currentRank||0)}</span> },
    { label: 'Est Hrs (SEO)', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.estHoursSEO,'number',v=>setNewTask({...newTask,estHoursSEO:v,estHours:v}),'min-w-[70px]') : inp(t.estHoursSEO||t.estHours,'number',v=>updateTask(t.id,'estHoursSEO',v),'min-w-[70px]') },
    { label: 'Est Hrs (Con)', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.estHoursContent,'number',v=>setNewTask({...newTask,estHoursContent:v}),'min-w-[70px]') : inp(t.estHoursContent,'number',v=>updateTask(t.id,'estHoursContent',v),'min-w-[70px]') },
    { label: 'Est Hrs (Web)', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.estHoursWeb,'number',v=>setNewTask({...newTask,estHoursWeb:v}),'min-w-[70px]') : inp(t.estHoursWeb,'number',v=>updateTask(t.id,'estHoursWeb',v),'min-w-[70px]') },
    { label: 'Content Date', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.contentAssignedDate,'date',v=>setNewTask({...newTask,contentAssignedDate:v})) : inp(t.contentAssignedDate,'date',v=>updateTask(t.id,'contentAssignedDate',v)) },
    { label: 'Content Owner', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.contentOwner||'',adminOptions.contentOwners,v=>setNewTask({...newTask,contentOwner:v})) : sel(t.contentOwner||'',adminOptions.contentOwners,v=>updateTask(t.id,'contentOwner',v)) },
    { label: 'Content Status', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.contentStatus,adminOptions.contentStatuses,v=>setNewTask({...newTask,contentStatus:v})) : sel(t.contentStatus,adminOptions.contentStatuses,v=>updateTask(t.id,'contentStatus',v)) },
    { label: 'Web Date', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.webAssignedDate,'date',v=>setNewTask({...newTask,webAssignedDate:v})) : inp(t.webAssignedDate,'date',v=>updateTask(t.id,'webAssignedDate',v)) },
    { label: 'Web Owner', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.webOwner||'',adminOptions.webOwners,v=>setNewTask({...newTask,webOwner:v})) : sel(t.webOwner||'',adminOptions.webOwners,v=>updateTask(t.id,'webOwner',v)) },
    { label: 'Target URL', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.targetUrl,'text',v=>setNewTask({...newTask,targetUrl:v})) : inp(t.targetUrl,'text',v=>updateTask(t.id,'targetUrl',v)) },
    { label: 'Doc URL', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.docUrl||'','text',v=>setNewTask({...newTask,docUrl:v})) : inp(t.docUrl||'','text',v=>updateTask(t.id,'docUrl',v)) },
    { label: 'Web Status', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.webStatus,adminOptions.webStatuses,v=>setNewTask({...newTask,webStatus:v})) : sel(t.webStatus,adminOptions.webStatuses,v=>updateTask(t.id,'webStatus',v)) },
    { label: 'Current Owner', render: (t: Task, isNew?: boolean) => isNew ? sel(newTask.currentOwner,['SEO','Content','Web','Completed'],v=>setNewTask({...newTask,currentOwner:v,isCompleted:v==='Completed'})) : sel(t.currentOwner,['SEO','Content','Web','Completed'],v=>updateTask(t.id,'currentOwner',v)) },
    { label: 'Days in Stage', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.daysInStage,'number',v=>setNewTask({...newTask,daysInStage:v}),'min-w-[70px]') : inp(t.daysInStage,'number',v=>updateTask(t.id,'daysInStage',v),'min-w-[70px]') },
    { label: 'Remarks', render: (t: Task, isNew?: boolean) => isNew ? inp(newTask.remarks,'text',v=>setNewTask({...newTask,remarks:v}),'min-w-[200px]') : inp(t.remarks,'text',v=>updateTask(t.id,'remarks',v),'min-w-[200px]') },
  ];

  const emptyTask = createEmptyTask();

  return (
    <div className="space-y-4">
      {/* Confirmation modal */}
      {confirm && <ConfirmModal {...confirm} onCancel={() => setConfirm(null)} />}

      {/* Uploader name input panel */}
      {showUploaderInput && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-800">
            <Upload size={16} />
            {pendingCsvTasks.length} tasks ready to upload
          </div>
          <input
            type="text"
            placeholder="Your name (required)"
            value={uploaderName}
            onChange={e => setUploaderName(e.target.value)}
            className="border border-indigo-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
            onKeyDown={e => e.key === 'Enter' && confirmUpload()}
          />
          <button onClick={confirmUpload} className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            Confirm Upload
          </button>
          <button onClick={cancelUpload} className="px-4 py-1.5 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50">
            Cancel
          </button>
        </div>
      )}

      {/* Undo toast */}
      {undoSnapshot && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-4">
          <RotateCcw size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800 flex-1">{undoMessage}</span>
          <button onClick={handleUndo} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 flex items-center gap-1.5">
            <RotateCcw size={13} /> Undo (30s)
          </button>
          <button onClick={() => { setUndoSnapshot(null); setUndoMessage(''); }} className="text-amber-400 hover:text-amber-700"><X size={16} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800">Task Entry</h2>
          <p className="text-zinc-600 text-sm mt-1">Add, edit, or bulk-manage tasks. Changes reflect across all panels.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={downloadTemplate} className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-2 rounded-md text-sm font-medium border border-zinc-300 shadow-sm">
            <Download size={15} /> CSV Template
          </button>
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-2 rounded-md text-sm font-medium border border-zinc-300 shadow-sm">
            <Upload size={15} /> Upload CSV
          </button>
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-2 rounded-md text-sm font-medium border border-zinc-300 shadow-sm">
            <History size={15} /> History {uploadHistory.length > 0 && <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{uploadHistory.length}</span>}
          </button>
        </div>
      </div>

      {/* Upload History */}
      {showHistory && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-zinc-800">Upload History</h3>
            <button onClick={() => setShowHistory(false)} className="text-zinc-400 hover:text-zinc-700"><X size={16} /></button>
          </div>
          {uploadHistory.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">No uploads this session.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-zinc-500 uppercase border-b border-zinc-100">
                <th className="pb-2 text-left font-medium">Uploaded By</th>
                <th className="pb-2 text-left font-medium">Time</th>
                <th className="pb-2 text-center font-medium">Tasks</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {uploadHistory.map(rec => (
                  <tr key={rec.id} className="py-2">
                    <td className="py-2 font-medium text-zinc-800">{rec.uploadedBy}</td>
                    <td className="py-2 text-zinc-500">{rec.timestamp}</td>
                    <td className="py-2 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{rec.taskCount} tasks</span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setHighlightIds(new Set(rec.taskIds)); setShowHistory(false); setTimeout(() => setHighlightIds(new Set()), 5000); }}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                          <Eye size={12} /> View
                        </button>
                        <button onClick={() => removeBatch(rec)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                          <Trash2 size={12} /> Remove batch
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-zinc-400 mt-3">History resets on page refresh. Use "Remove batch" to undo a full upload.</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">From Date</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">To Date</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">Client</label>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="All">All Clients</option>{adminOptions.clients.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">SEO Owner</label>
          <select value={seoOwnerFilter} onChange={e => setSeoOwnerFilter(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="All">All Owners</option>{adminOptions.seoOwners.map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        {(dateFrom || dateTo || clientFilter !== 'All' || seoOwnerFilter !== 'All') && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setClientFilter('All'); setSeoOwnerFilter('All'); }} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-600 border border-zinc-200 rounded-md bg-white">Clear</button>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm text-zinc-500">
          <span>{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
          {selectedIds.size > 0 && (
            <button onClick={bulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
              <Trash2 size={14} /> Delete {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-100 border-b border-zinc-200 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-3 bg-zinc-100 sticky left-0 z-20 border-r border-zinc-200">
                  <button onClick={toggleSelectAll} className="text-zinc-500 hover:text-zinc-800 p-0.5">
                    {allFilteredSelected ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                  </button>
                </th>
                <th className="px-2 py-3 bg-zinc-100 sticky left-8 z-20 border-r border-zinc-200 font-medium">Actions</th>
                {COLS.map(c => th(c.label))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {/* Add New Row */}
              <tr className="bg-emerald-50/50 hover:bg-emerald-50">
                <td className="px-2 py-1 sticky left-0 z-10 bg-emerald-50/50 border-r border-zinc-200"></td>
                <td className="px-2 py-1 sticky left-8 z-10 bg-emerald-50/50 border-r border-zinc-200">
                  <button onClick={handleAddRow} className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium px-2 py-1 bg-white rounded shadow-sm border border-emerald-200">
                    <Plus size={16} /> Add
                  </button>
                </td>
                {COLS.map((c, i) => (
                  <td key={i} className="px-2 py-1 border-r border-zinc-200">{c.render(emptyTask, true)}</td>
                ))}
              </tr>

              {/* Existing Rows */}
              {filteredTasks.map(task => (
                <tr key={task.id} className={cn(
                  "hover:bg-blue-50/50 transition-colors",
                  selectedIds.has(task.id) ? "bg-indigo-50/60" : "",
                  highlightIds.has(task.id) ? "bg-yellow-50 ring-1 ring-yellow-300" : ""
                )}>
                  <td className={cn("px-2 py-1 sticky left-0 z-10 border-r border-zinc-200", selectedIds.has(task.id) ? "bg-indigo-50" : "bg-white")}>
                    <button onClick={() => toggleSelect(task.id)} className="text-zinc-400 hover:text-indigo-600 p-0.5">
                      {selectedIds.has(task.id) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} />}
                    </button>
                  </td>
                  <td className={cn("px-2 py-1 sticky left-8 z-10 border-r border-zinc-200", selectedIds.has(task.id) ? "bg-indigo-50" : "bg-white")}>
                    <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </td>
                  {COLS.map((c, i) => (
                    <td key={i} className="px-2 py-1 border-r border-zinc-200">{c.render(task)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
