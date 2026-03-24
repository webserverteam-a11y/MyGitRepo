import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Task, AdminOptions, AppUser, UserRole } from '../types';
import { mockTasks } from '../data';

const defaultAdminOptions: AdminOptions = {
  clients: ['Aashish Metals', 'Amardeep', 'DSE', 'JadeAlloys', 'KPS', 'KPSol', 'Metinoxoverseas', 'Milife', 'Navyug', 'Petverse', 'SPAT', 'Solitaire', 'USA piping', 'Unifit'],
  seoOwners: ['Hemang', 'Imran', 'Kamna', 'Manish'],
  contentOwners: ['Aman', 'Heena'],
  webOwners: ['Gauri', 'Shubham'],
  seoStages: ['Blogs', 'Client Call', 'Development', 'On Page', 'Reports', 'Tech. SEO', 'Whatsapp Message'],
  seoQcStatuses: ['Pending', 'QC', 'Submit', 'Completed'],
  contentStatuses: ['Pending', 'QC', 'Submit', 'Approved'],
  webStatuses: ['Pending', 'QC', 'QC Submitted', 'Completed'],
  socialOwners: [],
  designOwners: [],
  adsOwners: [],
  webdevOwners: [],
  socialTaskTypes: ['Reel', 'Post', 'Story', 'Carousel', 'Campaign', 'Profile Update', 'Content Calendar'],
  designTaskTypes: ['Banner', 'Infographic', 'Logo', 'Branding', 'UI Design', 'Social Graphic', 'Presentation'],
  adsTaskTypes: ['Google Ads', 'Meta Ads', 'LinkedIn Ads', 'Ad Copy', 'Campaign Setup', 'Monthly Report', 'Budget Review'],
  webDevTaskTypes: ['Page Build', 'Page Edit', 'Speed Fix', 'Schema Markup', 'CMS Update', 'Tech Fix', '301 Redirect', 'Plugin Update'],
  platforms: ['Meta', 'Instagram', 'Google', 'LinkedIn', 'YouTube', 'Canva', 'Figma', 'WordPress', 'Shopify', 'Webflow']
};

const defaultUsers: AppUser[] = [
  { id: 'admin', name: 'Admin', password: 'admin123', role: 'admin', ownerName: '' },
  { id: 'hemang', name: 'Hemang', password: 'hemang123', role: 'seo', ownerName: 'Hemang' },
  { id: 'imran', name: 'Imran', password: 'imran123', role: 'seo', ownerName: 'Imran' },
  { id: 'kamna', name: 'Kamna', password: 'kamna123', role: 'seo', ownerName: 'Kamna' },
  { id: 'manish', name: 'Manish', password: 'manish123', role: 'seo', ownerName: 'Manish' },
  { id: 'aman', name: 'Aman', password: 'aman123', role: 'content', ownerName: 'Aman' },
  { id: 'heena', name: 'Heena', password: 'heena123', role: 'content', ownerName: 'Heena' },
  { id: 'gauri', name: 'Gauri', password: 'gauri123', role: 'web', ownerName: 'Gauri' },
  { id: 'shubham', name: 'Shubham', password: 'shubham123', role: 'web', ownerName: 'Shubham' },
];

// ── API helpers ───────────────────────────────────────
function saveTasksToApi(tasks: Task[]) {
  fetch('/api/tasks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tasks),
  }).catch(err => console.error('Failed to save tasks:', err));
}

