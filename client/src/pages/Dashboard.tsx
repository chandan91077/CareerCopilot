import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Trophy, 
  BookOpen, 
  FileCheck, 
  Compass, 
  TrendingUp, 
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    interviewScore: 0,
    interviewsDone: 0,
    codingSessionsDone: 0,
    resumeMatchScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentInterviews, setRecentInterviews] = useState<any[]>([]);

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const username = user ? user.email.split('@')[0] : 'User';

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [interviewsRes, codingRes, resumeRes] = await Promise.all([
          api.get('/interview/history'),
          api.get('/coding/sessions'),
          api.get('/resume/latest').catch(() => ({ data: null }))
        ]);

        const interviews = interviewsRes.data || [];
        const coding = codingRes.data || [];
        const resume = resumeRes.data || null;

        // Calculate average score
        const completedInterviews = interviews.filter((i: any) => i.isCompleted);
        const avgScore = completedInterviews.length > 0
          ? Math.round(completedInterviews.reduce((acc: number, curr: any) => acc + (curr.score || 0), 0) / completedInterviews.length)
          : 0;

        setStats({
          interviewScore: avgScore,
          interviewsDone: interviews.length,
          codingSessionsDone: coding.length,
          resumeMatchScore: resume ? 85 : 0 // sample display
        });
        
        setRecentInterviews(interviews.slice(0, 3));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  // Performance data for chart
  const weeklyPerformance = [
    { name: 'Mon', score: 65 },
    { name: 'Tue', score: 70 },
    { name: 'Wed', score: 78 },
    { name: 'Thu', score: 75 },
    { name: 'Fri', score: 82 },
    { name: 'Sat', score: stats.interviewScore || 80 },
  ];

  // Weak area data for pie chart
  const weakAreas = [
    { name: 'Technical Depth', value: 35, color: '#6366f1' },
    { name: 'System Scaling', value: 30, color: '#a855f7' },
    { name: 'Communication', value: 20, color: '#f43f5e' },
    { name: 'STAR Framework', value: 15, color: '#eab308' },
  ];

  const statCards = [
    { title: 'Average Mock Score', value: `${stats.interviewScore}%`, icon: Trophy, color: 'text-indigo-500 bg-indigo-500/10' },
    { title: 'Completed Interviews', value: stats.interviewsDone, icon: Compass, color: 'text-purple-500 bg-purple-500/10' },
    { title: 'Coding Submissions', value: stats.codingSessionsDone, icon: BookOpen, color: 'text-emerald-500 bg-emerald-500/10' },
    { title: 'Resume ATS Score', value: stats.resumeMatchScore > 0 ? `${stats.resumeMatchScore}%` : 'No Upload', icon: FileCheck, color: 'text-amber-500 bg-amber-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-12 text-white shadow-xl shadow-indigo-500/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-white/10 rounded-full blur-2xl" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-4 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" /> PrepAI Copilot Activated
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight capitalize">
            Hello, {username}!
          </h1>
          <p className="text-indigo-100 mt-3 text-base md:text-lg">
            Ready to ace your next big interview? Let's check your performance dashboard and start a dynamic practice session today.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/interview')}
              className="px-6 py-3 bg-white text-indigo-600 hover:bg-slate-50 font-bold rounded-xl shadow-md transition-all flex items-center cursor-pointer"
            >
              Start Mock Interview <ArrowRight className="w-4 h-4 ml-2" />
            </button>
            <button
              onClick={() => navigate('/resume')}
              className="px-6 py-3 bg-white/15 border border-white/20 hover:bg-white/20 font-bold rounded-xl transition-all cursor-pointer"
            >
              Upload Resume
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="glass-panel rounded-2xl p-6 transition-all duration-200 hover:scale-[1.02] shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{card.title}</p>
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

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Performance Chart */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Performance Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Mock interview scoring over past sessions</p>
            </div>
            <span className="inline-flex items-center text-xs text-indigo-500 font-semibold bg-indigo-500/10 px-2.5 py-1 rounded-full">
              <TrendingUp className="w-3 h-3 mr-1" /> +12% increase
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="score" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weak Areas Split */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Weakness Analytics</h3>
          <p className="text-xs text-slate-400 mb-6">Key points identified for skill improvement</p>
          <div className="h-52 flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weakAreas}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {weakAreas.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {weakAreas.map((entry, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{entry.name}</span>
                </div>
                <span className="text-slate-400 font-semibold">{entry.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Practice Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Recommended Practice Modules</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-6 hover:shadow-lg transition-all duration-200 flex flex-col justify-between border-l-4 border-indigo-500">
              <div>
                <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Mock Practice</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-3">Behavioral STAR Challenge</h4>
                <p className="text-sm text-slate-400 mt-2">Practice structured answers using the Situation, Task, Action, Result methodology.</p>
              </div>
              <button onClick={() => navigate('/behavioral')} className="mt-6 flex items-center text-sm font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer">
                Practice Behavioral <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>

            <div className="glass-panel rounded-2xl p-6 hover:shadow-lg transition-all duration-200 flex flex-col justify-between border-l-4 border-emerald-500">
              <div>
                <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">Coding</span>
                <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-3">Valid Parentheses (Easy)</h4>
                <p className="text-sm text-slate-400 mt-2">Optimize algorithms with stack utilities. Evaluates runtime time and space complexities.</p>
              </div>
              <button onClick={() => navigate('/coding')} className="mt-6 flex items-center text-sm font-bold text-emerald-500 hover:text-emerald-600 cursor-pointer">
                Solve Challenge <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="glass-panel rounded-2xl p-6 border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/2">
          <div className="flex items-center gap-2 mb-4 text-amber-500">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100">AI Preparation Insights</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Based on your mock interviews, your explanations for **System Design Scaling** are slightly abstract. You need to explicitly detail:
          </p>
          <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc pl-4 mt-3 space-y-2">
            <li>Horizontal vs vertical scaling strategies.</li>
            <li>Caching architectures like Redis/Memcached.</li>
            <li>Database replication mechanisms.</li>
          </ul>
          <button 
            onClick={() => navigate('/interview')}
            className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all cursor-pointer"
          >
            Review Interview Tips
          </button>
        </div>
      </div>
    </div>
  );
}
