import React, { createContext, useContext, useState, useEffect } from 'react';
import { Task, AdminOptions, AppUser, UserRole } from '../types';
import { mockTasks } from '../data';

const NAV_ACCESS_KEY = 'seo_nav_access';

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
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const s = localStorage.getItem('seo_users');
      const loaded: AppUser[] = s ? JSON.parse(s) : defaultUsers;
      // Auto-fix: if ownerName is blank, default it to the user's display name
      return loaded.map(u => ({
        ...u,
        ownerName: u.ownerName?.trim() || (u.role !== 'admin' ? u.name.trim() : ''),
      }));
    } catch { return defaultUsers; }
  });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try { const s = localStorage.getItem('seo_current_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  // navAccess: key = "tabId:role", value = false means hidden
  const [navAccess, setNavAccess] = useState<Record<string, boolean>>(() => {
    try { const s = localStorage.getItem(NAV_ACCESS_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });

  useEffect(() => { localStorage.setItem('seo_users', JSON.stringify(users)); }, [users]);
  useEffect(() => {
    if (currentUser) localStorage.setItem('seo_current_user', JSON.stringify(currentUser));
    else localStorage.removeItem('seo_current_user');
  }, [currentUser]);
  useEffect(() => { localStorage.setItem(NAV_ACCESS_KEY, JSON.stringify(navAccess)); }, [navAccess]);

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
