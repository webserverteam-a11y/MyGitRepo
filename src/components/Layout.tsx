import React, { useState } from 'react';
import {
  BarChart3, Clock, ListTodo, CalendarDays,
  SearchCheck, Users, Menu, X, Database, Settings, Play,
  ChevronLeft, ChevronRight, LogOut, Key
} from 'lucide-react';
import { cn } from '../utils';
import { useAppContext } from '../context/AppContext';
import ditechLogo from '../assets/ditech-logo.jpeg';
import { NAV_DEFAULTS, isAccessEnabled } from '../navDefaults';

// DiTech brand blue
const BRAND = '#1E2D8B';
const BRAND_LIGHT = '#2A3FA0';
const BRAND_ACTIVE = '#4A90D9';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { currentUser, logout, isAdmin, navAccess } = useAppContext();

  const roleBadge: Record<string, string> = {
    admin:   'bg-red-100 text-red-700',
    seo:     'bg-blue-100 text-blue-700',
    content: 'bg-orange-100 text-orange-700',
    web:     'bg-emerald-100 text-emerald-700',
    social:  'bg-pink-100 text-pink-700',
    design:  'bg-purple-100 text-purple-700',
    ads:     'bg-amber-100 text-amber-700',
    webdev:  'bg-teal-100 text-teal-700',
  };

  const ALL_ROLES_LIST = ['admin','seo','content','web','social','design','ads','webdev'];

  const ALL_TABS = [
    { id: 'dashboard',         label: 'Dashboard',     icon: BarChart3 },
    { id: 'all',               label: 'All Tasks',     icon: ListTodo },
    { id: 'today',             label: "Today's Tasks", icon: CalendarDays },
    { id: 'client',            label: 'Client View',   icon: Users },
    { id: 'task-entry',        label: 'Task Entry',    icon: Database },
    { id: 'action',            label: 'Action Board',  icon: Play },
    { id: 'keyword-reporting', label: 'Keywords',      icon: SearchCheck },
    { id: 'timesheet',         label: 'Timesheet',     icon: Clock },
    { id: 'workhub',           label: 'Work Hub',      icon: BarChart3 },
    { id: 'admin',             label: 'Admin Panel',   icon: Settings },
  ];

  const role = currentUser?.role || 'seo';

  const isTabVisible = (tabId: string): boolean => {
    if (tabId === 'admin') return role === 'admin';
    return isAccessEnabled(navAccess, tabId, role);
  };

  const tabs = ALL_TABS.filter(t => isTabVisible(t.id));

  return (
    <div className="min-h-screen flex" style={{ background: '#F4F6FB' }}>
      {/* Sidebar */}
      <aside style={{ background: BRAND }} className={cn(
        "fixed inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out flex flex-col",
        "lg:translate-x-0 lg:static lg:flex",
        isMobileMenuOpen ? "translate-x-0 w-56" : "-translate-x-full w-56",
        isCollapsed ? "lg:w-14" : "lg:w-56"
      )}>
        {/* Logo header */}
        <div style={{ height:56, display:'flex', alignItems:'center', padding:'0 10px', borderBottom:`1px solid ${BRAND_LIGHT}`, flexShrink:0 }}>
          {!isCollapsed && (
            <div style={{ flex:1, overflow:'hidden' }}>
              <img src={ditechLogo} alt="DiTech" style={{ height:32, objectFit:'contain', objectPosition:'left', maxWidth:'100%', filter:'brightness(0) saturate(100%) invert(27%) sepia(79%) saturate(1200%) hue-rotate(196deg) brightness(95%) contrast(98%)'  }} />
            </div>
          )}
          <button onClick={() => setIsMobileMenuOpen(false)} style={{ color:'rgba(255,255,255,0.6)' }} className="lg:hidden ml-auto"><X size={18} /></button>
          <button onClick={() => setIsCollapsed(c => !c)} title={isCollapsed ? "Expand" : "Collapse"}
            style={{ width:26, height:26, borderRadius:6, color:'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', flexShrink:0, marginLeft: isCollapsed?'auto':4 }}
            className="hidden lg:flex hover:bg-white/10 transition-colors">
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 6px', overflowY:'auto', display:'flex', flexDirection:'column', gap:2 }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }}
                title={isCollapsed ? tab.label : undefined}
                style={{
                  width:'100%', display:'flex', alignItems:'center', gap:9, padding: isCollapsed ? '8px 0' : '8px 10px',
                  borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', transition:'all .15s',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: isActive ? BRAND_ACTIVE : 'transparent',
                }}>
                <Icon size={16} style={{ flexShrink:0 }} />
                {!isCollapsed && <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tab.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User at bottom */}
        {currentUser && (
          <div style={{ borderTop:`1px solid ${BRAND_LIGHT}`, padding:10, flexShrink:0 }}>
            {!isCollapsed ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:BRAND_ACTIVE, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#fff', flexShrink:0 }}>
                  {currentUser.name.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{currentUser.name}</div>
                  <span style={{ fontSize:9, fontWeight:600, padding:'1px 5px', borderRadius:99, textTransform:'uppercase', letterSpacing:'.04em' }}
                    className={roleBadge[currentUser.role]}>{currentUser.role}</span>
                </div>
                <button onClick={logout} title="Logout" style={{ color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer', padding:4 }} className="hover:text-red-400 transition-colors">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:BRAND_ACTIVE, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color:'#fff' }}>
                  {currentUser.name.slice(0,2).toUpperCase()}
                </div>
                <button onClick={logout} title="Logout" style={{ color:'rgba(255,255,255,0.4)', background:'none', border:'none', cursor:'pointer' }} className="hover:text-red-400 transition-colors">
                  <LogOut size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header style={{ height:48, background:'#fff', borderBottom:'0.5px solid #E2E8F0', display:'flex', alignItems:'center', padding:'0 20px', gap:12, flexShrink:0 }}>
          <button className="lg:hidden" onClick={() => setIsMobileMenuOpen(true)} style={{ color:'#64748B', background:'none', border:'none', cursor:'pointer' }}><Menu size={20} /></button>
          <span style={{ fontSize:15, fontWeight:500, color: BRAND, flex:1 }}>
            {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
          </span>
          {currentUser && (
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background: BRAND, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:'#fff' }}>
                {currentUser.name.slice(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:13, fontWeight:500, color: BRAND }}>{currentUser.name}</span>
              <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:99 }} className={roleBadge[currentUser.role]}>{currentUser.role}</span>
              <button onClick={logout} style={{ background:'none', border:'none', cursor:'pointer', color:'#94A3B8', padding:4 }} className="hover:text-red-400 transition-colors"><LogOut size={15} /></button>
            </div>
          )}
        </header>
        <main style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', position:'relative' }}>
          <div id="main-scroll" style={{ flex:1, overflowY:'auto', padding:20, WebkitOverflowScrolling:'touch' } as React.CSSProperties}>
          {children}
          </div>
        </main>
      </div>
    </div>
  );
}
