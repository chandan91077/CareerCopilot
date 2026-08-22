import React, { useState, useEffect } from 'react';
import api, { getApiUrl } from '../services/api';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, Lightbulb, 
  Loader2, Download, Sparkles
} from 'lucide-react';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [latestResume, setLatestResume] = useState<any>(null);
  const [jdText, setJdText] = useState('');
  const [jdTitle, setJdTitle] = useState('');
  const [jdCompany, setJdCompany] = useState('');
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPlan, setCurrentPlan] = useState('free');
  const [desktopMeta, setDesktopMeta] = useState<any>(null);

  const rawUser = localStorage.getItem('user');
  const user = rawUser ? JSON.parse(rawUser) : null;
  const username = user ? user.email.split('@')[0] : 'User';

  const loadResumeAndStatus = async () => {
    try {
      const [resumeRes, statusRes, metaRes] = await Promise.all([
        api.get('/resume/latest').catch(() => ({ data: null })),
        api.get('/payment/status').catch(() => ({ data: { plan: 'free' } })),
        api.get('/download/desktop/meta').catch(() => ({ data: null }))
      ]);
      setLatestResume(resumeRes.data);
      setCurrentPlan(statusRes.data.plan || 'free');
      if (metaRes.data && metaRes.data.sizeMB) {
        setDesktopMeta(metaRes.data);
      }
    } catch (err) {
      console.log('Error loading initial data');
    }
  };

  useEffect(() => {
    loadResumeAndStatus();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }
    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await api.post('/resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('Resume analyzed and synchronized successfully!');
      setLatestResume(response.data.resume);
      setFile(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload and parse resume.');
    } finally {
      setUploading(false);
    }
  };

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdText) {
      setError('Please paste the Job Description text.');
      return;
    }
    setError('');
    setComparing(true);

    try {
      const response = await api.post('/resume/compare-jd', {
        jdText,
        jdTitle,
        jdCompany
      });
      setComparisonResult(response.data.comparison);
      setSuccess('Resume compared with Job Description successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner / Desktop Client Promotion */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 md:p-12 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold uppercase tracking-wider mb-4 border border-white/20 text-white shadow-sm">
            <Sparkles className="w-3.5 h-3.5" /> Desktop Copilot Active
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight capitalize text-white drop-shadow-sm">
            Welcome Back, {username}!
          </h1>
          <p className="text-indigo-100 mt-3 text-sm md:text-base leading-relaxed">
            Upload your resume below to synchronize your credentials. When your simulated practice interview starts, launch the <span className="font-semibold text-white">Desktop Application</span> to run the real-time helper overlay.
          </p>

          {/* Quick Guide Overlay Info */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/20 pt-6">
            <div>
              <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider mb-2">Desktop Hotkeys</p>
              <ul className="text-xs text-indigo-100 space-y-1.5 list-disc pl-4">
                <li><strong className="text-white">Ctrl + /</strong> - Toggle overlay visibility</li>
                <li><strong className="text-white">Ctrl + Enter</strong> - Capture and analyze screen</li>
                <li><strong className="text-white">Ctrl + [ / ]</strong> - Prev / Next response in history</li>
                <li><strong className="text-white">Ctrl + Arrow Keys</strong> - Move assistant overlay window</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider mb-2">App & Plan Settings</p>
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-xs font-semibold text-indigo-100">Active Tier: <span className="uppercase text-white font-bold bg-white/20 px-2 py-0.5 rounded ml-1 border border-white/10">{currentPlan}</span></span>
                <a 
                  href={getApiUrl('/api/download/desktop')}
                  download="CareerCopilotSetup.exe"
                  className="w-fit px-4 py-2 mt-2 bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer no-underline"
                >
                  <Download className="w-3.5 h-3.5" /> Download Windows App (.exe) {desktopMeta?.sizeMB ? `(${desktopMeta.sizeMB} MB)` : ''}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm text-center font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm text-center font-medium">
          {success}
        </div>
      )}

      {/* Main Resume Sync Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload Resume */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass-panel rounded-2xl p-6 shadow-sm bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Upload Resume PDF
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center hover:border-indigo-500/50 transition-colors relative cursor-pointer bg-slate-50/50 dark:bg-dark-950/50">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileText className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-500 mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {file ? file.name : 'Select or drop resume PDF'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">PDF file up to 5MB</p>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer shadow-md shadow-indigo-500/10"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Synchronize Resume'}
              </button>
            </form>
          </div>

          {/* Parsed Resume Details */}
          {latestResume && (
            <div className="glass-panel rounded-2xl p-6 space-y-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Original Document</h4>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" /> {latestResume.originalName}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Extracted Summary</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                  {latestResume.summary}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Skills Synchronized</h4>
                <div className="flex flex-wrap gap-2">
                  {latestResume.skills.map((skill: string) => (
                    <span key={skill} className="px-2.5 py-1 text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-dark-800 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-500/20">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Columns: JD comparison */}
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-panel rounded-2xl p-6 shadow-sm bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" /> Target Job Alignment Check
            </h3>

            <form onSubmit={handleCompare} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Job Title</label>
                  <input
                    type="text"
                    value={jdTitle}
                    onChange={e => setJdTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Architect"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none text-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Company Name</label>
                  <input
                    type="text"
                    value={jdCompany}
                    onChange={e => setJdCompany(e.target.value)}
                    placeholder="e.g. Google"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none text-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">Job Description Details</label>
                <textarea
                  rows={6}
                  required
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  placeholder="Paste details of target job requirements here to find align score..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-950 border border-slate-300 dark:border-slate-800 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none font-sans text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={comparing || !latestResume}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-md shadow-indigo-500/10"
              >
                {comparing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Align Resume & Check Match Rate'}
              </button>
              {!latestResume && (
                <p className="text-center text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">Please upload a resume first to align with job descriptions.</p>
              )}
            </form>
          </div>

          {/* Comparison Output */}
          {comparisonResult && (
            <div className="glass-panel rounded-2xl p-6 space-y-6 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="relative w-24 h-24 flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 rounded-full border-4 border-indigo-600 shadow-lg shadow-indigo-500/15 shrink-0">
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{comparisonResult.compareMatchScore}%</span>
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">Match</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100">{comparisonResult.title || 'Job Alignment Analysis'}</h4>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{comparisonResult.company || 'Company'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Missing Skills */}
                <div className="space-y-4">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Missing / Required Skills
                  </h5>
                  {comparisonResult.missingSkillsMatched && comparisonResult.missingSkillsMatched.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {comparisonResult.missingSkillsMatched.map((skill: string) => (
                        <span key={skill} className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 rounded-full border border-amber-200 dark:border-amber-500/20">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Excellent! No missing key skills found.</p>
                  )}
                </div>

                {/* Suggestions */}
                <div className="space-y-4">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                    <Lightbulb className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" /> AI Optimization Suggestions
                  </h5>
                  <ul className="space-y-2">
                    {comparisonResult.suggestions?.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
