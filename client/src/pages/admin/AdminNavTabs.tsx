import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Sliders } from 'lucide-react';

export default function AdminNavTabs() {
  const location = useLocation();

  const tabs = [
    { name: 'System Analytics', path: '/admin', icon: LayoutDashboard },
    { name: 'User & Subscriptions', path: '/admin/users', icon: Users },
    { name: 'Prompt Configurations', path: '/admin/prompts', icon: Sliders },
  ];

  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path || (tab.path === '/admin' && location.pathname === '/admin');
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs transition-colors whitespace-nowrap ${
              isActive
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
