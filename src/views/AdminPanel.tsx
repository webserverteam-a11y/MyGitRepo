import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { AdminOptions, AppUser, UserRole } from '../types';
import { Plus, X, Eye, EyeOff, Pencil, Check } from 'lucide-react';
import { NAV_DEFAULTS, isAccessEnabled } from '../navDefaults';

const BRAND = '#1E2D8B';

const ALL_PANELS = [
  { id: 'dashboard',         label: 'Dashboard' },
  { id: 'all',               label: 'All Tasks' },
  { id: 'today',             label: "Today's Tasks" },
  { id: 'client',            label: 'Client View' },
  { id: 'task-entry',        label: 'Task Entry' },
  { id: 'action',            label: 'Action Board' },
  { id: 'keyword-reporting', label: 'Keywords' },
  { id: 'timesheet',         label: 'Timesheet' },
  { id: 'workhub',           label: 'Work Hub' },
];



const ALL_ROLES: { value: UserRole; label: string; color: string; bg: string; group: string }[] = [
  { value:'admin',   label:'Admin',        color:'#791F1F', bg:'#FCEBEB',  group:'Core' },
  { value:'seo',     label:'SEO',          color:'#0C447C', bg:'#E6F1FB',  group:'Core' },
  { value:'content', label:'Content',      color:'#633806', bg:'#FAEEDA',  group:'Core' },
  { value:'web',     label:'Web',          color:'#085041', bg:'#E1F5EE',  group:'Core' },
  { value:'social',  label:'Social Media', color:'#9D174D', bg:'#FDF2F8',  group:'Work Hub' },
  { value:'design',  label:'Design',       color:'#6D28D9', bg:'#F5F3FF',  group:'Work Hub' },
  { value:'ads',     label:'Ads',          color:'#92400E', bg:'#FFFBEB',  group:'Work Hub' },
  { value:'webdev',  label:'Web Dev',      color:'#064E3B', bg:'#ECFDF5',  group:'Work Hub' },
];

const roleColor = (r: UserRole) => ALL_ROLES.find(x=>x.value===r) || { color:'#444', bg:'#F1F5F9' };

// Owner name pools per role — used for linked member dropdown
const ownerPoolForRole = (role: UserRole, adminOptions: AdminOptions, users?: AppUser[]): string[] => {
  // Always include names already linked to users (dynamic)
  const fromUsers = (users||[]).filter(u => u.role !== 'admin' && u.ownerName?.trim()).map(u => u.ownerName.trim());
  if (role === 'seo') return Array.from(new Set([...adminOptions.seoOwners, ...fromUsers])).filter(Boolean);
  if (role === 'content') return Array.from(new Set([...adminOptions.contentOwners, ...fromUsers])).filter(Boolean);
  if (role === 'web') return Array.from(new Set([...adminOptions.webOwners, ...fromUsers])).filter(Boolean);
  // Work Hub roles — show all known owner names
  return Array.from(new Set([...adminOptions.seoOwners, ...adminOptions.contentOwners, ...adminOptions.webOwners, ...fromUsers])).filter(Boolean);
};

type Section = 'users' | 'lists' | 'nav' | 'statuses';

