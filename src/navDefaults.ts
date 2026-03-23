// Single source of truth for default panel visibility per role
// Used by both Layout.tsx and AdminPanel.tsx
export const NAV_DEFAULTS: Record<string, string[]> = {
  admin:   ['dashboard','all','today','client','task-entry','action','keyword-reporting','timesheet','workhub','admin'],
  seo:     ['dashboard','all','today','client','task-entry','action','keyword-reporting','timesheet','workhub'],
  content: ['today','action','timesheet','workhub'],
  web:     ['today','action','timesheet','workhub'],
  social:  ['workhub','timesheet'],
  design:  ['workhub','timesheet'],
  ads:     ['workhub','timesheet','dashboard'],
  webdev:  ['workhub','timesheet','today'],
};

export function isAccessEnabled(navAccess: Record<string, boolean>, tabId: string, role: string): boolean {
  if (role === 'admin') return true;
  const key = `${tabId}:${role}`;
  if (navAccess[key] === true) return true;
  if (navAccess[key] === false) return false;
  return NAV_DEFAULTS[role]?.includes(tabId) ?? false;
}
