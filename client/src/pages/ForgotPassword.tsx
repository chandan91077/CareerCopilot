import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, Key, Loader2, ArrowLeft, Send } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1 = request token, 2 = submit reset
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRequestToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please provide your email');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setMessage('Password reset token generated! Please check backend console output logs to retrieve your token.');
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to request reset. Make sure the email exists.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) {
      setError('Token and new password are required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Check if token is valid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-dark-950 to-black p-4">
      <div className="w-full max-w-md bg-dark-900/60 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center mb-8 relative z-10">
          <span className="text-4xl">🔑</span>
          <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-3">
            Reset Password
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            {step === 1 ? 'Enter your email to request recovery' : 'Submit your verification token and new password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
            {message}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestToken} className="space-y-5 relative z-10">
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
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Request Code <Send className="w-4 h-4 ml-2" /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-5 relative z-10">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Verification Code</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Key className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Check server console..."
                  className="w-full pl-10 pr-4 py-3 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-dark-950 border border-slate-800 rounded-xl focus:border-indigo-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm New Password'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center relative z-10">
          <Link to="/login" className="inline-flex items-center text-sm font-semibold text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