export function AdminPanel() {
  const { adminOptions, setAdminOptions, users, setUsers, navAccess, setNavAccess } = useAppContext();
  const [section, setSection] = useState<Section>('users');

  // ── List management ──
  const [newItems, setNewItems] = useState<Record<keyof AdminOptions, string>>({
    clients:'', seoOwners:'', contentOwners:'', webOwners:'',
    seoStages:'', seoQcStatuses:'', contentStatuses:'', webStatuses:'',
    socialTaskTypes:'', designTaskTypes:'', adsTaskTypes:'', webDevTaskTypes:'', platforms:'',
  } as any);
  const addItem = (key: keyof AdminOptions) => {
    const val = (newItems as any)[key]?.trim();
    if (!val || (adminOptions[key] as string[]).includes(val)) return;
    setAdminOptions(p => ({ ...p, [key]: [...(p[key] as string[]), val] }));
    setNewItems(p => ({ ...p, [key]: '' }));
  };
  const removeItem = (key: keyof AdminOptions, val: string) => {
    setAdminOptions(p => ({ ...p, [key]: (p[key] as string[]).filter(v => v !== val) }));
  };

  // ── Users ──
  const [userForm, setUserForm] = useState({ name:'', password:'', role:'seo' as UserRole, ownerName:'' });
  const [showPass, setShowPass] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<AppUser & { newOwnerName?: string }>>({});
  const [showLinkedEdit, setShowLinkedEdit] = useState<string | null>(null);

  const startEdit = (u: AppUser) => {
    setEditingUser(u.id);
    setEditBuf({ name:u.name, role:u.role, ownerName:u.ownerName, password:u.password, newOwnerName:'' });
  };
  const saveEdit = (u: AppUser) => {
    const newOwner = editBuf.newOwnerName?.trim();
    let ownerName = editBuf.ownerName || u.ownerName;
    // If adding a new linked name not in list, add it to the correct owner list
    if (newOwner) {
      const role = (editBuf.role || u.role) as UserRole;
      ownerName = newOwner;
      if (role === 'seo' && !adminOptions.seoOwners.includes(newOwner))
        setAdminOptions(p => ({ ...p, seoOwners:[...p.seoOwners, newOwner] }));
      else if (role === 'content' && !adminOptions.contentOwners.includes(newOwner))
        setAdminOptions(p => ({ ...p, contentOwners:[...p.contentOwners, newOwner] }));
      else if (role === 'web' && !adminOptions.webOwners.includes(newOwner))
        setAdminOptions(p => ({ ...p, webOwners:[...p.webOwners, newOwner] }));
    }
    setUsers(p => p.map(uu => uu.id===u.id ? { ...uu, ...editBuf, ownerName } : uu));
    setEditingUser(null); setEditBuf({});
  };

  // Nav access — use shared isAccessEnabled so Layout and AdminPanel always agree
  const isNavEnabled = (tabId: string, role: string): boolean =>
    isAccessEnabled(navAccess, tabId, role);

  const toggleNav = (tabId: string, role: string) => {
    const key = `${tabId}:${role}`;
    // Compute current value inside updater using p (latest state) — avoids stale closure
    setNavAccess(p => {
      const current = isAccessEnabled(p, tabId, role);
      return { ...p, [key]: !current };
    });
  };

  const SECTIONS: { id:Section; label:string }[] = [
    { id:'users', label:'Users' }, { id:'nav', label:'Panel Access' },
    { id:'lists', label:'Lists' }, { id:'statuses', label:'Statuses' },
  ];

  const coreRoles = ALL_ROLES.filter(r=>r.group==='Core');
  const hubRoles = ALL_ROLES.filter(r=>r.group==='Work Hub');
  const navRoles = ALL_ROLES.filter(r=>r.value!=='admin');

  const ListCard = ({ title, optKey }: { title:string; optKey:keyof AdminOptions }) => (
    <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:12, marginBottom:10 }}>
      <p style={{ fontSize:11, fontWeight:500, color:'var(--color-text-primary)', marginBottom:8 }}>{title}</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
        {((adminOptions as any)[optKey] as string[]||[]).map((v:string) => (
          <span key={v} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:99, fontSize:11, background:'var(--color-background-secondary)', border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)' }}>
            {v}
            <button onClick={()=>removeItem(optKey,v)} style={{ color:'#E24B4A', background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}><X size={10}/></button>
          </span>
        ))}
      </div>
      <div style={{ display:'flex', gap:6 }}>
        <input type="text" value={(newItems as any)[optKey]||''} onChange={e=>setNewItems(p=>({...p,[optKey]:e.target.value}))}
          onKeyDown={e=>e.key==='Enter'&&addItem(optKey)} placeholder={`Add ${title.toLowerCase()}...`}
          style={{ flex:1, fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'5px 8px', background:'var(--color-background-primary)', color:'var(--color-text-primary)' }} />
        <button onClick={()=>addItem(optKey)} style={{ padding:'5px 12px', borderRadius:6, fontSize:11, fontWeight:500, border:`0.5px solid ${BRAND}40`, color:BRAND, background:`${BRAND}10`, cursor:'pointer' }}>Add</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 style={{ fontSize:18, fontWeight:500, color:BRAND }}>Admin Panel</h2>

      {/* Section tabs */}
      <div style={{ display:'flex', gap:4, background:'var(--color-background-secondary)', padding:4, borderRadius:10, width:'fit-content' }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={()=>setSection(s.id)}
            style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', transition:'all .15s', color:section===s.id?BRAND:'var(--color-text-secondary)', background:section===s.id?'var(--color-background-primary)':'transparent' }}>{s.label}</button>
        ))}
      </div>

      {/* ── USERS ── */}
      {section==='users' && (
        <div className="space-y-4">

          {/* Role legend */}
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 14px' }}>
            <p style={{ fontSize:9, fontWeight:600, color:'var(--color-text-tertiary)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>Available roles</p>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
              <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontWeight:500, marginRight:4 }}>Core:</span>
              {coreRoles.map(r => <span key={r.value} style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, color:r.color, background:r.bg }}>{r.label}</span>)}
            </div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontWeight:500, marginRight:4 }}>Work Hub:</span>
              {hubRoles.map(r => <span key={r.value} style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, color:r.color, background:r.bg }}>{r.label}</span>)}
            </div>
          </div>

          {/* Add user */}
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:14 }}>
            <p style={{ fontSize:12, fontWeight:500, color:'var(--color-text-primary)', marginBottom:12 }}>Add user</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:8, marginBottom:10 }}>
              {[['Name','name','text'],['Password','password','password']].map(([label,field,type]) => (
                <div key={field}>
                  <label style={{ fontSize:9, color:'var(--color-text-tertiary)', display:'block', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>{label}</label>
                  <input type={type} value={(userForm as any)[field]} onChange={e=>setUserForm(f=>({...f,[field]:e.target.value}))}
                    style={{ width:'100%', fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'6px 8px', background:'var(--color-background-primary)', color:'var(--color-text-primary)' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:9, color:'var(--color-text-tertiary)', display:'block', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>Role</label>
                <select value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value as UserRole,ownerName:''}))}
                  style={{ width:'100%', fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'6px 8px' }}>
                  <optgroup label="Core">
                    {coreRoles.filter(r=>r.value!=='admin').map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </optgroup>
                  <optgroup label="Work Hub">
                    {hubRoles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </optgroup>
                  <optgroup label="Admin">
                    <option value="admin">Admin</option>
                  </optgroup>
                </select>
              </div>
              {userForm.role !== 'admin' && (
                <div>
                  <label style={{ fontSize:9, color:'var(--color-text-tertiary)', display:'block', fontWeight:500, textTransform:'uppercase', marginBottom:3 }}>Linked Member Name <span style={{ textTransform:'none', fontWeight:400, opacity:.7 }}>(defaults to name if blank)</span></label>
                  <div style={{ display:'flex', gap:4 }}>
                    <select value={userForm.ownerName} onChange={e=>setUserForm(f=>({...f,ownerName:e.target.value}))}
                      style={{ flex:1, fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'6px 8px' }}>
                      <option value="">Select or type...</option>
                      {ownerPoolForRole(userForm.role, adminOptions, users).map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <input type="text" value={userForm.ownerName} onChange={e=>setUserForm(f=>({...f,ownerName:e.target.value}))}
                    placeholder="Or type new name..." style={{ width:'100%', fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'4px 7px', marginTop:4, background:'var(--color-background-primary)', color:'var(--color-text-primary)' }}/>
                </div>
              )}
            </div>
            <button onClick={()=>{
              if (!userForm.name.trim()||!userForm.password.trim()) return;
              if (!userForm.name.trim() || !userForm.password.trim()) return;
              // Default ownerName to the user's display name if not separately specified
              const ownerName = userForm.role === 'admin' ? '' : (userForm.ownerName.trim() || userForm.name.trim());
              setUsers(p => [...p, {
                id: `user-${Date.now()}`,
                name: userForm.name.trim(),
                password: userForm.password.trim(),
                role: userForm.role,
                ownerName,
              }]);
              setUserForm({ name:'', password:'', role:'seo', ownerName:'' });
            }} style={{ padding:'6px 14px', borderRadius:7, fontSize:11, fontWeight:500, border:`0.5px solid ${BRAND}40`, color:BRAND, background:`${BRAND}10`, cursor:'pointer' }}>Add User</button>
          </div>

          {/* User table */}
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['Name','Role','Linked Member','Password','Actions'].map(h=>(
                    <th key={h} style={{ fontSize:9, fontWeight:500, textTransform:'uppercase', letterSpacing:'.04em', padding:'7px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'left', background:'var(--color-background-secondary)', color:'var(--color-text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const rc = roleColor(u.role);
                  const isEditing = editingUser===u.id;
                  const ownerPool = ownerPoolForRole((editBuf.role||u.role) as UserRole, adminOptions, users);
                  return (
                    <tr key={u.id} className="hover:brightness-95">
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:12, fontWeight:500, color:'var(--color-text-primary)' }}>
                        {isEditing ? <input value={editBuf.name||''} onChange={e=>setEditBuf(b=>({...b,name:e.target.value}))} style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'3px 6px', width:100 }}/> : u.name}
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        {isEditing ? (
                          <select value={editBuf.role||u.role} onChange={e=>setEditBuf(b=>({...b,role:e.target.value as UserRole}))}
                            style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'3px 6px' }}>
                            <optgroup label="Core">
                              {coreRoles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                            </optgroup>
                            <optgroup label="Work Hub">
                              {hubRoles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                            </optgroup>
                          </select>
                        ) : <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:99, color:rc.color, background:rc.bg }}>{ALL_ROLES.find(r=>r.value===u.role)?.label||u.role}</span>}
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:11 }}>
                        {isEditing ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            <select value={editBuf.ownerName||''} onChange={e=>setEditBuf(b=>({...b,ownerName:e.target.value,newOwnerName:''}))}
                              style={{ fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'3px 6px', width:'100%' }}>
                              <option value="">Select existing...</option>
                              {ownerPool.map(o=><option key={o}>{o}</option>)}
                            </select>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span style={{ fontSize:9, color:'var(--color-text-tertiary)', whiteSpace:'nowrap' }}>Or add new:</span>
                              <input type="text" value={editBuf.newOwnerName||''} onChange={e=>setEditBuf(b=>({...b,newOwnerName:e.target.value,ownerName:e.target.value}))}
                                placeholder="New member name..." style={{ flex:1, fontSize:10, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'3px 6px' }}/>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                            <span style={{ color:'var(--color-text-secondary)' }}>{u.ownerName||'—'}</span>
                            <span style={{ fontSize:9, color:'var(--color-text-tertiary)' }}>(linked member)</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:11, color:'var(--color-text-tertiary)' }}>
                        {isEditing ? (
                          <input value={editBuf.password||''} onChange={e=>setEditBuf(b=>({...b,password:e.target.value}))} style={{ fontSize:11, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'3px 6px', width:100 }} type="text"/>
                        ) : (
                          <>
                            {showPass.has(u.id)?u.password:'••••••••'}
                            <button onClick={()=>setShowPass(s=>{const n=new Set(s);n.has(u.id)?n.delete(u.id):n.add(u.id);return n;})} style={{ marginLeft:6, background:'none', border:'none', cursor:'pointer', color:'var(--color-text-tertiary)' }}>
                              {showPass.has(u.id)?<EyeOff size={12}/>:<Eye size={12}/>}
                            </button>
                          </>
                        )}
                      </td>
                      <td style={{ padding:'8px 12px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                        <div style={{ display:'flex', gap:5 }}>
                          {isEditing ? (
                            <>
                              <button onClick={()=>saveEdit(u)} style={{ padding:'2px 8px', borderRadius:5, fontSize:10, fontWeight:500, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>Save</button>
                              <button onClick={()=>setEditingUser(null)} style={{ padding:'2px 6px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer' }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=>startEdit(u)} style={{ padding:'2px 7px', borderRadius:5, fontSize:10, border:'0.5px solid var(--color-border-secondary)', color:'var(--color-text-secondary)', background:'transparent', cursor:'pointer', display:'inline-flex', alignItems:'center', gap:3 }}><Pencil size={10}/> Edit</button>
                              {u.id!=='admin'&&<button onClick={()=>setUsers(p=>p.filter(uu=>uu.id!==u.id))} style={{ padding:'2px 6px', borderRadius:5, fontSize:10, border:'0.5px solid #F09595', color:'#791F1F', background:'#FCEBEB', cursor:'pointer' }}><X size={10}/></button>}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NAV ACCESS ── */}
      {section==='nav' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <p style={{ fontSize:12, color:'var(--color-text-secondary)' }}>Toggle access on/off per role. Admin always sees all panels.</p>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={() => {
                const updates: Record<string,boolean> = {};
                ALL_PANELS.forEach(p => navRoles.forEach(r => { updates[`${p.id}:${r.value}`] = true; }));
                setNavAccess(updates);
              }} style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'0.5px solid #3B6D1140', color:'#27500A', background:'#EAF3DE', cursor:'pointer' }}>Enable all</button>
              <button onClick={() => {
                const updates: Record<string,boolean> = {};
                ALL_PANELS.forEach(p => navRoles.forEach(r => { if(r.value!=='admin') updates[`${p.id}:${r.value}`] = false; }));
                setNavAccess(updates);
              }} style={{ fontSize:10, padding:'4px 10px', borderRadius:6, border:'0.5px solid #F09595', color:'#791F1F', background:'#FCEBEB', cursor:'pointer' }}>Disable all</button>
            </div>
          </div>

          <style>{`
            .tog-track { width:36px; height:20px; border-radius:99px; display:inline-flex; align-items:center; padding:2px; cursor:pointer; border:none; transition:background .2s; flex-shrink:0 }
            .tog-thumb { width:16px; height:16px; border-radius:50%; background:#fff; transition:transform .2s; box-shadow:0 1px 3px rgba(0,0,0,.25) }
          `}</style>

          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:700 }}>
              <thead>
                <tr>
                  <th style={{ fontSize:10, fontWeight:600, padding:'10px 16px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'left', background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', position:'sticky', left:0, zIndex:2 }}>Panel</th>
                  {navRoles.map(role => {
                    const rc = roleColor(role.value);
                    return (
                      <th key={role.value} style={{ fontSize:10, fontWeight:600, padding:'10px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)', textAlign:'center', background:'var(--color-background-secondary)', whiteSpace:'nowrap', minWidth:100 }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:99, color:rc.color, background:rc.bg }}>{role.label}</span>
                          <span style={{ fontSize:9, color:'var(--color-text-tertiary)', fontWeight:400 }}>
                            {ALL_PANELS.filter(p => isNavEnabled(p.id, role.value)).length}/{ALL_PANELS.length} on
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {ALL_PANELS.map((panel, pi) => (
                  <tr key={panel.id} style={{ background: pi%2===0 ? 'transparent' : 'var(--color-background-secondary)' }}>
                    <td style={{ fontSize:12, fontWeight:500, padding:'10px 16px', borderBottom:'0.5px solid var(--color-border-tertiary)', color:'var(--color-text-primary)', position:'sticky', left:0, background: pi%2===0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)', zIndex:1 }}>
                      {panel.label}
                    </td>
                    {navRoles.map(role => {
                      const enabled = isNavEnabled(panel.id, role.value);
                      const rc = roleColor(role.value);
                      return (
                        <td key={role.value} style={{ textAlign:'center', padding:'10px 14px', borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                          <button
                            className="tog-track"
                            onClick={() => toggleNav(panel.id, role.value)}
                            style={{ background: enabled ? rc.color : '#d1d5db' }}
                            title={`${enabled ? 'Disable' : 'Enable'} ${panel.label} for ${role.label}`}
                          >
                            <div className="tog-thumb" style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0)' }} />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize:10, color:'var(--color-text-tertiary)', marginTop:8 }}>Changes apply immediately — users see the updated nav on their next interaction.</p>
        </div>
      )}

      {/* ── LISTS ── */}
      {section==='lists' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          <ListCard title="Clients" optKey="clients"/>
          <ListCard title="SEO Owners" optKey="seoOwners"/>
          <ListCard title="Content Owners" optKey="contentOwners"/>
          <ListCard title="Web Owners" optKey="webOwners"/>
          <ListCard title="SEO Stages" optKey="seoStages"/>
          <ListCard title="Social Media Task Types" optKey="socialTaskTypes"/>
          <ListCard title="Design Task Types" optKey="designTaskTypes"/>
          <ListCard title="Ads Task Types" optKey="adsTaskTypes"/>
          <ListCard title="Web Dev Task Types" optKey="webDevTaskTypes"/>
          <ListCard title="Platforms" optKey="platforms"/>
        </div>
      )}

      {/* ── STATUSES ── */}
      {section==='statuses' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          <ListCard title="SEO QC Statuses" optKey="seoQcStatuses"/>
          <ListCard title="Content Statuses" optKey="contentStatuses"/>
          <ListCard title="Web Statuses" optKey="webStatuses"/>
        </div>
      )}
    </div>
  );
}
