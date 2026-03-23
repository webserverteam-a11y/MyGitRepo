import { Task, TimeEvent } from '../types';

export interface DailyTime {
  activeMs: number;
  pauseMs: number;
  reworkMs: number;
}

export type TaskDailyTime = Record<string, DailyTime>; // date -> DailyTime
export type OwnerTaskTime = Record<string, TaskDailyTime>; // taskId -> TaskDailyTime
export type OwnerDailyTime = Record<string, OwnerTaskTime>; // owner -> OwnerTaskTime

export const calculateTimePerDay = (tasks: Task[]): OwnerDailyTime => {
  const result: OwnerDailyTime = {};

  const addTime = (owner: string, taskId: string, date: string, type: 'active' | 'pause' | 'rework', ms: number) => {
    if (!owner) return;
    if (!result[owner]) result[owner] = {};
    if (!result[owner][taskId]) result[owner][taskId] = {};
    if (!result[owner][taskId][date]) result[owner][taskId][date] = { activeMs: 0, pauseMs: 0, reworkMs: 0 };
    
    if (type === 'active') result[owner][taskId][date].activeMs += ms;
    else if (type === 'rework') result[owner][taskId][date].reworkMs += ms;
    else result[owner][taskId][date].pauseMs += ms;
  };

  const splitTimeAcrossDays = (owner: string, taskId: string, startT: number, endT: number, type: 'active' | 'pause' | 'rework') => {
    let current = new Date(startT);
    while (current.getTime() < endT) {
      const dateStr = current.toISOString().split('T')[0];
      const nextDay = new Date(current);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(0, 0, 0, 0);

      const chunkEnd = Math.min(endT, nextDay.getTime());
      const ms = chunkEnd - current.getTime();
      
      addTime(owner, taskId, dateStr, type, ms);
      
      current = new Date(chunkEnd);
    }
  };

  tasks.forEach(task => {
    if (!task.timeEvents || task.timeEvents.length === 0) return;

    let state = 'Not Started' as string;
    let lastTime = 0;
    let currentDept = '';

    const getOwner = (dept: string) => {
      if (dept === 'SEO') return task.seoOwner;
      if (dept === 'Content') return task.contentOwner;
      if (dept === 'Web') return task.webOwner;
      return '';
    };

    task.timeEvents.forEach(event => {
      const t = new Date(event.timestamp).getTime();
      const owner = getOwner(currentDept) || getOwner(event.department);

      if (state === 'Active') {
        splitTimeAcrossDays(owner, task.id, lastTime, t, 'active');
      } else if (state === 'Rework') {
        splitTimeAcrossDays(owner, task.id, lastTime, t, 'rework');
      } else if (state === 'Paused') {
        splitTimeAcrossDays(owner, task.id, lastTime, t, 'pause');
      }

      currentDept = event.department;
      lastTime = t;

      if (event.type === 'start' || event.type === 'resume') {
        state = 'Active';
      } else if (event.type === 'rework_start') {
        state = 'Rework';
      } else if (event.type === 'pause') {
        state = 'Paused';
      } else if (event.type === 'end') {
        state = 'Ended';
      }
    });

    // Handle ongoing time if not ended
    const owner = getOwner(currentDept);
    if (owner) {
      const now = new Date().getTime();
      if (task.executionState === 'In Progress' && state === 'Active') {
        splitTimeAcrossDays(owner, task.id, lastTime, now, 'active');
      } else if (task.executionState === 'Rework' && state === 'Rework') {
        splitTimeAcrossDays(owner, task.id, lastTime, now, 'rework');
      } else if (task.executionState === 'Paused' && state === 'Paused') {
        splitTimeAcrossDays(owner, task.id, lastTime, now, 'pause');
      }
    }
  });

  return result;
};
