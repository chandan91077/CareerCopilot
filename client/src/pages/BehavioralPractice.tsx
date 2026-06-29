import React, { useState } from 'react';
import api from '../services/api';
import { 
  Heart, AlertCircle, Sparkles, CheckCircle2, 
  Send, Loader2, RotateCcw, HelpCircle 
} from 'lucide-react';

export default function BehavioralPractice() {
  const [questionCategory, setQuestionCategory] = useState('Conflict');
  const [question, setQuestion] = useState('Describe a situation where you had a conflict with a team member and how you resolved it.');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [error, setError] = useState('');

  const questionsMap: Record<string, string> = {
    Conflict: 'Describe a situation where you had a conflict with a team member and how you resolved it.',
    Leadership: 'Tell me about a time when you led a critical project phase or stepped up to guide a team through a crisis.',
    Teamwork: 'Give an example of a successful project collaboration, highlighting how you handled diverse team opinions.',
    'Problem Solving': 'Explain a situation where you encountered a block in production code and how you resolved it under pressure.',
    Communication: 'Describe a scenario where you had to explain a complex technical architecture concept to non-technical stakeholders.'
  };

  const handleCategoryChange = (cat: string) => {
    setQuestionCategory(cat);
    setQuestion(questionsMap[cat]);
    setAnswer('');
    setEvalResult(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) {
      setError('Please type your response.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/interview/behavioral', { question, answer });
      setEvalResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">Behavioral STAR Practicer</h1>
        <p className="text-slate-500 mt-1">Hone your behavioral answers. Receive rating summaries based on the Situation, Task, Action, and Result structure.</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Category Select Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.keys(questionsMap).map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
              questionCategory === cat 
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' 
                : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-slate-850 text-slate-500'
            }`}
          >
            {cat} Question
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Answer Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3 bg-slate-100 dark:bg-dark-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/60">
              <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Question</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 leading-normal">{question}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Your Answer</label>
                <textarea
                  rows={8}
                  required
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  placeholder="Structure your answer following:
1. Situation: Set the scene.
2. Task: Describe what needed to be done.
3. Action: Detail exactly what you contributed.
4. Result: Show the metrics or outcomes."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-dark-950 border border-slate-250 dark:border-slate-800 rounded-2xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none text-sm font-sans leading-relaxed"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !answer.trim()}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center cursor-pointer"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <>Submit Response <Send className="w-4 h-4 ml-2" /></>}
              </button>
            </form>
          </div>
        </div>

        {/* AI rating response */}
        <div className="lg:col-span-1 space-y-6">
          {evalResult ? (
            <div className="glass-panel rounded-3xl p-6 shadow-xl space-y-6">
              <div className="text-center pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border-4 border-indigo-500 mx-auto shadow-md">
                  <span className="text-2xl font-black text-indigo-500">{evalResult.score}%</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mt-3">STAR Evaluation Score</h4>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Communication</span>
                    <span className="text-slate-600 dark:text-slate-350">{evalResult.metrics?.communication}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-dark-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${evalResult.metrics?.communication}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Grammar Structure</span>
                    <span className="text-slate-600 dark:text-slate-350">{evalResult.metrics?.grammar}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-dark-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${evalResult.metrics?.grammar}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">STAR Completeness</span>
                    <span className="text-slate-600 dark:text-slate-350">{evalResult.metrics?.completeness}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-dark-800 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${evalResult.metrics?.completeness}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-100 dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-indigo-500 flex items-center mb-1"><Sparkles className="w-3.5 h-3.5 mr-1" /> AI Coach Feedback</span>
                <p className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed text-justify">{evalResult.feedback}</p>
              </div>

              <button
                onClick={() => setEvalResult(null)}
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Redo Question
              </button>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-6 h-fit space-y-6">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
                <Heart className="w-4 h-4 mr-2 text-indigo-500" /> STAR Guidance
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed text-justify">
                The **STAR Method** is the gold standard for behavioral interviews. It checks:
              </p>
              <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-2 pl-4 list-disc">
                <li>**Situation**: Set the background framework clearly.</li>
                <li>**Task**: Highlight target problems or tasks.</li>
                <li>**Action**: Specify YOUR individual contribution.</li>
                <li>**Result**: Describe metrics, achievements, or learnings.</li>
              </ul>
              <div className="p-4 bg-slate-150 dark:bg-dark-950 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Make sure to highlight business outcomes, such as page latency reduced by 30% or product deliveries streamlined.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
