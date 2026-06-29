import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { 
  History, Calendar, Clock, Award, ChevronDown, ChevronUp, 
  Download, FileText, Loader2, RefreshCw 
} from 'lucide-react';

export default function InterviewHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await api.get('/interview/history');
      setHistory(response.data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const handleDownloadReport = (session: any) => {
    // Generate a simple window print mockup formatted report
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow popups to download report.');
      return;
    }

    const questionsHtml = session.questions.map((q: any, idx: number) => `
      <div style="margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
        <h4 style="margin: 0; color: #1e293b;">Q${idx + 1}: ${q.question}</h4>
        <p style="margin: 8px 0; color: #475569; font-style: italic;">Answer: ${q.userAnswer}</p>
        <p style="margin: 4px 0; color: #4f46e5; font-weight: 600;">Accuracy Score: ${q.score}%</p>
        <p style="margin: 4px 0; color: #64748b;">Feedback: ${q.feedback}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>${session.title} - PDF Report</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .score-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; margin-bottom: 30px; }
            .metrics { display: grid; grid-template-cols: 25% 25% 25% 25%; gap: 10px; margin-bottom: 30px; }
            .metric-item { background: #f1f5f9; padding: 12px; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; color: #4f46e5;">PrepAI Performance Report</h1>
            <p style="margin: 5px 0 0 0; color: #64748b;">Generated for Mock Interview on ${new Date(session.createdAt).toLocaleDateString()}</p>
          </div>
          <div class="score-box">
            <div>
              <h3 style="margin: 0; color: #334155;">${session.title}</h3>
              <p style="margin: 5px 0 0 0; color: #64748b;">Category: ${session.category} | Exp: ${session.experienceLevel}</p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 32px; font-weight: 800; color: #4f46e5;">${session.score}%</span>
              <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px; text-transform: uppercase;">Grade</p>
            </div>
          </div>
          <div class="metrics">
            <div class="metric-item"><strong>${session.metrics?.technicalAccuracy}%</strong><br><span style="font-size: 10px; color: #64748b;">Technical</span></div>
            <div class="metric-item"><strong>${session.metrics?.communication}%</strong><br><span style="font-size: 10px; color: #64748b;">Comm</span></div>
            <div class="metric-item"><strong>${session.metrics?.grammar}%</strong><br><span style="font-size: 10px; color: #64748b;">Grammar</span></div>
            <div class="metric-item"><strong>${session.metrics?.completeness}%</strong><br><span style="font-size: 10px; color: #64748b;">Completeness</span></div>
          </div>
          <h3>AI Coach Evaluation summary</h3>
          <p style="color: #475569; margin-bottom: 40px; text-align: justify;">${session.feedbackSummary}</p>
          <h3>Question-by-Question Transcript</h3>
          ${questionsHtml}
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Interview History Reports</h1>
          <p className="text-slate-500 mt-1">Review your past performance scores, read chronological logs, and print/download reports.</p>
        </div>
        <button 
          onClick={fetchHistory}
          className="p-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        </div>
      ) : history.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center text-slate-400">
          <History className="w-16 h-16 mx-auto mb-4 text-slate-350" />
          <p className="text-lg font-bold">No sessions found</p>
          <p className="text-sm mt-1">You haven't completed any mock interviews yet. Start one to see logs here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((session) => {
            const isExpanded = expandedId === session._id;
            return (
              <div 
                key={session._id} 
                className="glass-panel rounded-2xl overflow-hidden shadow-sm transition-all border border-slate-200/80"
              >
                {/* Header card Summary */}
                <div 
                  onClick={() => toggleExpand(session._id)}
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-100/40 dark:hover:bg-dark-800/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 font-extrabold text-lg">
                      {session.score || 0}%
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">{session.title}</h4>
                      <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                        <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" /> {new Date(session.createdAt).toLocaleDateString()}</span>
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {session.durationMinutes} mins</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadReport(session);
                      }}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg text-slate-500 hover:text-slate-700 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Expanded transcript block */}
                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-200 dark:border-slate-800/40 space-y-6 bg-slate-50/50 dark:bg-dark-900/10">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-100 dark:bg-dark-955 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{session.metrics?.technicalAccuracy || 0}%</span>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Technical</p>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{session.metrics?.communication || 0}%</span>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Comm</p>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{session.metrics?.grammar || 0}%</span>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Grammar</p>
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{session.metrics?.completeness || 0}%</span>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">STAR</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center">
                        <FileText className="w-4 h-4 mr-2 text-indigo-500" /> Evaluation Transcript
                      </h5>
                      <div className="space-y-6">
                        {session.questions.map((q: any, idx: number) => (
                          <div key={idx} className="p-4 bg-white dark:bg-dark-950/60 rounded-xl shadow-sm space-y-3 border border-slate-200/50 dark:border-slate-850">
                            <p className="text-xs font-bold text-indigo-500">Question {idx + 1}</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-normal">{q.question}</p>
                            <div className="pl-4 border-l-2 border-slate-200 text-slate-500 leading-relaxed text-xs italic dark:text-slate-400">
                              Answer: {q.userAnswer || '[No Response provided]'}
                            </div>
                            <div className="pt-2 flex flex-col gap-2">
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">AI Score: {q.score}%</span>
                              <p className="text-xs text-slate-550 dark:text-slate-400">{q.feedback}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
