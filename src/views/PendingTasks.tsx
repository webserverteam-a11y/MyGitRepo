import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { cn, formatDate } from '../utils';
import { useAppContext } from '../context/AppContext';
import { Filter } from 'lucide-react';

interface PendingTasksProps {
  tasks: Task[];
}

export function PendingTasks({ tasks }: PendingTasksProps) {
  const { adminOptions } = useAppContext();
  
  const [seoOwnerFilter, setSeoOwnerFilter] = useState('All');
  const [clientFilter, setClientFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.isCompleted) return false;
      if (seoOwnerFilter !== 'All' && t.seoOwner !== seoOwnerFilter) return false;
      if (clientFilter !== 'All' && t.client !== clientFilter) return false;
      if (statusFilter !== 'All' && t.executionState !== statusFilter) return false;
      if (startDate && t.intakeDate < startDate) return false;
      if (endDate && t.intakeDate > endDate) return false;
      return true;
    });
  }, [tasks, seoOwnerFilter, clientFilter, startDate, endDate, statusFilter]);

  const seoTasks = filteredTasks.filter(t => t.currentOwner === 'SEO');
  const contentTasks = filteredTasks.filter(t => t.currentOwner === 'Content');
  const webTasks = filteredTasks.filter(t => t.currentOwner === 'Web');

  const renderTaskTable = (title: string, data: Task[], colorClass: string, bgClass: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden mb-8">
      <div className={cn("px-6 py-4 border-b border-zinc-200", bgClass)}>
        <h3 className={cn("font-semibold", colorClass)}>{title} ({data.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3 font-medium">Task ID</th>
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">SEO Owner</th>
              <th className="px-6 py-3 font-medium">Stage</th>
              <th className="px-6 py-3 font-medium">Intake Date</th>
              <th className="px-6 py-3 font-medium text-right">Days in Stage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-zinc-500 italic">
                  — No pending tasks —
                </td>
              </tr>
            ) : (
              data.map((task) => (
                <tr key={task.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-3 font-mono text-xs text-zinc-500">{task.id}</td>
                  <td className="px-6 py-3 font-medium text-zinc-900">{task.client}</td>
                  <td className="px-6 py-3 text-zinc-700">{task.title}</td>
                  <td className="px-6 py-3 text-zinc-700">{task.seoOwner}</td>
                  <td className="px-6 py-3 text-zinc-700">{task.seoStage}</td>
                  <td className="px-6 py-3 text-zinc-700">{formatDate(task.intakeDate)}</td>
                  <td className={cn(
                    "px-6 py-3 text-right font-medium",
                    task.daysInStage > 7 ? "text-red-600 bg-red-50" : "text-zinc-700"
                  )}>
                    {task.daysInStage}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-zinc-800">⏳ Pending Tasks</h2>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-zinc-200 flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2 text-zinc-500 mb-1">
          <Filter size={20} />
          <span className="font-medium">Filters:</span>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">SEO Owner</label>
          <select
            value={seoOwnerFilter}
            onChange={(e) => setSeoOwnerFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-w-[150px]"
          >
            <option value="All">All Owners</option>
            {adminOptions.seoOwners.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Client</label>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-w-[150px]"
          >
            <option value="All">All Clients</option>
            {adminOptions.clients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm min-w-[150px]"
          >
            <option value="All">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Paused">Paused</option>
            <option value="Rework">Rework</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Date From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase tracking-wider">Date To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
          />
        </div>
        
        {(seoOwnerFilter !== 'All' || clientFilter !== 'All' || statusFilter !== 'All' || startDate || endDate) && (
          <button
            onClick={() => {
              setSeoOwnerFilter('All');
              setClientFilter('All');
              setStatusFilter('All');
              setStartDate('');
              setEndDate('');
            }}
            className="px-4 py-2 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div>
        {renderTaskTable('🔵 WITH SEO', seoTasks, 'text-blue-800', 'bg-blue-50')}
        {renderTaskTable('🟠 WITH CONTENT', contentTasks, 'text-orange-800', 'bg-orange-50')}
        {renderTaskTable('🟢 WITH WEB', webTasks, 'text-emerald-800', 'bg-emerald-50')}
      </div>
    </div>
  );
}
