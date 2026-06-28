import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { User, Phone, Briefcase, Plus, X, Sparkles, Loader2, Save } from 'lucide-react';

export default function Settings() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const response = await api.get('/profile');
        const p = response.data;
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
        setPhone(p.phone || '');
        setBio(p.bio || '');
        setExperienceYears(p.experienceYears?.toString() || '0');
        setTargetRole(p.targetRole || 'Software Engineer');
        setSkills(p.skills || []);
      } catch (err) {
        console.error('Failed to load profile settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);

    try {
      const response = await api.put('/profile', {
        firstName,
        lastName,
        phone,
        bio,
        experienceYears: parseInt(experienceYears),
        targetRole,
        skills
      });
      setMessage('Profile settings saved successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills(prev => [...prev, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Profile Settings</h1>
        <p className="text-slate-500 mt-1">Configure your personal information, highlight candidate skills, and adjust target job settings.</p>
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

      <form onSubmit={handleSave} className="glass-panel rounded-3xl p-8 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">First Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Last Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="sm:col-span-2">
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Phone Number</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Experience (Years)</label>
            <input
              type="number"
              min="0"
              value={experienceYears}
              onChange={e => setExperienceYears(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Bio / Professional Summary</label>
          <textarea
            rows={4}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="A short summary detailing your background and target career priorities..."
            className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none text-sm font-sans leading-relaxed"
          />
        </div>

        <div>
          <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Target Job Position</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Briefcase className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
              placeholder="Software Engineer"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
            />
          </div>
        </div>

        {/* Skill tag editor */}
        <div>
          <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Skills Inventory</label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              placeholder="e.g. AWS"
              className="flex-1 px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-250 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none text-sm"
            />
            <button
              type="button"
              onClick={handleAddSkill}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 p-4 bg-slate-100 dark:bg-dark-950 rounded-2xl border border-slate-200 dark:border-slate-850 min-h-[60px]">
            {skills.length === 0 ? (
              <span className="text-xs text-slate-400 italic my-auto">Add skills to your candidate profile.</span>
            ) : (
              skills.map(skill => (
                <span 
                  key={skill} 
                  className="inline-flex items-center px-3 py-1 text-xs font-bold bg-indigo-500/10 text-indigo-500 rounded-full border border-indigo-500/10"
                >
                  {skill}
                  <button 
                    type="button" 
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-1.5 p-0.5 rounded-full hover:bg-indigo-500/20 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center cursor-pointer"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <>Save Settings <Save className="w-4 h-4 ml-2" /></>}
        </button>
      </form>
    </div>
  );
}
