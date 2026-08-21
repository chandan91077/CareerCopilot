import React, { useState, useEffect } from 'react';
import { 
  Users, Trash2, Shield, User, Loader2, Search, Check, X 
} from 'lucide-react';
import api from '../services/api';

export default function AdminUserMgmt() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data || []);
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
      await api.put(`/admin/users/${userId}/role`, { role: targetRole });
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, role: targetRole } : u));
    } catch (err) {
      alert('Failed to modify user role.');
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
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u._id !== userId));
    } catch (err) {
      alert('Failed to delete user.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-850 dark:text-slate-100">User Account Management</h1>
        <p className="text-slate-500 mt-1">Review verified users, adjust account permission roles, and delete inactive profiles.</p>
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
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-rose-500 outline-none text-sm transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-rose-500" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-sm font-semibold">No accounts match search terms.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl shadow-sm overflow-hidden border border-slate-200/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-250 dark:border-slate-800 bg-slate-100 dark:bg-dark-900/60 text-slate-450 font-bold uppercase tracking-wider">
                  <th className="p-4">Email Address</th>
                  <th className="p-4">Subscription Plan</th>
                  <th className="p-4">Email Verification</th>
                  <th className="p-4">Authorization Role</th>
                  <th className="p-4">Registered On</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-650 dark:text-slate-350">
                {filteredUsers.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-55/10">
                    <td className="p-4 font-bold">{item.email}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                        item.plan === 'premium' 
                          ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' 
                          : item.plan === 'basic' 
                          ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' 
                          : 'bg-slate-100 text-slate-400 dark:bg-dark-800'
                      }`}>
                        {item.plan}
                      </span>
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
                        className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {item.role === 'admin' ? <User className="w-4 h-4 text-indigo-500" /> : <Shield className="w-4 h-4 text-rose-500" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(item._id)}
                        disabled={actionLoading !== null}
                        title="Delete User permanently"
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg text-rose-600 dark:text-rose-455 transition-colors cursor-pointer"
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
