import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Settings, 
  Sliders, 
  ArrowLeft, 
  Sun, 
  Moon, 
  Menu, 
  X,
  Lock
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;

  const mainAppUrl = import.meta.env.VITE_MAIN_APP_URL || 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5173'
      : window.location.origin.replace('-admin', ''));

  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    // Basic protection check
    if (!user || user.role !== 'admin') {
      const resolvedMainUrl = mainAppUrl.replace(/\/$/, '').toLowerCase();
      const currentOrigin = window.location.origin.replace(/\/$/, '').toLowerCase();
      
      if (resolvedMainUrl !== currentOrigin) {
        window.location.href = `${mainAppUrl}/login`;
      } else {
        setUnauthorized(true);
      }
    }
  }, [user, mainAppUrl]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const navItems = [
    { name: 'Admin Dashboard', path: '/', icon: ShieldCheck },
    { name: 'Manage Users', path: '/users', icon: Users },
    { name: 'Configure Prompts', path: '/prompts', icon: Sliders },
  ];

  if (unauthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950 p-6 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/25">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            You must be logged in as an administrator on the main application to view the system dashboard.
          </p>
          <a
            href={`${mainAppUrl}/login`}
            className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm shadow-lg shadow-rose-500/20 hover:opacity-90 transition-opacity w-full"
          >
            Go to Candidate Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-dark-950 transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-slate-800/60 sticky top-0 h-screen transition-colors">
        <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800/60 gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">
            PrepAI Admin
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-extrabold border border-rose-500/20">
            SYSTEM
          </span>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center px-4 py-3 rounded-xl transition-all duration-150 font-semibold text-sm ${
                  isActive
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-4 border-rose-500'
                    : 'text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-800/40 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-rose-500' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* System Settings & back toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Theme</span>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-650 dark:text-slate-350 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          <a
            href={`${mainAppUrl}/dashboard`}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-600 dark:text-slate-350 font-bold text-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Candidate Dashboard
          </a>
        </div>
      </aside>

      {/* Mobile view Header */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-16 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between px-6 sticky top-0 z-40 transition-colors">
          <span className="text-lg font-bold bg-gradient-to-r from-rose-500 to-amber-500 bg-clip-text text-transparent">PrepAI Admin</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 animate-none"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-35 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
            <nav className="w-72 bg-white dark:bg-dark-900 h-full p-6 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-8">
                <span className="text-lg font-bold text-rose-500">PrepAI Admin</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded bg-slate-100 dark:bg-dark-800 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-xl font-semibold text-sm ${
                        isActive
                          ? 'bg-rose-50 dark:bg-dark-800 text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-slate-200 dark:border-slate-800/60">
                <a
                  href={`${mainAppUrl}/dashboard`}
                  className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-250 text-slate-650 font-bold text-xs"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Candidate
                </a>
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
