import React, { useState, useEffect } from 'react';
import { Sliders, Sparkles, AlertCircle, Save, Loader2, RefreshCw } from 'lucide-react';

const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://careercopilot-hu7q.onrender.com';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const apiBase = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (apiBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${apiBase}${normalizedPath.substring(4)}`;
  }
  return `${apiBase}${normalizedPath}`;
};

import AdminNavTabs from './AdminNavTabs';

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/admin/prompts'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data || []);
      }
    } catch (err) {
      console.error('Failed to load prompts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleUpdateContent = (key: string, val: string) => {
    setPrompts(prev => prev.map(p => p.key === key ? { ...p, content: val } : p));
  };

  const handleSavePrompt = async (key: string, content: string) => {
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/admin/prompts'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ key, content })
      });
      if (res.ok) {
        setMessage(`Prompt template updated successfully!`);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError('Failed to update prompt configuration.');
      }
    } catch (err) {
      setError('Failed to update prompt configuration.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <AdminNavTabs />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Sliders className="w-8 h-8 text-indigo-500" />
            AI Prompt Configuration
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure and fine-tune OpenAI prompt templates used for reviews and evaluations dynamically in runtime.</p>
        </div>
        <button 
          onClick={fetchPrompts}
          className="p-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-dark-800 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm text-center font-semibold">
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-sm font-semibold text-center">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {prompts.map((item) => (
            <div key={item.key} className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center text-sm">
                    <Sparkles className="w-4 h-4 mr-2 text-indigo-500" /> {item.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Updated on: {new Date(item.updatedAt).toLocaleString()} by {item.updatedBy}</p>
                </div>
                <button
                  onClick={() => handleSavePrompt(item.key, item.content)}
                  disabled={savingKey !== null}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer shadow-md shadow-indigo-500/20"
                >
                  {savingKey === item.key ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save Changes
                </button>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">System Instructions Prompt</label>
                <textarea
                  rows={5}
                  value={item.content}
                  onChange={e => handleUpdateContent(item.key, e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-mono text-slate-900 dark:text-white leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
