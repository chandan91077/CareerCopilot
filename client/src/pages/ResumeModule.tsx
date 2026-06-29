import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, Lightbulb, 
  Percent, ArrowRight, Loader2, RefreshCw 
} from 'lucide-react';

export default function ResumeModule() {
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

  const loadResumeData = async () => {
    try {
      const response = await api.get('/resume/latest');
      setLatestResume(response.data);
    } catch (err) {
      console.log('No resume uploaded yet.');
    }
  };

  useEffect(() => {
    loadResumeData();
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
      setSuccess('Resume analyzed successfully!');
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
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Resume AI & JD Comparer</h1>
        <p className="text-slate-500 mt-1">Upload your resume to extract skills, identify gaps, and analyze matching rates against target job descriptions.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm text-center">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload Resume & Summary */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass-panel rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
              <Upload className="w-5 h-5 mr-2 text-indigo-500" /> Upload Resume PDF
            </h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center hover:border-indigo-500/50 transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileText className="w-10 h-10 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {file ? file.name : 'Select or drop resume PDF'}
                </p>
                <p className="text-xs text-slate-400 mt-1">PDF file up to 5MB</p>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : 'Analyze Resume'}
              </button>
            </form>
          </div>

          {/* Parsed Resume Details */}
          {latestResume && (
            <div className="glass-panel rounded-2xl p-6 space-y-6">
              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Original Document</h4>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-indigo-500" /> {latestResume.originalName}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Extracted Summary</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-justify">
                  {latestResume.summary}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Skills Found</h4>
                <div className="flex flex-wrap gap-2">
                  {latestResume.skills.map((skill: string) => (
                    <span key={skill} className="px-2.5 py-1 text-xs font-semibold bg-indigo-550/10 text-indigo-600 dark:bg-dark-800 dark:text-indigo-400 rounded-full border border-indigo-500/10">
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
          <div className="glass-panel rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-purple-500" /> Paste Job Description
            </h3>

            <form onSubmit={handleCompare} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Job Title</label>
                  <input
                    type="text"
                    value={jdTitle}
                    onChange={e => setJdTitle(e.target.value)}
                    placeholder="e.g. Lead React Developer"
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Company Name</label>
                  <input
                    type="text"
                    value={jdCompany}
                    onChange={e => setJdCompany(e.target.value)}
                    placeholder="e.g. Google"
                    className="w-full px-4 py-2 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Job Description Text</label>
                <textarea
                  rows={6}
                  required
                  value={jdText}
                  onChange={e => setJdText(e.target.value)}
                  placeholder="Paste details of target job requirements here..."
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none font-sans"
                />
              </div>

              <button
                type="submit"
                disabled={comparing || !latestResume}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {comparing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : 'Compare Resume with JD'}
              </button>
              {!latestResume && (
                <p className="text-center text-xs text-amber-500 mt-2 font-medium">Please upload a resume first to run JD comparisons.</p>
              )}
            </form>
          </div>

          {/* Comparison Output */}
          {comparisonResult && (
            <div className="glass-panel rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-6 border-b border-slate-200 dark:border-slate-800/60 pb-6">
                {/* Score Circle */}
                <div className="relative w-24 h-24 flex items-center justify-center bg-indigo-500/10 rounded-full border-4 border-indigo-500 shadow-lg shadow-indigo-500/15">
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-indigo-500">{comparisonResult.compareMatchScore}%</span>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Match</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200">{comparisonResult.title || 'Job Analysis'}</h4>
                  <p className="text-sm font-semibold text-slate-400">{comparisonResult.company || 'Google'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Detected Missing Skills */}
                <div className="space-y-4">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" /> Missing / Required Skills
                  </h5>
                  {comparisonResult.missingSkillsMatched && comparisonResult.missingSkillsMatched.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {comparisonResult.missingSkillsMatched.map((skill: string) => (
                        <span key={skill} className="px-2.5 py-1 text-xs font-semibold bg-amber-500/10 text-amber-600 rounded-full">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Excellent! No missing key skills found.</p>
                  )}
                </div>

                {/* Suggestions */}
                <div className="space-y-4">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                    <Lightbulb className="w-4 h-4 mr-2 text-indigo-500" /> AI Suggestions to Improve Match
                  </h5>
                  <ul className="space-y-2">
                    {comparisonResult.suggestions?.map((item: string, idx: number) => (
                      <li key={idx} className="flex items-start text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-indigo-500 shrink-0 mt-0.5" />
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
