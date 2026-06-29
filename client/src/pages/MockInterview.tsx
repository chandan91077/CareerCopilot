import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { 
  Mic, MicOff, Volume2, VolumeX, Send, ArrowRight, 
  RotateCcw, Sparkles, AlertCircle, Play, CheckCircle2,
  Sliders, Loader2, Award
} from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function MockInterview() {
  const [step, setStep] = useState(1); // 1 = Config, 2 = Live Session, 3 = Final Report
  const [category, setCategory] = useState('Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState('Fresher');
  const [durationMinutes, setDurationMinutes] = useState('15');
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [interviewId, setInterviewId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'ai' | 'user'; content: string; eval?: any }>>([]);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Recognition state
  const recognitionRef = useRef<any>(null);

  // Final Reports State
  const [finalReport, setFinalReport] = useState<any>(null);

  // Setup options
  const categories = [
    'Software Engineer', 'Frontend', 'Backend', 'Java', 'Python', 
    'HR', 'Data Analyst', 'Machine Learning', 'DevOps', 'AI Engineer'
  ];
  const experiences = ['Fresher', '1 Year', '2 Years', '5 Years'];
  const durations = ['15 min', '30 min', '60 min'];

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setUserAnswer(prev => prev + ' ' + finalTranscript || interimTranscript);
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, []);

  const speak = (text: string) => {
    if (!ttsEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startTimer = () => {
    setTimer(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      const response = await api.post('/interview/start', {
        category,
        experienceLevel,
        durationMinutes: parseInt(durationMinutes)
      });
      const data = response.data;
      setInterviewId(data.interviewId);
      setCurrentQuestion(data.question);
      setQuestionIndex(0);
      setChatHistory([{ role: 'ai', content: data.question }]);
      setStep(2);
      speak(data.question);
      startTimer();
    } catch (err) {
      console.error(err);
      alert('Failed to start interview.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRecord = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please type your answers.');
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };

  const submitAnswer = async () => {
    if (!userAnswer.trim()) {
      alert('Please speak or type your response before submitting.');
      return;
    }

    // Stop recording if active
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    stopTimer();
    setLoading(true);

    const submittedText = userAnswer;
    setUserAnswer('');

    // Append user answer immediately to history
    setChatHistory(prev => [...prev, { role: 'user', content: submittedText }]);

    try {
      const response = await api.post('/interview/answer', {
        interviewId,
        answerText: submittedText,
        timeSpentSeconds: timer
      });

      const data = response.data;
      if (data.isCompleted) {
        setFinalReport(data.interviewReport);
        setStep(3);
      } else {
        // Append previous evaluation to last chat bubble and add new question
        setChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1].eval = data.evaluationResult;
          return [...updated, { role: 'ai', content: data.nextQuestion }];
        });
        setCurrentQuestion(data.nextQuestion);
        setQuestionIndex(data.questionIndex);
        speak(data.nextQuestion);
        startTimer();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send answer.');
      startTimer();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">AI Mock Interview Agent</h1>
        <p className="text-slate-500 mt-1">Simulate interactive mock interviews for technical and HR job roles. Practice by voice or text.</p>
      </div>

      {/* Step 1: Configuration */}
      {step === 1 && (
        <div className="glass-panel rounded-3xl p-8 shadow-xl max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-800/60 pb-4">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configure Mock Interview</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Interview Job Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Target Experience</label>
                <select
                  value={experienceLevel}
                  onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
                >
                  {experiences.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Duration Target</label>
                <select
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value.split(' ')[0])}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 text-slate-800 dark:text-slate-100 outline-none transition-all"
                >
                  {durations.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-100 dark:bg-dark-950 rounded-xl">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Text-To-Speech (TTS)</p>
                <p className="text-xs text-slate-400">Speak generated questions aloud automatically</p>
              </div>
              <button
                onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  ttsEnabled ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' : 'bg-slate-200 border-slate-300 dark:bg-dark-800 dark:border-dark-700 text-slate-500'
                }`}
              >
                {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </div>

            <button
              onClick={startInterview}
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <>Start Preparation <ArrowRight className="w-5 h-5 ml-2" /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Conversation */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main chat window */}
          <div className="lg:col-span-2 flex flex-col h-[550px] glass-panel rounded-3xl overflow-hidden shadow-xl border border-slate-200/80">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-100 dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{category} practice</h3>
                <p className="text-xs text-slate-400">Question #{questionIndex + 1}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg">
                Time: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Message window */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatHistory.map((bubble, idx) => (
                <div key={idx} className={`flex ${bubble.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    bubble.role === 'ai'
                      ? 'bg-slate-100 dark:bg-dark-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                      : 'bg-indigo-600 text-white rounded-tr-none'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{bubble.content}</p>

                    {/* Show quick eval score after user replies */}
                    {bubble.eval && (
                      <div className="mt-4 pt-3 border-t border-indigo-400/20 text-xs flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-indigo-200">
                          <Sparkles className="w-3.5 h-3.5" /> Core Accuracy Score: {bubble.eval.score}%
                        </div>
                        <p className="text-indigo-200 leading-normal">{bubble.eval.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input options */}
            <div className="p-4 bg-slate-100 dark:bg-dark-900/60 border-t border-slate-200 dark:border-slate-800">
              <div className="flex gap-3">
                <button
                  onClick={handleToggleRecord}
                  className={`p-3.5 rounded-xl transition-all shadow-md cursor-pointer ${
                    isRecording 
                      ? 'bg-rose-500 text-white animate-pulse' 
                      : 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500'
                  }`}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={userAnswer}
                  onChange={e => setUserAnswer(e.target.value)}
                  placeholder={isRecording ? 'Listening to transcription...' : 'Type or voice your answer here...'}
                  className="flex-1 px-4 py-3 bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-slate-800 dark:text-slate-100 text-sm shadow-inner"
                />

                <button
                  onClick={submitAnswer}
                  disabled={loading || !userAnswer.trim()}
                  className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Prompt panel details */}
          <div className="lg:col-span-1 glass-panel rounded-3xl p-6 h-fit space-y-6">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center">
              <Award className="w-5 h-5 mr-2 text-indigo-500" /> Speech Helper
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              If your microphone is enabled, click the mic icon and speak your answer. Your speech is transcribed in real-time. If it makes an error, edit it before hitting Send.
            </p>
            <div className="p-4 bg-slate-100 dark:bg-dark-950 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Take your time to structure your response using the STAR method: Situation, Task, Action, and Result.
              </p>
            </div>
            <button
              onClick={() => speak(currentQuestion)}
              className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors cursor-pointer"
            >
              <Volume2 className="w-4 h-4 mr-2" /> Replay Question Audio
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Final report Card */}
      {step === 3 && finalReport && (
        <div className="glass-panel rounded-3xl p-8 shadow-xl max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <Award className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
            <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Mock Interview Complete!</h3>
            <p className="text-slate-400 text-sm mt-1">Check out your final evaluation report</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Score */}
            <div className="bg-indigo-500/5 rounded-2xl p-6 text-center border border-indigo-500/10">
              <span className="text-4xl font-extrabold text-indigo-500">{finalReport.score}%</span>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Overall Grade</p>
            </div>
            {/* Duration */}
            <div className="bg-purple-500/5 rounded-2xl p-6 text-center border border-purple-500/10">
              <span className="text-4xl font-extrabold text-purple-500">{finalReport.questions?.length}</span>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Questions Answered</p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">Competency Breakdown</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Technical Depth</span>
                  <span className="text-slate-700 dark:text-slate-350">{finalReport.metrics?.technicalAccuracy || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-dark-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${finalReport.metrics?.technicalAccuracy || 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Communication</span>
                  <span className="text-slate-700 dark:text-slate-350">{finalReport.metrics?.communication || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-dark-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full" style={{ width: `${finalReport.metrics?.communication || 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Grammar & Structure</span>
                  <span className="text-slate-700 dark:text-slate-350">{finalReport.metrics?.grammar || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-dark-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${finalReport.metrics?.grammar || 0}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Completeness (STAR)</span>
                  <span className="text-slate-700 dark:text-slate-350">{finalReport.metrics?.completeness || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-dark-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${finalReport.metrics?.completeness || 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-slate-100 dark:bg-dark-900 rounded-2xl space-y-2 border border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center text-sm">
              <Sparkles className="w-4 h-4 mr-2 text-indigo-500" /> Summary AI Coach Review
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {finalReport.feedbackSummary}
            </p>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Start Another Session
          </button>
        </div>
      )}
    </div>
  );
}
