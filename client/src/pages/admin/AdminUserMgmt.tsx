import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Shield, User, Loader2, Search, Check, X, CreditCard 
} from 'lucide-react';

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

export default function AdminUserMgmt() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/admin/users'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChangeRole = async (userId: string, currentRole: string) => {
    const targetRole = currentRole === 'admin' ? 'user' : 'admin';
    setActionLoading(userId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/role`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: targetRole })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: targetRole } : u));
      } else {
        alert('Failed to modify user role.');
      }
    } catch (err) {
      alert('Failed to modify user role.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePlan = async (userId: string, newPlan: string) => {
    setActionLoading(userId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}/plan`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan: newPlan })
      });
      if (res.ok) {
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, plan: newPlan } : u));
      } else {
        alert('Failed to modify user subscription plan.');
      }
    } catch (err) {
      alert('Failed to modify user subscription plan.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user and their profile details?')) {
      return;
    }
    setActionLoading(userId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl(`/api/admin/users/${userId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u._id !== userId));
      } else {
        alert('Failed to delete user.');
      }
    } catch (err) {
      alert('Failed to delete user.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <AdminNavTabs />
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-500" />
          User & Subscription Management
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Review accounts, adjust authorization roles, and manage user subscription plans (Free, Basic, Premium).</p>
      </div>

      <div className="flex gap-4">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts by email..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-12 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-semibold">No accounts match search terms.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Subscription Plan</th>
                  <th className="p-4">Email Verification</th>
                  <th className="p-4">Authorization Role</th>
                  <th className="p-4">Registered On</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {filteredUsers.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50 dark:hover:bg-dark-800/40">
                    <td className="p-4 font-bold text-slate-900 dark:text-white">{item.email}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.plan || 'free'}
                          disabled={actionLoading === item._id}
                          onChange={(e) => handleChangePlan(item._id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                            item.plan === 'premium'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                              : item.plan === 'basic'
                              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                              : 'bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <option value="free" className="bg-white dark:bg-dark-900 text-slate-800 dark:text-white">Free Plan</option>
                          <option value="basic" className="bg-white dark:bg-dark-900 text-indigo-600 dark:text-indigo-400">Basic Plan ($19/mo)</option>
                          <option value="premium" className="bg-white dark:bg-dark-900 text-purple-600 dark:text-purple-400">Premium Plan ($49/mo)</option>
                        </select>
                      </div>
                    </td>
                    <td className="p-4">
                      {item.isVerified ? (
                        <span className="flex items-center text-emerald-500 font-bold"><Check className="w-4 h-4 mr-1" /> Verified</span>
                      ) : (
                        <span className="flex items-center text-slate-400"><X className="w-4 h-4 mr-1" /> Unverified</span>
                      )}
                    </td>
                    <td className="p-4 font-semibold capitalize">{item.role}</td>
                    <td className="p-4 text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleChangeRole(item._id, item.role)}
                        disabled={actionLoading !== null}
                        title="Change authorization permissions role"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {item.role === 'admin' ? <User className="w-4 h-4 text-indigo-500" /> : <Shield className="w-4 h-4 text-rose-500" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(item._id)}
                        disabled={actionLoading !== null}
                        title="Delete User permanently"
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
