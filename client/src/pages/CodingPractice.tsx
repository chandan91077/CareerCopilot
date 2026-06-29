import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import { 
  Play, Send, Code, Award, CheckCircle2, XCircle, 
  Loader2, AlertCircle, ChevronRight, Terminal, BookOpen
} from 'lucide-react';

export default function CodingPractice() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [language, setLanguage] = useState<'javascript' | 'python' | 'java' | 'cpp'>('javascript');
  const [code, setCode] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [aiReview, setAiReview] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'ai'>('console');
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  // Load questions
  useEffect(() => {
    async function loadQuestions() {
      try {
        const response = await api.get('/coding/questions');
        setQuestions(response.data || []);
        if (response.data && response.data.length > 0) {
          const firstQ = response.data[0];
          setSelectedQuestion(firstQ);
          setCode(firstQ.starterTemplates[language] || '');
        }
      } catch (err) {
        console.error('Failed to load coding questions:', err);
      } finally {
        setLoadingQuestions(false);
      }
    }
    loadQuestions();
  }, []);

  // Update editor template when question or language changes
  useEffect(() => {
    if (selectedQuestion) {
      setCode(selectedQuestion.starterTemplates[language] || '');
      setConsoleOutput('');
      setTestStatus('');
      setAiReview(null);
      setActiveTab('console');
    }
  }, [selectedQuestion, language]);

  const handleRunCode = async () => {
    if (!selectedQuestion) return;
    setRunning(true);
    setConsoleOutput('Running sample tests in sandboxed runtime...');
    setActiveTab('console');

    try {
      const response = await api.post('/coding/run', {
        questionId: selectedQuestion.id,
        language,
        codeContent: code
      });
      setConsoleOutput(response.data.compileOutput || '');
      setTestStatus(response.data.success ? 'PASSED' : 'FAILED');
    } catch (err: any) {
      setConsoleOutput(err.response?.data?.message || 'Error running code.');
      setTestStatus('ERROR');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!selectedQuestion) return;
    setSubmitting(true);
    setConsoleOutput('Executing final check and running static analyzer...');
    setActiveTab('console');
    setAiReview(null);

    try {
      const response = await api.post('/coding/submit', {
        questionId: selectedQuestion.id,
        language,
        codeContent: code
      });
      const data = response.data.session;
      setConsoleOutput(data.compileOutput || 'Submission successful!');
      setTestStatus(data.isPassed ? 'ACCEPTED' : 'WRONG ANSWER');
      setAiReview(data.aiReview);
      setActiveTab('ai');
    } catch (err: any) {
      setConsoleOutput(err.response?.data?.message || 'Error submitting code.');
      setTestStatus('ERROR');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Coding Practice Arena</h1>
          <p className="text-slate-500 mt-1">Refactor algorithms using a live code compiler and receive detailed complexity analysis.</p>
        </div>
        
        {/* Language Select */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Language:</span>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value as any)}
            className="px-4 py-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px]">
        {/* Left Side: Question List & Desc (4 cols) */}
        <div className="lg:col-span-4 flex flex-col glass-panel rounded-3xl overflow-hidden shadow-sm h-full">
          {/* Question List Header */}
          <div className="p-4 bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800/60">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center">
              <BookOpen className="w-4 h-4 mr-2 text-indigo-500" /> Coding Challenges
            </h3>
          </div>

          {loadingQuestions ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/40">
              {questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuestion(q)}
                  className={`w-full text-left p-4 hover:bg-slate-100 dark:hover:bg-dark-800/30 transition-colors flex items-center justify-between ${
                    selectedQuestion?.id === q.id ? 'bg-indigo-500/5 dark:bg-dark-850' : ''
                  }`}
                >
                  <div>
                    <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">{q.title}</h4>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{q.category}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                    q.difficulty === 'Easy' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                      : q.difficulty === 'Medium'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                  }`}>
                    {q.difficulty}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected Question Details */}
          {selectedQuestion && (
            <div className="p-6 bg-slate-100 dark:bg-dark-900 border-t border-slate-200 dark:border-slate-800/60 overflow-y-auto max-h-[300px]">
              <h4 className="font-extrabold text-base text-slate-800 dark:text-slate-200">{selectedQuestion.title}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-350 leading-relaxed whitespace-pre-wrap mt-3 text-justify">
                {selectedQuestion.description}
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Monaco Editor & Output (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full gap-4">
          {/* Editor Container */}
          <div className="flex-1 glass-panel rounded-3xl overflow-hidden shadow-md flex flex-col border border-slate-200/80">
            <div className="px-6 py-3 bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center">
                <Code className="w-4 h-4 mr-1 text-indigo-500" /> main.{language === 'python' ? 'py' : language === 'cpp' ? 'cpp' : language === 'java' ? 'java' : 'js'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRunCode}
                  disabled={running || submitting}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-xs flex items-center transition-colors cursor-pointer"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />}
                  Run Tests
                </button>
                <button
                  onClick={handleSubmitCode}
                  disabled={running || submitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center transition-all cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                  Submit Code
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-h-[300px]">
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  cursorBlinking: 'smooth',
                  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 }
                }}
              />
            </div>
          </div>

          {/* Console / AI panel Container */}
          <div className="h-[220px] glass-panel rounded-3xl overflow-hidden flex flex-col shadow-md">
            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('console')}
                className={`px-6 py-2.5 font-bold text-xs flex items-center cursor-pointer transition-colors ${
                  activeTab === 'console' 
                    ? 'border-b-2 border-indigo-500 text-indigo-500' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                <Terminal className="w-4 h-4 mr-1.5" /> Compiler Console
                {testStatus && (
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold ${
                    testStatus === 'PASSED' || testStatus === 'ACCEPTED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {testStatus}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-6 py-2.5 font-bold text-xs flex items-center cursor-pointer transition-colors ${
                  activeTab === 'ai' 
                    ? 'border-b-2 border-indigo-500 text-indigo-500' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                }`}
              >
                <Award className="w-4 h-4 mr-1.5" /> AI Feedback Review
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 p-4 overflow-y-auto bg-white dark:bg-dark-950/60 font-mono text-xs">
              {activeTab === 'console' ? (
                <div className="space-y-1 whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300">
                  {consoleOutput || '$ compiler outputs will appear here when you run code.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {aiReview ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center bg-slate-100 dark:bg-dark-900 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-slate-500 text-[10px] uppercase">Time Complexity</span>
                          <span className="font-mono text-xs text-indigo-500 font-semibold">{aiReview.timeComplexity}</span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-100 dark:bg-dark-900 px-3 py-1.5 rounded-lg">
                          <span className="font-bold text-slate-500 text-[10px] uppercase">Space Complexity</span>
                          <span className="font-mono text-xs text-purple-500 font-semibold">{aiReview.spaceComplexity}</span>
                        </div>
                        <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                          <span className="text-[10px] uppercase font-bold text-rose-500 flex items-center"><AlertCircle className="w-3.5 h-3.5 mr-1" /> Core Mistakes</span>
                          <p className="text-xs text-slate-500 mt-1 leading-normal">{aiReview.mistakesExplanation}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-indigo-500 flex items-center"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Better Optimization</span>
                          <p className="text-xs text-slate-500 mt-1 leading-normal whitespace-pre-wrap">{aiReview.betterSolution}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-center py-6 font-sans">
                      Submit your code to generate interactive AI complexity reviews.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
