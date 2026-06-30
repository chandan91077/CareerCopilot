import React, { useState, useEffect } from 'react';
import { Sliders, Sparkles, AlertCircle, Save, Loader2, RefreshCw } from 'lucide-react';
import api from '../services/api';

export default function AdminPrompts() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/prompts');
      setPrompts(response.data || []);
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
      await api.put('/admin/prompts', { key, content });
      setMessage(`Prompt template updated successfully!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('Failed to update prompt configuration.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">AI Prompt Configuration</h1>
          <p className="text-slate-500 mt-1">Configure and fine-tune OpenAI prompt templates used for reviews and evaluations dynamically in runtime.</p>
        </div>
        <button 
          onClick={fetchPrompts}
          className="p-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-505 hover:text-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold text-center">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        </div>
      ) : (
        <div className="space-y-8">
          {prompts.map((item) => (
            <div key={item.key} className="glass-panel rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800/60 pb-3">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                    <Sparkles className="w-4 h-4 mr-2 text-rose-500 animate-pulse-slow" /> {item.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Updated on: {new Date(item.updatedAt).toLocaleString()} by {item.updatedBy}</p>
                </div>
                <button
                  onClick={() => handleSavePrompt(item.key, item.content)}
                  disabled={savingKey !== null}
                  className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer"
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-955 border border-slate-250 dark:border-slate-800 rounded-2xl focus:border-rose-500 outline-none text-xs font-mono leading-relaxed"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