function saveConfigToApi(key: string, value: unknown) {
  fetch(`/api/config/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  }).catch(err => console.error(`Failed to save ${key}:`, err));
}

interface AppContextType {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  adminOptions: AdminOptions;
  setAdminOptions: React.Dispatch<React.SetStateAction<AdminOptions>>;
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
  currentUser: AppUser | null;
  login: (name: string, password: string) => boolean;
  logout: () => void;
  isAdmin: boolean;
  navAccess: Record<string, boolean>;
  setNavAccess: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try { const s = localStorage.getItem('seo_tasks'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length) return p; } } catch {}
    return mockTasks;
  });
  const [adminOptions, setAdminOptions] = useState<AdminOptions>(() => {
    try { const s = localStorage.getItem('seo_admin_options'); if (s) { const p = JSON.parse(s); return { ...defaultAdminOptions, ...p }; } } catch {}
    return defaultAdminOptions;
  });
  const [users, setUsers] = useState<AppUser[]>(defaultUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try { const s = localStorage.getItem('seo_current_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [navAccess, setNavAccess] = useState<Record<string, boolean>>({});

  // Track whether initial API load is done to avoid saving defaults back
  const apiLoaded = useRef(false);

  // Refs for latest state (needed by beforeunload handler)
  const tasksRef = useRef(tasks);
  const adminOptionsRef = useRef(adminOptions);
  const usersRef = useRef(users);
  const navAccessRef = useRef(navAccess);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { adminOptionsRef.current = adminOptions; }, [adminOptions]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { navAccessRef.current = navAccess; }, [navAccess]);

  // ── Fetch helper (reused by mount + refetch) ────────
  const fetchFromApi = useCallback(async () => {
    const [apiTasks, apiOptions, apiUsers, apiNav] = await Promise.all([
      fetch('/api/tasks', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/config/admin_options', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/config/users', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/config/nav_access', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]);
    return { apiTasks, apiOptions, apiUsers, apiNav };
  }, []);

  // ── Load from API on mount ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { apiTasks, apiOptions, apiUsers, apiNav } = await fetchFromApi();

        // Tasks: use API data if exists, else seed DB with defaults
        if (apiTasks && apiTasks.length > 0) {
          setTasks(apiTasks);
        } else {
          saveTasksToApi(mockTasks);
        }

        // Admin options
        if (apiOptions) {
          setAdminOptions(apiOptions);
        } else {
          saveConfigToApi('admin_options', defaultAdminOptions);
        }

        // Users
        if (apiUsers && apiUsers.length > 0) {
          setUsers(apiUsers);
        } else {
          saveConfigToApi('users', defaultUsers);
        }

        // Nav access
        if (apiNav) {
          setNavAccess(apiNav);
        } else {
          saveConfigToApi('nav_access', {});
        }
      } catch (err) {
        console.warn('API load failed, using defaults:', err);
      } finally {
        apiLoaded.current = true;
      }
    })();
  }, []);

  // ── Persist to API on changes (debounced, skip initial load) ──
  const taskTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(taskTimer.current);
    taskTimer.current = setTimeout(() => { saveTasksToApi(tasks); try { localStorage.setItem('seo_tasks', JSON.stringify(tasks)); } catch {} taskTimer.current = undefined; }, 150);
    return () => clearTimeout(taskTimer.current);
  }, [tasks]);

  const optionsTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(optionsTimer.current);
    optionsTimer.current = setTimeout(() => { saveConfigToApi('admin_options', adminOptions); try { localStorage.setItem('seo_admin_options', JSON.stringify(adminOptions)); } catch {} optionsTimer.current = undefined; }, 150);
    return () => clearTimeout(optionsTimer.current);
  }, [adminOptions]);

  const usersTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(usersTimer.current);
    usersTimer.current = setTimeout(() => { saveConfigToApi('users', users); usersTimer.current = undefined; }, 150);
    return () => clearTimeout(usersTimer.current);
  }, [users]);

  const navTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => { saveConfigToApi('nav_access', navAccess); navTimer.current = undefined; }, 150);
    return () => clearTimeout(navTimer.current);
  }, [navAccess]);

  // ── Flush pending saves (for beforeunload / visibility) ──
  const flushPendingSaves = useCallback(() => {
    if (taskTimer.current) {
      clearTimeout(taskTimer.current); taskTimer.current = undefined;
      fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tasksRef.current), keepalive: true }).catch(() => {});
    }
    if (optionsTimer.current) {
      clearTimeout(optionsTimer.current); optionsTimer.current = undefined;
      fetch('/api/config/admin_options', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adminOptionsRef.current), keepalive: true }).catch(() => {});
    }
    if (usersTimer.current) {
      clearTimeout(usersTimer.current); usersTimer.current = undefined;
      fetch('/api/config/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(usersRef.current), keepalive: true }).catch(() => {});
    }
    if (navTimer.current) {
      clearTimeout(navTimer.current); navTimer.current = undefined;
      fetch('/api/config/nav_access', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(navAccessRef.current), keepalive: true }).catch(() => {});
    }
  }, []);

  // ── Flush on page unload (prevents data loss on refresh) ──
  useEffect(() => {
    window.addEventListener('beforeunload', flushPendingSaves);
    return () => window.removeEventListener('beforeunload', flushPendingSaves);
  }, [flushPendingSaves]);

  // ── Re-fetch from API when tab becomes visible again ──
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible' || !apiLoaded.current) return;
      flushPendingSaves();
      await new Promise(r => setTimeout(r, 200)); // let flush land
      try {
        const { apiTasks, apiOptions, apiUsers, apiNav } = await fetchFromApi();
        if (apiTasks?.length) setTasks(apiTasks);
        if (apiOptions) setAdminOptions(apiOptions);
        if (apiUsers?.length) setUsers(apiUsers);
        if (apiNav) setNavAccess(apiNav);
      } catch {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [flushPendingSaves, fetchFromApi]);

  // Keep currentUser in localStorage (session-only, not DB)
  useEffect(() => {
    if (currentUser) localStorage.setItem('seo_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('seo_current_user');
  }, [currentUser]);

  const login = (name: string, password: string): boolean => {
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    if (user) { setCurrentUser(user); return true; }
    return false;
  };
  const logout = () => setCurrentUser(null);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <AppContext.Provider value={{ tasks, setTasks, adminOptions, setAdminOptions, users, setUsers, currentUser, login, logout, isAdmin, navAccess, setNavAccess }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
