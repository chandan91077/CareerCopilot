import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Users, CreditCard, Play, Server, ShieldCheck, 
  TrendingUp, Terminal, AlertCircle, RefreshCw, Loader2 
} from 'lucide-react';
import api from '../services/api';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, logsRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/logs')
      ]);
      setData(analyticsRes.data);
      setLogs(logsRes.data || []);
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
      </div>
    );
  }

  const statCards = [
    { title: 'Total Registered Users', value: data?.totalUsers || 0, icon: Users, color: 'text-rose-500 bg-rose-500/10' },
    { title: 'Premium Subscribers', value: data?.premiumUsers || 0, icon: CreditCard, color: 'text-amber-500 bg-amber-500/10' },
    { title: "Today's Interview practices", value: data?.todayInterviewsCount || 0, icon: Play, color: 'text-indigo-500 bg-indigo-500/10' },
    { title: 'Total Revenue ($)', value: `$${data?.totalRevenue || 0}`, icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-500/10' }
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">System Monitoring & Analytics</h1>
          <p className="text-slate-500 mt-1">Review active user metrics, monthly revenue trends, OpenAI costs, and administrator logs.</p>
        </div>
        <button 
          onClick={loadData}
          className="p-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-850 rounded-xl text-slate-500 hover:text-slate-750 cursor-pointer"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-panel rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.title}</p>
                  <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">{card.value}</p>
                </div>
                <div className={`p-4 rounded-xl ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Area Chart */}
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Monthly Revenue Stream</h3>
            <p className="text-xs text-slate-450 mt-0.5">Historical monthly billing summation</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* API Cost Split Chart */}
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">OpenAI Usage Cost Breakdown</h3>
            <p className="text-xs text-slate-450 mt-0.5">Cost details split by AI parsers and graders</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.apiUsageBreakdown || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="service" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cost" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Admin Audit Logs */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800/60 pb-4">
          <Terminal className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Administrative Logs (Audit Trail)</h3>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm italic">
            No administrator audit logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-450 font-bold uppercase tracking-wider">
                  <th className="pb-3">Admin User</th>
                  <th className="pb-3">Event Action</th>
                  <th className="pb-3">Target ID</th>
                  <th className="pb-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-600 dark:text-slate-350">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-55/10">
                    <td className="py-3 font-semibold">{log.adminEmail}</td>
                    <td className="py-3 text-rose-500 dark:text-rose-455 font-semibold">{log.action}</td>
                    <td className="py-3 font-mono">{log.targetId || 'N/A'}</td>
                    <td className="py-3 text-right text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
