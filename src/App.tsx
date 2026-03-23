import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import { Layout } from './components/Layout';
import { Login } from './views/Login';
import { Dashboard } from './views/Dashboard';
import { AllTasks } from './views/AllTasks';
import { TodayTasks } from './views/TodayTasks';
import { ClientView } from './views/ClientView';
import { TaskEntry } from './views/TaskEntry';
import { AdminPanel } from './views/AdminPanel';
import { ActionView } from './views/ActionView';
import { KeywordReporting } from './views/KeywordReporting';
import { Timesheet } from './views/Timesheet';
import { WorkHub } from './views/WorkHub';

function AppContent() {
  const { tasks, currentUser, isAdmin } = useAppContext();
  const [activeTab, setActiveTab] = useState('action');

  if (!currentUser) return <Login />;

  // Filter tasks based on role — admin sees all
  const userTasks = isAdmin ? tasks : tasks.filter(t => {
    if (currentUser.role === 'seo') return t.seoOwner === currentUser.ownerName;
    if (currentUser.role === 'content') return t.contentOwner === currentUser.ownerName;
    if (currentUser.role === 'web') return t.webOwner === currentUser.ownerName;
    return true;
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard tasks={userTasks} />;
      case 'all': return <AllTasks tasks={userTasks} />;
      case 'today': return <TodayTasks tasks={userTasks} />;
      case 'client': return <ClientView tasks={userTasks} />;
      case 'task-entry': return <TaskEntry />;
      case 'action': return <ActionView />;
      case 'keyword-reporting': return <KeywordReporting />;
      case 'timesheet': return <Timesheet />;
      case 'workhub': return <WorkHub />;
      case 'admin': return isAdmin ? <AdminPanel /> : <div className="p-8 text-zinc-500">Access denied.</div>;
      default: return <ActionView />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
