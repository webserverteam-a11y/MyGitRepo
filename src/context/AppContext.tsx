import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [adminOptions, setAdminOptions] = useState<AdminOptions>(defaultAdminOptions);
  const [users, setUsers] = useState<AppUser[]>(defaultUsers);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try { const s = localStorage.getItem('seo_current_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [navAccess, setNavAccess] = useState<Record<string, boolean>>({});

  // Track whether initial API load is done to avoid saving defaults back
  const apiLoaded = useRef(false);

  // ── Load from API on mount ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [apiTasks, apiOptions, apiUsers, apiNav] = await Promise.all([
          fetch('/api/tasks').then(r => r.json()),
          fetch('/api/config/admin_options').then(r => r.json()),
          fetch('/api/config/users').then(r => r.json()),
          fetch('/api/config/nav_access').then(r => r.json()),
        ]);

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
    taskTimer.current = setTimeout(() => saveTasksToApi(tasks), 400);
    return () => clearTimeout(taskTimer.current);
  }, [tasks]);

  const optionsTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(optionsTimer.current);
    optionsTimer.current = setTimeout(() => saveConfigToApi('admin_options', adminOptions), 400);
    return () => clearTimeout(optionsTimer.current);
  }, [adminOptions]);

  const usersTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(usersTimer.current);
    usersTimer.current = setTimeout(() => saveConfigToApi('users', users), 400);
    return () => clearTimeout(usersTimer.current);
  }, [users]);

  const navTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!apiLoaded.current) return;
    clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => saveConfigToApi('nav_access', navAccess), 400);
    return () => clearTimeout(navTimer.current);
  }, [navAccess]);

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
