export type ExecutionState = 'Not Started' | 'In Progress' | 'Paused' | 'Rework' | 'Ended' | 'Client Approval' | 'Approved';

export type UserRole = 'admin' | 'seo' | 'content' | 'web' | 'social' | 'design' | 'ads' | 'webdev';
export type DeptType = 'SEO' | 'Social Media' | 'Design' | 'Ads' | 'Web Dev';

export interface AppUser {
  id: string;
  name: string;
  password: string;
  role: UserRole;
  ownerName: string; // maps to seoOwner / contentOwner / webOwner field
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface ReworkEntry {
  id: string;
  date: string;
  estHours: number;
  assignedDept: 'Content' | 'Web';
  assignedOwner: string;
  withinEstimate: boolean;
  hoursAlreadySpent: number;
  startTimestamp: string;
  endTimestamp?: string;
  durationMs?: number;
}

export interface TimeEvent {
  type: 'start' | 'pause' | 'resume' | 'rework_start' | 'end';
  timestamp: string;
  department: string;
  owner?: string;
}

export interface AdminOptions {
  clients: string[];
  seoOwners: string[];
  contentOwners: string[];
  webOwners: string[];
  seoStages: string[];
  seoQcStatuses: string[];
  contentStatuses: string[];
  webStatuses: string[];
  socialOwners: string[];
  designOwners: string[];
  adsOwners: string[];
  webdevOwners: string[];
  socialTaskTypes: string[];
  designTaskTypes: string[];
  adsTaskTypes: string[];
  webDevTaskTypes: string[];
  platforms: string[];
}

export interface Task {
  id: string;
  title: string;
  client: string;
  seoOwner: string;
  seoStage: string;
  currentOwner: string;
  isCompleted: boolean;
  seoQcStatus: string;
  contentStatus: string;
  webStatus: string;
  intakeDate: string; // YYYY-MM-DD
  contentAssignedDate: string; // YYYY-MM-DD
  webAssignedDate: string; // YYYY-MM-DD
  daysInStage: number;
  estHours: number;       // SEO est hours (legacy / default)
  estHoursSEO: number;
  estHoursContent: number;
  estHoursWeb: number;
  actualHours: number;
  focusedKw?: string;
  volume?: number;
  currentRank?: number;
  marRank?: number;
  contentOwner?: string;
  webOwner?: string;
  targetUrl?: string;
  remarks?: string;
  executionState?: ExecutionState;
  timeEvents?: TimeEvent[];
  reworkEntries?: ReworkEntry[];
  docUrl?: string;
  comments?: Comment[];
  // Multi-dept fields
  deptType?: DeptType;
  taskType?: string;
  platform?: string;
  deliverableUrl?: string;
  adBudget?: number;
  dueDate?: string;
  assignedTo?: string;
}
