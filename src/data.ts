import { Task } from './types';

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const todayStr = `${year}-${month}-${day}`;

const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const yYear = yesterday.getFullYear();
const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
const yDay = String(yesterday.getDate()).padStart(2, '0');
const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

const lastWeek = new Date(today);
lastWeek.setDate(lastWeek.getDate() - 8);
const lwYear = lastWeek.getFullYear();
const lwMonth = String(lastWeek.getMonth() + 1).padStart(2, '0');
const lwDay = String(lastWeek.getDate()).padStart(2, '0');
const lastWeekStr = `${lwYear}-${lwMonth}-${lwDay}`;

export const mockTasks: Task[] = [
  // Hemang Tasks
  { id: 'T-001', title: 'Blog Post Optimization', client: 'Aashish Metals', seoOwner: 'Hemang', seoStage: 'Blogs', currentOwner: 'SEO', isCompleted: false, seoQcStatus: 'Pending', contentStatus: '', webStatus: '', intakeDate: todayStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 0, estHours: 2, estHoursSEO: 2, estHoursContent: 0, estHoursWeb: 0, actualHours: 1, focusedKw: 'metal fabrication', volume: 1500, currentRank: 12, marRank: 15, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-002', title: 'On-Page Audit', client: 'Amardeep', seoOwner: 'Hemang', seoStage: 'On Page', currentOwner: 'Web', isCompleted: false, seoQcStatus: 'Completed', contentStatus: '', webStatus: 'QC Submitted', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: yesterdayStr, daysInStage: 8, estHours: 4, estHoursSEO: 4, estHoursContent: 0, estHoursWeb: 0, actualHours: 3.5, focusedKw: 'lighting fixtures', volume: 2000, currentRank: 5, marRank: 4, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-003', title: 'Monthly Report', client: 'DSE', seoOwner: 'Hemang', seoStage: 'Reports', currentOwner: 'SEO', isCompleted: true, seoQcStatus: 'Completed', contentStatus: '', webStatus: '', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 2, estHours: 1, estHoursSEO: 1, estHoursContent: 0, estHoursWeb: 0, actualHours: 1, executionState: 'Ended', timeEvents: [] },
  
  // Imran Tasks
  { id: 'T-004', title: 'Content Brief', client: 'JadeAlloys', seoOwner: 'Imran', seoStage: 'Blogs', currentOwner: 'Content', isCompleted: false, seoQcStatus: 'Pending', contentStatus: 'QC', webStatus: '', intakeDate: yesterdayStr, contentAssignedDate: todayStr, webAssignedDate: '', daysInStage: 1, estHours: 3, estHoursSEO: 3, estHoursContent: 0, estHoursWeb: 0, actualHours: 2, focusedKw: 'alloy steel pipe', volume: 800, currentRank: 22, marRank: 25, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-005', title: 'Technical Audit', client: 'KPS', seoOwner: 'Imran', seoStage: 'Tech. SEO', currentOwner: 'Web', isCompleted: false, seoQcStatus: 'Pending', contentStatus: '', webStatus: 'Pending', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: todayStr, daysInStage: 9, estHours: 5, estHoursSEO: 5, estHoursContent: 0, estHoursWeb: 0, actualHours: 6, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-006', title: 'On-Page Fixes', client: 'KPSol', seoOwner: 'Imran', seoStage: 'On Page', currentOwner: 'SEO', isCompleted: false, seoQcStatus: 'Submit', contentStatus: '', webStatus: '', intakeDate: todayStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 0, estHours: 2, estHoursSEO: 2, estHoursContent: 0, estHoursWeb: 0, actualHours: 0.5, focusedKw: 'solar panels', volume: 5000, currentRank: 8, marRank: 8, executionState: 'Not Started', timeEvents: [] },
  
  // Kamna Tasks
  { id: 'T-007', title: 'New Page Setup', client: 'Metinoxoverseas', seoOwner: 'Kamna', seoStage: 'Development', currentOwner: 'Web', isCompleted: false, seoQcStatus: 'Pending', contentStatus: '', webStatus: 'QC', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: yesterdayStr, daysInStage: 3, estHours: 6, estHoursSEO: 6, estHoursContent: 0, estHoursWeb: 0, actualHours: 4, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-008', title: 'Client Call Prep', client: 'Milife', seoOwner: 'Kamna', seoStage: 'Client Call', currentOwner: 'SEO', isCompleted: false, seoQcStatus: 'Pending', contentStatus: '', webStatus: '', intakeDate: todayStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 0, estHours: 1, estHoursSEO: 1, estHoursContent: 0, estHoursWeb: 0, actualHours: 0, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-009', title: 'Blog Writing', client: 'Navyug', seoOwner: 'Kamna', seoStage: 'Blogs', currentOwner: 'Content', isCompleted: false, seoQcStatus: 'Pending', contentStatus: 'Submit', webStatus: '', intakeDate: lastWeekStr, contentAssignedDate: lastWeekStr, webAssignedDate: '', daysInStage: 8, estHours: 4, estHoursSEO: 4, estHoursContent: 0, estHoursWeb: 0, actualHours: 5, focusedKw: 'industrial valves', volume: 1200, currentRank: 15, marRank: 18, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-010', title: 'On-Page Update', client: 'Petverse', seoOwner: 'Kamna', seoStage: 'On Page', currentOwner: 'SEO', isCompleted: true, seoQcStatus: 'Completed', contentStatus: '', webStatus: '', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 1, estHours: 2, estHoursSEO: 2, estHoursContent: 0, estHoursWeb: 0, actualHours: 2, focusedKw: 'dog food', volume: 10000, currentRank: 3, marRank: 5, executionState: 'Ended', timeEvents: [] },
  
  // Manish Tasks
  { id: 'T-011', title: 'Whatsapp Update', client: 'SPAT', seoOwner: 'Manish', seoStage: 'Whatsapp Message', currentOwner: 'Web', isCompleted: false, seoQcStatus: 'Pending', contentStatus: '', webStatus: 'Pending', intakeDate: yesterdayStr, contentAssignedDate: '', webAssignedDate: yesterdayStr, daysInStage: 2, estHours: 0.5, estHoursSEO: 0.5, estHoursContent: 0, estHoursWeb: 0, actualHours: 0.2, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-012', title: 'Report Generation', client: 'Solitaire', seoOwner: 'Manish', seoStage: 'Reports', currentOwner: 'SEO', isCompleted: true, seoQcStatus: 'Completed', contentStatus: '', webStatus: '', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 1, estHours: 1, estHoursSEO: 1, estHoursContent: 0, estHoursWeb: 0, actualHours: 1, executionState: 'Ended', timeEvents: [] },
  
  // Additional tasks to pad out the dashboard
  { id: 'T-013', title: 'On-Page Audit', client: 'USA piping', seoOwner: 'Kamna', seoStage: 'On Page', currentOwner: 'Web', isCompleted: false, seoQcStatus: 'Completed', contentStatus: '', webStatus: 'QC Submitted', intakeDate: lastWeekStr, contentAssignedDate: '', webAssignedDate: yesterdayStr, daysInStage: 4, estHours: 3, estHoursSEO: 3, estHoursContent: 0, estHoursWeb: 0, actualHours: 3, focusedKw: 'piping solutions', volume: 3000, currentRank: 10, marRank: 12, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-014', title: 'Blog Post Optimization', client: 'Unifit', seoOwner: 'Imran', seoStage: 'Blogs', currentOwner: 'Content', isCompleted: false, seoQcStatus: 'Pending', contentStatus: 'Approved', webStatus: '', intakeDate: yesterdayStr, contentAssignedDate: todayStr, webAssignedDate: '', daysInStage: 1, estHours: 2, estHoursSEO: 2, estHoursContent: 0, estHoursWeb: 0, actualHours: 1.5, focusedKw: 'fitness gear', volume: 4500, currentRank: 6, marRank: 6, executionState: 'Not Started', timeEvents: [] },
  { id: 'T-015', title: 'On-Page Fixes', client: 'Aashish Metals', seoOwner: 'Hemang', seoStage: 'On Page', currentOwner: 'SEO', isCompleted: false, seoQcStatus: 'QC', contentStatus: '', webStatus: '', intakeDate: todayStr, contentAssignedDate: '', webAssignedDate: '', daysInStage: 0, estHours: 2, estHoursSEO: 2, estHoursContent: 0, estHoursWeb: 0, actualHours: 1, focusedKw: 'metal sheets', volume: 800, currentRank: 15, marRank: 14, executionState: 'Not Started', timeEvents: [] },
];
