import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, Lock, User, Briefcase, Loader2, ArrowRight } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName || !targetRole) {
      setError('Please fill in all fields');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        targetRole
      });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const jobRoles = [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'DevOps Engineer',
    'AI / Machine Learning Engineer',
    'Data Analyst',
    'HR Manager'
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-dark-950 to-black p-4">
      <div className="w-full max-w-lg bg-dark-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <span className="text-4xl">🚀</span>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-3">
            Create Account
          </h2>
          <p className="text-slate-400 text-sm mt-2">Get started with your personalized preparation path</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">First Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Last Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Target Job Role</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Briefcase className="w-4 h-4" />
              </span>
              <select
                value={targetRole}
                onChange={e => setTargetRole(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all appearance-none"
              >
                {jobRoles.map(role => (
                  <option key={role} value={role} className="bg-slate-900 text-slate-200">{role}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.01] shadow-lg shadow-indigo-500/25 flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-slate-400 text-sm relative z-10">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
