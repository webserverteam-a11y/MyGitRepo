import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Task } from '../types';
import { cn } from '../utils';

export function QcSubmitted({ tasks }: { tasks: Task[] }) {
  const { adminOptions } = useAppContext();
  const todayStr = new Date().toISOString().split('T')[0];

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const { currentUser, isAdmin } = useAppContext();
  const [seoOwnerFilter, setSeoOwnerFilter] = useState(() => {
    if (!isAdmin && currentUser?.role === 'seo') return currentUser.ownerName;
    return 'All';
  });
  const [seoStageFilter, setSeoStageFilter] = useState('All');

  const isSeoQc = (t: Task) => ['QC', 'Submit', 'Completed', 'Pending QC'].some(s => t.seoQcStatus.includes(s));
  const isContentQc = (t: Task) => ['QC', 'Submit', 'Approved'].some(s => t.contentStatus.includes(s));
  const isWebQc = (t: Task) => ['QC', 'Submit', 'Pending QC'].some(s => t.webStatus.includes(s));

  const applyFilters = (list: Task[]) => list.filter(t => {
    if (dateFrom && t.intakeDate < dateFrom) return false;
    if (dateTo && t.intakeDate > dateTo) return false;
    if (clientFilter !== 'All' && t.client !== clientFilter) return false;
    if (seoOwnerFilter !== 'All' && t.seoOwner !== seoOwnerFilter) return false;
    if (seoStageFilter !== 'All' && t.seoStage !== seoStageFilter) return false;
    return true;
  });

  const pending = useMemo(() => tasks.filter(t => !t.isCompleted), [tasks]);
  const seoQcTasks = useMemo(() => applyFilters(pending.filter(isSeoQc)), [pending, dateFrom, dateTo, clientFilter, seoOwnerFilter, seoStageFilter]);
  const contentQcTasks = useMemo(() => applyFilters(pending.filter(isContentQc)), [pending, dateFrom, dateTo, clientFilter, seoOwnerFilter, seoStageFilter]);
  const webQcTasks = useMemo(() => applyFilters(pending.filter(isWebQc)), [pending, dateFrom, dateTo, clientFilter, seoOwnerFilter, seoStageFilter]);
  const totalQc = seoQcTasks.length + contentQcTasks.length + webQcTasks.length;

  const renderTable = (title: string, data: Task[], colorClass: string, bgClass: string, statusLabel: string, getStatus: (t: Task) => string) => (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden mb-6">
      <div className={cn("px-6 py-4 border-b border-zinc-200", bgClass)}>
        <h3 className={cn("font-semibold", colorClass)}>{title} ({data.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3">Task ID</th>
              <th className="px-6 py-3">Client</th>
              <th className="px-6 py-3">Title</th>
              <th className="px-6 py-3">SEO Owner</th>
              <th className="px-6 py-3">Stage</th>
              <th className="px-6 py-3">{statusLabel}</th>
              <th className="px-6 py-3 text-right">Days in Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500 italic">— No QC actions needed —</td></tr>
            ) : data.map(task => (
              <tr key={task.id} className="hover:bg-zinc-50">
                <td className="px-6 py-3 font-mono text-xs text-zinc-500">{task.id}</td>
                <td className="px-6 py-3 font-medium text-zinc-900">{task.client}</td>
                <td className="px-6 py-3 text-zinc-700">{task.title}</td>
                <td className="px-6 py-3 text-zinc-700">{task.seoOwner}</td>
                <td className="px-6 py-3 text-zinc-700">{task.seoStage}</td>
                <td className="px-6 py-3"><span className="text-purple-700 font-bold bg-purple-100 px-2.5 py-1 rounded-md">{getStatus(task)}</span></td>
                <td className={cn("px-6 py-3 text-right font-medium", task.daysInStage > 7 ? "text-red-600 bg-red-50" : "text-zinc-700")}>{task.daysInStage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-800 mb-4">QC Submitted</h2>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
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
        <div><label className="block text-xs font-medium text-zinc-500 mb-1">SEO Stage</label>
          <select value={seoStageFilter} onChange={e => setSeoStageFilter(e.target.value)} className="border border-zinc-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="All">All Stages</option>{adminOptions.seoStages.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {(dateFrom || dateTo || clientFilter !== 'All' || seoOwnerFilter !== 'All' || seoStageFilter !== 'All') && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setClientFilter('All'); setSeoOwnerFilter('All'); setSeoStageFilter('All'); }} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-red-600 border border-zinc-200 rounded-md bg-white self-end">Clear</button>
        )}
      </div>

      <div className="bg-amber-100 border border-amber-300 text-amber-900 px-6 py-4 rounded-xl shadow-sm mb-6 flex items-center gap-3 font-medium">
        <span>Total QC actions: {totalQc}</span>
        <span className="text-amber-300 mx-2">|</span>
        <span>SEO: {seoQcTasks.length}</span>
        <span className="text-amber-300 mx-2">|</span>
        <span>Content: {contentQcTasks.length}</span>
        <span className="text-amber-300 mx-2">|</span>
        <span>Web: {webQcTasks.length}</span>
      </div>

      {renderTable('SEO QC Needed', seoQcTasks, 'text-blue-800', 'bg-blue-50', 'SEO QC Status', t => t.seoQcStatus)}
      {renderTable('Content QC Needed', contentQcTasks, 'text-orange-800', 'bg-orange-50', 'Content Status', t => t.contentStatus)}
      {renderTable('Web QC Needed', webQcTasks, 'text-emerald-800', 'bg-emerald-50', 'Web Status', t => t.webStatus)}
    </div>
  );
}
